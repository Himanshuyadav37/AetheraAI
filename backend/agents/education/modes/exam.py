"""
NexusAI AI - Exam Mode

Generates university-style exam answers
in Markdown format.
"""

from llm.groq_client import generate_response

from agents.education.prompts.exam import (
    build_exam_prompt,
)


def exam_mode(user_prompt: str) -> str:
    """
    Exam Mode

    Flow

    User Question
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

        prompt = build_exam_prompt(
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
            f"[Exam Mode Error] {e}"
        )

        return f"""
# ❌ Exam Mode Error

Unable to generate the exam answer.

### Possible Reasons

- LLM API failed
- Empty response
- Network issue
- Internal server error

### Error

```
{str(e)}
```

Please try again.
"""