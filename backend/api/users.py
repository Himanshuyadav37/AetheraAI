from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from bson import ObjectId
from datetime import datetime

from auth.dependencies import get_current_user
from db.mongo_client import users_collection
from core.security import hash_password

router = APIRouter()


class ProfileUpdateRequest(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    password: str | None = None


@router.get("/me")
def get_me(
    current_user=Depends(get_current_user)
):
    return current_user


@router.put("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    current_user=Depends(get_current_user)
):
    user_id = current_user["sub"]
    update_data = {}
    
    if payload.username:
        update_data["username"] = payload.username
        
    if payload.email:
        # Check if email is already taken by another account
        existing_user = users_collection.find_one({"email": payload.email})
        if existing_user and str(existing_user["_id"]) != user_id:
            raise HTTPException(status_code=400, detail="Email is already taken by another user")
        update_data["email"] = payload.email
        
    if payload.password:
        update_data["password"] = hash_password(payload.password)

    if update_data:
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
    
    # Retrieve updated user details
    updated = users_collection.find_one({"_id": ObjectId(user_id)})
    return {
        "success": True,
        "user": {
            "id": str(updated["_id"]),
            "username": updated.get("username", ""),
            "email": updated.get("email", "")
        }
    }


@router.delete("/profile")
def delete_my_account(
    current_user=Depends(get_current_user)
):
    user_id = current_user["sub"]
    
    # Delete user record from MongoDB
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
    
    return {"success": True, "message": "Account and all associated workspace data deleted successfully."}


@router.get("/export")
def export_my_data(
    current_user=Depends(get_current_user)
):
    user_id = current_user["sub"]
    
    # Fetch all records related to the user
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
    
    # Helper to serialize MongoDB ObjectIds and Datetimes
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
        "user": {
            "username": user_doc.get("username"),
            "email": user_doc.get("email"),
            "created_at": user_doc.get("created_at").isoformat() if hasattr(user_doc.get("created_at"), "isoformat") else str(user_doc.get("created_at", ""))
        },
        "conversations": serialize_list(chats),
        "projects": serialize_list(projects),
        "research_sessions": serialize_list(research),
        "automations": serialize_list(automations)
    }