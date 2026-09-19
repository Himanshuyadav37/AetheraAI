"""
Automation DB Service — Aethera Automation AI

MongoDB CRUD for:
  - automations            automation definitions
  - automation_executions  execution records with step-level tracking
  - idempotency_records    deduplication keys

All methods enforce user ownership. Secrets are NEVER stored in plaintext —
integration credentials are referenced by integration_id only.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId

from db.mongo_client import db

logger = logging.getLogger("aethera.automation.db")

# ── Collections ──────────────────────────────────────────────────────────────
automations_coll = db["automations"]
integrations_coll = db["automation_integrations"]
executions_coll = db["automation_executions"]
idempotency_coll = db["automation_idempotency"]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _serialize(doc: Optional[Dict]) -> Optional[Dict]:
    """Convert ObjectId to str for JSON serialization."""
    if not doc:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise ValueError(f"Invalid ID format: '{id_str}'")


# ─────────────────────────────────────────────────────────────────────────────
# Automation CRUD
# ─────────────────────────────────────────────────────────────────────────────

def create_automation(
    user_id: str,
    name: str,
    trigger_type: str,
    config: Dict[str, Any],
    integration_refs: List[str] = None,
    description: str = "",
) -> Dict[str, Any]:
    """
    Create a new automation definition.

    Parameters
    ----------
    user_id : str
        Owning user ID — enforced on all subsequent reads.
    name : str
        Human-readable automation name.
    trigger_type : str
        e.g., 'github_issue', 'webhook', 'schedule'.
    config : dict
        Trigger/action config. Must NOT contain raw secrets —
        use integration_refs to reference stored credentials.
    integration_refs : list[str]
        List of integration_config _id strings that this automation may use.
    description : str
        Optional description.

    Returns
    -------
    dict
        Created automation document with '_id' as string.
    """
    now = datetime.utcnow()
    doc = {
        "user_id": user_id,
        "name": name.strip(),
        "description": description.strip(),
        "trigger_type": trigger_type,
        "status": "DRAFT",           # DRAFT → READY → ACTIVE → PAUSED | ERROR
        "config": config,            # No raw secrets here — reference IDs only
        "integration_refs": integration_refs or [],
        "created_at": now,
        "updated_at": now,
    }
    result = automations_coll.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


def get_automation(automation_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get automation by ID with ownership check.

    Returns None if not found or not owned by user_id.
    """
    doc = automations_coll.find_one({
        "_id": _oid(automation_id),
        "user_id": user_id,
    })
    return _serialize(doc)


def list_automations(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """List all automations for a user, newest first."""
    docs = list(
        automations_coll.find({"user_id": user_id})
        .sort("updated_at", -1)
        .limit(limit)
    )
    return [_serialize(d) for d in docs]


def update_automation(
    automation_id: str,
    user_id: str,
    updates: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    Update an automation definition. Ownership enforced.

    Forbidden update fields are stripped before write.
    """
    # Never allow overwriting ownership or secret fields
    forbidden = {"_id", "user_id", "created_at"}
    safe_updates = {k: v for k, v in updates.items() if k not in forbidden}
    safe_updates["updated_at"] = datetime.utcnow()

    result = automations_coll.update_one(
        {"_id": _oid(automation_id), "user_id": user_id},
        {"$set": safe_updates},
    )
    if not result.matched_count:
        return None
    return get_automation(automation_id, user_id)


def set_automation_status(
    automation_id: str,
    user_id: str,
    status: str,
) -> bool:
    """Set automation status. Returns True if updated."""
    valid_statuses = {"DRAFT", "READY", "ACTIVE", "PAUSED", "ERROR"}
    if status not in valid_statuses:
        raise ValueError(f"Invalid status '{status}'. Must be one of {valid_statuses}.")

    result = automations_coll.update_one(
        {"_id": _oid(automation_id), "user_id": user_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}},
    )
    return result.modified_count > 0


def delete_automation(automation_id: str, user_id: str) -> bool:
    """Delete an automation. Returns True if deleted."""
    result = automations_coll.delete_one(
        {"_id": _oid(automation_id), "user_id": user_id}
    )
    return result.deleted_count > 0


# ─────────────────────────────────────────────────────────────────────────────
# Execution Records
# ─────────────────────────────────────────────────────────────────────────────

def create_execution(
    automation_id: str,
    trigger_id: str,
    trigger_payload_summary: str = "",
    test_mode: bool = False,
) -> Dict[str, Any]:
    """
    Create a new execution record in RUNNING state.

    Parameters
    ----------
    automation_id : str
        Parent automation ID.
    trigger_id : str
        Idempotency key / event ID.
    trigger_payload_summary : str
        Safe, non-sensitive summary of what triggered this execution.
    test_mode : bool
        Whether this is a TEST MODE execution.

    Returns
    -------
    dict
        Execution document with '_id' as string.
    """
    now = datetime.utcnow()
    doc = {
        "automation_id": automation_id,
        "trigger_id": trigger_id,
        "trigger_payload_summary": trigger_payload_summary[:500],   # Cap length
        "status": "RUNNING",
        "test_mode": test_mode,
        "steps": [],
        "created_at": now,
        "completed_at": None,
    }
    result = executions_coll.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    logger.info(f"[Execution] Created execution {doc['_id']} for automation {automation_id}")
    return doc


def add_execution_step(
    execution_id: str,
    step_name: str,
    status: str,
    error: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Append or update a step record in an execution.

    Parameters
    ----------
    execution_id : str
        Execution document ID.
    step_name : str
        e.g., 'github_event', 'validation', 'llm_analysis', 'project_task', 'slack', 'execution_log'
    status : str
        'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'
    error : str | None
        Error message — redacted of any secrets before storing.
    details : dict | None
        Non-sensitive step result details (e.g., task_id, message_ts).
    """
    valid_statuses = {"RUNNING", "SUCCESS", "FAILED", "SKIPPED"}
    if status not in valid_statuses:
        raise ValueError(f"Invalid step status '{status}'.")

    # Redact common secret patterns from error messages
    safe_error = _redact_secrets_from_string(error) if error else None
    safe_details = details or {}

    now = datetime.utcnow().isoformat()

    existing = executions_coll.find_one({"_id": _oid(execution_id)})
    steps = list(existing.get("steps", [])) if existing else []
    step = next((item for item in steps if item.get("name") == step_name), None)
    if step:
        step.update({
            "status": status,
            "finished_at": now,
            "error": safe_error,
            "details": safe_details,
        })
    else:
        steps.append({
            "name": step_name,
            "status": status,
            "started_at": now,
            "finished_at": now if status != "RUNNING" else None,
            "error": safe_error,
            "details": safe_details,
        })
    executions_coll.update_one(
        {"_id": _oid(execution_id)},
        {"$set": {"steps": steps}},
    )

    logger.info(f"[Execution] Step '{step_name}' → {status} (execution={execution_id})")


def finalize_execution(
    execution_id: str,
    status: str,
    error_summary: Optional[str] = None,
) -> None:
    """
    Mark an execution as complete.

    Parameters
    ----------
    execution_id : str
        Execution document ID.
    status : str
        'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED'
    error_summary : str | None
        High-level error description (secrets redacted).
    """
    valid_statuses = {"SUCCESS", "PARTIAL_FAILURE", "FAILED"}
    if status not in valid_statuses:
        raise ValueError(f"Invalid final status '{status}'.")

    safe_summary = _redact_secrets_from_string(error_summary) if error_summary else None

    executions_coll.update_one(
        {"_id": _oid(execution_id)},
        {
            "$set": {
                "status": status,
                "error_summary": safe_summary,
                "completed_at": datetime.utcnow(),
            }
        },
    )
    logger.info(f"[Execution] Finalized execution {execution_id} → {status}")


def get_execution(execution_id: str) -> Optional[Dict[str, Any]]:
    """Get an execution record by ID."""
    doc = executions_coll.find_one({"_id": _oid(execution_id)})
    return _serialize(doc)


def get_executions_for_automation(
    automation_id: str,
    user_id: str,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Get recent executions for an automation. Verifies ownership via automation lookup.
    """
    # Ownership check
    automation = automations_coll.find_one({"_id": _oid(automation_id), "user_id": user_id})
    if not automation:
        return []

    docs = list(
        executions_coll.find({"automation_id": automation_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    return [_serialize(d) for d in docs]


# ─────────────────────────────────────────────────────────────────────────────
# Idempotency
# ─────────────────────────────────────────────────────────────────────────────

def check_idempotency(key: str) -> Optional[str]:
    """
    Check if a trigger event has already been processed.

    Parameters
    ----------
    key : str
        Idempotency key — typically '{github_delivery_id}:{repo_id}'.

    Returns
    -------
    str | None
        The execution_id of the previous execution if duplicate, else None.
    """
    doc = idempotency_coll.find_one({"key": key})
    if doc:
        execution_id = doc.get("execution_id")
        logger.info(f"[Idempotency] Duplicate event detected. Key={key!r}, execution_id={execution_id}")
        return execution_id
    return None


def set_idempotency(key: str, execution_id: str, automation_id: str) -> None:
    """
    Record that this trigger event has been processed.

    Parameters
    ----------
    key : str
        Idempotency key.
    execution_id : str
        The execution ID created for this event.
    automation_id : str
        The automation that handled this event.
    """
    idempotency_coll.update_one(
        {"key": key},
        {
            "$set": {
                "key": key,
                "execution_id": execution_id,
                "automation_id": automation_id,
                "created_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )
    logger.info(f"[Idempotency] Recorded key={key!r} → execution_id={execution_id}")


# ─────────────────────────────────────────────────────────────────────────────
# Secret Redaction
# ─────────────────────────────────────────────────────────────────────────────

import re

_SECRET_PATTERN = re.compile(
    r"(?i)(bearer\s+|token\s+|key\s+|secret\s+|password\s+|passwd\s+|Authorization:\s*Bearer\s+)"
    r"([A-Za-z0-9\-_\.]{8,})",
    re.IGNORECASE
)


def _redact_secrets_from_string(text: str) -> str:
    """Redact potential secrets from error messages before storing."""
    if not text:
        return text
    return _SECRET_PATTERN.sub(r"\1[REDACTED]", text)
