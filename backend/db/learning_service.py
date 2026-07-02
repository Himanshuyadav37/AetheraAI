from datetime import datetime
from bson import ObjectId
from db.mongo_client import db

learnings_collection = db["agent_learnings"]

def save_learning(data: dict) -> str:
    """
    Saves a new learning rule to MongoDB.
    """
    data.setdefault("created_at", datetime.utcnow())
    data.setdefault("enabled", True)
    res = learnings_collection.insert_one(data)
    return str(res.inserted_id)

def get_learnings_by_user(user_id: str) -> list:
    """
    Retrieves all learning rules recorded for a user.
    """
    # Cast to string/check logic
    query = {"user_id": str(user_id)}
    # Support system/global learnings as fallback if any are defined
    query_or = [query, {"user_id": "system"}]
    
    docs = list(
        learnings_collection.find({"$or": query_or}).sort("created_at", -1)
    )
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return docs

def toggle_learning_enabled(learning_id: str, enabled: bool = None) -> bool:
    """
    Toggles or sets the enabled flag of a learning rule.
    """
    try:
        query = {"_id": ObjectId(learning_id)}
        doc = learnings_collection.find_one(query)
        if not doc:
            return False
            
        new_val = enabled if enabled is not None else not doc.get("enabled", True)
        learnings_collection.update_one(query, {"$set": {"enabled": new_val}})
        return True
    except Exception:
        return False

def delete_learning_by_id(learning_id: str) -> bool:
    """
    Permanently deletes a learning rule from the database.
    """
    try:
        res = learnings_collection.delete_one({"_id": ObjectId(learning_id)})
        return res.deleted_count > 0
    except Exception:
        return False
