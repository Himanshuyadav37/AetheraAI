import json
import re
from bson import ObjectId

from db.mongo_client import executions_collection
from db.learning_service import save_learning, get_learnings_by_user
from llm.groq_client import generate_response


def _normalize_files(code_data):
    """
    Normalize generated/fixed code into the canonical list format:

    [
        {"path": "...", "code": "..."},
        ...
    ]

    Supports both:
      - canonical list format
      - legacy {"files": [...]} format
    """
    if not code_data:
        return []

    if isinstance(code_data, list):
        return [
            file_data
            for file_data in code_data
            if isinstance(file_data, dict) and file_data.get("path")
        ]

    if isinstance(code_data, dict):
        files = code_data.get("files", [])
        if isinstance(files, list):
            return [
                file_data
                for file_data in files
                if isinstance(file_data, dict) and file_data.get("path")
            ]

    return []


def record_lessons_from_execution(execution_id: str, user_id: str):
    """
    Analyzes a completed execution, extracts failed and fixed files,
    calls the LLM to summarize the lesson learned, and saves it to MongoDB.
    """
    try:
        exec_doc = executions_collection.find_one(
            {"_id": ObjectId(execution_id)}
        )

        if not exec_doc:
            print(
                f"[Self-Learning] Execution {execution_id} not found in DB."
            )
            return

        qg = exec_doc.get("quality_gate_report") or {}
        steps = exec_doc.get("execution_steps") or []
        had_debug_cycle = any(
            isinstance(step, dict) and step.get("agent") == "debugger"
            and step.get("status") == "completed"
            for step in steps
        )
        if str(qg.get("overall", "")).upper() != "PASS" or not had_debug_cycle:
            print("[Self-Learning] Skipped: requires passing Quality Gate and completed debugger cycle.")
            return

        # Canonical format is now a list, but legacy dict format is supported.
        generated_data = (
            exec_doc.get("initial_generated_code")
            or exec_doc.get("generated_code")
            or []
        )
        fixed_data = exec_doc.get("fixed_code") or []

        generated_files_list = _normalize_files(generated_data)
        fixed_files_list = _normalize_files(fixed_data)

        generated_files = {
            f["path"]: f.get("code", "")
            for f in generated_files_list
        }
        fixed_files = {
            f["path"]: f.get("code", "")
            for f in fixed_files_list
        }

        if not generated_files or not fixed_files:
            print(
                "[Self-Learning] Missing generated or fixed files in execution."
            )
            return

        # Identify files that changed.
        changed_files = []

        for path, fixed_code in fixed_files.items():
            orig_code = generated_files.get(path)

            if orig_code is not None and orig_code.strip() != fixed_code.strip():
                changed_files.append(
                    {
                        "path": path,
                        "failed_code": orig_code,
                        "fixed_code": fixed_code,
                    }
                )

        if not changed_files:
            print("[Self-Learning] No code changes found to analyze.")
            return

        # Extract the last failed tester/debugger message.
        error_message = ""

        execution_steps = exec_doc.get("execution_steps") or []

        if isinstance(execution_steps, list):
            for step in reversed(execution_steps):
                if not isinstance(step, dict):
                    continue

                if step.get("agent") not in ("tester", "debugger"):
                    continue

                details = step.get("details") or {}

                if not isinstance(details, dict):
                    details = {}

                if (
                    details.get("status") == "FAIL"
                    or details.get("critical_count", 0) > 0
                ):
                    error_message = step.get("message", "")
                    break

        if not error_message:
            error_message = (
                "Test or syntax validation failed on initial generation."
            )

        # Format diff block for prompt context.
        diffs_str = ""

        for file_data in changed_files:
            diffs_str += f"File: {file_data['path']}\n"
            diffs_str += "--- FAILED CODE ---\n"
            diffs_str += f"{file_data['failed_code']}\n"
            diffs_str += "--- FIXED CODE ---\n"
            diffs_str += f"{file_data['fixed_code']}\n\n"

        prompt = f"""You are an advanced AI compiler auditor and self-learning analyzer.
Analyze this debugging session where initial generated code failed tests and was later corrected.
Generate a concise, actionable lesson (1-2 sentences) on what went wrong and how to prevent it.

Error Message:
{error_message}

Changed Files:
{diffs_str}

Respond ONLY with a JSON object matching this schema:
{{
  "error_type": "Brief error category (e.g. SyntaxError, KeyError, ImportMismatch, LogicError)",
  "error_message": "Summary of what caused the failure",
  "lesson_learned": "Actionable instructions to prevent generating this error again in the future"
}}
Return ONLY raw JSON. Do not include markdown blocks, code wrappers, or extra explanation.
"""

        response_text = generate_response(prompt)

        clean_json = response_text.strip()
        clean_json = re.sub(r"^```json\s*", "", clean_json)
        clean_json = re.sub(r"\s*```$", "", clean_json)

        parsed = json.loads(clean_json)

        learning_id = save_learning(
            {
                "user_id": str(user_id),
                "project_id": str(exec_doc.get("project_id", "")),
                "execution_id": str(execution_id),
                "idea": exec_doc.get("idea", ""),
                "error_type": parsed.get("error_type", "LogicError"),
                "error_message": parsed.get(
                    "error_message",
                    error_message,
                ),
                "failed_code": diffs_str,
                "lesson_learned": parsed.get("lesson_learned", ""),
                "enabled": True,
            }
        )

        print(
            "[Self-Learning] Successfully compiled and saved "
            f"learning rule {learning_id}."
        )

    except Exception as e:
        print(
            "[Self-Learning] Error recording lessons from execution "
            f"{execution_id}: {e}"
        )


def get_active_learnings(user_id: str) -> str:
    """
    Retrieves all enabled lessons learned by the user and structures
    them as a prompt context block.
    """
    try:
        learnings = get_learnings_by_user(user_id)

        if not isinstance(learnings, list):
            return ""

        active_learnings = [
            learning
            for learning in learnings
            if isinstance(learning, dict)
            and learning.get("enabled", True)
        ]

        if not active_learnings:
            return ""

        lines = []

        for idx, learning in enumerate(active_learnings, 1):
            lines.append(
                f"{idx}. [{learning.get('error_type', 'Error')}]: "
                f"{learning.get('lesson_learned', '')}"
            )

        return (
            "=== CRITICAL: LESSONS LEARNED FROM PAST DEBUGGING RUNS ===\n"
            "Review these past mistakes and ensure your generated code "
            "adheres to these guidelines:\n"
            + "\n".join(lines)
            + "\n"
            "==========================================================="
        )

    except Exception as e:
        print(
            f"[Self-Learning] Error building active learnings block: {e}"
        )
        return ""


def get_relevant_learnings(user_id: str, idea: str, limit: int = 5) -> tuple[str, list[str]]:
    """Select lightweight stack/error-relevant lessons without changing storage/API."""
    try:
        text = (idea or "").lower()
        selected = []
        for learning in get_learnings_by_user(user_id) or []:
            if not isinstance(learning, dict) or not learning.get("enabled", True):
                continue
            haystack = " ".join(str(learning.get(key, "")).lower() for key in ("idea", "error_type", "error_message", "lesson_learned"))
            keywords = ("python", "fastapi", "react", "node", "typescript", "test", "lint", "security")
            if not any(word in text and word in haystack for word in keywords) and selected:
                continue
            selected.append(learning)
            if len(selected) >= limit:
                break
        if not selected:
            return "", []
        ids = [str(item.get("_id") or item.get("execution_id") or item.get("error_type")) for item in selected]
        body = "\n".join(f"- [{item.get('error_type', 'Error')}] {item.get('lesson_learned', '')}" for item in selected)
        return "=== RELEVANT PAST ENGINEERING LESSONS ===\n" + body + "\n==========================================", ids
    except Exception:
        return "", []
