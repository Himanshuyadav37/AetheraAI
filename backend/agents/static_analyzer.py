import json
import re
from pathlib import Path

from services.usage_tracker import UsageTracker
from services.execution_stream import append_execution_step
from services.workspace_manager import workspace_manager


def _append_findings(findings, list_of_findings, severity_map, category):
    if not list_of_findings:
        return

    for f in list_of_findings:
        rule_id = str(f.get("rule_id") or f.get("code") or f.get("ruleId") or "")
        severity = None
        for prefix, sev in (severity_map or {}).items():
            if rule_id.startswith(prefix):
                severity = sev
                break
        if severity is None:
            severity = f.get("severity", "LOW")

        findings.append({
            "severity": severity,
            "category": category,
            "rule_id": rule_id,
            "file": f.get("file") or f.get("filename") or f.get("filePath") or f.get("path") or None,
            "line": f.get("line") or f.get("line_no") or f.get("lineNumber") or None,
            "message": f.get("message") or f.get("msg") or f.get("description") or "",
        })


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


def _tool_available(result):
    output = f"{result.get('stdout', '')}\n{result.get('stderr', '')}".lower()
    return not any(token in output for token in ("command not found", "not recognized", "no module named", "not installed"))


def _has_mypy_config(workspace_path):
    workspace = Path(workspace_path)
    if (workspace / "mypy.ini").exists():
        return True
    pyproject = workspace / "pyproject.toml"
    if pyproject.exists():
        try:
            content = pyproject.read_text(encoding="utf-8", errors="replace")
            if "[mypy]" in content:
                return True
        except Exception:
            pass
    venv_mypy = workspace / ".aethera-venv" / "bin" / "mypy"
    if venv_mypy.exists():
        return True
    return False


def _has_eslint_config(workspace_path):
    workspace = Path(workspace_path)
    for p in workspace.rglob("*"):
        if not p.is_file():
            continue
        name = p.name.lower()
        if name.startswith(".eslintrc"):
            return True
        if name == "package.json":
            try:
                data = json.loads(p.read_text(encoding="utf-8", errors="replace"))
                if isinstance(data, dict) and "eslintConfig" in data:
                    return True
            except Exception:
                pass
    return False


def _has_pyright_config(workspace_path):
    return (Path(workspace_path) / "pyrightconfig.json").exists()


def static_analyzer_agent(state):
    UsageTracker.set_context(
        user_id=state.get("user_id"),
        module="engineer",
        operation="static_analyzer_agent",
        agent="static_analyzer",
        project_id=state.get("project_id"),
        execution_id=state.get("execution_id"),
    )

    state.setdefault("execution_steps", [])

    append_execution_step(state, {
        "agent": "static_analyzer",
        "step": "running_static_analysis",
        "status": "in_progress",
        "message": "Running static analysis tools (lint, type check)",
    })

    workspace_path = state.get("project_path")

    findings = []
    tool_runs = []

    try:
        workspace = Path(workspace_path) if workspace_path else None

        is_node = False
        is_python = False

        if workspace and workspace.exists():
            if (workspace / "package.json").exists():
                is_node = True

            for config in ("pyproject.toml", "requirements.txt"):
                if (workspace / config).exists():
                    is_python = True
                    break

            if not is_python:
                for p in workspace.rglob("*.py"):
                    if p.is_file():
                        is_python = True
                        break

        if is_python and workspace_path:
            ruff_result = _run_command(
                workspace_path,
                'bash -c "source .aethera-venv/bin/activate 2>/dev/null; ruff check --output-format json ."',
                timeout=120,
            )
            tool_runs.append({"tool": "ruff", "exit_code": ruff_result.get("exit_code"), "available": _tool_available(ruff_result)})

            if ruff_result.get("success") or ruff_result.get("stdout"):
                try:
                    ruff_data = json.loads(ruff_result.get("stdout", "[]") or "[]")
                except (TypeError, json.JSONDecodeError):
                    match = re.search(r"\[.*\]", ruff_result.get("stdout", "") or "", re.DOTALL)
                    if match:
                        try:
                            ruff_data = json.loads(match.group(0))
                        except Exception:
                            ruff_data = []
                    else:
                        ruff_data = []

                ruff_findings = []
                if isinstance(ruff_data, list):
                    for item in ruff_data:
                        if not isinstance(item, dict):
                            continue
                        ruff_findings.append({
                            "rule_id": item.get("code", ""),
                            "file": item.get("filename"),
                            "line": item.get("location", {}).get("row") if isinstance(item.get("location"), dict) else item.get("line_no"),
                            "message": item.get("message", ""),
                        })

                _append_findings(
                    findings,
                    ruff_findings,
                    severity_map={
                        "F": "HIGH",
                        "E": "HIGH",
                        "W": "MEDIUM",
                        "I": "LOW",
                        "D": "LOW",
                        "R": "LOW",
                    },
                    category="LINT",
                )

            if _has_mypy_config(workspace_path):
                mypy_result = _run_command(
                    workspace_path,
                    'bash -c "source .aethera-venv/bin/activate 2>/dev/null; mypy --output-format json ."',
                    timeout=180,
                )
                tool_runs.append({"tool": "mypy", "exit_code": mypy_result.get("exit_code"), "available": _tool_available(mypy_result)})

                if mypy_result.get("stdout"):
                    try:
                        mypy_data = json.loads(mypy_result.get("stdout", "[]") or "[]")
                    except (TypeError, json.JSONDecodeError):
                        mypy_data = []

                    mypy_findings = []
                    if isinstance(mypy_data, list):
                        for item in mypy_data:
                            if not isinstance(item, dict):
                                continue
                            file_path = item.get("file") or item.get("path")
                            if file_path and workspace:
                                try:
                                    fp = Path(file_path)
                                    ws = workspace.resolve()
                                    try:
                                        file_path = str(fp.resolve().relative_to(ws))
                                    except ValueError:
                                        pass
                                except Exception:
                                    pass
                            mypy_findings.append({
                                "rule_id": "mypy",
                                "file": file_path,
                                "line": item.get("line"),
                                "message": item.get("message", ""),
                                "severity": "HIGH",
                            })

                    _append_findings(
                        findings,
                        mypy_findings,
                        severity_map={"mypy": "HIGH"},
                        category="TYPECHECK",
                    )

        if is_node and workspace_path:
            if _has_eslint_config(workspace_path):
                eslint_result = _run_command(
                    workspace_path,
                    "npx eslint --format json . --no-eslintrc=false",
                    timeout=180,
                )
                tool_runs.append({"tool": "eslint", "exit_code": eslint_result.get("exit_code"), "available": _tool_available(eslint_result)})

                if eslint_result.get("stdout"):
                    try:
                        eslint_data = json.loads(eslint_result.get("stdout", "[]") or "[]")
                    except (TypeError, json.JSONDecodeError):
                        eslint_data = []

                    eslint_findings = []
                    if isinstance(eslint_data, list):
                        for file_item in eslint_data:
                            if not isinstance(file_item, dict):
                                continue
                            file_path = file_item.get("filePath")
                            if file_path and workspace:
                                try:
                                    fp = Path(file_path)
                                    ws = workspace.resolve()
                                    try:
                                        file_path = str(fp.resolve().relative_to(ws))
                                    except ValueError:
                                        pass
                                except Exception:
                                    pass
                            msgs = file_item.get("messages", [])
                            if not isinstance(msgs, list):
                                continue
                            for msg in msgs:
                                if not isinstance(msg, dict):
                                    continue
                                sev_code = msg.get("severity", 0)
                                if sev_code == 2:
                                    sev = "HIGH"
                                elif sev_code == 1:
                                    sev = "MEDIUM"
                                else:
                                    sev = "LOW"
                                eslint_findings.append({
                                    "rule_id": msg.get("ruleId") or "eslint",
                                    "file": file_path,
                                    "line": msg.get("line"),
                                    "message": msg.get("message", ""),
                                    "severity": sev,
                                })

                    _append_findings(
                        findings,
                        eslint_findings,
                        severity_map={},
                        category="LINT",
                    )

            tsconfig = workspace / "tsconfig.json" if workspace else None
            if tsconfig and tsconfig.exists():
                tsc_result = _run_command(
                    workspace_path,
                    "npx tsc --noEmit -p .",
                    timeout=180,
                )
                tool_runs.append({"tool": "tsc", "exit_code": tsc_result.get("exit_code"), "available": _tool_available(tsc_result)})

                tsc_stderr = tsc_result.get("stderr", "") or ""
                tsc_findings = []
                tsc_re = re.compile(
                    r"([^\s]+)\((\d+),(\d+)\):\s*error\s+([^:]+):\s*(.*)"
                )
                for line in tsc_stderr.splitlines():
                    m = tsc_re.search(line)
                    if m:
                        file_path = m.group(1)
                        if workspace:
                            try:
                                fp = Path(file_path)
                                ws = workspace.resolve()
                                try:
                                    file_path = str(fp.resolve().relative_to(ws))
                                except ValueError:
                                    pass
                            except Exception:
                                pass
                        tsc_findings.append({
                            "rule_id": "tsc",
                            "file": file_path,
                            "line": int(m.group(2)) if m.group(2).isdigit() else None,
                            "message": f"{m.group(4).strip()}: {m.group(5).strip()}",
                            "severity": "HIGH",
                        })

                _append_findings(
                    findings,
                    tsc_findings,
                    severity_map={"tsc": "HIGH"},
                    category="TYPECHECK",
                )

            if _has_pyright_config(workspace_path):
                pyright_result = _run_command(workspace_path, "npx pyright --outputjson", timeout=180)
                tool_runs.append({"tool": "pyright", "exit_code": pyright_result.get("exit_code"), "available": _tool_available(pyright_result)})
                try:
                    pyright_data = json.loads(pyright_result.get("stdout", "{}") or "{}")
                except (TypeError, json.JSONDecodeError):
                    pyright_data = {}
                diagnostics = pyright_data.get("generalDiagnostics", []) if isinstance(pyright_data, dict) else []
                pyright_findings = []
                for item in diagnostics if isinstance(diagnostics, list) else []:
                    if not isinstance(item, dict):
                        continue
                    position = item.get("range", {}).get("start", {}) if isinstance(item.get("range"), dict) else {}
                    pyright_findings.append({"rule_id": item.get("rule") or "pyright", "file": item.get("file"), "line": (position.get("line", 0) + 1) if isinstance(position, dict) else None, "message": item.get("message", ""), "severity": "HIGH" if item.get("severity") == "error" else "MEDIUM"})
                _append_findings(findings, pyright_findings, {}, "TYPECHECK")

        by_severity = {}
        for f in findings:
            sev = f.get("severity", "LOW") or "LOW"
            by_severity[sev] = by_severity.get(sev, 0) + 1

        top_20 = []
        seen_pairs = set()
        for f in findings:
            pair = (f.get("file"), f.get("rule_id"))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            top_20.append({"file": f.get("file"), "rule_id": f.get("rule_id")})
            if len(top_20) >= 20:
                break

        unavailable = [run["tool"] for run in tool_runs if not run["available"]]
        tool_failed = any(run.get("exit_code") not in (0, None) for run in tool_runs)
        status = "not_available" if not tool_runs or unavailable else ("failed" if findings or tool_failed else "clean")
        state["static_analysis_results"] = {
            "summary": {
                "by_severity": by_severity,
                "total": len(findings),
                "status": status,
                "unavailable_tools": unavailable,
            },
            "findings": findings,
            "tool_runs": tool_runs,
        }

        # Optional/unconfigured tools are unavailable, not failed analysis.
        # Keep this distinct in the timeline so a static-only project does not
        # receive an erroneous red failure state.
        step_status = "completed" if status in {"clean", "not_available"} else "failed"
        append_execution_step(state, {
            "agent": "static_analyzer",
            "step": "running_static_analysis",
            "status": step_status,
            "message": f"Static analysis {status}: {len(findings)} finding(s)",
            "details": {
                "summary": {
                    "by_severity": by_severity,
                    "total": len(findings),
                },
                "top_file_rule_pairs": top_20,
            },
        })

        return state

    except Exception as exc:
        print(f"[StaticAnalyzer] Error: {exc}")
        import warnings
        warnings.warn(f"Static analysis unavailable: {exc}")

        state["static_analysis_results"] = {
            "summary": {
                "total": 0,
                "status": "not_available",
                "note": str(exc),
            },
            "findings": [],
        }

        append_execution_step(state, {
            "agent": "static_analyzer",
            "step": "running_static_analysis",
            "status": "completed",
            "message": f"Static analysis not available: {exc}",
            "details": {
                "status": "not_available",
                "note": str(exc),
            },
        })

        return state
