from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
import logging

from db.mongo_client import computer_sessions_collection

logger = logging.getLogger("aethera.astra.db")

def _serialize(session: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not session:
        return None
    session_copy = dict(session)
    if "_id" in session_copy:
        session_copy["_id"] = str(session_copy["_id"])
    return session_copy


def create_or_update_computer_session(
    session_id: str,
    user_id: str = "system",
    title: str = "Astra Computer Task",
    prompt: str = "",
    steps: Optional[List[Dict[str, Any]]] = None,
    final_output: Optional[str] = None,
    status: str = "completed",
    pending_approval: Optional[Dict[str, Any]] = None,
    system_telemetry: Optional[Dict[str, Any]] = None
) -> str:
    """Create or update a persistent Astra computer session record."""
    now = datetime.utcnow()
    existing = computer_sessions_collection.find_one({"session_id": session_id})

    if existing:
        update_data: Dict[str, Any] = {
            "updated_at": now,
            "status": status,
            "pending_approval": pending_approval,
            "system_telemetry": system_telemetry or {}
        }
        if title and title != "Astra Computer Task":
            update_data["title"] = title[:80]
        if prompt:
            update_data["last_prompt"] = prompt
        if final_output:
            update_data["final_output"] = final_output
        if steps:
            update_data["steps"] = steps

        computer_sessions_collection.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        return str(existing.get("_id", session_id))
    else:
        new_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "title": title[:80] if title else "Astra Computer Task",
            "prompt": prompt,
            "last_prompt": prompt,
            "steps": steps or [],
            "final_output": final_output or "",
            "status": status,
            "pending_approval": pending_approval,
            "system_telemetry": system_telemetry or {},
            "created_at": now,
            "updated_at": now,
        }
        res = computer_sessions_collection.insert_one(new_doc)
        return str(res.inserted_id)


def get_computer_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve session by session_id or MongoDB ObjectId."""
    try:
        session = computer_sessions_collection.find_one({"session_id": session_id})
        if not session and ObjectId.is_valid(session_id):
            session = computer_sessions_collection.find_one({"_id": ObjectId(session_id)})
        return _serialize(session)
    except Exception as e:
        logger.warning(f"Error fetching computer session {session_id}: {e}")
        return None


def get_computer_sessions(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """List recent computer sessions for user."""
    query: Dict[str, Any] = {}
    if user_id and user_id not in ("system", "anonymous"):
        query["$or"] = [
            {"user_id": user_id},
            {"user_id": "system"},
            {"user_id": "anonymous"},
            {"user_id": {"$exists": False}}
        ]
    elif user_id:
        query["$or"] = [{"user_id": user_id}, {"user_id": "system"}, {"user_id": "anonymous"}, {"user_id": {"$exists": False}}]

    try:
        sessions = list(
            computer_sessions_collection.find(query, {"screenshot": 0})
            .sort("updated_at", -1)
            .limit(50)
        )
        return [_serialize(s) for s in sessions if s]
    except Exception as e:
        logger.warning(f"Error listing computer sessions for user {user_id}: {e}")
        return []


def delete_computer_session(session_id: str) -> bool:
    """Delete session by session_id or MongoDB ObjectId."""
    try:
        res = computer_sessions_collection.delete_one({"session_id": session_id})
        if res.deleted_count == 0 and ObjectId.is_valid(session_id):
            res = computer_sessions_collection.delete_one({"_id": ObjectId(session_id)})
        return res.deleted_count > 0
    except Exception as e:
        logger.warning(f"Error deleting computer session {session_id}: {e}")
        return False
