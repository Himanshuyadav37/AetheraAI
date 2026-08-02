"""
NexusAI AI - Education Agent

Main entry point for the Education AI module.

Flow

User Prompt
      │
      ▼
Intent Detection
      │
      ▼
Mode Routing
      │
      ▼
LLM Response
      │
      ▼
Response Formatting
      │
      ▼
Return Response
"""

from agents.education.detector import (
    detect_mode,
)

from agents.education.router import (
    route_mode,
)

from agents.education.formatter import (
    format_response,
)


def education_agent(
    prompt: str,
    connectors: dict | None = None,
    session_id: str | None = None,
) -> dict:
    """
    Main entry point for
    NexusAI Education AI.
    """
    from datetime import datetime
    from services.execution_stream import publish_agent_event

    def _step(step_name: str, status: str, message: str, details: dict = None):
        return {
            "agent": "education",
            "step": step_name,
            "status": status,
            "message": message,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat()
        }

    try:

        if prompt is None:
            raise ValueError(
                "Prompt cannot be None."
            )

        prompt = str(
            prompt
        ).strip()

        if not prompt:
            raise ValueError(
                "Prompt cannot be empty."
            )

        if session_id:
            publish_agent_event(session_id, "step", _step("detector", "in_progress", "Analyzing query learning intent..."), "conversations")

        # -------------------------
        # Detect Learning Mode
        # -------------------------

        mode = detect_mode(
            prompt
        )

        if session_id:
            publish_agent_event(session_id, "step", _step("detector", "completed", f"Learning intent detected: {mode}", {"mode": mode}), "conversations")
            publish_agent_event(session_id, "step", _step("router", "in_progress", f"Routing learning request to {mode} workspace..."), "conversations")

        # -------------------------
        # Generate Response
        # -------------------------

        content = route_mode(

            mode=mode,

            prompt=prompt,

        )

        if session_id:
            publish_agent_event(session_id, "step", _step("router", "completed", "Learning response draft generated successfully."), "conversations")
            publish_agent_event(session_id, "step", _step("formatter", "in_progress", "Formatting educational report & resources..."), "conversations")

        # -------------------------
        # Format Response
        # -------------------------

        result = format_response(

            mode=mode,

            content=content,

        )

        if session_id:
            publish_agent_event(session_id, "step", _step("formatter", "completed", "Educational study guide complete.", {"success": True}), "conversations")

        return result

    except Exception as e:

        print(
            f"[Education Agent Error] {e}"
        )

        return {

            "success": False,

            "agent": "education",

            "mode": "error",

            "title": "❌ Education AI Error",

            "response": f"""
# Education AI Error

An unexpected error occurred.

### Error

```
{str(e)}
```

Please try again.
""",

            "content_type": "markdown",

        }