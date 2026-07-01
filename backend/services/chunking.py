import logging
import re
import numpy as np
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from rag.embeddings import generate_embedding

logger = logging.getLogger(__name__)

def split_sentences(text: str) -> List[str]:
    """Split text into sentences using simple regex punctuation matching."""
    # Split on period, question mark, or exclamation mark followed by space
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    a = np.array(v1)
    b = np.array(v2)
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))

def semantic_chunking(text: str, similarity_threshold: float = 0.70, min_chunk_len: int = 200, max_chunk_len: int = 1500) -> List[str]:
    """Group sentences based on semantic similarity of consecutive items."""
    sentences = split_sentences(text)
    if not sentences:
        return []
    
    # Compute embeddings for sentences
    # To optimize Gemini rate limit, we can batch embed, but since we are handling this, we do it safely
    # If the text is very long, limit the sentence embeddings to keep it fast
    if len(sentences) > 150:
        # Fallback to simple recursive split for extremely long documents to avoid heavy rate limits
        logger.info("Text too long for sentence-by-sentence semantic embedding. Falling back to recursive splitting.")
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
        return splitter.split_text(text)

    try:
        from rag.embeddings import generate_embeddings
        embeddings = generate_embeddings(sentences)
    except Exception as e:
        logger.warning(f"Failed to generate embeddings for semantic chunking: {e}. Falling back to punctuation split.")
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
        return splitter.split_text(text)

    chunks = []
    current_sentences = [sentences[0]]
    
    for idx in range(1, len(sentences)):
        sim = cosine_similarity(embeddings[idx - 1], embeddings[idx])
        
        # Calculate current chunk text length
        current_len = sum(len(s) for s in current_sentences)
        
        # Split conditions:
        # 1. Similarity drops below threshold and we have enough content
        # 2. Or the chunk is already too large
        if (sim < similarity_threshold and current_len >= min_chunk_len) or (current_len >= max_chunk_len):
            chunks.append(" ".join(current_sentences))
            current_sentences = [sentences[idx]]
        else:
            current_sentences.append(sentences[idx])
            
    if current_sentences:
        chunks.append(" ".join(current_sentences))
        
    return chunks

def chunk_document(pages_data: List[Dict[str, Any]], chunk_size: int = 1000, chunk_overlap: int = 150, method: str = "recursive") -> List[Dict[str, Any]]:
    """Chunks the parsed document pages.
    
    Each chunk retains page_num and filename metadata.
    """
    final_chunks = []
    
    for page in pages_data:
        text = page.get("text", "").strip()
        if not text:
            continue
            
        page_num = page.get("page_num", 1)
        filename = page.get("filename", "unknown")
        
        if method == "semantic":
            # Semantic chunking
            chunks = semantic_chunking(text, similarity_threshold=0.72)
        else:
            # Default recursive character splitter
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                length_function=len
            )
            chunks = splitter.split_text(text)
            
        for c_idx, chunk in enumerate(chunks):
            final_chunks.append({
                "text": chunk,
                "page_num": page_num,
                "filename": filename,
                "chunk_index": c_idx
            })
            
    return final_chunks
