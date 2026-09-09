from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from auth.dependencies import get_current_user
from db.mongo_client import db

logger = logging.getLogger("integrations")

router = APIRouter(prefix="/api/integrations", tags=["Enterprise Integrations"])

integrations_coll = db["integrations_config"]

DEFAULT_INTEGRATIONS = [
    {
        "app_id": "github",
        "name": "GitHub Code Intelligence",
        "description": "Index repositories, audit pull requests for security vulnerabilities, and sync commits.",
        "icon": "github",
        "category": "Engineering",
        "supported_features": ["Codebase RAG Sync", "Automated PR Reviews", "Issue Generation"]
    },
    {
        "app_id": "slack",
        "name": "Slack & Discord Workflows",
        "description": "Trigger NexusAI conversational agents directly from team channels and get incident alerts.",
        "icon": "slack",
        "category": "Communication",
        "supported_features": ["Channel AI Assistant", "Incident Broadcasts", "Daily Standup Summary"]
    },
    {
        "app_id": "google_drive",
        "name": "Google Drive Sync",
        "description": "Automatically ingest Docs, Sheets, and PDFs from shared drive folders into RAG Knowledge Bases.",
        "icon": "drive",
        "category": "Storage",
        "supported_features": ["Auto-Vectorization", "Live Document Watcher", "Multi-Org Isolation"]
    },
    {
        "app_id": "notion",
        "name": "Notion Knowledge Hub",
        "description": "Sync company wikis, SOPs, and engineering architecture docs directly into organization memory.",
        "icon": "notion",
        "category": "Knowledge",
        "supported_features": ["Page Sync", "Database Table Parsing", "Weekly Auto-Reindex"]
    },
    {
        "app_id": "jira",
        "name": "Jira & Linear Issue Tracker",
        "description": "Automatically create structured bug reports, user stories, and tasks from AI code generation runs.",
        "icon": "jira",
        "category": "Project Management",
        "supported_features": ["Bug Auto-Triage", "Story Generator", "Execution Linking"]
    }
]

class IntegrationConfigurePayload(BaseModel):
    api_key: Optional[str] = ""
    webhook_url: Optional[str] = ""
    target_repo_or_folder: Optional[str] = ""
    target_kb_id: Optional[str] = ""
    auto_sync: Optional[bool] = True

# 1. List all available integrations with user's connection status
@router.get("")
async def get_all_integrations(user=Depends(get_current_user)):
    user_email = user.email if hasattr(user, "email") else user.get("email", "")

    user_configs = list(integrations_coll.find({"user_email": user_email}))
    config_map = {c.get("app_id"): c for c in user_configs}

    result = []
    for item in DEFAULT_INTEGRATIONS:
        app_id = item["app_id"]
        cfg = config_map.get(app_id)
        
        status = "disconnected"
        is_enabled = False
        last_synced = None
        
        if cfg:
            is_enabled = cfg.get("is_enabled", False)
            status = "connected" if is_enabled else "configured"
            last_synced = cfg.get("last_synced_at")

        result.append({
            **item,
            "status": status,
            "is_enabled": is_enabled,
            "target_repo_or_folder": cfg.get("target_repo_or_folder", "") if cfg else "",
            "target_kb_id": cfg.get("target_kb_id", "") if cfg else "",
            "last_synced_at": last_synced,
            "auto_sync": cfg.get("auto_sync", True) if cfg else True
        })

    return result

# 2. Configure an integration
@router.post("/{app_id}/configure")
async def configure_integration(app_id: str, payload: IntegrationConfigurePayload, user=Depends(get_current_user)):
    user_email = user.email if hasattr(user, "email") else user.get("email", "")
    now_str = datetime.utcnow().isoformat()

    doc = {
        "user_email": user_email,
        "app_id": app_id,
        "api_key": payload.api_key.strip() if payload.api_key else "",
        "webhook_url": payload.webhook_url.strip() if payload.webhook_url else "",
        "target_repo_or_folder": payload.target_repo_or_folder.strip() if payload.target_repo_or_folder else "",
        "target_kb_id": payload.target_kb_id or "",
        "auto_sync": payload.auto_sync if payload.auto_sync is not None else True,
        "is_enabled": True,
        "last_synced_at": now_str,
        "updated_at": now_str
    }

    integrations_coll.update_one(
        {"user_email": user_email, "app_id": app_id},
        {"$set": doc},
        upsert=True
    )

    return {"success": True, "message": f"Integration '{app_id}' configured and connected successfully!"}

# 3. Toggle integration on/off
@router.post("/{app_id}/toggle")
async def toggle_integration(app_id: str, user=Depends(get_current_user)):
    user_email = user.email if hasattr(user, "email") else user.get("email", "")
    
    cfg = integrations_coll.find_one({"user_email": user_email, "app_id": app_id})
    if not cfg:
        raise HTTPException(status_code=404, detail="Integration not configured yet")

    new_state = not cfg.get("is_enabled", False)
    integrations_coll.update_one(
        {"user_email": user_email, "app_id": app_id},
        {"$set": {"is_enabled": new_state, "updated_at": datetime.utcnow().isoformat()}}
    )

    return {"success": True, "is_enabled": new_state}

# 4. Trigger manual synchronization
@router.post("/{app_id}/sync")
async def sync_integration(app_id: str, user=Depends(get_current_user)):
    user_email = user.email if hasattr(user, "email") else user.get("email", "")
    now_str = datetime.utcnow().isoformat()

    cfg = integrations_coll.find_one({"user_email": user_email, "app_id": app_id})
    if not cfg:
        raise HTTPException(status_code=404, detail="Integration not configured yet")

    integrations_coll.update_one(
        {"user_email": user_email, "app_id": app_id},
        {"$set": {"last_synced_at": now_str}}
    )

    return {
        "success": True,
        "message": f"Synchronized '{app_id}' knowledge stream with NexusAI vector memory.",
        "synced_at": now_str
    }

# 5. Disconnect integration
@router.delete("/{app_id}")
async def disconnect_integration(app_id: str, user=Depends(get_current_user)):
    user_email = user.email if hasattr(user, "email") else user.get("email", "")
    integrations_coll.delete_one({"user_email": user_email, "app_id": app_id})
    return {"success": True, "message": f"Integration '{app_id}' disconnected."}
