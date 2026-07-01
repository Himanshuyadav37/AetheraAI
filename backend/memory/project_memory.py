from datetime import datetime

from db.mongo_client import db

memory_collection = db["project_memory"]


def save_memory(data):
    data.setdefault("timestamp", datetime.utcnow())
    memory_collection.insert_one(data)


def get_project_memory(project_id: str):
    memories = list(
        memory_collection.find({"project_id": project_id}).sort(
            "timestamp", -1
        )
    )
    for m in memories:
        m.pop("_id", None)
    return memories


def get_recent_memory(project_id: str, limit: int = 10) -> list:
    return get_project_memory(project_id)[:limit]


def format_project_memory(project_id: str) -> str:
    memories = get_recent_memory(project_id)
    if not memories:
        return ""
    lines = [
        f"- [{m.get('agent', 'agent')}] {m.get('note', m.get('content', ''))}"
        for m in reversed(memories)
    ]
    return "Project Memory:\n" + "\n".join(lines)