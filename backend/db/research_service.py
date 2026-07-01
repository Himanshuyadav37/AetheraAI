from datetime import datetime
from bson import ObjectId

from db.mongo_client import research_sessions_collection


def _serialize(session):
    if not session:
        return None

    session["_id"] = str(session["_id"])
    return session


from fastapi import HTTPException

def create_research_session(data):
    user_id = data.get("user_id", "system")
    if user_id and user_id not in ("system", "anonymous"):
        from db.mongo_client import get_user_limit
        limit = get_user_limit(user_id)
        existing_count = research_sessions_collection.count_documents({"user_id": user_id})
        if existing_count >= limit:
            raise HTTPException(
                status_code=400,
                detail=f"Limit exceeded: You are allowed only {limit} research session(s). Please delete an existing research first."
            )

    now = datetime.utcnow()
    session = {
        "user_id": user_id,
        "title": data.get("title", "Untitled Research")[:80],
        "prompt": data.get("prompt", ""),
        "research_depth": data.get("research_depth", "normal"),
        "status": data.get("status", "completed"),
        "plan": data.get("plan", ""),
        "findings": data.get("findings", ""),
        "report": data.get("report", ""),
        "review": data.get("review", ""),
        "sources": data.get("sources", []),
        "timeline": data.get("timeline", []),
        "messages": data.get("messages", []),
        "created_at": now,
        "updated_at": now,
    }

    result = research_sessions_collection.insert_one(session)
    return str(result.inserted_id)


def update_research_session(session_id: str, updates: dict):
    updates["updated_at"] = datetime.utcnow()
    result = research_sessions_collection.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": updates},
    )
    return result.modified_count > 0


def append_research_message(session_id: str, role: str, content: str):
    research_sessions_collection.update_one(
        {"_id": ObjectId(session_id)},
        {
            "$push": {
                "messages": {
                    "role": role,
                    "content": content,
                    "timestamp": datetime.utcnow(),
                }
            },
            "$set": {"updated_at": datetime.utcnow()},
        },
    )


def get_research_session(session_id: str):
    try:
        session = research_sessions_collection.find_one({"_id": ObjectId(session_id)})
    except Exception:
        return None

    return _serialize(session)


def get_research_sessions(user_id: str | None = None):
    query = {}
    if user_id:
        query["user_id"] = user_id

    sessions = list(
        research_sessions_collection.find(query, {"messages": 0})
        .sort("updated_at", -1)
    )

    return [_serialize(session) for session in sessions]


def delete_research_session(session_id: str):
    try:
        result = research_sessions_collection.delete_one({"_id": ObjectId(session_id)})
        return result.deleted_count > 0
    except Exception:
        return False