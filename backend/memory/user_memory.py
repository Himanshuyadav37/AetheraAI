from datetime import datetime

from db.mongo_client import db

user_memory_collection = db["user_memory"]


def get_user_profile(user_id: str) -> dict:
    doc = user_memory_collection.find_one(
        {"user_id": user_id, "type": "profile"}
    )
    if not doc:
        return {}
    doc.pop("_id", None)
    return doc.get("data", {})


def save_user_profile(user_id: str, profile: dict):
    user_memory_collection.update_one(
        {"user_id": user_id, "type": "profile"},
        {
            "$set": {
                "data": profile,
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )


def add_long_term_memory(user_id: str, fact: str, category: str = "general"):
    user_memory_collection.insert_one(
        {
            "user_id": user_id,
            "type": "fact",
            "category": category,
            "content": fact,
            "created_at": datetime.utcnow(),
        }
    )


def get_long_term_memories(user_id: str, limit: int = 20) -> list:
    memories = list(
        user_memory_collection.find(
            {"user_id": user_id, "type": "fact"}
        )
        .sort("created_at", -1)
        .limit(limit)
    )
    for m in memories:
        m.pop("_id", None)
    return memories


def format_user_context(user_id: str) -> str:
    profile = get_user_profile(user_id)
    facts = get_long_term_memories(user_id, limit=10)

    parts = []
    if profile:
        parts.append(f"User Profile: {profile}")
    if facts:
        fact_lines = [f"- {m['content']}" for m in reversed(facts)]
        parts.append("Long-term Memory:\n" + "\n".join(fact_lines))
    return "\n\n".join(parts) if parts else ""
