from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from auth.dependencies import get_current_user
from db.mongo_client import db, users_collection, executions_collection
from db.conversation_service import conversations_collection
from db.project_service import projects_collection
from db.research_service import research_sessions_collection
from api.routes.automation import automation_conversations

router = APIRouter(tags=["Admin Panel"])

from config import settings

ADMIN_EMAILS = set(email.lower().strip() for email in settings.ADMIN_EMAILS_LIST)

def check_admin(user=Depends(get_current_user)):
    email = (user.get("email") or "").lower().strip()
    role = (user.get("role") or "").lower().strip()
    if email not in ADMIN_EMAILS and role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin authorization required.")
    return user

@router.get("/stats")
def get_system_stats(admin=Depends(check_admin)):
    """Retrieve 100% real database counts and live server metrics."""
    import time
    import platform
    import sys

    # 1. Real Mongo ping latency
    t0 = time.time()
    try:
        db.command("ping")
        ping_ms = round((time.time() - t0) * 1000, 1)
        db_status = "Connected (MongoDB Atlas)"
    except Exception as e:
        ping_ms = 0
        db_status = f"Error ({str(e)[:30]})"

    # 2. Real counts across collections
    total_users = users_collection.count_documents({})
    total_conversations = conversations_collection.count_documents({"agent_type": "conversational"})
    total_education = conversations_collection.count_documents({"agent_type": "education"})
    total_projects = projects_collection.count_documents({})
    total_executions = db["executions"].count_documents({})
    total_research = research_sessions_collection.count_documents({})
    total_automation = automation_conversations.count_documents({})
    total_kb_docs = db["rag_documents"].count_documents({})
    total_guardrail_logs = db["guardrail_logs"].count_documents({})
    total_audit_logs = db["audit_logs"].count_documents({})

    # 3. Dynamic agent distribution from actual database counts
    total_agent_runs = total_conversations + total_education + total_projects + total_research + total_automation
    agent_distribution = []
    if total_agent_runs > 0:
        agent_distribution = [
            {"agent": "Conversational AI", "count": total_conversations, "percentage": round((total_conversations / total_agent_runs) * 100, 1)},
            {"agent": "Developer AI", "count": total_projects, "percentage": round((total_projects / total_agent_runs) * 100, 1)},
            {"agent": "Deep Research AI", "count": total_research, "percentage": round((total_research / total_agent_runs) * 100, 1)},
            {"agent": "Education AI", "count": total_education, "percentage": round((total_education / total_agent_runs) * 100, 1)},
            {"agent": "Automation AI", "count": total_automation, "percentage": round((total_automation / total_agent_runs) * 100, 1)},
        ]

    # 4. Recent real activities
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

    # System runtime information
    system_info = {
        "os": f"{platform.system()} {platform.release()}",
        "python": sys.version.split(" ")[0],
        "db_status": db_status,
        "ping_ms": ping_ms,
        "platform_status": "Operational",
        "total_executions": total_executions,
        "total_kb_docs": total_kb_docs,
        "total_guardrail_logs": total_guardrail_logs,
        "total_audit_logs": total_audit_logs,
        "total_records": (total_users + total_conversations + total_education + total_projects + 
                          total_executions + total_research + total_automation + total_kb_docs)
    }

    return {
        "stats": {
            "users": total_users,
            "conversations": total_conversations,
            "education": total_education,
            "projects": total_projects,
            "executions": total_executions,
            "research": total_research,
            "automation": total_automation,
        },
        "recent_activities": sorted(recent_activities, key=lambda x: x["timestamp"], reverse=True)[:6],
        "system_info": system_info,
        "agent_distribution": agent_distribution
    }


@router.get("/users")
def get_all_users(admin=Depends(check_admin)):
    """Retrieve all users with metadata and accurate conversation counts."""
    users = list(users_collection.find().sort("created_at", -1))
    serialized_users = []
    for u in users:
        user_id = str(u["_id"])
        email = u.get("email", "")
        
        # Build match values
        id_values = [user_id, email]
        if email:
            id_values.append(email.lower())
            id_values.append(email.strip())
        if ObjectId.is_valid(user_id):
            id_values.append(ObjectId(user_id))
            
        conv_cnt = conversations_collection.count_documents({
            "$and": [
                {"$or": [{"user_id": {"$in": id_values}}, {"email": {"$in": id_values}}, {"user_email": {"$in": id_values}}]},
                {"$or": [
                    {"agent_type": {"$in": ["conversational", "chat", "general", "nexus", "copilot", "custom_agent", None]}},
                    {"agent_type": {"$exists": False}},
                    {"agent_type": {"$nin": ["education"]}}
                ]}
            ]
        })
        edu_cnt = conversations_collection.count_documents({
            "$and": [
                {"$or": [{"user_id": {"$in": id_values}}, {"email": {"$in": id_values}}, {"user_email": {"$in": id_values}}]},
                {"agent_type": "education"}
            ]
        })
        proj_cnt = projects_collection.count_documents({
            "$or": [{"owner_id": {"$in": id_values}}, {"user_id": {"$in": id_values}}, {"owner_email": {"$in": id_values}}, {"email": {"$in": id_values}}]
        })
        res_cnt = research_sessions_collection.count_documents({
            "$or": [{"user_id": {"$in": id_values}}, {"email": {"$in": id_values}}, {"user_email": {"$in": id_values}}]
        })
        auto_cnt = automation_conversations.count_documents({
            "$or": [{"user_id": {"$in": id_values}}, {"email": {"$in": id_values}}, {"user_email": {"$in": id_values}}]
        })

        serialized_users.append({
            "id": user_id,
            "email": email,
            "username": u.get("username", ""),
            "google_id": u.get("google_id"),
            "is_admin": email in ADMIN_EMAILS or u.get("role") == "admin",
            "role": u.get("role") or ("admin" if email in ADMIN_EMAILS else "employee"),
            "limit": u.get("limit", 1),
            "created_at": u.get("created_at", "").isoformat() if hasattr(u.get("created_at"), "isoformat") else str(u.get("created_at", "")),
            "last_login": u.get("last_login", "").isoformat() if hasattr(u.get("last_login"), "isoformat") else str(u.get("last_login", "")),
            "conversations_count": conv_cnt,
            "education_count": edu_cnt,
            "projects_count": proj_cnt,
            "research_count": res_cnt,
            "automation_count": auto_cnt,
            "total_chats": conv_cnt + edu_cnt + proj_cnt + res_cnt + auto_cnt
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
            ts = l.get("timestamp")
            if hasattr(ts, "isoformat"):
                ts_str = ts.isoformat()
            else:
                ts_str = str(ts) if ts else "Recent"
            serialized_logs.append({
                "id": str(l["_id"]),
                "user_id": str(l.get("user_id", "")),
                "email": l.get("email", ""),
                "action": l.get("action", ""),
                "details": l.get("details", ""),
                "timestamp": ts_str
            })
        return serialized_logs
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/{user_id}/history")
def get_user_history(user_id: str, admin=Depends(check_admin)):
    """Retrieve all chat/session history of a user across all 5 models/agents with robust user matching."""
    try:
        def serialize_doc(doc):
            if not doc:
                return doc
            if isinstance(doc, dict):
                clean_doc = {}
                for k, v in doc.items():
                    if k == "_id":
                        clean_doc["_id"] = str(v)
                    elif isinstance(v, ObjectId):
                        clean_doc[k] = str(v)
                    elif hasattr(v, "isoformat"):
                        clean_doc[k] = v.isoformat()
                    elif isinstance(v, dict):
                        clean_doc[k] = serialize_doc(v)
                    elif isinstance(v, list):
                        clean_doc[k] = [serialize_doc(item) if isinstance(item, (dict, list)) else (str(item) if isinstance(item, ObjectId) else (item.isoformat() if hasattr(item, "isoformat") else item)) for item in v]
                    else:
                        clean_doc[k] = v
                return clean_doc
            elif isinstance(doc, list):
                return [serialize_doc(item) for item in doc]
            return doc

        # Retrieve user details safely (by ObjectId, email, username, or str _id)
        target_user = None
        if ObjectId.is_valid(user_id):
            try:
                target_user = users_collection.find_one({"_id": ObjectId(user_id)})
            except Exception:
                pass
        if not target_user:
            target_user = users_collection.find_one({
                "$or": [
                    {"_id": user_id},
                    {"email": user_id},
                    {"email": user_id.lower() if isinstance(user_id, str) else user_id},
                    {"username": user_id}
                ]
            })

        user_info = {
            "id": str(target_user["_id"]) if target_user else user_id,
            "email": target_user.get("email", "") if target_user else (user_id if "@" in user_id else ""),
            "username": target_user.get("username", "") if target_user else "User"
        }

        # Collect all possible identifier representations
        id_strings = set()
        id_objects = []

        if target_user:
            raw_id = target_user.get("_id")
            if raw_id:
                id_strings.add(str(raw_id))
                if isinstance(raw_id, ObjectId):
                    id_objects.append(raw_id)
                elif ObjectId.is_valid(str(raw_id)):
                    id_objects.append(ObjectId(str(raw_id)))

            email = target_user.get("email")
            if email:
                id_strings.add(email)
                id_strings.add(email.lower())
                id_strings.add(email.strip())

            username = target_user.get("username")
            if username:
                id_strings.add(username)

        if user_id:
            id_strings.add(user_id)
            if isinstance(user_id, str):
                id_strings.add(user_id.lower())
                id_strings.add(user_id.strip())
            if ObjectId.is_valid(user_id):
                id_objects.append(ObjectId(user_id))

        match_values = list(id_strings) + id_objects

        # General user matching filter across multiple fields
        user_query_filter = {
            "$or": [
                {"user_id": {"$in": match_values}},
                {"email": {"$in": match_values}},
                {"user_email": {"$in": match_values}},
                {"owner_id": {"$in": match_values}},
                {"owner_email": {"$in": match_values}},
            ]
        }

        # 1. Conversational Chats (matches conversational, chat, general, copilot, or unassigned agent_type)
        conv_filter = {
            "$and": [
                user_query_filter,
                {
                    "$or": [
                        {"agent_type": {"$in": ["conversational", "chat", "general", "nexus", "copilot", "custom_agent", None]}},
                        {"agent_type": {"$exists": False}},
                        {"agent_type": {"$nin": ["education"]}}
                    ]
                }
            ]
        }
        conv_chats = list(conversations_collection.find(conv_filter).sort([("updated_at", -1), ("created_at", -1)]))
        serialized_conv = [serialize_doc(c) for c in conv_chats]

        # 2. Education Chats
        edu_filter = {
            "$and": [
                user_query_filter,
                {"agent_type": "education"}
            ]
        }
        edu_chats = list(conversations_collection.find(edu_filter).sort([("updated_at", -1), ("created_at", -1)]))
        serialized_edu = [serialize_doc(c) for c in edu_chats]

        # 3. Projects (Engineer / Developer)
        proj_filter = {
            "$or": [
                {"owner_id": {"$in": match_values}},
                {"user_id": {"$in": match_values}},
                {"owner_email": {"$in": match_values}},
                {"email": {"$in": match_values}}
            ]
        }
        projects = list(projects_collection.find(proj_filter).sort("created_at", -1))
        serialized_projects = []
        for p in projects:
            p_id = str(p["_id"])
            from db.execution_service import get_project_history
            executions = get_project_history(p_id)
            serialized_projects.append(serialize_doc({
                "_id": p["_id"],
                "idea": p.get("idea", ""),
                "status": p.get("status", ""),
                "project_plan": p.get("project_plan", {}),
                "created_at": p.get("created_at"),
                "executions": executions
            }))

        # Direct executions if any were saved without project records
        exec_filter = {
            "$or": [
                {"user_id": {"$in": match_values}},
                {"owner_id": {"$in": match_values}},
                {"email": {"$in": match_values}}
            ]
        }
        orphan_executions = list(executions_collection.find(exec_filter).sort("created_at", -1))
        existing_proj_ids = {str(p["_id"]) for p in projects}
        for ex in orphan_executions:
            proj_id_ref = ex.get("project_id")
            if not proj_id_ref or str(proj_id_ref) not in existing_proj_ids:
                serialized_projects.append(serialize_doc({
                    "_id": str(ex["_id"]),
                    "idea": ex.get("idea") or ex.get("project_name") or "Direct Execution Run",
                    "status": ex.get("status", "completed"),
                    "project_plan": {},
                    "created_at": ex.get("created_at"),
                    "executions": [ex]
                }))

        # 4. Research Sessions
        res_filter = {
            "$or": [
                {"user_id": {"$in": match_values}},
                {"email": {"$in": match_values}},
                {"user_email": {"$in": match_values}}
            ]
        }
        research_sessions = list(research_sessions_collection.find(res_filter).sort([("updated_at", -1), ("created_at", -1)]))
        serialized_research = [serialize_doc(r) for r in research_sessions]

        # 5. Automation Conversations
        auto_filter = {
            "$or": [
                {"user_id": {"$in": match_values}},
                {"email": {"$in": match_values}},
                {"user_email": {"$in": match_values}}
            ]
        }
        automation_chats = list(automation_conversations.find(auto_filter).sort([("updated_at", -1), ("created_at", -1)]))
        serialized_automation = [serialize_doc(a) for a in automation_chats]

        return {
            "user": user_info,
            "conversational": serialized_conv,
            "education": serialized_edu,
            "projects": serialized_projects,
            "research": serialized_research,
            "automation": serialized_automation
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Failed to fetch user history: {str(e)}")


# ==========================================
# Safety Guardrails Management Routes
# ==========================================
class GuardrailsConfigRequest(BaseModel):
    content_filter_enabled: bool
    denied_topics_enabled: bool
    word_filter_enabled: bool
    pii_filter_enabled: bool
    grounding_check_enabled: bool
    jailbreak_shield_enabled: bool
    crisis_redirection_enabled: bool
    blocked_words: list[str]
    denied_topics: list[str]

@router.get("/guardrails/config")
def get_guardrails_config_route(admin=Depends(check_admin)):
    from services.guardrails import get_guardrails_config
    cfg = get_guardrails_config()
    if "_id" in cfg:
        cfg["_id"] = str(cfg["_id"])
    return cfg

@router.post("/guardrails/config")
def save_guardrails_config_route(req: GuardrailsConfigRequest, admin=Depends(check_admin)):
    from services.guardrails import save_guardrails_config
    from datetime import datetime
    updates = req.dict()
    updates["updated_at"] = datetime.utcnow()
    success = save_guardrails_config(updates)
    return {"success": success}

@router.get("/guardrails/logs")
def get_guardrails_logs_route(admin=Depends(check_admin)):
    from datetime import datetime
    logs = list(db["guardrail_logs"].find().sort("timestamp", -1).limit(50))
    for log in logs:
        log["_id"] = str(log["_id"])
        if "timestamp" in log and isinstance(log["timestamp"], datetime):
            log["timestamp"] = log["timestamp"].isoformat()
        else:
            log["timestamp"] = str(log.get("timestamp"))
    return logs


# =====================================================================
# Enterprise LLM Cost & Quota Vault Routes
# =====================================================================

class DepartmentBudgetUpdateRequest(BaseModel):
    department: str
    monthly_budget_usd: float
    hard_cap: bool = True
    alert_threshold: float = 80.0

class RouterSimulationRequest(BaseModel):
    prompt: str
    agent_type: str = "conversational"


@router.get("/cost-vault/analytics")
def get_cost_vault_analytics_route(admin=Depends(check_admin)):
    """Retrieve full executive financial savings, token analytics, and model distribution."""
    from services.llm_router import get_cost_vault_analytics
    return get_cost_vault_analytics(db)


@router.get("/cost-vault/departments")
def get_department_budgets_route(admin=Depends(check_admin)):
    """Retrieve all department budget quotas and spend progress."""
    from services.llm_router import get_or_create_department_budgets
    return get_or_create_department_budgets(db["department_budgets"])


@router.post("/cost-vault/departments")
def update_department_budget_route(req: DepartmentBudgetUpdateRequest, admin=Depends(check_admin)):
    """Update or create a department budget quota and policy."""
    from datetime import datetime
    dept_name = req.department.strip()
    db["department_budgets"].update_one(
        {"department": dept_name},
        {
            "$set": {
                "department": dept_name,
                "monthly_budget_usd": max(10.0, float(req.monthly_budget_usd)),
                "hard_cap": req.hard_cap,
                "alert_threshold": max(10.0, min(100.0, float(req.alert_threshold))),
                "updated_at": datetime.utcnow()
            },
            "$setOnInsert": {
                "current_spend_usd": 0.0,
                "current_tokens": 0,
                "created_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    return {"success": True, "message": f"Department '{dept_name}' budget updated successfully."}


@router.post("/cost-vault/departments/{dept_name}/reset")
def reset_department_budget_route(dept_name: str, admin=Depends(check_admin)):
    """Reset current month spend and token usage for a department."""
    from datetime import datetime
    db["department_budgets"].update_one(
        {"department": dept_name},
        {
            "$set": {
                "current_spend_usd": 0.0,
                "current_tokens": 0,
                "last_reset": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    return {"success": True, "message": f"Monthly spend for '{dept_name}' reset to $0.00."}


@router.post("/cost-vault/test-router")
def test_smart_router_route(req: RouterSimulationRequest, admin=Depends(check_admin)):
    """Simulate smart semantic complexity classification and estimated cost savings on a test prompt."""
    from services.llm_router import classify_query_complexity, select_optimal_model, estimate_token_count, calculate_token_cost, MODEL_PRICING
    tier, score, reason = classify_query_complexity(req.prompt, req.agent_type)
    model = select_optimal_model(tier)
    model_name = MODEL_PRICING.get(model, {}).get("name", model)
    
    prompt_tokens = estimate_token_count(req.prompt)
    est_completion_tokens = max(50, int(prompt_tokens * 1.5))
    cost_info = calculate_token_cost(model, prompt_tokens, est_completion_tokens)
    
    return {
        "tier": tier,
        "complexity_score": score,
        "classification_reason": reason,
        "recommended_model": model,
        "model_name": model_name,
        "estimated_tokens": prompt_tokens + est_completion_tokens,
        "estimated_cost_usd": cost_info["actual_cost_usd"],
        "baseline_gpt4_cost_usd": cost_info["baseline_cost_usd"],
        "estimated_savings_usd": cost_info["net_savings_usd"],
        "savings_percentage": cost_info["savings_percentage"]
    }


