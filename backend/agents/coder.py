import json
import re
from datetime import datetime

from llm.groq_client import (
    generate_response
)

from llm.prompt_templates import (
    CODER_PROMPT
)

from memory.project_memory import (
    save_memory,
    format_project_memory,
)


def coder_agent(state):

    project_plan = state.get(
        "project_plan",
        {}
    )

    # Add step: Starting coder
    state["execution_steps"].append({
        "agent": "coder",
        "step": "analyzing_plan",
        "status": "in_progress",
        "message": "Analyzing project plan and preparing code generation",
        "timestamp": datetime.utcnow().isoformat()
    })

    prompt = (
        CODER_PROMPT
        .replace(
            "{project_plan}",
            json.dumps(
                project_plan,
                indent=2
            )
        )
        .replace(
            "{user_request}",
            state.get("idea", "")
        )
    )

    project_id = state.get("project_id")
    if project_id:
        memory_context = format_project_memory(project_id)
        if memory_context:
            prompt = f"{prompt}\n\n{memory_context}"

    if state.get("mode") == "continue":
        existing = (
            state.get("fixed_code")
            or state.get("generated_code")
            or {}
        )
        if existing:
            prompt = (
                f"{prompt}\n\n"
                f"EXISTING CODE (update and extend, do not rewrite from scratch):\n"
                f"{json.dumps(existing, indent=2)}\n\n"
                f"NEW REQUEST:\n{state.get('idea', '')}"
            )
            state["execution_steps"].append({
                "agent": "coder",
                "step": "continue_development",
                "status": "in_progress",
                "message": "Continuing development on existing codebase",
                "timestamp": datetime.utcnow().isoformat(),
            })

    # Add step: Generating code
    state["execution_steps"].append({
        "agent": "coder",
        "step": "generating_code",
        "status": "in_progress",
        "message": "Generating production-ready code for all project files",
        "timestamp": datetime.utcnow().isoformat()
    })

    response = generate_response(
        prompt
    )

    print(
        "\n=== CODER RAW ===\n"
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
                "No JSON found in coder response"
            )

        json_text = response[
            start:end + 1
        ]

        generated_files = json.loads(
            json_text
        )

        if not isinstance(
            generated_files,
            dict
        ):
            raise ValueError(
                "Coder output is not a JSON object"
            )

        if "files" not in generated_files:
            raise ValueError(
                "Missing files key"
            )

        if not isinstance(
            generated_files["files"],
            list
        ):
            raise ValueError(
                "files must be a list"
            )

        state["agent_notes"].append(
            "Coder generated project code"
        )

        # Add step: Code generated successfully
        state["execution_steps"].append({
            "agent": "coder",
            "step": "generating_code",
            "status": "completed",
            "message": f"Successfully generated {len(generated_files['files'])} project files",
            "details": {
                "files_count": len(generated_files["files"]),
                "file_names": [f["path"] for f in generated_files["files"]]
            },
            "timestamp": datetime.utcnow().isoformat()
        })

        save_memory(
            {
                "project_id":
                    state["project_id"],

                "agent":
                    "coder",

                "note":
                    "Generated project code"
            }
        )

        print(
            "\n=== CODER SUCCESS ==="
        )

    except Exception as e:

        print(
            "\n=== CODER PARSE ERROR ==="
        )

        print(str(e))

        generated_files = {
            "files": [],
            "error": str(e),
            "raw_response": response
        }

        state["agent_notes"].append(
            "Coder returned invalid JSON"
        )

        # Add step: Code generation failed
        state["execution_steps"].append({
            "agent": "coder",
            "step": "generating_code",
            "status": "failed",
            "message": f"Failed to generate code: {str(e)}",
            "timestamp": datetime.utcnow().isoformat()
        })

    state["generated_code"] = (
        generated_files
    )

    print(
        "\n=== GENERATED CODE ===\n"
    )

    print(
        state["generated_code"]
    )

    return state