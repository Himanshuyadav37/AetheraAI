from datetime import datetime, timedelta
from bson import ObjectId
from db.mongo_client import db

# Collections
organizations_collection = db["organizations"]
kb_collection = db["knowledge_bases"]
documents_collection = db["documents"]
jobs_collection = db["index_jobs"]
sessions_collection = db["sessions"]

# Serialization helper
def serialize_doc(doc):
    if not doc:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

def serialize_docs(docs):
    return [serialize_doc(d) for d in docs]

# ==========================================
# Organizations CRUD
# ==========================================
def create_organization(name: str, owner_id: str, user_ids: list = None) -> str:
    org = {
        "name": name,
        "owner_id": owner_id,
        "user_ids": user_ids or [owner_id],
        "created_at": datetime.utcnow()
    }
    result = organizations_collection.insert_one(org)
    return str(result.inserted_id)

def get_organization(org_id: str) -> dict:
    try:
        doc = organizations_collection.find_one({"_id": ObjectId(org_id)})
        return serialize_doc(doc)
    except Exception:
        return None

def get_user_organizations(user_id: str) -> list:
    docs = list(organizations_collection.find({
        "$or": [
            {"owner_id": user_id},
            {"user_ids": user_id}
        ]
    }))
    return serialize_docs(docs)

def get_all_organizations() -> list:
    docs = list(organizations_collection.find())
    return serialize_docs(docs)

def add_user_to_organization(org_id: str, user_id: str) -> bool:
    try:
        res = organizations_collection.update_one(
            {"_id": ObjectId(org_id)},
            {"$addToSet": {"user_ids": user_id}}
        )
        return res.modified_count > 0
    except Exception:
        return False

def remove_user_from_organization(org_id: str, user_id: str) -> bool:
    try:
        res = organizations_collection.update_one(
            {"_id": ObjectId(org_id)},
            {"$pull": {"user_ids": user_id}}
        )
        return res.modified_count > 0
    except Exception:
        return False

def delete_organization(org_id: str) -> bool:
    try:
        res = organizations_collection.delete_one({"_id": ObjectId(org_id)})
        return res.deleted_count > 0
    except Exception:
        return False

# ==========================================
# Knowledge Bases CRUD
# ==========================================
def create_knowledge_base(name: str, org_id: str, description: str = "") -> str:
    kb = {
        "name": name,
        "org_id": org_id,
        "description": description,
        "created_at": datetime.utcnow()
    }
    result = kb_collection.insert_one(kb)
    return str(result.inserted_id)

def get_knowledge_base(kb_id: str) -> dict:
    try:
        doc = kb_collection.find_one({"_id": ObjectId(kb_id)})
        return serialize_doc(doc)
    except Exception:
        return None

def get_organization_kbs(org_id: str) -> list:
    docs = list(kb_collection.find({"org_id": org_id}))
    return serialize_docs(docs)

def delete_knowledge_base(kb_id: str) -> bool:
    try:
        res = kb_collection.delete_one({"_id": ObjectId(kb_id)})
        return res.deleted_count > 0
    except Exception:
        return False

# ==========================================
# Documents CRUD
# ==========================================
def create_document(doc_data: dict) -> str:
    doc = {
        "org_id": doc_data.get("org_id"),
        "kb_id": doc_data.get("kb_id"),
        "project_id": doc_data.get("project_id"),
        "session_id": doc_data.get("session_id"),
        "filename": doc_data.get("filename"),
        "file_path": doc_data.get("file_path"),
        "size_bytes": doc_data.get("size_bytes", 0),
        "text_length": doc_data.get("text_length", 0),
        "hash": doc_data.get("hash", ""),
        "status": doc_data.get("status", "indexing"), # indexing, completed, failed
        "error_message": doc_data.get("error_message", ""),
        "chunk_count": doc_data.get("chunk_count", 0),
        "metadata": doc_data.get("metadata", {}),
        "created_at": datetime.utcnow()
    }
    result = documents_collection.insert_one(doc)
    return str(result.inserted_id)

def get_document(doc_id: str) -> dict:
    try:
        doc = documents_collection.find_one({"_id": ObjectId(doc_id)})
        return serialize_doc(doc)
    except Exception:
        return None

def update_document(doc_id: str, updates: dict) -> bool:
    try:
        res = documents_collection.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": updates}
        )
        return res.matched_count > 0
    except Exception:
        return False

def list_documents(org_id: str = None, kb_id: str = None, project_id: str = None, session_id: str = None) -> list:
    query = {}
    if org_id is not None:
        query["org_id"] = org_id
    if kb_id is not None:
        query["kb_id"] = kb_id
    if project_id is not None:
        query["project_id"] = project_id
    if session_id is not None:
        query["session_id"] = session_id
    
    docs = list(documents_collection.find(query).sort("created_at", -1))
    return serialize_docs(docs)

def get_document_by_hash(doc_hash: str, kb_id: str = None, org_id: str = None, project_id: str = None, session_id: str = None) -> dict:
    query = {"hash": doc_hash}
    if kb_id:
        query["kb_id"] = kb_id
    if org_id:
        query["org_id"] = org_id
    if project_id:
        query["project_id"] = project_id
    if session_id:
        query["session_id"] = session_id
        
    doc = documents_collection.find_one(query)
    return serialize_doc(doc)

def delete_document(doc_id: str) -> bool:
    try:
        res = documents_collection.delete_one({"_id": ObjectId(doc_id)})
        return res.deleted_count > 0
    except Exception:
        return False

# ==========================================
# Index Jobs CRUD
# ==========================================
def create_index_job(target_type: str, target_id: str, total_files: int = 1) -> str:
    # target_type: kb, project, session
    job = {
        "target_type": target_type,
        "target_id": target_id,
        "status": "pending", # pending, processing, completed, failed, cancelled
        "progress": 0,
        "total_files": total_files,
        "processed_files": 0,
        "error_message": "",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = jobs_collection.insert_one(job)
    return str(result.inserted_id)

def get_index_job(job_id: str) -> dict:
    try:
        doc = jobs_collection.find_one({"_id": ObjectId(job_id)})
        return serialize_doc(doc)
    except Exception:
        return None

def update_index_job(job_id: str, updates: dict) -> bool:
    try:
        updates["updated_at"] = datetime.utcnow()
        res = jobs_collection.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": updates}
        )
        return res.matched_count > 0
    except Exception:
        return False

def list_active_jobs(target_id: str = None) -> list:
    query = {"status": {"$in": ["pending", "processing"]}}
    if target_id:
        query["target_id"] = target_id
    docs = list(jobs_collection.find(query))
    return serialize_docs(docs)

# ==========================================
# Sessions (Session RAG) CRUD
# ==========================================
def create_session(session_id: str, expires_in_seconds: int = 86400) -> str:
    # Delete if exists
    sessions_collection.delete_many({"session_id": session_id})
    
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in_seconds)
    session = {
        "session_id": session_id,
        "expires_at": expires_at,
        "created_at": datetime.utcnow()
    }
    sessions_collection.insert_one(session)
    return session_id

def get_expired_sessions() -> list:
    now = datetime.utcnow()
    docs = list(sessions_collection.find({"expires_at": {"$lt": now}}))
    return [d["session_id"] for d in docs]

def delete_session_record(session_id: str):
    sessions_collection.delete_one({"session_id": session_id})
