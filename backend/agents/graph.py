import os
import logging
import time
from datetime import datetime

from langgraph.graph import StateGraph, END
from langsmith import traceable
from langsmith.run_helpers import get_current_run_tree

from agents.router import route_after_testing
from agents.state import AgentState
from agents.planner import planner_agent
from agents.coder import coder_agent
from agents.tester import tester_agent
from agents.debugger import debugger_agent
from agents.deployer import deployer_agent
from db.postgres_logger import log_agent_run
from db.execution_service import append_execution_step
from services.usage_tracker import UsageTracker

logger = logging.getLogger(__name__)


def _is_transient_error(exc):
    """
    Return True only for errors that are reasonably safe to retry.

    Code/test/validation failures are intentionally excluded because those
    belong to the existing Tester -> Debugger recovery loop.
    """
    transient_types = (
        TimeoutError,
        ConnectionError,
    )

    if isinstance(exc, transient_types):
        return True

    error_type = type(exc).__name__.lower()
    error_message = str(exc).lower()

    transient_type_names = (
        "timeouterror",
        "timeoutexception",
        "connecterror",
        "connectionerror",
        "connectionreseterror",
        "connectionabortederror",
        "temporarilyunavailable",
        "ratelimiterror",
        "serviceunavailable",
        "badgateway",
        "gatewaytimeout",
    )

    if any(name in error_type for name in transient_type_names):
        return True

    transient_message_tokens = (
        "rate limit",
        "rate_limit",
        "too many requests",
        "temporarily unavailable",
        "service unavailable",
        "connection reset",
        "connection aborted",
        "connection refused",
        "connection timeout",
        "read timeout",
        "connect timeout",
        "gateway timeout",
        "bad gateway",
        "503",
        "502",
        "504",
        "429",
    )

    return any(token in error_message for token in transient_message_tokens)


def _append_retry_step(execution_id, state, agent_name, retry_number, max_retries, exc, delay):
    """Persist a structured retry event without interrupting the retry path."""
    step = {
        "agent": agent_name,
        "step": "retry",
        "status": "retrying",
        "message": (
            f"{agent_name} transient failure; "
            f"retry {retry_number}/{max_retries}"
        ),
        "timestamp": datetime.utcnow().isoformat(),
        "retry_number": retry_number,
        "max_retries": max_retries,
        "error_type": type(exc).__name__,
        "error_message": str(exc),
        "retry_delay_seconds": delay,
        "details": {
            "execution_id": execution_id,
            "project_id": state.get("project_id"),
        },
    }

    if execution_id:
        try:
            append_execution_step(execution_id, step)
        except Exception as stream_error:
            logger.warning(
                f"Failed to persist retry step for {agent_name}: "
                f"{stream_error}"
            )

    state.setdefault("execution_steps", [])
    state["execution_steps"].append(step)


def _run_observed_agent(agent_name, agent_fn, state):
    """
    Execute one Engineer agent with structured observability and bounded
    transient-error recovery.

    Important separation:
    - transient infrastructure/API failures may be retried;
    - deterministic code/test/validation failures are NOT retried here;
    - Tester FAIL continues through the existing Tester -> Debugger loop.
    """
    execution_id = state.get("execution_id")
    started_at = datetime.utcnow()
    started_perf = time.perf_counter()

    max_retries = 2
    retry_number = 0

    previous_steps = state.get("execution_steps", []) or []
    prior_agent_attempts = sum(
        1
        for step in previous_steps
        if isinstance(step, dict)
        and step.get("agent") == agent_name
        and step.get("step") in ("observability", "retry")
    )

    while True:
        try:
            # Budget enforcement is deliberately outside the provider client so every
            # Engineer node (including replay/retry) shares the same execution guard.
            UsageTracker.enforce_budget(
                execution_id=state.get("execution_id"),
                project_id=state.get("project_id"),
                user_id=state.get("user_id"),
            )
            result = agent_fn(state)

            completed_at = datetime.utcnow()
            duration_ms = round(
                (time.perf_counter() - started_perf) * 1000,
                2,
            )

            observability_step = {
                "agent": agent_name,
                "step": "observability",
                "status": "completed",
                "message": f"{agent_name} completed",
                "timestamp": completed_at.isoformat(),
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_ms": duration_ms,
                "retry_count": retry_number,
                "attempt": retry_number + 1,
                "error_type": None,
                "error_message": None,
                "details": {
                    "execution_id": execution_id,
                    "project_id": state.get("project_id"),
                    "max_retries": max_retries,
                    "prior_agent_attempts": prior_agent_attempts,
                },
            }

            if execution_id:
                try:
                    append_execution_step(
                        execution_id,
                        observability_step,
                    )
                except Exception as stream_error:
                    logger.warning(
                        f"Failed to persist observability step for "
                        f"{agent_name}: {stream_error}"
                    )

            if isinstance(result, dict):
                result.setdefault("execution_steps", [])
                result["execution_steps"].append(observability_step)

            return result

        except Exception as exc:
            if _is_transient_error(exc) and retry_number < max_retries:
                retry_number += 1

                # 1s, 2s bounded exponential backoff.
                delay = min(2 ** (retry_number - 1), 5)

                logger.warning(
                    f"[Retry] {agent_name} failed with transient "
                    f"{type(exc).__name__}: {exc}. "
                    f"Retrying {retry_number}/{max_retries} "
                    f"after {delay}s."
                )

                _append_retry_step(
                    execution_id=execution_id,
                    state=state,
                    agent_name=agent_name,
                    retry_number=retry_number,
                    max_retries=max_retries,
                    exc=exc,
                    delay=delay,
                )

                time.sleep(delay)
                continue

            completed_at = datetime.utcnow()
            duration_ms = round(
                (time.perf_counter() - started_perf) * 1000,
                2,
            )

            failure_step = {
                "agent": agent_name,
                "step": "observability",
                "status": "failed",
                "message": f"{agent_name} failed",
                "timestamp": completed_at.isoformat(),
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_ms": duration_ms,
                "retry_count": retry_number,
                "attempt": retry_number + 1,
                "error_type": type(exc).__name__,
                "error_message": str(exc),
                "details": {
                    "execution_id": execution_id,
                    "project_id": state.get("project_id"),
                    "max_retries": max_retries,
                    "retry_exhausted": (
                        _is_transient_error(exc)
                        and retry_number >= max_retries
                    ),
                },
            }

            if execution_id:
                try:
                    append_execution_step(
                        execution_id,
                        failure_step,
                    )
                except Exception as stream_error:
                    logger.warning(
                        f"Failed to persist failure step for "
                        f"{agent_name}: {stream_error}"
                    )

            state.setdefault("execution_steps", [])
            state["execution_steps"].append(failure_step)

            raise


# Wrapped Traced and PostgreSQL Logged Agent Nodes
@traceable(run_type="chain", name="planner_agent")
def traced_planner_agent(state):
    with log_agent_run("planner", state):
        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt:
                    rt.add_tags(["agent_name", "planner"])
                    rt.add_metadata({
                        "agent_name": "planner",
                        "task_id": state.get("execution_id"),
                        "project_id": state.get("project_id"),
                        "user_id": state.get("user_id")
                    })
        except Exception as e:
            logger.warning(f"Failed to add LangSmith run tree metadata: {e}")

        res = _run_observed_agent(
            "planner",
            planner_agent,
            state,
        )

        project_id = res.get("project_id")
        task_id = res.get("execution_id")
        if task_id and project_id:
            try:
                from db.postgres import update_task_pg_sync
                update_task_pg_sync(task_id, project_id=project_id)
            except Exception as e:
                logger.error(
                    f"Failed to associate project_id {project_id} "
                    f"to task {task_id}: {e}"
                )

        return res


@traceable(run_type="chain", name="coder_agent")
def traced_coder_agent(state):
    with log_agent_run("coder", state):
        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt:
                    rt.add_tags(["agent_name", "coder"])
                    rt.add_metadata({
                        "agent_name": "coder",
                        "task_id": state.get("execution_id"),
                        "project_id": state.get("project_id"),
                        "user_id": state.get("user_id")
                    })
        except Exception as e:
            logger.warning(f"Failed to add LangSmith run tree metadata: {e}")

        return _run_observed_agent(
            "coder",
            coder_agent,
            state,
        )


@traceable(run_type="chain", name="tester_agent")
def traced_tester_agent(state):
    with log_agent_run("tester", state):
        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt:
                    rt.add_tags(["agent_name", "tester"])
                    rt.add_metadata({
                        "agent_name": "tester",
                        "task_id": state.get("execution_id"),
                        "project_id": state.get("project_id"),
                        "user_id": state.get("user_id")
                    })
        except Exception as e:
            logger.warning(f"Failed to add LangSmith run tree metadata: {e}")

        res = _run_observed_agent(
            "tester",
            tester_agent,
            state,
        )

        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt and rt.parent_run:
                    from langsmith import Client
                    client = Client()
                    passed = (
                        res.get("test_results", {}).get("status")
                        == "PASS"
                    )
                    client.create_feedback(
                        run_id=rt.parent_run.id,
                        key="tester_pass",
                        score=1.0 if passed else 0.0,
                        comment=(
                            "Tester node completed with status: "
                            f"{res.get('test_results', {}).get('status', 'FAIL')}"
                        )
                    )
        except Exception as e:
            logger.warning(
                f"Failed to send feedback score to LangSmith: {e}"
            )

        return res


@traceable(run_type="chain", name="debugger_agent")
def traced_debugger_agent(state):
    with log_agent_run("debugger", state):
        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt:
                    rt.add_tags(["agent_name", "debugger"])
                    rt.add_metadata({
                        "agent_name": "debugger",
                        "task_id": state.get("execution_id"),
                        "project_id": state.get("project_id"),
                        "user_id": state.get("user_id")
                    })
        except Exception as e:
            logger.warning(f"Failed to add LangSmith run tree metadata: {e}")

        return _run_observed_agent(
            "debugger",
            debugger_agent,
            state,
        )


@traceable(run_type="chain", name="deployer_agent")
def traced_deployer_agent(state):
    with log_agent_run("deployer", state):
        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt:
                    rt.add_tags(["agent_name", "deployer"])
                    rt.add_metadata({
                        "agent_name": "deployer",
                        "task_id": state.get("execution_id"),
                        "project_id": state.get("project_id"),
                        "user_id": state.get("user_id")
                    })
        except Exception as e:
            logger.warning(f"Failed to add LangSmith run tree metadata: {e}")

        res = _run_observed_agent(
            "deployer",
            deployer_agent,
            state,
        )

        task_id = res.get("execution_id")
        if task_id:
            try:
                from db.postgres import update_task_pg_sync
                update_task_pg_sync(
                    task_id,
                    status="completed",
                    completed_at=datetime.utcnow()
                )
            except Exception as e:
                logger.error(
                    f"Failed to mark task {task_id} as completed in PG: {e}"
                )

        return res


# Workflow Setup
workflow = StateGraph(AgentState)

workflow.add_node("planner", traced_planner_agent)
workflow.add_node("coder", traced_coder_agent)
workflow.add_node("tester", traced_tester_agent)
workflow.add_node("debugger", traced_debugger_agent)
workflow.add_node("deployer", traced_deployer_agent)

workflow.set_entry_point("planner")

workflow.add_edge("planner", "coder")
workflow.add_edge("coder", "tester")

workflow.add_conditional_edges(
    "tester",
    route_after_testing,
    {
        "debugger": "debugger",
        "end": "deployer"
    }
)

workflow.add_edge("debugger", "tester")
workflow.add_edge("deployer", END)

graph = workflow.compile()


# =========================================================
# Isolated Execution Replay
# =========================================================

REPLAY_NODES = {
    "planner": traced_planner_agent,
    "coder": traced_coder_agent,
    "tester": traced_tester_agent,
    "debugger": traced_debugger_agent,
    "deployer": traced_deployer_agent,
}


def replay_agent_step(state: AgentState, step_name: str):
    """
    Execute exactly one Engineer agent node for Execution Replay.

    The normal compiled graph is unchanged. Replay callers invoke this
    function directly against a newly-created child execution state.
    """
    normalized_step = str(step_name or "").strip().lower()

    aliases = {
        "plan": "planner",
        "planning": "planner",
        "code": "coder",
        "coding": "coder",
        "test": "tester",
        "testing": "tester",
        "debug": "debugger",
        "fix": "debugger",
        "fixing": "debugger",
        "generating_fixes": "debugger",
        "analyzing_issues": "debugger",
        "deploy": "deployer",
        "deployment": "deployer",
    }

    normalized_step = aliases.get(
        normalized_step,
        normalized_step,
    )

    node = REPLAY_NODES.get(normalized_step)

    if not node:
        raise ValueError(
            f"Unsupported replay step: {step_name}"
        )

    return node(state)
