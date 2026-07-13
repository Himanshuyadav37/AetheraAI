from llm.groq_client import generate_response


def plan_research(prompt: str, depth: str = "normal"):
    return generate_response(
        f"""
You are the Planner inside NexusAI Research AI.
Create a concise research plan for the user request.

Depth: {depth}
Topic: {prompt}

Return markdown with these sections:
- Research Objective
- Key Questions
- Method
- Expected Deliverables
"""
    )