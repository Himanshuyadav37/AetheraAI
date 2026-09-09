from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import secrets
import hashlib
import logging

from auth.dependencies import get_current_user
from db.mongo_client import db
from llm.groq_client import get_client as get_groq_client

logger = logging.getLogger("developer_api")

router = APIRouter(tags=["Developer API Gateway"])

api_keys_coll = db["developer_api_keys"]
api_usage_coll = db["developer_api_usage"]

class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    rate_limit_rpm: Optional[int] = 60
    expires_in_days: Optional[int] = 365

class OpenAIChatCompletionRequest(BaseModel):
    model: Optional[str] = "llama-3.3-70b-versatile"
    messages: List[Dict[str, str]]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2048

class RagQueryRequest(BaseModel):
    query: str
    kb_id: Optional[str] = None
    top_k: Optional[int] = 3

def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()

def verify_api_key_auth(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header. Expected: 'Bearer nx_live_...'")
    
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format. Expected: 'Bearer nx_live_...'")
    
    raw_key = parts[1]
    hashed = hash_key(raw_key)
    
    key_doc = api_keys_coll.find_one({"key_hash": hashed, "is_active": True})
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid or revoked API Key")
    
    # Check expiration
    if key_doc.get("expires_at"):
        exp = datetime.fromisoformat(key_doc["expires_at"])
        if datetime.utcnow() > exp:
            raise HTTPException(status_code=401, detail="API Key has expired")
    
    # Increment total requests
    api_keys_coll.update_one({"_id": key_doc["_id"]}, {"$inc": {"total_requests": 1}, "$set": {"last_used_at": datetime.utcnow().isoformat()}})
    return key_doc

# =========================================================================
# Management Endpoints (Requires User Session Auth)
# =========================================================================

@router.get("/api/developer/keys")
async def list_api_keys(user=Depends(get_current_user)):
    user_email = user.email if hasattr(user, "email") else user.get("email", "")
    cursor = api_keys_coll.find({"user_email": user_email}).sort("created_at", -1)
    
    result = []
    for doc in cursor:
        result.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", "Default Key"),
            "prefix": doc.get("prefix", "nx_live_..."),
            "created_at": doc.get("created_at"),
            "last_used_at": doc.get("last_used_at"),
            "total_requests": doc.get("total_requests", 0),
            "rate_limit_rpm": doc.get("rate_limit_rpm", 60),
            "is_active": doc.get("is_active", True)
        })
    return result

@router.post("/api/developer/keys")
async def generate_api_key(payload: ApiKeyCreate, user=Depends(get_current_user)):
    user_email = user.email if hasattr(user, "email") else user.get("email", "")
    user_id = str(user.id if hasattr(user, "id") else user.get("id", ""))

    random_secret = secrets.token_urlsafe(32)
    raw_key = f"nx_live_{random_secret}"
    key_hash = hash_key(raw_key)
    prefix = f"nx_live_{random_secret[:6]}..."

    now = datetime.utcnow()
    expires_at = (now + timedelta(days=payload.expires_in_days or 365)).isoformat()

    doc = {
        "user_id": user_id,
        "user_email": user_email,
        "name": payload.name.strip(),
        "key_hash": key_hash,
        "prefix": prefix,
        "rate_limit_rpm": payload.rate_limit_rpm or 60,
        "total_requests": 0,
        "is_active": True,
        "created_at": now.isoformat(),
        "expires_at": expires_at,
        "last_used_at": None
    }

    res = api_keys_coll.insert_one(doc)

    return {
        "id": str(res.inserted_id),
        "name": payload.name,
        "raw_key": raw_key,  # Sent ONLY ONCE upon creation
        "prefix": prefix,
        "rate_limit_rpm": payload.rate_limit_rpm,
        "expires_at": expires_at,
        "warning": "Please copy and save this secret API key securely. It will not be shown again."
    }

@router.delete("/api/developer/keys/{key_id}")
async def revoke_api_key(key_id: str, user=Depends(get_current_user)):
    from bson import ObjectId
    try:
        obj_id = ObjectId(key_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Key ID")

    user_email = user.email if hasattr(user, "email") else user.get("email", "")
    api_keys_coll.delete_one({"_id": obj_id, "user_email": user_email})
    return {"success": True, "message": "API Key revoked successfully"}

# =========================================================================
# Public Developer REST Gateway (Authenticated via Bearer nx_live_...)
# =========================================================================

@router.post("/api/v1/chat/completions")
async def public_chat_completions(payload: OpenAIChatCompletionRequest, key_doc: dict = Depends(verify_api_key_auth)):
    try:
        groq_client = get_groq_client()
        model_name = payload.model or "llama-3.3-70b-versatile"

        response = groq_client.chat.completions.create(
            model=model_name,
            messages=payload.messages,
            temperature=payload.temperature or 0.7,
            max_tokens=payload.max_tokens or 2048
        )

        return {
            "id": f"chatcmpl-nx-{secrets.token_hex(12)}",
            "object": "chat.completion",
            "created": int(datetime.utcnow().timestamp()),
            "model": model_name,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response.choices[0].message.content
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0
            }
        }
    except Exception as err:
        logger.error(f"Error in public chat completions: {err}")
        raise HTTPException(status_code=500, detail=str(err))

@router.post("/api/v1/rag/query")
async def public_rag_query(payload: RagQueryRequest, key_doc: dict = Depends(verify_api_key_auth)):
    try:
        from rag.vector_store import query_kb_vectors
        kb_id = payload.kb_id or "nexusai_knowledge"
        
        results = query_kb_vectors(kb_id=kb_id, query_text=payload.query, n_results=payload.top_k or 3)
        documents = results.get("documents", [[]])[0] if results else []
        metadatas = results.get("metadatas", [[]])[0] if results else []

        chunks = []
        for idx, text in enumerate(documents):
            chunks.append({
                "index": idx,
                "content": text,
                "metadata": metadatas[idx] if idx < len(metadatas) else {}
            })

        return {
            "query": payload.query,
            "kb_id": kb_id,
            "total_matches": len(chunks),
            "chunks": chunks
        }
    except Exception as err:
        logger.error(f"Error in public RAG query: {err}")
        raise HTTPException(status_code=500, detail=str(err))
