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
        existing_count = conversations_collection.count_documents({"user_id": user_id, "agent_type": agent_type})
        if existing_count >= limit:
            raise HTTPException(
                status_code=400,
                detail=f"Limit exceeded: You are allowed only {limit} chat(s) in {agent_type} AI. Please delete the existing one to start a new chat."
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
    attachments: list = None
):

    print(
        f"Saving Message -> {role}: {content[:50]}"
    )

    msg_data = {
        "role": role,
        "content": content
    }
    if attachments is not None:
        msg_data["attachments"] = attachments

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
    if user_id:
        query["user_id"] = user_id
    if agent_type:
        query["agent_type"] = agent_type

    conversations = list(

        conversations_collection.find(
            query,
            {
                "messages": 0
            }
        ).sort(
            "updated_at",
            -1
        )

    )

    for conversation in conversations:

        conversation["_id"] = str(
            conversation["_id"]
        )

    return conversations


def get_conversation_by_id(
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