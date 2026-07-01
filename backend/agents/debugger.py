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


def debugger_agent(state):

    state["iterations"] = (
        state.get(
            "iterations",
            0
        ) + 1
    )

    iteration = state["iterations"]

    # Add step: Starting debugger
    state["execution_steps"].append({
        "agent": "debugger",
        "step": "analyzing_issues",
        "status": "in_progress",
        "message": f"Iteration {iteration}: Analyzing test results and identifying fixes",
        "timestamp": datetime.utcnow().isoformat()
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
        "{test_report}",
        str(test_report)
    )

    # Add step: Generating fixes
    state["execution_steps"].append({
        "agent": "debugger",
        "step": "generating_fixes",
        "status": "in_progress",
        "message": f"Iteration {iteration}: Generating corrected code",
        "timestamp": datetime.utcnow().isoformat()
    })

    response = generate_response(
        prompt
    )

    print(
        "\n=== DEBUGGER RAW ===\n"
    )

    print(response[:3000])

    response = re.sub(
        r"```json|```",
        "",
        response
    ).strip()

    try:

        start = response.find("{")
        end = response.rfind("}")

        if (
            start == -1
            or
            end == -1
        ):
            raise ValueError(
                "No JSON found in response"
            )

        json_text = response[
            start:end + 1
        ]

        json_text = (
            json_text
            .replace("\t", " ")
            .replace("\r", "")
        )

        fixed_code = json.loads(
            json_text,
            strict=False
        )

        if not isinstance(
            fixed_code,
            dict
        ):
            raise ValueError(
                "Output is not a JSON object"
            )

        if "files" not in fixed_code:
            raise ValueError(
                "Missing files key"
            )

        state["fixed_code"] = (
            fixed_code
        )

        state["generated_code"] = (
            fixed_code
        )

        state["debug_report"] = (
            "Code fixed successfully"
        )

        state["agent_notes"].append(
            "Debugger fixed code"
        )

        # Add step: Fixes generated successfully
        state["execution_steps"].append({
            "agent": "debugger",
            "step": "generating_fixes",
            "status": "completed",
            "message": f"Iteration {iteration}: Successfully generated corrected code",
            "details": {
                "iteration": iteration,
                "files_fixed": len(fixed_code.get("files", []))
            },
            "timestamp": datetime.utcnow().isoformat()
        })

        save_memory(
            {
                "project_id":
                    state["project_id"],

                "agent":
                    "debugger",

                "note":
                    "Generated corrected code"
            }
        )

        print(
            "\n=== DEBUGGER SUCCESS ==="
        )

    except Exception as e:

        print(
            "\n=== DEBUGGER PARSE ERROR ==="
        )

        print(str(e))

        state["debug_report"] = (
            f"Debugger failed: {str(e)}"
        )

        state["agent_notes"].append(
            "Debugger parse failed"
        )

        # Add step: Fixes failed
        state["execution_steps"].append({
            "agent": "debugger",
            "step": "generating_fixes",
            "status": "failed",
            "message": f"Iteration {iteration}: Failed to generate fixes - {str(e)}",
            "timestamp": datetime.utcnow().isoformat()
        })

        print(
            "\n=== USING ORIGINAL CODE ==="
        )

    state["test_results"] = {}

    return state