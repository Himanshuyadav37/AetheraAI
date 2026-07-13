"""
NexusAI AI - Automation Workflow Generator

Stage 2 of the Automation AI pipeline.

Responsibilities
----------------
- Receive the structured plan from the Planner
- Call the LLM to generate a complete, platform-specific workflow
- Parse and return the full workflow dict including:
    workflow_json, workflow_mermaid, workflow_ascii, nodes, steps
"""

import json
import re
import uuid

from agents.automation.prompts import WORKFLOW_PROMPT
from llm.groq_client import generate_response


def generate_workflow(plan: dict) -> dict:
    """
    Stage 2: Generate the complete workflow from the structured plan.

    Parameters
    ----------
    plan : dict
        Structured plan from the planner stage.

    Returns
    -------
    dict
        Full workflow dict with json, mermaid, ascii, nodes, steps, etc.
    """

    platform = plan.get("platform", "n8n")
    prompt_text = plan.get("original_prompt", "")

    full_prompt = f"""{WORKFLOW_PROMPT}

Platform: {platform}

User's original request:
\"\"\"{prompt_text}\"\"\"

Structured automation plan:
{json.dumps(plan, indent=2)}

Generate the complete {platform} workflow now.
Remember: Return ONLY raw JSON. No markdown fences. No explanations.
"""

    raw_response = generate_response(full_prompt)
    workflow_data = _extract_json(raw_response)

    # Ensure required fields are present with sensible defaults
    workflow_data = _ensure_required_fields(workflow_data, plan, platform)

    return workflow_data


def _ensure_required_fields(data: dict, plan: dict, platform: str) -> dict:
    """
    Ensure the workflow dict has all required fields.
    Fill in sensible defaults for any missing fields.
    """

    apps = plan.get("apps", ["Webhook"])
    actions = plan.get("actions", [])

    if not data.get("title"):
        data["title"] = _build_title(plan)

    if not data.get("description"):
        data["description"] = (
            f"Automated workflow connecting {', '.join(apps[:3])}. "
            f"Triggered by {plan.get('trigger', {}).get('description', 'an event')} "
            f"and executing {len(actions)} action(s)."
        )

    if not data.get("platform"):
        data["platform"] = platform

    # Build fallback workflow_json for n8n if missing
    if not data.get("workflow_json"):
        data["workflow_json"] = _build_fallback_n8n_workflow(plan)

    # Build fallback mermaid diagram if missing
    if not data.get("workflow_mermaid"):
        data["workflow_mermaid"] = _build_mermaid(plan)

    # Build fallback ascii diagram if missing
    if not data.get("workflow_ascii"):
        data["workflow_ascii"] = _build_ascii(plan)

    # Ensure nodes list
    if not data.get("nodes"):
        data["nodes"] = _build_nodes_from_plan(plan)

    # Ensure steps list
    if not data.get("steps"):
        data["steps"] = _build_steps_from_plan(plan)

    # Ensure credentials list
    if not data.get("credentials"):
        data["credentials"] = plan.get("credentials", [])

    # Ensure deployment guide
    if not data.get("deployment"):
        data["deployment"] = _build_deployment(plan, platform)

    # Ensure testing guide
    if not data.get("testing"):
        data["testing"] = _build_testing(plan)

    # Ensure error handling
    if not data.get("error_handling"):
        data["error_handling"] = _build_error_handling(plan)

    # Ensure security notes
    if not data.get("security_notes"):
        data["security_notes"] = _build_security_notes(plan)

    return data


def _build_title(plan: dict) -> str:
    apps = plan.get("apps", [])
    trigger = plan.get("trigger", {})
    trigger_platform = trigger.get("platform", "Trigger")
    if len(apps) >= 2:
        return f"{trigger_platform} → {' → '.join(apps[1:4])}"
    return "Automated Workflow"


def _build_mermaid(plan: dict) -> str:
    """Build a Mermaid flowchart TD from the plan."""
    lines = ["flowchart TD"]
    trigger = plan.get("trigger", {})
    actions = plan.get("actions", [])

    trigger_label = trigger.get("platform", "Trigger")
    trigger_desc = trigger.get("description", "Receives trigger event")
    lines.append(f'    A["{trigger_label}\\n{trigger_desc}"]')

    prev = "A"
    for i, action in enumerate(actions):
        node_id = chr(66 + i)  # B, C, D, ...
        app = action.get("app", f"Step {i + 1}")
        act = action.get("action", "")
        label = f"{app}\\n{act}" if act else app
        lines.append(f'    {node_id}["{label}"]')
        lines.append(f"    {prev} --> {node_id}")
        prev = node_id

    return "\n".join(lines)


def _build_ascii(plan: dict) -> str:
    """Build an ASCII diagram from the plan."""
    parts = []
    trigger = plan.get("trigger", {})
    trigger_label = trigger.get("platform", "Trigger")
    parts.append(trigger_label)
    for action in plan.get("actions", []):
        parts.append("  ↓")
        parts.append(action.get("app", "Action"))
    return "\n".join(parts)


def _build_nodes_from_plan(plan: dict) -> list:
    """Build a basic nodes list from the plan."""
    nodes = []
    trigger = plan.get("trigger", {})
    nodes.append({
        "id": f"node_{str(uuid.uuid4())[:8]}",
        "name": trigger.get("platform", "Trigger"),
        "type": "trigger",
        "purpose": trigger.get("description", "Starts the workflow"),
        "config": {"type": trigger.get("type", "webhook")},
        "position": {"x": 100, "y": 100}
    })
    for i, action in enumerate(plan.get("actions", [])):
        nodes.append({
            "id": f"node_{str(uuid.uuid4())[:8]}",
            "name": action.get("app", f"Step {i + 1}"),
            "type": "action",
            "purpose": action.get("description", action.get("action", "")),
            "config": {},
            "position": {"x": 100, "y": 250 + i * 150}
        })
    return nodes


def _build_steps_from_plan(plan: dict) -> list:
    """Build execution steps from the plan."""
    steps = []
    trigger = plan.get("trigger", {})
    steps.append({
        "step": 1,
        "title": f"Trigger: {trigger.get('platform', 'Trigger')}",
        "description": trigger.get("description", "Workflow is triggered"),
        "node_id": None
    })
    for action in plan.get("actions", []):
        steps.append({
            "step": action.get("step", len(steps) + 1),
            "title": f"{action.get('app', 'Action')}: {action.get('action', '')}",
            "description": action.get("description", ""),
            "node_id": None
        })
    return steps


def _build_fallback_n8n_workflow(plan: dict) -> dict:
    """
    Build a minimal but valid n8n workflow JSON.
    This is the fallback if the LLM doesn't return valid workflow_json.
    """
    trigger = plan.get("trigger", {})
    actions = plan.get("actions", [])

    workflow_id = str(uuid.uuid4())
    nodes = []
    connections = {}

    # Trigger node
    trigger_id = str(uuid.uuid4())
    trigger_node = {
        "id": trigger_id,
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 1,
        "position": [100, 300],
        "parameters": {
            "httpMethod": "POST",
            "path": "automation-webhook",
            "responseMode": "responseNode",
        },
    }
    nodes.append(trigger_node)

    prev_name = "Webhook"
    connections[prev_name] = {"main": [[]]}

    y = 500
    for i, action in enumerate(actions[:8]):  # cap at 8 action nodes
        app_name = action.get("app", f"Action {i + 1}")
        node_id = str(uuid.uuid4())
        action_node = {
            "id": node_id,
            "name": app_name,
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4,
            "position": [100 + i * 250, y],
            "parameters": {
                "url": "https://example.com/api",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "data", "value": "={{ $json }}"}
                    ]
                },
            },
            "notes": action.get("description", ""),
        }
        nodes.append(action_node)
        connections[prev_name]["main"][0].append(
            {"node": app_name, "type": "main", "index": 0}
        )
        connections[app_name] = {"main": [[]]}
        prev_name = app_name

    return {
        "id": workflow_id,
        "name": _build_title(plan),
        "active": False,
        "nodes": nodes,
        "connections": connections,
        "settings": {
            "executionOrder": "v1",
            "saveManualExecutions": True,
            "callerPolicy": "workflowsFromSameOwner",
            "errorWorkflow": "",
        },
        "staticData": None,
        "tags": ["NexusAI", "Automation"],
        "versionId": str(uuid.uuid4()),
        "meta": {
            "templateCredsSetupCompleted": True
        },
    }


def _build_deployment(plan: dict, platform: str) -> str:
    platform_label = platform.upper().replace("_", " ")
    title = _build_title(plan)
    return f"""## Deployment — {platform_label}

### Step 1: Import the Workflow
1. Copy the generated workflow JSON from the **Generated JSON** tab
2. Open your {platform_label} instance
3. Navigate to **Workflows → Import from JSON**
4. Paste the JSON and click **Import**

### Step 2: Configure Credentials
For each credential listed in the **Credentials** section:
1. Go to **Settings → Credentials**
2. Click **+ Add Credential**
3. Select the credential type and follow the OAuth / API Key setup
4. Save and attach the credential to the respective node

### Step 3: Configure Node Settings
Review each node and update:
- Webhook URLs (replace example URLs with your actual endpoints)
- Email addresses, Sheet IDs, Channel names, etc.
- Any placeholder values highlighted in the node config

### Step 4: Test with a Sample Trigger
1. Send a test HTTP request / form submission
2. Check the execution log in {platform_label}
3. Verify each node executed successfully

### Step 5: Activate the Workflow
1. Toggle the workflow to **Active**
2. Copy your webhook URL from the trigger node
3. Add it to your form / application

**Workflow:** *{title}*
"""


def _build_testing(plan: dict) -> str:
    apps = plan.get("apps", [])
    return f"""## Testing Checklist

### Pre-Deployment
- [ ] All credentials are configured and authenticated
- [ ] All webhook URLs are accessible from the internet
- [ ] Node configurations reviewed (no placeholder values remain)

### Functional Testing
- [ ] Trigger fires correctly (manual test run)
- [ ] Data passes correctly from trigger to first action
- [ ] Each node receives the expected input data
- [ ] Each action executes without errors
- [ ] Final output matches expected result (email sent, row added, etc.)

### Integration Testing
{"".join([f"- [ ] {app} integration returns success response{chr(10)}" for app in apps])}

### Error Handling
- [ ] Test with invalid/missing input data
- [ ] Verify error notifications fire correctly
- [ ] Test retry behavior with a temporarily unavailable service

### Performance
- [ ] Workflow completes within acceptable time limits
- [ ] No rate limiting issues with connected services
"""


def _build_error_handling(plan: dict) -> str:
    return """## Error Handling Strategy

### Retry Configuration
- **Trigger failures**: Set retry count to 3 with exponential backoff (1s, 2s, 4s)
- **API call failures**: Configure per-node retry up to 3 attempts
- **Timeout**: Set node timeout to 30 seconds per request

### Common Failure Scenarios
| Scenario | Cause | Resolution |
|----------|-------|-----------|
| Webhook not received | Firewall or network issue | Check webhook URL and allow-listing |
| Auth failure | Expired credential token | Re-authenticate credential in settings |
| Rate limit hit | Too many API calls | Add delay node between requests |
| Data format mismatch | API schema change | Update field mappings in the affected node |
| Missing required field | Upstream data gap | Add a conditional check / filter node |

### Alerting
- Enable workflow error emails in Settings → Notifications
- Add a Slack/Email node in the error branch to alert your team
- Set up execution history retention for at least 30 days

### Fallback Actions
- On critical failure: Store the raw payload to a backup database
- Send failure alert with execution ID for manual replay
- Use Dead Letter Queue pattern for high-volume workflows
"""


def _build_security_notes(plan: dict) -> str:
    return """## Security Considerations

### Credential Management
- Store all API keys and tokens in your automation platform's credential vault
- Never hardcode secrets in node parameters
- Rotate API keys every 90 days
- Use the principle of least privilege — only grant the permissions each integration needs

### Webhook Security
- Add a **webhook secret header** (X-Webhook-Secret) and validate it in the first node
- Allowlist IP addresses of source services where possible
- Use HTTPS endpoints only — never plain HTTP
- Add rate limiting at the webhook ingress level

### Data Privacy
- Avoid logging sensitive fields (emails, passwords, PII) in execution logs
- Mask sensitive data in error messages
- Review GDPR/CCPA implications for any personal data flowing through the workflow

### Network
- Deploy your automation platform inside a private VPC when possible
- Use environment variables for all configuration values
- Enable audit logging for all workflow executions
"""


def _extract_json(text: str) -> dict:
    """
    Robustly extract a JSON object from an LLM response.
    Handles markdown fences and leading/trailing text.
    """
    if not text:
        return {}

    # Remove markdown code fences
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()

    # Find the outermost JSON object
    start = text.find("{")
    if start == -1:
        return {}

    depth = 0
    end = -1
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        if depth == 0:
            end = i + 1
            break

    if end == -1:
        return {}

    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return {}
