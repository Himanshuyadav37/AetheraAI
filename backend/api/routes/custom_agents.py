from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging

from auth.dependencies import get_current_user
from db.mongo_client import db
from llm.groq_client import get_client as get_groq_client

logger = logging.getLogger("custom_agents")

router = APIRouter(prefix="/api/custom-agents", tags=["Custom Agents"])

# Collections
custom_agents_coll = db["custom_agents"]
agent_chats_coll = db["custom_agent_chats"]

# Pydantic Schemas
class CustomAgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = ""
    avatar: Optional[str] = "🤖"
    category: Optional[str] = "general"
    model: Optional[str] = "llama-3.3-70b-versatile"
    system_prompt: str = Field(..., min_length=5)
    temperature: Optional[float] = 0.7
    attached_kb_ids: Optional[List[str]] = []
    starter_prompts: Optional[List[str]] = []
    webhook_url: Optional[str] = ""
    is_public: Optional[bool] = True
    embed_theme: Optional[Dict[str, Any]] = {
        "primary_color": "#ffffff",
        "position": "bottom-right",
        "greeting": "Hello! How can I assist you today?"
    }

class CustomAgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar: Optional[str] = None
    category: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    attached_kb_ids: Optional[List[str]] = None
    starter_prompts: Optional[List[str]] = None
    webhook_url: Optional[str] = None
    is_public: Optional[bool] = None
    embed_theme: Optional[Dict[str, Any]] = None

class CustomAgentChatRequest(BaseModel):
    prompt: str
    conversation_id: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = []

def serialize_agent(agent: dict) -> dict:
    if not agent:
        return {}
    agent["id"] = str(agent.get("_id", ""))
    if "_id" in agent:
        del agent["_id"]
    return agent

def extract_user_info(user):
    if isinstance(user, dict):
        user_id = str(user.get("sub") or user.get("id") or "")
        user_email = user.get("email", "")
    else:
        user_id = str(getattr(user, "id", getattr(user, "sub", "")))
        user_email = getattr(user, "email", "")
    return user_id, user_email

# 1. Create a new custom agent
@router.post("")
async def create_custom_agent(payload: CustomAgentCreate, user=Depends(get_current_user)):
    user_id, user_email = extract_user_info(user)

    now_str = datetime.utcnow().isoformat()
    agent_doc = {
        "creator_id": user_id,
        "creator_email": user_email,
        "name": payload.name.strip(),
        "description": payload.description.strip(),
        "avatar": payload.avatar,
        "category": payload.category,
        "model": payload.model,
        "system_prompt": payload.system_prompt.strip(),
        "temperature": payload.temperature,
        "attached_kb_ids": payload.attached_kb_ids or [],
        "starter_prompts": [p.strip() for p in payload.starter_prompts if p.strip()] if payload.starter_prompts else [],
        "webhook_url": payload.webhook_url.strip() if payload.webhook_url else "",
        "is_public": payload.is_public if payload.is_public is not None else True,
        "embed_theme": payload.embed_theme or {},
        "usage_count": 0,
        "created_at": now_str,
        "updated_at": now_str
    }

    res = custom_agents_coll.insert_one(agent_doc)
    agent_doc["_id"] = res.inserted_id
    return serialize_agent(agent_doc)

# 2. List all agents created by current user
@router.get("")
async def list_my_custom_agents(user=Depends(get_current_user)):
    user_id, user_email = extract_user_info(user)

    query = {}
    if user_id or user_email:
        conditions = []
        if user_id:
            conditions.append({"creator_id": user_id})
        if user_email:
            conditions.append({"creator_email": user_email})
        query = {"$or": conditions}

    cursor = custom_agents_coll.find(query).sort("created_at", -1)

    agents = [serialize_agent(doc) for doc in cursor]
    return agents

# 3. Get single custom agent details
@router.get("/{agent_id}")
async def get_custom_agent(agent_id: str, user=Depends(get_current_user)):
    try:
        obj_id = ObjectId(agent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Agent ID")

    agent = custom_agents_coll.find_one({"_id": obj_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Custom Agent not found")

    return serialize_agent(agent)

# 4. Update custom agent
@router.put("/{agent_id}")
async def update_custom_agent(agent_id: str, payload: CustomAgentUpdate, user=Depends(get_current_user)):
    try:
        obj_id = ObjectId(agent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Agent ID")

    agent = custom_agents_coll.find_one({"_id": obj_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Custom Agent not found")

    user_id, user_email = extract_user_info(user)
    if agent.get("creator_id") and agent.get("creator_id") != user_id and agent.get("creator_email") != user_email:
        raise HTTPException(status_code=403, detail="Not authorized to edit this agent")

    updates = {k: v for k, v in payload.dict().items() if v is not None}
    updates["updated_at"] = datetime.utcnow().isoformat()

    custom_agents_coll.update_one({"_id": obj_id}, {"$set": updates})
    updated = custom_agents_coll.find_one({"_id": obj_id})
    return serialize_agent(updated)

# 5. Delete custom agent
@router.delete("/{agent_id}")
async def delete_custom_agent(agent_id: str, user=Depends(get_current_user)):
    try:
        obj_id = ObjectId(agent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Agent ID")

    agent = custom_agents_coll.find_one({"_id": obj_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Custom Agent not found")

    user_id, user_email = extract_user_info(user)
    if agent.get("creator_id") and agent.get("creator_id") != user_id and agent.get("creator_email") != user_email:
        raise HTTPException(status_code=403, detail="Not authorized to delete this agent")

    custom_agents_coll.delete_one({"_id": obj_id})
    return {"success": True, "message": "Custom Agent deleted successfully"}

# 6. Public metadata endpoint for website embed widgets & public links (No auth required)
@router.get("/public/{agent_id}")
async def get_public_agent_meta(agent_id: str):
    try:
        obj_id = ObjectId(agent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Agent ID")

    agent = custom_agents_coll.find_one({"_id": obj_id, "is_public": True})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent is not public or does not exist")

    return {
        "id": str(agent["_id"]),
        "name": agent.get("name", "AI Assistant"),
        "description": agent.get("description", ""),
        "avatar": agent.get("avatar", "🤖"),
        "starter_prompts": agent.get("starter_prompts", []),
        "embed_theme": agent.get("embed_theme", {})
    }

# 7. Execute chat with custom agent (Supports RAG memory & custom persona)
@router.post("/{agent_id}/chat")
async def chat_with_custom_agent(agent_id: str, req: CustomAgentChatRequest):
    try:
        obj_id = ObjectId(agent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Agent ID")

    agent = custom_agents_coll.find_one({"_id": obj_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Custom Agent not found")

    # Increment usage counter
    custom_agents_coll.update_one({"_id": obj_id}, {"$inc": {"usage_count": 1}})

    # Fetch RAG context if Knowledge Bases are attached
    rag_context = ""
    attached_kbs = agent.get("attached_kb_ids", [])
    if attached_kbs:
        try:
            # pyrefly: ignore [missing-import]
            from rag.vector_store import query_kb_vectors
            for kb_id in attached_kbs:
                res = query_kb_vectors(kb_id=kb_id, query_text=req.prompt, n_results=3)
                if res and "documents" in res and res["documents"]:
                    docs = res["documents"][0]
                    for doc in docs:
                        rag_context += f"\n---\n{doc}\n"
        except Exception as e:
            logger.warning(f"RAG search error in custom agent chat: {e}")

    # Formulate system instruction
    base_system = agent.get("system_prompt", "You are a helpful AI assistant.")
    full_system_prompt = f"{base_system}\n\n"
    if rag_context:
        full_system_prompt += f"### RELEVANT KNOWLEDGE BASE CONTEXT:\n{rag_context}\nAnswer the user based on the above knowledge when relevant."

    # Build message chain for LLM
    messages = [{"role": "system", "content": full_system_prompt}]
    for msg in req.history[-6:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": req.prompt})

    # Call LLM using the same working function as the rest of the app
    try:
        from llm.groq_client import generate_response

        # Build a single prompt string with system context for generate_response
        # (generate_response handles key rotation, caching & fallback internally)
        full_prompt = f"{full_system_prompt}\n\n"
        # Add conversation history
        for msg in req.history[-6:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                full_prompt += f"User: {content}\n"
            elif role == "assistant":
                full_prompt += f"Assistant: {content}\n"
        full_prompt += f"User: {req.prompt}\nAssistant:"

        reply = generate_response(full_prompt)
        tokens_used = len(full_prompt.split()) + len(reply.split())  # estimate

    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"[Custom Agent] Fatal LLM error for agent {agent_id}: {err}")
        raise HTTPException(status_code=500, detail=f"AI model error: {str(err)}")


    return {
        "reply": reply,
        "agent_name": agent.get("name"),
        "agent_avatar": agent.get("avatar"),
        "tokens_used": tokens_used,
        "model": agent.get("model", "llama-3.3-70b-versatile"),
        "rag_applied": bool(rag_context)
    }
