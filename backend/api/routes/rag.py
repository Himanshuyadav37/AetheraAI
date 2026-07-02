import os
import json
import logging
import asyncio
from pathlib import Path
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from bson import ObjectId

from auth.dependencies import get_current_user
from auth.optional_auth import get_optional_user
from db.mongo_client import users_collection
from db.rag_models import (
    create_organization,
    get_organization,
    get_user_organizations,
    get_all_organizations,
    delete_organization,
    create_knowledge_base,
    get_knowledge_base,
    get_organization_kbs,
    delete_knowledge_base,
    list_documents,
    delete_document,
    get_index_job,
    create_index_job,
    list_active_jobs,
    delete_session_record
)
from services.background_indexer import process_indexing_job, cancel_indexing_job
from services.search_pipeline import retrieve_layered_context
from rag.chroma_manager import get_collection, delete_collection
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

ADMIN_EMAILS = {"ydvhimanshu461@gmail.com", "admin.neuroforge@gmail.com", "admin@neuroforge.com", "admin@devpilot.ai"}

# ==========================================
# Security Role Dependencies
# ==========================================
def get_user_role(user: dict) -> str:
    email = user.get("email")
    if email in ADMIN_EMAILS:
        return "admin"
    try:
        db_user = users_collection.find_one({"_id": ObjectId(user.get("sub"))})
        if db_user and "role" in db_user:
            return db_user["role"]
    except Exception:
        pass
    return "user"

def require_admin(user=Depends(get_current_user)):
    role = get_user_role(user)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required.")
    return user

def require_manager(user=Depends(get_current_user)):
    role = get_user_role(user)
    if role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Manager permissions required.")
    return user

# ==========================================
# Organization Routes
# ==========================================
class OrgCreateRequest(BaseModel):
    name: str

@router.post("/organizations")
def create_org_route(req: OrgCreateRequest, user=Depends(require_admin)):
    org_id = create_organization(req.name, user.get("sub"))
    return {"success": True, "org_id": org_id, "name": req.name}

@router.get("/organizations")
def list_orgs_route(user=Depends(get_current_user)):
    role = get_user_role(user)
    if role == "admin":
        return get_all_organizations()
    return get_user_organizations(user.get("sub"))

@router.delete("/organizations/{org_id}")
def delete_org_route(org_id: str, user=Depends(require_admin)):
    # Delete related KBs and their documents
    kbs = get_organization_kbs(org_id)
    for kb in kbs:
        docs = list_documents(kb_id=kb["_id"])
        for doc in docs:
            file_path = doc.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
            delete_document(doc["_id"])
        delete_knowledge_base(kb["_id"])
    # Delete dynamic organization Chroma collection
    delete_collection(f"org_{org_id}")
    
    success = delete_organization(org_id)
    if not success:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"success": True, "message": "Organization deleted"}

# ==========================================
# Knowledge Base Routes
# ==========================================
class KBCreateRequest(BaseModel):
    name: str
    org_id: str
    description: str = ""

@router.post("/kb")
def create_kb_route(req: KBCreateRequest, user=Depends(require_manager)):
    # Verify manager belongs to organization or is admin
    role = get_user_role(user)
    if role != "admin":
        org = get_organization(req.org_id)
        if not org or user.get("sub") not in org.get("user_ids", []):
            raise HTTPException(status_code=403, detail="Not authorized for this organization")
            
    kb_id = create_knowledge_base(req.name, req.org_id, req.description)
    return {"success": True, "kb_id": kb_id, "name": req.name}

@router.get("/kb/{org_id}")
def list_org_kbs_route(org_id: str, user=Depends(get_current_user)):
    # Verify membership or admin
    role = get_user_role(user)
    if role != "admin":
        org = get_organization(org_id)
        if not org or user.get("sub") not in org.get("user_ids", []):
            raise HTTPException(status_code=403, detail="Not authorized for this organization")
            
    return get_organization_kbs(org_id)

@router.delete("/kb/{kb_id}")
def delete_kb_route(kb_id: str, user=Depends(require_manager)):
    kb = get_knowledge_base(kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
        
    # Delete documents belonging to this KB
    docs = list_documents(kb_id=kb_id)
    try:
        collection = get_collection(f"org_{kb['org_id']}")
    except Exception:
        collection = None

    for doc in docs:
        if collection:
            try:
                # Delete chunks from Chroma DB
                chunk_ids = [f"{doc['_id']}_{idx}" for idx in range(doc.get("chunk_count", 100))]
                collection.delete(ids=chunk_ids)
            except Exception:
                pass
        
        # Delete physical file from disk
        file_path = doc.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        delete_document(doc["_id"])
        
    delete_knowledge_base(kb_id)
    return {"success": True, "message": "Knowledge base deleted"}

# ==========================================
# Ingestion & Ingestion Job Routes
# ==========================================
@router.post("/upload")
async def upload_files_route(
    background_tasks: BackgroundTasks,
    target_type: str = Form(...), # kb, project, session
    target_id: str = Form(...),   # kb_id, project_id, session_id
    org_id: Optional[str] = Form(None),
    source_type: str = Form("file"), # file, url, github
    url: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    user=Depends(get_current_user)
):
    # Security boundaries: check access
    role = get_user_role(user)
    if target_type == "kb" and role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Manager access required to upload to Organization KB.")
        
    jobs_spawned = []
    
    # Process Web URL ingestion
    if source_type == "url":
        if not url:
            raise HTTPException(status_code=400, detail="URL parameter required for website crawling.")
        job_id = create_index_job("kb", target_id, total_files=1)
        background_tasks.add_task(
            process_indexing_job,
            job_id=job_id,
            source_path_str=url,
            source_type="url",
            target_type=target_type,
            target_id=target_id,
            org_id=org_id
        )
        jobs_spawned.append(job_id)
        
    # Process GitHub Repository ingestion
    elif source_type == "github":
        if not github_url:
            raise HTTPException(status_code=400, detail="GitHub URL parameter required.")
        job_id = create_index_job("kb", target_id, total_files=1)
        background_tasks.add_task(
            process_indexing_job,
            job_id=job_id,
            source_path_str=github_url,
            source_type="github",
            target_type=target_type,
            target_id=target_id,
            org_id=org_id
        )
        jobs_spawned.append(job_id)
        
    # Process File Ingestion
    elif source_type == "file":
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded.")
            
        # Create temp folder inside workspace
        temp_dir = Path(__file__).resolve().parents[2] / "temp_uploads"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        for file in files:
            temp_path = temp_dir / file.filename
            content = await file.read()
            with open(temp_path, "wb") as f:
                f.write(content)
                
            job_id = create_index_job(target_type, target_id, total_files=1)
            background_tasks.add_task(
                process_indexing_job,
                job_id=job_id,
                source_path_str=str(temp_path),
                source_type="file",
                target_type=target_type,
                target_id=target_id,
                org_id=org_id
            )
            jobs_spawned.append(job_id)
            
    return {"success": True, "job_ids": jobs_spawned}

@router.get("/jobs/{job_id}")
def check_job_route(job_id: str):
    job = get_index_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.post("/jobs/{job_id}/cancel")
async def cancel_job_route(job_id: str):
    success = await cancel_indexing_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True, "message": "Job cancellation initiated."}

# ==========================================
# Document Management Routes
# ==========================================
@router.get("/documents")
def get_documents_route(
    kb_id: Optional[str] = None,
    project_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user=Depends(get_optional_user)
):
    return list_documents(kb_id=kb_id, project_id=project_id, session_id=session_id)

@router.delete("/documents/{doc_id}")
def delete_document_route(doc_id: str, user=Depends(get_current_user)):
    from db.rag_models import get_document
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Check permissions
    role = get_user_role(user)
    if doc.get("kb_id") and role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Manager access required to modify org documents.")
        
    # Delete chunks from Chroma DB
    if doc.get("kb_id"):
        col_name = f"org_{doc['org_id']}"
    elif doc.get("project_id"):
        col_name = f"project_{doc['project_id']}"
    else:
        col_name = f"session_{doc['session_id']}"
        
    try:
        collection = get_collection(col_name)
        # Delete up to chunk_count items
        chunk_ids = [f"{doc_id}_{idx}" for idx in range(doc.get("chunk_count", 200))]
        collection.delete(ids=chunk_ids)
    except Exception as e:
        logger.warning(f"Failed to clear chunks from vector db: {e}")
        
    # Delete physical file from disk
    file_path = doc.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            logger.info(f"Successfully deleted physical file from disk: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to delete physical file {file_path}: {e}")

    delete_document(doc_id)
    return {"success": True, "message": "Document deleted"}

@router.get("/documents/{doc_id}/content")
def get_document_content_route(doc_id: str, user=Depends(get_optional_user)):
    from db.rag_models import get_document
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    file_path = doc.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File content not found on disk")
        
    try:
        # Binary files: merge chunks from vector store
        if file_path.lower().endswith((".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".zip")):
            col_name = f"org_{doc['org_id']}" if doc.get("kb_id") else (f"project_{doc['project_id']}" if doc.get("project_id") else f"session_{doc['session_id']}")
            collection = get_collection(col_name)
            chunk_ids = [f"{doc_id}_{idx}" for idx in range(doc.get("chunk_count", 200))]
            all_chunks = collection.get(ids=chunk_ids, include=["documents"])
            if all_chunks and "documents" in all_chunks and all_chunks["documents"]:
                docs_map = {all_chunks["ids"][i]: all_chunks["documents"][i] for i in range(len(all_chunks["ids"]))}
                ordered_docs = []
                for cid in chunk_ids:
                    if cid in docs_map:
                        ordered_docs.append(docs_map[cid])
                text_content = "\n\n".join(ordered_docs)
                return {"filename": doc["filename"], "content": text_content, "type": "text"}
            
        # Text files: read directly from disk
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return {"filename": doc["filename"], "content": content, "type": "text"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

@router.post("/reindex")
def reindex_document_route(doc_id: str, background_tasks: BackgroundTasks, user=Depends(require_manager)):
    # Quick reindexing setup
    from db.rag_models import get_document
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    job_id = create_index_job(
        "kb" if doc.get("kb_id") else ("project" if doc.get("project_id") else "session"),
        doc.get("kb_id") or doc.get("project_id") or doc.get("session_id")
    )
    
    # Delete existing Chroma segments
    col_name = f"org_{doc['org_id']}" if doc.get("kb_id") else (f"project_{doc['project_id']}" if doc.get("project_id") else f"session_{doc['session_id']}")
    try:
        collection = get_collection(col_name)
        chunk_ids = [f"{doc_id}_{idx}" for idx in range(doc.get("chunk_count", 200))]
        collection.delete(ids=chunk_ids)
    except Exception:
        pass
        
    background_tasks.add_task(
        process_indexing_job,
        job_id=job_id,
        source_path_str=doc["file_path"],
        source_type="file",
        target_type="kb" if doc.get("kb_id") else ("project" if doc.get("project_id") else "session"),
        target_id=doc.get("kb_id") or doc.get("project_id") or doc.get("session_id"),
        org_id=doc.get("org_id")
    )
    return {"success": True, "job_id": job_id}

# ==========================================
# Storage Analytics & Settings Routes
# ==========================================
@router.get("/analytics")
def get_analytics_route(org_id: Optional[str] = None, user=Depends(get_current_user)):
    docs = list_documents(org_id=org_id)
    total_size = sum(doc.get("size_bytes", 0) for doc in docs)
    total_chunks = sum(doc.get("chunk_count", 0) for doc in docs)
    
    # Calculate vector space index
    active_jobs = list_active_jobs()
    
    return {
        "total_documents": len(docs),
        "total_size_bytes": total_size,
        "total_chunks": total_chunks,
        "active_jobs_count": len(active_jobs),
        "storage_usage_percentage": min(100.0, (total_size / (5 * 1024 * 1024 * 1024)) * 100.0) # 5GB standard limit
    }

class SettingsUpdateRequest(BaseModel):
    chunk_size: int
    chunk_overlap: int
    chunk_method: str
    session_expiry_minutes: int

@router.get("/settings")
def get_settings_route():
    # Fetch settings mock config from Mongo or return defaults
    from db.mongo_client import settings_collection
    config = settings_collection.find_one({"key": "rag_settings"})
    if not config:
        return {
            "chunk_size": 1000,
            "chunk_overlap": 150,
            "chunk_method": "recursive",
            "session_expiry_minutes": 1440 # 24 Hours
        }
    config.pop("_id", None)
    return config

@router.post("/settings")
def save_settings_route(req: SettingsUpdateRequest, user=Depends(require_admin)):
    from db.mongo_client import settings_collection
    settings_collection.update_one(
        {"key": "rag_settings"},
        {"$set": {
            "chunk_size": req.chunk_size,
            "chunk_overlap": req.chunk_overlap,
            "chunk_method": req.chunk_method,
            "session_expiry_minutes": req.session_expiry_minutes
        }},
        upsert=True
    )
    return {"success": True, "message": "Settings saved successfully."}

@router.post("/sessions/clear")
def clear_session_route(session_id: str, user=Depends(get_current_user)):
    """Clear session data and delete vector index."""
    # Delete database docs
    docs = list_documents(session_id=session_id)
    for doc in docs:
        delete_document(doc["_id"])
    # Delete Chroma collection
    delete_collection(f"session_{session_id}")
    # Remove session record
    delete_session_record(session_id)
    return {"success": True, "message": "Temporary session wiped."}

# ==========================================
# Streaming RAG Chat Endpoint (SSE)
# ==========================================
class RAGChatRequest(BaseModel):
    prompt: str
    conversation_id: Optional[str] = None
    project_id: Optional[str] = None
    org_id: Optional[str] = None
    session_id: Optional[str] = None
    connectors: Optional[dict] = None

@router.post("/chat-stream")
async def chat_stream_route(req: RAGChatRequest, user=Depends(get_optional_user)):
    user_id = user.get("sub", "system")
    
    # Check if there are active session documents
    session_docs = []
    if req.session_id:
        try:
            session_docs = list_documents(session_id=req.session_id)
        except Exception as e:
            logger.error(f"Error listing session documents: {e}")

    clean_prompt = req.prompt.lower().strip("?.!, ")

    # 1. Greeting / Normal Chat Check
    greetings = {
        "hello", "hi", "hey", "hola", "greetings", "good morning", "good afternoon", "good evening", 
        "howdy", "whats up", "what's up", "yo", "hii", "hy", "kya kar rahe ho", "kya kr rhe ho", 
        "kya chal raha hai", "kya chal rha h", "ok", "okay", "okey", "hmmm", "hmm", "hm", "yes", "no", 
        "cool", "nice", "great", "thanks", "thank you", "dhanyawad", "shukriya", "bye", "goodbye", 
        "see you", "perfect", "awesome", "got it", "gotit", "smjh gaya", "samajh gaya", "thik h", "thik hai"
    }
    is_casual = clean_prompt in greetings or any(w in clean_prompt for w in [
        "kya kar rahe", "kya kr rhe", "how are you", "kya hal", "kya haal", "thank you", "shukriya"
    ])
    
    if not is_casual:
        try:
            from llm.groq_client import generate_response
            check_casual_prompt = f"""
            Determine if the following user message is a simple greeting, conversation acknowledgment, farewell, or filler feedback that can be answered directly without referencing external documents or data (e.g. "ok", "thanks!", "awesome", "yes", "no problem", "sure", "karo", "bye", "okay", "fine").
            User Message: "{req.prompt}"
            
            Respond with exactly "YES" or "NO".
            Response:"""
            res_casual = generate_response(check_casual_prompt).strip().upper()
            if "YES" in res_casual:
                is_casual = True
        except Exception:
            pass

    # 2. Identity query check ("About Me")
    bot_identity_keywords = [
        "who are you", "what is your name", "tum kaun ho", "tum kon ho", "apne baare me", 
        "about you", "your features", "neuroforge", "antigravity", "capabilities", "what can you do",
        "who created you", "who made you", "tumhe kisne banaya", "tumhe kisne bnaya", "banao apne baare me", 
        "batao apne baare me", "tell me about yourself", "introduce yourself", "apna intro do",
        "introduce karo", "apna introduction", "kisne banaya hai", "kisne bnaya h", "your creator",
        "tumhare developer", "tumhara developer", "who is your developer", "apni capabilities", 
        "apne feature", "apne features", "tum kya kya kar", "tum kya kr sakte", "tum kya kar sakte",
        "what you do", "what do you do", "about yourself", "version", "architecture", "details about you",
        "who is neuroforge", "what is neuroforge"
    ]
    is_identity_query = any(kw in clean_prompt for kw in bot_identity_keywords)
    if not is_identity_query:
        try:
            from llm.groq_client import generate_response
            check_prompt = f"""
            Determine if the following user query is asking about the assistant's identity, features, creator, capabilities, architecture, version, or who/what the assistant is (e.g. "Who are you?", "What is your name?", "What can you do?", "Who built you?").
            User Query: "{req.prompt}"
            
            Respond with exactly "YES" or "NO".
            Response:"""
            res_val = generate_response(check_prompt).strip().upper()
            if "YES" in res_val:
                is_identity_query = True
        except Exception:
            pass

    # 3. Confirmation check for general knowledge fallback
    confirming_fallback = False
    previous_query = None
    if req.conversation_id:
        try:
            from db.conversation_service import get_conversation_messages
            history_msgs = get_conversation_messages(req.conversation_id)
            if len(history_msgs) >= 2:
                last_assistant_msg = history_msgs[-1]
                last_user_msg = history_msgs[-2]
                
                # Check if the assistant asked the fallback question
                if (last_assistant_msg["role"] == "assistant" and 
                    "Would you like me to answer using my general knowledge?" in last_assistant_msg["content"]):
                    
                    from llm.groq_client import generate_response
                    is_confirm_prompt = f"""
                    The assistant previously asked: "Would you like me to answer using my general knowledge?"
                    The user has now replied: "{req.prompt}"
                    
                    Is this reply a confirmation (like "yes", "sure", "please", "karo", "do it", "haan", "okay", "yes please", etc.)?
                    Respond with exactly "YES" or "NO".
                    Response:"""
                    is_confirm_res = generate_response(is_confirm_prompt).strip().upper()
                    if "YES" in is_confirm_res:
                        confirming_fallback = True
                        previous_query = last_user_msg["content"]
        except Exception as e:
            logger.error(f"Error checking confirmation history: {e}")

    # Set initial states
    session_cleared = False
    source_layer = "global"
    chunks = []
    use_global_knowledge = False
    answer_prompt = req.prompt

    # Process identity queries
    if is_identity_query:
        # Auto-delete temporary session files if the context shifts to AI identity
        if session_docs:
            for d in session_docs:
                try:
                    col_name = f"session_{req.session_id}"
                    collection = get_collection(col_name)
                    chunk_ids = [f"{d['_id']}_{idx}" for idx in range(d.get("chunk_count", 200))]
                    collection.delete(ids=chunk_ids)
                except Exception as e:
                    logger.error(f"Error clearing session chunks on identity switch: {e}")
                
                file_path = d.get("file_path")
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass
                
                delete_document(d["_id"])
            
            try:
                delete_collection(f"session_{req.session_id}")
            except Exception:
                pass
            session_cleared = True
            session_docs = []

        # Retrieve context STRICTLY from organization knowledge base (admin uploads)
        org_ids = ["neuroforge_knowledge"]
        if req.org_id:
            org_ids.append(f"org_{req.org_id}")
        else:
            is_admin = False
            # Check if current user is admin
            email = user.get("email")
            from api.routes.rag import ADMIN_EMAILS
            if email in ADMIN_EMAILS:
                is_admin = True
            elif user_id and user_id != "system":
                try:
                    from db.mongo_client import users_collection
                    db_user = users_collection.find_one({"_id": ObjectId(user_id)})
                    if db_user and db_user.get("role") == "admin":
                        is_admin = True
                except Exception:
                    pass
            
            if is_admin:
                try:
                    from db.rag_models import get_all_organizations
                    all_orgs = get_all_organizations()
                    if all_orgs:
                        org_ids.extend([f"org_{org['_id']}" for org in all_orgs])
                except Exception:
                    pass
            elif user_id and user_id != "system":
                try:
                    from db.rag_models import get_user_organizations
                    user_orgs = get_user_organizations(user_id)
                    if user_orgs:
                        org_ids.extend([f"org_{org['_id']}" for org in user_orgs])
                except Exception:
                    pass
        
        from services.search_pipeline import hybrid_search
        org_chunks = []
        for col_name in org_ids:
            try:
                results = hybrid_search(col_name, req.prompt, top_k=5)
                org_chunks.extend(results)
            except Exception:
                pass
        
        source_layer = "organization"
        chunks = org_chunks[:5]
        
    elif confirming_fallback and previous_query:
        use_global_knowledge = True
        answer_prompt = previous_query
        
    elif is_casual:
        use_global_knowledge = True

    elif session_docs:
        # User has uploaded PDFs/docs for this session
        # First, detect if the prompt is out-of-context (topic switch)
        doc_previews = []
        for d in session_docs:
            preview = f"Filename: {d['filename']}\nContent Preview: {d.get('text_length', 0)} bytes"
            doc_previews.append(preview)
        doc_context_summary = "\n".join(doc_previews)
        
        history_str = ""
        if req.conversation_id:
            try:
                from db.conversation_service import get_conversation_messages
                hist_msgs = get_conversation_messages(req.conversation_id)[-5:]
                history_str = "\n".join(f"{m['role']}: {m['content']}" for m in hist_msgs)
            except Exception:
                pass
                
        from llm.groq_client import generate_response
        out_of_context_prompt = f"""
        You are an expert conversational analyzer.
        The user has uploaded these temporary documents in the current chat:
        {doc_context_summary}

        The user's message: "{req.prompt}"

        Recent conversation history:
        {history_str}

        Determine if the user's message is asking about a completely different topic or is out of context relative to the uploaded documents.
        Note:
        - General questions, coding tasks, or requests that have nothing to do with the uploaded documents are OUT OF CONTEXT.
        - If it's a follow-up query, clarification, or analysis related to the uploaded documents, it is IN CONTEXT.
        - Simple greetings or conversational feedback ("hi", "hello", "thanks", "ok") are NOT considered out of context (return NO).

        Respond with exactly "YES" if it is a completely different topic/out of context, or "NO" if it is still related or a greeting.
        Response:"""
        
        try:
            out_of_context_res = generate_response(out_of_context_prompt).strip().upper()
            is_out_of_context = "YES" in out_of_context_res
        except Exception as e:
            logger.error(f"Out of context check failed: {e}")
            is_out_of_context = False

        if is_out_of_context:
            for d in session_docs:
                try:
                    # Delete chunks from Chroma
                    col_name = f"session_{req.session_id}"
                    collection = get_collection(col_name)
                    chunk_ids = [f"{d['_id']}_{idx}" for idx in range(d.get("chunk_count", 200))]
                    collection.delete(ids=chunk_ids)
                except Exception as e:
                    logger.error(f"Error purging document chunks: {e}")
                
                # Delete physical file from disk
                file_path = d.get("file_path")
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logger.info(f"Deleted out-of-context session file: {file_path}")
                    except Exception as e:
                        logger.warning(f"Failed to delete file {file_path}: {e}")
                
                delete_document(d["_id"])

            try:
                delete_collection(f"session_{req.session_id}")
            except Exception:
                pass
            
            session_cleared = True
            use_global_knowledge = True
            
        else:
            sess_col = f"session_{req.session_id}"
            try:
                from services.search_pipeline import hybrid_search
                chunks = hybrid_search(sess_col, req.prompt, top_k=5)
                source_layer = "session"
            except Exception as e:
                logger.error(f"Error doing session hybrid search: {e}")
                chunks = []
    else:
        source_layer, chunks = retrieve_layered_context(
            query=req.prompt,
            project_id=req.project_id,
            org_id=req.org_id,
            session_id=req.session_id,
            top_k=5,
            conversation_id=req.conversation_id,
            user_id=user_id
        )

    avg_confidence = 0.0
    if chunks:
        avg_confidence = sum(c.get("confidence", 0.8) for c in chunks) / len(chunks)
        
    context_str = "\n\n".join(f"Source: {c['metadata'].get('filename', 'unknown')} (Page {c['metadata'].get('page_num', 1)}):\n{c['text']}" for c in chunks)

    # Compile the final system instruction
    if use_global_knowledge:
        system_instruction = f"""
        You are NeuroForge Conversational AI. Answer the user's message directly using your global knowledge.
        Do NOT mention document context or RAG.
        {"Note: Tell the user at the very beginning of your response: 'I have removed the temporary PDF from memory as we have switched to a different topic.' followed by two newlines, then answer the question." if session_cleared else ""}
        """
        chunks = []
        source_layer = "global"
        avg_confidence = 0.0
    elif is_identity_query:
        system_instruction = f"""
        You are NeuroForge AI, an advanced conversational assistant.
        STRICT REQUIREMENT: Answer the question about yourself, your identity, features, or NeuroForge using ONLY the provided organization context below. 
        Do not search outside these documents or use outside knowledge. 
        If the information is unavailable in the context below, respond EXACTLY:
        "I couldn't find this information in the uploaded organization documents."
        
        Organization Context:
        {context_str or 'No relevant context documents found.'}
        """
    elif source_layer == "session":
        system_instruction = f"""
        You are NeuroForge AI.
        Answer the user's question using ONLY the provided PDF context below.
        If the answer is NOT in the PDF context, or if the context doesn't contain enough information to fully answer the question, you MUST reply EXACTLY:
        "I couldn't find this information in the uploaded document. Would you like me to answer using my general knowledge?"
        Do not add any other words, greetings, or formatting.
        
        PDF Context:
        {context_str}
        """
    else:
        strict_org_isolation = ""
        if source_layer == "organization":
            strict_org_isolation = """
            STRICT REQUIREMENT: Answer the question using ONLY the provided organization context. Do not search outside these documents or use outside knowledge. 
            If the information is unavailable in the context below, respond EXACTLY:
            "I couldn't find this information in the organization's knowledge base."
            """
            
        system_instruction = f"""
        You are NeuroForge RAG AI, an advanced contextual assistant.
        
        Current Retrieval Layer: {source_layer.upper()} RAG
        Confidence Score: {avg_confidence:.2f}
        
        {strict_org_isolation}
        
        CRITICAL GROUNDING RULES:
        1. If the user's question cannot be answered using the provided Retrieved Context documents, or if the context is empty, you MUST politely refuse to answer. Say exactly: "Provided context documents do not contain information to answer this question." (or equivalent in Hinglish if the user asks in Hinglish).
        2. Do NOT use any pre-existing or global knowledge to answer questions if they are not found in the context documents.
        3. Never output the text "Confidence Score", "Retrieval Layer", "RAG", or "No relevant context documents found" in your response to the user. These are internal system parameters. Answer the user's question directly without repeating the prompt metadata.
        
        Hinglish Language Guide:
        - Note that in Hindi/Hinglish (Hindi written in Latin/English script), the words "k", "ke", "ki" (e.g., "file k andar", "code ke baare me") are prepositions meaning "of", "about", "for", or "to". Do NOT mistake the single character/word "k" as a filename, letter, or variable name. Always resolve "file k" to "file of" or "inside the file".
        
        Use the following retrieved context to ground your response. Cite filenames and page numbers in your answers directly when appropriate.
        
        Retrieved Context:
        {context_str or 'No relevant context documents found.'}
        """

    async def event_generator():
        # Yield metadata packet
        metadata_packet = {
            "type": "metadata",
            "layer": source_layer,
            "confidence": avg_confidence,
            "session_cleared": session_cleared,
            "chunks": [
                {
                    "filename": c["metadata"].get("filename", "unknown"),
                    "page_num": c["metadata"].get("page_num", 1),
                    "confidence": c.get("confidence", 0.8),
                    "text_preview": c["text"][:150] + "..."
                } for c in chunks
            ]
        }
        yield f"data: {json.dumps(metadata_packet)}\n\n"
        await asyncio.sleep(0.01)
        
        prompt_with_context = f"{system_instruction}\n\nUser Question: {answer_prompt}"
        
        try:
            from llm.groq_client import stream_response
            def run_sync_stream():
                return list(stream_response(prompt_with_context))
                
            loop = asyncio.get_event_loop()
            tokens = await loop.run_in_executor(None, run_sync_stream)
            for token in tokens:
                yield f"data: {json.dumps({'type': 'content', 'delta': token})}\n\n"
                await asyncio.sleep(0.01)
                
        except Exception as e:
            logger.error(f"Chat stream generation failed: {e}")
            yield f"data: {json.dumps({'type': 'content', 'delta': f'❌ LLM Stream Error: {str(e)}'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
