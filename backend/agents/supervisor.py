def supervisor_agent(state):

    iterations = state.get(
        "iterations",
        0
    )

    if not state.get("project_plan"):
        return "planner"

    if not state.get("generated_code"):
        return "coder"

    if not state.get("test_results"):
        return "tester"

    if not state.get("fixed_code"):
        return "debugger"

    if iterations < 2:
        state["iterations"] += 1

        state["generated_code"] = (
            state["fixed_code"]
        )

        state["fixed_code"] = {}

        state["test_results"] = ""

        return "tester"

    return "end"