"""
NexusAI AI - Automation Workflow Validator

Stage 3 of the Automation AI pipeline.

Validates the generated workflow before returning it to the user.

Checks
------
- Missing trigger
- Missing actions
- Circular references in node connections
- Missing credentials
- Broken node references
- Invalid connections
- Empty workflow body
"""

from typing import Any


def validate_workflow(workflow_data: dict, plan: dict) -> dict:
    """
    Validate the generated workflow.

    Parameters
    ----------
    workflow_data : dict
        The output from the workflow generator.
    plan : dict
        The original plan from the planner.

    Returns
    -------
    dict
        {
            "valid": bool,
            "errors": list[str],
            "warnings": list[str]
        }
    """

    errors = []
    warnings = []

    # ──────────────────────────────────────────
    # Check: workflow_json exists
    # ──────────────────────────────────────────
    workflow_json = workflow_data.get("workflow_json")
    if not workflow_json:
        errors.append("workflow_json is missing — no importable workflow was generated.")
    elif not isinstance(workflow_json, dict):
        errors.append("workflow_json is not a valid JSON object.")

    # ──────────────────────────────────────────
    # Check: n8n-specific structure
    # ──────────────────────────────────────────
    if workflow_json and isinstance(workflow_json, dict):
        nodes = workflow_json.get("nodes", [])
        connections = workflow_json.get("connections", {})

        # Must have at least one node
        if not nodes:
            errors.append("Workflow has no nodes — at least one trigger node is required.")

        # Must have at least one trigger node
        trigger_nodes = [
            n for n in nodes
            if _is_trigger_node(n)
        ]
        if not trigger_nodes:
            errors.append("No trigger node found — workflow will never execute automatically.")

        # Must have at least one action beyond the trigger
        action_nodes = [
            n for n in nodes
            if not _is_trigger_node(n)
        ]
        if nodes and not action_nodes:
            warnings.append("Workflow has only a trigger node with no action nodes — it will receive but not process data.")

        # Check connections reference real nodes
        node_names = {n.get("name") for n in nodes}
        for source_name, conn_data in connections.items():
            if source_name not in node_names:
                errors.append(f"Connection references unknown source node: '{source_name}'")
            if isinstance(conn_data, dict):
                for output_type, output_groups in conn_data.items():
                    if isinstance(output_groups, list):
                        for group in output_groups:
                            if isinstance(group, list):
                                for target in group:
                                    if isinstance(target, dict):
                                        target_name = target.get("node")
                                        if target_name and target_name not in node_names:
                                            errors.append(
                                                f"Connection from '{source_name}' references unknown target node: '{target_name}'"
                                            )

        # Check for circular references (simple DFS)
        if _has_circular_reference(nodes, connections):
            errors.append("Circular reference detected in node connections — workflow will loop infinitely.")

    # ──────────────────────────────────────────
    # Check: Mermaid diagram
    # ──────────────────────────────────────────
    mermaid = workflow_data.get("workflow_mermaid", "")
    if not mermaid:
        warnings.append("Mermaid diagram is missing — visual flow preview will not be available.")

    # ──────────────────────────────────────────
    # Check: Steps
    # ──────────────────────────────────────────
    steps = workflow_data.get("steps", [])
    if not steps:
        warnings.append("Execution steps are missing — step-by-step explanation will not be available.")

    # ──────────────────────────────────────────
    # Check: Credentials
    # ──────────────────────────────────────────
    plan_credentials = plan.get("credentials", [])
    workflow_credentials = workflow_data.get("credentials", [])
    if plan_credentials and not workflow_credentials:
        warnings.append(
            f"Plan requires {len(plan_credentials)} credential(s) but none are documented in the output."
        )

    # ──────────────────────────────────────────
    # Check: Deployment guide
    # ──────────────────────────────────────────
    if not workflow_data.get("deployment"):
        warnings.append("Deployment guide is missing.")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


def _is_trigger_node(node: dict) -> bool:
    """Determine if a node is a trigger node."""
    node_type = node.get("type", "").lower()
    node_name = node.get("name", "").lower()

    trigger_type_patterns = [
        "webhook", "trigger", "schedule", "cron",
        "emailtrigger", "rss", "mqtt", "amqp",
        "githubTrigger", "slackTrigger",
    ]
    for pattern in trigger_type_patterns:
        if pattern.lower() in node_type or pattern.lower() in node_name:
            return True
    return False


def _has_circular_reference(nodes: list, connections: dict) -> bool:
    """
    Detect circular references using depth-first search.
    Returns True if a cycle is found.
    """
    # Build adjacency map: node_name → set of target node names
    graph: dict[str, set] = {n.get("name"): set() for n in nodes}

    for source, conn_data in connections.items():
        if not isinstance(conn_data, dict):
            continue
        for output_type, output_groups in conn_data.items():
            if not isinstance(output_groups, list):
                continue
            for group in output_groups:
                if not isinstance(group, list):
                    continue
                for target in group:
                    if isinstance(target, dict):
                        target_name = target.get("node")
                        if target_name and source in graph:
                            graph[source].add(target_name)

    # DFS cycle detection
    visited = set()
    rec_stack = set()

    def dfs(node: str) -> bool:
        visited.add(node)
        rec_stack.add(node)
        for neighbor in graph.get(node, set()):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True
        rec_stack.discard(node)
        return False

    for node_name in graph:
        if node_name not in visited:
            if dfs(node_name):
                return True
    return False
