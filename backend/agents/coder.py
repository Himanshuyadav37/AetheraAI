import json

from services.usage_tracker import UsageTracker
from llm.groq_client import generate_response
from llm.prompt_templates import CODER_PROMPT
from services.code_parser import extract_files_from_response
from services.execution_stream import append_execution_step
from services.workspace_manager import workspace_manager
from memory.project_memory import save_memory


# ============================================================
# HELPERS
# ============================================================

def _normalize_content(content):
    """
    Convert generated file content into a string.
    """

    if content is None:
        return ""

    if isinstance(content, str):
        return content

    if isinstance(content, (dict, list)):
        return json.dumps(
            content,
            ensure_ascii=False,
            indent=2,
        )

    return str(content)


def _normalize_files(files):
    """
    Convert parser output into canonical project file format.

    Canonical format:

    [
        {
            "path": "package.json",
            "code": "..."
        }
    ]

    Supports legacy:
        {"files": [...]}

    and canonical:
        [...]
    """

    if not files:
        return []

    # --------------------------------------------------------
    # Legacy parser wrapper
    # --------------------------------------------------------

    if isinstance(files, dict):

        # IMPORTANT:
        # Do not treat {"files": [...]} as a file called "files".
        if isinstance(files.get("files"), list):
            files = files["files"]

        # Single file object
        elif files.get("path"):
            files = [files]

        else:
            return []

    # --------------------------------------------------------
    # Canonical list
    # --------------------------------------------------------

    if not isinstance(files, list):
        return []

    normalized = []
    seen_paths = set()

    for item in files:

        if not isinstance(item, dict):
            continue

        path = item.get("path")

        if not path:
            continue

        path = str(path).strip()

        if not path:
            continue

        # ----------------------------------------------------
        # Reject parser corruption
        # ----------------------------------------------------

        if path.lower() in {
            "files",
            "file",
            "generated_files",
            "project_files",
        }:
            print(
                f"[Coder] Ignoring invalid pseudo-file: {path}"
            )
            continue

        code = item.get(
            "code",
            item.get(
                "content",
                "",
            ),
        )

        code = _normalize_content(code)

        # Prevent duplicate paths
        if path in seen_paths:
            # Latest version wins
            for existing in normalized:
                if existing["path"] == path:
                    existing["code"] = code
                    break

            continue

        seen_paths.add(path)

        normalized.append(
            {
                "path": path,
                "code": code,
            }
        )

    return normalized


# ============================================================
# CODER AGENT
# ============================================================

def coder_agent(state):
    # Bind LLM usage telemetry to this Engineer execution.
    UsageTracker.set_context(
        user_id=state.get("user_id"),
        module="engineer",
        operation="coder_agent",
        agent="coder",
        project_id=state.get("project_id"),
        execution_id=state.get("execution_id"),
    )

    """
    Engineer AI Coder Agent.

    Responsibilities:

    1. Read the project plan.
    2. Read previous execution context.
    3. Generate complete project files.
    4. Parse the LLM response.
    5. Normalize files into canonical list format.
    6. Create a real workspace.
    7. Write generated files into that workspace.
    8. Store workspace path in AgentState.
    9. Save execution information.
    """

    idea = state.get(
        "idea",
        "",
    )

    user_id = state.get(
        "user_id",
        "",
    )

    project_id = state.get(
        "project_id",
        "",
    )

    execution_id = state.get(
        "execution_id",
        "",
    )

    project_plan = state.get(
        "project_plan",
        {},
    )

    mode = state.get(
        "mode",
        "new",
    )

    print("\n" + "=" * 70)
    print("CODER AGENT")
    print("=" * 70)

    print(
        f"Project ID : {project_id}"
    )

    print(
        f"Execution  : {execution_id}"
    )

    print(
        f"Mode       : {mode}"
    )

    # ========================================================
    # 1. Existing project code
    # ========================================================

    existing_code = state.get(
        "generated_code",
        [],
    )

    if mode == "continue":

        existing_code = (
            state.get("fixed_code")
            or state.get("generated_code")
            or []
        )

    # Normalize existing code before putting it in prompt.
    existing_code = _normalize_files(
        existing_code
    )

    # ========================================================
    # 2. Project memory
    # ========================================================

    project_memory = ""

    # ========================================================
    # 3. Self-learning context
    # ========================================================

    learning_context = ""

    # ========================================================
    # 4. Previous execution notes
    # ========================================================

    agent_notes = state.get(
        "agent_notes",
        [],
    )

    execution_steps = state.get(
        "execution_steps",
        [],
    )

    # Avoid dumping an unnecessarily huge execution history
    # into the LLM prompt.
    if len(execution_steps) > 12:
        execution_steps = execution_steps[-12:]

    if len(agent_notes) > 12:
        agent_notes = agent_notes[-12:]

    # ========================================================
    # 5. Build coder prompt
    # ========================================================

    prompt = f"""
{CODER_PROMPT}

============================================================
PROJECT IDEA
============================================================

{idea}

============================================================
PROJECT PLAN
============================================================

{json.dumps(
    project_plan,
    indent=2,
    ensure_ascii=False,
)}

============================================================
PROJECT MEMORY
============================================================

{project_memory}

============================================================
SELF-LEARNING CONTEXT
============================================================

{learning_context}

============================================================
AGENT NOTES
============================================================

{json.dumps(
    agent_notes,
    indent=2,
    ensure_ascii=False,
)}

============================================================
PREVIOUS EXECUTION STEPS
============================================================

{json.dumps(
    execution_steps,
    indent=2,
    ensure_ascii=False,
)}

============================================================
EXISTING CODE
============================================================

{json.dumps(
    existing_code,
    indent=2,
    ensure_ascii=False,
)}

============================================================
CODING REQUIREMENTS
============================================================

You are working as a production software engineer.

Generate the COMPLETE implementation.

Rules:

1. Implement the actual functionality described in the project idea.

2. Generate ALL required files.

3. Preserve existing functionality when working in continue mode.

4. Do not delete working files unless genuinely obsolete.

5. Ensure imports match actual file paths.

6. Ensure frontend routes and backend routes are consistent.

7. Ensure API calls match backend endpoints.

8. Ensure environment variables are handled correctly.

9. Do not use fake functionality.

10. Do not use placeholder comments such as:
    TODO
    implement later
    coming soon
    add logic here

11. Return every generated file with complete contents.

12. The generated project must be runnable.

13. Include configuration files required to run the project.

14. Include package/dependency files when required.

15. Include backend and frontend files when required.

16. Include database models/schema/migrations when required.

17. Include authentication/authorization when required.

18. Include proper error handling.

19. Include loading, empty and error states where appropriate.

20. Make the UI functional, responsive and domain-specific.

21. Never reduce a complex application into only:
    index.html
    style.css
    app.js

    unless the project genuinely requires only those files.

22. If the application requires React/Vite or another modern
    framework, generate its complete framework structure.

23. If the application requires a backend, generate its complete
    backend structure and dependency configuration.

24. Generate enough files to actually implement the requested
    product, not merely demonstrate its appearance.

25. Do not output markdown.

26. Do not output ```json.

27. Do not output explanations outside JSON.

============================================================
OUTPUT FORMAT
============================================================

Return ONLY valid JSON.

{{
    "files": [
        {{
            "path": "relative/path/to/file",
            "code": "complete file contents"
        }}
    ]
}}

The "files" value MUST be an array.

Each array item MUST contain:
- path
- code

Do NOT return a file named "files".

Do NOT wrap the JSON in markdown.
"""

    # ========================================================
    # 6. Call LLM
    # ========================================================

    try:

        print(
            "[Coder] Generating code..."
        )

        # Keep request below current Groq TPM pressure.
        raw_response = generate_response(
            prompt,
            max_tokens=5000,
        )

    except Exception as exc:

        error_message = (
            f"Coder LLM generation failed: {exc}"
        )

        print(
            f"[Coder] ERROR: {error_message}"
        )

        state["generated_code"] = []

        try:

            append_execution_step(
                state,
                {
                    "agent": "coder",
                    "step": "generation_failed",
                    "status": "failed",
                    "message": error_message,
                },
            )

        except Exception:
            pass

        return state

    # ========================================================
    # 7. Parse generated files
    # ========================================================

    try:

        files = extract_files_from_response(
            raw_response
        )

    except Exception as exc:

        print(
            f"[Coder] File parsing failed: {exc}"
        )

        files = []

    # ========================================================
    # 8. Normalize parsed result
    # ========================================================

    normalized_files = _normalize_files(
        files
    )

    # ========================================================
    # 9. Validate parsed result
    # ========================================================

    if not normalized_files:

        print(
            "[Coder] No valid files were extracted."
        )

        print(
            "[Coder] Raw response preview:"
        )

        print(
            raw_response[:3000]
            if isinstance(raw_response, str)
            else raw_response
        )

        state["generated_code"] = []

        try:

            append_execution_step(
                state,
                {
                    "agent": "coder",
                    "step": "generation_failed",
                    "status": "failed",
                    "message": (
                        "LLM returned no parseable project files."
                    ),
                },
            )

        except Exception:
            pass

        return state

    # ========================================================
    # 10. Store generated code
    # ========================================================

    state["generated_code"] = normalized_files

    state["initial_generated_code"] = [
        {
            "path": file_data["path"],
            "code": file_data["code"],
        }
        for file_data in normalized_files
    ]

    print(
        f"[Coder] Generated "
        f"{len(normalized_files)} files."
    )

    for file_data in normalized_files:

        print(
            f"  + {file_data['path']}"
        )

    # ========================================================
    # 11. Create workspace
    # ========================================================

    workspace_path = None

    if execution_id:

        try:

            print(
                "[Coder] Creating workspace..."
            )

            workspace_path = (
                workspace_manager.create_workspace(
                    execution_id
                )
            )

            print(
                f"[Coder] Workspace: "
                f"{workspace_path}"
            )

            # =================================================
            # 12. Write files
            # =================================================

            written_files = (
                workspace_manager.write_files(
                    workspace_path,
                    normalized_files,
                )
            )

            state["project_path"] = (
                workspace_path
            )

            print(
                f"[Coder] Wrote "
                f"{len(written_files)} files "
                f"to workspace."
            )

            # =================================================
            # 13. Workspace execution event
            # =================================================

            try:

                append_execution_step(
                    state,
                    {
                        "agent": "coder",
                        "step": "workspace_created",
                        "status": "success",
                        "workspace_path": (
                            workspace_path
                        ),
                        "files_written": (
                            written_files
                        ),
                    },
                )

            except Exception as exc:

                print(
                    "[Coder] Could not append "
                    f"execution step: {exc}"
                )

        except Exception as exc:

            print(
                "[Coder] Workspace creation failed: "
                f"{exc}"
            )

            try:

                append_execution_step(
                    state,
                    {
                        "agent": "coder",
                        "step": "workspace_creation",
                        "status": "failed",
                        "error": str(exc),
                    },
                )

            except Exception:
                pass

    else:

        print(
            "[Coder] No execution_id available; "
            "workspace was not created."
        )

    # ========================================================
    # 14. Save project memory
    # ========================================================

    try:

        save_memory(
            {
                "project_id": project_id,
                "agent": "coder",
                "note": (
                    "Coder generated project files."
                ),
                "generated_files": [
                    file_data["path"]
                    for file_data in normalized_files
                ],
                "workspace_path": workspace_path,
                "mode": mode,
            }
        )

    except Exception as exc:

        print(
            "[Coder] Failed to save project memory: "
            f"{exc}"
        )

    # ========================================================
    # 15. Final execution event
    # ========================================================

    try:

        append_execution_step(
            state,
            {
                "agent": "coder",
                "step": "code_generation",
                "status": "success",
                "files_count": len(
                    normalized_files
                ),
                "workspace_path": workspace_path,
            },
        )

    except Exception as exc:

        print(
            "[Coder] Could not append final "
            f"execution step: {exc}"
        )

    print("=" * 70)
    print("CODER AGENT COMPLETE")
    print("=" * 70)

    return state
