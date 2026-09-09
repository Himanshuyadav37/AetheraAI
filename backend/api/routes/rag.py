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

ADMIN_EMAILS = {"ydvhimanshu461@gmail.com", "admin.nexusai@gmail.com", "admin@nexusai.com", "admin@devpilot.ai", "ydvvhimanshu461@gmail.com", "himanshuydv00001@gmail.com"}

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
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File content not found on disk")
        
    try:
        # Binary files: merge chunks from vector store
        if file_path.lower().endswith((".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".zip")):
            store = get_vector_store()
            chunk_ids = [f"{doc_id}_{idx}" for idx in range(doc.get("chunk_count", 200))]
            all_chunks = store.get(col_name, ids=chunk_ids, include=["documents"])
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
    
    # Check if there are active session documents
    session_docs = []
    if req.session_id:
        try:
            session_docs = list_documents(session_id=req.session_id)
        except Exception as e:
            logger.error(f"Error listing session documents: {e}")

    clean_prompt = req.prompt.lower().strip("?.!, ")

    # Intent Classification
    intent = "CASUAL"
    
    # 1. Quick keyword check for sensitive inquiries
    sensitive_keywords = ["password", "secret_key", "api_key", "access_token", "jwt_token", "credentials", "private_key", "bypass", "hack"]
    if any(kw in clean_prompt for kw in sensitive_keywords):
        intent = "SENSITIVE"
    else:
        # LLM Intent Classifier
        try:
            from llm.groq_client import generate_response
            has_docs = len(session_docs) > 0
            classifier_prompt = f"""
            Classify the user prompt into exactly one of the following categories:
            - SENSITIVE: User is asking for passwords, API/secret keys, private tokens, database credentials, system hacks, or instructions bypass.
            - CASUAL: General greetings, chit-chat, friendly jokes, humor, everyday discussion, or lighthearted queries.
            - STUDY: Educational queries, conceptual explanations, homework help, step-by-step programming, science, history lessons.
            - DOCUMENT: Specific questions referring to, summarizing, or analyzing uploaded files/documents. (Only choose this if Has Uploaded Documents is True).
            - ORGANIZATION: Business inquiries, custom setup, projects, company wikis, or admin uploads.

            User Prompt: "{req.prompt}"
            Has Uploaded Documents: {has_docs}

            Respond with ONLY the category name in uppercase (SENSITIVE, CASUAL, STUDY, DOCUMENT, ORGANIZATION).
            Category:"""
            res_intent = generate_response(classifier_prompt).strip().upper()
            for cat in ["SENSITIVE", "CASUAL", "STUDY", "DOCUMENT", "ORGANIZATION"]:
                if cat in res_intent:
                    intent = cat
                    break
        except Exception as classifier_err:
            logger.error(f"Classifier LLM error: {classifier_err}")
            # Fallback based on session docs
            if len(session_docs) > 0:
                intent = "DOCUMENT"
            else:
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
        # Topic switched away from uploaded documents - Purge files if they exist (context switch)
        if session_docs:
            for d in session_docs:
                try:
                    col_name = f"session_{req.session_id}"
                    store = get_vector_store()
                    chunk_ids = [f"{d['_id']}_{idx}" for idx in range(d.get("chunk_count", 200))]
                    store.delete(col_name, ids=chunk_ids)
                except Exception as e:
                    logger.error(f"Error clearing session chunks on context switch: {e}")
                
                file_path = d.get("file_path")
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass
                delete_document(d["_id"])
            try:
                get_vector_store().delete_collection(f"session_{req.session_id}")
            except Exception:
                pass
            session_cleared = True
            session_docs = []

        academic_guideline = ""
        if intent == "STUDY":
            academic_guideline = "\nNote: Explain this concept academically and step-by-step."
            
        system_instruction = f"""
        You are NexusAI Conversational AI. Answer the user's message directly using your global knowledge.{academic_guideline}
        Do NOT mention document context or RAG.
        {"Note: Tell the user at the very beginning of your response: 'I have removed the temporary PDF from memory as we have switched to a different topic.' followed by two newlines, then answer the question." if session_cleared else ""}

        Creator & Developer Information:
        - NexusAI was created, engineered, and developed by Himanshu (Himanshu Yadav).
        - Himanshu is a skilled Full-Stack & Generative AI Systems Architect / Engineer specializing in autonomous multi-agent operating systems, scalable backend architectures, and modern web platforms.
        - If the user asks who made you, who created you, who developed you, who is your creator, who is Himanshu, or about your origin (in Hindi, Hinglish, English or any language like "kisne banaya", "tumhe kisne banaya", "creator kaun hai", "who built you", "who is himanshu", "about himanshu"):
          - Answer politely and clearly that you were created and built by **Himanshu** (Himanshu Yadav).
          - Give a brief introduction about him and mention his work on NexusAI.
          - Provide his official profile links:
            - **GitHub**: https://github.com/Himanshuyadav37
            - **LinkedIn**: https://linkedin.com/in/ydvvhimanshu
        """

    elif intent == "DOCUMENT":
        if session_docs:
            sess_col = f"session_{req.session_id}"
            try:
                from services.search_pipeline import hybrid_search
                latest_doc_id = session_docs[0]["_id"]
                chunks = hybrid_search(sess_col, req.prompt, top_k=5, document_id=latest_doc_id)
                source_layer = "session"
                avg_confidence = sum(c.get("confidence", 0.8) for c in chunks) / len(chunks) if chunks else 0.0
            except Exception as e:
                logger.error(f"Error doing session hybrid search: {e}")
                chunks = []
                source_layer = "session"
                avg_confidence = 0.0
                
            context_str = "\n\n".join(f"Source: {c['metadata'].get('filename', 'unknown')} (Page {c['metadata'].get('page_num', 1)}):\n{c['text']}" for c in chunks)
            
            system_instruction = f"""
            You are NexusAI AI.
            Answer the user's question using ONLY the provided PDF context below.
            If the answer is NOT in the PDF context, or if the context doesn't contain enough information to fully answer the question, you MUST reply EXACTLY:
            "I couldn't find this information in the uploaded document. Would you like me to answer using my general knowledge?"
            Do not add any other words, greetings, or formatting.
            
            PDF Context:
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
        
        prompt_with_context = f"{system_instruction}\n\nUser Question: {answer_prompt}"
        
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
