import logging

from rag.vector_store import get_vector_store
from rag.embeddings import generate_embedding

logger = logging.getLogger(__name__)
_EMPTY_RESULTS = {"documents": [[]]}


def retrieve_context(query: str):
    if not query or not query.strip():
        return _EMPTY_RESULTS

    try:
        embedding = generate_embedding(query)
        store = get_vector_store()

        return store.query(
            "nexusai_knowledge",
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