"""
ChromaDB to Pinecone Cloud Migration Tool
Run this script to migrate all local Chroma collections into Pinecone namespaces.

Usage:
    python backend/tools/migrate_chroma_to_pinecone.py
"""

import sys
import os
from pathlib import Path

# Ensure backend directory is in python path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from config import settings
from rag.chroma_manager import get_chroma_client
from rag.vector_store import PineconeVectorStore
from rag.embeddings import generate_embeddings

def run_migration():
    print("=" * 60)
    print("🚀 NEXUSAI CHROMADB -> PINECONE CLOUD MIGRATION UTILITY")
    print("=" * 60)

    api_key = getattr(settings, "PINECONE_API_KEY", "")
    if not api_key:
        print("❌ Error: PINECONE_API_KEY is not set in your .env file.")
        print("Please add PINECONE_API_KEY=<your_key> to .env and try again.")
        return

    index_name = getattr(settings, "PINECONE_INDEX_NAME", "nexusai")
    print(f"Target Pinecone Index: '{index_name}'")
    print(f"Cloud / Region: {getattr(settings, 'PINECONE_CLOUD', 'aws')} / {getattr(settings, 'PINECONE_REGION', 'us-east-1')}")
    print("-" * 60)

    # 1. Initialize Pinecone Vector Store
    try:
        pinecone_store = PineconeVectorStore()
        print("✅ Connected to Pinecone Vector Store.")
    except Exception as e:
        print(f"❌ Failed to connect to Pinecone: {e}")
        return

    # 2. Connect to Local ChromaDB
    chroma_client = get_chroma_client()
    if not chroma_client:
        print("❌ Could not connect to local ChromaDB.")
        return

    try:
        collections = chroma_client.list_collections()
        if not collections:
            print("ℹ️ No collections found in local ChromaDB.")
            return
        print(f"Found {len(collections)} collections in local ChromaDB:")
        for col in collections:
            print(f"  - {col.name} ({col.count()} records)")
    except Exception as e:
        print(f"❌ Error listing Chroma collections: {e}")
        return

    print("-" * 60)
    total_migrated = 0

    # 3. Migrate each collection
    for col in collections:
        col_name = col.name
        count = col.count()
        if count == 0:
            print(f"⏩ Skipping empty collection '{col_name}'")
            continue

        print(f"\n🔄 Migrating collection '{col_name}' ({count} items) -> Pinecone namespace '{col_name}'...")

        try:
            # Fetch all data from Chroma
            data = col.get(include=["documents", "metadatas", "embeddings"])
            ids = data.get("ids", [])
            docs = data.get("documents", [])
            metas = data.get("metadatas", [])
            embs = data.get("embeddings")

            # Generate embeddings if not returned
            if embs is None or len(embs) == 0:
                print(f"  ⚡ Generating vector embeddings for {len(docs)} documents...")
                embs = generate_embeddings(docs)

            # Upsert into Pinecone
            pinecone_store.add(
                collection_name=col_name,
                ids=ids,
                documents=docs,
                embeddings=embs,
                metadatas=metas if metas else [{}] * len(ids)
            )
            print(f"  ✅ Successfully migrated {len(ids)} items to Pinecone namespace '{col_name}'")
            total_migrated += len(ids)

        except Exception as err:
            print(f"  ❌ Failed to migrate collection '{col_name}': {err}")

    print("\n" + "=" * 60)
    print(f"🎉 MIGRATION COMPLETE! Total vectors migrated to Pinecone: {total_migrated}")
    print("=" * 60)

if __name__ == "__main__":
    run_migration()
