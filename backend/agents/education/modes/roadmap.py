"""
NexusAI AI - Roadmap Mode

Generates learning roadmaps
in Markdown format.
"""

from llm.groq_client import generate_response

from agents.education.prompts.roadmap import (
    build_roadmap_prompt,
)


def roadmap_mode(user_prompt: str) -> str:
    """
    Roadmap Mode

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

        prompt = build_roadmap_prompt(
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
            f"[Roadmap Mode Error] {e}"
        )

        return f"""
# ❌ Roadmap Mode Error

Unable to generate the learning roadmap.

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