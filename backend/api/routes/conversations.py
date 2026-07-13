from fastapi import APIRouter, Depends
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional
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

@router.get("/")
def get_conversations(agent_type: str | None = None, user=Depends(get_optional_user)):
    user_id = user.get("sub")
    if not user_id or user_id == "system":
        return []
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
    user_id = user.get("sub")
    if conv.get("user_id") not in ("system", "anonymous") and conv.get("user_id") != user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")
    return conv

@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: str):
    conversations_collection.delete_one(
        {"_id": ObjectId(conversation_id)}
    )
    return {"message": "Conversation Deleted"}

@router.post("/{conversation_id}/messages")
def add_message_route(conversation_id: str, req: MessageCreateRequest):
    add_message(conversation_id, req.role, req.content, attachments=req.attachments)
    return {"success": True}

class ConversationCreateRequest(BaseModel):
    user_id: str
    agent_type: str
    title: str

@router.post("/")
def create_conversation_route(req: ConversationCreateRequest):
    from db.conversation_service import create_conversation
    conv_id = create_conversation(req.user_id, req.agent_type, req.title)
    return {"_id": conv_id}