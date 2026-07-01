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
    # Delete related KBs
    kbs = get_organization_kbs(org_id)
    for kb in kbs:
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
    collection = get_collection(f"org_{kb['org_id']}")
    for doc in docs:
        try:
            # Delete chunks from Chroma DB
            chunk_ids = [f"{doc['_id']}_{idx}" for idx in range(doc.get("chunk_count", 100))]
            collection.delete(ids=chunk_ids)
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
    
    # 1. Retrieve RAG Context
    source_layer, chunks = retrieve_layered_context(
        query=req.prompt,
        project_id=req.project_id,
        org_id=req.org_id,
        session_id=req.session_id,
        top_k=5,
        conversation_id=req.conversation_id
    )
    
    # Calculate confidence score if chunk matching occurs
    avg_confidence = 0.0
    if chunks:
        avg_confidence = sum(c.get("confidence", 0.8) for c in chunks) / len(chunks)
        
    # Format system prompt
    context_str = "\n\n".join(f"Source: {c['metadata'].get('filename', 'unknown')} (Page {c['metadata'].get('page_num', 1)}):\n{c['text']}" for c in chunks)
    
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
    
    CRITICAL: Never output the text "Confidence Score", "Retrieval Layer", "RAG", or "No relevant context documents found" in your response to the user. These are internal system parameters. Answer the user's question directly without repeating the prompt metadata.
    
    Hinglish Language Guide:
    - Note that in Hindi/Hinglish (Hindi written in Latin/English script), the words "k", "ke", "ki" (e.g., "file k andar", "code ke baare me") are prepositions meaning "of", "about", "for", or "to". Do NOT mistake the single character/word "k" as a filename, letter, or variable name. Always resolve "file k" to "file of" or "inside the file".
    
    Use the following retrieved context to ground your response. Cite filenames and page numbers in your answers directly when appropriate.
    
    Retrieved Context:
    {context_str or 'No relevant context documents found.'}
    """
    
    # Helper to stream both metadata packet and LLM tokens
    async def event_generator():
        # First: Yield metadata packet
        metadata_packet = {
            "type": "metadata",
            "layer": source_layer,
            "confidence": avg_confidence,
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
        
        # Second: Stream response tokens from LLM
        prompt_with_context = f"{system_instruction}\n\nUser Question: {req.prompt}"
        
        # Call Groq client stream utility (since it's already in the codebase)
        try:
            from llm.groq_client import stream_response
            # run stream_response in thread pool to prevent blocking as it's sync generator
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
