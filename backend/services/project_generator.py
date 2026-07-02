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
    write_project_files
)


def _merge_code_files(existing_code: dict, updated_code: dict):
    if not isinstance(updated_code, dict) or "files" not in updated_code:
        return updated_code

    if not isinstance(existing_code, dict) or "files" not in existing_code:
        return updated_code

    merged_by_path = {}

    for file in existing_code.get("files", []):
        path = file.get("path")
        if path:
            merged_by_path[path] = file

    for file in updated_code.get("files", []):
        path = file.get("path")
        if path:
            merged_by_path[path] = file

    merged = {**updated_code}
    merged["files"] = list(merged_by_path.values())
    return merged


def _hydrate_from_execution(state: dict, execution: dict, new_idea: str):
    state["project_id"] = execution.get("project_id", "")
    state["project_plan"] = execution.get("project_plan", {})
    state["generated_code"] = execution.get("generated_code", {})
    state["fixed_code"] = execution.get("fixed_code", {})
    state["idea"] = (
        f"Continue development on existing project.\n"
        f"Original idea: {execution.get('idea', '')}\n"
        f"New request: {new_idea}"
    )
    state["parent_execution_id"] = execution.get("_id", "")
    state["mode"] = "continue"
    return state


def generate_project(
    idea: str,
    user_id: str,
    project_id: str | None = None,
    execution_id: str | None = None,
    mode: str = "new",
    connectors: dict | None = None,
    parent_execution_id_override: str | None = None,
):
    parent_execution_id = parent_execution_id_override
    update_execution_id = execution_id
    existing_code = {}
    continued_project_id = project_id or ""

    state = {
        "user_id": user_id,
        "idea": idea,
        "project_id": project_id or "",
        "project_plan": {},
        "generated_code": {},
        "fixed_code": {},
        "project_path": "",
        "test_results": {},
        "debug_report": "",
        "deployment_plan": {},
        "messages": [],
        "agent_notes": [],
        "iterations": 0,
        "execution_steps": [],
        "mode": mode,
        "parent_execution_id": parent_execution_id_override or "",
        "execution_id": execution_id or "",
    }

    if mode == "continue":
        execution = None
        parent_id = parent_execution_id_override or execution_id
        if parent_id:
            execution = get_execution_by_id(parent_id)
        elif project_id:
            execution = get_execution_by_project_id(project_id)

        if execution:
            parent_execution_id = execution.get("_id")
            state["parent_execution_id"] = str(parent_execution_id)
            continued_project_id = execution.get("project_id", project_id or "")
            existing_code = (
                execution.get("fixed_code")
                or execution.get("generated_code")
                or {}
            )
            state = _hydrate_from_execution(state, execution, idea)
            state["execution_id"] = execution_id or ""
        else:
            state["mode"] = "new"
            continued_project_id = ""

    result = graph.invoke(state)

    if mode == "continue" and continued_project_id:
        result["project_id"] = continued_project_id
        result["mode"] = "continue"

        if result.get("generated_code", {}).get("files"):
            result["generated_code"] = _merge_code_files(
                existing_code,
                result.get("generated_code", {}),
            )

        if result.get("fixed_code", {}).get("files"):
            result["fixed_code"] = _merge_code_files(
                existing_code,
                result.get("fixed_code", {}),
            )

    print("\n=== GRAPH RESULT ===")

    print(result.keys())

    # =====================================
    # USE FIXED CODE IF AVAILABLE
    # =====================================

    generated_files = (
        result.get("fixed_code")
        or
        result.get("generated_code")
        or
        {}
    )

    project_path = ""

    zip_path = ""

    if (
        isinstance(
            generated_files,
            dict
        )
        and
        "files" in generated_files
    ):

        project_path, zip_path = (
            write_project_files(
                result["project_id"],
                generated_files["files"]
            )
        )

    result["project_path"] = (
        project_path
    )

    # =====================================
    # SAVE EXECUTION
    # =====================================

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
            result.get("mode", mode),

        "parent_execution_id":
            parent_execution_id or result.get("parent_execution_id"),

        "project_plan":
            result.get(
                "project_plan",
                {}
            ),

        "generated_code":
            result.get(
                "generated_code",
                {}
            ),

        "initial_generated_code":
            result.get(
                "initial_generated_code",
                {}
            ),

        "fixed_code":
            result.get(
                "fixed_code",
                {}
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
            )
    }

    if update_execution_id:
        update_execution(update_execution_id, execution_data)
        execution_id = update_execution_id
    else:
        execution_data["created_at"] = datetime.utcnow()
        execution_id = save_execution(execution_data)

    pid = result.get("project_id")
    if pid:
        save_version(
            project_id=pid,
            execution_id=execution_id,
            idea=idea,
            generated_code=result.get("generated_code", {}),
            fixed_code=result.get("fixed_code", {}),
            parent_execution_id=parent_execution_id,
        )

    # =====================================
    # RESPONSE
    # =====================================

    response_data = {

        "execution_id":
            execution_id,

        "project_id":
            result.get(
                "project_id"
            ),

        "mode":
            result.get("mode", mode),

        "parent_execution_id":
            parent_execution_id or result.get("parent_execution_id"),

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
                {}
            ),

        "initial_generated_code":
            result.get(
                "initial_generated_code",
                {}
            ),

        "fixed_code":
            result.get(
                "fixed_code",
                {}
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
            f"/download/{result['project_id']}",

        "status":
            "completed"
    }

    if execution_id:
        if response_data.get("status") == "completed" and response_data.get("iterations", 0) > 0:
            try:
                from services.self_learning import record_lessons_from_execution
                record_lessons_from_execution(str(execution_id), str(user_id))
            except Exception as e:
                print(f"[Self-Learning] Failed to run record_lessons_from_execution: {e}")

        from services.execution_stream import stream_manager
        stream_manager.publish(str(execution_id), {"type": "complete", "data": response_data})

    return response_data