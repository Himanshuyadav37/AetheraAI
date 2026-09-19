"""
LLM Analyzer — Aethera Automation AI

Responsibilities
----------------
- Call the configured LLM (Groq) to analyze a GitHub issue
- Produce a strictly validated structured output:
    {
        "summary": "str",
        "severity": "low | medium | high | critical",
        "reason": "str"
    }
- Reject malformed or incomplete LLM responses
- NEVER send credentials, tokens, or secrets in the prompt
- NEVER send raw issue body without sanitization limits
- Timeout: 30s
"""

import json
import logging
import re
import time
from typing import Any, Dict, Tuple

from config import settings

logger = logging.getLogger("aethera.automation.llm_analyzer")

# ── Schema ────────────────────────────────────────────────────────────────────
VALID_SEVERITIES = {"low", "medium", "high", "critical"}
MAX_ISSUE_BODY_CHARS = 3000      # Limit to prevent token abuse
MAX_ISSUE_TITLE_CHARS = 500

_LLM_SYSTEM_PROMPT = """You are a bug severity analysis assistant for a software engineering team.

Your task: analyze a GitHub bug report and produce a structured JSON assessment.

OUTPUT RULES (STRICT):
- Return ONLY raw JSON — no markdown, no code fences, no explanations
- JSON must match exactly:
  {"summary": "<string>", "severity": "<low|medium|high|critical>", "reason": "<string>"}
- "summary": A concise 1-3 sentence technical summary of the bug's impact
- "severity": MUST be exactly one of: low, medium, high, critical
  - critical: data loss, security breach, system down, auth broken
  - high: major feature broken, affects many users
  - medium: partial feature broken, workaround exists
  - low: cosmetic, minor inconvenience
- "reason": 1-2 sentences explaining your severity choice
- NEVER include API keys, tokens, passwords, URLs, or PII in your response
- If the issue is unclear, default severity to "medium"
"""


def _build_analysis_prompt(title: str, body: str, labels: list) -> str:
    """
    Build the LLM prompt. Sanitizes inputs — no credentials leak into the prompt.

    Notes
    -----
    - Title and body are truncated to prevent token abuse
    - Only issue content fields are included — no system credentials
    - Labels are normalized to strings
    """
    safe_title = str(title or "").strip()[:MAX_ISSUE_TITLE_CHARS]
    safe_body = str(body or "").strip()[:MAX_ISSUE_BODY_CHARS]
    safe_labels = [str(lbl).strip()[:50] for lbl in (labels or []) if lbl]

    # Replace any accidental secret-like patterns (paranoid sanitization)
    # These should never appear in issue bodies, but belt-and-suspenders
    def _redact_secrets(text: str) -> str:
        # Redact anything that looks like an API key pattern
        text = re.sub(r'(?i)(api[_-]?key|token|secret|password|passwd|pwd)\s*[:=]\s*\S+', '[REDACTED]', text)
        return text

    safe_title = _redact_secrets(safe_title)
    safe_body = _redact_secrets(safe_body)

    return f"""Analyze this GitHub bug report:

Title: {safe_title}
Labels: {', '.join(safe_labels) if safe_labels else 'bug'}
Body:
{safe_body}

Return ONLY the JSON object with summary, severity, and reason."""


def _call_llm(prompt: str) -> str:
    """Call the configured OpenAI-compatible provider with bounded retries."""
    import httpx

    if not settings.AUTOMATION_EFFECTIVE_LLM_API_KEY:
        raise RuntimeError("AUTOMATION_LLM_API_KEY is not configured")

    url = f"{settings.AUTOMATION_EFFECTIVE_LLM_BASE_URL.rstrip('/')}/chat/completions"
    from core.ssrf_protection import validate_url
    validate_url(url, require_https=True, use_allowlist=True)
    payload = {
        "model": settings.AUTOMATION_EFFECTIVE_LLM_MODEL,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": _LLM_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }
    last_error = None
    for attempt in range(1, settings.AUTOMATION_MAX_RETRIES + 1):
        try:
            response = httpx.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.AUTOMATION_EFFECTIVE_LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=settings.AUTOMATION_HTTP_TIMEOUT,
            )
            if response.status_code in {400, 401, 403, 404, 422}:
                raise RuntimeError(f"LLM provider rejected request ({response.status_code})")
            if response.status_code >= 500 or response.status_code == 429:
                last_error = RuntimeError(f"LLM provider temporary error ({response.status_code})")
                if attempt < settings.AUTOMATION_MAX_RETRIES:
                    time.sleep(2 ** (attempt - 1))
                    continue
                raise last_error
            response.raise_for_status()
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            if not isinstance(content, str) or not content.strip():
                raise RuntimeError("LLM provider returned no message content")
            return content
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            last_error = RuntimeError("LLM provider network failure")
            if attempt < settings.AUTOMATION_MAX_RETRIES:
                time.sleep(2 ** (attempt - 1))
                continue
            raise last_error from exc
    raise last_error or RuntimeError("LLM provider request failed")



def _extract_and_validate_json(raw: str) -> Dict[str, Any]:
    """
    Extract and strictly validate the structured JSON from LLM output.

    Raises
    ------
    ValueError
        If the response does not contain valid structured output.
    """
    if not raw or not raw.strip():
        raise ValueError("LLM returned empty response.")

    # Strip markdown fences if present
    text = re.sub(r"```(?:json)?\s*", "", raw)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()

    # Find the first JSON object
    start = text.find("{")
    if start == -1:
        raise ValueError(f"LLM response contains no JSON object. Raw: {raw[:200]!r}")

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
        raise ValueError(f"LLM response has unclosed JSON object. Raw: {raw[:200]!r}")

    try:
        data = json.loads(text[start:end])
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM response JSON parse error: {e}. Raw: {text[start:end][:200]!r}")

    # Validate required fields
    errors = []

    summary = data.get("summary")
    if not summary or not isinstance(summary, str) or not summary.strip():
        errors.append("'summary' must be a non-empty string")

    severity = data.get("severity")
    if not severity or not isinstance(severity, str):
        errors.append("'severity' must be a string")
    elif severity.strip().lower() not in VALID_SEVERITIES:
        errors.append(
            f"'severity' must be one of {sorted(VALID_SEVERITIES)}, got '{severity}'"
        )

    reason = data.get("reason")
    if not reason or not isinstance(reason, str) or not reason.strip():
        errors.append("'reason' must be a non-empty string")

    if errors:
        raise ValueError(
            f"LLM structured output validation failed: {'; '.join(errors)}. "
            f"Raw response: {raw[:300]!r}"
        )

    return {
        "summary": summary.strip(),
        "severity": severity.strip().lower(),
        "reason": reason.strip(),
    }


def analyze_issue(
    title: str,
    body: str,
    labels: list = None,
) -> Tuple[Dict[str, Any], bool]:
    """
    Analyze a GitHub issue using the configured LLM.

    Parameters
    ----------
    title : str
        GitHub issue title.
    body : str
        GitHub issue body (markdown).
    labels : list
        List of label name strings.

    Returns
    -------
    (dict, bool)
        (result_dict, is_verified) where result_dict has:
            "summary": str
            "severity": str  (low|medium|high|critical)
            "reason": str
        is_verified is True only when structured output validation passes.

    Raises
    ------
    RuntimeError
        If no Groq key is configured.
    ValueError
        If LLM returns malformed/invalid structured output.
    """
    prompt = _build_analysis_prompt(title, body, labels or [])

    logger.info(f"[LLM] Analyzing issue: '{title[:80]}' (labels: {labels})")

    raw_response = _call_llm(prompt)

    logger.debug(f"[LLM] Raw response (first 300 chars): {raw_response[:300]!r}")

    result = _extract_and_validate_json(raw_response)

    logger.info(
        f"[LLM] Analysis complete — severity={result['severity']}, "
        f"summary={result['summary'][:60]!r}"
    )

    return result, True  # is_verified=True means validation passed
