MAX_ITERATIONS = 3

def route_after_testing(state):
    """
    Route the Engineer graph after Tester.

    `iterations` represents the existing code/test/debug recovery loop.
    Infrastructure/API retries are handled separately inside graph.py and
    must not consume this code-repair budget.
    """

    iterations = state.get("iterations", 0)

    print("\n=== ROUTER (after_testing) ===")
    print("Iterations:", iterations)

    report = state.get("test_results", {})

    if not isinstance(report, dict):
        report = {}

    status = str(
        report.get("status", "FAIL")
    ).upper()

    print("Tester Status:", status)

    try:
        if status == "PASS":
            print("Routing -> Quality Gate")
            return "quality_gate"

        if iterations >= MAX_ITERATIONS:
            print(
                f"Max iterations ({MAX_ITERATIONS}) reached"
            )
            print("Routing -> Quality Gate (best effort)")
            return "quality_gate"

        print("Routing -> Debugger")
        return "debugger"

    except Exception as exc:
        # Safe fallback: a router failure must not create an uncontrolled loop.
        print("Router Error:", str(exc))
        return "quality_gate"


MAX_GATE_FIX_LOOPS = 2


def route_after_quality_gate(state):
    """
    Route after the Quality Gate:
      - PASS: proceed to Deployer.
      - FAIL: route back to Debugger for a bounded number of extra fix loops.
      - Always falls through to Deployer after the cap.
    """
    qg = state.get("quality_gate_report") or {}
    overall = str(qg.get("overall", "FAIL")).upper()
    iterations = state.get("iterations", 0)
    gate_fails = int(state.get("agent_notes_qg_fail_count", 0) or 0)

    print("\n=== ROUTER (after_quality_gate) ===")
    print("Iterations:", iterations, "Gate:", overall, "QG-fail-loops:", gate_fails)

    if overall == "PASS":
        print("Routing -> Deployer")
        return "deployer"

    if iterations >= MAX_ITERATIONS or gate_fails >= MAX_GATE_FIX_LOOPS:
        print(f"Bounded: iterations>={MAX_ITERATIONS} or gate-loops>={MAX_GATE_FIX_LOOPS}; Routing -> Deployer (evidence-based deployment gate included in report)")
        return "deployer"

    state["agent_notes_qg_fail_count"] = gate_fails + 1
    print("Routing -> Debugger (fix gate failures)")
    return "debugger"
