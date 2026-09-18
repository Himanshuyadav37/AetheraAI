from fastapi import APIRouter, Depends, Query
from auth.dependencies import get_current_user
from auth.optional_auth import get_optional_user
from services.usage_tracker import UsageTracker

router = APIRouter()


@router.get("/summary")
def get_usage_summary(current_user=Depends(get_current_user)):
    """
    Returns monthly and all-time token usage summary for the authenticated user.
    """
    user_id = str(current_user.get("sub") or current_user.get("id") or "system")
    return UsageTracker.get_usage_summary(user_id)


@router.get("/velocity")
def get_usage_velocity(
    range: str = Query("7d", pattern="^(24h|7d|30d)$"),
    current_user=Depends(get_current_user)
):
    """
    Returns token usage velocity aggregated by hour (24h) or day (7d, 30d).
    """
    user_id = str(current_user.get("sub") or current_user.get("id") or "system")
    return UsageTracker.get_velocity_data(user_id, time_range=range)


@router.get("/modules")
def get_module_workload(current_user=Depends(get_current_user)):
    """
    Returns percentage and token breakdown across modules/agents (Engineer, Research, Education, Automation, Conversation).
    """
    user_id = str(current_user.get("sub") or current_user.get("id") or "system")
    return UsageTracker.get_agent_workload_breakdown(user_id)


@router.get("/projects")
def get_projects_usage(current_user=Depends(get_current_user)):
    """
    Returns token consumption grouped by project.
    """
    user_id = str(current_user.get("sub") or current_user.get("id") or "system")
    return UsageTracker.get_project_usage(user_id)


@router.get("/conversations")
def get_conversations_usage(current_user=Depends(get_current_user)):
    """
    Returns token consumption grouped by conversation.
    """
    user_id = str(current_user.get("sub") or current_user.get("id") or "system")
    return UsageTracker.get_conversation_usage(user_id)


@router.get("/memory")
def get_memory_stats(current_user=Depends(get_current_user)):
    """
    Returns real vector counts and memory items.
    """
    user_id = str(current_user.get("sub") or current_user.get("id") or "system")
    return UsageTracker.get_memory_and_vector_stats(user_id)


@router.get("/credits")
def get_credits_stats(current_user=Depends(get_current_user)):
    """
    Returns compute credits status (shows is_available=False if no compute jobs exist).
    """
    user_id = str(current_user.get("sub") or current_user.get("id") or "system")
    return UsageTracker.get_compute_credits(user_id)


@router.get("/activities")
def get_recent_activities(
    limit: int = Query(5, ge=1, le=50),
    current_user=Depends(get_current_user)
):
    """
    Returns real recent activities/executions for the user.
    """
    user_id = str(current_user.get("sub") or current_user.get("id") or "system")
    return UsageTracker.get_recent_activities(user_id, limit=limit)
