"""
NexusAI AI - Automation Planner

Stage 1 of the Automation AI pipeline.

Responsibilities
----------------
- Parse the user's natural language automation description
- Detect the target platform (n8n by default)
- Detect trigger, apps, actions, conditions, variables, credentials
- Return a structured plan dict for the workflow generator
"""

import json
import re

from agents.automation.prompts import PLANNER_PROMPT
from llm.groq_client import generate_response


# ============================================================
# Platform Detection Keywords
# ============================================================

PLATFORM_KEYWORDS = {
    "make":          ["make.com", "make ", "integromat"],
    "zapier":        ["zapier"],
    "power_automate":["power automate", "microsoft power automate", "ms power automate"],
    "github_actions":["github actions", "github action", "gh actions"],
    "n8n":           ["n8n"],
    "webhook":       ["pure webhook", "raw webhook"],
    "rest_api":      ["rest api only", "pure rest"],
}

DEFAULT_PLATFORM = "n8n"

PLATFORM_ALTERNATIVES = {
    "n8n":           ["make", "zapier", "power_automate"],
    "make":          ["n8n", "zapier"],
    "zapier":        ["make", "n8n"],
    "power_automate":["n8n", "make"],
    "github_actions":["n8n"],
    "webhook":       ["n8n", "make"],
    "rest_api":      ["n8n"],
}


def detect_platform_from_prompt(prompt: str) -> str:
    """
    Detect the target platform from the user prompt text.
    Returns DEFAULT_PLATFORM if none detected.
    """
    lower = prompt.lower()
    for platform, keywords in PLATFORM_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                return platform
    return DEFAULT_PLATFORM


def plan_automation(prompt: str, platform_override: str | None = None) -> dict:
    """
    Stage 1: Extract a structured automation plan from the user prompt.

    Parameters
    ----------
    prompt : str
        Raw user natural language automation description.
    platform_override : str | None
        Optional platform override from the API request.

    Returns
    -------
    dict
        Structured plan with trigger, apps, actions, credentials, platform, etc.
    """

    # Detect platform before calling LLM for better context
    detected_platform = platform_override or detect_platform_from_prompt(prompt)

    # Build the LLM prompt
    full_prompt = f"""{PLANNER_PROMPT}

User request:
\"\"\"{prompt}\"\"\"

Detected/preferred platform: {detected_platform}

Remember: Return ONLY raw JSON. No markdown. No explanations.
"""

    raw_response = generate_response(full_prompt)

    # Extract JSON from response (handle cases where LLM wraps in markdown)
    plan = _extract_json(raw_response)

    # Ensure platform is set correctly
    if platform_override:
        plan["platform"] = platform_override
    elif not plan.get("platform"):
        plan["platform"] = detected_platform

    # Ensure platform_alternatives is set
    if not plan.get("platform_alternatives"):
        plan["platform_alternatives"] = PLATFORM_ALTERNATIVES.get(
            plan["platform"], ["n8n", "make"]
        )

    # Attach the original prompt for use downstream
    plan["original_prompt"] = prompt

    return plan


def _extract_json(text: str) -> dict:
    """
    Robustly extract a JSON dict from an LLM response.
    Handles cases where the LLM wraps the JSON in markdown code fences.
    """
    if not text:
        return _fallback_plan()

    # Strip markdown code fences
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()

    # Find the first { and last } to isolate the JSON
    start = text.find("{")
    end = text.rfind("}") + 1

    if start == -1 or end == 0:
        return _fallback_plan()

    json_str = text[start:end]

    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return _fallback_plan()


def _fallback_plan() -> dict:
    """
    Return a minimal fallback plan when LLM parsing fails.
    """
    return {
        "trigger": {
            "type": "webhook",
            "description": "HTTP webhook trigger",
            "platform": "n8n"
        },
        "apps": ["Webhook", "HTTP Request"],
        "actions": [
            {
                "step": 1,
                "app": "Webhook",
                "action": "Receive HTTP Request",
                "description": "Receive incoming data via webhook"
            }
        ],
        "conditions": [],
        "variables": [],
        "credentials": [],
        "platform": DEFAULT_PLATFORM,
        "platform_alternatives": ["make", "zapier"],
        "complexity": "simple",
        "estimated_nodes": 2,
    }
