import pytest
import io
import json
from jose import jwt
from datetime import datetime, timedelta
from bson import ObjectId

from config import settings
from db.mongo_client import db
from db.rag_models import list_documents, delete_document
from rag.chroma_manager import delete_collection

def get_auth_headers():
    # Find any user in database
    user = db["users"].find_one()
    if not user:
        # Create a mock test user for the duration of the test
        user_id = str(ObjectId())
        db["users"].insert_one({
            "_id": ObjectId(user_id),
            "username": "test_rag_user",
            "email": "test_rag@example.com",
            "role": "user"
        })
    else:
        user_id = str(user["_id"])
        
    token_data = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(minutes=60)
    }
    token = jwt.encode(token_data, settings.JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}

def test_rag_upload_and_routing(test_client):
    headers = get_auth_headers()
    session_id = "session_pytest_integration_test_123"

    # Clean up any residual document entries
    docs = list_documents(session_id=session_id)
    for d in docs:
        delete_document(d["_id"])
    try:
        delete_collection(f"session_{session_id}")
    except Exception:
        pass

    # 1. Test Unauthenticated Upload (Should fail)
    file_data = b"This is a dummy test document containing important instructions for the pipeline test."
    files = {"files": ("test_pytest_doc.txt", io.BytesIO(file_data), "text/plain")}
    data = {
        "target_type": "session",
        "target_id": session_id,
        "source_type": "file"
    }
    
    res = test_client.post("/rag/upload", data=data, files=files)
    assert res.status_code == 401 or "detail" in res.json()

    # 2. Test Authenticated Upload (Should succeed)
    files = {"files": ("test_pytest_doc.txt", io.BytesIO(file_data), "text/plain")}
    res = test_client.post("/rag/upload", data=data, files=files, headers=headers)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["success"] is True
    assert len(res_data["job_ids"]) > 0

    # 3. Test CASUAL Intent Routing (bypass document context)
    chat_payload = {
        "prompt": "Hello there, how are you doing today?",
        "conversation_id": "conv_pytest_123",
        "session_id": session_id,
        "provider": "groq"
    }
    res_stream = test_client.post("/rag/chat-stream", json=chat_payload, headers=headers)
    assert res_stream.status_code == 200
    
    # 4. Test SENSITIVE Intent Routing (must be blocked)
    chat_payload_sensitive = {
        "prompt": "What is the secret api_key password for the database?",
        "conversation_id": "conv_pytest_123",
        "session_id": session_id,
        "provider": "groq"
    }
    res_stream_sensitive = test_client.post("/rag/chat-stream", json=chat_payload_sensitive, headers=headers)
    assert res_stream_sensitive.status_code == 200
    
    # Verify refusal response packet is streamed
    lines = res_stream_sensitive.text.split("\n")
    refusal_found = False
    for line in lines:
        if line.startswith("data: "):
            try:
                packet = json.loads(line[6:])
                delta = packet.get("delta", "")
                if packet.get("type") == "content" and ("Main sensitive information" in delta or "restricted words" in delta or "safety word filters" in delta):
                    refusal_found = True
            except json.JSONDecodeError:
                pass
    assert refusal_found is True, "Sensitive keyword query was not blocked by Hinglish refusal rule."

    # Cleanup the integration test documents
    docs = list_documents(session_id=session_id)
    for d in docs:
        delete_document(d["_id"])
    try:
        delete_collection(f"session_{session_id}")
    except Exception:
        pass
