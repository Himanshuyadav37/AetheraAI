from llm.groq_client import generate_response


def conduct_research(prompt: str, plan: str, depth: str = "normal"):
    return generate_response(
        f"""
You are the Research Agent inside NexusAI Research AI.
Analyze the topic using your knowledge and produce grounded research findings.
Do not fabricate live web access. If fresh verification is needed, say so clearly.

Depth: {depth}
Topic: {prompt}

Research Plan:
{plan}

Return markdown with:
- Executive Findings
- Detailed Analysis
- Risks / Unknowns
- Suggested Source Types
- Follow-up Research Questions
"""
    )