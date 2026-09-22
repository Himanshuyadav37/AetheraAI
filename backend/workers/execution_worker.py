"""Dedicated Aethera execution worker.

Run separately from FastAPI:
    python -m workers.execution_worker

One worker process can consume multiple jobs sequentially. Run multiple
worker processes/containers against the same Redis consumer group to scale.
"""

import json
import logging
import os
import socket
import time
from datetime import datetime

from db.execution_service import get_execution_by_id, update_execution
from services.job_queue import (
    STREAM_NAME,
    GROUP_NAME,
    ensure_consumer_group,
    decode_job,
    ack_job,
    move_to_dead_letter,
    requeue_job,
    claim_stale_jobs,
)
from core.redis_client import get_redis_client_sync

logger = logging.getLogger("aethera.execution_worker")

WORKER_NAME = os.getenv(
    "AETHERA_WORKER_NAME",
    f"{socket.gethostname()}-{os.getpid()}",
)

VALID_SUPERVISOR_AGENTS = {
    "engineer",
    "conversational",
    "research",
    "education",
    "automation",
}


def _publish(execution_id: str, event: dict) -> None:
    try:
        from services.execution_stream import stream_manager
        stream_manager.publish(str(execution_id), event)
    except Exception:
        pass


def _mark_failed(execution_id: str, error: Exception) -> None:
    if not execution_id:
        return
    update_execution(
        execution_id,
        {
            "status": "failed",
            "debug_report": f"Worker job failed: {error}",
            "updated_at": datetime.utcnow(),
        },
    )
    _publish(
        execution_id,
        {"type": "failed", "error": str(error)},
    )


def _run_engineer(payload: dict) -> None:
    from services.project_generator import generate_project
    from agents.architect import generate_enterprise_blueprint
    from db.conversation_service import add_message
    from services.usage_tracker import UsageTracker

    execution_id = payload["execution_id"]
    user_id = payload.get("user_id", "system")
    project_id = payload.get("project_id")
    conversation_id = payload.get("conversation_id")
    idea = payload["idea"]
    mode = payload.get("mode", "generate")
    connectors = payload.get("connectors")
    parent_execution_id = payload.get("parent_execution_id")

    UsageTracker.set_context(
        user_id=user_id,
        project_id=project_id or execution_id,
        conversation_id=conversation_id,
        execution_id=execution_id,
        module="engineer",
        operation="project_generation",
        agent="coder",
    )

    result = generate_project(
        idea=idea,
        user_id=user_id,
        project_id=project_id,
        execution_id=execution_id,
        mode=mode,
        connectors=connectors,
        parent_execution_id_override=parent_execution_id,
    )

    if conversation_id:
        assistant_content = generate_enterprise_blueprint(result)
        add_message(
            conversation_id,
            "assistant",
            assistant_content,
            result=result,
        )

    _publish(
        execution_id,
        {
            "type": "complete",
            "data": {
                "execution_id": execution_id,
                "project_id": project_id,
                "status": "completed",
                "result": result,
            },
        },
    )


def _run_conversational(payload: dict) -> None:
    from agents.conversational import conversational_agent
    from services.usage_tracker import UsageTracker

    session_id = payload.get("session_id") or payload.get("conversation_id") or payload.get("execution_id")
    user_id = payload.get("user_id", "system")
    UsageTracker.set_context(
        user_id=user_id,
        conversation_id=session_id,
        execution_id=payload.get("execution_id", session_id),
        module="conversation",
        operation="chat",
        agent="conversational",
    )
    result = conversational_agent(
        payload["idea"],
        session_id,
        user_id=user_id,
        connectors=payload.get("connectors"),
    )
    _publish(session_id, {"type": "complete", "data": result})


def _run_research(payload: dict) -> None:
    from agents.research.supervisor import run_research_agent
    from services.usage_tracker import UsageTracker

    session_id = payload.get("session_id") or payload.get("conversation_id") or payload.get("execution_id")
    user_id = payload.get("user_id", "system")
    UsageTracker.set_context(
        user_id=user_id,
        conversation_id=session_id,
        execution_id=payload.get("execution_id", session_id),
        module="research",
        operation="research_report",
        agent="research_supervisor",
    )
    run_research_agent(
        prompt=payload["idea"],
        session_id=session_id,
        user_id=user_id,
        connectors=payload.get("connectors"),
    )


def _run_education(payload: dict) -> None:
    from agents.education.agent import education_agent
    from db.conversation_service import add_message
    from services.usage_tracker import UsageTracker

    session_id = payload.get("session_id") or payload.get("conversation_id") or payload.get("execution_id")
    user_id = payload.get("user_id", "system")
    UsageTracker.set_context(
        user_id=user_id,
        conversation_id=session_id,
        execution_id=payload.get("execution_id", session_id),
        module="education",
        operation="learn",
        agent="education",
    )
    result = education_agent(
        prompt=payload["idea"],
        connectors=payload.get("connectors"),
        session_id=session_id,
    )
    add_message(
        session_id,
        "assistant",
        result.get("response", ""),
        result=result,
    )
    _publish(session_id, {"type": "complete", "data": result})


def _run_automation(payload: dict) -> None:
    from bson import ObjectId
    from db.mongo_client import db
    from agents.automation.router import automation_agent
    from services.usage_tracker import UsageTracker

    session_id = payload.get("session_id") or payload.get("conversation_id") or payload.get("execution_id")
    user_id = payload.get("user_id", "system")
    UsageTracker.set_context(
        user_id=user_id,
        conversation_id=session_id,
        execution_id=payload.get("execution_id", session_id),
        module="automation",
        operation="workflow_generation",
        agent="automation",
    )
    result = automation_agent(
        prompt=payload["idea"],
        platform_override=None,
        session_id=session_id,
    )

    rich_content = (
        f"# 🤖 {result.get('title', 'Automation Workflow')}\n\n"
        f"{result.get('description', '')}\n\n"
        f"**Platform:** {result.get('platform', 'n8n')}\n"
    )
    try:
        automation_object_id = ObjectId(session_id)
    except Exception as exc:
        raise ValueError(
            "Automatic automation execution requires a valid "
            "automation conversation_id/session_id"
        ) from exc

    db["automation_conversations"].update_one(
        {"_id": automation_object_id},
        {
            "$push": {
                "messages": {
                    "role": "assistant",
                    "content": rich_content,
                    "result": result,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            },
            "$set": {"updated_at": datetime.utcnow()},
        },
    )
    _publish(
        session_id,
        {
            "type": "complete",
            "data": {
                "conversation_id": session_id,
                "content": rich_content,
                "result": result,
            },
        },
    )


def _supervisor_route(idea: str) -> dict:
    """Choose the top-level Aethera subsystem for an automatic request.

    This is intentionally a routing decision only. It does not replace any
    specialized agent or Engineer workflow.
    """
    from router.supervisor import route_request

    heuristic = route_request(idea)
    if heuristic["agent"] != "conversational":
        return heuristic

    from llm.groq_client import generate_response

    prompt = f"""
You are the top-level Aethera Supervisor.

Your ONLY responsibility is to route the user's request to exactly one
existing Aethera subsystem.

Valid routes:
- engineer: software development, coding, debugging, project generation
- conversational: general conversation, writing, everyday assistance
- research: research, investigation, source gathering, comparative analysis
- education: teaching, explanations, learning, study help
- automation: workflow, process, integration, automation design

Do not solve the user's request.
Do not invent another route.
Return ONLY valid JSON:
{{"intent":"coding","agent":"engineer","confidence":0.9,"requires_clarification":false}}

USER REQUEST:
{idea}
""".strip()

    raw = generate_response(prompt) or ""
    clean = raw.replace("```json", "").replace("```", "").strip()

    try:
        data = json.loads(clean)
        agent = str(data.get("agent", "")).strip().lower()
    except Exception:
        start = clean.find("{")
        end = clean.rfind("}")
        if start == -1 or end == -1:
            raise ValueError("Supervisor returned invalid routing JSON")
        data = json.loads(clean[start:end + 1])
        agent = str(data.get("agent", "")).strip().lower()

    if agent not in VALID_SUPERVISOR_AGENTS:
        raise ValueError(f"Supervisor returned invalid agent: {agent}")

    return {"intent": agent, "agent": agent, "confidence": 0.7, "requires_clarification": False, "task": idea, "context": {}}


def _run_supervisor(payload: dict) -> None:
    """Run the top-level Aethera Supervisor in automatic workspace mode.

    The Supervisor only selects an existing subsystem. The selected handler
    then executes using the same execution infrastructure as Manual mode.

    When the user explicitly provides requested_agent_type, that value is
    used directly (no LLM routing call) to give the user deterministic control.
    """
    execution_id = payload["execution_id"]
    idea = payload["idea"]
    user_id = payload.get("user_id", "system")
    workspace_mode = str(payload.get("workspace_mode", "")).strip().lower()
    requested_agent_type = str(payload.get("requested_agent_type") or "").strip().lower()

    if workspace_mode != "automatic":
        raise ValueError("supervisor.run requires workspace_mode='automatic'")

    if requested_agent_type and requested_agent_type in VALID_SUPERVISOR_AGENTS:
        routing_result = {"intent": requested_agent_type, "agent": requested_agent_type, "confidence": 1.0, "requires_clarification": False, "task": idea, "context": {}}
        selected_agent = requested_agent_type
        routing_note = f"User explicitly selected agent: {selected_agent}."
        used_auto_route = False
    else:
        routing_result = _supervisor_route(idea)
        selected_agent = routing_result["agent"]
        routing_note = f"Supervisor routed request to {selected_agent}."
        used_auto_route = True

    _publish(
        execution_id,
        {
            "type": "step",
            "data": {
                "agent": "supervisor",
                "step": "routing",
                "status": "completed",
                "message": routing_note,
                "timestamp": datetime.utcnow().isoformat(),
                "details": {
                    "workspace_mode": "automatic",
                    "selected_agent": selected_agent,
                    "routing": routing_result,
                    "user_requested": not used_auto_route,
                },
            },
        },
    )

    # Preserve the same execution ID so the existing SSE/execution trace
    # naturally shows Supervisor -> selected subsystem.
    routed_payload = dict(payload)
    routed_payload["agent_type"] = selected_agent

    # Existing specialized handlers expect session_id. Automatic requests may
    # not have one, so use the top-level execution id as the shared correlation
    # id. Manual payloads remain unchanged.
    if not routed_payload.get("session_id"):
        routed_payload["session_id"] = (
            routed_payload.get("conversation_id")
            or routed_payload.get("execution_id")
        )

    handler_map = {
        "engineer": _run_engineer,
        "conversational": _run_conversational,
        "research": _run_research,
        "education": _run_education,
        "automation": _run_automation,
    }

    handler = handler_map[selected_agent]
    handler(routed_payload)

    if selected_agent != "engineer":
        _publish(
            execution_id,
            {
                "type": "complete",
                "data": {
                    "execution_id": execution_id,
                    "status": "completed",
                    "agent": selected_agent,
                    "workspace_mode": "automatic",
                },
            },
        )


HANDLERS = {
    "supervisor.run": _run_supervisor,
    "engineer.generate": _run_engineer,
    "conversational.chat": _run_conversational,
    "research.run": _run_research,
    "education.run": _run_education,
    "automation.run": _run_automation,
}


def process_message(redis, message_id: str, fields: dict) -> None:
    job = decode_job(fields)
    handler = HANDLERS.get(job["job_type"])

    if not handler:
        move_to_dead_letter(
            redis,
            message_id,
            job,
            ValueError(f"Unknown job type: {job['job_type']}"),
        )
        return

    try:
        handler(job["payload"])
        ack_job(redis, message_id)
        logger.info(
            "Completed job id=%s type=%s attempt=%s",
            job["job_id"],
            job["job_type"],
            job["attempt"],
        )
    except Exception as exc:
        logger.exception(
            "Job failed id=%s type=%s attempt=%s",
            job["job_id"],
            job["job_type"],
            job["attempt"],
        )

        execution_id = job["payload"].get("execution_id")
        max_attempts = int(job.get("max_attempts", 3))
        attempt = int(job.get("attempt", 0))

        if attempt + 1 >= max_attempts:
            _mark_failed(execution_id, exc)
            move_to_dead_letter(redis, message_id, job, exc)
        else:
            ack_job(redis, message_id)
            requeue_job(redis, job, exc)


def run_forever() -> None:
    redis = get_redis_client_sync()
    ensure_consumer_group()
    logger.info(
        "Aethera worker started name=%s stream=%s group=%s",
        WORKER_NAME,
        STREAM_NAME,
        GROUP_NAME,
    )

    last_claim = 0.0

    while True:
        try:
            now = time.time()
            if now - last_claim >= 30:
                for message_id, fields in claim_stale_jobs(
                    redis,
                    WORKER_NAME,
                    min_idle_ms=120000,
                ):
                    process_message(redis, message_id, fields)
                last_claim = now

            response = redis.xreadgroup(
                groupname=GROUP_NAME,
                consumername=WORKER_NAME,
                streams={STREAM_NAME: ">"},
                count=1,
                block=5000,
            )

            if not response:
                continue

            for _, messages in response:
                for message_id, fields in messages:
                    process_message(redis, message_id, fields)

        except KeyboardInterrupt:
            logger.info("Aethera worker stopping")
            break
        except Exception:
            logger.exception("Worker loop error; retrying in 2s")
            time.sleep(2)


if __name__ == "__main__":
    run_forever()
