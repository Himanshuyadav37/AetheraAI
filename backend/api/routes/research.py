from fastapi import APIRouter, Depends, HTTPException

from agents.research.supervisor import run_research_agent
from api.models.research import ResearchRequest, ResearchContinueRequest
from auth.optional_auth import get_optional_user
from db.research_service import (
    get_research_sessions,
    get_research_session,
    delete_research_session,
)

router = APIRouter()


@router.post("/start")
def start_research(request: ResearchRequest, user=Depends(get_optional_user)):
    user_id = user.get("sub", "system")
    
    # Safety Guardrails Check
    from services.guardrails import validate_input
    guard = validate_input(request.prompt, user_id=user_id)
    if not guard["safe"]:
        raise HTTPException(status_code=400, detail=guard["message"])
        
    return run_research_agent(
        prompt=request.prompt,
        session_id=request.research_session_id,
        user_id=user_id,
        research_depth=request.research_depth,
    )


@router.post("/{session_id}/continue")
def continue_research(
    session_id: str,
    request: ResearchContinueRequest,
    user=Depends(get_optional_user),
):
    session = get_research_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Research session not found")

    user_id = user.get("sub", "system")
    
    # Safety Guardrails Check
    from services.guardrails import validate_input
    guard = validate_input(request.prompt, user_id=user_id)
    if not guard["safe"]:
        raise HTTPException(status_code=400, detail=guard["message"])

    return run_research_agent(
        prompt=request.prompt,
        session_id=session_id,
        user_id=user_id,
        research_depth=request.research_depth,
    )


@router.get("/sessions")
def list_research_sessions(user=Depends(get_optional_user)):
    user_id = user.get("sub") or user.get("id") or "system"
    return get_research_sessions(user_id)


@router.get("/sessions/{session_id}")
def get_research_session_route(session_id: str, user=Depends(get_optional_user)):
    session = get_research_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Research session not found")
    return session


@router.delete("/sessions/{session_id}")
def delete_research_session_route(session_id: str):
    deleted = delete_research_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Research session not found")
    return {"success": True, "message": "Research session deleted"}