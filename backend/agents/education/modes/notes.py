import json
import re
from llm.groq_client import generate_response

from agents.education.prompts.notes import (
    build_notes_prompt,
)


def notes_mode(
    user_prompt: str,
):
    """
    Notes Mode
    """

    prompt = build_notes_prompt(
        user_prompt
    )

    response = generate_response(
        prompt
    )

    # Parse JSON response - more robust handling
    try:
        # Remove markdown code blocks
        response = re.sub(
            r"```json|```",
            "",
            response
        ).strip()

        # Find JSON object
        start = response.find("{")
        end = response.rfind("}")

        if start == -1 or end == -1:
            raise ValueError("No JSON found")

        json_text = response[start:end + 1]

        # Replace control characters that break JSON
        json_text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', json_text)

        parsed = json.loads(json_text)
        return parsed
    except Exception as e:
        print(f"JSON Parse Error in notes_mode: {e}")
        print(f"Response was: {response[:500]}")
        return {
            "error": str(e),
            "raw_response": response
        }