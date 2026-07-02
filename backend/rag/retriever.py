import logging

from rag.chroma_manager import get_collection
from rag.embeddings import generate_embedding

logger = logging.getLogger(__name__)
_EMPTY_RESULTS = {"documents": [[]]}


def retrieve_context(query: str):
    if not query or not query.strip():
        return _EMPTY_RESULTS

    try:
        embedding = generate_embedding(query)
        collection = get_collection()

        return collection.query(
            query_embeddings=[embedding],
            n_results=3
        )
    except BaseException as exc:
        logger.warning("RAG context retrieval failed; continuing without context: %s", exc)
        return _EMPTY_RESULTS


def get_context(query: str):
    results = retrieve_context(query)

    documents = results.get("documents", [[]])[0]

    return "\n".join(documents)