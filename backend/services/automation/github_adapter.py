"""
GitHub Integration Adapter — Aethera Automation AI

Responsibilities
----------------
- Verify HMAC-SHA256 GitHub webhook signatures
- Fetch issue details via GitHub REST API
- Post issue comments
- All calls use configured credentials — NEVER user-supplied URLs
- Exponential backoff retry; no retry on permanent 4xx errors
- Strict SSRF protection via allowlist
"""

import hashlib
import hmac
import logging
import time
from typing import Any, Dict, Optional

import httpx

from config import settings
from core.ssrf_protection import validate_url

logger = logging.getLogger("aethera.automation.github")

# ── Constants ────────────────────────────────────────────────────────────────
GITHUB_API_BASE = "https://api.github.com"
_TIMEOUT = settings.AUTOMATION_HTTP_TIMEOUT          # seconds
_MAX_RETRIES = settings.AUTOMATION_MAX_RETRIES
_RETRY_STATUSES = {429, 500, 502, 503, 504}          # retry-able HTTP codes
_NO_RETRY_STATUSES = {400, 401, 403, 404, 422}       # permanent errors — stop immediately

# Validate base URL at import time (fail fast)
validate_url(GITHUB_API_BASE, require_https=True, use_allowlist=True)


# ─────────────────────────────────────────────────────────────────────────────
# Signature Verification
# ─────────────────────────────────────────────────────────────────────────────

def verify_webhook_signature(
    payload_bytes: bytes,
    signature_header: Optional[str],
    secret: str,
) -> bool:
    """
    Verify a GitHub webhook HMAC-SHA256 signature.

    Parameters
    ----------
    payload_bytes : bytes
        Raw request body exactly as received.
    signature_header : str | None
        Value of the `X-Hub-Signature-256` header (format: 'sha256=<hex>').
    secret : str
        The webhook secret configured in GitHub.

    Returns
    -------
    bool
        True if the signature is valid, False otherwise.

    Notes
    -----
    Uses `hmac.compare_digest` to prevent timing-based attacks.
    """
    if not signature_header or not secret:
        logger.warning("[GitHub] Missing signature header or webhook secret — rejecting.")
        return False

    if not signature_header.startswith("sha256="):
        logger.warning("[GitHub] Malformed X-Hub-Signature-256 header — rejecting.")
        return False

    expected_sig = signature_header[len("sha256="):]
    secret_bytes = secret.encode("utf-8")

    computed = hmac.new(secret_bytes, payload_bytes, hashlib.sha256).hexdigest()
    is_valid = hmac.compare_digest(computed, expected_sig)

    if not is_valid:
        logger.warning("[GitHub] Webhook signature mismatch — rejecting payload.")

    return is_valid


# ─────────────────────────────────────────────────────────────────────────────
# GitHub REST API helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_github_headers(token: str) -> Dict[str, str]:
    """Build GitHub API request headers. Token comes from config — NEVER from request."""
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Aethera-Automation/1.0",
    }


def _github_get(path: str, token: str) -> Dict[str, Any]:
    """
    Execute a GET request to the GitHub API with retry and backoff.

    Parameters
    ----------
    path : str
        API path relative to https://api.github.com (e.g., '/repos/owner/repo/issues/1').
    token : str
        GitHub personal access token from settings — NEVER from user input.

    Returns
    -------
    dict
        Parsed JSON response.

    Raises
    ------
    RuntimeError
        On permanent errors or after exhausting retries.
    """
    url = f"{GITHUB_API_BASE}{path}"
    # Defensive: validate even though base is hardcoded
    validate_url(url, require_https=True, use_allowlist=True)

    headers = _make_github_headers(token)
    last_error = None

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                resp = client.get(url, headers=headers)

            if resp.status_code == 200:
                return resp.json()

            if resp.status_code in _NO_RETRY_STATUSES:
                raise RuntimeError(
                    f"GitHub API permanent error {resp.status_code} for {path}: {resp.text[:200]}"
                )

            if resp.status_code in _RETRY_STATUSES:
                wait = 2 ** (attempt - 1)  # 1s, 2s, 4s
                logger.warning(
                    f"[GitHub] Attempt {attempt}/{_MAX_RETRIES} — status {resp.status_code}. "
                    f"Retrying in {wait}s."
                )
                last_error = RuntimeError(
                    f"GitHub API error {resp.status_code}: {resp.text[:200]}"
                )
                time.sleep(wait)
                continue

            raise RuntimeError(
                f"GitHub API unexpected status {resp.status_code} for {path}: {resp.text[:200]}"
            )

        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            wait = 2 ** (attempt - 1)
            logger.warning(
                f"[GitHub] Attempt {attempt}/{_MAX_RETRIES} — network error: {exc}. "
                f"Retrying in {wait}s."
            )
            last_error = RuntimeError(f"GitHub API network error: {exc}")
            time.sleep(wait)

    raise last_error or RuntimeError(f"GitHub API failed after {_MAX_RETRIES} retries for {path}")


def _github_post(path: str, body: Dict[str, Any], token: str) -> Dict[str, Any]:
    """
    Execute a POST request to the GitHub API with retry and backoff.
    """
    url = f"{GITHUB_API_BASE}{path}"
    validate_url(url, require_https=True, use_allowlist=True)

    headers = _make_github_headers(token)
    last_error = None

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                resp = client.post(url, json=body, headers=headers)

            if resp.status_code in {200, 201}:
                return resp.json()

            if resp.status_code in _NO_RETRY_STATUSES:
                raise RuntimeError(
                    f"GitHub API permanent error {resp.status_code} for POST {path}: {resp.text[:200]}"
                )

            if resp.status_code in _RETRY_STATUSES:
                wait = 2 ** (attempt - 1)
                logger.warning(
                    f"[GitHub] POST attempt {attempt}/{_MAX_RETRIES} — status {resp.status_code}. "
                    f"Retrying in {wait}s."
                )
                last_error = RuntimeError(f"GitHub API error {resp.status_code}: {resp.text[:200]}")
                time.sleep(wait)
                continue

            raise RuntimeError(
                f"GitHub API unexpected status {resp.status_code} for POST {path}: {resp.text[:200]}"
            )

        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            wait = 2 ** (attempt - 1)
            logger.warning(f"[GitHub] POST attempt {attempt}/{_MAX_RETRIES} — {exc}. Retrying in {wait}s.")
            last_error = RuntimeError(f"GitHub API network error: {exc}")
            time.sleep(wait)

    raise last_error or RuntimeError(f"GitHub POST API failed after {_MAX_RETRIES} retries for {path}")


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def fetch_issue(repo_full_name: str, issue_number: int) -> Dict[str, Any]:
    """
    Fetch a GitHub issue by repository and number.

    Parameters
    ----------
    repo_full_name : str
        Repository in 'owner/repo' format.
    issue_number : int
        Issue number.

    Returns
    -------
    dict
        GitHub issue object with fields: number, title, body, labels,
        html_url, user, state, created_at.

    Raises
    ------
    RuntimeError
        On API failure after retries.
    ValueError
        On invalid repo format or issue number.
    """
    if not repo_full_name or "/" not in repo_full_name:
        raise ValueError(f"Invalid repo_full_name: '{repo_full_name}'. Expected 'owner/repo'.")
    if not isinstance(issue_number, int) or issue_number < 1:
        raise ValueError(f"Invalid issue_number: {issue_number}. Must be a positive integer.")

    token = settings.GITHUB_TOKEN
    if not token:
        raise RuntimeError("GITHUB_TOKEN is not configured. Cannot fetch issue from GitHub API.")

    path = f"/repos/{repo_full_name}/issues/{issue_number}"
    logger.info(f"[GitHub] Fetching issue #{issue_number} from {repo_full_name}")
    return _github_get(path, token)


def create_issue_comment(repo_full_name: str, issue_number: int, body: str) -> Dict[str, Any]:
    """
    Post a comment on a GitHub issue.

    Parameters
    ----------
    repo_full_name : str
        Repository in 'owner/repo' format.
    issue_number : int
        Issue number to comment on.
    body : str
        Comment markdown body.

    Returns
    -------
    dict
        GitHub comment object with 'id' and 'html_url'.
        SUCCESS is confirmed only when a valid 'id' is present in the response.

    Raises
    ------
    RuntimeError
        On API failure or if the response does not contain a valid comment ID.
    """
    if not repo_full_name or "/" not in repo_full_name:
        raise ValueError(f"Invalid repo_full_name: '{repo_full_name}'.")
    if not body or not body.strip():
        raise ValueError("Comment body cannot be empty.")

    token = settings.GITHUB_TOKEN
    if not token:
        raise RuntimeError("GITHUB_TOKEN is not configured. Cannot post GitHub comment.")

    path = f"/repos/{repo_full_name}/issues/{issue_number}/comments"
    logger.info(f"[GitHub] Posting comment to issue #{issue_number} in {repo_full_name}")
    result = _github_post(path, {"body": body}, token)

    # Verify success — a real comment always has an integer 'id'
    if not result.get("id"):
        raise RuntimeError(
            f"GitHub comment creation failed: response missing 'id'. Response: {str(result)[:200]}"
        )

    logger.info(f"[GitHub] Comment created: id={result['id']} url={result.get('html_url', '')}")
    return result


def validate_issue_event(
    event_type: str,
    payload: Dict[str, Any],
) -> tuple[bool, str]:
    """
    Validate a GitHub webhook payload for the automation trigger rules:
    - Event must be 'issues'
    - Action must be 'opened'
    - Issue must have at least one label named 'bug'

    Returns
    -------
    (bool, str)
        (True, '') if the event should be processed.
        (False, reason) if the event should be ignored.
    """
    if event_type != "issues":
        return False, f"Event type '{event_type}' is not 'issues' — skipping."

    if not isinstance(payload, dict):
        return False, "Payload must be a JSON object."

    action = payload.get("action")
    if action != "opened":
        return False, f"Issue action '{action}' is not 'opened' — skipping."

    issue = payload.get("issue", {})
    repository = payload.get("repository", {})
    if not isinstance(issue, dict) or not isinstance(repository, dict):
        return False, "Payload missing 'issue' object."

    required_issue = issue.get("number")
    if not isinstance(required_issue, int) or required_issue < 1:
        return False, "Payload issue.number must be a positive integer."
    if not isinstance(repository.get("id"), int) or not repository.get("full_name"):
        return False, "Payload repository.id and repository.full_name are required."

    labels_raw = issue.get("labels", [])
    if not isinstance(labels_raw, list) or any(not isinstance(label, dict) for label in labels_raw):
        return False, "Payload issue.labels must be a list of objects."

    labels = [str(lbl.get("name", "")).lower() for lbl in labels_raw]
    if "bug" not in labels:
        return False, f"Issue #{issue.get('number')} has no 'bug' label (labels: {labels}) — skipping."

    return True, ""
