import json
import logging
import re
import threading
from datetime import datetime
from typing import Dict, List, Optional
from bson import ObjectId

from db.learning_service import save_learning
from db.mongo_client import db
from memory.user_memory import add_long_term_memory, get_long_term_memories
from rag.embeddings import generate_embedding

logger = logging.getLogger(__name__)

# Regular expressions for detecting and redacting sensitive data
SENSITIVE_PATTERNS = [
    r"(?i)(api[_-]?key|secret|token|password|auth|bearer)\s*[:=]\s*['\"]?([A-Za-z0-9_\-\.]{8,})['\"]?",
    r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", # Emails
    r"ghp_[A-Za-z0-9]{36}", # GitHub Personal Access Tokens
    r"sk-[A-Za-z0-9]{32,}", # OpenAI / Groq keys
]

def sanitize_text(text: str) -> str:
    """
    Strips emails, passwords, tokens, and API keys from text before storing globally.
    """
    sanitized = text
    for pattern in SENSITIVE_PATTERNS:
        sanitized = re.sub(pattern, "[REDACTED]", sanitized)
    return sanitized

def extract_memories_sync(user_id: str, prompt: str, response: str, conversation_id: Optional[str] = None):
    """
    Uses LLM to analyze the conversation turn and extract:
    1. User-specific long-term facts/preferences (Tech stack, style, guidelines, identity).
    2. Global public learnings (General solutions, architectural patterns, technical knowledge).
    """
    from llm.groq_client import generate_response

    # Skip trivial greetings or very short interactions
    if len(prompt.strip()) < 15 and len(response.strip()) < 40:
        return

    extraction_prompt = f"""You are NexusAI's Autonomous Memory and Knowledge Distillation Engine.
Analyze the following interaction between a user and NexusAI.

User Prompt:
\"\"\"{prompt}\"\"\"

AI Response:
\"\"\"{response[:1500]}\"\"\"

TASK:
1. Extract any permanent USER PREFERENCES, CODING HABITS, TECH STACK CHOICES, or REUSABLE USER FACTS (e.g. "User prefers TailwindCSS", "User uses FastAPI and MongoDB", "User lives in IST timezone").
2. Extract any GENERAL TECHNICAL LEARNINGS, ARCHITECTURAL PATTERNS, or BUG FIX SOLUTIONS that would be valuable globally for other users/agents.
3. If no significant facts or global learnings are present, return empty lists.

Return ONLY a JSON object matching this schema:
{{
  "user_facts": [
    {{
      "fact": "Clear, concise user-specific fact or preference",
      "category": "preferences | tech_stack | identity | habits | workflow"
    }}
  ],
  "global_learnings": [
    {{
      "topic": "Concise topic title",
      "insight": "General reusable technical solution, concept, or architectural knowledge",
      "category": "architecture | backend | frontend | devops | debugging | best_practices"
    }}
  ]
}}

Return RAW JSON only, without any markdown formatting or backticks.
"""

    try:
        raw_output = generate_response(extraction_prompt)
        clean_json = raw_output.strip()
        clean_json = re.sub(r"^```json\s*", "", clean_json)
        clean_json = re.sub(r"^```\s*", "", clean_json)
        clean_json = re.sub(r"\s*```$", "", clean_json)

        data = json.loads(clean_json)

        user_facts = data.get("user_facts", [])
        global_learnings = data.get("global_learnings", [])

        # 1. Process and store User-Specific Facts
        if user_facts and user_id:
            # Check existing memories to avoid exact duplicates
            existing_memories = get_long_term_memories(user_id, limit=30)
            existing_texts = {m.get("content", "").lower().strip() for m in existing_memories}

            for item in user_facts:
                fact = item.get("fact", "").strip()
                cat = item.get("category", "general")
                if fact and fact.lower() not in existing_texts and len(fact) > 5:
                    add_long_term_memory(user_id=user_id, fact=fact, category=cat)
                    logger.info(f"[MemoryExtractor] Added user fact for {user_id}: {fact}")

        # 2. Process and store Global Public Learnings
        if global_learnings:
            store = None
            try:
                from rag.vector_store import get_vector_store
                store = get_vector_store()
            except Exception as e:
                logger.warning(f"[MemoryExtractor] Vector store unavailable: {e}")

            for item in global_learnings:
                topic = item.get("topic", "Technical Insight")
                raw_insight = item.get("insight", "").strip()
                category = item.get("category", "general")

                if not raw_insight or len(raw_insight) < 15:
                    continue

                # Clean PII / sensitive data
                clean_insight = sanitize_text(raw_insight)

                # Save to MongoDB agent_learnings as a system-wide learning rule
                save_learning({
                    "user_id": "system",
                    "source_user": str(user_id) if user_id != "system" else "system",
                    "conversation_id": str(conversation_id) if conversation_id else None,
                    "topic": topic,
                    "category": category,
                    "error_type": category,
                    "lesson_learned": f"[{topic}]: {clean_insight}",
                    "is_global": True,
                    "enabled": True,
                    "created_at": datetime.utcnow()
                })

                # Ingest into Vector Store (Pinecone / Chroma) for semantic RAG retrieval
                if store:
                    try:
                        doc_text = f"Title: {topic}\nCategory: {category}\nKnowledge: {clean_insight}"
                        doc_id = f"distilled_knowledge_{ObjectId()}"
                        emb = generate_embedding(doc_text)
                        store.add(
                            collection_name="nexusai_knowledge",
                            ids=[doc_id],
                            documents=[doc_text],
                            embeddings=[emb],
                            metadatas=[{
                                "source": "autonomous_distillation",
                                "topic": topic,
                                "category": category,
                                "is_global": "true",
                                "created_at": datetime.utcnow().isoformat()
                            }]
                        )
                        logger.info(f"[MemoryExtractor] Ingested global knowledge into vector store: {topic}")
                    except Exception as vec_err:
                        logger.warning(f"[MemoryExtractor] Failed to index into vector store: {vec_err}")

    except Exception as err:
        logger.error(f"[MemoryExtractor] Extraction error: {err}")


def extract_and_persist_learnings_async(user_id: str, prompt: str, response: str, conversation_id: Optional[str] = None):
    """
    Spawns background thread for zero-latency execution.
    """
    thread = threading.Thread(
        target=extract_memories_sync,
        args=(user_id, prompt, response, conversation_id),
        daemon=True
    )
    thread.start()
