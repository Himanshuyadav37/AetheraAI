from datetime import datetime

from agents.research.planner import plan_research
from agents.research.researcher import conduct_research
from agents.research.reviewer import review_report
from agents.research.tools import build_research_tools
from agents.research.writer import write_report
from db.research_service import (
    append_research_message,
    create_research_session,
    get_research_session,
    update_research_session,
)


def _step(agent: str, message: str, status: str = "completed", details: dict | None = None):
    return {
        "agent": agent,
        "message": message,
        "status": status,
        "details": details or {},
        "timestamp": datetime.utcnow().isoformat(),
    }


def _report_file(session_id: str, report: str):
    return {
        "name": f"research-report-{session_id}.md",
        "content": report,
        "mime_type": "text/markdown",
    }


def run_research_agent(
    prompt: str,
    session_id: str | None = None,
    user_id: str = "system",
    research_depth: str = "normal",
    connectors: dict | None = None,
):
    from services.execution_stream import publish_agent_event

    timeline = [_step("Supervisor", "Research workflow started")]
    if session_id:
        publish_agent_event(session_id, "step", _step("Supervisor", "Research workflow started", "completed"), "research_sessions")

    previous_context = ""
    if session_id:
        previous = get_research_session(session_id)
        if previous:
            previous_context = f"""
Previous Prompt:
{previous.get('prompt', '')}

Previous Report:
{previous.get('report', '')[:4000]}
"""
            append_research_message(session_id, "user", prompt)
            step_data = _step("Supervisor", "Continuing existing research session", "completed")
            timeline.append(step_data)
            publish_agent_event(session_id, "step", step_data, "research_sessions")

    scoped_prompt = prompt if not previous_context else f"{previous_context}\n\nNew Request:\n{prompt}"

    if session_id:
        publish_agent_event(session_id, "step", _step("Planner", "Creating research plan...", "in_progress"), "research_sessions")
    plan = plan_research(scoped_prompt, research_depth)
    step_data = _step("Planner", "Research plan created", "completed", {"depth": research_depth})
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    if session_id:
        publish_agent_event(session_id, "step", _step("Researcher", "Conducting deep research & scanning RAG context...", "in_progress"), "research_sessions")
    findings = conduct_research(scoped_prompt, plan, research_depth)
    step_data = _step("Researcher", "Research findings generated", "completed")
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    if session_id:
        publish_agent_event(session_id, "step", _step("Writer", "Drafting research report...", "in_progress"), "research_sessions")
    report = write_report(scoped_prompt, plan, findings)
    step_data = _step("Writer", "Research report drafted", "completed")
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    if session_id:
        publish_agent_event(session_id, "step", _step("Reviewer", "Reviewing report quality...", "in_progress"), "research_sessions")
    review = review_report(scoped_prompt, report)
    step_data = _step("Reviewer", "Report quality review completed", "completed")
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    if session_id:
        publish_agent_event(session_id, "step", _step("Tools", "Preparing research sources & files...", "in_progress"), "research_sessions")
    sources = build_research_tools(prompt)
    step_data = _step("Tools", "Research tools prepared", "completed", {"tools": len(sources)})
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    payload = {
        "user_id": user_id,
        "title": prompt[:80],
        "prompt": prompt,
        "research_depth": research_depth,
        "status": "completed",
        "plan": plan,
        "findings": findings,
        "report": report,
        "review": review,
        "sources": sources,
        "timeline": timeline,
    }

    if session_id and get_research_session(session_id):
        update_research_session(session_id, payload)
        append_research_message(session_id, "assistant", report)
    else:
        payload["messages"] = [
            {"role": "user", "content": prompt, "timestamp": datetime.utcnow()},
            {"role": "assistant", "content": report, "timestamp": datetime.utcnow()},
        ]
        session_id = create_research_session(payload)

    response_data = {
        "agent": "research",
        "research_session_id": session_id,
        "conversation_id": session_id,
        "status": "completed",
        "message": report,
        "plan": plan,
        "findings": findings,
        "report": report,
        "review": review,
        "sources": sources,
        "timeline": timeline,
        "report_file": _report_file(session_id, report),
    }

    if session_id:
        # Publish complete event
        publish_agent_event(session_id, "complete", response_data, "research_sessions")

    return response_data