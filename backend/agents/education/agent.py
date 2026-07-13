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
) -> dict:
    """
    Main entry point for
    NexusAI Education AI.
    """

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

        # -------------------------
        # Detect Learning Mode
        # -------------------------

        mode = detect_mode(
            prompt
        )

        # -------------------------
        # Generate Response
        # -------------------------

        content = route_mode(

            mode=mode,

            prompt=prompt,

        )

        # -------------------------
        # Format Response
        # -------------------------

        return format_response(

            mode=mode,

            content=content,

        )

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