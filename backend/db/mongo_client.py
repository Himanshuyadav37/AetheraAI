from pymongo import MongoClient
from config import settings

client = MongoClient(settings.MONGO_URL)

db = client[settings.DB_NAME]

users_collection = db["users"]
projects_collection = db["projects"]
history_collection = db["history"]
executions_collection = db["executions"]

# NEW
settings_collection = db["settings"]

conversations_collection = db["conversations"]
research_sessions_collection = db["research_sessions"]

def get_user_limit(user_id: str) -> int:
    """Helper to query a user's dynamic limit, defaulting to 1."""
    if not user_id or user_id in ("system", "anonymous"):
        return 1
    try:
        from bson import ObjectId
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if user and "limit" in user:
            return int(user["limit"])
    except Exception:
        pass
    return 1

