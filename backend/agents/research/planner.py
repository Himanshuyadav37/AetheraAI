from datetime import datetime
from llm.groq_client import generate_response


def plan_research(prompt: str, live_context: str = "", depth: str = "normal"):
    today_str = datetime.utcnow().strftime("%d %B %Y")
    return generate_response(
        f"""
You are the Chief Intelligence Planner inside NexusAI Autonomous Research AI.
Current Date: {today_str}

Objective: Create a comprehensive, fact-grounded research blueprint based on the user request and retrieved live intelligence.

User Topic / Request:
{prompt}

Live Web Context & Signals:
{live_context[:3500]}

Depth Level: {depth}

Instructions:
1. Outline the primary research objective grounded strictly in verified current events ({today_str}).
2. Formulate 4-6 critical investigative questions (e.g., actual host/location, accurate member roster, verified agenda vs speculative claims, geopolitical friction points, and business/tech implications).
3. Specify evidence verification criteria (distinguishing Confirmed Facts vs Reported vs Speculative Proposals).

Format as clean GitHub Flavored Markdown with:
- ## Research Objective
- ## Core Investigative Questions
- ## Evidence Verification Strategy
- ## Expected Deliverables
"""
    )