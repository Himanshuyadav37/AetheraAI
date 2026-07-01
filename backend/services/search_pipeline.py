import logging
import math
import re
from collections import Counter
from typing import List, Dict, Any, Tuple
from rag.chroma_manager import get_collection
from rag.embeddings import generate_embedding

logger = logging.getLogger(__name__)

# ==========================================
# Pure Python BM25 Searcher
# ==========================================
class BM25Searcher:
    def __init__(self, corpus_chunks: List[Dict[str, Any]], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus = corpus_chunks
        self.N = len(corpus_chunks)
        self.avgdl = 0.0
        self.doc_freqs = []
        self.doc_len = []
        self.vocab = set()
        self.idf = {}
        
        if self.N == 0:
            return
            
        total_len = 0
        for doc in corpus_chunks:
            tokens = self._tokenize(doc.get("text", ""))
            self.doc_freqs.append(Counter(tokens))
            self.doc_len.append(len(tokens))
            total_len += len(tokens)
            self.vocab.update(tokens)
            
        self.avgdl = total_len / self.N
        
        # Calculate IDF with standard smoothing
        for word in self.vocab:
            n_q = sum(1 for df in self.doc_freqs if word in df)
            self.idf[word] = math.log((self.N - n_q + 0.5) / (n_q + 0.5) + 1.0)
            
    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'\w+', text.lower())
        
    def score_query(self, query: str) -> List[Tuple[Dict[str, Any], float]]:
        """Scores all documents in the corpus and returns sorted list of (chunk, score)."""
        if self.N == 0:
            return []
            
        q_tokens = self._tokenize(query)
        scored_docs = []
        
        for idx in range(self.N):
            score = 0.0
            doc_len = self.doc_len[idx]
            freqs = self.doc_freqs[idx]
            
            for token in q_tokens:
                if token not in freqs:
                    continue
                f = freqs[token]
                idf = self.idf.get(token, 0.0)
                numerator = f * (self.k1 + 1.0)
                denominator = f + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avgdl))
                score += idf * (numerator / denominator)
                
            scored_docs.append((self.corpus[idx], score))
            
        return sorted(scored_docs, key=lambda x: x[1], reverse=True)

# ==========================================
# RRF (Reciprocal Rank Fusion) Hybrid Search
# ==========================================
# Query Condensation (History-aware query rewriter)
# ==========================================
def condense_query(query: str, conversation_id: str | None) -> str:
    """Condenses user query with chat history using LLM to make references explicit."""
    if not conversation_id:
        return query
    try:
        from db.conversation_service import get_conversation_messages
        history_msgs = get_conversation_messages(conversation_id)
        if not history_msgs:
            return query
            
        recent = [m for m in history_msgs if m.get("role") in ["user", "assistant"]][-4:]
        if not recent:
            return query
            
        transcript = "\n".join(f"{m['role'].upper()}: {m['content'][:300]}" for m in recent)
        
        from llm.groq_client import generate_response
        prompt = f"""You are a query condensation assistant.
Given the following conversation history and a new user message, rewrite the new user message into a standalone, search-optimized query in English.
Make any implicit references (like "it", "this file", "the code", "iske andar", "the JSON") explicit by resolving them to the actual subjects from the conversation history (e.g. resolve it to the exact discussed filename).

Hinglish Language Guide:
- The user might write in Hinglish (Hindi/Urdu written in Latin/English script).
- The words "k", "ke", "ki" (e.g., "file k andar", "code ke baare me") are prepositions meaning "of", "about", "for", or "to". Do NOT mistake the single character "k" as a filename or variable name.
- Translate any Hinglish search intent into a clean English standalone search query.

Conversation History:
{transcript}

New User Message: {query}

Standalone English search query:"""
        rewritten = generate_response(prompt).strip()
        if rewritten:
            logger.info(f"[Query Condensation] Original: '{query}' -> standalone: '{rewritten}'")
            return rewritten
    except Exception as e:
        logger.error(f"Query condensation failed: {e}")
    return query


def hybrid_search(collection_name: str, query: str, top_k: int = 5, document_id: str = None) -> List[Dict[str, Any]]:
    """Performs Vector Search & BM25 Search, combining ranks via RRF with first-chunk fallbacks."""
    try:
        collection = get_collection(collection_name)
        count = collection.count()
        if count == 0:
            return []
            
        # 1. Vector Search
        query_vector = generate_embedding(query)
        query_kwargs = {
            "query_embeddings": [query_vector],
            "n_results": min(count, top_k * 3),
            "include": ["documents", "metadatas", "distances"]
        }
        if document_id:
            query_kwargs["where"] = {"document_id": str(document_id)}
            
        vector_results = collection.query(**query_kwargs)
        
        # Flatten vector search results
        vector_chunks = []
        if vector_results and "documents" in vector_results and vector_results["documents"]:
            docs = vector_results["documents"][0]
            metas = vector_results["metadatas"][0] if vector_results.get("metadatas") else [{}] * len(docs)
            dists = vector_results["distances"][0] if vector_results.get("distances") else [0.0] * len(docs)
            
            for idx, text in enumerate(docs):
                distance = dists[idx]
                similarity = 1.0 - (distance / 2.0)
                confidence = max(0.0, min(1.0, similarity))
                
                vector_chunks.append({
                    "text": text,
                    "metadata": metas[idx],
                    "confidence": confidence,
                    "source": "vector"
                })
                
        # 2. Fetch all collection documents for BM25 keyword matching
        get_kwargs = {"include": ["documents", "metadatas"]}
        if document_id:
            get_kwargs["where"] = {"document_id": str(document_id)}
            
        all_data = collection.get(**get_kwargs)
        all_chunks = []
        if all_data and "documents" in all_data:
            for idx, text in enumerate(all_data["documents"]):
                all_chunks.append({
                    "text": text,
                    "metadata": all_data["metadatas"][idx] if all_data.get("metadatas") else {}
                })
                
        bm25_searcher = BM25Searcher(all_chunks)
        bm25_scored = bm25_searcher.score_query(query)
        
        # 3. Apply Reciprocal Rank Fusion (RRF)
        rrf_constant = 60
        scores = {}
        
        for rank, chunk in enumerate(vector_chunks):
            text_val = chunk["text"]
            scores[text_val] = {
                "chunk": chunk,
                "vector_rank": rank,
                "bm25_rank": None
            }
            
        for rank, (chunk, score) in enumerate(bm25_scored):
            text_val = chunk["text"]
            if text_val in scores:
                scores[text_val]["bm25_rank"] = rank
            else:
                chunk_copy = dict(chunk)
                chunk_copy["confidence"] = 0.5
                chunk_copy["source"] = "bm25"
                scores[text_val] = {
                    "chunk": chunk_copy,
                    "vector_rank": None,
                    "bm25_rank": rank
                }
                
        final_list = []
        for text_val, ranks in scores.items():
            v_rank = ranks["vector_rank"]
            b_rank = ranks["bm25_rank"]
            
            rrf_score = 0.0
            if v_rank is not None:
                rrf_score += 1.0 / (rrf_constant + v_rank)
            if b_rank is not None:
                rrf_score += 1.0 / (rrf_constant + b_rank)
                
            chunk = ranks["chunk"]
            chunk["rrf_score"] = rrf_score
            
            if v_rank is not None and b_rank is not None:
                chunk["confidence"] = min(1.0, chunk["confidence"] + 0.1)
                
            final_list.append(chunk)
            
        final_list = sorted(final_list, key=lambda x: x["rrf_score"], reverse=True)
        final_list = final_list[:top_k]

        # FALLBACK: If nothing matched with high confidence, return first few chunks from the latest document
        max_confidence = max(c.get("confidence", 0) for c in final_list) if final_list else 0.0
        if max_confidence < 0.4 and count > 0:
            logger.info("RAG search confidence low, returning default first chunks from the latest document.")
            
            latest_doc_id = None
            try:
                from db.rag_models import list_documents
                docs = []
                if collection_name.startswith("session_"):
                    sess_id = collection_name.replace("session_", "")
                    docs = list_documents(session_id=sess_id)
                elif collection_name.startswith("project_"):
                    proj_id = collection_name.replace("project_", "")
                    docs = list_documents(project_id=proj_id)
                elif collection_name.startswith("org_"):
                    org_id = collection_name.replace("org_", "")
                    docs = list_documents(org_id=org_id)
                
                if docs:
                    latest_doc_id = docs[0]["_id"]
            except Exception as e:
                logger.error(f"Failed to find latest document for fallback: {e}")
                
            if latest_doc_id:
                default_data = collection.get(
                    where={"document_id": str(latest_doc_id)},
                    limit=top_k,
                    include=["documents", "metadatas"]
                )
            else:
                default_data = collection.get(limit=top_k, include=["documents", "metadatas"])

            if default_data and "documents" in default_data and default_data["documents"]:
                fallback_list = []
                for idx, text in enumerate(default_data["documents"]):
                    fallback_list.append({
                        "text": text,
                        "metadata": default_data["metadatas"][idx] if default_data.get("metadatas") else {},
                        "confidence": 0.5,
                        "source": "fallback_latest"
                    })
                return fallback_list

        return final_list
        
    except Exception as e:
        logger.error(f"Hybrid search failed on collection {collection_name}: {e}")
        return []

# ==========================================
# Retrieval Priority Orchestrator
# ==========================================
def retrieve_layered_context(
    query: str, 
    project_id: str = None, 
    org_id: str = None, 
    session_id: str = None, 
    top_k: int = 5,
    conversation_id: str = None
) -> Tuple[str, List[Dict[str, Any]]]:
    """Orchestrates RAG priority and retrieves matched context chunks by selecting 
    the layer with the highest search match confidence.
    """
    # 0. Check if the user has uploaded a document in session RAG
    latest_doc_id = None
    if session_id:
        try:
            from db.rag_models import list_documents
            docs = list_documents(session_id=session_id)
            if docs:
                latest_doc_id = docs[0]["_id"]
        except Exception:
            pass

    # Scope the RAG query specifically to the latest session document if conversational context is active
    ref_keywords = ["file", "pdf", "doc", "paper", "report", "attachment", "it", "this", "above", "usme", "iske", "summary", "explain", "read"]
    query_lower = query.lower()
    refers_to_doc = any(kw in query_lower for kw in ref_keywords) or (conversation_id is not None)
    target_doc_id = latest_doc_id if (refers_to_doc and latest_doc_id) else None

    search_query = query
    if conversation_id:
        search_query = condense_query(query, conversation_id)
        
    all_results = []
    
    # 1. Project Layer
    if project_id:
        proj_col = f"project_{project_id}"
        results = hybrid_search(proj_col, search_query, top_k)
        for r in results:
            r_copy = dict(r)
            r_copy["layer"] = "project"
            all_results.append(r_copy)
            
    # 2. Organization Layer
    if org_id:
        org_col = f"org_{org_id}"
        results = hybrid_search(org_col, search_query, top_k)
        for r in results:
            r_copy = dict(r)
            r_copy["layer"] = "organization"
            all_results.append(r_copy)
            
    # 3. Session Layer
    if session_id:
        sess_col = f"session_{session_id}"
        results = hybrid_search(sess_col, search_query, top_k, document_id=target_doc_id)
        for r in results:
            r_copy = dict(r)
            r_copy["layer"] = "session"
            all_results.append(r_copy)
            
    if not all_results:
        logger.info("No localized RAG content matched. Falling back to Global knowledge.")
        return "global", []
        
    # Boost session layer confidence to prioritize active session uploads
    for r in all_results:
        if r["layer"] == "session":
            r["confidence"] = min(1.0, r.get("confidence", 0.5) + 0.25)
        
    # Sort all chunks across layers by confidence score descending
    sorted_results = sorted(all_results, key=lambda x: x.get("confidence", 0.0), reverse=True)
    
    # Select the layer of the highest confidence match
    top_chunk = sorted_results[0]
    top_layer = top_chunk["layer"]
    
    # Filter chunks belonging to that top layer
    layer_chunks = [r for r in sorted_results if r["layer"] == top_layer][:top_k]
    
    logger.info(f"Selected RAG layer '{top_layer}' with max confidence {top_chunk.get('confidence', 0.0):.2f} using query: {search_query}")
    return top_layer, layer_chunks
