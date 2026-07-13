

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
)

from db.project_version_service import (
    get_project_versions,
    compute_code_diff,
)

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

from agents.education.agent import (
    education_agent,
)

from agents.automation.router import (
    automation_agent,
)

router = APIRouter()


@router.post("/execute-project")
def execute_project(
    request: ProjectExecutionRequest,
    background_tasks: BackgroundTasks,
    user=Depends(get_optional_user),
):
    user_id = user.get("sub", "system")
    print("Agent Type =", request.agent_type)
    
    # Casual Greeting Check
    is_greeting = any(word in request.idea.lower().strip("?.!,") for word in ["hello", "hi", "hey", "greetings", "hii", "hy", "how are you"])
    if is_greeting and len(request.idea.strip()) < 15:
        # Create conversation if needed
        conv_id = request.conversation_id
        if not conv_id:
            if request.agent_type == "automation":
                from db.mongo_client import db
                from bson import ObjectId
                from datetime import datetime
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
                conv_id = create_conversation(user_id=user_id, agent_type=request.agent_type, title=request.idea[:60])
        
        # Save messages in history
        if request.agent_type == "automation":
            from db.mongo_client import db
            from bson import ObjectId
            from datetime import datetime
            user_msg = {"role": "user", "content": request.idea, "timestamp": datetime.utcnow().isoformat()}
            ai_msg = {
                "role": "assistant", 
                "content": "Hello! I am your Workflow Automation Agent. Tell me what services you want to connect (e.g., Slack, GitHub, Google Sheets) and what workflow you want to build!", 
                "timestamp": datetime.utcnow().isoformat()
            }
            db["automation_conversations"].update_one(
                {"_id": ObjectId(conv_id)},
                {"$push": {"messages": {"$each": [user_msg, ai_msg]}}}
            )
        else:
            from db.conversation_service import add_message
            add_message(conv_id, "user", request.idea)
            
            if request.agent_type == "engineer":
                msg_content = "Hello! I am your NexusAI Engineering Assistant. Please describe the project or script you would like me to build!"
            elif request.agent_type == "research":
                msg_content = "Hello! I am the NexusAI Research AI. What topic, technology, or market would you like me to research today?"
            else:
                msg_content = "Hi! This is NexusAI AI. How can I help you today?"
                
            add_message(conv_id, "assistant", msg_content)

        # Return response matching the respective agent
        if request.agent_type == "engineer":
            return {
                "agent": "engineer",
                "conversation_id": conv_id,
                "message": "Hello! I am your NexusAI Engineering Assistant. Please describe the project or script you would like me to build!",
                "result": None
            }
        elif request.agent_type == "research":
            return {
                "conversation_id": conv_id,
                "content": "Hello! I am the NexusAI Research AI. What topic, technology, or market would you like me to research today?",
                "result": {
                    "conversation_id": conv_id,
                    "report": "Hello! I am the NexusAI Research AI. What topic, technology, or market would you like me to research today?",
                    "queries": [],
                    "sources": []
                }
            }
        elif request.agent_type == "automation":
            return {
                "conversation_id": conv_id,
                "content": "Hello! I am your Workflow Automation Agent. Tell me what services you want to connect (e.g., Slack, GitHub, Google Sheets) and what workflow you want to build!",
                "result": {
                    "title": "Automation Greeting",
                    "description": "Casual Greeting",
                    "platform": "n8n",
                    "nodes": [],
                    "steps": []
                }
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

        from db.conversation_service import add_message
        user_msg_content = request.idea

        # Pre-generate or retrieve execution ID
        from db.execution_service import save_execution
        from datetime import datetime

        parent_id = None
        if request.mode == "continue":
            parent_id = request.execution_id or request.project_id

        # Insert placeholder execution to MongoDB with running state
        execution_data = {
            "user_id": user_id,
            "project_id": request.project_id or "",
            "idea": request.idea,
            "mode": request.mode,
            "parent_execution_id": parent_id or "",
            "status": "running",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "execution_steps": [],
            "project_plan": {},
            "generated_code": {},
            "fixed_code": {},
            "deployment_plan": {},
            "iterations": 0
        }
        execution_id = save_execution(execution_data)

        # Log clean user message to conversation history
        add_message(conv_id, "user", user_msg_content, attachments=request.attachments)

        # Run generate_project in background task
        def run_generation(exec_id, parent_id_override):
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
                plan = res.get("project_plan", {})
                title = plan.get("project_name", "NexusAI Project")
                desc = plan.get("description", "Code generation completed.")
                
                assistant_content = f"""# 🛠️ Generated Project: {title}

{desc}

**Iterations:** {res.get('iterations', 0)}
**Status:** {res.get('status', 'completed')}
**Path:** {res.get('project_path', '')}
"""
                add_message(conv_id, "assistant", assistant_content, result=res)
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

        background_tasks.add_task(run_generation, execution_id, parent_id)

        return {
            "status": "running",
            "execution_id": execution_id,
            "conversation_id": conv_id
        }

    elif selected_agent == "conversational":

        return conversational_agent(
            request.idea,
            request.conversation_id,
            user_id=user_id,
            connectors=request.connectors,
        )

    elif selected_agent == "research":

        res = run_research_agent(
            prompt=request.idea,
            session_id=request.conversation_id,
            user_id=user_id,
            connectors=request.connectors,
        )
        return {
            "conversation_id": res.get("conversation_id"),
            "content": res.get("report"),
            "result": res
        }


    elif selected_agent == "education":

        return education_agent(
            prompt=request.idea,
            connectors=request.connectors,
        )

    elif selected_agent == "automation":
        from bson import ObjectId
        from datetime import datetime
        from db.mongo_client import db

        result = automation_agent(
            prompt=request.idea,
            platform_override=None,
        )

        # Build a beautiful markdown summary for the chat message content
        md_parts = []
        md_parts.append(f"# 🤖 {result.get('title', 'Automation Workflow')}\n")
        md_parts.append(f"{result.get('description', '')}\n")
        md_parts.append(f"**Platform:** {result.get('platform', 'n8n')}\n")
        
        if result.get("workflow_ascii"):
            md_parts.append("### 📊 Workflow Graph")
            md_parts.append("```text")
            md_parts.append(result.get("workflow_ascii"))
            md_parts.append("```\n")
            
        nodes = result.get("nodes", [])
        if nodes:
            md_parts.append("### 🧩 Nodes & Components")
            for node in nodes:
                node_type_label = f" *({node.get('type', '')})*" if node.get('type') else ""
                md_parts.append(f"- **{node.get('name', 'Node')}**{node_type_label}: {node.get('purpose', '')}")
            md_parts.append("")
            
        steps = result.get("steps", [])
        if steps:
            md_parts.append("### 📝 Execution Steps")
            for step in steps:
                md_parts.append(f"{step.get('step', 1)}. **{step.get('title', '')}** — {step.get('description', '')}")
            md_parts.append("")

        rich_content = "\n".join(md_parts)

        # ── Persist to MongoDB ──────────────────────────────────────────
        automation_conversations = db["automation_conversations"]
        user_message = {
            "role": "user",
            "content": request.idea,
            "timestamp": datetime.utcnow().isoformat(),
        }
        ai_message = {
            "role": "assistant",
            "content": rich_content,
            "result": result,
            "timestamp": datetime.utcnow().isoformat(),
        }

        conversation_id = request.conversation_id
        if conversation_id:
            automation_conversations.update_one(
                {"_id": ObjectId(conversation_id)},
                {
                    "$push": {"messages": {"$each": [user_message, ai_message]}},
                    "$set": {"updated_at": datetime.utcnow()},
                },
            )
        else:
            if user_id and user_id not in ("system", "anonymous"):
                from db.mongo_client import get_user_limit
                limit = get_user_limit(user_id)
                existing_count = automation_conversations.count_documents({"user_id": user_id, "agent_type": "automation"})
                if existing_count >= limit:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Limit exceeded: You are allowed only {limit} conversation(s) in Automation AI. Please delete an existing one first."
                    )
            conv_doc = {
                "user_id": user_id,
                "agent_type": "automation",
                "title": result.get("title", request.idea[:50]),
                "messages": [user_message, ai_message],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            insert_result = automation_conversations.insert_one(conv_doc)
            conversation_id = str(insert_result.inserted_id)

        return {
            "conversation_id": conversation_id,
            "content": rich_content,
            "result": result
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
    if not request.project_id and not request.execution_id:
        raise HTTPException(
            status_code=400,
            detail="project_id or execution_id required",
        )

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

    generated = execution.get("generated_code", {}).get("files", [])
    fixed = execution.get("fixed_code", {}).get("files", [])

    if compare == "fixed":
        return compute_code_diff(generated, fixed)

    other = get_execution_by_id(compare)
    if not other:
        raise HTTPException(status_code=404, detail="Compare execution not found")

    other_files = (
        other.get("fixed_code", {}).get("files")
        or other.get("generated_code", {}).get("files", [])
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


from pydantic import BaseModel

class SaveFileRequest(BaseModel):
    path: str
    code: str


@router.post("/executions/{execution_id}/save-file")
def save_execution_file(
    execution_id: str,
    payload: SaveFileRequest,
):
    from db.execution_service import get_execution_by_id, update_execution
    from services.project_storage import get_project_dir
    import shutil
    import os

    execution = get_execution_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    project_id = execution.get("project_id")
    if not project_id:
         raise HTTPException(status_code=400, detail="Project ID missing in execution")

    has_fixed = len(execution.get("fixed_code", {}).get("files", [])) > 0
    code_field = "fixed_code" if has_fixed else "generated_code"
    
    files = execution.get(code_field, {}).get("files", [])
    
    file_found = False
    for f in files:
        if f.get("path") == payload.path:
            f["code"] = payload.code
            file_found = True
            break
            
    if not file_found:
        files.append({"path": payload.path, "code": payload.code})

    db_updated = update_execution(execution_id, {f"{code_field}.files": files})
    if not db_updated:
         raise HTTPException(status_code=500, detail="Failed to update execution in database")

    project_path = str(get_project_dir(project_id))
    file_full_path = os.path.join(project_path, payload.path)
    os.makedirs(os.path.dirname(file_full_path), exist_ok=True)
    with open(file_full_path, "w", encoding="utf-8") as f:
         f.write(payload.code)

    shutil.make_archive(
        project_path,
        "zip",
        project_path
    )

    return {
        "success": True,
        "message": f"File {payload.path} saved successfully"
    }

@router.get("/{execution_id}/stream")
async def stream_execution(execution_id: str, user=Depends(get_optional_user)):
    from services.execution_stream import stream_manager
    from db.execution_service import get_execution_by_id

    execution = get_execution_by_id(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    async def event_generator():
        # 1. Send past steps if they exist in the DB (to catch up on reconnects)
        past_steps = execution.get("execution_steps", [])
        for step in past_steps:
            yield f"data: {json.dumps({'type': 'step', 'data': step})}\n\n"

        # 2. Check if already complete
        if execution.get("status") in ["completed", "failed"]:
            yield f"data: {json.dumps({'type': 'complete', 'data': execution})}\n\n"
            return

        # 3. Subscribe to live stream
        queue = stream_manager.subscribe(execution_id)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=180.0)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue

                yield f"data: {json.dumps(event)}\n\n"

                if event.get("type") in ["complete", "failed"]:
                    break
        except Exception as e:
            print(f"SSE stream exception for {execution_id}:", e)
        finally:
            stream_manager.unsubscribe(execution_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")