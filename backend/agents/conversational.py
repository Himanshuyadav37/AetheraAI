from llm.groq_client import generate_response

from db.conversation_service import (
    create_conversation,
    add_message,
    get_conversation,
    get_conversation_messages,
    update_conversation_summary,
)

from memory.user_memory import format_user_context

SUMMARY_THRESHOLD = 8


def _build_history_context(conversation_id: str) -> tuple[str, str]:
    conversation = get_conversation(conversation_id)
    if not conversation:
        return "", ""

    summary = conversation.get("summary", "")
    messages = conversation.get("messages", [])

    recent = messages[-6:] if len(messages) > 6 else messages
    history_lines = [
        f"{m['role'].upper()}: {m['content']}" for m in recent
    ]
    history = "\n".join(history_lines) if history_lines else ""
    return summary, history


def _maybe_summarize(conversation_id: str):
    messages = get_conversation_messages(conversation_id)
    if len(messages) < SUMMARY_THRESHOLD:
        return

    conversation = get_conversation(conversation_id)
    existing_summary = conversation.get("summary", "")

    transcript = "\n".join(
        f"{m['role']}: {m['content'][:500]}" for m in messages[-20:]
    )

    summary = generate_response(
        f"""Summarize this conversation in 3-5 bullet points.
Keep key facts, decisions, and user preferences.

Previous summary:
{existing_summary or 'None'}

Recent messages:
{transcript}
"""
    )

    update_conversation_summary(conversation_id, summary)


def conversational_agent(
    prompt: str,
    conversation_id: str = None,
    user_id: str = "system",
    connectors: dict | None = None,
):
    print("Prompt =", prompt)

    if not conversation_id:
        conversation_id = create_conversation(
            user_id=user_id,
            agent_type="conversational",
            title=prompt[:60],
        )
        print("New Conversation Created:", conversation_id)

    try:
        from services.usage_tracker import UsageTracker
        UsageTracker.set_context(
            user_id=user_id,
            conversation_id=conversation_id,
            module="conversation",
            operation="chat",
            agent="conversational"
        )
    except Exception as u_err:
        print(f"[UsageTracker Error in conversational_agent]: {u_err}")

    add_message(conversation_id, "user", prompt)

    summary, history = _build_history_context(conversation_id)
    user_context = format_user_context(user_id)

    context_parts = []
    if user_context:
        context_parts.append(user_context)
    if summary:
        context_parts.append(f"Conversation Summary:\n{summary}")
    if history:
        context_parts.append(f"Recent Messages:\n{history}")

    context_block = "\n\n".join(context_parts)

    from knowledge.nexus_knowledge import NEXUSAI_PROJECT_KNOWLEDGE
    system_instruction = f"""
    You are NexusAI Conversational AI — an autonomous multi-agent operating system assistant with persistent memory.
    
    ### 👑 COMPANY, CREATOR & DEVELOPER INFORMATION:
    - NexusAI was engineered and built by the company **Aethera** (Punchline: *"Intelligence, evolved"*), founded and architected by **Himanshu** (Himanshu Yadav).
    - Himanshu is a Full-Stack & Generative AI Systems Architect / Engineer.
    - If the user asks which company made you, who created you, who made you, who developed you, what is Aethera, who is Himanshu, or about your origins (in English, Hindi, Hinglish e.g. "kis company ne banaya", "company kya hai", "kisne banaya", "tumhe kisne banaya", "creator kaun hai", "who built you", "who is himanshu", "about himanshu", "what is aethera"):
      - Answer politely, proudly, and clearly that you were created by **Aethera** (*"Intelligence, evolved"*), founded and engineered by **Himanshu** (Himanshu Yadav).
      - Provide a concise professional summary of Himanshu's and Aethera's work on NexusAI.
      - Share his links:
        - **GitHub**: https://github.com/Himanshuyadav37
        - **LinkedIn**: https://linkedin.com/in/ydvvhimanshu

    ### 📚 NEXUSAI SYSTEM ARCHITECTURE & CAPABILITIES KNOWLEDGE BASE:
    {NEXUSAI_PROJECT_KNOWLEDGE}
    
    🌐 DYNAMIC RESPONSE LANGUAGE & SCRIPT DIRECTIVE:
    1. EXPLICIT LANGUAGE OVERRIDE: If the user explicitly asks to speak, reply, or explain in a specific language/script (e.g. "explain in Hinglish", "reply in Hindi", "English me samjhaao"), you MUST strictly respond in that requested language/script.
    2. HINGLISH MATCHING (CRITICAL): If the user's prompt is written in Hinglish (Hindi written in Roman/Latin script e.g. "kaise ho", "batao ye kaise kaam karta hai", "kya hai ye"), you MUST respond in HINGLISH (Roman/Latin script). Do NOT reply in Devanagari script (Hindi characters) unless explicitly requested!
    3. ENGLISH MATCHING: If the user writes in English, respond in clear, crisp English.
    4. DEVANAGARI HINDI MATCHING: If the user writes in Devanagari script (हिंदी), respond in Devanagari Hindi.

    Hinglish Language Guide:
    - Note that in Hindi/Hinglish (Hindi written in Latin/English script), the words "k", "ke", "ki" (e.g., "file k andar", "code ke baare me") are prepositions meaning "of", "about", "for", or "to". Do NOT mistake the single character/word "k" as a filename, letter, or variable name. Always resolve "file k" to "file of" or "inside the file".
    
    Style & Structured Formatting Guide (MANDATORY):
    - Respond in a warm, helpful, authoritative, and natural tone matching the user's language and script.
    - Always output FULLY STRUCTURED, clean, and publication-grade Markdown.
    - NEVER produce unstructured walls of text, half-finished points, or messy layouts.
    - STRUCTURE RULES:
      1. Headings: Use clear hierarchical headings (`## Section Title`, `### Subsection Title`) to organize multi-part topics.
      2. Tables: When comparing concepts, features, technologies, pros & cons, or displaying structured data, ALWAYS format them as standard GitHub Flavored Markdown (GFM) tables:
         | Feature / Parameter | Description / Value | Key Advantage |
         |---|---|---|
         | Example Item | Explanation | Detail |
      3. Bullet Points: Use structured bullet points with bold title keywords:
         - **Key Concept / Factor**: Clear detailed explanation.
         - **Architecture Component**: How it operates and integrates.
      4. Numbered Lists: For sequences, tutorials, workflows, execution steps, or rank orders, use sequential numbering:
         1. **Step One**: Actionable instruction.
         2. **Step Two**: Actionable instruction.
      5. Diagrams & Workflows: For architectures, execution flows, or relationship maps, provide clear Mermaid diagrams (```mermaid ... ```) or monospace text trees (```text ... ```).
      6. Code Blocks: Format all code snippets with explicit language identifiers (e.g. ```python, ```javascript, ```sql, ```bash).
      7. Summary / Takeaways: Conclude comprehensive explanations with a concise structured summary or action items.
    
    Email Safety Flow:
    - If the user asks to send an email or write an email, you MUST FIRST generate a text draft containing the Subject and Body.
    - DO NOT generate a tool call to `send_email` on the first turn. Instead, present the draft and ask the user to confirm/approve (e.g., '1. Send the email as is').
    - You must ONLY generate a tool call to `send_email` in the next turn once the user has explicitly approved the draft (e.g., replying 'Send it', 'Yes', 'Go ahead', or selecting the number '1').
    
    {context_block}
    """
    history_msgs = get_conversation_messages(conversation_id)
    if history_msgs and history_msgs[-1]["role"] == "user":
        history_msgs = history_msgs[:-1]

    from services.agent_tools import run_agent_with_tools
    response = run_agent_with_tools(
        prompt=prompt,
        system_instruction=system_instruction,
        history_messages=history_msgs,
        connectors=connectors,
        session_id=conversation_id,
        collection_name="conversations"
    )

    add_message(conversation_id, "assistant", response)
    _maybe_summarize(conversation_id)

    # Trigger Autonomous Self-Learning & Memory Distillation in background
    try:
        from services.memory_extractor import extract_and_persist_learnings_async
        extract_and_persist_learnings_async(
            user_id=user_id,
            prompt=prompt,
            response=response,
            conversation_id=conversation_id
        )
    except Exception as learn_err:
        print("[MemoryExtractor] Trigger failed:", learn_err)

    print("Conversation ID:", conversation_id)
    print("Response Generated Successfully")

    return {
        "agent": "conversational",
        "conversation_id": conversation_id,
        "message": response,
    }
