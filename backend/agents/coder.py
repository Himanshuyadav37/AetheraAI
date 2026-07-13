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
from services.execution_stream import append_execution_step



def coder_agent(state):

    project_plan = state.get(
        "project_plan",
        {}
    )

    # Add step: Starting coder
    append_execution_step(state, {
        "agent": "coder",
        "step": "analyzing_plan",
        "status": "in_progress",
        "message": "Analyzing project plan and preparing code generation",
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

    # Inject Agent Self-Learning Loop context
    from services.self_learning import get_active_learnings
    owner_id = state.get("user_id", "system")
    learnings = get_active_learnings(owner_id)
    if learnings:
        prompt = f"{learnings}\n\n{prompt}"

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
            append_execution_step(state, {
                "agent": "coder",
                "step": "continue_development",
                "status": "in_progress",
                "message": "Continuing development on existing codebase",
            })

    # Add step: Generating code
    append_execution_step(state, {
        "agent": "coder",
        "step": "generating_code",
        "status": "in_progress",
        "message": "Generating production-ready code for all project files",
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

        try:
            generated_files = json.loads(json_text)
        except Exception as json_err:
            import ast
            try:
                # Replace JSON unquoted true/false/null with Python True/False/None outside string literals
                py_text = re.sub(
                    r'("[^"\\]*(?:\\.[^"\\]*)*"|\'[^\'\\]*(?:\\.[^\'\\]*)*\')|\b(true|false|null)\b',
                    lambda match: match.group(1) if match.group(1) else {"true": "True", "false": "False", "null": "None"}[match.group(2)],
                    json_text
                )
                generated_files = ast.literal_eval(py_text)
            except Exception:
                raise json_err

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
        append_execution_step(state, {
            "agent": "coder",
            "step": "generating_code",
            "status": "completed",
            "message": f"Successfully generated {len(generated_files['files'])} project files",
            "details": {
                "files_count": len(generated_files["files"]),
                "file_names": [f["path"] for f in generated_files["files"]]
            },
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
        append_execution_step(state, {
            "agent": "coder",
            "step": "generating_code",
            "status": "failed",
            "message": f"Failed to generate code: {str(e)}",
        })

    state["generated_code"] = (
        generated_files
    )
    state["initial_generated_code"] = (
        generated_files
    )

    print(
        "\n=== GENERATED CODE ===\n"
    )

    print(
        state["generated_code"]
    )

    return state