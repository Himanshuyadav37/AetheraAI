from rag.vector_store import get_vector_store
from rag.embeddings import generate_embedding


def add_document(doc_id, text):
    store = get_vector_store()

    store.add(
        "nexusai_knowledge",
        ids=[doc_id],
        documents=[text],
        embeddings=[
            generate_embedding(text)
        ],
        metadatas=[{}]
    )