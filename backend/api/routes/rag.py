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
from rag.vector_store import get_vector_store
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

STRUCTURED_MARKDOWN_INSTRUCTIONS = """
RESPONSE FORMAT (MANDATORY FOR EVERY RESPONSE, INCLUDING VERY LONG RESPONSES):
- Return clean GitHub-Flavored Markdown, never a raw wall of text.
- Start substantial answers with a clear `##` title and organize content with `###` subsections.
- Use `-` bullets for grouped points and numbered lists for procedures or sequences.
- Use valid Markdown tables only when comparing or presenting structured data. A table must have one row per line:
    | Column A | Column B |
    |---|---|
    | Value | Explanation |
- Never use `||`, ASCII pipe separators, or table rows joined on one line.
- Wrap code in fenced blocks with a language identifier.
- Wrap inline mathematics in `$...$` and display mathematics in `$$...$$`; never emit bare LaTeX commands.
- End long answers with `## Summary` and 2-5 concise takeaway bullets.
"""

ADMIN_EMAILS = {"ydvhimanshu461@gmail.com", "admin.nexusai@gmail.com", "admin@nexusai.com", "admin@devpilot.ai", "ydvvhimanshu461@gmail.com", "himanshuydv00001@gmail.com"}

# ==========================================
# Security Role Dependencies
# ==========================================
def get_user_role(user) -> str:
    if not user:
        return "user"
    email = user.get("email") if isinstance(user, dict) else getattr(user, "email", None)
    email_clean = (email or "").lower().strip()
    role = user.get("role") if isinstance(user, dict) else getattr(user, "role", None)
    if email_clean in {e.lower().strip() for e in ADMIN_EMAILS} or role == "admin":
        return "admin"
    try:
        sub = user.get("sub") if isinstance(user, dict) else getattr(user, "sub", None)
        if sub and ObjectId.is_valid(str(sub)):
            db_user = users_collection.find_one({"_id": ObjectId(str(sub))})
            if db_user and "role" in db_user:
                return db_user["role"]
    except Exception:
        pass
    return role or "user"

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
    get_vector_store().delete_collection(f"org_{org_id}")
    
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
    store = get_vector_store()
    for doc in docs:
        try:
            # Delete chunks from Vector DB
            chunk_ids = [f"{doc['_id']}_{idx}" for idx in range(doc.get("chunk_count", 100))]
            store.delete(f"org_{kb['org_id']}", ids=chunk_ids)
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
            
        # Create persistent storage folder inside workspace
        uploads_dir = Path(__file__).resolve().parents[2] / "rag_data" / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        
        import time
        for file in files:
            safe_name = f"{int(time.time() * 1000)}_{file.filename}"
            save_path = uploads_dir / safe_name
            content = await file.read()
            with open(save_path, "wb") as f:
                f.write(content)
                
            job_id = create_index_job(target_type, target_id, total_files=1)
            background_tasks.add_task(
                process_indexing_job,
                job_id=job_id,
                source_path_str=str(save_path),
                source_type="file",
                target_type=target_type,
                target_id=target_id,
                org_id=org_id,
                original_filename=file.filename
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
        
    # Delete chunks from Vector DB
    if doc.get("kb_id"):
        col_name = f"org_{doc.get('org_id', '')}"
    elif doc.get("project_id"):
        col_name = f"project_{doc.get('project_id', '')}"
    else:
        col_name = f"session_{doc.get('session_id', '')}"
        
    try:
        store = get_vector_store()
        # Delete up to chunk_count items
        chunk_ids = [f"{doc_id}_{idx}" for idx in range(doc.get("chunk_count", 200))]
        store.delete(col_name, ids=chunk_ids)
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
    
    # 1. Plain text / code files: read directly from disk if exists
    if file_path and os.path.exists(file_path):
        if not file_path.lower().endswith((".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".zip")):
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                return {"filename": doc.get("filename", "document"), "content": content, "type": "text"}
            except Exception:
                pass

    # 2. Binary files or vector chunks
    if doc.get("kb_id"):
        col_name = f"org_{doc.get('org_id', '')}"
    elif doc.get("project_id"):
        col_name = f"project_{doc.get('project_id', '')}"
    else:
        col_name = f"session_{doc.get('session_id', '')}"

    try:
        store = get_vector_store()
        chunk_count = doc.get("chunk_count", 0)
        chunk_ids = [f"{doc_id}_{idx}" for idx in range(chunk_count)] if chunk_count > 0 else []
        if chunk_ids:
            all_chunks = store.get(col_name, ids=chunk_ids, include=["documents"])
            if all_chunks and "documents" in all_chunks and all_chunks["documents"]:
                docs_map = {all_chunks["ids"][i]: all_chunks["documents"][i] for i in range(len(all_chunks["ids"]))}
                ordered_docs = []
                for cid in chunk_ids:
                    if cid in docs_map and docs_map[cid]:
                        ordered_docs.append(docs_map[cid])
                if ordered_docs:
                    text_content = "\n\n".join(ordered_docs)
                    return {"filename": doc.get("filename", "document"), "content": text_content, "type": "text"}
    except Exception as e:
        logger.warning(f"Error fetching chunks for {doc_id}: {e}")
        
    # 3. Last fallback: direct read
    if file_path and os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return {"filename": doc.get("filename", "document"), "content": content, "type": "text"}
        except Exception:
            pass
            
    return {"filename": doc.get("filename", "document"), "content": "Document indexed in knowledge base.", "type": "text"}

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
        store = get_vector_store()
        chunk_ids = [f"{doc_id}_{idx}" for idx in range(doc.get("chunk_count", 200))]
        store.delete(col_name, ids=chunk_ids)
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
    # Delete Chroma/Pinecone collection/namespace
    get_vector_store().delete_collection(f"session_{session_id}")
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
    provider: Optional[str] = "groq"
    web_search: Optional[bool] = False
    messages: Optional[List[dict]] = None

@router.post("/chat-stream")
async def chat_stream_route(req: RAGChatRequest, user=Depends(get_optional_user)):
    user_id = user.get("sub", "system")

    # 0. Safety Guardrails Input Check
    from services.guardrails import validate_input
    guard = validate_input(req.prompt, user_id=user_id)
    if not guard["safe"]:
        async def blocked_generator():
            metadata_packet = {
                "type": "metadata",
                "layer": "guardrails",
                "confidence": 1.0,
                "session_cleared": False,
                "chunks": []
            }
            yield f"data: {json.dumps(metadata_packet)}\n\n"
            await asyncio.sleep(0.01)
            yield f"data: {json.dumps({'type': 'content', 'delta': guard['message']})}\n\n"
        return StreamingResponse(blocked_generator(), media_type="text/event-stream")

    answer_prompt = req.prompt
    
    # Extract short-term conversation history memory
    history_turns = []
    if req.messages and isinstance(req.messages, list):
        for m in req.messages:
            role = m.get("role", "")
            content = m.get("content", "")
            if role in ["user", "assistant"] and content and not str(content).startswith("❌ Error:"):
                history_turns.append({"role": role, "content": str(content).strip()})
    elif req.conversation_id:
        try:
            from db.conversation_service import get_conversation_messages
            db_msgs = get_conversation_messages(req.conversation_id)
            for m in db_msgs:
                role = m.get("role", "")
                content = m.get("content", "")
                if role in ["user", "assistant"] and content and not str(content).startswith("❌ Error:"):
                    history_turns.append({"role": role, "content": str(content).strip()})
        except Exception as e:
            logger.warning(f"Error reading conversation history: {e}")

    # Build concise history block (last 10 turns)
    recent_history = history_turns[-10:] if len(history_turns) > 10 else history_turns
    history_lines = []
    for h in recent_history:
        label = "User" if h["role"] == "user" else "NexusAI Assistant"
        history_lines.append(f"{label}: {h['content']}")
    history_str = "\n".join(history_lines) if history_lines else ""

    # User Profile / Long-Term Memory
    user_context = ""
    try:
        from memory.user_memory import format_user_context
        user_context = format_user_context(user_id) or ""
    except Exception:
        pass
    
    # Check if there are active session documents
    session_docs = []
    if req.session_id:
        try:
            session_docs = list_documents(session_id=req.session_id)
        except Exception as e:
            logger.error(f"Error listing session documents: {e}")

    clean_prompt = req.prompt.lower().strip("?.!, ")    # Intent Classification
    intent = "CASUAL"
    has_docs = len(session_docs) > 0
    
    # 1. Quick keyword check for sensitive inquiries
    sensitive_keywords = ["password", "secret_key", "api_key", "access_token", "jwt_token", "credentials", "private_key", "bypass", "hack"]
    if any(kw in clean_prompt for kw in sensitive_keywords):
        intent = "SENSITIVE"
    elif has_docs:
        # Check if the user prompt is asking about the document / continuing follow-up, or switching topics
        try:
            from llm.groq_client import generate_response
            recent_summary = "\n".join(f"{h['role']}: {h['content'][:150]}" for h in history_turns[-4:]) if history_turns else "None"
            classifier_prompt = f"""You are a conversational intent classifier.
The user is in a chat session with an uploaded file/PDF ({session_docs[0].get('filename', 'document')}).

Recent Chat History:
{recent_summary}

Current User Message: "{req.prompt}"

Classify into one of these:
- DOCUMENT: The user is asking about the uploaded document, asking for a summary, or asking ANY follow-up question related to the document's content, people, skills, experience, projects, topics, or prior discussion (e.g., "what is this pdf about?", "what are his skills?", "tell me about his projects", "where did he work?", "what is his experience?", "elaborate on that", "tell me more", "explain point 2", "who is he?").
- TOPIC_SWITCH: The user has completely and explicitly switched to an unrelated general topic (e.g., "write python code for merge sort", "tell me a joke about dogs", "explain how rockets fly", "what is quantum physics", "recipe for pizza").
- CASUAL: Simple standalone greetings or polite words like "hi", "hello", "thank you", "bye".

Respond with ONLY one category name (DOCUMENT, TOPIC_SWITCH, CASUAL):"""
            res_intent = generate_response(classifier_prompt).strip().upper()
            if "TOPIC_SWITCH" in res_intent:
                intent = "CASUAL"
            elif "CASUAL" in res_intent:
                intent = "CASUAL"
            elif "DOCUMENT" in res_intent:
                intent = "DOCUMENT"
            else:
                intent = "DOCUMENT"
        except Exception as classifier_err:
            logger.error(f"Classifier LLM error: {classifier_err}")
            intent = "DOCUMENT"
    else:
        # No session docs uploaded
        try:
            from llm.groq_client import generate_response
            classifier_prompt = f"""
            Classify the user prompt:
            - CASUAL: General chit-chat, greetings, questions.
            - STUDY: Educational, coding, science, mathematics lessons.
            - ORGANIZATION: Organization wikis, policy, enterprise documents.

            User Prompt: "{req.prompt}"
            Respond with ONLY the category (CASUAL, STUDY, ORGANIZATION):"""
            res_intent = generate_response(classifier_prompt).strip().upper()
            if "ORGANIZATION" in res_intent:
                intent = "ORGANIZATION"
            elif "STUDY" in res_intent:
                intent = "STUDY"
            else:
                intent = "CASUAL"
        except Exception:
            intent = "CASUAL"

    # Set initial states
    session_cleared = False
    source_layer = "global"
    chunks = []
    avg_confidence = 0.0

    # Route based on intent
    if intent == "SENSITIVE":
        async def sensitive_generator():
            metadata_packet = {
                "type": "metadata",
                "layer": "sensitive",
                "confidence": 1.0,
                "session_cleared": False,
                "chunks": []
            }
            yield f"data: {json.dumps(metadata_packet)}\n\n"
            await asyncio.sleep(0.01)
            yield f"data: {json.dumps({'type': 'content', 'delta': 'Main sensitive information nahi dikha sakta. I cannot provide sensitive information.'})}\n\n"
        return StreamingResponse(sensitive_generator(), media_type="text/event-stream")

    elif intent in ["CASUAL", "STUDY"]:
        academic_guideline = ""
        if intent == "STUDY":
            academic_guideline = "\nNote: Explain this concept academically and step-by-step."
            
        web_search_context = ""
        should_search = getattr(req, "web_search", False)
        is_greeting_only = any(w in clean_prompt for w in ["hi", "hello", "hey", "hii", "hy", "kaise ho", "thanks", "bye"]) and len(clean_prompt.split()) <= 3

        if should_search and not is_greeting_only:
            try:
                from agents.research.tools.live_search import live_multi_search
                web_results = live_multi_search(req.prompt)
                if web_results:
                    source_layer = "web_search"
                    avg_confidence = 0.95
                    web_sources = web_results[:6]

                    formatted_sources = []
                    for idx, s in enumerate(web_sources, 1):
                        formatted_sources.append(
                            f"[{idx}] Title: {s.get('title')}\n"
                            f"    Source: {s.get('source')} ({s.get('published', 'Recent')})\n"
                            f"    URL: {s.get('url')}\n"
                            f"    Snippet: {s.get('snippet')}"
                        )
                    web_search_context = "\n\n".join(formatted_sources)

                    chunks = [
                        {
                            "metadata": {
                                "filename": f"Web: {s.get('source', 'Internet')}",
                                "page_num": 1,
                                "url": s.get("url", "")
                            },
                            "text": f"{s.get('title')}: {s.get('snippet')}",
                            "confidence": 0.95
                        } for s in web_sources
                    ]
            except Exception as ws_err:
                logger.error(f"Live web search execution failed: {ws_err}")

        web_directive = ""
        if web_search_context:
            web_directive = f"""
        🌐 REAL-TIME VERIFIED WEB SEARCH CONTEXT (Live Search Results):
        {web_search_context}

        VERIFIED WEB RESPONSE INSTRUCTIONS:
        1. Synthesize your response using the real-time verified web search context above.
        2. Provide factual, up-to-date, and accurate information with dates and source details where relevant.
        3. At the end of your response, ALWAYS append a section titled "### 🌐 Verified Web Sources" containing clickable markdown links in the format:
           - [Title](URL) — Source Name
"""

        system_instruction = f"""
        You are NexusAI Conversational AI — an autonomous intelligence assistant with real-time web search and verified internet synthesis capabilities.{academic_guideline}{web_directive}
        
        Do NOT cite or mention document context unless the user specifically asks about the document.

        🌐 DYNAMIC RESPONSE LANGUAGE & SCRIPT DIRECTIVE:
        1. EXPLICIT LANGUAGE OVERRIDE: If the user explicitly asks to speak, reply, or explain in a specific language/script (e.g. "explain in Hinglish", "reply in Hindi", "English me samjhaao"), you MUST strictly respond in that requested language/script.
        2. HINGLISH MATCHING (CRITICAL): If the user's prompt is written in Hinglish (Hindi written in Roman/Latin script e.g. "kaise ho", "batao ye kaise kaam karta hai", "kya hai ye"), you MUST respond in HINGLISH (Roman/Latin script). Do NOT reply in Devanagari script (Hindi characters) unless explicitly requested!
        3. ENGLISH MATCHING: If the user writes in English, respond in clear, crisp English.
        4. DEVANAGARI HINDI MATCHING: If the user writes in Devanagari script (हिंदी), respond in Devanagari Hindi.

        Company, Creator & Developer Information:
        - NexusAI was created, engineered, and developed by the company Aethera ("Intelligence, evolved"), founded and architected by Himanshu (Himanshu Yadav).
        - Himanshu is a skilled Full-Stack & Generative AI Systems Architect / Engineer specializing in autonomous multi-agent operating systems, scalable backend architectures, and modern web platforms.
        - If the user asks which company made you, who made you, who created you, who developed you, who is your creator, what is Aethera, who is Himanshu, or about your origin (in Hindi, Hinglish, English or any language like "kis company ne banaya", "company name kya hai", "kisne banaya", "tumhe kisne banaya", "creator kaun hai", "who built you", "who is himanshu", "about himanshu", "what is aethera"):
          - Answer politely and clearly that you were built by Aethera ("Intelligence, evolved"), created and engineered by **Himanshu** (Himanshu Yadav).
          - Give a brief introduction about him and mention his work on NexusAI at Aethera.
          - Provide his official profile links:
            - **GitHub**: https://github.com/Himanshuyadav37
            - **LinkedIn**: https://linkedin.com/in/ydvvhimanshu

        {STRUCTURED_MARKDOWN_INSTRUCTIONS}
        """

    elif intent == "DOCUMENT":
        if session_docs:
            sess_col = f"session_{req.session_id}"
            try:
                from services.search_pipeline import hybrid_search, condense_query
                latest_doc_id = session_docs[0]["_id"]
                
                # If there are prior conversation turns, condense follow-up query with context
                effective_query = req.prompt
                if history_turns:
                    try:
                        effective_query = condense_query(req.prompt, req.conversation_id)
                    except Exception:
                        effective_query = req.prompt
                
                chunks = hybrid_search(sess_col, effective_query, top_k=5, document_id=latest_doc_id)
                if not chunks and effective_query != req.prompt:
                    chunks = hybrid_search(sess_col, req.prompt, top_k=5, document_id=latest_doc_id)
                
                # Fallback: if search returned no specific chunk, fetch first chunks from the document
                if not chunks:
                    store = get_vector_store()
                    fallback_data = store.get(sess_col, where={"document_id": str(latest_doc_id)}, limit=5, include=["documents", "metadatas"])
                    if fallback_data and fallback_data.get("documents"):
                        for idx, text in enumerate(fallback_data["documents"]):
                            chunks.append({
                                "text": text,
                                "metadata": fallback_data["metadatas"][idx] if fallback_data.get("metadatas") else {},
                                "confidence": 0.85,
                                "source": "session_fallback"
                            })

                source_layer = "session"
                avg_confidence = sum(c.get("confidence", 0.8) for c in chunks) / len(chunks) if chunks else 0.85
            except Exception as e:
                logger.error(f"Error doing session hybrid search: {e}")
                chunks = []
                source_layer = "session"
                avg_confidence = 0.0
                
            context_str = "\n\n".join(f"Source: {c['metadata'].get('filename', 'unknown')} (Page {c['metadata'].get('page_num', 1)}):\n{c['text']}" for c in chunks)
            
            system_instruction = f"""
            You are NexusAI Conversational Assistant.
            Answer the user's question accurately using the provided Document Context and the Conversation History.
            
            🌐 DYNAMIC RESPONSE LANGUAGE & SCRIPT DIRECTIVE:
            1. EXPLICIT LANGUAGE OVERRIDE: If the user explicitly asks to speak, reply, or explain in a specific language/script (e.g. "explain in Hinglish", "reply in Hindi", "English me samjhaao"), you MUST strictly respond in that requested language/script.
            2. HINGLISH MATCHING (CRITICAL): If the user's prompt is written in Hinglish (Hindi written in Roman/Latin script e.g. "kaise ho", "batao ye kaise kaam karta hai", "kya hai ye"), you MUST respond in HINGLISH (Roman/Latin script). Do NOT reply in Devanagari script (Hindi characters) unless explicitly requested!
            3. ENGLISH MATCHING: If the user writes in English, respond in clear, crisp English.
            4. DEVANAGARI HINDI MATCHING: If the user writes in Devanagari script (हिंदी), respond in Devanagari Hindi.

            Instructions:
            - If the user asks a follow-up question (e.g., about skills, experience, projects, education, details, or clarifications), synthesize the answer using both the Document Context and the prior conversation memory.
            - Answer in a clear, well-structured, helpful format (bullet points, bold text).
            - If the information is genuinely not present in the document or previous discussion, reply: "I couldn't find this information in the uploaded document. Would you like me to answer using my general knowledge?"

            {STRUCTURED_MARKDOWN_INSTRUCTIONS}
            
            Document Context:
            {context_str}
            """
        else:
            async def no_doc_generator():
                metadata_packet = {
                    "type": "metadata",
                    "layer": "session",
                    "confidence": 0.0,
                    "session_cleared": False,
                    "chunks": []
                }
                yield f"data: {json.dumps(metadata_packet)}\n\n"
                await asyncio.sleep(0.01)
                yield f"data: {json.dumps({'type': 'content', 'delta': 'Aapne koi document upload nahi kiya hai. Please file upload karein taaki main uske baare me bata sakoon.'})}\n\n"
            return StreamingResponse(no_doc_generator(), media_type="text/event-stream")

    elif intent == "ORGANIZATION":
        org_ids = ["org_nexusai_knowledge"]
        if req.org_id:
            org_ids.append(f"org_{req.org_id}")
        else:
            is_admin = False
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
        
        from services.search_pipeline import hybrid_search, condense_query
        search_query = req.prompt
        if req.conversation_id:
            try:
                search_query = condense_query(req.prompt, req.conversation_id)
            except Exception as ce:
                logger.error(f"Failed to condense query: {ce}")

        org_chunks = []
        for col_name in org_ids:
            try:
                results = hybrid_search(col_name, search_query, top_k=5)
                org_chunks.extend(results)
            except Exception:
                pass
        
        chunks = org_chunks[:5]
        source_layer = "organization"
        avg_confidence = sum(c.get("confidence", 0.8) for c in chunks) / len(chunks) if chunks else 0.0
        context_str = "\n\n".join(f"Source: {c['metadata'].get('filename', 'unknown')} (Page {c['metadata'].get('page_num', 1)}):\n{c['text']}" for c in chunks)
        
        system_instruction = f"""
        You are NexusAI AI, an advanced conversational assistant.
        STRICT REQUIREMENT: Answer the question about the organization, its features, policies, or NexusAI using ONLY the provided organization context below. 
        Do not search outside these documents or use outside knowledge. 
        If the information is unavailable in the context below, respond EXACTLY:
        "I couldn't find this information in the uploaded organization documents."

        {STRUCTURED_MARKDOWN_INSTRUCTIONS}
        
        Organization Context:
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

        memory_instruction = ""
        if history_str:
            memory_instruction = f"""
--- SHORT-TERM CONVERSATION MEMORY (Previous messages in this conversation) ---
{history_str}
--- END OF CONVERSATION MEMORY ---

CRITICAL SHORT-TERM MEMORY RULES:
- You have full short-term memory of the conversation turns above.
- If the user told you their name, preferences, or asked questions in previous turns above, REMEMBER and USE that information (e.g. if the user previously said "my name is Himanshu" and later asks "what is my name", you know their name is Himanshu).
- Respond in a natural, cohesive, and context-aware conversational tone.
"""

        context_blocks = [system_instruction.strip()]
        if user_context:
            context_blocks.append(user_context.strip())
        if memory_instruction:
            context_blocks.append(memory_instruction.strip())
            
        full_system_context = "\n\n".join(context_blocks)
        prompt_with_context = f"{full_system_context}\n\nUser Question: {answer_prompt}"
        
        try:
            if req.provider == "bedrock":
                from llm.bedrock_client import stream_response as bedrock_stream
                def run_sync_stream():
                    return list(bedrock_stream(prompt_with_context))
            else:
                from llm.groq_client import stream_response as groq_stream
                def run_sync_stream():
                    return list(groq_stream(prompt_with_context))
                
            loop = asyncio.get_event_loop()
            tokens = await loop.run_in_executor(None, run_sync_stream)
            full_text = "".join(tokens)
            
            # Output Guardrails validation (PII redirection, Blocked words and grounding checks)
            from services.guardrails import validate_output
            guard_out = validate_output(
                full_text, 
                context_str=context_str if intent in ["DOCUMENT", "ORGANIZATION"] else None, 
                user_id=user_id
            )
            final_text = guard_out.get("processed_text", full_text)
            
            # Record Token Usage & Enterprise Cost Savings
            try:
                from services.llm_router import record_llm_usage
                from db.mongo_client import db as mongo_db
                record_llm_usage(
                    user_id=user_id,
                    department="General" if not req.org_id else "Engineering",
                    model="bedrock/claude-3-5-sonnet" if req.provider == "bedrock" else "openai/gpt-oss-120b",
                    prompt=req.prompt,
                    output_text=final_text,
                    agent_type="conversational",
                    db=mongo_db
                )
            except Exception as usage_err:
                logger.warning(f"Failed to record token usage: {usage_err}")

            # Stream final processed text chunks
            chunk_size = 12
            for idx in range(0, len(final_text), chunk_size):
                chunk = final_text[idx:idx+chunk_size]
                yield f"data: {json.dumps({'type': 'content', 'delta': chunk})}\n\n"
                await asyncio.sleep(0.01)
                
        except Exception as e:
            logger.error(f"Chat stream generation failed: {e}")
            yield f"data: {json.dumps({'type': 'content', 'delta': f'❌ LLM Stream Error: {str(e)}'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/sessions/promote")
def promote_session(old_session_id: str, new_session_id: str, user=Depends(get_optional_user)):
    from db.mongo_client import db
    db["documents"].update_many(
        {"session_id": old_session_id},
        {"$set": {"session_id": new_session_id}}
    )
    
    db["index_jobs"].update_many(
        {"target_type": "session", "target_id": old_session_id},
        {"$set": {"target_id": new_session_id}}
    )
    
    try:
        if settings.VECTOR_STORE.lower() == "chroma":
            from rag.chroma_manager import get_chroma_client
            client = get_chroma_client()
            if client:
                safe_old = old_session_id.replace("-", "_")
                safe_new = new_session_id.replace("-", "_")
                cols = client.list_collections()
                col_names = [c.name for c in cols]
                if safe_old in col_names:
                    logger.info(f"Promoting Chroma collection from {safe_old} to {safe_new}")
                    col = client.get_collection(name=safe_old)
                    col.modify(name=safe_new)
        else:
            store = get_vector_store()
            old_ns = f"session_{old_session_id}"
            new_ns = f"session_{new_session_id}"
            all_data = store.get(old_ns, include=["documents", "metadatas"])
            if all_data and all_data.get("ids"):
                ids = all_data["ids"]
                documents = all_data["documents"]
                metadatas = all_data["metadatas"]
                from rag.embeddings import generate_embeddings
                embeddings = generate_embeddings(documents)
                store.add(new_ns, ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
                store.delete_collection(old_ns)
    except Exception as e:
        logger.error(f"Failed to rename collection/namespace from {old_session_id} to {new_session_id}: {e}")
        
    return {"success": True}
