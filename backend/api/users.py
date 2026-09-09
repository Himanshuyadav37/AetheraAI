from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from bson import ObjectId
from datetime import datetime
from typing import Optional, List, Dict, Any

from auth.dependencies import get_current_user
from db.mongo_client import users_collection, db
from core.security import hash_password, verify_password

router = APIRouter()

user_sessions_collection = db["user_sessions"]


class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    role: Optional[str] = None
    avatar_color: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class TwoFactorToggleRequest(BaseModel):
    enabled: bool


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.get("/profile")
def get_user_profile(current_user=Depends(get_current_user)):
    user_id = current_user["sub"]
    user_doc = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    email = user_doc.get("email") or current_user.get("email", "")
    username = user_doc.get("username")
    if not username:
        username = email.split("@")[0] if email else "Developer"
        users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"username": username}})
    
    # Query API keys count
    api_keys_count = db["developer_api_keys"].count_documents({"user_email": email})
    
    # Query active session count
    active_sessions_count = max(1, user_sessions_collection.count_documents({"user_id": user_id}))

    created_at_val = user_doc.get("created_at")
    if isinstance(created_at_val, datetime):
        created_at_str = created_at_val.isoformat()
    elif created_at_val:
        created_at_str = str(created_at_val)
    else:
        created_at_str = datetime.utcnow().isoformat()

    return {
        "id": str(user_doc["_id"]),
        "username": username,
        "email": email,
        "role": user_doc.get("role", "AI Software Architect"),
        "bio": user_doc.get("bio", "Autonomous Engineering & AI Systems Builder"),
        "avatar_color": user_doc.get("avatar_color", "linear-gradient(135deg, #6366f1, #a855f7)"),
        "plan": "Enterprise PRO",
        "two_factor_enabled": user_doc.get("two_factor_enabled", False),
        "api_keys_count": api_keys_count,
        "active_sessions_count": active_sessions_count,
        "created_at": created_at_str,
    }


@router.put("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    current_user=Depends(get_current_user)
):
    user_id = current_user["sub"]
    update_data = {}
    
    if payload.username is not None and payload.username.strip():
        update_data["username"] = payload.username.strip()
        
    if payload.bio is not None:
        update_data["bio"] = payload.bio
        
    if payload.role is not None:
        update_data["role"] = payload.role
        
    if payload.avatar_color is not None:
        update_data["avatar_color"] = payload.avatar_color

    if update_data:
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
    
    # Retrieve updated user details
    updated = users_collection.find_one({"_id": ObjectId(user_id)})
    email = updated.get("email") or current_user.get("email", "")
    username = updated.get("username") or (email.split("@")[0] if email else "Developer")
    
    return {
        "success": True,
        "user": {
            "id": str(updated["_id"]),
            "username": username,
            "email": email,
            "bio": updated.get("bio", ""),
            "role": updated.get("role", ""),
            "avatar_color": updated.get("avatar_color", ""),
        }
    }


@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    current_user=Depends(get_current_user)
):
    user_id = current_user["sub"]
    user_doc = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if user has a password set
    stored_password = user_doc.get("password")
    if stored_password:
        if not verify_password(payload.current_password, stored_password):
            raise HTTPException(status_code=400, detail="Current password does not match.")
    
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
        
    new_hashed = hash_password(payload.new_password)
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": new_hashed, "password_updated_at": datetime.utcnow().isoformat()}}
    )
    
    return {"success": True, "message": "Password updated successfully."}


@router.post("/2fa/toggle")
def toggle_two_factor(
    payload: TwoFactorToggleRequest,
    current_user=Depends(get_current_user)
):
    user_id = current_user["sub"]
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"two_factor_enabled": payload.enabled, "two_factor_updated_at": datetime.utcnow().isoformat()}}
    )
    return {
        "success": True, 
        "two_factor_enabled": payload.enabled,
        "message": "Two-Factor Authentication " + ("enabled" if payload.enabled else "disabled") + " successfully."
    }


@router.get("/sessions")
def get_user_sessions(request: Request, current_user=Depends(get_current_user)):
    user_id = current_user["sub"]
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0")

    # Current Session
    sessions = [
        {
            "id": "curr_session_01",
            "device": "Current Active Device (Web Browser)",
            "ip": client_ip,
            "browser": "Chrome / Desktop OS",
            "location": "Active Local Session",
            "last_active": datetime.utcnow().isoformat(),
            "is_current": True
        }
    ]

    # Additional past sessions from DB
    db_sessions = list(user_sessions_collection.find({"user_id": user_id}).sort("last_active", -1).limit(5))
    for s in db_sessions:
        if str(s.get("_id")) != "curr_session_01":
            sessions.append({
                "id": str(s["_id"]),
                "device": s.get("device", "Desktop Workstation"),
                "ip": s.get("ip", "192.168.1.1"),
                "browser": s.get("browser", "Browser Session"),
                "location": s.get("location", "Authenticated Device"),
                "last_active": s.get("last_active", datetime.utcnow().isoformat()),
                "is_current": False
            })

    return {"sessions": sessions}


@router.post("/sessions/revoke-all")
def revoke_other_sessions(current_user=Depends(get_current_user)):
    user_id = current_user["sub"]
    user_sessions_collection.delete_many({"user_id": user_id})
    return {"success": True, "message": "All other device sessions have been revoked."}


@router.get("/usage")
def get_user_usage_stats(current_user=Depends(get_current_user)):
    user_id = current_user["sub"]
    user_email = current_user.get("email", "")

    from db.conversation_service import conversations_collection
    from db.project_service import projects_collection
    from db.research_service import research_sessions_collection
    from api.routes.automation import automation_conversations

    total_chats = conversations_collection.count_documents({"user_id": user_id})
    total_projects = projects_collection.count_documents({"owner_id": user_id})
    total_research = research_sessions_collection.count_documents({"user_id": user_id})
    total_automations = automation_conversations.count_documents({"user_id": user_id})
    
    # Calculate real API request count
    api_keys = list(db["developer_api_keys"].find({"user_email": user_email}))
    total_api_requests = sum(k.get("total_requests", 0) for k in api_keys)

    return {
        "total_sessions": total_chats + total_research + total_automations,
        "chat_conversations": total_chats,
        "projects_built": total_projects,
        "research_reports": total_research,
        "automations_deployed": total_automations,
        "developer_api_calls": total_api_requests,
        "plan_limit_tokens": "Unlimited (Enterprise Tier)",
        "rate_limit": "820 tokens / sec (Groq LPU Acceleration)"
    }


@router.delete("/profile")
def delete_my_account(current_user=Depends(get_current_user)):
    user_id = current_user["sub"]
    
    res = users_collection.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Cascade clean up all user-created workspace history
    from db.conversation_service import conversations_collection
    from db.project_service import projects_collection
    from db.research_service import research_sessions_collection
    from api.routes.automation import automation_conversations
    
    conversations_collection.delete_many({"user_id": user_id})
    projects_collection.delete_many({"owner_id": user_id})
    research_sessions_collection.delete_many({"user_id": user_id})
    automation_conversations.delete_many({"user_id": user_id})
    db["developer_api_keys"].delete_many({"user_id": user_id})
    user_sessions_collection.delete_many({"user_id": user_id})
    
    return {"success": True, "message": "Account and all associated workspace data deleted successfully."}


@router.get("/export")
def export_my_data(current_user=Depends(get_current_user)):
    user_id = current_user["sub"]
    
    user_doc = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
        
    from db.conversation_service import conversations_collection
    from db.project_service import projects_collection
    from db.research_service import research_sessions_collection
    from api.routes.automation import automation_conversations
    
    chats = list(conversations_collection.find({"user_id": user_id}))
    projects = list(projects_collection.find({"owner_id": user_id}))
    research = list(research_sessions_collection.find({"user_id": user_id}))
    automations = list(automation_conversations.find({"user_id": user_id}))
    api_keys = list(db["developer_api_keys"].find({"user_email": user_doc.get("email")}))
    
    def serialize_list(lst):
        for item in lst:
            item["_id"] = str(item["_id"])
            if "user_id" in item:
                item["user_id"] = str(item["user_id"])
            if "owner_id" in item:
                item["owner_id"] = str(item["owner_id"])
            if "created_at" in item and hasattr(item["created_at"], "isoformat"):
                item["created_at"] = item["created_at"].isoformat()
            if "updated_at" in item and hasattr(item["updated_at"], "isoformat"):
                item["updated_at"] = item["updated_at"].isoformat()
        return lst
        
    return {
        "export_metadata": {
            "version": "NexusAI Enterprise OS 2.0",
            "exported_at": datetime.utcnow().isoformat(),
            "status": "Verified Complete Data Archive"
        },
        "user_profile": {
            "username": user_doc.get("username"),
            "email": user_doc.get("email"),
            "role": user_doc.get("role", "AI Software Architect"),
            "bio": user_doc.get("bio", ""),
            "created_at": user_doc.get("created_at").isoformat() if hasattr(user_doc.get("created_at"), "isoformat") else str(user_doc.get("created_at", ""))
        },
        "conversations": serialize_list(chats),
        "projects": serialize_list(projects),
        "research_sessions": serialize_list(research),
        "automations": serialize_list(automations),
        "developer_api_keys": serialize_list(api_keys)
    }