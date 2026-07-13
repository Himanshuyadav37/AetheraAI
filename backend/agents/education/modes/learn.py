"""
NexusAI AI - Learn Mode

Generates educational explanations
in Markdown format.
"""

from llm.groq_client import generate_response

from agents.education.prompts.learn import (
    build_learn_prompt,
)


def learn_mode(user_prompt: str) -> str:
    """
    Learn Mode

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

        prompt = build_learn_prompt(
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
            f"[Learn Mode Error] {e}"
        )

        return f"""
# ❌ Learn Mode Error

Unable to generate the learning content.

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