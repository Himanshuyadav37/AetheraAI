import json
import re
from pathlib import Path

from services.usage_tracker import UsageTracker
from services.execution_stream import append_execution_step
from services.workspace_manager import workspace_manager
from services.secret_redactor import (
    scan_list_for_secrets,
    redact_in_place,
)


def _normalize_files(code_data):
    if not code_data:
        return []

    if isinstance(code_data, list):
        return [
            item
            for item in code_data
            if isinstance(item, dict)
            and item.get("path")
        ]

    if isinstance(code_data, dict):
        files = code_data.get("files", [])
        if isinstance(files, list):
            return [
                item
                for item in files
                if isinstance(item, dict)
                and item.get("path")
            ]

    return []


UNSAFE_CMD_PATTERNS = [
    (
        re.compile(r"rm\s+-rf\s+.*(?:^|[\s'\"])/(?:$|[\s'\"])", re.IGNORECASE),
        "CRITICAL",
        "rm_rf_root",
        "Destructive rm -rf / command detected",
    ),
    (
        re.compile(r"rm\s+(-r\S*|-f\S*|-rf\S*)\s+", re.IGNORECASE),
        "HIGH",
        "rm_recursive",
        "Potentially destructive rm recursive command",
    ),
    (
        re.compile(r"curl[^|]*\|\s*(?:bash|sh)\b", re.IGNORECASE),
        "CRITICAL",
        "curl_pipe_shell",
        "Unsafe curl piped directly to shell",
    ),
    (
        re.compile(r"wget[^|]*\|\s*(?:bash|sh)\b", re.IGNORECASE),
        "CRITICAL",
        "wget_pipe_shell",
        "Unsafe wget piped directly to shell",
    ),
    (
        re.compile(r"eval\s*\(", re.IGNORECASE),
        "HIGH",
        "eval_call",
        "eval() call detected - dynamic code execution risk",
    ),
    (
        re.compile(r"subprocess\.(?:call|run|Popen|check_output|check_call)\s*\(.*shell\s*=\s*True", re.IGNORECASE),
        "HIGH",
        "subprocess_shell_true",
        "subprocess with shell=True - command injection risk",
    ),
    (
        re.compile(r"os\.system\s*\(", re.IGNORECASE),
        "HIGH",
        "os_system_call",
        "os.system() call - shell injection risk",
    ),
    (
        re.compile(r"chmod\s+777\b", re.IGNORECASE),
        "HIGH",
        "chmod_777",
        "Overly permissive chmod 777 - world writable",
    ),
    (
        re.compile(r"\bsudo\s", re.IGNORECASE),
        "MEDIUM",
        "sudo_usage",
        "sudo usage detected - elevated privileges",
    ),
    (
        re.compile(r"\bchown\s+\S+:\S+\s+/", re.IGNORECASE),
        "HIGH",
        "chown_root",
        "chown on root filesystem path",
    ),
    (
        re.compile(r"\bdd\s+if=", re.IGNORECASE),
        "MEDIUM",
        "dd_command",
        "dd command - potential disk overwrite",
    ),
    (
        re.compile(r"\bnc\s+-lvvp\b", re.IGNORECASE),
        "HIGH",
        "nc_listen",
        "nc listener - potential backdoor",
    ),
    (
        re.compile(r"socket\.bind\s*\(.*0\.0\.0\.0", re.IGNORECASE),
        "MEDIUM",
        "socket_bind_all",
        "Socket bound to 0.0.0.0 - all interfaces exposed",
    ),
]


FS_NET_PATTERNS = [
    (
        re.compile(r"/etc/passwd\b", re.IGNORECASE),
        "HIGH",
        "etc_passwd_ref",
        "Reference to /etc/passwd - sensitive system file",
    ),
    (
        re.compile(r"/etc/shadow\b", re.IGNORECASE),
        "HIGH",
        "etc_shadow_ref",
        "Reference to /etc/shadow - extremely sensitive system file",
    ),
    (
        re.compile(r"bind.*0\.0\.0\.0", re.IGNORECASE),
        "MEDIUM",
        "bind_all_interfaces",
        "Service bound to 0.0.0.0 - exposed on all interfaces",
    ),
    (
        re.compile(r"eval\s*\(.*\)", re.IGNORECASE),
        "HIGH",
        "eval_usage",
        "eval() usage - dynamic code execution",
    ),
    (
        re.compile(r"os\.path\.join\s*\(.*\.\.", re.IGNORECASE),
        "MEDIUM",
        "path_join_traversal",
        "os.path.join with .. segment - path traversal risk",
    ),
    (
        re.compile(r"\.\.\/\.\.", re.IGNORECASE),
        "HIGH",
        "path_traversal_chain",
        "Potential path traversal sequence ../.. detected",
    ),
]


def _scan_unsafe_commands(files):
    findings = []
    script_exts = (".sh", ".py", ".js", ".ts", ".bash", ".zsh", ".rb", ".php")

    for item in files:
        if not isinstance(item, dict):
            continue
        path = item.get("path", "") or ""
        code = item.get("code", "") or ""
        if not isinstance(code, str):
            continue

        lower = path.lower()
        is_script = any(lower.endswith(ext) for ext in script_exts) or lower.endswith("")

        if not is_script:
            continue

        for idx, code_line in enumerate(code.splitlines(), start=1):
            for pattern, severity, rule_id, description in UNSAFE_CMD_PATTERNS:
                if pattern.search(code_line):
                    findings.append({
                        "severity": severity,
                        "category": "UNSAFE_CMD",
                        "rule_id": rule_id,
                        "file": path,
                        "line": idx,
                        "description": description,
                    })

    return findings


def _scan_fs_net(files):
    findings = []

    for item in files:
        if not isinstance(item, dict):
            continue
        path = item.get("path", "") or ""
        code = item.get("code", "") or ""
        if not isinstance(code, str):
            continue

        for idx, code_line in enumerate(code.splitlines(), start=1):
            for pattern, severity, rule_id, description in FS_NET_PATTERNS:
                if pattern.search(code_line):
                    findings.append({
                        "severity": severity,
                        "category": "FS_NET_RISK",
                        "rule_id": rule_id,
                        "file": path,
                        "line": idx,
                        "description": description,
                    })

    return findings


def _npm_severity_map(sev):
    s = (sev or "").lower()
    if s == "critical":
        return "CRITICAL"
    if s == "high":
        return "HIGH"
    if s == "moderate":
        return "MEDIUM"
    if s == "low":
        return "LOW"
    return "MEDIUM"


def _run_command(workspace_path, command, timeout=120):
    try:
        return workspace_manager.run_command(
            workspace_path=workspace_path,
            command=command,
            timeout=timeout,
            sandbox=True,
        )
    except Exception as exc:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": str(exc),
        }


def _parse_npm_audit(result):
    findings = []
    stdout = result.get("stdout", "") or ""
    if not stdout:
        return findings

    try:
        audit_data = json.loads(stdout)
    except (TypeError, json.JSONDecodeError):
        return findings

    vulns = audit_data.get("vulnerabilities", {}) if isinstance(audit_data, dict) else {}
    if not isinstance(vulns, dict):
        return findings

    for pkg_name, info in vulns.items():
        if not isinstance(info, dict):
            continue
        severity = _npm_severity_map(info.get("severity"))
        title = info.get("title") or ""
        via = info.get("via") or []
        version_range = info.get("range", "")

        if isinstance(via, list):
            for v in via:
                if isinstance(v, dict):
                    title = v.get("title") or title
                    severity = _npm_severity_map(v.get("severity") or info.get("severity"))
                    break

        findings.append({
            "severity": severity,
            "category": "DEPENDENCY",
            "rule_id": "npm_audit",
            "file": "package.json",
            "line": None,
            "description": f"{pkg_name}@{version_range or 'via'}: {title}",
        })

    return findings


def _scan_npm_audit(workspace_path):
    return _parse_npm_audit(_run_command(workspace_path, "npm audit --json", timeout=120))


def _pip_audit_command():
    return (
        'bash -c "'
        "source .aethera-venv/bin/activate 2>/dev/null; "
        "pip install pip-audit -q 2>/dev/null; "
        'pip-audit --format json"'
    )


def _parse_pip_audit(result):
    findings = []
    stdout = result.get("stdout", "") or ""
    if not stdout:
        return findings

    try:
        audit_data = json.loads(stdout)
    except (TypeError, json.JSONDecodeError):
        return findings

    deps = audit_data.get("dependencies", []) if isinstance(audit_data, dict) else []
    if not isinstance(deps, list):
        return findings

    for dep in deps:
        if not isinstance(dep, dict):
            continue
        name = dep.get("name", "")
        version = dep.get("version", "")
        vulns = dep.get("vulns", [])
        if not isinstance(vulns, list):
            continue
        for v in vulns:
            if not isinstance(v, dict):
                continue
            aliases = v.get("aliases") or []
            fix_versions = v.get("fix_versions", [])
            severity = "MEDIUM"
            for alias in aliases:
                if isinstance(alias, str) and alias.startswith("CVE-"):
                    severity = "HIGH"
                    break
            findings.append({
                "severity": severity,
                "category": "DEPENDENCY",
                "rule_id": "pip_audit",
                "file": "requirements.txt",
                "line": None,
                "description": (
                    f"{name}@{version}: advisory {aliases[0] if aliases else v.get('id','?')} "
                    f"(fix: {fix_versions})"
                ),
            })

    return findings


def _scan_pip_audit(workspace_path):
    return _parse_pip_audit(_run_command(workspace_path, _pip_audit_command(), timeout=180))


def security_analyzer_agent(state):
    try:
        UsageTracker.set_context(
            user_id=state.get("user_id"),
            module="engineer",
            operation="security_analyzer_agent",
            agent="security_analyzer",
            project_id=state.get("project_id"),
            execution_id=state.get("execution_id"),
        )
    except Exception:
        pass

    state.setdefault("execution_steps", [])

    append_execution_step(state, {
        "agent": "security_analyzer",
        "step": "running_security_analysis",
        "status": "in_progress",
        "message": "Running security analysis (secrets, unsafe cmds, deps)",
    })

    workspace_path = state.get("project_path")

    try:
        project_files_raw = state.get("fixed_code") or state.get("generated_code") or []
        project_files = _normalize_files(project_files_raw)

        findings = []
        tool_runs = []

        secret_findings = scan_list_for_secrets(project_files)

        redaction_log_ref = {}
        for sf in secret_findings:
            rule_name = sf.get("rule_name", "")
            severity = sf.get("severity")
            if severity in ("CRITICAL",):
                display_sev = "CRITICAL"
            elif severity == "HIGH":
                display_sev = "HIGH"
            else:
                display_sev = "HIGH"

            fid = sf.get("finding_id", "")
            findings.append({
                "severity": display_sev,
                "category": "SECRET",
                "rule_id": rule_name,
                "file": sf.get("file"),
                "line": sf.get("line"),
                "description": f"Potential secret detected ({rule_name})",
                "redacted_preview": f"{fid} (see redaction log)",
            })

        cmd_findings = _scan_unsafe_commands(project_files)
        findings.extend(cmd_findings)

        fs_net_findings = _scan_fs_net(project_files)
        findings.extend(fs_net_findings)

        if workspace_path:
            workspace = Path(workspace_path)
            try:
                if (workspace / "package.json").exists():
                    npm_result = _run_command(workspace_path, "npm audit --json", timeout=120)
                    tool_runs.append({"tool": "npm_audit", "available": bool(npm_result.get("stdout")), "exit_code": npm_result.get("exit_code")})
                    findings.extend(_parse_npm_audit(npm_result))
            except Exception as exc:
                print(f"[SecurityAnalyzer] npm audit skipped: {exc}")

            try:
                if (workspace / "requirements.txt").exists() or (workspace / "pyproject.toml").exists():
                    pip_result = _run_command(workspace_path, _pip_audit_command(), timeout=180)
                    tool_runs.append({"tool": "pip_audit", "available": bool(pip_result.get("stdout")), "exit_code": pip_result.get("exit_code")})
                    findings.extend(_parse_pip_audit(pip_result))
            except Exception as exc:
                print(f"[SecurityAnalyzer] pip-audit skipped: {exc}")

        by_severity = {}
        by_category = {}
        for f in findings:
            sev = f.get("severity", "LOW") or "LOW"
            by_severity[sev] = by_severity.get(sev, 0) + 1
            cat = f.get("category", "OTHER") or "OTHER"
            by_category[cat] = by_category.get(cat, 0) + 1

        summary = {
            "by_severity": by_severity,
            "by_category": by_category,
            "total": len(findings),
            "status": "failed" if findings else "clean",
        }

        if workspace_path and tool_runs and any(not run["available"] for run in tool_runs):
            summary["status"] = "not_available"
            summary["unavailable_tools"] = [run["tool"] for run in tool_runs if not run["available"]]

        redacted_findings, redaction_log = redact_in_place(findings)

        state["security_analysis_results"] = {
            "summary": summary,
            "findings": redacted_findings,
            "tool_runs": tool_runs,
            "redaction_log_ref": "see_authorized_endpoint",
        }

        redacted_summary, _ = redact_in_place(summary)

        step_details = {
            "summary": redacted_summary,
            "total_findings": len(findings),
        }

        redacted_step_details, _ = redact_in_place(step_details)

        append_execution_step(state, {
            "agent": "security_analyzer",
            "step": "running_security_analysis",
            "status": "completed",
            "message": f"Security analysis complete: {len(findings)} finding(s)",
            "details": redacted_step_details,
        })

        return state

    except Exception as exc:
        print(f"[SecurityAnalyzer] Error (degraded): {exc}")

        empty_summary = {
            "total": 0,
            "status": "not_available",
            "note": str(exc),
        }

        state["security_analysis_results"] = {
            "summary": empty_summary,
            "findings": [],
            "redaction_log_ref": "see_authorized_endpoint",
        }

        append_execution_step(state, {
            "agent": "security_analyzer",
            "step": "running_security_analysis",
            "status": "completed",
            "message": f"Security analysis not available: {exc}",
            "details": {
                "status": "not_available",
                "note": str(exc),
                "total_findings": 0,
            },
        })

        return state
