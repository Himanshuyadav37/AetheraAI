"""
NexusAI AI - Automation API Route

Endpoints
---------
POST /automation/generate  — full JSON response
POST /automation/stream    — SSE streaming response (token by token)
GET  /automation/conversations — list automation conversation history
POST /automation/conversations — create a new automation conversation
GET  /automation/conversations/{id} — get single conversation with messages
DELETE /automation/conversations/{id} — delete a conversation
"""

import json
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from agents.automation.router import automation_agent
from agents.automation.models import AutomationRequest
from auth.optional_auth import get_optional_user
from db.mongo_client import db

router = APIRouter()

# ── Collection for automation conversations ────────────────────────────────
automation_conversations = db["automation_conversations"]


# ============================================================
# Helper — serialize ObjectId
# ============================================================

def _serialize(doc: dict) -> dict:
    """Convert ObjectId fields to strings for JSON serialisation."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ============================================================
# POST /automation/generate
# Full synchronous response
# ============================================================

@router.post("/generate")
async def automation_generate(
    request: AutomationRequest,
    user=Depends(get_optional_user),
):
    """
    Generate a complete automation workflow from a natural language prompt.
    Returns the full result in a single JSON response.
    """
    try:
        from services.agent_tools import intercept_mcp_tool_call
        intercepted = intercept_mcp_tool_call(
            prompt=request.prompt,
            agent_type="automation",
            conversation_id=request.conversation_id,
            connectors=request.connectors
        )
        if intercepted:
            return intercepted

        result = automation_agent(
            prompt=request.prompt,
            platform_override=request.platform,
        )

        # ── Persist to MongoDB ──────────────────────────────────────────
        user_id = user.get("sub") if user and user.get("sub") != "system" else "anonymous"
        conversation_id = request.conversation_id

        user_message = {
            "role": "user",
            "content": request.prompt,
            "timestamp": datetime.utcnow().isoformat(),
        }
        ai_message = {
            "role": "assistant",
            "content": result.get("title", "Automation generated"),
            "result": result,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if conversation_id:
            # Append to existing conversation
            automation_conversations.update_one(
                {"_id": ObjectId(conversation_id)},
                {
                    "$push": {"messages": {"$each": [user_message, ai_message]}},
                    "$set": {"updated_at": datetime.utcnow()},
                },
            )
        else:
            # Check limit
            if user_id and user_id not in ("system", "anonymous"):
                from db.mongo_client import get_user_limit
                limit = get_user_limit(user_id)
                existing_count = automation_conversations.count_documents({"user_id": user_id, "agent_type": "automation"})
                if existing_count >= limit:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Limit exceeded: You are allowed only {limit} conversation(s) in Automation AI. Please delete an existing one first."
                    )
            # Create new conversation
            conv_doc = {
                "user_id": user_id,
                "agent_type": "automation",
                "title": result.get("title", request.prompt[:50]),
                "messages": [user_message, ai_message],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            insert_result = automation_conversations.insert_one(conv_doc)
            conversation_id = str(insert_result.inserted_id)

        result["conversation_id"] = conversation_id
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# POST /automation/stream
# SSE streaming — same pattern as Education AI
# ============================================================

@router.post("/stream")
async def automation_stream(
    request: AutomationRequest,
    user=Depends(get_optional_user),
):
    """
    Stream the automation workflow generation token by token (SSE).
    Sends metadata first, then streams the full result JSON, then [DONE].
    """
    try:
        result = automation_agent(
            prompt=request.prompt,
            platform_override=request.platform,
        )

        # ── Persist to MongoDB ──────────────────────────────────────────
        user_id = user.get("sub") if user and user.get("sub") != "system" else "anonymous"
        conversation_id = request.conversation_id

        user_message = {
            "role": "user",
            "content": request.prompt,
            "timestamp": datetime.utcnow().isoformat(),
        }
        # For streaming, store the full result object on the AI message
        ai_message = {
            "role": "assistant",
            "content": result.get("title", "Automation generated"),
            "result": result,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if conversation_id:
            automation_conversations.update_one(
                {"_id": ObjectId(conversation_id)},
                {
                    "$push": {"messages": {"$each": [user_message, ai_message]}},
                    "$set": {"updated_at": datetime.utcnow()},
                },
            )
        else:
            # Check limit
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
                "title": result.get("title", request.prompt[:50]),
                "messages": [user_message, ai_message],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            insert_result = automation_conversations.insert_one(conv_doc)
            conversation_id = str(insert_result.inserted_id)

        result["conversation_id"] = conversation_id

        def generate():
            # ── 1. Send metadata event ──────────────────────────────
            yield f"data: {json.dumps({'meta': {'title': result.get('title', 'Automation AI'), 'platform': result.get('platform', 'n8n'), 'conversation_id': conversation_id}})}\\n\\n"

            # ── 2. Stream full result as chunked tokens ─────────────
            # Serialize the entire result to JSON and stream in chunks
            # so the frontend can progressively parse it
            full_payload = json.dumps({"result": result})
            chunk_size = 64

            for i in range(0, len(full_payload), chunk_size):
                chunk = full_payload[i: i + chunk_size]
                yield f"data: {json.dumps({'token': chunk})}\\n\\n"

            # ── 3. Done ─────────────────────────────────────────────
            yield "data: [DONE]\\n\\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# GET /automation/conversations
# List all automation conversations for the current user
# ============================================================

@router.get("/conversations")
def list_automation_conversations(user=Depends(get_optional_user)):
    """Return all automation conversations (without messages) sorted by updated_at."""
    user_id = user.get("sub") if user else None
    if not user_id or user_id == "system":
        return []
    query = {"user_id": user_id}

    conversations = list(
        automation_conversations.find(query, {"messages": 0}).sort("updated_at", -1).limit(50)
    )
    return [_serialize(c) for c in conversations]


# ============================================================
# GET /automation/conversations/{conversation_id}
# Get a single conversation with all messages
# ============================================================

@router.get("/conversations/{conversation_id}")
def get_automation_conversation(conversation_id: str, user=Depends(get_optional_user)):
    """Return a single automation conversation including all messages."""
    try:
        doc = automation_conversations.find_one({"_id": ObjectId(conversation_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation ID.")

    if not doc:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    user_id = user.get("sub") if user else None
    if doc.get("user_id") not in ("system", "anonymous") and doc.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return _serialize(doc)


# ============================================================
# DELETE /automation/conversations/{conversation_id}
# Delete a conversation
# ============================================================

@router.delete("/conversations/{conversation_id}")
def delete_automation_conversation(conversation_id: str):
    """Delete an automation conversation by ID."""
    try:
        automation_conversations.delete_one({"_id": ObjectId(conversation_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation ID.")
    return {"message": "Conversation deleted."}
