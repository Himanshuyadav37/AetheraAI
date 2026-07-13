import os
import hashlib
import logging
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

from db.rag_models import (
    get_index_job,
    update_index_job,
    create_document,
    update_document,
    get_document_by_hash,
    delete_document
)
from services.document_processor import parse_file, parse_url, parse_github
from services.chunking import chunk_document
from rag.chroma_manager import get_collection, delete_collection
from rag.embeddings import generate_embeddings

logger = logging.getLogger(__name__)

def compute_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()

async def process_indexing_job(
    job_id: str, 
    source_path_str: str, 
    source_type: str, # "file", "zip", "url", "github"
    target_type: str, # "kb", "project", "session"
    target_id: str,   # kb_id, project_id, session_id
    org_id: str = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
    chunk_method: str = "recursive"
):
    """Processes document ingestion in a background task with cancellation hooks."""
    logger.info(f"Starting indexing job {job_id} for target {target_type}/{target_id}")
    
    # 1. Update job to processing
    update_index_job(job_id, {"status": "processing", "progress": 10})
    
    # Resolve dynamic Chroma collection name
    if target_type == "kb":
        collection_name = f"org_{org_id}"
    elif target_type == "project":
        collection_name = f"project_{target_id}"
    else:
        collection_name = f"session_{target_id}"
        
    try:
        # Check cancellation
        job = get_index_job(job_id)
        if job and job.get("status") == "cancelled":
            logger.info(f"Job {job_id} was cancelled before starting.")
            return

        # 2. Parse documents based on source type
        pages = []
        filename = ""
        file_size = 0
        file_hash = ""
        
        if source_type == "file":
            path = Path(source_path_str)
            filename = path.name
            if path.exists():
                file_size = path.stat().st_size
                with open(path, "rb") as f:
                    file_hash = compute_file_hash(f.read())
            
            # Check duplicate / existing document by hash to reuse embeddings
            existing_doc = get_document_by_hash(
                file_hash, 
                kb_id=target_id if target_type == "kb" else None,
                project_id=target_id if target_type == "project" else None,
                session_id=target_id if target_type == "session" else None
            )
            
            if existing_doc:
                logger.info(f"Document {filename} with hash {file_hash} already indexed. Reusing existing entries.")
                update_index_job(job_id, {
                    "status": "completed",
                    "progress": 100,
                    "processed_files": 1
                })
                return
                
            # Parse normal file
            pages = parse_file(path)
            
        elif source_type == "url":
            filename = source_path_str
            file_hash = compute_file_hash(source_path_str.encode("utf-8"))
            pages = parse_url(source_path_str)
            file_size = len(pages[0]["text"]) if pages else 0
            
        elif source_type == "github":
            filename = source_path_str.split("/")[-1]
            file_hash = compute_file_hash(source_path_str.encode("utf-8"))
            pages = parse_github(source_path_str)
            file_size = sum(len(p["text"]) for p in pages)
            
        # Check cancellation after parsing
        job = get_index_job(job_id)
        if job and job.get("status") == "cancelled":
            logger.info(f"Job {job_id} was cancelled during parsing.")
            return
            
        if not pages:
            raise ValueError("No text content could be extracted from the source.")
            
        update_index_job(job_id, {"progress": 40})
        
        # 3. Create initial document entry in MongoDB
        doc_meta = {
            "org_id": org_id,
            "kb_id": target_id if target_type == "kb" else None,
            "project_id": target_id if target_type == "project" else None,
            "session_id": target_id if target_type == "session" else None,
            "filename": filename,
            "file_path": source_path_str,
            "size_bytes": file_size,
            "text_length": sum(len(p["text"]) for p in pages),
            "hash": file_hash,
            "status": "indexing",
            "chunk_count": 0
        }
        doc_id = create_document(doc_meta)
        
        # 4. Chunk parsed text
        chunks = chunk_document(pages, chunk_size, chunk_overlap, chunk_method)
        update_index_job(job_id, {"progress": 60})
        
        # Check cancellation before vector database upload
        job = get_index_job(job_id)
        if job and job.get("status") == "cancelled":
            delete_document(doc_id)
            logger.info(f"Job {job_id} was cancelled before DB ingest.")
            return

        # 5. Generate embeddings and add to ChromaDB
        if chunks:
            collection = get_collection(collection_name)
            
            chunk_texts = [c["text"] for c in chunks]
            logger.info(f"Generating embeddings for {len(chunk_texts)} chunks...")
            
            # Run embedding generation safely
            loop = asyncio.get_event_loop()
            # Run synchronous generate_embeddings in threadpool to avoid blocking main event loop
            embeddings = await loop.run_in_executor(None, generate_embeddings, chunk_texts)
            
            # Check cancellation right after embeddings generated
            job = get_index_job(job_id)
            if job and job.get("status") == "cancelled":
                delete_document(doc_id)
                logger.info(f"Job {job_id} was cancelled during embedding generation.")
                return
                
            # Construct Chroma lists
            chroma_ids = [f"{doc_id}_{idx}" for idx in range(len(chunks))]
            chroma_metadatas = []
            for idx, c in enumerate(chunks):
                chroma_metadatas.append({
                    "document_id": doc_id,
                    "filename": c["filename"],
                    "page_num": c["page_num"],
                    "chunk_index": c["chunk_index"],
                    "org_id": org_id or "",
                    "kb_id": target_id if target_type == "kb" else "",
                    "project_id": target_id if target_type == "project" else "",
                    "session_id": target_id if target_type == "session" else ""
                })
                
            collection.add(
                ids=chroma_ids,
                documents=chunk_texts,
                embeddings=embeddings,
                metadatas=chroma_metadatas
            )
            
        update_index_job(job_id, {"progress": 90})
        
        # 6. Update document and job status to completed
        update_document(doc_id, {
            "status": "completed",
            "chunk_count": len(chunks),
        })
        
        update_index_job(job_id, {
            "status": "completed",
            "progress": 100,
            "processed_files": 1
        })
        
        # Delete temporary files if uploaded to a temporary folder
        if source_type == "file" and "temp_uploads" in source_path_str:
            try:
                os.remove(source_path_str)
            except Exception:
                pass
                
        logger.info(f"Indexing job {job_id} completed successfully. Indexed doc: {doc_id} with {len(chunks)} chunks.")
        
    except Exception as e:
        logger.error(f"Error executing indexing job {job_id}: {e}")
        update_index_job(job_id, {
            "status": "failed",
            "error_message": str(e)
        })
        # Clean up half-baked uploads
        if 'doc_id' in locals():
            update_document(doc_id, {
                "status": "failed",
                "error_message": str(e)
            })
            
async def cancel_indexing_job(job_id: str) -> bool:
    """Cancels a job and rolls back status in database."""
    job = get_index_job(job_id)
    if not job:
        return False
        
    # Mark job as cancelled
    update_index_job(job_id, {"status": "cancelled", "error_message": "Cancelled by user"})
    return True
