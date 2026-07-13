"""
NexusAI AI - Interview Mode

Generates interview preparation content
in Markdown format.
"""

from llm.groq_client import generate_response

from agents.education.prompts.interview import (
    build_interview_prompt,
)


def interview_mode(user_prompt: str) -> str:
    """
    Interview Mode

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

        prompt = build_interview_prompt(
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
            f"[Interview Mode Error] {e}"
        )

        return f"""
# ❌ Interview Mode Error

Unable to generate interview preparation content.

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