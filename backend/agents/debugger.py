import json
import hashlib
import re
from datetime import datetime

from services.usage_tracker import UsageTracker
from llm.groq_client import generate_response
from llm.prompt_templates import FIXER_PROMPT
from memory.project_memory import save_memory
from services.execution_stream import append_execution_step
from services.code_parser import (
    extract_files_from_response,
    merge_code_files,
)


def _normalize_files(code_data):
    """
    Normalize project code into the canonical format:

    [
        {
            "path": "...",
            "code": "..."
        }
    ]

    Supports both:
        list format
    and legacy:
        {"files": [...]}
    """

    if not code_data:
        return []

    if isinstance(code_data, list):

        return [
            item
            for item in code_data
            if isinstance(item, dict)
            and item.get("path")
        ]

    if isinstance(code_data, dict):

        files = code_data.get(
            "files",
            []
        )

        if isinstance(files, list):

            return [
                item
                for item in files
                if isinstance(item, dict)
                and item.get("path")
            ]

    return []


def _extract_json_candidates(text):
    """
    Yield JSON object/list candidates from an LLM response.

    Handles:
      - raw JSON
      - ```json ... ``` fenced JSON
      - explanatory text before/after JSON
      - multiple JSON candidates
    """
    if not isinstance(text, str):
        return []

    candidates = []

    # First try the complete response after removing common markdown fences.
    cleaned = text.strip()
    if cleaned.startswith("```") and cleaned.endswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 3:
            cleaned = "\n".join(lines[1:-1]).strip()

    for candidate_text in (cleaned, text):
        decoder = json.JSONDecoder()
        index = 0

        while index < len(candidate_text):
            # Find the next possible JSON object/array.
            match = re.search(r"[\{\[]", candidate_text[index:])
            if not match:
                break

            start = index + match.start()

            try:
                value, consumed = decoder.raw_decode(
                    candidate_text[start:]
                )
                candidates.append(value)
                index = start + consumed
            except json.JSONDecodeError:
                index = start + 1

    return candidates


def _extract_debugger_files(response):
    """
    Robust debugger response extraction.

    Primary parser remains authoritative. If it cannot extract files,
    fall back to JSON embedded in markdown/explanatory text.
    """
    # 1. Existing project parser.
    try:
        parsed = extract_files_from_response(response)
        normalized = _normalize_files(parsed)
        if normalized:
            return normalized
    except Exception as exc:
        print(
            "[Debugger] Primary parser failed: "
            f"{exc}"
        )

    # 2. JSON embedded in the response.
    for candidate in _extract_json_candidates(response):
        normalized = _normalize_files(candidate)
        if normalized:
            return normalized

        # Some models wrap the payload one level deeper.
        if isinstance(candidate, dict):
            for key in (
                "files",
                "fixed_code",
                "generated_code",
                "code",
                "output",
                "result",
            ):
                nested = candidate.get(key)
                normalized = _normalize_files(nested)
                if normalized:
                    return normalized

    # 3. Last-resort: parse a fenced JSON block explicitly.
    if isinstance(response, str):
        fenced_blocks = re.findall(
            r"```(?:json|JSON)?\s*(.*?)```",
            response,
            flags=re.DOTALL,
        )

        for block in fenced_blocks:
            try:
                candidate = json.loads(block.strip())
            except (TypeError, json.JSONDecodeError):
                continue

            normalized = _normalize_files(candidate)
            if normalized:
                return normalized

    return []


def debugger_agent(state):
    # Bind LLM usage telemetry to this Engineer execution.
    UsageTracker.set_context(
        user_id=state.get("user_id"),
        module="engineer",
        operation="debugger_agent",
        agent="debugger",
        project_id=state.get("project_id"),
        execution_id=state.get("execution_id"),
    )


    # =========================================================
    # 1. Iteration
    # =========================================================

    state["iterations"] = (
        state.get(
            "iterations",
            0
        ) + 1
    )

    iteration = state[
        "iterations"
    ]

    # =========================================================
    # 2. Starting debugger
    # =========================================================

    append_execution_step(
        state,
        {
            "agent": "debugger",
            "step": "analyzing_issues",
            "status": "in_progress",
            "message": (
                f"Iteration {iteration}: "
                "Analyzing test results and identifying fixes"
            ),
        }
    )

    # =========================================================
    # 3. Get generated code
    # =========================================================

    generated_code = (
        state.get(
            "fixed_code"
        )
        or state.get(
            "generated_code"
        )
        or []
    )

    generated_files = _normalize_files(
        generated_code
    )

    test_report = state.get("test_results", {})
    # Keep the established fixer prompt but give it every verifier's structured
    # evidence. Security findings were redacted before entering state.
    debug_context = {
        "tests": test_report if isinstance(test_report, dict) else {},
        "static_analysis": state.get("static_analysis_results") or {},
        "security": state.get("security_analysis_results") or {},
        "quality_gate": state.get("quality_gate_report") or {},
    }

    # =========================================================
    # 4. Build fixer prompt
    # =========================================================

    prompt = FIXER_PROMPT

    prompt = prompt.replace(
        "{generated_code}",
        json.dumps(
            generated_files,
            indent=2,
            ensure_ascii=False
        )
    )

    prompt = prompt.replace(
        "{debug_report}",
        json.dumps(
            debug_context,
            indent=2,
            ensure_ascii=False
        )
    )

    # =========================================================
    # 5. Self-learning context
    # =========================================================

    try:

        from services.self_learning import get_relevant_learnings

        owner_id = state.get(
            "user_id",
            "system"
        )

        learnings, applied = get_relevant_learnings(owner_id, state.get("idea", ""))

        if learnings:
            state.setdefault("learnings_applied", []).extend(applied)

            prompt = (
                f"{learnings}\n\n"
                f"{prompt}"
            )

    except Exception as exc:

        print(
            "[Debugger] Self-learning context "
            f"unavailable: {exc}"
        )

    # =========================================================
    # 6. Generating fixes
    # =========================================================

    append_execution_step(
        state,
        {
            "agent": "debugger",
            "step": "generating_fixes",
            "status": "in_progress",
            "message": (
                f"Iteration {iteration}: "
                "Generating corrected code"
            ),
        }
    )

    # =========================================================
    # 7. LLM call
    # =========================================================

    try:

        response = generate_response(
            prompt,
            max_tokens=8192
        )

    except Exception as exc:

        err_msg = (
            f"Debugger LLM failed: {exc}"
        )

        print(
            f"\n=== DEBUGGER ERROR ===\n"
            f"{err_msg}"
        )

        state["debug_report"] = (
            err_msg
        )

        if "agent_notes" not in state:
            state["agent_notes"] = []

        state["agent_notes"].append(
            "Debugger LLM generation failed"
        )

        append_execution_step(
            state,
            {
                "agent": "debugger",
                "step": "generating_fixes",
                "status": "failed",
                "message": (
                    f"Iteration {iteration}: "
                    f"{err_msg}"
                ),
            }
        )

        return state

    # =========================================================
    # 8. Raw response
    # =========================================================

    print(
        "\n=== DEBUGGER RAW ===\n"
    )

    try:

        print(
            response[:3000]
            .encode(
                "utf-8",
                errors="replace"
            )
            .decode(
                "utf-8",
                errors="replace"
            )
        )

    except Exception:
        pass

    # =========================================================
    # 9. Extract fixed files
    # =========================================================

    try:

        fixed_files = _extract_debugger_files(
            response
        )

    except Exception as exc:

        print(
            "\n=== DEBUGGER PARSE ERROR ==="
        )

        print(
            str(exc)
        )

        fixed_files = []

    # =========================================================
    # 10. Validate fixed files
    # =========================================================

    if fixed_files:

        # -----------------------------------------------------
        # Existing project files
        # -----------------------------------------------------

        prior_code = (
            state.get(
                "fixed_code"
            )
            or state.get(
                "generated_code"
            )
            or []
        )

        prior_files = _normalize_files(
            prior_code
        )

        # -----------------------------------------------------
        # Merge fixed files with existing files
        # -----------------------------------------------------

        try:

            merged_files = (
                merge_code_files(
                    prior_files,
                    fixed_files
                )
            )

            # Some older versions of merge_code_files()
            # may return {"files": [...]}, so normalize again.
            merged_files = _normalize_files(
                merged_files
            )

        except Exception as exc:

            print(
                "[Debugger] Merge failed: "
                f"{exc}"
            )

            # Safe fallback:
            # keep old files and overwrite by path
            merged_map = {
                file_data["path"]: file_data
                for file_data in prior_files
            }

            for file_data in fixed_files:

                merged_map[
                    file_data["path"]
                ] = file_data

            merged_files = list(
                merged_map.values()
            )

        # -----------------------------------------------------
        # Store canonical list format
        # -----------------------------------------------------

        state["fixed_code"] = (
            merged_files
        )

        # A repair loop that returns identical code cannot recover on a later
        # Tester run.  Preserve the existing hash field and let the router end
        # safely instead of spending the remaining iteration budget.
        code_hash = hashlib.sha256(
            json.dumps(merged_files, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest()
        prior_hash = state.get("last_debugger_code_hash")
        state["no_progress"] = prior_hash == code_hash
        state["last_debugger_code_hash"] = code_hash

        state["generated_code"] = (
            merged_files
        )

        state["debug_report"] = (
            "Code fixed successfully"
        )

        if "agent_notes" not in state:
            state["agent_notes"] = []

        state["agent_notes"].append(
            "Debugger fixed code"
        )

        # -----------------------------------------------------
        # Workspace update
        # -----------------------------------------------------

        workspace_path = state.get(
            "project_path"
        )

        if workspace_path:

            try:

                workspace_files = (
                    __import__(
                        "services.workspace_manager",
                        fromlist=[
                            "workspace_manager"
                        ]
                    ).workspace_manager
                )

                workspace_files.write_files(
                    workspace_path,
                    merged_files
                )

                print(
                    "[Debugger] Workspace updated "
                    "with corrected files."
                )

            except Exception as exc:

                print(
                    "[Debugger] Workspace update "
                    f"failed: {exc}"
                )

        # -----------------------------------------------------
        # Execution stream
        # -----------------------------------------------------

        append_execution_step(
            state,
            {
                "agent": "debugger",
                "step": "generating_fixes",
                "status": "completed",
                "message": (
                    f"Iteration {iteration}: "
                    "Successfully generated corrected code"
                ),
                "details": {
                    "iteration": iteration,
                    "files_fixed": len(
                        fixed_files
                    ),
                    "total_files": len(
                        merged_files
                    ),
                },
            }
        )

        # -----------------------------------------------------
        # Memory
        # -----------------------------------------------------

        try:

            save_memory(
                {
                    "project_id": state.get(
                        "project_id"
                    ),
                    "agent": "debugger",
                    "note": (
                        "Generated corrected code "
                        "and updated project workspace."
                    ),
                }
            )

        except Exception as exc:

            print(
                "[Debugger] Memory save failed: "
                f"{exc}"
            )

        print(
            "\n=== DEBUGGER SUCCESS: "
            f"{len(fixed_files)} FILES FIXED ==="
        )

    else:

        response_preview = (
            response[:1000]
            if isinstance(response, str)
            else str(response)[:1000]
        )

        print(
            "\n=== DEBUGGER NO FILES EXTRACTED ===\n"
            f"{response_preview}"
        )

        err_msg = (
            "Could not extract valid source "
            "code from debugger response"
        )

        print(
            f"\n=== DEBUGGER PARSE ERROR ===: "
            f"{err_msg}"
        )

        state["debug_report"] = (
            f"Debugger failed: {err_msg}"
        )

        if "agent_notes" not in state:
            state["agent_notes"] = []

        state["agent_notes"].append(
            "Debugger parse failed"
        )

        append_execution_step(
            state,
            {
                "agent": "debugger",
                "step": "generating_fixes",
                "status": "failed",
                "message": (
                    f"Iteration {iteration}: "
                    f"Failed to generate fixes - "
                    f"{err_msg}"
                ),
            }
        )

        print(
            "\n=== USING ORIGINAL CODE ==="
        )

    # =========================================================
    # 11. Clear test results for next tester iteration
    # =========================================================

    state["test_results"] = {}

    return state
