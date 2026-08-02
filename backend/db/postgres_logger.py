import time
from datetime import datetime
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

@contextmanager
def log_agent_run(agent_name: str, state: dict):
    task_id = state.get("execution_id")
    if not task_id:
        yield
        return

    # Prepare input summary
    input_summary = ""
    if agent_name == "planner":
        input_summary = f"Idea: {state.get('idea', '')[:500]}"
    elif agent_name == "coder":
        plan = state.get("project_plan", {})
        input_summary = f"Plan features count: {len(plan.get('features', [])) if isinstance(plan, dict) else 0}"
    elif agent_name == "tester":
        code = state.get("fixed_code") or state.get("generated_code") or {}
        input_summary = f"Files count: {len(code.get('files', [])) if isinstance(code, dict) else 0}"
    elif agent_name == "debugger":
        input_summary = f"Issues: {str(state.get('test_results', ''))[:500]}"
    elif agent_name == "deployer":
        input_summary = f"Project path: {state.get('project_path', '')}"

    # Insert agent run
    run_id = None
    try:
        from db.postgres import create_agent_run_pg_sync
        run_id = create_agent_run_pg_sync(task_id, agent_name, input_summary, "running")
    except Exception as e:
        logger.error(f"Failed to log agent run start to PG: {e}")

    start_time = time.time()
    status = "completed"
    error_msg = None

    try:
        yield
    except Exception as e:
        status = "failed"
        error_msg = str(e)
        raise e
    finally:
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Prepare output summary
        output_summary = ""
        if status == "failed":
            output_summary = f"Error: {error_msg}"
        else:
            if agent_name == "planner":
                plan = state.get("project_plan", {})
                output_summary = f"Plan created: {plan.get('project_name', 'Unnamed')}. Project ID: {state.get('project_id')}"
            elif agent_name == "coder":
                code = state.get("generated_code", {})
                output_summary = f"Generated {len(code.get('files', [])) if isinstance(code, dict) else 0} files."
            elif agent_name == "tester":
                results = state.get("test_results", {})
                output_summary = f"Tester status: {results.get('status', 'FAIL')}"
            elif agent_name == "debugger":
                code = state.get("fixed_code", {})
                output_summary = f"Fixed code. Files: {len(code.get('files', [])) if isinstance(code, dict) else 0}"
            elif agent_name == "deployer":
                output_summary = f"Deploy completed. Path: {state.get('project_path', '')}"

        if run_id is not None:
            try:
                from db.postgres import update_agent_run_pg_sync
                update_agent_run_pg_sync(run_id, output_summary, status, duration_ms)
            except Exception as e:
                logger.error(f"Failed to update agent run in PG: {e}")
