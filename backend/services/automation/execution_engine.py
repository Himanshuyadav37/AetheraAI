"""
Automation Execution Engine — Aethera Automation AI

Full pipeline orchestrator for the GitHub Issue → Bug Triage automation.

Pipeline
--------
1.  Validate event (type, action, label)
2.  Idempotency check
3.  Create execution record (RUNNING)
4.  Fetch issue details from GitHub API
5.  LLM analysis → structured output (summary, severity, reason)
6.  Validate structured output
7.  Create project task (GitHub issue comment / label)
8.  Send Slack notification
9.  Persist final execution log
10. Final status verification

Partial Failure Handling
------------------------
If task creation succeeds but Slack fails → STATUS = PARTIAL_FAILURE
No duplicate task is created on retry — idempotency key prevents re-execution.

Secret Safety
-------------
- Credentials come from settings ONLY
- No secrets in logs, error messages, or execution records
- LLM never receives credentials
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from config import settings
from db.automation_service import (
    add_execution_step,
    check_idempotency,
    create_execution,
    finalize_execution,
    get_execution,
    set_idempotency,
)
from services.automation.github_adapter import (
    create_issue_comment,
    fetch_issue,
    validate_issue_event,
)
from services.automation.llm_analyzer import analyze_issue
from services.automation.project_tracker_adapter import create_project_task
from services.automation.slack_adapter import send_bug_notification

logger = logging.getLogger("aethera.automation.engine")


# ─────────────────────────────────────────────────────────────────────────────
# Main Pipeline
# ─────────────────────────────────────────────────────────────────────────────

def run_github_bug_pipeline(
    automation_id: str,
    automation_config: Dict[str, Any],
    event_type: str,
    delivery_id: str,
    payload: Dict[str, Any],
    test_mode: bool = False,
) -> Dict[str, Any]:
    """
    Execute the full GitHub bug triage automation pipeline.

    Parameters
    ----------
    automation_id : str
        ID of the parent automation definition.
    automation_config : dict
        Automation configuration (repo, slack_channel, etc.). No raw secrets.
    event_type : str
        GitHub event type from X-GitHub-Event header.
    delivery_id : str
        GitHub delivery ID from X-GitHub-Delivery header.
    payload : dict
        Validated GitHub webhook payload.
    test_mode : bool
        If True, uses sandbox destinations; no production Slack/task creation.

    Returns
    -------
    dict
        {
            "execution_id": str,
            "status": "SUCCESS" | "PARTIAL_FAILURE" | "FAILED" | "SKIPPED",
            "steps": [...],
            "test_mode": bool,
        }
    """
    mode_label = "TEST" if test_mode else "PRODUCTION"
    logger.info(f"[Engine] Starting {mode_label} pipeline for automation {automation_id}, delivery {delivery_id}")

    # ─── Step 1: Validate Event ───────────────────────────────────────────
    should_process, skip_reason = validate_issue_event(event_type, payload)
    if not should_process:
        logger.info(f"[Engine] Event skipped: {skip_reason}")
        return {
            "execution_id": None,
            "status": "SKIPPED",
            "reason": skip_reason,
            "test_mode": test_mode,
        }

    issue = payload.get("issue", {})
    repo = payload.get("repository", {})
    repo_full_name = repo.get("full_name", "")
    issue_number = issue.get("number")
    repo_id = str(repo.get("id", ""))

    # ─── Step 2: Idempotency Check ────────────────────────────────────────
    idempotency_key = f"{repo_id}:{issue_number}"
    existing_execution_id = check_idempotency(idempotency_key)
    if existing_execution_id:
        logger.info(f"[Engine] Duplicate event. Returning previous execution {existing_execution_id}")
        existing = get_execution(existing_execution_id)
        return {
            "execution_id": existing_execution_id,
            "status": existing.get("status", "UNKNOWN") if existing else "UNKNOWN",
            "duplicate": True,
            "test_mode": test_mode,
        }

    # ─── Step 3: Create Execution Record ─────────────────────────────────
    trigger_summary = (
        f"GitHub issue #{issue_number} opened in {repo_full_name}: "
        f"{str(issue.get('title', ''))[:100]}"
    )
    execution = create_execution(
        automation_id=automation_id,
        trigger_id=idempotency_key,
        trigger_payload_summary=trigger_summary,
        test_mode=test_mode,
    )
    execution_id = execution["_id"]

    add_execution_step(execution_id, "validation", "SUCCESS", details={"event": "issues.opened", "bug_label": True})

    # Record idempotency key immediately to prevent parallel duplicate processing
    set_idempotency(idempotency_key, execution_id, automation_id)

    # Track step results for partial failure detection
    task_created = False
    task_result = None
    slack_sent = False
    slack_result = None
    llm_result = None

    # ─── Step 4: Fetch Issue Details ─────────────────────────────────────
    add_execution_step(execution_id, "github_event", "RUNNING")
    try:
        issue_data = fetch_issue(repo_full_name, issue_number)
        add_execution_step(
            execution_id, "github_event", "SUCCESS",
            details={
                "issue_number": issue_number,
                "issue_url": issue_data.get("html_url", ""),
                "title": issue_data.get("title", "")[:200],
                "labels": [lbl.get("name") for lbl in issue_data.get("labels", [])],
            }
        )
    except Exception as e:
        logger.error(f"[Engine] Failed to fetch issue: {e}")
        add_execution_step(execution_id, "github_event", "FAILED", error=str(e))
        finalize_execution(execution_id, "FAILED", f"GitHub API error: {str(e)[:200]}")
        return _build_result(execution_id, "FAILED", test_mode)

    # ─── Step 5 & 6: LLM Analysis + Structured Output Validation ─────────
    add_execution_step(execution_id, "llm_analysis", "RUNNING")
    try:
        labels_list = [lbl.get("name", "") for lbl in issue_data.get("labels", [])]
        llm_result, is_verified = analyze_issue(
            title=issue_data.get("title", ""),
            body=issue_data.get("body", ""),
            labels=labels_list,
        )
        if not is_verified:
            raise ValueError("LLM structured output failed validation.")

        add_execution_step(
            execution_id, "llm_analysis", "SUCCESS",
            details={
                "severity": llm_result["severity"],
                "summary_preview": llm_result["summary"][:100],
                "verified": True,
            }
        )
    except ValueError as ve:
        logger.error(f"[Engine] LLM output validation failed: {ve}")
        add_execution_step(execution_id, "llm_analysis", "FAILED", error=str(ve))
        finalize_execution(execution_id, "FAILED", f"LLM validation error: {str(ve)[:200]}")
        return _build_result(execution_id, "FAILED", test_mode)
    except RuntimeError as re_:
        logger.error(f"[Engine] LLM call failed: {re_}")
        add_execution_step(execution_id, "llm_analysis", "FAILED", error=str(re_))
        finalize_execution(execution_id, "FAILED", f"LLM error: {str(re_)[:200]}")
        return _build_result(execution_id, "FAILED", test_mode)

    # ─── Step 7: Create Project Task ──────────────────────────────────────
    add_execution_step(execution_id, "project_task", "RUNNING")
    try:
        task_result = create_project_task(
            title=f"[{llm_result['severity'].upper()}] {issue_data.get('title', 'GitHub bug')}",
            description=_build_triage_comment(llm_result, test_mode),
            severity=llm_result["severity"],
            test_mode=test_mode,
            team_id=automation_config.get("team_id", ""),
            project_id=automation_config.get("tracker_project_id", ""),
        )
        task_created = bool(task_result.get("id"))
        if not task_created:
            raise RuntimeError("Project tracker did not return a task ID")

        add_execution_step(
            execution_id, "project_task", "SUCCESS",
            details={
                "comment_id": task_result.get("id"),
                "comment_url": task_result.get("html_url", ""),
                "test_mode": test_mode,
            }
        )
        logger.info(f"[Engine] Project task created: comment_id={task_result.get('id')}")

    except Exception as e:
        logger.error(f"[Engine] Project task creation failed: {e}")
        add_execution_step(execution_id, "project_task", "FAILED", error=str(e))
        # Task creation failure is critical — mark whole execution FAILED
        finalize_execution(execution_id, "FAILED", f"Task creation error: {str(e)[:200]}")
        return _build_result(execution_id, "FAILED", test_mode)

    # ─── Step 8: Send Slack Notification ─────────────────────────────────
    add_execution_step(execution_id, "slack_notification", "RUNNING")
    slack_channel = (
        settings.AUTOMATION_TEST_SLACK_CHANNEL if test_mode
        else automation_config.get("slack_channel", settings.AUTOMATION_SLACK_DEFAULT_CHANNEL)
    )

    try:
        if not settings.AUTOMATION_SLACK_BOT_TOKEN or (test_mode and not settings.AUTOMATION_TEST_SLACK_CHANNEL):
            if test_mode:
                add_execution_step(
                    execution_id, "slack_notification", "SKIPPED",
                    details={"reason": "No test Slack destination configured; no production message sent"}
                )
            else:
                # Production: no Slack token = partial failure
                add_execution_step(
                    execution_id, "slack_notification", "FAILED",
                    error="AUTOMATION_SLACK_BOT_TOKEN not configured"
                )
                slack_sent = False
                raise RuntimeError("Slack token not configured — partial failure.")
        else:
            slack_result = send_bug_notification(
                issue_number=issue_number,
                issue_title=issue_data.get("title", ""),
                issue_url=issue_data.get("html_url", ""),
                repo_full_name=repo_full_name,
                summary=llm_result["summary"],
                severity=llm_result["severity"],
                reason=llm_result["reason"],
                channel=slack_channel,
                test_mode=test_mode,
            )
            slack_sent = bool(slack_result.get("ts"))
            if not slack_sent:
                raise RuntimeError("Slack message sent but no 'ts' timestamp returned.")

            add_execution_step(
                execution_id, "slack_notification", "SUCCESS",
                details={
                    "ts": slack_result.get("ts"),
                    "channel": slack_result.get("channel"),
                    "test_mode": test_mode,
                }
            )
            logger.info(f"[Engine] Slack notification delivered: ts={slack_result.get('ts')}")

    except RuntimeError as slack_err:
        # Partial failure: task was created but Slack failed
        if task_created:
            logger.warning(f"[Engine] PARTIAL FAILURE: task created but Slack failed: {slack_err}")
            add_execution_step(execution_id, "slack_notification", "FAILED", error=str(slack_err))
            finalize_execution(
                execution_id, "PARTIAL_FAILURE",
                f"Slack notification failed after task creation: {str(slack_err)[:200]}"
            )
            return _build_result(execution_id, "PARTIAL_FAILURE", test_mode)
        else:
            add_execution_step(execution_id, "slack_notification", "FAILED", error=str(slack_err))
            finalize_execution(execution_id, "FAILED", str(slack_err)[:200])
            return _build_result(execution_id, "FAILED", test_mode)

    # ─── Step 9 & 10: Persist Execution Log + Final Verification ─────────
    add_execution_step(execution_id, "execution_log", "RUNNING")

    # Verify final state — SUCCESS only when ALL required steps confirmed
    all_confirmed = task_created and slack_sent
    if all_confirmed:
        add_execution_step(execution_id, "execution_log", "SUCCESS",
                           details={"verified": True})
        finalize_execution(execution_id, "SUCCESS")
        logger.info(f"[Engine] Pipeline COMPLETE — execution {execution_id} SUCCESS")
        return _build_result(execution_id, "SUCCESS", test_mode)
    else:
        add_execution_step(execution_id, "execution_log", "FAILED",
                           error="Final verification: not all required steps confirmed.")
        finalize_execution(execution_id, "PARTIAL_FAILURE")
        return _build_result(execution_id, "PARTIAL_FAILURE", test_mode)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_triage_comment(llm_result: Dict[str, Any], test_mode: bool) -> str:
    """Build the GitHub issue comment body from LLM analysis."""
    mode_note = "\n\n> ⚠️ **[TEST MODE]** — This comment was generated by Aethera in test mode." if test_mode else ""
    severity = llm_result["severity"].upper()
    severity_emoji = {
        "CRITICAL": "🔴",
        "HIGH": "🟠",
        "MEDIUM": "🟡",
        "LOW": "🟢",
    }.get(severity, "⚪")

    return f"""## 🤖 Aethera AI Bug Triage

{severity_emoji} **Severity: {severity}**

**Summary**
{llm_result['summary']}

**Severity Reasoning**
{llm_result['reason']}

---
*Automatically triaged by [Aethera AI](https://aethera.ai) Automation Engine*{mode_note}"""


def _build_result(execution_id: str, status: str, test_mode: bool) -> Dict[str, Any]:
    """Build a standardized pipeline result dict."""
    execution = get_execution(execution_id)
    return {
        "execution_id": execution_id,
        "status": status,
        "steps": execution.get("steps", []) if execution else [],
        "test_mode": test_mode,
        "completed_at": datetime.utcnow().isoformat(),
    }
