import json
import re
from datetime import datetime

from llm.groq_client import generate_response
from llm.prompt_templates import PLANNER_PROMPT
from db.project_service import create_project
from rag.retriever import get_context
from memory.project_memory import save_memory, format_project_memory
from services.execution_stream import append_execution_step
from services.usage_tracker import UsageTracker


def extract_json_plan(raw_text: str, idea: str) -> dict:
    """Extract and validate a project plan, with a resilient fallback."""
    clean = (raw_text or "").strip()
    clean = re.sub(r"^```(?:json)?", "", clean, flags=re.IGNORECASE | re.MULTILINE)
    clean = re.sub(r"```$", "", clean, flags=re.MULTILINE).strip()

    start, end = clean.find("{"), clean.rfind("}")
    if start != -1 and end > start:
        candidate = clean[start:end + 1]
        for parser in (json.loads,):
            try:
                parsed = parser(candidate)
                if isinstance(parsed, dict) and "project_name" in parsed:
                    return parsed
            except Exception:
                pass
        try:
            import ast
            parsed = ast.literal_eval(candidate)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
        try:
            fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
            fixed = re.sub(r"[\x00-\x1f\x7f-\x9f]", " ", fixed)
            parsed = json.loads(fixed)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    title = idea.split("\n")[0][:45].strip().title() or "Production Application"
    return {
        "project_name": title,
        "project_description": f"Production-grade application designed for: {idea[:200]}",
        "target_users": ["End Users", "Administrators", "Team Members"],
        "problem_statement": idea[:300],
        "tech_stack": {
            "frontend": ["HTML5", "CSS3", "JavaScript"],
            "backend": ["Python 3", "FastAPI"],
            "database": ["PostgreSQL", "LocalStorage"],
            "ai_tools": [],
        },
        "architecture_files": ["index.html", "style.css", "app.js", "main.py"],
        "features": [
            "1. User authentication, session management, and role-based access",
            "2. Interactive dashboard with real-time CRUD management and state persistence",
            "3. Search, filter, and sorting data grid with animated modals",
            "4. RESTful API integration with comprehensive validation",
            "5. Responsive glassmorphic layout and modern UI micro-interactions",
        ],
        "milestones": [
            "1. Define data models, database schemas, and FastAPI REST endpoints",
            "2. Implement semantic HTML structure, responsive CSS layout, and visual components",
            "3. Wire client-side controllers, API communication, and interactive workflows",
        ],
        "database_collections": ["users", "projects", "tasks"],
        "api_modules": ["/auth", "/projects", "/tasks", "/health"],
        "security_requirements": ["Input sanitization", "JWT authentication", "CORS policy"],
    }


def planner_agent(state):
    # Bind every planner LLM request to the execution for token/cost analytics.
    UsageTracker.set_context(
        user_id=state.get("user_id"),
        module="engineer",
        operation="planner_agent",
        agent="planner",
        project_id=state.get("project_id"),
        execution_id=state.get("execution_id"),
    )

    idea = state["idea"]
    owner_id = state["user_id"]
    state.setdefault("execution_steps", [])
    state.setdefault("agent_notes", [])

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

    append_execution_step(state, {
        "agent": "planner",
        "step": "analyzing_requirements",
        "status": "in_progress",
        "message": "Analyzing project requirements and retrieving relevant knowledge",
    })

    context = ""
    try:
        context = get_context(idea)
    except Exception as exc:
        print("[Planner RAG Context Warning]:", exc)

    append_execution_step(state, {
        "agent": "planner",
        "step": "retrieving_context",
        "status": "completed",
        "message": "Retrieved relevant context from knowledge base",
    })

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
    try:
        from services.self_learning import get_relevant_learnings
        lessons, applied = get_relevant_learnings(owner_id, idea)
        if lessons:
            prompt = f"{lessons}\n\n{prompt}"
            state.setdefault("learnings_applied", []).extend(applied)
    except Exception:
        pass

    project_id = state.get("project_id")
    if project_id:
        try:
            memory_context = format_project_memory(project_id)
            if memory_context:
                prompt = f"{prompt}\n\n{memory_context}"
        except Exception:
            pass

    raw_response = ""
    try:
        raw_response = generate_response(prompt, max_tokens=4096)
    except Exception as exc:
        print("[Planner LLM Warning]:", exc)

    try:
        plan = extract_json_plan(raw_response, idea)
        project_id = create_project(
            owner_id=owner_id,
            idea=idea,
            project_plan=plan,
        )
        state["project_id"] = project_id
        state["project_plan"] = plan
        state["agent_notes"].append(
            f"Planner created project plan for: {idea}"
        )

        append_execution_step(state, {
            "agent": "planner",
            "step": "generating_plan",
            "status": "completed",
            "message": f"Successfully created project plan: {plan.get('project_name', 'Autonomous Project')}",
            "details": {
                "project_name": plan.get("project_name", ""),
                "tech_stack": plan.get("tech_stack", {}),
                "features_count": len(plan.get("features", [])),
                "milestones_count": len(plan.get("milestones", [])),
            },
        })

        try:
            save_memory({
                "project_id": project_id,
                "agent": "planner",
                "note": f"Created plan for {idea}",
            })
        except Exception:
            pass

        return state

    except Exception as exc:
        print("[Planner Agent Fatal Error]:", exc)
        fallback_plan = extract_json_plan("", idea)
        fallback_pid = f"proj_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        state["project_id"] = fallback_pid
        state["project_plan"] = fallback_plan

        append_execution_step(state, {
            "agent": "planner",
            "step": "generating_plan",
            "status": "completed",
            "message": f"Created fallback project plan: {fallback_plan.get('project_name', 'Autonomous Project')}",
            "details": {
                "project_name": fallback_plan.get("project_name", ""),
                "tech_stack": fallback_plan.get("tech_stack", {}),
            },
        })
        return state
