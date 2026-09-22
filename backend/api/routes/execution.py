from pydantic import BaseModel

from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    BackgroundTasks,
)
from fastapi.responses import StreamingResponse
import asyncio
import json

from api.models.execution import (
    ProjectExecutionRequest
)

from db.execution_service import (
    get_all_executions,
    get_execution_by_id,
    get_project_history,
    delete_execution,
    save_execution,
)

from db.project_version_service import (
    get_project_versions,
    get_version_by_number,
    save_version,
    compute_code_diff,
)

from datetime import datetime

from services.usage_tracker import UsageTracker
from services.job_queue import enqueue_job

from services.project_generator import (
    generate_project
)

from router.agent_router import (
    route_agent
)

from agents.conversational import (
    conversational_agent
)

from agents.research.supervisor import (
    run_research_agent
)

from auth.optional_auth import get_optional_user
from auth.dependencies import get_current_user
from auth.dependencies import is_system_admin

from agents.education.agent import (
    education_agent,
)

from agents.automation.router import (
    automation_agent,
)

router = APIRouter()


def _authorize_evaluation(evaluation, user):
    user_id = user.get("sub") if user else None
    owner = evaluation.get("user_id") if isinstance(evaluation, dict) else None
    if owner not in (None, "system", "anonymous") and owner != user_id and not is_system_admin(user):
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/engineer-evaluations/{execution_id}")
def get_engineer_evaluation(execution_id: str, user=Depends(get_optional_user)):
    from db.engineer_evaluation_service import get_engineer_evaluation_by_execution
    evaluation = get_engineer_evaluation_by_execution(execution_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="Engineer evaluation not found")
    _authorize_evaluation(evaluation, user)
    evaluation["_id"] = str(evaluation.get("_id", ""))
    return evaluation


@router.get("/engineer-evaluations")
def list_engineer_evaluations(project_id: str = None, user_id: str = None, user=Depends(get_optional_user)):
    from db.engineer_evaluation_service import list_engineer_evaluations as list_evaluations
    requester = user.get("sub") if user else None
    if user_id and user_id != requester and not is_system_admin(user):
        raise HTTPException(status_code=403, detail="Access denied")
    # Non-admin callers are always scoped to their own evaluations.
    evaluations = list_evaluations(project_id=project_id, user_id=user_id or requester)
    allowed = []
    for evaluation in evaluations:
        _authorize_evaluation(evaluation, user)
        evaluation["_id"] = str(evaluation.get("_id", ""))
        allowed.append(evaluation)
    return allowed


VALID_WORKSPACE_MODES = {"manual", "automatic"}
AUTOMATIC_FEATURE_OWNER_EMAIL = "ydvhimanshu461@gmail.com"


def _can_use_automatic_mode(user) -> bool:
    """Automatic Supervisor routing is reserved for the designated owner."""
    return (
        isinstance(user, dict)
        and str(user.get("email", "")).strip().lower()
        == AUTOMATIC_FEATURE_OWNER_EMAIL
    )


def _get_workspace_mode(request: ProjectExecutionRequest) -> str:
    """Resolve workspace routing mode separately from execution lifecycle mode."""
    workspace_mode = getattr(request, "workspace_mode", "manual") or "manual"
    contract_mode = str(getattr(request, "mode", "") or "").strip().lower()
    if contract_mode in VALID_WORKSPACE_MODES:
        workspace_mode = contract_mode
    workspace_mode = str(workspace_mode).strip().lower()
    if workspace_mode not in VALID_WORKSPACE_MODES:
        raise HTTPException(
            status_code=400,
            detail="Invalid workspace_mode. Expected 'manual' or 'automatic'.",
        )
    return workspace_mode


def _ensure_automatic_mode_supported(workspace_mode: str) -> None:
    """Validate the workspace routing mode.

    Automatic execution is handled by the dedicated Supervisor worker via
    Redis; FastAPI only validates and enqueues the request.
    """
    if workspace_mode not in VALID_WORKSPACE_MODES:
        raise HTTPException(
            status_code=400,
            detail="Invalid workspace_mode. Expected 'manual' or 'automatic'.",
        )


@router.post("/projects/{project_id}/versions/{version}/restore")
def restore_project_version(
    project_id: str,
    version: int,
    user=Depends(get_optional_user),
):
    user_id = user.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    source_version = get_version_by_number(project_id, version)

    if not source_version:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version} not found",
        )

    source_execution_id = source_version.get("execution_id")
    source_execution = (
        get_execution_by_id(source_execution_id)
        if source_execution_id
        else None
    )

    if (
        source_execution
        and source_execution.get("user_id")
        not in ("system", "anonymous", user_id)
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    restored_files = (
        source_version.get("fixed_code")
        or source_version.get("generated_code")
        or []
    )

    now = datetime.utcnow()

    # Materialize the restored version into the actual project workspace.
    try:
        import os
        import shutil
        from services.project_storage import (
            get_project_dir,
            resolve_project_file,
        )

        project_path = get_project_dir(project_id)
        os.makedirs(project_path, exist_ok=True)

        # Remove current project contents so files removed in the restored
        # version do not remain on disk.
        for entry in os.listdir(project_path):
            entry_path = os.path.join(project_path, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
            else:
                os.remove(entry_path)

        for file_data in restored_files:
            rel_path = file_data.get("path")
            code = file_data.get("code", "")

            if not rel_path:
                continue

            try:
                file_path = resolve_project_file(project_id, rel_path)
            except ValueError as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid project file path: {rel_path}",
                ) from exc

            parent_dir = os.path.dirname(file_path)
            if parent_dir:
                os.makedirs(parent_dir, exist_ok=True)

            with open(file_path, "w", encoding="utf-8") as file_handle:
                file_handle.write(code)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to materialize restored workspace: {exc}",
        ) from exc

    # Never modify the original execution/version.
    restored_execution = {
        "user_id": user_id,
        "project_id": project_id,
        "idea": f"Restore project to Version {version}",
        "mode": "restore",
        "workspace_mode": source_execution.get("workspace_mode", "manual") if source_execution else "manual",
        "parent_execution_id": source_execution_id or "",
        "restored_from_version": version,
        "status": "completed",
        "created_at": now,
        "updated_at": now,
        "execution_steps": [
            {
                "step": "restore",
                "status": "completed",
                "message": f"Restored Version {version}",
                "timestamp": now.isoformat(),
            }
        ],
        "project_plan": source_version.get("project_plan", {}),
        "generated_code": restored_files,
        "fixed_code": restored_files,
        "deployment_plan": {},
        "iterations": 0,
    }

    new_execution_id = save_execution(restored_execution)

    # Restore becomes a new immutable version.
    new_version = save_version(
        project_id=project_id,
        execution_id=new_execution_id,
        idea=f"Restore project to Version {version}",
        generated_code=restored_files,
        fixed_code=restored_files,
        parent_execution_id=source_execution_id,
    )

    restored_execution["_id"] = new_execution_id
    restored_execution["execution_id"] = new_execution_id
    restored_execution["version"] = new_version["version"]

    return {
        "status": "success",
        "message": f"Version {version} restored successfully.",
        "execution_id": new_execution_id,
        "project_id": project_id,
        "restored_from_version": version,
        "new_version": new_version["version"],
        "files": restored_files,
        "execution": restored_execution,
    }


def _normalize_files(value):
    """Return project files in canonical list format, with legacy support."""
    if isinstance(value, list):
        return [
            item for item in value
            if isinstance(item, dict) and item.get("path")
        ]

    if isinstance(value, dict):
        files = value.get("files", [])
        if isinstance(files, list):
            return [
                item for item in files
                if isinstance(item, dict) and item.get("path")
            ]

    return []


def _get_execution_files(execution, preferred="fixed"):
    """Get execution files, preferring fixed code and falling back to generated code."""
    fixed = _normalize_files(execution.get("fixed_code"))
    generated = _normalize_files(execution.get("generated_code"))
    if preferred == "generated":
        return generated or fixed
    return fixed or generated


@router.post("/execute-project")
def execute_project(
    request: ProjectExecutionRequest,
    background_tasks: BackgroundTasks,
    user=Depends(get_optional_user),
):
    user_id = user.get("sub", "system")
    if request.agent and not request.agent_type:
        request.agent_type = request.agent
    workspace_mode = _get_workspace_mode(request)
    _ensure_automatic_mode_supported(workspace_mode)
    if workspace_mode == "automatic" and not _can_use_automatic_mode(user):
        raise HTTPException(
            status_code=403,
            detail="Automatic Supervisor mode is restricted to its designated administrator. Use manual mode to select an agent.",
        )
    if str(request.mode).strip().lower() in VALID_WORKSPACE_MODES:
        # `mode` was supplied as the public workspace-routing contract, not as
        # the Engineer lifecycle mode consumed by project generation.
        request.mode = "new"

    if request.agent_type:
        try:
            route_agent(request.agent_type)
        except (AttributeError, ValueError):
            raise HTTPException(status_code=422, detail="Invalid agent. Expected engineer, conversational, research, education, or automation.")

    # Resolve effective agent type depending on workspace mode.
    # - automatic: None = Supervisor decides (auto-route); explicit value = force agent
    # - manual:    None defaults to "engineer" for backwards compatibility
    automatic_routing = None
    if workspace_mode == "automatic":
        from router.supervisor import route_request
        automatic_routing = route_request(request.idea, {"conversation_id": request.conversation_id})
        # A normal chat must never create a Supervisor/Engineer execution
        # record or timer. Use the established Conversation handler directly.
        if automatic_routing["agent"] == "conversational":
            request.agent_type = "conversational"
            workspace_mode = "manual"
        else:
            request.agent_type = automatic_routing["agent"]

    if workspace_mode == "automatic":
        effective_agent_label = (
            request.agent_type if request.agent_type else "auto-route (supervisor)"
        )
    else:
        if request.agent_type is None:
            request.agent_type = "engineer"
        effective_agent_label = request.agent_type

    # 0. Safety Guardrails Input Check
    from services.guardrails import validate_input
    guard = validate_input(request.idea, user_id=user_id)
    if not guard["safe"]:
        raise HTTPException(status_code=400, detail=guard["message"])

    print(
        "Workspace Mode =",
        workspace_mode,
        "| Agent Type =",
        effective_agent_label,
    )

    # Automatic mode must reach the top-level Supervisor before any
    # agent-specific intent routing. Passing "engineer" here would bias
    # Automatic mode toward Engineer.
    if workspace_mode == "automatic":
        # Preserve the existing RAG grounding pipeline.
        try:
            from services.search_pipeline import retrieve_layered_context

            source_layer, chunks = retrieve_layered_context(
                query=request.idea,
                project_id=request.project_id,
                org_id=request.org_id,
                session_id=request.session_id,
                top_k=5,
                conversation_id=request.conversation_id,
            )

            if chunks:
                context_str = "\n\n".join(
                    f"Source: {c['metadata'].get('filename', 'unknown')} "
                    f"(Page {c['metadata'].get('page_num', 1)}):\n{c['text']}"
                    for c in chunks
                )
                request.idea = (
                    f"[Retrieved Context from {source_layer.upper()} RAG]\n"
                    f"{context_str}\n"
                    f"[End of Context]\n\n"
                    f"User Request: {request.idea}"
                )
        except BaseException as e:
            print("RAG Context injection failed in automatic route:", e)

        from db.execution_service import save_execution

        now = datetime.utcnow()
        execution_data = {
            "user_id": user_id,
            "project_id": request.project_id or "",
            "idea": request.idea,
            "mode": request.mode,
            "workspace_mode": "automatic",
            "requested_agent_type": request.agent_type or "",
            "supervisor_routing": automatic_routing or {},
            "parent_execution_id": request.execution_id or "",
            "status": "running",
            "created_at": now,
            "updated_at": now,
            "execution_steps": [
                {
                    "agent": "supervisor",
                    "step": "routing",
                    "status": "in_progress",
                    "message": (
                        f"Automatic workspace Supervisor routing started "
                        f"(agent selection: {effective_agent_label})."
                    ),
                    "timestamp": now.isoformat(),
                    "details": {
                        "requested_agent_type": request.agent_type,
                        "routing": automatic_routing or {},
                    },
                }
            ],
            "project_plan": {},
            "generated_code": [],
            "fixed_code": [],
            "deployment_plan": {},
            "iterations": 0,
        }

        execution_id = save_execution(execution_data)

        try:
            from db.postgres import save_task_pg_sync
            save_task_pg_sync(
                execution_id,
                project_id=request.project_id,
                status="running",
            )
        except Exception as pg_err:
            print(
                f"[PostgreSQL Error] Failed to create automatic task "
                f"{execution_id} in PostgreSQL: {pg_err}"
            )

        enqueue_job(
            "supervisor.run",
            {
                "execution_id": execution_id,
                "user_id": user_id,
                "project_id": request.project_id,
                "conversation_id": request.conversation_id,
                "session_id": request.conversation_id,
                "idea": request.idea,
                "mode": request.mode,
                "workspace_mode": "automatic",
                "requested_agent_type": request.agent_type,
                "connectors": request.connectors,
                "parent_execution_id": request.execution_id,
                "attachments": request.attachments,
            },
            job_id=execution_id,
        )

        return {
            "status": "running",
            "execution_id": execution_id,
            "conversation_id": request.conversation_id,
            "job_id": execution_id,
            "workspace_mode": "automatic",
            "requested_agent_type": request.agent_type,
            "routing": automatic_routing or {},
        }

    # Manual mode dispatches the user-selected agent directly. Intent routing
    # belongs exclusively to Automatic/Supervisor mode.
    is_casual = False
    msg_content = ""
    if is_casual:
        conv_id = request.conversation_id
        if not conv_id:
            if request.agent_type == "automation":
                from db.mongo_client import db
                new_conv = {
                    "user_id": user_id,
                    "title": request.idea[:60],
                    "messages": [],
                    "created_at": datetime.utcnow()
                }
                res_db = db["automation_conversations"].insert_one(new_conv)
                conv_id = str(res_db.inserted_id)
            else:
                from db.conversation_service import create_conversation
                conv_id = create_conversation(user_id=user_id, agent_type=request.agent_type or "engineer", title=request.idea[:60])

        if request.agent_type == "automation":
            from db.mongo_client import db
            from bson import ObjectId
            user_msg = {"role": "user", "content": request.idea, "timestamp": datetime.utcnow().isoformat()}
            ai_msg = {"role": "assistant", "content": msg_content, "timestamp": datetime.utcnow().isoformat()}
            db["automation_conversations"].update_one(
                {"_id": ObjectId(conv_id)},
                {"$push": {"messages": {"$each": [user_msg, ai_msg]}}}
            )
        else:
            from db.conversation_service import add_message
            add_message(conv_id, "user", request.idea)
            add_message(conv_id, "assistant", msg_content)

        if request.agent_type == "engineer":
            return {
                "agent": "engineer",
                "conversation_id": conv_id,
                "message": msg_content,
                "result": None
            }
        elif request.agent_type == "research":
            return {
                "conversation_id": conv_id,
                "content": msg_content,
                "result": {
                    "conversation_id": conv_id,
                    "report": msg_content,
                    "queries": [],
                    "sources": []
                }
            }
        elif request.agent_type == "automation":
            return {
                "conversation_id": conv_id,
                "content": msg_content,
                "result": {
                    "title": "Automation Assistant",
                    "description": msg_content,
                    "platform": "n8n",
                    "nodes": [],
                    "steps": []
                }
            }
        else:
            return {
                "conversation_id": conv_id,
                "message": msg_content,
                "content": msg_content,
                "result": None
            }

    # Retrieve RAG context and ground the prompt
    try:
        from services.search_pipeline import retrieve_layered_context
        source_layer, chunks = retrieve_layered_context(
            query=request.idea,
            project_id=request.project_id,
            org_id=request.org_id,
            session_id=request.session_id,
            top_k=5,
            conversation_id=request.conversation_id
        )
        if chunks:
            context_str = "\n\n".join(
                f"Source: {c['metadata'].get('filename', 'unknown')} (Page {c['metadata'].get('page_num', 1)}):\n{c['text']}"
                for c in chunks
            )
            # Add citations to request details so they can be logged or parsed
            request.idea = (
                f"[Retrieved Context from {source_layer.upper()} RAG]\n{context_str}\n"
                f"[End of Context]\n\n"
                f"User Request: {request.idea}"
            )
    except BaseException as e:
        print("RAG Context injection failed in execution route:", e)

    from services.agent_tools import intercept_mcp_tool_call
    intercepted = intercept_mcp_tool_call(
        prompt=request.idea,
        agent_type=request.agent_type,
        conversation_id=request.conversation_id,
        connectors=request.connectors
    )
    if intercepted:
        return intercepted

    selected_agent = route_agent(
        request.agent_type
    )

    if selected_agent == "engineer":
        # Create conversation if it doesn't exist
        conv_id = request.conversation_id
        if not conv_id:
            from db.conversation_service import create_conversation
            conv_id = create_conversation(user_id=user_id, agent_type=request.agent_type, title=request.idea[:60])

        from db.conversation_service import add_message, get_conversation
        user_msg_content = request.idea

        # Human-in-the-Loop (HITL) Architectural Clarification Check
        from agents.architect import evaluate_and_clarify_requirements, format_clarification_markdown, generate_enterprise_blueprint

        conv = get_conversation(conv_id) if conv_id else None
        conv_messages = conv.get("messages", []) if conv else []

        if request.mode != "continue":
            clarification_check = evaluate_and_clarify_requirements(
                idea=request.idea,
                conversation_history=conv_messages,
                force_generate=getattr(request, "force_generate", False)
            )

            if not clarification_check.get("is_ready_to_generate", True):
                # Save user query to conversation history
                add_message(conv_id, "user", user_msg_content, attachments=request.attachments)

                assistant_content = format_clarification_markdown(clarification_check)
                clarification_result = {
                    "type": "clarification",
                    "is_clarification": True,
                    "project_name": clarification_check.get("project_name", "Architecture Analysis"),
                    "understanding": clarification_check.get("understanding", ""),
                    "questions": clarification_check.get("questions", []),
                    "recommended_architecture": clarification_check.get("recommended_architecture", ""),
                    "status": "clarification_needed"
                }

                add_message(conv_id, "assistant", assistant_content, result=clarification_result)

                return {
                    "status": "clarification_needed",
                    "conversation_id": conv_id,
                    "message": assistant_content,
                    "content": assistant_content,
                    "clarification": clarification_result,
                    "result": clarification_result
                }

        # Pre-generate or retrieve execution ID
        from db.execution_service import save_execution

        parent_id = None
        if request.mode == "continue":
            parent_id = request.execution_id or request.project_id

        # Insert placeholder execution to MongoDB with running state
        execution_data = {
            "user_id": user_id,
            "project_id": request.project_id or "",
            "idea": request.idea,
            "mode": request.mode,
            "workspace_mode": workspace_mode,
            "parent_execution_id": parent_id or "",
            "status": "running",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "execution_steps": [],
            "project_plan": {},
            "generated_code": [],
            "fixed_code": [],
            "deployment_plan": {},
            "iterations": 0
        }
        execution_id = save_execution(execution_data)

        # Create Task record in PostgreSQL
        try:
            from db.postgres import save_task_pg_sync
            save_task_pg_sync(execution_id, project_id=request.project_id, status="running")
        except Exception as pg_err:
            print(f"[PostgreSQL Error] Failed to create task {execution_id} in PostgreSQL: {pg_err}")

        # Log clean user message to conversation history
        add_message(conv_id, "user", user_msg_content, attachments=request.attachments)

        # Run generate_project in background task
        def run_generation(exec_id, parent_id_override):
            try:
                from services.usage_tracker import UsageTracker
                UsageTracker.set_context(
                    user_id=user_id,
                    project_id=request.project_id or exec_id,
                    conversation_id=conv_id,
                    module="engineer",
                    operation="project_generation",
                    agent="coder"
                )
            except Exception:
                pass
            try:
                res = generate_project(
                    idea=request.idea,
                    user_id=user_id,
                    project_id=request.project_id,
                    execution_id=exec_id,
                    mode=request.mode,
                    connectors=request.connectors,
                    parent_execution_id_override=parent_id_override
                )
                
                # Generate Rich Enterprise Blueprint delivery report
                assistant_content = generate_enterprise_blueprint(res)
                add_message(conv_id, "assistant", assistant_content, result=res)
                
                # Record LLM tokens and Developer Hours ROI in Cost Vault
                try:
                    from services.llm_router import record_llm_usage
                    from db.mongo_client import db as mongo_db
                    generated_code_str = json.dumps(res.get("generated_code", {}))
                    record_llm_usage(
                        user_id=user_id,
                        department="Engineering",
                        model="openai/gpt-oss-120b",
                        prompt=request.idea,
                        output_text=f"{assistant_content}\n{generated_code_str}",
                        agent_type="engineer",
                        iterations=res.get("iterations", 0),
                        db=mongo_db
                    )
                except Exception as usage_err:
                    print("Error logging project generation LLM usage:", usage_err)
            except Exception as e:
                import traceback
                print("Error in background project generation:", e)
                traceback.print_exc()
                
                from db.execution_service import update_execution
                update_execution(exec_id, {
                    "status": "failed",
                    "debug_report": f"Background execution crash: {str(e)}",
                    "updated_at": datetime.utcnow()
                })
                
                from services.execution_stream import stream_manager
                stream_manager.publish(exec_id, {
                    "type": "failed",
                    "error": str(e)
                })

        enqueue_job(
            "engineer.generate",
            {
                "execution_id": execution_id,
                "user_id": user_id,
                "project_id": request.project_id,
                "conversation_id": conv_id,
                "idea": request.idea,
                "mode": request.mode,
                "workspace_mode": workspace_mode,
                "connectors": request.connectors,
                "parent_execution_id": parent_id,
            },
            job_id=execution_id,
        )

        return {
            "status": "running",
            "execution_id": execution_id,
            "conversation_id": conv_id,
            "job_id": execution_id
        }

    elif selected_agent == "conversational":
        conv_id = request.conversation_id
        if not conv_id:
            from db.conversation_service import create_conversation
            conv_id = create_conversation(user_id=user_id, agent_type=request.agent_type, title=request.idea[:60])

        def run_conversational_bg(session_id):
            try:
                from services.usage_tracker import UsageTracker
                UsageTracker.set_context(
                    user_id=user_id,
                    conversation_id=session_id,
                    module="conversation",
                    operation="chat",
                    agent="conversational"
                )
            except Exception:
                pass
            try:
                res = conversational_agent(
                    request.idea,
                    session_id,
                    user_id=user_id,
                    connectors=request.connectors,
                )
                from services.execution_stream import stream_manager
                stream_manager.publish(session_id, {"type": "complete", "data": res})
            except Exception as e:
                from services.execution_stream import stream_manager
                stream_manager.publish(session_id, {"type": "failed", "error": str(e)})

        enqueue_job(
            "conversational.chat",
            {
                "session_id": conv_id,
                "user_id": user_id,
                "idea": request.idea,
                "connectors": request.connectors,
            },
            job_id=f"conversation:{conv_id}",
        )
        return {
            "status": "running",
            "execution_id": conv_id,
            "conversation_id": conv_id
        }

    elif selected_agent == "research":
        session_id = request.conversation_id
        if not session_id:
            from db.research_service import create_research_session
            payload = {
                "user_id": user_id,
                "title": request.idea[:80],
                "prompt": request.idea,
                "status": "running",
                "timeline": [],
                "messages": [
                    {"role": "user", "content": request.idea, "timestamp": datetime.utcnow()}
                ]
            }
            session_id = create_research_session(payload)
        else:
            from db.research_service import append_research_message
            append_research_message(session_id, "user", request.idea)

        from db.research_service import update_research_session
        update_research_session(session_id, {"status": "running"})

        def run_research_bg(sess_id):
            try:
                from services.usage_tracker import UsageTracker
                UsageTracker.set_context(
                    user_id=user_id,
                    conversation_id=sess_id,
                    module="research",
                    operation="research_report",
                    agent="research_supervisor"
                )
            except Exception:
                pass
            try:
                run_research_agent(
                    prompt=request.idea,
                    session_id=sess_id,
                    user_id=user_id,
                    connectors=request.connectors,
                )
            except Exception as e:
                from services.execution_stream import stream_manager
                stream_manager.publish(sess_id, {"type": "failed", "error": str(e)})

        enqueue_job(
            "research.run",
            {
                "session_id": session_id,
                "user_id": user_id,
                "idea": request.idea,
                "connectors": request.connectors,
            },
            job_id=f"research:{session_id}",
        )
        return {
            "status": "running",
            "execution_id": session_id,
            "conversation_id": session_id
        }

    elif selected_agent == "education":
        conv_id = request.conversation_id
        from db.conversation_service import create_conversation, add_message
        if not conv_id:
            conv_id = create_conversation(user_id=user_id, agent_type=request.agent_type, title=request.idea[:60])
        add_message(conv_id, "user", request.idea, attachments=request.attachments)

        def run_education_bg(session_id):
            try:
                from services.usage_tracker import UsageTracker
                UsageTracker.set_context(
                    user_id=user_id,
                    conversation_id=session_id,
                    module="education",
                    operation="learn",
                    agent="education"
                )
            except Exception:
                pass
            try:
                res = education_agent(
                    prompt=request.idea,
                    connectors=request.connectors,
                    session_id=session_id
                )
                add_message(session_id, "assistant", res.get("response", ""), result=res)
                
                from services.execution_stream import stream_manager
                stream_manager.publish(session_id, {"type": "complete", "data": res})
            except Exception as e:
                from services.execution_stream import stream_manager
                stream_manager.publish(session_id, {"type": "failed", "error": str(e)})

        enqueue_job(
            "education.run",
            {
                "session_id": conv_id,
                "user_id": user_id,
                "idea": request.idea,
                "connectors": request.connectors,
            },
            job_id=f"education:{conv_id}",
        )
        return {
            "status": "running",
            "execution_id": conv_id,
            "conversation_id": conv_id
        }

    elif selected_agent == "automation":
        from bson import ObjectId
        from db.mongo_client import db

        conv_id = request.conversation_id
        user_message = {
            "role": "user",
            "content": request.idea,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if conv_id:
            db["automation_conversations"].update_one(
                {"_id": ObjectId(conv_id)},
                {
                    "$push": {"messages": user_message},
                    "$set": {"updated_at": datetime.utcnow()},
                },
            )
        else:
            if user_id and user_id not in ("system", "anonymous"):
                from db.mongo_client import get_user_limit
                limit = get_user_limit(user_id)
                existing_count = db["automation_conversations"].count_documents({"user_id": user_id, "agent_type": "automation"})
                if existing_count >= limit:
                    raise HTTPException(
                        status_code=429,
                        detail="LIMIT_REACHED"
                    )
            conv_doc = {
                "user_id": user_id,
                "agent_type": "automation",
                "title": request.idea[:50],
                "messages": [user_message],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            insert_result = db["automation_conversations"].insert_one(conv_doc)
            conv_id = str(insert_result.inserted_id)

        def run_automation_bg(session_id):
            try:
                from services.usage_tracker import UsageTracker
                UsageTracker.set_context(
                    user_id=user_id,
                    conversation_id=session_id,
                    module="automation",
                    operation="workflow_generation",
                    agent="automation"
                )
            except Exception:
                pass
            try:
                res = automation_agent(
                    prompt=request.idea,
                    platform_override=None,
                    session_id=session_id
                )

                md_parts = []
                md_parts.append(f"# 🤖 {res.get('title', 'Automation Workflow')}\n")
                md_parts.append(f"{res.get('description', '')}\n")
                md_parts.append(f"**Platform:** {res.get('platform', 'n8n')}\n")
                
                if res.get("workflow_ascii"):
                    md_parts.append("### 📊 Workflow Graph")
                    md_parts.append("```text")
                    md_parts.append(res.get("workflow_ascii"))
                    md_parts.append("```\n")
                    
                nodes = res.get("nodes", [])
                if nodes:
                    md_parts.append("### 🧩 Nodes & Components")
                    for node in nodes:
                        node_type_label = f" *({node.get('type', '')})*" if node.get('type') else ""
                        md_parts.append(f"- **{node.get('name', 'Node')}**{node_type_label}: {node.get('purpose', '')}")
                    md_parts.append("")
                    
                steps = res.get("steps", [])
                if steps:
                    md_parts.append("### 📝 Execution Steps")
                    for step in steps:
                        md_parts.append(f"{step.get('step', 1)}. **{step.get('title', '')}** — {step.get('description', '')}")
                    md_parts.append("")

                rich_content = "\n".join(md_parts)

                ai_message = {
                    "role": "assistant",
                    "content": rich_content,
                    "result": res,
                    "timestamp": datetime.utcnow().isoformat(),
                }

                db["automation_conversations"].update_one(
                    {"_id": ObjectId(session_id)},
                    {
                        "$push": {"messages": ai_message},
                        "$set": {"updated_at": datetime.utcnow()},
                    },
                )

                final_res = {
                    "conversation_id": session_id,
                    "content": rich_content,
                    "result": res
                }

                from services.execution_stream import stream_manager
                stream_manager.publish(session_id, {"type": "complete", "data": final_res})
            except Exception as e:
                from services.execution_stream import stream_manager
                stream_manager.publish(session_id, {"type": "failed", "error": str(e)})

        enqueue_job(
            "automation.run",
            {
                "session_id": conv_id,
                "user_id": user_id,
                "idea": request.idea,
            },
            job_id=f"automation:{conv_id}",
        )
        return {
            "status": "running",
            "execution_id": conv_id,
            "conversation_id": conv_id
        }

    raise HTTPException(
        status_code=400,
        detail="Invalid agent type"
    )


@router.post("/continue-project")
def continue_project(
    request: ProjectExecutionRequest,
    user=Depends(get_optional_user),
):
    user_id = user.get("sub", "system")
    workspace_mode = _get_workspace_mode(request)
    _ensure_automatic_mode_supported(workspace_mode)

    if workspace_mode != "automatic" and request.agent_type is None:
        request.agent_type = "engineer"

    if not request.project_id and not request.execution_id:
        raise HTTPException(
            status_code=400,
            detail="project_id or execution_id required",
        )

    if workspace_mode == "automatic":
        from db.execution_service import save_execution

        now = datetime.utcnow()
        execution_data = {
            "user_id": user_id,
            "project_id": request.project_id or "",
            "idea": request.idea,
            "mode": "continue",
            "workspace_mode": "automatic",
            "requested_agent_type": request.agent_type or "",
            "parent_execution_id": request.execution_id or request.project_id or "",
            "status": "running",
            "created_at": now,
            "updated_at": now,
            "execution_steps": [
                {
                    "agent": "supervisor",
                    "step": "routing",
                    "status": "in_progress",
                    "message": (
                        f"Automatic continuation routed through Supervisor "
                        f"(agent: {request.agent_type or 'auto-route'})."
                    ),
                    "timestamp": now.isoformat(),
                }
            ],
            "project_plan": {},
            "generated_code": [],
            "fixed_code": [],
            "deployment_plan": {},
            "iterations": 0,
        }

        execution_id = save_execution(execution_data)

        try:
            from db.postgres import save_task_pg_sync
            save_task_pg_sync(
                execution_id,
                project_id=request.project_id,
                status="running",
            )
        except Exception as pg_err:
            print(
                f"[PostgreSQL Error] Failed to create automatic continuation "
                f"task {execution_id} in PostgreSQL: {pg_err}"
            )

        enqueue_job(
            "supervisor.run",
            {
                "execution_id": execution_id,
                "user_id": user_id,
                "project_id": request.project_id,
                "conversation_id": request.conversation_id,
                "session_id": request.conversation_id,
                "idea": request.idea,
                "mode": "continue",
                "workspace_mode": "automatic",
                "requested_agent_type": request.agent_type,
                "connectors": request.connectors,
                "parent_execution_id": request.execution_id or request.project_id,
                "attachments": request.attachments,
            },
            job_id=execution_id,
        )

        return {
            "status": "running",
            "execution_id": execution_id,
            "project_id": request.project_id,
            "parent_execution_id": request.execution_id or request.project_id,
            "job_id": execution_id,
            "workspace_mode": "automatic",
        }

    return generate_project(
        idea=request.idea,
        user_id=user_id,
        project_id=request.project_id,
        execution_id=request.execution_id,
        mode="continue",
    )


@router.get("/executions")
def get_executions(user=Depends(get_optional_user)):
    user_id = user.get("sub")
    if not user_id or user_id == "system":
        return []
    from db.execution_service import get_user_executions
    return get_user_executions(user_id)


@router.get("/executions/{execution_id}")
def get_execution(
    execution_id: str,
    user=Depends(get_optional_user)
):

    execution = get_execution_by_id(
        execution_id
    )

    if not execution:

        raise HTTPException(
            status_code=404,
            detail="Execution not found"
        )

    user_id = user.get("sub")
    if execution.get("user_id") not in ("system", "anonymous") and execution.get("user_id") != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )

    return execution



def _assert_usage_project_access(project_id: str, user):
    """Authorize project-scoped usage reads using the existing execution ownership model."""
    user_id = user.get("sub") if user else None
    if not project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    history = get_project_history(project_id) or []
    if not history:
        raise HTTPException(status_code=404, detail="Project not found")

    if not user_id:
        # Existing system/anonymous executions remain readable for unauthenticated
        # internal flows, matching the execution read policy.
        if any(item.get("user_id") not in (None, "system", "anonymous") for item in history):
            raise HTTPException(status_code=401, detail="Authentication required")
        return

    for item in history:
        owner = item.get("user_id")
        if owner in (None, "system", "anonymous", user_id):
            continue
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/executions/{execution_id}/usage")
def execution_usage(
    execution_id: str,
    user=Depends(get_optional_user),
):
    """Return token, cost and latency usage for one immutable execution."""
    execution = get_execution_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    user_id = user.get("sub") if user else None
    owner = execution.get("user_id")
    if owner not in (None, "system", "anonymous") and owner != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    summary = UsageTracker.get_execution_usage(execution_id)
    workload = UsageTracker.get_workload_stats()
    compute = UsageTracker.get_compute_stats()

    # Scope breakdown to this execution rather than returning global workload data.
    from db.mongo_client import llm_usage_collection
    logs = list(llm_usage_collection.find({"execution_id": execution_id}))
    by_agent = {}
    by_model = {}
    for log in logs:
        agent = log.get("agent") or "unknown"
        model = log.get("model") or "unknown"
        for bucket, key in ((by_agent, agent), (by_model, model)):
            item = bucket.setdefault(key, {
                "calls": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0.0,
                "latency_ms": 0.0,
            })
            item["calls"] += 1
            item["input_tokens"] += int(log.get("input_tokens", 0) or 0)
            item["output_tokens"] += int(log.get("output_tokens", 0) or 0)
            item["total_tokens"] += int(log.get("total_tokens", 0) or 0)
            item["estimated_cost_usd"] += float(log.get("estimated_cost_usd", 0) or 0)
            item["latency_ms"] += float(log.get("latency_ms", 0) or 0)

    budget = UsageTracker.get_budget_status(execution_id=execution_id)
    return {
        "execution_id": execution_id,
        "project_id": execution.get("project_id"),
        "summary": summary,
        "by_agent": by_agent,
        "by_model": by_model,
        "budget": budget,
        "compute": {
            "calls": summary.get("calls", 0),
            "total_latency_ms": summary.get("latency_ms", 0),
            "avg_latency_ms": round(
                summary.get("latency_ms", 0) / max(summary.get("calls", 0), 1), 2
            ),
        },
    }


@router.get("/projects/{project_id}/usage")
def project_usage(
    project_id: str,
    user=Depends(get_optional_user),
):
    """Return aggregate token/cost usage for a project."""
    _assert_usage_project_access(project_id, user)
    summary = UsageTracker.get_project_usage(project_id)
    from db.mongo_client import llm_usage_collection
    logs = list(llm_usage_collection.find({"project_id": project_id}))

    by_agent = {}
    by_model = {}
    for log in logs:
        agent = log.get("agent") or "unknown"
        model = log.get("model") or "unknown"
        for bucket, key in ((by_agent, agent), (by_model, model)):
            item = bucket.setdefault(key, {
                "calls": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "estimated_cost_usd": 0.0,
                "latency_ms": 0.0,
            })
            item["calls"] += 1
            item["input_tokens"] += int(log.get("input_tokens", 0) or 0)
            item["output_tokens"] += int(log.get("output_tokens", 0) or 0)
            item["total_tokens"] += int(log.get("total_tokens", 0) or 0)
            item["estimated_cost_usd"] += float(log.get("estimated_cost_usd", 0) or 0)
            item["latency_ms"] += float(log.get("latency_ms", 0) or 0)

    return {
        "project_id": project_id,
        "summary": summary,
        "by_agent": by_agent,
        "by_model": by_model,
        "budget": UsageTracker.get_budget_status(project_id=project_id),
    }


@router.get("/usage/summary")
def usage_summary(
    days: int = 30,
    user=Depends(get_optional_user),
):
    """Return the authenticated user's aggregate usage summary."""
    user_id = user.get("sub") if user else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    days = max(1, min(int(days or 30), 365))
    return {
        "days": days,
        "summary": UsageTracker.get_summary(user_id=user_id, days=days),
        "workload": UsageTracker.get_workload_stats(user_id=user_id),
        "compute": UsageTracker.get_compute_stats(user_id=user_id),
    }


class ReplayExecutionRequest(BaseModel):
    step: str | None = None


@router.post("/executions/{execution_id}/replay")
def replay_execution(
    execution_id: str,
    payload: ReplayExecutionRequest,
    background_tasks: BackgroundTasks,
    user=Depends(get_optional_user),
):
    """
    Replay exactly one Engineer agent node as a new immutable child
    execution. The source execution is never modified.
    """
    source = get_execution_by_id(execution_id)

    if not source:
        raise HTTPException(
            status_code=404,
            detail="Execution not found",
        )

    user_id = user.get("sub")
    if (
        source.get("user_id") not in ("system", "anonymous")
        and source.get("user_id") != user_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    if source.get("status") == "running":
        raise HTTPException(
            status_code=409,
            detail="Cannot replay a running execution",
        )

    project_id = source.get("project_id") or ""
    idea = source.get("idea") or ""

    if not idea:
        raise HTTPException(
            status_code=400,
            detail="Source execution does not contain a replayable project request",
        )

    replay_step = str(
        payload.step or "pipeline"
    ).strip().lower()

    # Validate the node before creating the child execution.
    from agents.graph import REPLAY_NODES

    aliases = {
        "plan": "planner",
        "planning": "planner",
        "code": "coder",
        "coding": "coder",
        "test": "tester",
        "testing": "tester",
        "debug": "debugger",
        "fix": "debugger",
        "fixing": "debugger",
        "generating_fixes": "debugger",
        "analyzing_issues": "debugger",
        "deploy": "deployer",
        "deployment": "deployer",
    }

    replay_step = aliases.get(
        replay_step,
        replay_step,
    )

    if replay_step not in REPLAY_NODES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported replay step: {payload.step}",
        )

    from datetime import datetime
    from services.project_storage import get_project_dir

    now = datetime.utcnow()

    replay_execution_data = {
        "user_id": user_id,
        "project_id": project_id,
        "idea": idea,
        "mode": "replay",
        "workspace_mode": source.get("workspace_mode", "manual"),
        "parent_execution_id": execution_id,
        "replay_from_execution_id": execution_id,
        "replay_step": replay_step,
        "status": "running",
        "created_at": now,
        "updated_at": now,
        "execution_steps": [
            {
                "agent": replay_step,
                "step": "replay",
                "status": "in_progress",
                "message": f"Replay started for {replay_step}",
                "timestamp": now.isoformat(),
                "details": {
                    "source_execution_id": execution_id,
                    "replay_step": replay_step,
                },
            }
        ],
        "project_plan": source.get("project_plan", {}),
        "generated_code": _normalize_files(
            source.get("generated_code")
        ),
        "initial_generated_code": _normalize_files(
            source.get("initial_generated_code")
        ),
        "fixed_code": _normalize_files(
            source.get("fixed_code")
        ),
        "deployment_plan": source.get(
            "deployment_plan",
            {},
        ),
        "test_results": source.get(
            "test_results",
            {},
        ),
        "debug_report": source.get(
            "debug_report",
            "",
        ),
        "messages": source.get(
            "messages",
            [],
        ),
        "iterations": source.get(
            "iterations",
            0,
        ),
        "agent_notes": source.get(
            "agent_notes",
            [],
        ),
    }

    new_execution_id = save_execution(
        replay_execution_data
    )

    try:
        from db.postgres import save_task_pg_sync

        save_task_pg_sync(
            new_execution_id,
            project_id=project_id,
            status="running",
        )
    except Exception as pg_err:
        print(
            f"[PostgreSQL Error] Failed to create replay task "
            f"{new_execution_id}: {pg_err}"
        )

    def run_replay(exec_id):
        from db.execution_service import update_execution

        try:
            from services.execution_stream import stream_manager
            from agents.graph import replay_agent_step

            replay_state = {
                "idea": idea,
                "project_id": project_id,
                "project_plan": source.get(
                    "project_plan",
                    {},
                ),
                "generated_code": _normalize_files(
                    source.get("generated_code")
                ),
                "initial_generated_code": _normalize_files(
                    source.get("initial_generated_code")
                ),
                "fixed_code": _normalize_files(
                    source.get("fixed_code")
                ),
                "project_path": (
                    str(get_project_dir(project_id))
                    if project_id
                    else ""
                ),
                "test_results": source.get(
                    "test_results",
                    {},
                ),
                "debug_report": source.get(
                    "debug_report",
                    "",
                ),
                "deployment_plan": source.get(
                    "deployment_plan",
                    {},
                ),
                "messages": source.get(
                    "messages",
                    [],
                ),
                "iterations": source.get(
                    "iterations",
                    0,
                ),
                "user_id": user_id,
                "agent_notes": list(
                    source.get(
                        "agent_notes",
                        [],
                    )
                    or []
                ),
                "execution_steps": [],
                "mode": "replay",
                "workspace_mode": source.get("workspace_mode", "manual"),
                "parent_execution_id": execution_id,
                "execution_id": exec_id,
            }

            try:
                from services.usage_tracker import UsageTracker

                UsageTracker.set_context(
                    user_id=user_id,
                    project_id=project_id or exec_id,
                    module="engineer",
                    operation="execution_replay",
                    agent=replay_step,
                )
            except Exception:
                pass

            res = replay_agent_step(
                replay_state,
                replay_step,
            )

            execution_steps = res.get(
                "execution_steps",
                [],
            )

            final_status = "completed"

            # A replayed tester can legitimately finish with FAIL while
            # the node itself completed. Preserve tester result separately.
            # A Python exception is what marks the replay execution failed.

            update_execution(
                exec_id,
                {
                    "status": final_status,
                    "updated_at": datetime.utcnow(),
                    "replay_source_execution_id": execution_id,
                    "replay_step": replay_step,
                    "execution_steps": execution_steps,
                    "project_plan": res.get(
                        "project_plan",
                        {},
                    ),
                    "generated_code": _normalize_files(
                        res.get("generated_code")
                    ),
                    "initial_generated_code": _normalize_files(
                        res.get("initial_generated_code")
                    ),
                    "fixed_code": _normalize_files(
                        res.get("fixed_code")
                    ),
                    "test_results": res.get(
                        "test_results",
                        {},
                    ),
                    "debug_report": res.get(
                        "debug_report",
                        "",
                    ),
                    "deployment_plan": res.get(
                        "deployment_plan",
                        {},
                    ),
                    "iterations": res.get(
                        "iterations",
                        0,
                    ),
                    "agent_notes": res.get(
                        "agent_notes",
                        [],
                    ),
                },
            )

            stream_manager.publish(
                exec_id,
                {
                    "type": "complete",
                    "data": {
                        "execution_id": exec_id,
                        "project_id": project_id,
                        "replay_step": replay_step,
                        "execution_steps": execution_steps,
                        "test_results": res.get(
                            "test_results",
                            {},
                        ),
                        "generated_code": _normalize_files(
                            res.get("generated_code")
                        ),
                        "fixed_code": _normalize_files(
                            res.get("fixed_code")
                        ),
                        "status": final_status,
                    },
                },
            )

        except Exception as exc:
            import traceback
            traceback.print_exc()

            update_execution(
                exec_id,
                {
                    "status": "failed",
                    "debug_report": f"Replay failed: {str(exc)}",
                    "updated_at": datetime.utcnow(),
                },
            )

            try:
                from services.execution_stream import stream_manager

                stream_manager.publish(
                    exec_id,
                    {
                        "type": "failed",
                        "error": str(exc),
                    },
                )
            except Exception:
                pass

    background_tasks.add_task(
        run_replay,
        new_execution_id,
    )

    return {
        "status": "running",
        "execution_id": new_execution_id,
        "project_id": project_id,
        "parent_execution_id": execution_id,
        "replay_step": replay_step,
    }


@router.get("/projects/{project_id}/history")
def project_history(project_id: str):
    return get_project_history(project_id)


@router.get("/projects/{project_id}/versions")
def project_versions(project_id: str):
    return get_project_versions(project_id)


@router.get("/executions/{execution_id}/diff")
def execution_diff(
    execution_id: str,
    compare: str = "fixed",
):
    execution = get_execution_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    generated = _normalize_files(execution.get("generated_code"))
    fixed = _normalize_files(execution.get("fixed_code"))

    if compare == "fixed":
        return compute_code_diff(generated, fixed)

    other = get_execution_by_id(compare)
    if not other:
        raise HTTPException(status_code=404, detail="Compare execution not found")

    other_files = (
        _normalize_files(other.get("fixed_code"))
        or _normalize_files(other.get("generated_code"))
    )
    current_files = fixed or generated
    return compute_code_diff(other_files, current_files)


@router.delete("/executions/{execution_id}")
def delete_execution_route(
    execution_id: str,
    user=Depends(get_optional_user),
):

    deleted = delete_execution(
        execution_id
    )

    if not deleted:

        raise HTTPException(
            status_code=404,
            detail="Execution not found"
        )

    return {

        "success": True,

        "message": "Project deleted successfully"

    }


@router.post("/executions/{execution_id}/stop")
@router.post("/executions/{execution_id}/cancel")
def stop_execution_route(
    execution_id: str,
    user=Depends(get_optional_user),
):
    from db.execution_service import update_execution, get_execution_by_id
    from datetime import datetime
    from services.execution_stream import stream_manager
    from db.mongo_client import db
    from bson import ObjectId

    # Update in MongoDB collections
    try:
        obj_id = ObjectId(execution_id)
        for coll_name in ["executions", "research_sessions", "automation_conversations", "conversations"]:
            db[coll_name].update_one(
                {"_id": obj_id},
                {"$set": {"status": "cancelled", "updated_at": datetime.utcnow()}}
            )
    except Exception as e:
        print(f"Error updating cancelled status in MongoDB for {execution_id}:", e)

    # Update task in PostgreSQL
    try:
        from db.postgres import update_task_pg_sync
        update_task_pg_sync(execution_id, status="cancelled", completed_at=datetime.utcnow())
    except Exception as pg_err:
        pass

    # Publish cancellation to active stream subscribers
    try:
        stream_manager.publish(str(execution_id), {
            "type": "failed",
            "error": "Execution stopped by user."
        })
    except Exception as pub_err:
        pass

    return {
        "success": True,
        "message": "Execution stopped successfully",
        "execution_id": execution_id
    }



class SaveFileRequest(BaseModel):
    path: str
    code: str


@router.post("/executions/{execution_id}/save-file")
def save_execution_file(
    execution_id: str,
    payload: SaveFileRequest,
):
    from db.execution_service import get_execution_by_id, update_execution
    from db.mongo_client import db, executions_collection, projects_collection
    from services.project_storage import get_project_dir
    from bson import ObjectId
    import shutil
    import os

    execution = None
    try:
        execution = get_execution_by_id(execution_id)
    except Exception:
        pass

    if not execution:
        try:
            execution = projects_collection.find_one({"_id": ObjectId(execution_id)})
        except Exception:
            pass

    if not execution:
        execution = executions_collection.find_one({"execution_id": execution_id}) or executions_collection.find_one({"project_id": execution_id})

    if not execution:
        raise HTTPException(status_code=404, detail="Project/Execution record not found")

    project_id = execution.get("project_id") or str(execution.get("_id", execution_id))

    fixed_files = _normalize_files(execution.get("fixed_code"))
    generated_files = _normalize_files(execution.get("generated_code"))
    has_fixed = len(fixed_files) > 0
    code_field = "fixed_code" if has_fixed else "generated_code"
    
    files = list(fixed_files if has_fixed else generated_files)
    
    file_found = False
    for f in files:
        if f.get("path") == payload.path:
            f["code"] = payload.code
            file_found = True
            break
            
    if not file_found:
        files.append({"path": payload.path, "code": payload.code})

    # Update in Mongo executions
    try:
        executions_collection.update_many(
            {"$or": [{"_id": ObjectId(execution_id) if ObjectId.is_valid(execution_id) else None}, {"project_id": project_id}, {"execution_id": execution_id}]},
            {"$set": {code_field: files}}
        )
    except Exception as e:
        print("[Save File DB update warning]:", e)

    # Update on disk
    try:
        project_path = str(get_project_dir(project_id))
        clean_rel = payload.path.lstrip("/\\.").replace("../", "")
        file_full_path = os.path.join(project_path, clean_rel)
        os.makedirs(os.path.dirname(file_full_path), exist_ok=True)
        with open(file_full_path, "w", encoding="utf-8") as f:
             f.write(payload.code)

        shutil.make_archive(
            project_path,
            "zip",
            project_path
        )
    except Exception as disk_err:
        print("[Save File Disk write warning]:", disk_err)

    return {
        "success": True,
        "message": f"File {payload.path} saved successfully"
    }

@router.get("/{execution_id}/stream")
async def stream_execution(execution_id: str, user=Depends(get_optional_user)):
    from services.execution_stream import stream_manager
    
    # Check all collections for this ID
    from db.mongo_client import db
    from bson import ObjectId
    execution = None
    try:
        obj_id = ObjectId(execution_id)
        for coll_name in ["executions", "research_sessions", "automation_conversations", "conversations"]:
            doc = db[coll_name].find_one({"_id": obj_id})
            if doc:
                doc["_id"] = str(doc["_id"])
                if "execution_steps" not in doc and "timeline" in doc:
                    doc["execution_steps"] = doc["timeline"]
                execution = doc
                break
    except Exception:
        pass

    if not execution:
        raise HTTPException(status_code=404, detail="Execution/Session not found")

    async def event_generator():
        # 1. Subscribe first to queue to ensure we catch any live steps that occur during DB check
        queue = stream_manager.subscribe(execution_id)
        
        # 2. Retrieve latest execution database snapshot
        from db.mongo_client import db
        from bson import ObjectId
        current_execution = None
        try:
            obj_id = ObjectId(execution_id)
            for coll_name in ["executions", "research_sessions", "automation_conversations", "conversations"]:
                doc = db[coll_name].find_one({"_id": obj_id})
                if doc:
                    doc["_id"] = str(doc["_id"])
                    if "execution_steps" not in doc and "timeline" in doc:
                        doc["execution_steps"] = doc["timeline"]
                    current_execution = doc
                    break
        except Exception:
            pass

        if not current_execution:
            current_execution = execution

        past_steps = current_execution.get("execution_steps", [])
        past_step_keys = set()

        def get_step_key(st):
            return f"{st.get('agent')}-{st.get('step')}-{st.get('status')}-{st.get('message')}"

        # 3. Yield all past steps
        for step in past_steps:
            past_step_keys.add(get_step_key(step))
            yield f"data: {json.dumps({'type': 'step', 'data': step})}\n\n"

        # 4. Check if already complete
        if current_execution.get("status") in ["completed", "failed"]:
            yield f"data: {json.dumps({'type': 'complete', 'data': current_execution})}\n\n"
            stream_manager.unsubscribe(execution_id, queue)
            return

        # 5. Listen to queue and deduplicate against past steps
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=180.0)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue

                if event.get("type") == "step":
                    step_key = get_step_key(event.get("data", {}))
                    if step_key in past_step_keys:
                        continue
                    past_step_keys.add(step_key)

                yield f"data: {json.dumps(event)}\n\n"

                if event.get("type") in ["complete", "failed"]:
                    break
        except Exception as e:
            print(f"SSE stream exception for {execution_id}:", e)
        finally:
            stream_manager.unsubscribe(execution_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


class RunCommandRequest(BaseModel):
    command: str


class ApplyTerminalFixRequest(BaseModel):
    fix_type: str  # "command" or "code"
    fix_command: str | None = None
    files_to_fix: list[dict] | None = None  # [{'path': ..., 'code': ...}]


@router.post("/executions/{execution_id}/run-command")
def run_command_in_workspace(
    execution_id: str,
    payload: RunCommandRequest,
    user=Depends(get_current_user),
):
    from db.execution_service import get_execution_by_id
    from services.terminal_service import execute_workspace_command

    execution = get_execution_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    if execution.get("user_id") != user.get("sub"):
        raise HTTPException(status_code=404, detail="Execution not found")

    project_id = execution.get("project_id")
    if not project_id:
        raise HTTPException(status_code=400, detail="Project ID missing in execution")

    result = execute_workspace_command(project_id, payload.command)
    return result


@router.post("/executions/{execution_id}/apply-terminal-fix")
def apply_terminal_fix(
    execution_id: str,
    payload: ApplyTerminalFixRequest,
    user=Depends(get_current_user),
):
    from db.execution_service import get_execution_by_id, update_execution
    from services.project_storage import get_project_dir
    from services.terminal_service import execute_workspace_command
    import os

    execution = get_execution_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    if execution.get("user_id") != user.get("sub"):
        raise HTTPException(status_code=404, detail="Execution not found")

    project_id = execution.get("project_id")
    if not project_id:
        raise HTTPException(status_code=400, detail="Project ID missing in execution")

    project_path = get_project_dir(project_id)

    if payload.fix_type == "command":
        if not payload.fix_command:
            raise HTTPException(status_code=400, detail="fix_command required for command type fix")
        # Run fix command (e.g. npm install express)
        result = execute_workspace_command(project_id, payload.fix_command)
        return {
            "success": result["exit_code"] == 0,
            "exit_code": result["exit_code"],
            "stdout": result["stdout"],
            "stderr": result["stderr"]
        }

    elif payload.fix_type == "code":
        if not payload.files_to_fix:
            raise HTTPException(status_code=400, detail="files_to_fix required for code type fix")

        # Write corrected files to disk and update database
        fixed_files = _normalize_files(execution.get("fixed_code"))
        generated_files = _normalize_files(execution.get("generated_code"))
        has_fixed = len(fixed_files) > 0
        code_field = "fixed_code" if has_fixed else "generated_code"
        db_files = list(fixed_files if has_fixed else generated_files)

        for file_fix in payload.files_to_fix:
            rel_path = file_fix.get("path")
            new_code = file_fix.get("code")

            # Write file to disk
            from services.project_storage import resolve_project_file
            try:
                file_full_path = resolve_project_file(project_id, rel_path)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid project file path") from exc
            os.makedirs(os.path.dirname(file_full_path), exist_ok=True)
            with open(file_full_path, "w", encoding="utf-8") as f:
                f.write(new_code)

            # Update files list in DB
            found = False
            for f in db_files:
                if f.get("path") == rel_path:
                    f["code"] = new_code
                    found = True
                    break
            if not found:
                db_files.append({"path": rel_path, "code": new_code})

        db_updated = update_execution(execution_id, {code_field: db_files})
        if not db_updated:
             raise HTTPException(status_code=500, detail="Failed to update execution files in database")

        return {
            "success": True,
            "message": f"Successfully applied code modifications to {len(payload.files_to_fix)} file(s)"
        }

    else:
        raise HTTPException(status_code=400, detail="Invalid fix type")
