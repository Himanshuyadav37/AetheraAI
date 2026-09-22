import json
import re
from pathlib import Path

from services.usage_tracker import UsageTracker
from llm.groq_client import generate_response
from services.execution_stream import append_execution_step
from services.workspace_manager import workspace_manager
from services.code_parser import (
    extract_files_from_response,
    merge_code_files,
)


def _normalize_files(code_data):
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
        files = code_data.get("files", [])
        if isinstance(files, list):
            return [
                item
                for item in files
                if isinstance(item, dict)
                and item.get("path")
            ]

    return []


def _extract_json_candidates(text):
    if not isinstance(text, str):
        return []

    candidates = []

    cleaned = text.strip()
    if cleaned.startswith("```") and cleaned.endswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 3:
            cleaned = "\n".join(lines[1:-1]).strip()

    for candidate_text in (cleaned, text):
        decoder = json.JSONDecoder()
        index = 0

        while index < len(candidate_text):
            match = re.search(r"[\{\[]", candidate_text[index:])
            if not match:
                break

            start = index + match.start()

            try:
                value, consumed = decoder.raw_decode(candidate_text[start:])
                candidates.append(value)
                index = start + consumed
            except json.JSONDecodeError:
                index = start + 1

    return candidates


def _detect_stack(workspace_path):
    workspace = Path(workspace_path)
    stack = []

    for p in workspace.rglob("*"):
        if not p.is_file():
            continue
        name = p.name.lower()
        if name == "package.json":
            stack.append("node")
        elif name in ("requirements.txt", "pyproject.toml"):
            stack.append("python")
        elif name == "index.html":
            stack.append("html")

    seen = set()
    result = []
    for s in stack:
        if s not in seen:
            seen.add(s)
            result.append(s)
    return result


def test_generator_agent(state):
    UsageTracker.set_context(
        user_id=state.get("user_id"),
        module="engineer",
        operation="test_generator_agent",
        agent="test_generator",
        project_id=state.get("project_id"),
        execution_id=state.get("execution_id"),
    )

    state.setdefault("execution_steps", [])

    append_execution_step(state, {
        "agent": "test_generator",
        "step": "generating_tests",
        "status": "in_progress",
        "message": "Analyzing source code and generating test suite",
    })

    workspace_path = state.get("project_path")

    try:
        generated_code = state.get("fixed_code") or state.get("generated_code") or []
        source_files = _normalize_files(generated_code)

        stack = []
        if workspace_path:
            stack = _detect_stack(workspace_path)

        source_listing = []
        for sf in source_files:
            code = sf.get("code", "")
            preview = code[:500]
            source_listing.append(
                f"FILE: {sf['path']}\n```\n{preview}\n```\n"
            )

        source_block = "\n".join(source_listing) if source_listing else "(no source files)"

        python_instruction = ""
        node_instruction = ""

        if "python" in stack:
            python_instruction = """
PYTHON PROJECT DETECTED:
Generate pytest tests under tests/test_*.py covering the main functions and logic.
- Use real assertions (NOT assert True or placeholder asserts).
- Cover edge cases, normal cases, and error paths.
- Use appropriate fixtures where needed.
- Each test file should import from the actual project modules.
"""
        elif "node" in stack:
            node_instruction = """
NODE.JS PROJECT DETECTED:
Generate Jest/Vitest tests:
- Place tests in src/__tests__/*.test.(js|ts|jsx|tsx) or as *.test.js files alongside source.
- Use describe/it blocks with real expect() assertions (NOT placeholders).
- Test main exports, functions, and edge cases.
- Use appropriate test setup / mocks as needed.
"""
        else:
            python_instruction = """
If source code contains Python:
    Generate pytest tests under tests/test_*.py with real assertions.
If source code contains JavaScript/TypeScript/Node:
    Generate Jest/Vitest tests (src/__tests__/*.test.* or *.test.js) with describe/it/expect.
For plain HTML: produce light DOM-oriented test stubs only if appropriate.
Always use REAL assertions, never assert True placeholders.
"""

        prompt = f"""You are an expert test engineer. Given the project source files below, generate a comprehensive test suite.

SOURCE FILES (first 500 chars each for context):
{source_block}

{python_instruction}
{node_instruction}

GENERAL RULES:
- Generate actual, runnable tests that exercise real behavior.
- Every assertion must validate a real outcome. No empty / placeholder tests.
- Return test files as a list of objects with "path" and "code" keys.
- Example format:
[
  {{"path": "tests/test_main.py", "code": "..."}},
  {{"path": "tests/test_utils.py", "code": "..."}}
]

Return ONLY the list of files. No extra prose."""

        # UsageTracker context is established above.  generate_response only
        # accepts the prompt (and optional max_tokens), so do not pass state
        # metadata as unsupported keyword arguments.
        raw = generate_response(prompt)

        files = []
        try:
            parsed = extract_files_from_response(raw)
            files = _normalize_files(parsed)
        except Exception as exc:
            print(f"[TestGenerator] Primary parser failed: {exc}")

        if not files:
            for candidate in _extract_json_candidates(raw):
                normalized = _normalize_files(candidate)
                if normalized:
                    files = normalized
                    break
                if isinstance(candidate, dict):
                    for key in ("files", "tests", "generated_tests", "code", "output", "result"):
                        nested = candidate.get(key)
                        normalized = _normalize_files(nested)
                        if normalized:
                            files = normalized
                            break
                if files:
                    break

        if not files and isinstance(raw, str):
            fenced_blocks = re.findall(
                r"```(?:json|JSON)?\s*(.*?)```",
                raw,
                flags=re.DOTALL,
            )
            for block in fenced_blocks:
                try:
                    candidate = json.loads(block.strip())
                except (TypeError, json.JSONDecodeError):
                    continue
                normalized = _normalize_files(candidate)
                if normalized:
                    files = normalized
                    break

        state.setdefault("generated_tests", [])
        state["generated_tests"] = files

        if state.get("generated_code"):
            try:
                merged = merge_code_files(state["generated_code"], files)
                state["generated_code"] = _normalize_files(merged)
            except Exception as exc:
                print(f"[TestGenerator] Merge into generated_code failed: {exc}")

        if state.get("fixed_code"):
            try:
                merged_fixed = merge_code_files(state["fixed_code"], files)
                state["fixed_code"] = _normalize_files(merged_fixed)
            except Exception as exc:
                print(f"[TestGenerator] Merge into fixed_code failed: {exc}")

        if workspace_path and files:
            try:
                workspace_manager.write_files(workspace_path, files)
            except Exception as exc:
                print(f"[TestGenerator] Workspace write failed: {exc}")

        append_execution_step(state, {
            "agent": "test_generator",
            "step": "generating_tests",
            "status": "completed",
            "message": f"Successfully generated {len(files)} test file(s)",
            "details": {
                "count": len(files),
                "paths": [f["path"] for f in files],
            },
        })

        return state

    except Exception as exc:
        print(f"[TestGenerator] Fatal error: {exc}")

        append_execution_step(state, {
            "agent": "test_generator",
            "step": "generating_tests",
            "status": "failed",
            "message": f"Test generation failed: {exc}",
        })

        return state
