from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from auth.dependencies import get_current_user
from db.mongo_client import db, users_collection
from db.conversation_service import conversations_collection
from db.project_service import projects_collection
from db.research_service import research_sessions_collection
from api.routes.automation import automation_conversations

router = APIRouter(tags=["Admin Panel"])

ADMIN_EMAILS = {"ydvhimanshu461@gmail.com", "admin.neuroforge@gmail.com", "admin@neuroforge.com", "admin@devpilot.ai"}

def check_admin(user=Depends(get_current_user)):
    email = user.get("email")
    if email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Access denied. Admin authorization required.")
    return user

@router.get("/stats")
def get_system_stats(admin=Depends(check_admin)):
    """Retrieve database counts and status details."""
    total_users = users_collection.count_documents({})
    total_conversations = conversations_collection.count_documents({"agent_type": "conversational"})
    total_education = conversations_collection.count_documents({"agent_type": "education"})
    total_projects = projects_collection.count_documents({})
    total_research = research_sessions_collection.count_documents({})
    total_automation = automation_conversations.count_documents({})

    # Fetch recent activities
    recent_activities = []
    
    # Recent users
    recent_users = list(users_collection.find().sort("_id", -1).limit(5))
    for ru in recent_users:
        recent_activities.append({
            "type": "signup",
            "message": f"New user registered: {ru.get('username', 'Guest')} ({ru.get('email')})",
            "timestamp": ru.get("created_at").isoformat() if hasattr(ru.get("created_at"), "isoformat") else "Recent"
        })

    # Recent projects
    recent_projs = list(projects_collection.find().sort("_id", -1).limit(5))
    for rp in recent_projs:
        proj_name = rp.get("project_plan", {}).get("project_name") or rp.get("idea") or "Untitled Project"
        recent_activities.append({
            "type": "project",
            "message": f"Project generated: {proj_name}",
            "timestamp": rp.get("created_at").isoformat() if hasattr(rp.get("created_at"), "isoformat") else "Recent"
        })

    # Fetch system metrics
    import platform
    import sys
    system_info = {
        "os": f"{platform.system()} {platform.release()}",
        "python": sys.version.split(" ")[0],
        "db_status": "Connected (MongoDB)",
        "platform_status": "Operational"
    }

    return {
        "stats": {
            "users": total_users,
            "conversations": total_conversations,
            "education": total_education,
            "projects": total_projects,
            "research": total_research,
            "automation": total_automation,
        },
        "recent_activities": sorted(recent_activities, key=lambda x: x["timestamp"], reverse=True)[:6],
        "system_info": system_info
    }


@router.get("/users")
def get_all_users(admin=Depends(check_admin)):
    """Retrieve all users with metadata."""
    users = list(users_collection.find())
    serialized_users = []
    for u in users:
        user_id = str(u["_id"])
        serialized_users.append({
            "id": user_id,
            "email": u.get("email", ""),
            "username": u.get("username", ""),
            "google_id": u.get("google_id"),
            "is_admin": u.get("email") in ADMIN_EMAILS or u.get("role") == "admin",
            "role": u.get("role") or ("admin" if u.get("email") in ADMIN_EMAILS else "employee"),
            "limit": u.get("limit", 1),
            "created_at": u.get("created_at", "").isoformat() if hasattr(u.get("created_at"), "isoformat") else str(u.get("created_at", "")),
            "last_login": u.get("last_login", "").isoformat() if hasattr(u.get("last_login"), "isoformat") else str(u.get("last_login", "")),
            # Counts
            "conversations_count": conversations_collection.count_documents({"user_id": user_id, "agent_type": "conversational"}),
            "education_count": conversations_collection.count_documents({"user_id": user_id, "agent_type": "education"}),
            "projects_count": projects_collection.count_documents({"owner_id": user_id}),
            "research_count": research_sessions_collection.count_documents({"user_id": user_id}),
            "automation_count": automation_conversations.count_documents({"user_id": user_id}),
        })
    return serialized_users

from datetime import datetime

def log_audit_event(email: str, action: str, details: str, user_id: str = "system"):
    """Helper to write audit trail records in MongoDB."""
    try:
        db["audit_logs"].insert_one({
            "user_id": user_id,
            "email": email,
            "action": action,
            "details": details,
            "timestamp": datetime.utcnow()
        })
    except Exception:
        pass

@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin=Depends(check_admin)):
    """Delete a user and clean up their associated data."""
    try:
        # Get user details first for audit log
        target_user = users_collection.find_one({"_id": ObjectId(user_id)})
        target_email = target_user.get("email") if target_user else "unknown"

        # Delete user record
        res = users_collection.delete_one({"_id": ObjectId(user_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Clean up related records
        conversations_collection.delete_many({"user_id": user_id})
        projects_collection.delete_many({"owner_id": user_id})
        research_sessions_collection.delete_many({"user_id": user_id})
        automation_conversations.delete_many({"user_id": user_id})
        
        # Log audit event
        log_audit_event(
            email=admin.get("email", "admin"),
            action="user_delete",
            details=f"Permanently deleted account: {target_email}",
            user_id=str(admin.get("sub", "system"))
        )

        return {"success": True, "message": f"User {user_id} and all their history deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ID format or deletion error: {str(e)}")

@router.delete("/cleanup")
def cleanup_system(admin=Depends(check_admin)):
    """Clean up all sessions and history data (leaves user accounts intact)."""
    try:
        conversations_collection.delete_many({})
        projects_collection.delete_many({})
        research_sessions_collection.delete_many({})
        automation_conversations.delete_many({})

        # Log audit event
        log_audit_event(
            email=admin.get("email", "admin"),
            action="system_cleanup",
            details="Wiped workspace history database completely (left user accounts intact)",
            user_id=str(admin.get("sub", "system"))
        )

        return {"success": True, "message": "System database cleaned up completely."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UpdateLimitRequest(BaseModel):
    limit: int


@router.post("/users/{user_id}/limit")
def update_user_limit(user_id: str, payload: UpdateLimitRequest, admin=Depends(check_admin)):
    """Update a user's custom limit."""
    try:
        if payload.limit < 1:
            raise HTTPException(status_code=400, detail="Limit must be at least 1")
            
        res = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"limit": payload.limit}}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")

        # Get target user email for audit log
        target_user = users_collection.find_one({"_id": ObjectId(user_id)})
        target_email = target_user.get("email") if target_user else "unknown"

        # Log audit event
        log_audit_event(
            email=admin.get("email", "admin"),
            action="user_limit_update",
            details=f"Updated workspace query limit for {target_email} to {payload.limit}",
            user_id=str(admin.get("sub", "system"))
        )

        return {"success": True, "message": f"User limit updated to {payload.limit}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class UpdateRoleRequest(BaseModel):
    role: str


@router.post("/users/{user_id}/role")
def update_user_role(user_id: str, payload: UpdateRoleRequest, admin=Depends(check_admin)):
    """Update a user's role (admin, manager, employee)."""
    try:
        if payload.role not in ["admin", "manager", "employee"]:
            raise HTTPException(status_code=400, detail="Invalid role type")
            
        res = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"role": payload.role}}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")

        # Get target user email for audit log
        target_user = users_collection.find_one({"_id": ObjectId(user_id)})
        target_email = target_user.get("email") if target_user else "unknown"

        # Log audit event
        log_audit_event(
            email=admin.get("email", "admin"),
            action="user_role_update",
            details=f"Updated user role for {target_email} to {payload.role}",
            user_id=str(admin.get("sub", "system"))
        )

        return {"success": True, "message": f"User role updated to {payload.role}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audit-logs")
def get_audit_logs(admin=Depends(check_admin)):
    """Retrieve the latest system security audit logs."""
    try:
        logs = list(db["audit_logs"].find().sort("_id", -1).limit(50))
        serialized_logs = []
        for l in logs:
            serialized_logs.append({
                "id": str(l["_id"]),
                "user_id": l.get("user_id", ""),
                "email": l.get("email", ""),
                "action": l.get("action", ""),
                "details": l.get("details", ""),
                "timestamp": l.get("timestamp").isoformat() if hasattr(l.get("timestamp"), "isoformat") else str(l.get("timestamp", ""))
              })
        return serialized_logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
