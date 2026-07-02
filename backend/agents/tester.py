import json
import re
from datetime import datetime

from llm.groq_client import (
    generate_response
)

from llm.prompt_templates import (
    TESTER_PROMPT
)

from memory.project_memory import (
    save_memory
)
from services.execution_stream import append_execution_step



def tester_agent(state):

    generated_code = state.get(
        "fixed_code"
    )

    if not generated_code:

        generated_code = state.get(
            "generated_code"
        )

    # Add step: Starting tester
    append_execution_step(state, {
        "agent": "tester",
        "step": "analyzing_code",
        "status": "in_progress",
        "message": "Analyzing generated code for syntax errors and issues",
    })

    prompt = TESTER_PROMPT.replace(
        "{generated_code}",
        str(generated_code)
    )

    response = generate_response(
        prompt
    )

    print("\n=== TESTER RAW ===\n")
    print(response[:3000])

    try:

        response = re.sub(
            r"```json|```",
            "",
            response
        ).strip()

        match = re.search(
            r"\{.*\}",
            response,
            re.DOTALL
        )

        if not match:
            raise ValueError(
                "No JSON found"
            )

        try:
            report = json.loads(match.group())
        except Exception as json_err:
            import ast
            try:
                report = ast.literal_eval(match.group())
            except Exception:
                raise json_err

    except Exception as e:

        print(
            "\n=== TESTER PARSE ERROR ==="
        )
        print(str(e))

        report = {
            "status": "FAIL",
            "summary": {
                "critical_count": 1,
                "high_count": 0,
                "medium_count": 0,
                "low_count": 0
            },
            "issues": [
                {
                    "severity": "CRITICAL",
                    "category": "JSON",
                    "description":
                        f"Tester parse failed: {str(e)}",
                    "suggested_fix":
                        "Return valid JSON"
                }
            ]
        }

    state["test_results"] = report

    # Add step: Testing completed
    status = report.get("status", "FAIL")
    critical_count = report.get("summary", {}).get("critical_count", 0)
    
    append_execution_step(state, {
        "agent": "tester",
        "step": "analyzing_code",
        "status": "completed",
        "message": f"Code analysis completed - Status: {status}, Critical issues: {critical_count}",
        "details": {
            "status": status,
            "critical_count": critical_count,
            "issues_count": len(report.get("issues", []))
        },
    })

    state["agent_notes"].append(
        "Tester analyzed code"
    )

    save_memory(
        {
            "project_id":
                state["project_id"],

            "agent":
                "tester",

            "note":
                "Tester completed analysis"
        }
    )

    return state