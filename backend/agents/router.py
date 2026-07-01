def route_after_testing(state):

    iterations = state.get(
        "iterations",
        0
    )

    print("\n=== ROUTER ===")

    print(
        "Iterations:",
        iterations
    )

    report = state.get(
        "test_results",
        {}
    )

    status = report.get(
        "status",
        "FAIL"
    )

    print(
        "Tester Status:",
        status
    )

    MAX_ITERATIONS = 3

    try:

        if status == "PASS":

            print(
                "Routing -> Deployer"
            )

            return "end"

        if iterations >= MAX_ITERATIONS:

            print(
                f"Max iterations ({MAX_ITERATIONS}) reached"
            )

            print(
                "Routing -> End"
            )

            return "end"

        print(
            "Routing -> Debugger"
        )

        return "debugger"

    except Exception as e:

        print(
            "Router Error:",
            str(e)
        )

        return "debugger"