from datetime import datetime
# pyrefly: ignore [missing-import]
from bson import ObjectId

from db.mongo_client import (
    conversations_collection
)


from fastapi import HTTPException

def create_conversation(
    user_id: str,
    agent_type: str,
    title: str
):
    if user_id and user_id not in ("system", "anonymous"):
        from db.mongo_client import get_user_limit
        limit = get_user_limit(user_id)
        # Count total user prompts sent in this agent type across all conversations
        all_convs = list(conversations_collection.find(
            {"user_id": user_id, "agent_type": agent_type},
            {"messages": 1}
        ))
        total_prompts = sum(
            sum(1 for m in conv.get("messages", []) if m.get("role") == "user")
            for conv in all_convs
        )
        if total_prompts >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"LIMIT_REACHED"
            )

    conversation = {

        "title": title,

        "user_id": user_id,

        "agent_type": agent_type,

        "messages": [],

        "summary": "",

        "created_at": datetime.utcnow(),

        "updated_at": datetime.utcnow()

    }

    result = conversations_collection.insert_one(
        conversation
    )

    print(
        "Conversation Created:",
        result.inserted_id
    )

    return str(
        result.inserted_id
    )


def add_message(
    conversation_id: str,
    role: str,
    content: str,
    attachments: list = None,
    result: dict = None
):

    try:
        print(f"Saving Message -> {role}: {content[:50]}")
    except Exception:
        pass

    # Enforce per-model prompt limit for user messages
    if role == "user":
        try:
            from fastapi import HTTPException
            conv = conversations_collection.find_one(
                {"_id": ObjectId(conversation_id)},
                {"user_id": 1, "agent_type": 1, "messages": 1}
            )
            if conv:
                user_id = conv.get("user_id", "system")
                agent_type = conv.get("agent_type", "conversational")
                if user_id and user_id not in ("system", "anonymous"):
                    from db.mongo_client import get_user_limit
                    limit = get_user_limit(user_id)
                    all_convs = list(conversations_collection.find(
                        {"user_id": user_id, "agent_type": agent_type},
                        {"messages": 1}
                    ))
                    total_prompts = sum(
                        sum(1 for m in c.get("messages", []) if m.get("role") == "user")
                        for c in all_convs
                    )
                    if total_prompts >= limit:
                        raise HTTPException(status_code=429, detail="LIMIT_REACHED")
        except Exception as e:
            from fastapi import HTTPException as FE
            if hasattr(e, "status_code") and e.status_code == 429:
                raise


    msg_data = {
        "role": role,
        "content": content
    }
    if attachments is not None:
        msg_data["attachments"] = attachments
    if result is not None:
        msg_data["result"] = result

    conversations_collection.update_one(

        {
            "_id": ObjectId(
                conversation_id
            )
        },

        {
            "$push": {
                "messages": msg_data
            },

            "$set": {
                "updated_at":
                datetime.utcnow()
            }
        }

    )

    print(
        "Message Saved Successfully"
    )


def get_conversation(
    conversation_id: str
):

    conversation = conversations_collection.find_one(
        {
            "_id": ObjectId(
                conversation_id
            )
        }
    )

    if conversation:

        conversation["_id"] = str(
            conversation["_id"]
        )

    return conversation


def get_conversation_messages(conversation_id: str) -> list:
    conversation = get_conversation(conversation_id)
    if not conversation:
        return []
    return conversation.get("messages", [])


def update_conversation_summary(conversation_id: str, summary: str):
    conversations_collection.update_one(
        {"_id": ObjectId(conversation_id)},
        {
            "$set": {
                "summary": summary,
                "updated_at": datetime.utcnow(),
            }
        },
    )


def get_all_conversations(user_id: str | None = None, agent_type: str | None = None):
    query = {}
    if user_id and user_id not in ("system", "anonymous"):
        query["$or"] = [
            {"user_id": user_id},
            {"user_id": "system"},
            {"user_id": "anonymous"},
            {"user_id": {"$exists": False}},
            {"owner_id": user_id}
        ]
    elif user_id:
        query["$or"] = [{"user_id": user_id}, {"user_id": "system"}, {"user_id": {"$exists": False}}]

    if agent_type:
        query["agent_type"] = agent_type

    conversations = list(
        conversations_collection.find(
            query,
            {"messages": 0}
        ).sort("updated_at", -1)
    )

    for conversation in conversations:
        conversation["_id"] = str(conversation["_id"])

    # If agent_type == "engineer", also load executions so every project run appears in history
    if agent_type == "engineer":
        from db.mongo_client import db
        try:
            exec_query = {}
            if user_id and user_id not in ("system", "anonymous"):
                exec_query["$or"] = [
                    {"user_id": user_id},
                    {"user_id": "system"},
                    {"user_id": "anonymous"},
                    {"user_id": {"$exists": False}}
                ]
            execs = list(db["executions"].find(exec_query).sort("created_at", -1).limit(50))
            existing_ids = {str(c["_id"]) for c in conversations}
            for ex in execs:
                ex_id = str(ex["_id"])
                if ex_id not in existing_ids:
                    conversations.append({
                        "_id": ex_id,
                        "title": ex.get("project_plan", {}).get("project_name") or (ex.get("idea", "Project Execution")[:50]),
                        "agent_type": "engineer",
                        "user_id": ex.get("user_id", "system"),
                        "created_at": ex.get("created_at"),
                        "updated_at": ex.get("updated_at") or ex.get("created_at")
                    })
        except Exception as e:
            print("Failed to load executions fallback in get_all_conversations:", e)

    return conversations


def get_conversation_by_id(
    conversation_id: str
):
    if not conversation_id:
        return None

    from db.mongo_client import db

    # 1. Try conversations collection
    try:
        if ObjectId.is_valid(conversation_id):
            conv = conversations_collection.find_one({"_id": ObjectId(conversation_id)})
            if conv:
                conv["_id"] = str(conv["_id"])
                return conv
    except Exception:
        pass

    try:
        conv = conversations_collection.find_one({"_id": conversation_id})
        if conv:
            conv["_id"] = str(conv["_id"])
            return conv
    except Exception:
        pass

    # 2. Try executions collection (for Engineer AI runs)
    try:
        exec_doc = None
        if ObjectId.is_valid(conversation_id):
            exec_doc = db["executions"].find_one({"_id": ObjectId(conversation_id)})
        if not exec_doc:
            exec_doc = db["executions"].find_one({"$or": [
                {"project_id": conversation_id},
                {"execution_id": conversation_id},
                {"conversation_id": conversation_id}
            ]})
        
        if exec_doc:
            exec_doc["_id"] = str(exec_doc["_id"])
            from agents.architect import generate_enterprise_blueprint
            title = exec_doc.get("project_plan", {}).get("project_name") or (exec_doc.get("idea", "")[:50]) or "Engineer Project"
            assistant_content = generate_enterprise_blueprint(exec_doc)
            
            return {
                "_id": str(exec_doc["_id"]),
                "title": title,
                "agent_type": "engineer",
                "user_id": exec_doc.get("user_id", "system"),
                "messages": [
                    {"role": "user", "content": exec_doc.get("idea", "Generate project")},
                    {"role": "assistant", "content": assistant_content, "result": exec_doc}
                ],
                "result": exec_doc,
                "created_at": exec_doc.get("created_at")
            }
    except Exception as e:
        print("[get_conversation_by_id] Execution fallback error:", e)

    # 3. Try research_sessions collection
    try:
        if ObjectId.is_valid(conversation_id):
            res_doc = db["research_sessions"].find_one({"_id": ObjectId(conversation_id)})
            if res_doc:
                res_doc["_id"] = str(res_doc["_id"])
                return res_doc
    except Exception:
        pass

    # 4. Try automation_conversations collection
    try:
        if ObjectId.is_valid(conversation_id):
            auto_doc = db["automation_conversations"].find_one({"_id": ObjectId(conversation_id)})
            if auto_doc:
                auto_doc["_id"] = str(auto_doc["_id"])
                return auto_doc
    except Exception:
        pass

    return None