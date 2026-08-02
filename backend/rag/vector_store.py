import logging
from typing import List, Dict, Any, Optional
from config import settings

logger = logging.getLogger(__name__)

class BaseVectorStore:
    def add(self, collection_name: str, ids: List[str], documents: List[str], embeddings: List[List[float]], metadatas: List[dict]):
        raise NotImplementedError()
        
    def query(self, collection_name: str, query_embeddings: List[List[float]], n_results: int, where: dict = None) -> dict:
        raise NotImplementedError()
        
    def get(self, collection_name: str, ids: List[str] = None, where: dict = None, limit: int = None, include: List[str] = None) -> dict:
        raise NotImplementedError()
        
    def delete(self, collection_name: str, ids: List[str] = None, where: dict = None):
        raise NotImplementedError()
        
    def delete_collection(self, collection_name: str) -> bool:
        raise NotImplementedError()
        
    def count(self, collection_name: str) -> int:
        raise NotImplementedError()

class ChromaVectorStore(BaseVectorStore):
    def __init__(self):
        from rag.chroma_manager import get_collection, delete_collection
        self._get_col = get_collection
        self._del_col = delete_collection

    def add(self, collection_name: str, ids: List[str], documents: List[str], embeddings: List[List[float]], metadatas: List[dict]):
        col = self._get_col(collection_name)
        col.add(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)

    def query(self, collection_name: str, query_embeddings: List[List[float]], n_results: int, where: dict = None) -> dict:
        col = self._get_col(collection_name)
        kwargs = {"query_embeddings": query_embeddings, "n_results": n_results}
        if where:
            kwargs["where"] = where
        return col.query(**kwargs)

    def get(self, collection_name: str, ids: List[str] = None, where: dict = None, limit: int = None, include: List[str] = None) -> dict:
        col = self._get_col(collection_name)
        kwargs = {}
        if ids:
            kwargs["ids"] = ids
        if where:
            kwargs["where"] = where
        if limit:
            kwargs["limit"] = limit
        if include:
            kwargs["include"] = include
        return col.get(**kwargs)

    def delete(self, collection_name: str, ids: List[str] = None, where: dict = None):
        col = self._get_col(collection_name)
        kwargs = {}
        if ids:
            kwargs["ids"] = ids
        if where:
            kwargs["where"] = where
        col.delete(**kwargs)

    def delete_collection(self, collection_name: str) -> bool:
        return self._del_col(collection_name)

    def count(self, collection_name: str) -> int:
        col = self._get_col(collection_name)
        return col.count()

class PineconeVectorStore(BaseVectorStore):
    def __init__(self):
        self._index = None
        self._pc = None

    def _get_index(self):
        if self._index is None:
            api_key = getattr(settings, "PINECONE_API_KEY", "")
            index_name = getattr(settings, "PINECONE_INDEX_NAME", "devpilot-ai")
            if not api_key:
                raise ValueError("PINECONE_API_KEY is not configured in settings/env")
            
            from pinecone import Pinecone
            self._pc = Pinecone(api_key=api_key)
            
            try:
                indexes = [idx.name for idx in self._pc.list_indexes()]
                if index_name not in indexes:
                    logger.warning(f"Pinecone index '{index_name}' not found. Please create it in your Pinecone console.")
            except Exception as e:
                logger.warning(f"Could not verify Pinecone index listing: {e}")
                
            self._index = self._pc.Index(index_name)
        return self._index

    def add(self, collection_name: str, ids: List[str], documents: List[str], embeddings: List[List[float]], metadatas: List[dict]):
        index = self._get_index()
        vectors = []
        for idx, doc_id in enumerate(ids):
            meta = dict(metadatas[idx]) if idx < len(metadatas) else {}
            meta["text"] = documents[idx]
            vectors.append((doc_id, embeddings[idx], meta))
            
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            chunk = vectors[i:i + batch_size]
            index.upsert(vectors=chunk, namespace=collection_name)

    def query(self, collection_name: str, query_embeddings: List[List[float]], n_results: int, where: dict = None) -> dict:
        index = self._get_index()
        emb = query_embeddings[0] if query_embeddings else []
        
        query_params = {
            "vector": emb,
            "top_k": n_results,
            "namespace": collection_name,
            "include_metadata": True
        }
        if where:
            query_params["filter"] = where
            
        res = index.query(**query_params)
        
        ids_sub = []
        docs_sub = []
        metas_sub = []
        dists_sub = []
        
        for match in res.matches:
            ids_sub.append(match.id)
            meta = match.metadata or {}
            docs_sub.append(meta.get("text", ""))
            metas_sub.append(meta)
            score = match.score if match.score is not None else 1.0
            distance = 2.0 * (1.0 - score)
            dists_sub.append(distance)
            
        return {
            "ids": [ids_sub],
            "documents": [docs_sub],
            "metadatas": [metas_sub],
            "distances": [dists_sub]
        }

    def get(self, collection_name: str, ids: List[str] = None, where: dict = None, limit: int = None, include: List[str] = None) -> dict:
        index = self._get_index()
        
        if ids:
            res = index.fetch(ids=ids, namespace=collection_name)
            ids_list = []
            docs_list = []
            metas_list = []
            for v_id, vector in res.vectors.items():
                ids_list.append(v_id)
                meta = vector.metadata or {}
                docs_list.append(meta.get("text", ""))
                metas_list.append(meta)
            return {"ids": ids_list, "documents": docs_list, "metadatas": metas_list}
        else:
            dim = 3072 if getattr(settings, "GEMINI_API_KEY", "") else 384
            dummy_vector = [0.0] * dim
            
            query_params = {
                "vector": dummy_vector,
                "top_k": limit or 10000,
                "namespace": collection_name,
                "include_metadata": True
            }
            if where:
                query_params["filter"] = where
                
            res = index.query(**query_params)
            ids_list = []
            docs_list = []
            metas_list = []
            for match in res.matches:
                ids_list.append(match.id)
                meta = match.metadata or {}
                docs_list.append(meta.get("text", ""))
                metas_list.append(meta)
            return {"ids": ids_list, "documents": docs_list, "metadatas": metas_list}

    def delete(self, collection_name: str, ids: List[str] = None, where: dict = None):
        index = self._get_index()
        if ids:
            index.delete(ids=ids, namespace=collection_name)
        elif where:
            index.delete(filter=where, namespace=collection_name)

    def delete_collection(self, collection_name: str) -> bool:
        index = self._get_index()
        try:
            index.delete(delete_all=True, namespace=collection_name)
            return True
        except Exception as e:
            logger.warning(f"Pinecone delete namespace '{collection_name}' failed: {e}")
            return False

    def count(self, collection_name: str) -> int:
        index = self._get_index()
        try:
            stats = index.describe_index_stats()
            namespace_stats = stats.namespaces.get(collection_name)
            if namespace_stats:
                return namespace_stats.vector_count
        except Exception as e:
            logger.warning(f"Pinecone describe_index_stats failed: {e}")
        return 0

# Factory Client Singleton Getter
_vector_store = None

def get_vector_store() -> BaseVectorStore:
    global _vector_store
    if _vector_store is None:
        store_type = getattr(settings, "VECTOR_STORE", "chroma").lower().strip()
        if store_type == "pinecone":
            logger.info("Initializing Pinecone production Vector Store")
            _vector_store = PineconeVectorStore()
        else:
            logger.info("Initializing Chroma local Vector Store")
            _vector_store = ChromaVectorStore()
    return _vector_store
