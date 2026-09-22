"""Top-level routing only; never executes a specialist agent."""
from typing import Any, Dict

VALID_SUPERVISOR_AGENTS = {"engineer", "conversational", "research", "education", "automation"}


def route_request(task: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Return safe routing metadata without chain-of-thought or agent output."""
    text = (task or "").strip().lower()
    context = context or {}
    rules = (
        ("automation", ("remind", "reminder", "schedule", "recurring", "automate", "workflow", "every day")),
        ("education", ("teach", "learn", "explain", "lesson", "study", "quiz", "homework")),
        ("research", ("research", "investigate", "sources", "compare", "literature", "latest information")),
        ("engineer", ("build", "code", "bug", "debug", "api", "website", "app", "python", "react", "project")),
    )
    for agent, markers in rules:
        if any(marker in text for marker in markers):
            return {"intent": agent, "agent": agent, "confidence": 0.9, "requires_clarification": False, "task": task, "context": context}
    # General/casual conversation is deliberately the safe default. It creates
    # no Engineer execution, workspace, or deployment lifecycle.
    return {"intent": "conversation", "agent": "conversational", "confidence": 0.95, "requires_clarification": False, "task": task, "context": context}
