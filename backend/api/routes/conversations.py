from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional, Any
from db.mongo_client import conversations_collection
from db.conversation_service import (
    get_all_conversations,
    get_conversation_by_id,
    add_message
)
from auth.dependencies import get_current_user

router = APIRouter()

class MessageCreateRequest(BaseModel):
    role: str
    content: str
    attachments: Optional[list] = None
    result: Optional[Any] = None
    metadata: Optional[Any] = None

@router.get("/")
def get_conversations(agent_type: str | None = None, user=Depends(get_current_user)):
    user_id = user["sub"]
    return get_all_conversations(
        user_id=user_id,
        agent_type=agent_type
    )

@router.get("/{conversation_id}")
def get_conversation(conversation_id: str, user=Depends(get_current_user)):
    conv = get_conversation_by_id(conversation_id)
    if not conv:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Conversation not found")
    user_id = user["sub"]
    if conv.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: str, user=Depends(get_current_user)):
    from db.mongo_client import db
    conversation = None
    try:
        conversation = conversations_collection.find_one({"_id": ObjectId(conversation_id)})
    except Exception:
        pass
    if not conversation or conversation.get("user_id") != user["sub"]:
        raise HTTPException(status_code=404, detail="Conversation not found")
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
def add_message_route(conversation_id: str, req: MessageCreateRequest, user=Depends(get_current_user)):
    conversation = conversations_collection.find_one({"_id": ObjectId(conversation_id)})
    if not conversation or conversation.get("user_id") != user["sub"]:
        raise HTTPException(status_code=404, detail="Conversation not found")
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
def create_conversation_route(req: ConversationCreateRequest, user=Depends(get_current_user)):
    from db.conversation_service import create_conversation
    conv_id = create_conversation(user["sub"], req.agent_type, req.title)
    return {"_id": conv_id}
