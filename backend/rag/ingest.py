from rag.chroma_manager import get_collection
from rag.embeddings import generate_embedding


def add_document(doc_id, text):
    collection = get_collection()

    collection.add(
        ids=[doc_id],
        documents=[text],
        embeddings=[
            generate_embedding(text)
        ]
    )