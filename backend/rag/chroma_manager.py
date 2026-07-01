import logging
from pathlib import Path
import chromadb

logger = logging.getLogger(__name__)

_client = None
_CHROMA_PATH = Path(__file__).resolve().parents[2] / "chroma_db"

def get_chroma_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _CHROMA_PATH.mkdir(parents=True, exist_ok=True)
        logger.info(f"Initializing ChromaDB PersistentClient at {_CHROMA_PATH}")
        _client = chromadb.PersistentClient(
            path=str(_CHROMA_PATH)
        )
    return _client

def get_collection(name: str = "neuroforge_knowledge") -> chromadb.Collection:
    client = get_chroma_client()
    # Normalize naming: Chroma DB collections must start with a letter/digit, 
    # contain 3-63 chars, and have only alphanumeric, underscore, or hyphen
    safe_name = name.replace("-", "_")
    if len(safe_name) < 3:
        safe_name = f"col_{safe_name}"
    elif len(safe_name) > 63:
        safe_name = safe_name[:63]
        
    return client.get_or_create_collection(
        name=safe_name
    )

def delete_collection(name: str) -> bool:
    client = get_chroma_client()
    safe_name = name.replace("-", "_")
    try:
        client.delete_collection(name=safe_name)
        logger.info(f"Successfully deleted Chroma collection: {safe_name}")
        return True
    except Exception as e:
        logger.warning(f"Chroma collection {safe_name} delete failed or didn't exist: {e}")
        return False