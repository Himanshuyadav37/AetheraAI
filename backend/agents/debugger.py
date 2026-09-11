import json
import re
from datetime import datetime

from llm.groq_client import (
    generate_response
)

from llm.prompt_templates import (
    FIXER_PROMPT
)

from memory.project_memory import (
    save_memory
)
from services.execution_stream import append_execution_step



def debugger_agent(state):

    state["iterations"] = (
        state.get(
            "iterations",
            0
        ) + 1
    )

    iteration = state["iterations"]

    # Add step: Starting debugger
    append_execution_step(state, {
        "agent": "debugger",
        "step": "analyzing_issues",
        "status": "in_progress",
        "message": f"Iteration {iteration}: Analyzing test results and identifying fixes",
    })

    generated_code = str(
        state.get(
            "generated_code",
            {}
        )
    )

    test_report = state.get(
        "test_results",
        {}
    )

    prompt = FIXER_PROMPT

    prompt = prompt.replace(
        "{generated_code}",
        generated_code
    )

    prompt = prompt.replace(
        "{debug_report}",
        str(test_report)
    )

    # Inject Agent Self-Learning Loop context
    from services.self_learning import get_active_learnings
    owner_id = state.get("user_id", "system")
    learnings = get_active_learnings(owner_id)
    if learnings:
        prompt = f"{learnings}\n\n{prompt}"

    # Add step: Generating fixes
    append_execution_step(state, {
        "agent": "debugger",
        "step": "generating_fixes",
        "status": "in_progress",
        "message": f"Iteration {iteration}: Generating corrected code",
    })

    response = generate_response(
        prompt
    )

    print(
        "\n=== DEBUGGER RAW ===\n"
    )

    print(response[:3000])

    from services.code_parser import extract_files_from_response
    fixed_files = extract_files_from_response(response)

    if fixed_files.get("files") and len(fixed_files["files"]) > 0:
        state["fixed_code"] = fixed_files
        state["generated_code"] = fixed_files
        state["debug_report"] = "Code fixed successfully"
        state["agent_notes"].append("Debugger fixed code")

        # Add step: Fixes generated successfully
        append_execution_step(state, {
            "agent": "debugger",
            "step": "generating_fixes",
            "status": "completed",
            "message": f"Iteration {iteration}: Successfully generated corrected code",
            "details": {
                "iteration": iteration,
                "files_fixed": len(fixed_files.get("files", []))
            },
        })

        save_memory({
            "project_id": state.get("project_id"),
            "agent": "debugger",
            "note": "Generated corrected code"
        })
        print(f"\n=== DEBUGGER SUCCESS: {len(fixed_files['files'])} FILES EXTRACTED ===")
    else:
        err_msg = "Could not extract valid source code from debugger response"
        print(f"\n=== DEBUGGER PARSE ERROR ===: {err_msg}")
        state["debug_report"] = f"Debugger failed: {err_msg}"
        state["agent_notes"].append("Debugger parse failed")

        # Add step: Fixes failed
        append_execution_step(state, {
            "agent": "debugger",
            "step": "generating_fixes",
            "status": "failed",
            "message": f"Iteration {iteration}: Failed to generate fixes - {err_msg}",
        })
        print("\n=== USING ORIGINAL CODE ===")

    state["test_results"] = {}

    return state