"""Fail-closed evidence gate between testing and deployment."""
import os
from datetime import datetime

from services.execution_stream import append_execution_step
from services.usage_tracker import UsageTracker


def _check(status, measured, threshold, note=""):
    return {"status": status, "measured": measured, "threshold": threshold, "note": note}


def _unavailable(measured, note):
    return _check("NOT_AVAILABLE", measured, "real evidence required", note)


def _commands(test_results):
    execution = test_results.get("execution") if isinstance(test_results, dict) else {}
    commands = execution.get("commands", []) if isinstance(execution, dict) else []
    return [item for item in commands if isinstance(item, dict)] if isinstance(commands, list) else []


def quality_gate_agent(state):
    UsageTracker.set_context(user_id=state.get("user_id"), module="engineer", operation="quality_gate_agent", agent="quality_gate", project_id=state.get("project_id"), execution_id=state.get("execution_id"))
    state.setdefault("execution_steps", [])
    append_execution_step(state, {"agent": "quality_gate", "step": "quality_gate_eval", "status": "in_progress", "message": "Verifying real build, test, coverage, analysis, security, and unresolved-error evidence"})
    try:
        tr = state.get("test_results") if isinstance(state.get("test_results"), dict) else {}
        static = state.get("static_analysis_results") if isinstance(state.get("static_analysis_results"), dict) else {}
        security = state.get("security_analysis_results") if isinstance(state.get("security_analysis_results"), dict) else {}
        commands = _commands(tr)
        failed = [c for c in commands if c.get("success") is not True]

        build_commands = [c for c in commands if any(token in str(c.get("command", c.get("cmd", ""))).lower() for token in ("build", "compile", "tsc", "syntax"))]
        checks = {}
        checks["build"] = _unavailable("no build/compile command executed", "A deployable result must include build evidence") if not build_commands else _check("FAIL" if any(c.get("success") is not True for c in build_commands) else "PASS", f"{sum(c.get('success') is True for c in build_commands)}/{len(build_commands)} passed", "all executed build commands pass")

        test_commands = [c for c in commands if "test" in str(c.get("command", c.get("cmd", ""))).lower()]
        checks["tests"] = _unavailable("no test command executed", "A passing test status without command evidence is insufficient") if not test_commands else _check("FAIL" if str(tr.get("status", "FAIL")).upper() != "PASS" or any(c.get("success") is not True for c in test_commands) else "PASS", f"{sum(c.get('success') is True for c in test_commands)}/{len(test_commands)} passed", "tester PASS and all test commands pass")

        coverage = tr.get("coverage")
        line_pct = coverage.get("line_pct", coverage.get("line", coverage.get("lines"))) if isinstance(coverage, dict) else None
        if line_pct is None:
            checks["coverage"] = _unavailable("coverage not reported", "Coverage evidence is required")
        else:
            try:
                value = float(line_pct)
                minimum = float(os.getenv("AETHERA_MIN_COVERAGE_PCT", "60"))
                checks["coverage"] = _check("PASS" if value >= minimum else "FAIL", f"{value:.1f}%", f">= {minimum:.0f}%")
            except (TypeError, ValueError):
                checks["coverage"] = _unavailable("invalid coverage value", "Coverage must be numeric")

        for name, report in (("lint_type", static), ("security", security)):
            summary = report.get("summary") if isinstance(report, dict) else None
            findings = report.get("findings") if isinstance(report, dict) else None
            if not isinstance(summary, dict) or not isinstance(findings, list) or str(summary.get("status", "")).lower() == "not_available":
                checks[name] = _unavailable("analysis unavailable or missing", "Analysis evidence is required")
                continue
            severe = [f for f in findings if isinstance(f, dict) and str(f.get("severity", "")).upper() in ("CRITICAL", "HIGH")]
            checks[name] = _check("FAIL" if severe else "PASS", f"{len(severe)} critical/high findings", "0 critical/high findings")

        issues = tr.get("issues", []) if isinstance(tr.get("issues"), list) else []
        unresolved = [i for i in issues if isinstance(i, dict) and (str(i.get("severity", "")).upper() in ("CRITICAL", "HIGH") or str(i.get("status", "")).lower() in ("open", "pending", "unresolved", "failed"))]
        explicit_unresolved = tr.get("unresolved_errors", [])
        has_explicit = bool(explicit_unresolved) if isinstance(explicit_unresolved, (list, dict, str)) else False
        checks["unresolved_errors"] = _check("FAIL" if failed or unresolved or has_explicit else "PASS", f"{len(failed)} failed commands, {len(unresolved)} unresolved issues", "0 unresolved errors")

        overall = "PASS" if checks and all(check["status"] == "PASS" for check in checks.values()) else "FAIL"
        state["quality_gate_report"] = {"overall": overall, "checks": checks, "iteration": state.get("iterations", 0), "timestamp": datetime.utcnow().isoformat() + "Z"}
        append_execution_step(state, {"agent": "quality_gate", "step": "quality_gate_eval", "status": "completed" if overall == "PASS" else "failed", "message": f"Quality gate: {overall}", "details": state["quality_gate_report"]})
        return state
    except Exception as exc:
        state["quality_gate_report"] = {"overall": "NOT_AVAILABLE", "checks": {}, "error": str(exc), "timestamp": datetime.utcnow().isoformat() + "Z"}
        append_execution_step(state, {"agent": "quality_gate", "step": "quality_gate_eval", "status": "failed", "message": f"Quality gate unavailable: {exc}"})
        return state
