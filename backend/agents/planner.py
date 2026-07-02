import json
import re
from datetime import datetime

from llm.groq_client import generate_response
from llm.prompt_templates import PLANNER_PROMPT
from db.project_service import create_project
from rag.retriever import get_context

from memory.project_memory import (
    save_memory,
    format_project_memory,
)
from services.execution_stream import append_execution_step



def planner_agent(state):

    idea = state["idea"]
    owner_id = state["user_id"]

    if "execution_steps" not in state:
        state["execution_steps"] = []

    # Skip planner when continuing an existing project
    if state.get("mode") == "continue" and state.get("project_id"):
        append_execution_step(state, {
            "agent": "planner",
            "step": "skip_resume",
            "status": "completed",
            "message": "Resuming existing project — skipping new plan generation",
        })
        state["agent_notes"].append(
            f"Resumed project {state['project_id']} with new request"
        )
        return state

    # Add step: Starting planner
    append_execution_step(state, {
        "agent": "planner",
        "step": "analyzing_requirements",
        "status": "in_progress",
        "message": "Analyzing project requirements and retrieving relevant knowledge",
    })

    # Retrieve relevant context from RAG
    context = get_context(idea)

    # Add step: Context retrieved
    append_execution_step(state, {
        "agent": "planner",
        "step": "retrieving_context",
        "status": "completed",
        "message": f"Retrieved relevant context from knowledge base",
    })

    # Add step: Generating plan
    append_execution_step(state, {
        "agent": "planner",
        "step": "generating_plan",
        "status": "in_progress",
        "message": "Generating comprehensive project blueprint",
    })

    prompt = f"""
    {PLANNER_PROMPT}

    RELEVANT KNOWLEDGE:
    {context}

    SOFTWARE IDEA:
    {idea}
    """

    project_id = state.get("project_id")
    if project_id:
        memory_context = format_project_memory(project_id)
        if memory_context:
            prompt = f"{prompt}\n\n{memory_context}"

    response = generate_response(prompt)

    response = re.sub(
        r"```json|```",
        "",
        response
    ).strip()

    try:

        try:
            plan = json.loads(response)
        except Exception as json_err:
            import ast
            try:
                plan = ast.literal_eval(response)
            except Exception:
                raise json_err

        project_id = create_project(
            owner_id=owner_id,
            idea=idea,
            project_plan=plan
        )

        state["project_id"] = project_id
        state["project_plan"] = plan

        state["agent_notes"].append(
            f"Planner created project plan for: {idea}"
        )

        # Add step: Plan generated successfully
        append_execution_step(state, {
            "agent": "planner",
            "step": "generating_plan",
            "status": "completed",
            "message": f"Successfully created project plan: {plan.get('project_name', 'Unnamed Project')}",
            "details": {
                "project_name": plan.get("project_name", ""),
                "tech_stack": plan.get("tech_stack", {}),
                "features_count": len(plan.get("features", [])),
                "milestones_count": len(plan.get("milestones", []))
            },
        })

        save_memory(
            {
                "project_id": project_id,
                "agent": "planner",
                "note": f"Created plan for {idea}"
            }
        )

        return state


    except Exception as e:

        state["agent_notes"].append(

            "Planner failed to generate valid plan"

        )

        # Add step: Plan generation failed
        append_execution_step(state, {
            "agent": "planner",
            "step": "generating_plan",
            "status": "failed",
            "message": f"Failed to generate project plan: {str(e)}",
        })

        state["project_plan"] = {

            "success": False,

            "error": str(e),

            "raw_response": response

        }

        return state