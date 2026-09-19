"""Generate validated workflow designs without fabricated provider endpoints."""

import json
import re
import uuid

from agents.automation.prompts import WORKFLOW_PROMPT
from llm.groq_client import generate_response


def generate_workflow(plan: dict) -> dict:
    platform = plan.get("platform", "n8n")
    prompt_text = plan.get("original_prompt", "")
    full_prompt = f"""{WORKFLOW_PROMPT}

Platform: {platform}
User's original request:
\"\"\"{prompt_text}\"\"\"

Structured automation plan:
{json.dumps(plan, indent=2)}

Generate the complete {platform} workflow now.
Return ONLY raw JSON. Do not include credentials or secret values.
"""
    workflow_data = _extract_json(generate_response(full_prompt))
    return _ensure_required_fields(workflow_data, plan, platform)


def _ensure_required_fields(data: dict, plan: dict, platform: str) -> dict:
    apps = plan.get("apps", ["Webhook"])
    actions = plan.get("actions", [])
    if not isinstance(data, dict):
        raise ValueError("Workflow provider returned a non-object response")
    if not data.get("title"):
        data["title"] = _build_title(plan)
    if not data.get("description"):
        data["description"] = (
            f"Automated workflow connecting {', '.join(apps[:3])}. "
            f"Triggered by {plan.get('trigger', {}).get('description', 'an event')} "
            f"and executing {len(actions)} action(s)."
        )
    data.setdefault("platform", platform)
    if not data.get("workflow_json"):
        raise ValueError("Workflow provider returned no executable workflow_json")
    data.setdefault("workflow_mermaid", _build_mermaid(plan))
    data.setdefault("workflow_ascii", _build_ascii(plan))
    data.setdefault("nodes", _build_nodes_from_plan(plan))
    data.setdefault("steps", _build_steps_from_plan(plan))
    data.setdefault("credentials", plan.get("credentials", []))
    data.setdefault("deployment", _build_deployment(plan, platform))
    data.setdefault("testing", _build_testing(plan))
    data.setdefault("error_handling", _build_error_handling(plan))
    data.setdefault("security_notes", _build_security_notes(plan))
    return data


def _build_title(plan: dict) -> str:
    apps = plan.get("apps", [])
    trigger = plan.get("trigger", {})
    trigger_platform = trigger.get("platform", "Trigger")
    if len(apps) >= 2:
        return f"{trigger_platform} -> {' -> '.join(apps[1:4])}"
    return "Automated Workflow"


def _build_mermaid(plan: dict) -> str:
    lines = ["flowchart TD"]
    trigger = plan.get("trigger", {})
    lines.append(f'    A["{trigger.get("platform", "Trigger")}\\n{trigger.get("description", "Receives trigger event")}"]')
    previous = "A"
    for index, action in enumerate(plan.get("actions", [])):
        node_id = chr(66 + index)
        label = action.get("app", f"Step {index + 1}")
        lines.extend([f'    {node_id}["{label}"]', f"    {previous} --> {node_id}"])
        previous = node_id
    return "\n".join(lines)


def _build_ascii(plan: dict) -> str:
    parts = [plan.get("trigger", {}).get("platform", "Trigger")]
    for action in plan.get("actions", []):
        parts.extend(["  |", action.get("app", "Action")])
    return "\n".join(parts)


def _build_nodes_from_plan(plan: dict) -> list:
    nodes = [{
        "id": f"node_{str(uuid.uuid4())[:8]}",
        "name": plan.get("trigger", {}).get("platform", "Trigger"),
        "type": "trigger",
        "purpose": plan.get("trigger", {}).get("description", "Starts the workflow"),
        "config": {"type": plan.get("trigger", {}).get("type", "webhook")},
        "position": {"x": 100, "y": 100},
    }]
    for index, action in enumerate(plan.get("actions", [])):
        nodes.append({
            "id": f"node_{str(uuid.uuid4())[:8]}",
            "name": action.get("app", f"Step {index + 1}"),
            "type": "action",
            "purpose": action.get("description", action.get("action", "")),
            "config": {},
            "position": {"x": 100, "y": 250 + index * 150},
        })
    return nodes


def _build_steps_from_plan(plan: dict) -> list:
    steps = [{
        "step": 1,
        "title": f"Trigger: {plan.get('trigger', {}).get('platform', 'Trigger')}",
        "description": plan.get("trigger", {}).get("description", "Workflow is triggered"),
        "node_id": None,
    }]
    for action in plan.get("actions", []):
        steps.append({
            "step": action.get("step", len(steps) + 1),
            "title": f"{action.get('app', 'Action')}: {action.get('action', '')}",
            "description": action.get("description", ""),
            "node_id": None,
        })
    return steps


def _build_deployment(plan: dict, platform: str) -> str:
    return f"Deploy the validated workflow to the authorized {platform} credential store, configure provider credentials there, run a sandbox trigger, verify every provider response, and activate only after verification."


def _build_testing(plan: dict) -> str:
    return "Run a signed test event, verify each provider response ID, inspect the execution log, and confirm no production destination was used."


def _build_error_handling(plan: dict) -> str:
    return "Use bounded exponential retries for transient provider failures, do not retry permanent authorization errors, and mark executions PARTIAL_FAILURE when an earlier side effect succeeded."


def _build_security_notes(plan: dict) -> str:
    return "Credentials stay in the server-side environment or credential vault. Never put secrets in prompts, workflow JSON, logs, or frontend responses."


def _extract_json(text: str) -> dict:
    if not text:
        return {}
    clean = re.sub(r"```(?:json)?\s*", "", text)
    clean = re.sub(r"```\s*$", "", clean, flags=re.MULTILINE).strip()
    start = clean.find("{")
    if start < 0:
        return {}
    depth = 0
    for index, char in enumerate(clean[start:], start):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        if depth == 0:
            try:
                return json.loads(clean[start:index + 1])
            except json.JSONDecodeError as exc:
                raise ValueError("Workflow provider returned invalid JSON") from exc
    raise ValueError("Workflow provider returned incomplete JSON")
