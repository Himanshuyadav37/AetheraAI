"""
NexusAI AI - Revision Mode

Generates quick revision notes
in Markdown format.
"""

from llm.groq_client import generate_response

from agents.education.prompts.revision import (
    build_revision_prompt,
)


def revision_mode(user_prompt: str) -> str:
    """
    Revision Mode

    Flow

    User Query
          ↓
    Build Prompt
          ↓
    Groq LLM
          ↓
    Markdown Response
          ↓
    Return Response
    """

    try:

        prompt = build_revision_prompt(
            user_prompt
        )

        response = generate_response(
            prompt
        )

        if response is None:
            raise ValueError(
                "LLM returned no response."
            )

        response = str(
            response
        ).strip()

        if not response:
            raise ValueError(
                "Empty response generated."
            )

        return response

    except Exception as e:

        print(
            f"[Revision Mode Error] {e}"
        )

        return f"""
# ❌ Revision Mode Error

Unable to generate revision notes.

### Possible Reasons

- LLM API failed
- Empty model response
- Network issue
- Internal server error

### Error

```
{str(e)}
```

Please try again.
"""