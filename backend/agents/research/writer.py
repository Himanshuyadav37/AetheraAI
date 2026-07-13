from llm.groq_client import generate_response


def write_report(prompt: str, plan: str, findings: str):
    return generate_response(
        f"""
You are the Writer inside NexusAI Research AI.
Convert the research findings into a professional report.

Original Request:
{prompt}

Plan:
{plan}

Findings:
{findings}

Return markdown with:
# Title
## Executive Summary
## Key Findings
## Analysis
## Recommendations
## Limitations
## Next Steps
"""
    )