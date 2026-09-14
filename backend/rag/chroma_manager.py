import logging
from pathlib import Path
import chromadb

logger = logging.getLogger(__name__)

_client = None
_CHROMA_PATH = Path(__file__).resolve().parents[2] / "chroma_db"

import socket

def is_chroma_server_available(host: str, port: int) -> bool:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        res = sock.connect_ex((host, int(port)))
        sock.close()
        return res == 0
    except Exception:
        return False

def get_chroma_client():
    global _client
    if _client is None:
        from config import settings
        host = getattr(settings, "CHROMA_HOST", None)
        port = getattr(settings, "CHROMA_PORT", None) or 8000
        _CHROMA_PATH.mkdir(parents=True, exist_ok=True)
        
        # If remote host specified and port is open, attempt HttpClient
        if host and host.strip() and host.strip().lower() != "none":
            if is_chroma_server_available(host.strip(), int(port)):
                try:
                    logger.info(f"Connecting to ChromaDB HttpClient at {host}:{port}")
                    _client = chromadb.HttpClient(
                        host=host.strip(),
                        port=int(port)
                    )
                    return _client
                except BaseException as e:
                    logger.warning(f"Chroma HttpClient connection failed ({e}). Falling back to local PersistentClient.")
            else:
                logger.info(f"No Chroma server active at {host}:{port}. Using local PersistentClient at {_CHROMA_PATH}.")
        
        # Local Persistent Storage
        try:
            logger.info(f"Initializing ChromaDB PersistentClient at {_CHROMA_PATH}")
            _client = chromadb.PersistentClient(path=str(_CHROMA_PATH))
        except BaseException as pe:
            logger.error(f"Failed to initialize Chroma PersistentClient ({pe}). Falling back to EphemeralClient.")
            try:
                _client = chromadb.EphemeralClient()
            except BaseException as fallback_err:
                logger.error(f"Failed to initialize Chroma EphemeralClient: {fallback_err}")
                _client = None
    return _client

def get_collection(name: str = "nexusai_knowledge") -> chromadb.Collection:
    global _client
    try:
        client = get_chroma_client()
        if client is None:
            raise RuntimeError("Chroma client is unavailable")
        safe_name = name.replace("-", "_")
        if len(safe_name) < 3:
            safe_name = f"col_{safe_name}"
        elif len(safe_name) > 63:
            safe_name = safe_name[:63]
            
        return client.get_or_create_collection(
            name=safe_name
        )
    except BaseException as e:
        logger.error(f"Chroma get_collection failed: {e}. Resetting client.")
        _client = None
        raise e

def delete_collection(name: str) -> bool:
    global _client
    client = get_chroma_client()
    safe_name = name.replace("-", "_")
    try:
        client.delete_collection(name=safe_name)
        logger.info(f"Successfully deleted Chroma collection: {safe_name}")
        return True
    except Exception as e:
        logger.warning(f"Chroma collection {safe_name} delete failed or didn't exist: {e}")
        # Reset client on deletion errors in case it's a connection issue
        _client = None
        return False