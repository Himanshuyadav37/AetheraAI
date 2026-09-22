def route_after_testing(state):
    """
    Route the Engineer graph after Tester.

    `iterations` represents the existing code/test/debug recovery loop.
    Infrastructure/API retries are handled separately inside graph.py and
    must not consume this code-repair budget.
    """

    iterations = state.get("iterations", 0)

    print("\n=== ROUTER ===")
    print("Iterations:", iterations)

    report = state.get("test_results", {})

    if not isinstance(report, dict):
        report = {}

    status = str(
        report.get("status", "FAIL")
    ).upper()

    print("Tester Status:", status)

    MAX_ITERATIONS = 3

    try:
        if status == "PASS":
            print("Routing -> Deployer")
            return "end"

        if iterations >= MAX_ITERATIONS:
            print(
                f"Max iterations ({MAX_ITERATIONS}) reached"
            )
            print("Routing -> End")
            return "end"

        print("Routing -> Debugger")
        return "debugger"

    except Exception as exc:
        # Safe fallback: a router failure must not create an uncontrolled loop.
        print("Router Error:", str(exc))
        return "end"
