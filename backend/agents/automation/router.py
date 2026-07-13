"""
NexusAI AI - Automation Agent

Main orchestrator for the Automation AI pipeline.

Flow
----
User Prompt
      │
      ▼
  Planner        ← detect trigger, apps, actions, credentials, platform
      │
      ▼
  Workflow       ← generate n8n JSON, Mermaid, ASCII, steps, nodes
  Generator
      │
      ▼
  Validator      ← check missing triggers, broken nodes, circular refs
      │
      ▼
  Formatter      ← assemble final response dict
      │
      ▼
  API Response
"""

from agents.automation.planner import plan_automation
from agents.automation.workflow_generator import generate_workflow
from agents.automation.validator import validate_workflow
from agents.automation.formatter import format_response


def automation_agent(
    prompt: str,
    platform_override: str | None = None,
) -> dict:
    """
    Main entry point for the NexusAI Automation AI.

    Parameters
    ----------
    prompt : str
        Natural language automation description from the user.
    platform_override : str | None
        Optional platform name from the API request.

    Returns
    -------
    dict
        Complete automation response including workflow JSON, diagrams,
        steps, credentials, deployment, testing, and error handling.
    """

    try:

        if not prompt or not str(prompt).strip():
            raise ValueError("Prompt cannot be empty.")

        prompt = str(prompt).strip()

        # ──────────────────────────────────────
        # Stage 1: Plan
        # ──────────────────────────────────────
        print(f"[Automation Agent] Stage 1: Planning... Platform override: {platform_override}")
        plan = plan_automation(
            prompt=prompt,
            platform_override=platform_override,
        )
        print(f"[Automation Agent] Plan complete. Platform: {plan.get('platform')} | Apps: {plan.get('apps')}")

        # ──────────────────────────────────────
        # Stage 2: Generate Workflow
        # ──────────────────────────────────────
        print("[Automation Agent] Stage 2: Generating workflow...")
        workflow = generate_workflow(plan)
        print(f"[Automation Agent] Workflow generated. Nodes: {len(workflow.get('nodes', []))}")

        # ──────────────────────────────────────
        # Stage 3: Validate
        # ──────────────────────────────────────
        print("[Automation Agent] Stage 3: Validating...")
        validation = validate_workflow(workflow, plan)
        print(f"[Automation Agent] Validation: valid={validation['valid']} errors={len(validation['errors'])} warnings={len(validation['warnings'])}")

        # ──────────────────────────────────────
        # Stage 4: Format & Return
        # ──────────────────────────────────────
        print("[Automation Agent] Stage 4: Formatting response...")
        result = format_response(
            plan=plan,
            workflow=workflow,
            validation=validation,
        )
        print("[Automation Agent] Done.")
        return result

    except Exception as e:

        print(f"[Automation Agent Error] {e}")

        return {
            "success": False,
            "agent": "automation",
            "title": "❌ Automation AI Error",
            "description": f"An unexpected error occurred: {str(e)}",
            "platform": "n8n",
            "platform_alternatives": [],
            "workflow_json": None,
            "workflow_mermaid": "",
            "workflow_ascii": "",
            "nodes": [],
            "steps": [],
            "credentials": [],
            "deployment": "",
            "testing": "",
            "error_handling": "",
            "security_notes": "",
            "validation_errors": [str(e)],
            "validation_warnings": [],
            "validation_passed": False,
            "complexity": "unknown",
            "apps": [],
            "timestamp": None,
        }
