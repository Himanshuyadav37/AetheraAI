"""
NexusAI AI - Automation Response Formatter

Stage 4 (final) of the Automation AI pipeline.

Assembles the final response dict from:
  - plan     (from planner)
  - workflow  (from generator)
  - validation (from validator)

Returns a standardized dict that matches AutomationResponse.
"""

from datetime import datetime


# Platform display names
PLATFORM_LABELS = {
    "n8n":           "n8n",
    "make":          "Make.com",
    "zapier":        "Zapier",
    "power_automate": "Power Automate",
    "github_actions": "GitHub Actions",
    "webhook":       "Webhook",
    "rest_api":      "REST API",
}


def format_response(
    plan: dict,
    workflow: dict,
    validation: dict,
) -> dict:
    """
    Format the final Automation AI response.

    Parameters
    ----------
    plan : dict
        Structured plan from the planner.
    workflow : dict
        Generated workflow from the generator.
    validation : dict
        Validation result from the validator.

    Returns
    -------
    dict
        Standardized AutomationResponse-compatible dict.
    """

    platform_key = plan.get("platform", "n8n")
    platform_label = PLATFORM_LABELS.get(platform_key, platform_key.upper())

    # Platform alternatives as human-readable labels
    alt_platforms = [
        PLATFORM_LABELS.get(p, p.upper())
        for p in plan.get("platform_alternatives", [])
    ]

    return {
        "success": True,
        "agent": "automation",
        "title": workflow.get("title", _build_fallback_title(plan)),
        "description": workflow.get("description", ""),
        "platform": platform_label,
        "platform_key": platform_key,
        "platform_alternatives": alt_platforms,
        "workflow_json": workflow.get("workflow_json"),
        "workflow_mermaid": workflow.get("workflow_mermaid", ""),
        "workflow_ascii": workflow.get("workflow_ascii", ""),
        "nodes": workflow.get("nodes", []),
        "steps": workflow.get("steps", []),
        "credentials": workflow.get("credentials", plan.get("credentials", [])),
        "deployment": workflow.get("deployment", ""),
        "testing": workflow.get("testing", ""),
        "error_handling": workflow.get("error_handling", ""),
        "security_notes": workflow.get("security_notes", ""),
        "validation_errors": validation.get("errors", []),
        "validation_warnings": validation.get("warnings", []),
        "validation_passed": validation.get("valid", False),
        "complexity": plan.get("complexity", "medium"),
        "apps": plan.get("apps", []),
        "timestamp": datetime.utcnow().isoformat(),
    }


def _build_fallback_title(plan: dict) -> str:
    apps = plan.get("apps", [])
    if len(apps) >= 2:
        return f"{apps[0]} → {' → '.join(apps[1:4])}"
    return "Automated Workflow"
