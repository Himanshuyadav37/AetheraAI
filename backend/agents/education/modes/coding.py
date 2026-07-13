"""
NexusAI AI - Coding Mode

Generates coding explanations, algorithms,
implementations and interview-ready solutions
in Markdown format.
"""

from llm.groq_client import generate_response

from agents.education.prompts.coding import (
    build_coding_prompt,
)


def coding_mode(user_prompt: str) -> str:
    """
    Coding Mode

    Flow:

    User Query
        ↓
    Build Prompt
        ↓
    Groq LLM
        ↓
    Markdown Response
        ↓
    Return Markdown
    """

    try:

        prompt = build_coding_prompt(
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
            f"[Coding Mode Error] {e}"
        )

        return f"""
# ❌ Coding Mode Error

Unable to generate the coding response.

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