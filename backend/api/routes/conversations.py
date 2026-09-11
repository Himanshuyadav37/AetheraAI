from fastapi import APIRouter, Depends
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional, Any
from db.mongo_client import conversations_collection
from db.conversation_service import (
    get_all_conversations,
    get_conversation_by_id,
    add_message
)
from auth.optional_auth import get_optional_user

router = APIRouter()

class MessageCreateRequest(BaseModel):
    role: str
    content: str
    attachments: Optional[list] = None
    result: Optional[Any] = None
    metadata: Optional[Any] = None

@router.get("/")
def get_conversations(agent_type: str | None = None, user=Depends(get_optional_user)):
    user_id = user.get("sub") or user.get("id") or "system"
    return get_all_conversations(
        user_id=user_id,
        agent_type=agent_type
    )

@router.get("/{conversation_id}")
def get_conversation(conversation_id: str, user=Depends(get_optional_user)):
    conv = get_conversation_by_id(conversation_id)
    if not conv:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Conversation not found")
    user_id = user.get("sub") or user.get("id") or "system"
    if conv.get("user_id") not in ("system", "anonymous") and user_id != "system" and conv.get("user_id") != user_id:
        pass
    return conv

@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: str):
    from db.mongo_client import db
    # 1. Try ObjectId deletion
    try:
        obj_id = ObjectId(conversation_id)
        conversations_collection.delete_one({"_id": obj_id})
        db["automation_conversations"].delete_one({"_id": obj_id})
        db["research_sessions"].delete_one({"_id": obj_id})
        db["executions"].delete_one({"_id": obj_id})
    except Exception:
        pass

    # 2. Try raw string ID deletion
    try:
        conversations_collection.delete_one({"_id": conversation_id})
        conversations_collection.delete_one({"id": conversation_id})
        db["automation_conversations"].delete_one({"_id": conversation_id})
        db["automation_conversations"].delete_one({"id": conversation_id})
        db["research_sessions"].delete_one({"_id": conversation_id})
        db["research_sessions"].delete_one({"id": conversation_id})
        db["executions"].delete_one({"_id": conversation_id})
        db["executions"].delete_one({"id": conversation_id})
        db["executions"].delete_one({"session_id": conversation_id})
    except Exception:
        pass

    return {"message": "Conversation Deleted"}

@router.post("/{conversation_id}/messages")
def add_message_route(conversation_id: str, req: MessageCreateRequest):
    add_message(
        conversation_id,
        req.role,
        req.content,
        attachments=req.attachments,
        result=req.result
    )
    return {"success": True}

class ConversationCreateRequest(BaseModel):
    user_id: Optional[str] = "system"
    agent_type: str
    title: str

@router.post("/")
def create_conversation_route(req: ConversationCreateRequest, user=Depends(get_optional_user)):
    from db.conversation_service import create_conversation
    token_user_id = user.get("sub") or user.get("id")
    effective_user_id = token_user_id if (token_user_id and token_user_id != "system") else (req.user_id or "system")
    conv_id = create_conversation(effective_user_id, req.agent_type, req.title)
    return {"_id": conv_id}