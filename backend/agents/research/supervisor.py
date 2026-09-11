from datetime import datetime

from agents.research.planner import plan_research
from agents.research.researcher import conduct_research
from agents.research.reviewer import review_report
from agents.research.tools import build_research_tools
from agents.research.tools.live_search import live_multi_search
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

    timeline = [_step("Supervisor", "Autonomous research workflow initialized")]
    if session_id:
        publish_agent_event(session_id, "step", _step("Supervisor", "Autonomous research workflow initialized", "completed"), "research_sessions")

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
            step_data = _step("Supervisor", "Loaded existing research session context", "completed")
            timeline.append(step_data)
            publish_agent_event(session_id, "step", step_data, "research_sessions")

    scoped_prompt = prompt if not previous_context else f"{previous_context}\n\nNew Request:\n{prompt}"

    # Step 1: Live Multi-Engine Search & Intelligence Gathering
    if session_id:
        publish_agent_event(session_id, "step", _step("Search", "Searching live global news, web intelligence & documents...", "in_progress"), "research_sessions")
    
    live_sources = live_multi_search(prompt, research_depth)
    
    # Format live search context for LLMs
    live_context_blocks = []
    for idx, s in enumerate(live_sources[:14], 1):
        live_context_blocks.append(
            f"[{idx}] {s.get('source', 'Source')} ({s.get('published', 'Recent')}):\n"
            f"Title: {s.get('title', '')}\n"
            f"URL: {s.get('url', '')}\n"
            f"Snippet: {s.get('snippet', '')}\n"
        )
    live_context_str = "\n".join(live_context_blocks)

    step_data = _step("Search", f"Gathered {len(live_sources)} verified live sources and news signals", "completed", {"sources_count": len(live_sources)})
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    # Step 2: Intelligence Planning
    if session_id:
        publish_agent_event(session_id, "step", _step("Planner", "Creating evidence-grounded research blueprint...", "in_progress"), "research_sessions")
    plan = plan_research(scoped_prompt, live_context_str, research_depth)
    step_data = _step("Planner", "Research blueprint created", "completed", {"depth": research_depth})
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    # Step 3: Deep Research Synthesis & Evidence Grading
    if session_id:
        publish_agent_event(session_id, "step", _step("Researcher", "Synthesizing verified findings & grading evidence levels...", "in_progress"), "research_sessions")
    findings = conduct_research(scoped_prompt, plan, live_context_str, research_depth)
    step_data = _step("Researcher", "Intelligence synthesis completed with evidence grading", "completed")
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    # Step 4: Executive Report Drafting with Embedded Citations
    if session_id:
        publish_agent_event(session_id, "step", _step("Writer", "Authoring publication-grade strategic dossier...", "in_progress"), "research_sessions")
    report = write_report(scoped_prompt, plan, findings, sources_list=live_sources)
    step_data = _step("Writer", "Strategic intelligence dossier drafted", "completed")
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    # Step 5: Fact-Check & Hallucination Audit
    if session_id:
        publish_agent_event(session_id, "step", _step("Reviewer", "Auditing facts, dates, numbers & source integrity...", "in_progress"), "research_sessions")
    review = review_report(scoped_prompt, report, live_context=live_context_str)
    step_data = _step("Reviewer", "Autonomous fact & validation audit completed", "completed")
    timeline.append(step_data)
    if session_id:
        publish_agent_event(session_id, "step", step_data, "research_sessions")

    # Combine live sources with curated exploratory investigation tools
    curated_tools = build_research_tools(prompt)
    combined_sources = live_sources + curated_tools

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
        "sources": combined_sources,
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
        "sources": combined_sources,
        "timeline": timeline,
        "report_file": _report_file(session_id, report),
    }

    if session_id:
        publish_agent_event(session_id, "complete", response_data, "research_sessions")

    return response_data