"""Authenticated automation management and GitHub webhook APIs."""

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from auth.dependencies import get_current_user
from config import settings
from db.automation_service import (
    automations_coll,
    create_automation,
    delete_automation,
    get_automation,
    get_execution,
    get_executions_for_automation,
    integrations_coll,
    list_automations,
    _oid,
    set_automation_status,
    update_automation,
)
from services.automation.execution_engine import run_github_bug_pipeline
from services.automation.github_adapter import validate_issue_event, verify_webhook_signature

logger = logging.getLogger("aethera.automation.api")
router = APIRouter(tags=["Automation Production"])


class AutomationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    trigger_type: str = "github_issue"
    config: Dict[str, Any] = Field(default_factory=dict)
    integration_refs: List[str] = Field(default_factory=list)


class AutomationUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    config: Optional[Dict[str, Any]] = None
    integration_refs: Optional[List[str]] = None


class TestRunRequest(BaseModel):
    event_type: str = "issues"
    payload: Dict[str, Any]


def _user_id(user: Dict[str, Any]) -> str:
    value = user.get("sub") or user.get("id")
    if not value or value in {"system", "anonymous"}:
        raise HTTPException(status_code=401, detail="Authenticated user is required")
    return str(value)


def _safe_config(config: Dict[str, Any]) -> Dict[str, Any]:
    allowed = {"github_repo", "slack_channel", "tracker_project_id", "team_id"}
    return {key: value for key, value in config.items() if key in allowed}


def _validate_integration_refs(refs: List[str], owner_id: str) -> None:
    for integration_id in refs:
        try:
            integration = integrations_coll.find_one({"_id": _oid(integration_id), "user_id": owner_id})
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid integration reference") from exc
        if not integration:
            raise HTTPException(status_code=403, detail="Integration is not owned by this user")


@router.post("", status_code=status.HTTP_201_CREATED)
def create_automation_route(payload: AutomationCreateRequest, user=Depends(get_current_user)):
    owner_id = _user_id(user)
    if payload.trigger_type != "github_issue":
        raise HTTPException(status_code=400, detail="Only github_issue automations are supported")
    if not payload.config.get("github_repo") or "/" not in payload.config["github_repo"]:
        raise HTTPException(status_code=400, detail="config.github_repo must be owner/repository")
    _validate_integration_refs(payload.integration_refs, owner_id)
    return create_automation(
        user_id=owner_id,
        name=payload.name,
        description=payload.description,
        trigger_type=payload.trigger_type,
        config=_safe_config(payload.config),
        integration_refs=payload.integration_refs,
    )


@router.get("")
def list_automation_route(user=Depends(get_current_user)):
    return list_automations(_user_id(user))


@router.get("/{automation_id}")
def get_automation_route(automation_id: str, user=Depends(get_current_user)):
    automation = get_automation(automation_id, _user_id(user))
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation


@router.patch("/{automation_id}")
def update_automation_route(automation_id: str, payload: AutomationUpdateRequest, user=Depends(get_current_user)):
    owner_id = _user_id(user)
    updates = payload.model_dump(exclude_unset=True)
    if "integration_refs" in updates:
        _validate_integration_refs(updates["integration_refs"] or [], owner_id)
    if "config" in updates:
        updates["config"] = _safe_config(updates["config"] or {})
    automation = update_automation(automation_id, owner_id, updates)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation


@router.delete("/{automation_id}")
def delete_automation_route(automation_id: str, user=Depends(get_current_user)):
    if not delete_automation(automation_id, _user_id(user)):
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True}


def _set_status(automation_id: str, user: Dict[str, Any], target: str):
    owner_id = _user_id(user)
    if not set_automation_status(automation_id, owner_id, target):
        raise HTTPException(status_code=404, detail="Automation not found")
    return get_automation(automation_id, owner_id)


@router.post("/{automation_id}/activate")
def activate_automation(automation_id: str, user=Depends(get_current_user)):
    return _set_status(automation_id, user, "ACTIVE")


@router.post("/{automation_id}/deactivate")
def deactivate_automation(automation_id: str, user=Depends(get_current_user)):
    return _set_status(automation_id, user, "PAUSED")


@router.post("/{automation_id}/test")
def test_automation(automation_id: str, payload: TestRunRequest, user=Depends(get_current_user)):
    owner_id = _user_id(user)
    automation = get_automation(automation_id, owner_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    valid, reason = validate_issue_event(payload.event_type, payload.payload)
    if not valid:
        raise HTTPException(status_code=400, detail=reason)
    return run_github_bug_pipeline(
        automation_id=automation_id,
        automation_config=automation.get("config", {}),
        event_type=payload.event_type,
        delivery_id=f"test:{automation_id}",
        payload=payload.payload,
        test_mode=True,
    )


@router.get("/executions/{execution_id}")
def get_execution_route(execution_id: str, user=Depends(get_current_user)):
    execution = get_execution(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    if not get_automation(execution["automation_id"], _user_id(user)):
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution


@router.get("/{automation_id}/executions")
def list_execution_route(automation_id: str, user=Depends(get_current_user)):
    return get_executions_for_automation(automation_id, _user_id(user))


@router.post("/github/webhook")
async def github_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(default=None),
    x_github_event: Optional[str] = Header(default=None),
    x_github_delivery: Optional[str] = Header(default=None),
):
    raw_body = await request.body()
    if not verify_webhook_signature(raw_body, x_hub_signature_256, settings.AUTOMATION_GITHUB_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid GitHub webhook signature")
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Malformed JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be an object")

    valid, reason = validate_issue_event(x_github_event or "", payload)
    if not valid:
        if not payload.get("issue") or not payload.get("repository"):
            raise HTTPException(status_code=400, detail=reason)
        return {"status": "SKIPPED", "reason": reason}

    repo_full_name = payload["repository"].get("full_name")
    candidates = list(automations_coll.find({"status": "ACTIVE", "config.github_repo": repo_full_name}).limit(2))
    if len(candidates) != 1:
        raise HTTPException(status_code=404, detail="No unique active automation is configured for this repository")

    automation = candidates[0]
    return run_github_bug_pipeline(
        automation_id=str(automation["_id"]),
        automation_config=automation.get("config", {}),
        event_type=x_github_event or "",
        delivery_id=x_github_delivery or "missing-delivery",
        payload=payload,
        test_mode=False,
    )
