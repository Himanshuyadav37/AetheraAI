"""
NexusAI AI - Notes Mode

Generates study notes in structured Markdown format.
"""

from llm.groq_client import generate_response
from agents.education.prompts.notes import (
    build_notes_prompt,
)


def notes_mode(user_prompt: str) -> str:
    """
    Notes Mode
    """
    try:
        prompt = build_notes_prompt(user_prompt)
        response = generate_response(prompt, max_tokens=6144)

        if response is None:
            raise ValueError("LLM returned no response.")

        response = str(response).strip()

        if not response:
            raise ValueError("Empty response generated.")

        return response

    except Exception as e:
        print(f"[Notes Mode Error] {e}")
        return f"""
# ❌ Notes Mode Error

Unable to generate the study notes.

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