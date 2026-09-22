import os
import logging
import time
from datetime import datetime

from langgraph.graph import StateGraph, END
from langsmith import traceable
from langsmith.run_helpers import get_current_run_tree

from agents.router import route_after_testing, route_after_quality_gate
from agents.state import AgentState
from agents.planner import planner_agent
from agents.coder import coder_agent
from agents.tester import tester_agent
from agents.debugger import debugger_agent
from agents.deployer import deployer_agent

try:
    from agents.test_generator import test_generator_agent
    _HAS_TEST_GENERATOR = True
except Exception as _exc:
    test_generator_agent = None
    _HAS_TEST_GENERATOR = False
    print(f"[graph] test_generator not available: {_exc}")

try:
    from agents.static_analyzer import static_analyzer_agent
    _HAS_STATIC_ANALYZER = True
except Exception as _exc:
    static_analyzer_agent = None
    _HAS_STATIC_ANALYZER = False
    print(f"[graph] static_analyzer not available: {_exc}")

try:
    from agents.security_analyzer import security_analyzer_agent
    _HAS_SECURITY_ANALYZER = True
except Exception as _exc:
    security_analyzer_agent = None
    _HAS_SECURITY_ANALYZER = False
    print(f"[graph] security_analyzer not available: {_exc}")

try:
    from agents.quality_gate import quality_gate_agent
    _HAS_QUALITY_GATE = True
except Exception as _exc:
    quality_gate_agent = None
    _HAS_QUALITY_GATE = False
    print(f"[graph] quality_gate not available: {_exc}")

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

        gate = state.get("quality_gate_report") or {}
        if str(gate.get("overall", "NOT_AVAILABLE")).upper() != "PASS":
            state["execution_status"] = "FAILED"
            state["failure_reason"] = "deployer_blocked_quality_gate"
            state.setdefault("execution_steps", []).append({
                "agent": "deployer", "step": "deployment_blocked", "status": "failed",
                "message": "Deployment blocked: Quality Gate did not provide PASS evidence.",
                "timestamp": datetime.utcnow().isoformat(),
            })
            return state
        # CI is an artifact generated only after successful validation. It is
        # not a deploy job and never contains credentials/secrets.
        try:
            from services.ci_cd_generator import ci_yaml_exists, generate_ci_workflow
            files = state.get("fixed_code") or state.get("generated_code") or []
            if not ci_yaml_exists(files):
                stack = ((state.get("test_results") or {}).get("execution") or {}).get("stack", [])
                ci_file = generate_ci_workflow(stack, files)
                state.setdefault("generated_ci_files", []).append(ci_file)
                state["fixed_code"] = list(files) + [ci_file]
                state["generated_code"] = list(files) + [ci_file]
                project_path = state.get("project_path")
                if project_path:
                    from services.workspace_manager import workspace_manager
                    workspace_manager.write_files(project_path, [ci_file])
                state.setdefault("execution_steps", []).append({
                    "agent": "ci_cd", "step": "generate_workflow", "status": "completed",
                    "message": "Generated validated CI workflow after Quality Gate PASS.",
                    "timestamp": datetime.utcnow().isoformat(),
                })
        except Exception as exc:
            state.setdefault("execution_steps", []).append({
                "agent": "ci_cd", "step": "generate_workflow", "status": "failed",
                "message": f"CI workflow generation unavailable: {exc}",
                "timestamp": datetime.utcnow().isoformat(),
            })
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
                    status="failed" if res.get("execution_status") == "FAILED" else "completed",
                    completed_at=datetime.utcnow()
                )
            except Exception as e:
                logger.error(
                    f"Failed to mark task {task_id} as completed in PG: {e}"
                )

        return res


def _make_safe_pass_through(name, fn):
    """Wrap a new optional agent so if it raises, return state unchanged (no crash)."""
    def _wrapped(state):
        try:
            return fn(state) or state
        except Exception as exc:
            logger.warning(f"[{name}] skipped (stage failed gracefully): {exc}")
            state.setdefault("execution_steps", [])
            state["execution_steps"].append({
                "agent": name,
                "step": "run",
                "status": "not_available",
                "message": f"{name} stage not available: {exc}",
                "timestamp": datetime.utcnow().isoformat(),
            })
            return state
    return _wrapped


@traceable(run_type="chain", name="test_generator_agent")
def traced_test_generator_agent(state):
    with log_agent_run("test_generator", state):
        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt:
                    rt.add_tags(["agent_name", "test_generator"])
                    rt.add_metadata({
                        "agent_name": "test_generator",
                        "task_id": state.get("execution_id"),
                        "project_id": state.get("project_id"),
                        "user_id": state.get("user_id"),
                    })
        except Exception as e:
            logger.warning(f"Failed to add LangSmith run tree metadata: {e}")
        if not _HAS_TEST_GENERATOR:
            logger.warning("[test_generator] module not loaded; skipping stage.")
            state.setdefault("generated_tests", [])
            return state
        safe_fn = _make_safe_pass_through("test_generator", test_generator_agent)
        return _run_observed_agent("test_generator", safe_fn, state)


@traceable(run_type="chain", name="static_analyzer_agent")
def traced_static_analyzer_agent(state):
    with log_agent_run("static_analyzer", state):
        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt:
                    rt.add_tags(["agent_name", "static_analyzer"])
                    rt.add_metadata({
                        "agent_name": "static_analyzer",
                        "task_id": state.get("execution_id"),
                        "project_id": state.get("project_id"),
                        "user_id": state.get("user_id"),
                    })
        except Exception as e:
            logger.warning(f"Failed to add LangSmith run tree metadata: {e}")
        if not _HAS_STATIC_ANALYZER:
            logger.warning("[static_analyzer] module not loaded; skipping stage.")
            state.setdefault("static_analysis_results", {"summary": {"total": 0, "status": "not_available"}, "findings": []})
            return state
        safe_fn = _make_safe_pass_through("static_analyzer", static_analyzer_agent)
        return _run_observed_agent("static_analyzer", safe_fn, state)


@traceable(run_type="chain", name="security_analyzer_agent")
def traced_security_analyzer_agent(state):
    with log_agent_run("security_analyzer", state):
        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt:
                    rt.add_tags(["agent_name", "security_analyzer"])
                    rt.add_metadata({
                        "agent_name": "security_analyzer",
                        "task_id": state.get("execution_id"),
                        "project_id": state.get("project_id"),
                        "user_id": state.get("user_id"),
                    })
        except Exception as e:
            logger.warning(f"Failed to add LangSmith run tree metadata: {e}")
        if not _HAS_SECURITY_ANALYZER:
            logger.warning("[security_analyzer] module not loaded; skipping stage.")
            state.setdefault("security_analysis_results", {"summary": {"total": 0, "status": "not_available"}, "findings": [], "redaction_log_ref": "see_authorized_endpoint"})
            return state
        safe_fn = _make_safe_pass_through("security_analyzer", security_analyzer_agent)
        return _run_observed_agent("security_analyzer", safe_fn, state)


@traceable(run_type="chain", name="quality_gate_agent")
def traced_quality_gate_agent(state):
    with log_agent_run("quality_gate", state):
        try:
            if os.environ.get("LANGCHAIN_TRACING_V2") == "true":
                rt = get_current_run_tree()
                if rt:
                    rt.add_tags(["agent_name", "quality_gate"])
                    rt.add_metadata({
                        "agent_name": "quality_gate",
                        "task_id": state.get("execution_id"),
                        "project_id": state.get("project_id"),
                        "user_id": state.get("user_id"),
                    })
        except Exception as e:
            logger.warning(f"Failed to add LangSmith run tree metadata: {e}")
        if not _HAS_QUALITY_GATE:
            logger.error("[quality_gate] module not loaded; blocking deployment.")
            state["quality_gate_report"] = {"overall": "NOT_AVAILABLE", "checks": {}, "error": "quality_gate module not loaded", "timestamp": datetime.utcnow().isoformat() + "Z"}
            return state
        # quality_gate_agent converts its own failures to NOT_AVAILABLE.  Do
        # not use the optional-stage pass-through wrapper here: it would leave
        # a stale PASS report in state if an unexpected exception escaped.
        return _run_observed_agent("quality_gate", quality_gate_agent, state)


# Workflow Setup
workflow = StateGraph(AgentState)

workflow.add_node("planner", traced_planner_agent)
workflow.add_node("coder", traced_coder_agent)
workflow.add_node("test_generator", traced_test_generator_agent)
workflow.add_node("static_analyzer", traced_static_analyzer_agent)
workflow.add_node("security_analyzer", traced_security_analyzer_agent)
workflow.add_node("tester", traced_tester_agent)
workflow.add_node("debugger", traced_debugger_agent)
workflow.add_node("quality_gate", traced_quality_gate_agent)
workflow.add_node("deployer", traced_deployer_agent)

def failed_execution(state):
    state["execution_status"] = "FAILED"
    state.setdefault("execution_steps", []).append({
        "agent": "system", "step": "execution_failed", "status": "failed",
        "message": f"Execution failed safely: {state.get('failure_reason', 'quality gate did not pass')}",
        "timestamp": datetime.utcnow().isoformat(),
    })
    return state

workflow.add_node("failed", failed_execution)

workflow.set_entry_point("planner")

workflow.add_edge("planner", "coder")
workflow.add_edge("coder", "test_generator")
workflow.add_edge("test_generator", "static_analyzer")
workflow.add_edge("static_analyzer", "security_analyzer")
workflow.add_edge("security_analyzer", "tester")

workflow.add_conditional_edges(
    "tester",
    route_after_testing,
    {
        "debugger": "debugger",
        "quality_gate": "quality_gate",
        "failed": "failed",
    }
)

workflow.add_edge("debugger", "tester")

workflow.add_conditional_edges(
    "quality_gate",
    route_after_quality_gate,
    {
        "debugger": "debugger",
        "deployer": "deployer",
        "failed": "failed",
    }
)

workflow.add_edge("deployer", END)
workflow.add_edge("failed", END)

graph = workflow.compile()


# =========================================================
# Isolated Execution Replay
# =========================================================

REPLAY_NODES = {
    "planner": traced_planner_agent,
    "coder": traced_coder_agent,
    "test_generator": traced_test_generator_agent,
    "static_analyzer": traced_static_analyzer_agent,
    "security_analyzer": traced_security_analyzer_agent,
    "tester": traced_tester_agent,
    "debugger": traced_debugger_agent,
    "quality_gate": traced_quality_gate_agent,
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
        "test_generator": "test_generator",
        "generate_tests": "test_generator",
        "generate_tests_agent": "test_generator",
        "test_gen": "test_generator",
        "static_analyzer": "static_analyzer",
        "lint": "static_analyzer",
        "static": "static_analyzer",
        "ruff": "static_analyzer",
        "eslint": "static_analyzer",
        "typecheck": "static_analyzer",
        "security_analyzer": "security_analyzer",
        "security": "security_analyzer",
        "audit": "security_analyzer",
        "secrets": "security_analyzer",
        "quality_gate": "quality_gate",
        "gate": "quality_gate",
        "quality": "quality_gate",
        "qualitygate": "quality_gate",
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
