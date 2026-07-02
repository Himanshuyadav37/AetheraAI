import logging
import requests
from abc import ABC, abstractmethod
from typing import List, Union
from tenacity import retry, stop_after_attempt, wait_random_exponential, retry_if_exception_type
from config import settings

logger = logging.getLogger(__name__)

# Base class for provider independence
class BaseEmbeddingProvider(ABC):
    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        pass

    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        pass

# Gemini Cloud Embedding Provider
class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "models/gemini-embedding-001"
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    @retry(
        reraise=True,
        stop=stop_after_attempt(5),
        wait=wait_random_exponential(min=1, max=10),
        retry=retry_if_exception_type(requests.RequestException)
    )
    def _embed_single(self, text: str) -> List[float]:
        url = f"{self.base_url}/{self.model}:embedContent?key={self.api_key}"
        payload = {
            "model": self.model,
            "content": {
                "parts": [{"text": text}]
            }
        }
        response = requests.post(url, json=payload, timeout=10)
        
        # If rate limited, raise request exception to trigger tenacity retry
        if response.status_code == 429:
            logger.warning("Gemini Embeddings API rate limited (429). Retrying...")
            response.raise_for_status()
            
        response.raise_for_status()
        result = response.json()
        return result["embedding"]["values"]

    @retry(
        reraise=True,
        stop=stop_after_attempt(5),
        wait=wait_random_exponential(min=1, max=10),
        retry=retry_if_exception_type(requests.RequestException)
    )
    def _embed_batch(self, texts: List[str]) -> List[List[float]]:
        url = f"{self.base_url}/{self.model}:batchEmbedContents?key={self.api_key}"
        requests_payload = []
        for txt in texts:
            requests_payload.append({
                "model": self.model,
                "content": {
                    "parts": [{"text": txt}]
                }
            })
        payload = {"requests": requests_payload}
        response = requests.post(url, json=payload, timeout=20)
        
        if response.status_code == 429:
            logger.warning("Gemini Embeddings API rate limited (429). Retrying batch...")
            response.raise_for_status()
            
        response.raise_for_status()
        result = response.json()
        return [item["values"] for item in result["embeddings"]]

    def embed_query(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * 3072
        try:
            return self._embed_single(text)
        except Exception as e:
            logger.error(f"Gemini embedding failed for query: {e}")
            raise

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        
        # Google API supports batching up to 100 texts per request
        batch_size = 100
        embeddings = []
        
        for i in range(0, len(texts), batch_size):
            chunk = texts[i:i + batch_size]
            try:
                chunk_embeddings = self._embed_batch(chunk)
                embeddings.extend(chunk_embeddings)
            except Exception as e:
                logger.error(f"Gemini embedding failed for batch {i//batch_size}: {e}")
                # Fallback to single requests if batch fails
                for txt in chunk:
                    embeddings.append(self.embed_query(txt))
        return embeddings

# Local Fallback Provider (using sentence-transformers if Gemini is disabled/absent)
class LocalEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self):
        self.model = None

    def _get_model(self):
        if self.model is None:
            # Lazy import to avoid loading heavy torch/transformers unless absolutely required
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
        return self.model

    def embed_query(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * 384
        model = self._get_model()
        return model.encode(text).tolist()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        model = self._get_model()
        return model.encode(texts).tolist()

# Active Provider Instantiation
_active_provider = None

def get_embedding_provider() -> BaseEmbeddingProvider:
    global _active_provider
    if _active_provider is None:
        gemini_key = getattr(settings, "GEMINI_API_KEY", "")
        if gemini_key:
            logger.info("Initializing Google Gemini Embedding Provider (text-embedding-004)")
            _active_provider = GeminiEmbeddingProvider(api_key=gemini_key)
        else:
            logger.warning("GEMINI_API_KEY not found. Falling back to Local Embedding Provider (all-MiniLM-L6-v2)")
            _active_provider = LocalEmbeddingProvider()
    return _active_provider

# Legacy / simple functions to maintain backwards compatibility
def generate_embedding(text: str) -> List[float]:
    provider = get_embedding_provider()
    return provider.embed_query(text)

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    provider = get_embedding_provider()
    return provider.embed_documents(texts)