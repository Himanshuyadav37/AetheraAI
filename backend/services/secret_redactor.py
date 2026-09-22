import re
import uuid
from typing import Any, Dict, List, Optional, Tuple


SECRET_PATTERNS = [
    (
        "openai_api_key",
        re.compile(r"sk-[A-Za-z0-9]{20,}"),
    ),
    (
        "groq_api_key",
        re.compile(r"gsk_[A-Za-z0-9]{20,}"),
    ),
    (
        "bearer_token",
        re.compile(r"Bearer [A-Za-z0-9._\-]{20,}"),
    ),
    (
        "aws_access_key",
        re.compile(r"AKIA[0-9A-Z]{16}"),
    ),
    (
        "aws_secret_key",
        re.compile(r"(?i)(?:aws_secret_access_key|aws_secret)\s*[:=]\s*['\"]([A-Za-z0-9/+=]{40})['\"]"),
    ),
    (
        "github_token",
        re.compile(r"gh[pors]_[A-Za-z0-9]{20,}"),
    ),
    (
        "private_key",
        re.compile(
            r"-----BEGIN [A-Z ]+PRIVATE KEY-----"
            r"[\s\S]*?"
            r"-----END [A-Z ]+PRIVATE KEY-----"
        ),
    ),
    (
        "password_assignment",
        re.compile(r"password\s*[:=]\s*[\"']([^\"']{4,})[\"']", re.IGNORECASE),
    ),
    (
        "jwt_token",
        re.compile(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+"),
    ),
    (
        "long_base64_token",
        re.compile(r"(?<![A-Za-z0-9+/=])[A-Za-z0-9+/=]{32,}(?![A-Za-z0-9+/=])"),
    ),
]


def _get_match_text(match: re.Match, pattern_name: str) -> str:
    if pattern_name in ("aws_secret_key", "password_assignment"):
        if match.lastindex:
            return match.group(match.lastindex)
    return match.group(0)


def _severity_for(pattern_name: str) -> str:
    if pattern_name in ("openai_api_key", "groq_api_key", "github_token", "private_key", "aws_access_key", "aws_secret_key"):
        return "CRITICAL"
    if pattern_name in ("password_assignment", "jwt_token", "bearer_token"):
        return "HIGH"
    return "MEDIUM"


def scan_string_for_secrets(
    text: str,
    file: Optional[str] = None,
    line: Optional[int] = None,
) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []

    if not isinstance(text, str) or not text:
        return findings

    for pattern_name, pattern in SECRET_PATTERNS:
        for match in pattern.finditer(text):
            raw_match = _get_match_text(match, pattern_name)

            if pattern_name == "long_base64_token":
                stripped = raw_match.strip()
                if len(stripped) < 32:
                    continue
                if stripped.lower() in ("true", "false", "null", "none"):
                    continue
                if re.fullmatch(r"[0-9a-f]{32,}", stripped) and not re.search(r"[A-Z]", stripped):
                    continue
                if re.fullmatch(r"[0-9]{32,}", stripped):
                    continue

            findings.append({
                "finding_id": f"secret-{uuid.uuid4().hex[:12]}",
                "category": "SECRET",
                "severity": _severity_for(pattern_name),
                "rule_name": pattern_name,
                "match": raw_match,
                "file": file,
                "line": line,
            })

    return findings


def scan_list_for_secrets(
    items: List[Dict[str, Any]],
    paths_key: str = "path",
    code_key: str = "code",
) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []

    if not isinstance(items, list):
        return findings

    for item in items:
        if not isinstance(item, dict):
            continue

        path = item.get(paths_key)
        code = item.get(code_key)

        if not isinstance(code, str):
            continue

        for idx, code_line in enumerate(code.splitlines(), start=1):
            line_findings = scan_string_for_secrets(
                code_line,
                file=path,
                line=idx,
            )
            findings.extend(line_findings)

        if not any(f.get("file") == path for f in findings if f.get("line")):
            block_findings = scan_string_for_secrets(
                code,
                file=path,
                line=None,
            )
            for bf in block_findings:
                if bf["rule_name"] == "private_key":
                    findings.append(bf)

    return findings


def _short_preview(raw_match: str) -> str:
    if not raw_match:
        return ""
    total_len = len(raw_match)
    if total_len <= 8:
        return raw_match[:2] + "..." + raw_match[-2:] if total_len > 4 else raw_match
    first = raw_match[:4]
    last = raw_match[-4:]
    return f"{first}...{last}"


def redact_in_place(obj: Any) -> Tuple[Any, Dict[str, Any]]:
    counter = [0]
    redaction_log: Dict[str, Dict[str, Any]] = {}

    def _assign_id(match_text: str, rule_name: str) -> str:
        counter[0] += 1
        redact_id = f"REDACTED_SECRET_{counter[0]}_{rule_name}"
        redaction_log[redact_id] = {
            "rule_name": rule_name,
            "short_preview": _short_preview(match_text),
        }
        return f"***{redact_id}***"

    def _redact_string(s: str) -> str:
        result = s
        for pattern_name, pattern in SECRET_PATTERNS:
            def _replace(m: re.Match) -> str:
                full = m.group(0)
                value = _get_match_text(m, pattern_name)
                placeholder = _assign_id(value, pattern_name)
                if pattern_name in ("aws_secret_key", "password_assignment") and m.lastindex:
                    start = m.start(m.lastindex) - m.start(0)
                    end = m.end(m.lastindex) - m.start(0)
                    return full[:start] + placeholder + full[end:]
                return placeholder

            result = pattern.sub(_replace, result)

        return result

    def _walk(node: Any) -> Any:
        if isinstance(node, str):
            return _redact_string(node)
        if isinstance(node, list):
            return [_walk(item) for item in node]
        if isinstance(node, dict):
            return {
                k: _walk(v)
                for k, v in node.items()
            }
        return node

    redacted_obj = _walk(obj)
    return redacted_obj, redaction_log
