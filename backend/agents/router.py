MAX_ITERATIONS = 3
MAX_GATE_FIX_LOOPS = 2


def _iterations(state):
    try:
        return int(state.get("iterations", 0) or 0)
    except (TypeError, ValueError):
        return MAX_ITERATIONS


def route_after_testing(state):
    """Route failed verification through a bounded, fail-closed repair loop."""
    iterations = _iterations(state)
    report = state.get("test_results") or {}
    status = str(report.get("status", "FAIL")).upper() if isinstance(report, dict) else "FAIL"
    print("\n=== ROUTER (after_testing) ===")
    print("Iterations:", iterations, "Tester Status:", status)
    if status == "PASS":
        return "quality_gate"
    if iterations >= MAX_ITERATIONS or state.get("no_progress"):
        state["failure_reason"] = "max_iterations" if iterations >= MAX_ITERATIONS else "no_progress"
        return "failed"
    return "debugger"


def route_after_quality_gate(state):
    """Only an explicit, evidence-backed PASS may reach the Deployer."""
    qg = state.get("quality_gate_report") or {}
    overall = str(qg.get("overall", "NOT_AVAILABLE")).upper() if isinstance(qg, dict) else "NOT_AVAILABLE"
    iterations = _iterations(state)
    try:
        gate_fails = int(state.get("agent_notes_qg_fail_count", 0) or 0)
    except (TypeError, ValueError):
        gate_fails = MAX_GATE_FIX_LOOPS
    print("\n=== ROUTER (after_quality_gate) ===")
    print("Iterations:", iterations, "Gate:", overall, "QG-fail-loops:", gate_fails)
    if overall == "PASS":
        return "deployer"
    if iterations >= MAX_ITERATIONS or gate_fails >= MAX_GATE_FIX_LOOPS or state.get("no_progress"):
        state["failure_reason"] = "max_iterations" if iterations >= MAX_ITERATIONS else ("no_progress" if state.get("no_progress") else "quality_gate_fix_limit")
        return "failed"
    state["agent_notes_qg_fail_count"] = gate_fails + 1
    return "debugger"
