"""
NexusAI AI - Quiz Mode

Generates quizzes in Markdown format.
"""

from llm.groq_client import generate_response

from agents.education.prompts.quiz import (
    build_quiz_prompt,
)


def quiz_mode(user_prompt: str) -> str:
    """
    Quiz Mode

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

        prompt = build_quiz_prompt(
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
            f"[Quiz Mode Error] {e}"
        )

        return f"""
# ❌ Quiz Mode Error

Unable to generate the quiz.

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