from datetime import datetime

from db.mongo_client import db

user_memory_collection = db["user_memory"]


def get_user_profile(user_id: str) -> dict:
    doc = user_memory_collection.find_one(
        {"user_id": user_id, "type": "profile"}
    )
    if not doc:
        return {}
    doc.pop("_id", None)
    return doc.get("data", {})


def save_user_profile(user_id: str, profile: dict):
    user_memory_collection.update_one(
        {"user_id": user_id, "type": "profile"},
        {
            "$set": {
                "data": profile,
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )


def add_long_term_memory(user_id: str, fact: str, category: str = "general"):
    # Avoid duplicate facts for the same user
    existing = user_memory_collection.find_one({
        "user_id": user_id,
        "type": "fact",
        "content": fact
    })
    if existing:
        return

    user_memory_collection.insert_one(
        {
            "user_id": user_id,
            "type": "fact",
            "category": category,
            "content": fact,
            "created_at": datetime.utcnow(),
        }
    )


def get_long_term_memories(user_id: str, limit: int = 20) -> list:
    memories = list(
        user_memory_collection.find(
            {"user_id": user_id, "type": "fact"}
        )
        .sort("created_at", -1)
        .limit(limit)
    )
    for m in memories:
        m.pop("_id", None)
    return memories


def format_persona_prompt(profile: dict) -> str:
    if not profile:
        return ""
    
    name = profile.get("name") or profile.get("full_name") or ""
    role = profile.get("role") or ""
    tech_stack = profile.get("tech_stack") or profile.get("skills") or []
    if isinstance(tech_stack, list):
        tech_stack_str = ", ".join(tech_stack)
    else:
        tech_stack_str = str(tech_stack)
    
    experience_level = profile.get("experience_level") or profile.get("level") or ""
    ai_preference = profile.get("ai_preference") or profile.get("coding_style") or ""
    
    lines = ["👤 USER PERSONA & ADAPTIVE PROFILE:"]
    if name:
        lines.append(f"- Preferred Name: {name}")
    if role:
        lines.append(f"- Primary Role: {role}")
    if tech_stack_str:
        lines.append(f"- Primary Tech Stack & Tools: {tech_stack_str}")
    if experience_level:
        lines.append(f"- Experience Level: {experience_level}")
    if ai_preference:
        lines.append(f"- Preferred AI Output Style: {ai_preference}")

    lines.append("\n🎯 ADAPTIVE AI BEHAVIORAL DIRECTIVES:")
    
    role_lower = role.lower()
    if "student" in role_lower or "learner" in role_lower:
        lines.append("- TONE & STYLE: Encouraging, clear, step-by-step, educational.")
        lines.append("- EXPLANATION DEPTH: Provide intuitive analogies, step-by-step breakdowns, key concept definitions, and Socratic learning hints.")
        lines.append("- CODE STYLE: Well-commented, beginner-friendly code with step-by-step logic breakdown.")
    elif "teacher" in role_lower or "educator" in role_lower or "professor" in role_lower:
        lines.append("- TONE & STYLE: Pedagogical, structured, clear, authoritative.")
        lines.append("- EXPLANATION DEPTH: Focus on foundational principles, clear definitions, curriculum relevance, and discussion questions.")
        lines.append("- CODE STYLE: Exemplary reference implementations suitable for teaching and academic demonstration.")
    elif "devops" in role_lower or "docker" in role_lower or "infra" in role_lower or "sysadmin" in role_lower:
        lines.append("- TONE & STYLE: Production-ready, operational, security-conscious, concise.")
        lines.append("- EXPLANATION DEPTH: Direct focus on Docker containers, Kubernetes, CI/CD pipelines, environment configurations, and deployment reliability.")
        lines.append("- CODE STYLE: Provide production Dockerfiles, docker-compose.yml files, shell scripts, and container best practices.")
    elif "engineer" in role_lower or "developer" in role_lower or "coder" in role_lower:
        lines.append("- TONE & STYLE: Technical, high-efficiency, enterprise-grade, direct.")
        lines.append("- EXPLANATION DEPTH: Focus on clean architecture, design patterns, performance optimization, edge cases, and trade-offs.")
        lines.append("- CODE STYLE: Production-ready, idiomatically typed code with robust error handling.")
    elif "data" in role_lower or "ml" in role_lower or "ai" in role_lower or "research" in role_lower:
        lines.append("- TONE & STYLE: Analytical, empirical, research-focused, mathematically sound.")
        lines.append("- EXPLANATION DEPTH: Focus on algorithms, model architectures, evaluation metrics, pipeline optimization, and research papers.")
        lines.append("- CODE STYLE: Efficient vectorized code, clear data transformations, evaluation metrics, and reproducible scripts.")
    elif "product" in role_lower or "manager" in role_lower or "founder" in role_lower:
        lines.append("- TONE & STYLE: Strategic, business-impact focused, action-oriented.")
        lines.append("- EXPLANATION DEPTH: Focus on feature feasibility, architecture overviews, user UX impact, trade-offs, and clear executive summaries.")
    else:
        lines.append(f"- Tailor explanations and code style to align with the user's role as {role} and tech stack ({tech_stack_str}).")

    if name:
        lines.append(f"- Address the user naturally by name ({name}) when welcoming or concluding key recommendations.")

    return "\n".join(lines)


def format_user_context(user_id: str) -> str:
    profile = get_user_profile(user_id)
    facts = get_long_term_memories(user_id, limit=10)

    parts = []
    if profile:
        persona_text = format_persona_prompt(profile)
        if persona_text:
            parts.append(persona_text)
    if facts:
        fact_lines = [f"- {m['content']}" for m in reversed(facts)]
        parts.append("User Long-term Memory Facts:\n" + "\n".join(fact_lines))

    # Also include active distilled learnings
    try:
        from services.self_learning import get_active_learnings
        learnings = get_active_learnings(user_id)
        if learnings:
            parts.append(learnings)
    except Exception:
        pass

    return "\n\n".join(parts) if parts else ""
