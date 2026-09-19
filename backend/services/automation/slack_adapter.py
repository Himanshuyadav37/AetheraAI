"""
Slack Integration Adapter — Aethera Automation AI

Responsibilities
----------------
- Send messages via the Slack Web API (chat.postMessage)
- Verify `ok: true` in Slack response — NEVER infer success from HTTP 200 alone
- Exponential backoff retry on Slack 5xx errors
- No retry on auth errors (invalid_auth, token_revoked, etc.)
- Credentials from settings ONLY — never from user input or LLM output
- Strict SSRF validation on all URLs
"""

import logging
import time
from typing import Any, Dict, List, Optional

import httpx

from config import settings
from core.ssrf_protection import validate_url

logger = logging.getLogger("aethera.automation.slack")

# ── Constants ─────────────────────────────────────────────────────────────────
SLACK_API_BASE = "https://slack.com/api"
_TIMEOUT = settings.AUTOMATION_HTTP_TIMEOUT
_MAX_RETRIES = settings.AUTOMATION_MAX_RETRIES

# Slack error codes that mean permanent auth failure — do NOT retry
_PERMANENT_SLACK_ERRORS = {
    "invalid_auth",
    "account_inactive",
    "token_revoked",
    "token_expired",
    "not_authed",
    "no_permission",
    "missing_scope",
    "channel_not_found",
    "not_in_channel",
    "is_archived",
}

# Validate base URL at import time
validate_url(SLACK_API_BASE, require_https=True, use_allowlist=True)


# ─────────────────────────────────────────────────────────────────────────────
# Severity → colour mapping for Slack attachments
# ─────────────────────────────────────────────────────────────────────────────

_SEVERITY_COLOURS = {
    "critical": "#FF0000",
    "high": "#FF6600",
    "medium": "#FFB800",
    "low": "#36A64F",
}


def _make_headers(token: str) -> Dict[str, str]:
    """Build Slack API request headers. Token from settings — NEVER from user input."""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "Aethera-Automation/1.0",
    }


def _call_slack_api(method: str, payload: Dict[str, Any], token: str) -> Dict[str, Any]:
    """
    Call a Slack Web API method with retry and backoff.

    Parameters
    ----------
    method : str
        Slack API method name (e.g., 'chat.postMessage').
    payload : dict
        JSON payload for the API call.
    token : str
        Slack Bot OAuth token from settings.

    Returns
    -------
    dict
        Slack API response (guaranteed to have `ok: true`).

    Raises
    ------
    RuntimeError
        On permanent Slack error or after exhausting retries.
    """
    url = f"{SLACK_API_BASE}/{method}"
    validate_url(url, require_https=True, use_allowlist=True)

    headers = _make_headers(token)
    last_error = None

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                resp = client.post(url, json=payload, headers=headers)

            # Slack always returns HTTP 200 even on errors — check response body
            if resp.status_code != 200:
                wait = 2 ** (attempt - 1)
                logger.warning(
                    f"[Slack] {method} HTTP {resp.status_code} on attempt {attempt}/{_MAX_RETRIES}. "
                    f"Retrying in {wait}s."
                )
                last_error = RuntimeError(f"Slack API HTTP {resp.status_code}: {resp.text[:200]}")
                time.sleep(wait)
                continue

            data = resp.json()
            ok = data.get("ok", False)

            if ok:
                return data

            # Handle Slack application-layer errors
            error_code = data.get("error", "unknown_error")

            if error_code in _PERMANENT_SLACK_ERRORS:
                raise RuntimeError(
                    f"Slack permanent error '{error_code}' for {method} — not retrying. "
                    f"Check AUTOMATION_SLACK_BOT_TOKEN and channel permissions."
                )

            # Retry-able Slack errors (ratelimited, fatal_error, etc.)
            wait = 2 ** (attempt - 1)
            logger.warning(
                f"[Slack] {method} error '{error_code}' on attempt {attempt}/{_MAX_RETRIES}. "
                f"Retrying in {wait}s."
            )
            last_error = RuntimeError(f"Slack error '{error_code}': {data.get('error', '')}")
            time.sleep(wait)

        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            wait = 2 ** (attempt - 1)
            logger.warning(
                f"[Slack] {method} network error on attempt {attempt}/{_MAX_RETRIES}: {exc}. "
                f"Retrying in {wait}s."
            )
            last_error = RuntimeError(f"Slack network error: {exc}")
            time.sleep(wait)

    raise last_error or RuntimeError(f"Slack {method} failed after {_MAX_RETRIES} attempts.")


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def send_bug_notification(
    issue_number: int,
    issue_title: str,
    issue_url: str,
    repo_full_name: str,
    summary: str,
    severity: str,
    reason: str,
    channel: Optional[str] = None,
    test_mode: bool = False,
) -> Dict[str, Any]:
    """
    Send a GitHub bug issue notification to Slack.

    Parameters
    ----------
    issue_number : int
        GitHub issue number.
    issue_title : str
        GitHub issue title.
    issue_url : str
        GitHub issue HTML URL.
    repo_full_name : str
        Repository 'owner/repo'.
    summary : str
        LLM-generated issue summary.
    severity : str
        LLM severity classification: low | medium | high | critical.
    reason : str
        LLM reason for severity.
    channel : str | None
        Slack channel to post to. Defaults to AUTOMATION_SLACK_DEFAULT_CHANNEL.
    test_mode : bool
        If True, prefixes message with [TEST MODE] to prevent accidental prod alerts.

    Returns
    -------
    dict
        Slack response with 'ts' (message timestamp, proves delivery) and 'channel'.

    Raises
    ------
    RuntimeError
        If Slack token is not configured, or API call fails.
    """
    token = settings.AUTOMATION_SLACK_BOT_TOKEN
    if not token:
        raise RuntimeError(
            "AUTOMATION_SLACK_BOT_TOKEN is not configured. "
            "Cannot send Slack notification."
        )

    target_channel = channel or settings.AUTOMATION_SLACK_DEFAULT_CHANNEL
    if not target_channel:
        raise RuntimeError("No Slack channel configured. Set AUTOMATION_SLACK_DEFAULT_CHANNEL.")

    severity_lower = severity.lower() if severity else "unknown"
    colour = _SEVERITY_COLOURS.get(severity_lower, "#808080")
    mode_prefix = "🧪 [TEST MODE] " if test_mode else ""

    blocks: List[Dict[str, Any]] = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{mode_prefix}🐛 New Bug Report — {severity_lower.upper()} Severity",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Repository:*\n`{repo_full_name}`"},
                {"type": "mrkdwn", "text": f"*Issue:*\n<{issue_url}|#{issue_number}: {issue_title}>"},
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*AI Summary:*\n{summary}",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Severity Reasoning:*\n{reason}",
            },
        },
        {"type": "divider"},
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Automated by Aethera AI | {'⚠️ TEST MODE — No production action taken' if test_mode else '✅ Production Alert'}",
                }
            ],
        },
    ]

    attachments: List[Dict[str, Any]] = [
        {
            "color": colour,
            "fallback": f"{mode_prefix}Bug #{issue_number}: {issue_title} [{severity_lower.upper()}]",
        }
    ]

    payload = {
        "channel": target_channel,
        "text": f"{mode_prefix}🐛 Bug #{issue_number} detected in {repo_full_name}: {issue_title}",
        "blocks": blocks,
        "attachments": attachments,
        "unfurl_links": False,
        "unfurl_media": False,
    }

    logger.info(
        f"[Slack] Sending {'TEST' if test_mode else 'PRODUCTION'} bug notification "
        f"for issue #{issue_number} to channel '{target_channel}'"
    )

    result = _call_slack_api("chat.postMessage", payload, token)

    # Verify success — Slack confirms delivery with a message timestamp
    ts = result.get("ts")
    if not ts:
        raise RuntimeError(
            f"Slack message sent but response missing 'ts' (message timestamp). "
            f"Cannot confirm delivery. Response: {str(result)[:200]}"
        )

    logger.info(
        f"[Slack] Message delivered to channel '{result.get('channel')}' "
        f"with timestamp ts={ts}"
    )

    return {
        "ok": True,
        "ts": ts,
        "channel": result.get("channel", target_channel),
        "message_url": f"https://slack.com/archives/{result.get('channel', '')}/p{ts.replace('.', '')}",
        "test_mode": test_mode,
    }
