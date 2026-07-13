from llm.groq_client import generate_response


def review_report(prompt: str, report: str):
    return generate_response(
        f"""
You are the Reviewer inside NexusAI Research AI.
Review the report for clarity, completeness, weak claims, and missing evidence.

Original Request:
{prompt}

Report:
{report}

Return a short markdown quality review with:
- Strengths
- Gaps
- Confidence Level
- Recommended Improvements
"""
    )