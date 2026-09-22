from datetime import datetime

from agents.graph import graph

from db.execution_service import (
    save_execution,
    update_execution,
    get_execution_by_id,
    get_execution_by_project_id,
)

from db.project_version_service import save_version

from services.file_writer import (
    write_project_files,
)


# ============================================================
# File normalization helpers
# ============================================================

def _normalize_files(code_data):
    """
    Convert project code into the canonical format:

    [
        {
            "path": "...",
            "code": "..."
        }
    ]

    Supports both the new list format and the legacy:

    {
        "files": [...]
    }
    """

    if not code_data:
        return []

    # New canonical format
    if isinstance(code_data, list):

        return [
            file_data
            for file_data in code_data
            if isinstance(file_data, dict)
            and file_data.get("path")
        ]

    # Backward compatibility
    if isinstance(code_data, dict):

        files = code_data.get(
            "files",
            []
        )

        if isinstance(files, list):

            return [
                file_data
                for file_data in files
                if isinstance(file_data, dict)
                and file_data.get("path")
            ]

    return []


def _merge_code_files(
    existing_code,
    updated_code,
):
    """
    Merge project files by path.

    Canonical output is always a list.
    """

    existing_files = _normalize_files(
        existing_code
    )

    updated_files = _normalize_files(
        updated_code
    )

    merged_by_path = {}

    # Existing files first
    for file_data in existing_files:

        path = file_data.get(
            "path"
        )

        if path:
            merged_by_path[path] = file_data

    # Updated files overwrite existing files
    for file_data in updated_files:

        path = file_data.get(
            "path"
        )

        if path:
            merged_by_path[path] = file_data

    return list(
        merged_by_path.values()
    )


# ============================================================
# Continue-mode hydration
# ============================================================

def _hydrate_from_execution(
    state: dict,
    execution: dict,
    new_idea: str,
):

    state["project_id"] = (
        execution.get(
            "project_id",
            ""
        )
    )

    state["project_plan"] = (
        execution.get(
            "project_plan",
            {}
        )
    )

    state["generated_code"] = (
        _normalize_files(
            execution.get(
                "generated_code"
            )
        )
    )

    state["fixed_code"] = (
        _normalize_files(
            execution.get(
                "fixed_code"
            )
        )
    )

    state["idea"] = (
        "Continue development on existing project.\n"
        f"Original idea: {execution.get('idea', '')}\n"
        f"New request: {new_idea}"
    )

    state["parent_execution_id"] = (
        str(
            execution.get(
                "_id",
                ""
            )
        )
    )

    state["mode"] = "continue"

    return state


# ============================================================
# Generate Project
# ============================================================

def generate_project(
    idea: str,
    user_id: str,
    project_id: str | None = None,
    execution_id: str | None = None,
    mode: str = "new",
    connectors: dict | None = None,
    parent_execution_id_override: str | None = None,
):

    parent_execution_id = (
        parent_execution_id_override
    )

    update_execution_id = (
        execution_id
    )

    existing_code = []

    continued_project_id = (
        project_id or ""
    )

    # ========================================================
    # Initial AgentState
    # ========================================================

    state = {
        "user_id": user_id,
        "idea": idea,
        "project_id": project_id or "",
        "project_plan": {},
        "generated_code": [],
        "fixed_code": [],
        "initial_generated_code": [],
        "project_path": "",
        "test_results": {},
        "debug_report": "",
        "deployment_plan": {},
        "messages": [],
        "agent_notes": [],
        "iterations": 0,
        "execution_steps": [],
        "mode": mode,
        "parent_execution_id": (
            parent_execution_id_override
            or ""
        ),
        "execution_id": (
            execution_id
            or ""
        ),
    }

    # ========================================================
    # Continue existing project
    # ========================================================

    if mode == "continue":

        execution = None

        parent_id = (
            parent_execution_id_override
            or execution_id
        )

        if parent_id:

            execution = (
                get_execution_by_id(
                    parent_id
                )
            )

        elif project_id:

            execution = (
                get_execution_by_project_id(
                    project_id
                )
            )

        if execution:

            parent_execution_id = (
                execution.get(
                    "_id"
                )
            )

            state["parent_execution_id"] = (
                str(
                    parent_execution_id
                )
            )

            continued_project_id = (
                execution.get(
                    "project_id",
                    project_id or ""
                )
            )

            existing_code = (
                _normalize_files(
                    execution.get(
                        "fixed_code"
                    )
                    or execution.get(
                        "generated_code"
                    )
                )
            )

            state = _hydrate_from_execution(
                state,
                execution,
                idea,
            )

            state["execution_id"] = (
                execution_id or ""
            )

        else:

            state["mode"] = "new"

            continued_project_id = ""

    # ========================================================
    # Run LangGraph
    # ========================================================

    result = graph.invoke(
        state
    )

    # ========================================================
    # Normalize graph result
    # ========================================================

    result["generated_code"] = (
        _normalize_files(
            result.get(
                "generated_code"
            )
        )
    )

    result["fixed_code"] = (
        _normalize_files(
            result.get(
                "fixed_code"
            )
        )
    )

    result["initial_generated_code"] = (
        _normalize_files(
            result.get(
                "initial_generated_code"
            )
        )
    )

    # ========================================================
    # Continue-mode merge
    # ========================================================

    if (
        mode == "continue"
        and continued_project_id
    ):

        result["project_id"] = (
            continued_project_id
        )

        result["mode"] = "continue"

        generated_files = (
            result.get(
                "generated_code"
            )
        )

        fixed_files = (
            result.get(
                "fixed_code"
            )
        )

        if generated_files:

            result["generated_code"] = (
                _merge_code_files(
                    existing_code,
                    generated_files,
                )
            )

        if fixed_files:

            result["fixed_code"] = (
                _merge_code_files(
                    existing_code,
                    fixed_files,
                )
            )

    # ========================================================
    # GRAPH RESULT
    # ========================================================

    print(
        "\n=== GRAPH RESULT ==="
    )

    print(
        result.keys()
    )

    # ========================================================
    # Select final project code
    # ========================================================

    fixed_files = _normalize_files(
        result.get(
            "fixed_code"
        )
    )

    generated_files_from_result = (
        _normalize_files(
            result.get(
                "generated_code"
            )
        )
    )

    if (
        fixed_files
        and generated_files_from_result
    ):

        generated_files = (
            _merge_code_files(
                generated_files_from_result,
                fixed_files,
            )
        )

    else:

        generated_files = (
            fixed_files
            or generated_files_from_result
            or []
        )

    # Keep final state synchronized
    result["generated_code"] = (
        generated_files
    )

    # If fixed code exists, keep it synchronized too
    if fixed_files:
        result["fixed_code"] = (
            generated_files
        )

    # ========================================================
    # Write project files
    # ========================================================

    project_path = ""
    zip_path = ""

    if generated_files:

        try:

            project_path, zip_path = (
                write_project_files(
                    result["project_id"],
                    generated_files,
                )
            )

        except Exception as exc:

            print(
                "[ProjectGenerator] Failed to "
                f"write project files: {exc}"
            )

            # Do not destroy generated code if
            # filesystem export fails.
            project_path = ""
            zip_path = ""

    result["project_path"] = (
        project_path
    )

    # ========================================================
    # SAVE EXECUTION
    # ========================================================

    execution_data = {

        "user_id":
            user_id,

        "project_id":
            result.get(
                "project_id"
            ),

        "idea":
            idea,

        "mode":
            result.get(
                "mode",
                mode
            ),

        "parent_execution_id":
            (
                parent_execution_id
                or result.get(
                    "parent_execution_id"
                )
            ),

        "project_plan":
            result.get(
                "project_plan",
                {}
            ),

        "generated_code":
            result.get(
                "generated_code",
                []
            ),

        "initial_generated_code":
            result.get(
                "initial_generated_code",
                []
            ),

        "fixed_code":
            result.get(
                "fixed_code",
                []
            ),

        "project_path":
            project_path,

        "zip_path":
            zip_path,

        "deployment_plan":
            result.get(
                "deployment_plan",
                {}
            ),

        "debug_report":
            result.get(
                "debug_report",
                ""
            ),

        "iterations":
            result.get(
                "iterations",
                0
            ),

        "status":
            "completed",

        "updated_at":
            datetime.utcnow(),

        "agent_notes":
            result.get(
                "agent_notes",
                []
            ),

        "execution_steps":
            result.get(
                "execution_steps",
                []
            ),
    }

    # ========================================================
    # Save / update execution
    # ========================================================

    if update_execution_id:

        update_execution(
            update_execution_id,
            execution_data,
        )

        execution_id = (
            update_execution_id
        )

    else:

        execution_data[
            "created_at"
        ] = datetime.utcnow()

        execution_id = save_execution(
            execution_data
        )

    # ========================================================
    # Save project version
    # ========================================================

    pid = result.get(
        "project_id"
    )

    if pid:

        save_version(
            project_id=pid,
            execution_id=execution_id,
            idea=idea,
            generated_code=result.get(
                "generated_code",
                []
            ),
            fixed_code=result.get(
                "fixed_code",
                []
            ),
            parent_execution_id=(
                parent_execution_id
            ),
        )

    # ========================================================
    # RESPONSE
    # ========================================================

    response_data = {

        "execution_id":
            execution_id,

        "project_id":
            result.get(
                "project_id"
            ),

        "mode":
            result.get(
                "mode",
                mode
            ),

        "parent_execution_id":
            (
                parent_execution_id
                or result.get(
                    "parent_execution_id"
                )
            ),

        "project_path":
            project_path,

        "project_plan":
            result.get(
                "project_plan",
                {}
            ),

        "generated_code":
            result.get(
                "generated_code",
                []
            ),

        "initial_generated_code":
            result.get(
                "initial_generated_code",
                []
            ),

        "fixed_code":
            result.get(
                "fixed_code",
                []
            ),

        "deployment_plan":
            result.get(
                "deployment_plan",
                {}
            ),

        "debug_report":
            result.get(
                "debug_report",
                ""
            ),

        "agent_notes":
            result.get(
                "agent_notes",
                []
            ),

        "iterations":
            result.get(
                "iterations",
                0
            ),

        "execution_steps":
            result.get(
                "execution_steps",
                []
            ),

        "zip_url":
            (
                f"/download/"
                f"{result['project_id']}"
            ),

        "status":
            "completed",
    }

    # ========================================================
    # Self-learning
    # ========================================================

    if execution_id:

        if (
            response_data.get(
                "status"
            ) == "completed"
            and response_data.get(
                "iterations",
                0
            ) > 0
        ):

            try:

                from services.self_learning import (
                    record_lessons_from_execution
                )

                record_lessons_from_execution(
                    str(execution_id),
                    str(user_id),
                )

            except Exception as exc:

                print(
                    "[Self-Learning] Failed to run "
                    f"record_lessons_from_execution: {exc}"
                )

        # ====================================================
        # Execution stream completion
        # ====================================================

        from services.execution_stream import (
            stream_manager
        )

        stream_manager.publish(
            str(execution_id),
            {
                "type": "complete",
                "data": response_data,
            },
        )

    return response_data