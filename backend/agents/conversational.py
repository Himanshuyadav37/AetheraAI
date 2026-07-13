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

    # Handle friendly greeting directly to guarantee high-quality simple start
    is_greeting = any(word in prompt.lower().strip("?.!,") for word in ["hello", "hi", "hey", "greetings", "hii", "hy"])
    if is_greeting and len(prompt.strip()) < 10:
        response = "Hi! This is NexusAI AI. How can I help you today?"
    else:
        system_instruction = f"""
    You are NexusAI Conversational AI — a persistent assistant with memory.
    
    Hinglish Language Guide:
    - Note that in Hindi/Hinglish (Hindi written in Latin/English script), the words "k", "ke", "ki" (e.g., "file k andar", "code ke baare me") are prepositions meaning "of", "about", "for", or "to". Do NOT mistake the single character/word "k" as a filename, letter, or variable name. Always resolve "file k" to "file of" or "inside the file".
    
    Style Guide:
    - Respond in a warm, helpful, and natural tone.
    - If the user greeting is simple (e.g. "hi" or "hello"), respond concisely (e.g., "Hi! This is NexusAI AI. How can I help you today?").
    - Use clean markdown formatting, lists, or headers only for complex/multi-topic answers. Avoid introducing headings or bullet points unnecessarily for short replies.
    
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
            connectors=connectors
        )

    add_message(conversation_id, "assistant", response)
    _maybe_summarize(conversation_id)

    print("Conversation ID:", conversation_id)
    print("Response Generated Successfully")

    return {
        "agent": "conversational",
        "conversation_id": conversation_id,
        "message": response,
    }
