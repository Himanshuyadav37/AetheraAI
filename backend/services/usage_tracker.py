"""
AetheraAI usage, token, latency and cost observability.

This module is intentionally independent from the LLM client. Agent modules set
context before making provider calls, while the LLM client records actual usage.

Mongo collection:
    db.mongo_client.llm_usage_collection
"""

import contextvars
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, ClassVar

import tiktoken

from db.mongo_client import llm_usage_collection


class UsageTracker:
    """Central usage/cost tracker for LLM calls and execution-level reporting."""

    # Budget limits are disabled when set to 0. Values are USD.
    DEFAULT_EXECUTION_BUDGET_USD = 5.0
    DEFAULT_PROJECT_BUDGET_USD = 25.0
    DEFAULT_USER_DAILY_BUDGET_USD = 50.0

    class BudgetExceededError(RuntimeError):
        """Raised when a configured Aethera usage budget has been exhausted."""

        def __init__(self, message: str, status: Optional[Dict[str, Any]] = None):
            super().__init__(message)
            self.status = status or {}

    # Request/execution context. ContextVars are safe for async FastAPI workloads.
    ctx_user_id = contextvars.ContextVar("usage_user_id", default=None)
    ctx_module = contextvars.ContextVar("usage_module", default=None)
    ctx_operation = contextvars.ContextVar("usage_operation", default=None)
    ctx_agent = contextvars.ContextVar("usage_agent", default=None)
    ctx_project_id = contextvars.ContextVar("usage_project_id", default=None)
    ctx_conversation_id = contextvars.ContextVar(
        "usage_conversation_id", default=None
    )
    ctx_execution_id = contextvars.ContextVar(
        "usage_execution_id", default=None
    )

    @classmethod
    def set_context(
        cls,
        user_id: Optional[str] = None,
        module: Optional[str] = None,
        operation: Optional[str] = None,
        agent: Optional[str] = None,
        project_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        execution_id: Optional[str] = None,
    ):
        """Set request/agent context used by subsequent usage records."""
        if user_id is not None:
            cls.ctx_user_id.set(user_id)
        if module is not None:
            cls.ctx_module.set(module)
        if operation is not None:
            cls.ctx_operation.set(operation)
        if agent is not None:
            cls.ctx_agent.set(agent)
        if project_id is not None:
            cls.ctx_project_id.set(project_id)
        if conversation_id is not None:
            cls.ctx_conversation_id.set(conversation_id)
        if execution_id is not None:
            cls.ctx_execution_id.set(execution_id)

    @classmethod
    def clear_context(cls):
        """Clear the current context after a request if explicitly needed."""
        cls.ctx_user_id.set(None)
        cls.ctx_module.set(None)
        cls.ctx_operation.set(None)
        cls.ctx_agent.set(None)
        cls.ctx_project_id.set(None)
        cls.ctx_conversation_id.set(None)
        cls.ctx_execution_id.set(None)

    @staticmethod
    def count_tokens_fallback(text: Any, model: str = "cl100k_base") -> int:
        """Count tokens with tiktoken, falling back to a conservative estimate."""
        if text is None:
            return 0

        if not isinstance(text, str):
            text = str(text)

        if not text:
            return 0

        try:
            encoding = tiktoken.get_encoding(model)
            return len(encoding.encode(text))
        except Exception:
            # Approximation only when tokenizer lookup fails.
            return max(1, len(text) // 4)

    @staticmethod
    def _usage_value(usage: Any, *names: str) -> int:
        for name in names:
            try:
                if isinstance(usage, dict):
                    value = usage.get(name)
                else:
                    value = getattr(usage, name, None)
                if value is not None:
                    return int(value or 0)
            except (TypeError, ValueError):
                continue
        return 0

    @classmethod
    def extract_usage_from_completion(cls, completion: Any) -> Dict[str, int]:
        """Extract provider usage from OpenAI/Groq-compatible responses."""
        usage = None

        if completion is not None:
            try:
                usage = getattr(completion, "usage", None)
            except Exception:
                usage = None

            if usage is None and isinstance(completion, dict):
                usage = completion.get("usage")

        if usage is None:
            return {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
            }

        input_tokens = cls._usage_value(
            usage,
            "prompt_tokens",
            "input_tokens",
        )
        output_tokens = cls._usage_value(
            usage,
            "completion_tokens",
            "output_tokens",
        )
        total_tokens = cls._usage_value(usage, "total_tokens")

        if total_tokens <= 0:
            total_tokens = input_tokens + output_tokens

        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
        }

    @staticmethod
    def _pricing_env_key(provider: str, model: str, direction: str) -> str:
        provider_key = re.sub(
            r"[^A-Za-z0-9]+", "_", str(provider or "")
        ).strip("_").upper()

        model_key = re.sub(
            r"[^A-Za-z0-9]+", "_", str(model or "")
        ).strip("_").upper()

        direction_key = direction.upper()

        return (
            f"AETHERA_{provider_key}_{model_key}_"
            f"{direction_key}_USD_PER_1M"
        )

    @classmethod
    def get_model_pricing(
        cls,
        provider: str,
        model: str,
    ) -> tuple[float, float]:
        """
        Return (input_usd_per_1m, output_usd_per_1m).

        Unknown prices intentionally resolve to 0.0 rather than inventing
        provider pricing. Configure them through environment variables.
        """
        input_key = cls._pricing_env_key(provider, model, "INPUT")
        output_key = cls._pricing_env_key(provider, model, "OUTPUT")

        try:
            input_price = float(os.getenv(input_key, "0") or 0)
        except (TypeError, ValueError):
            input_price = 0.0

        try:
            output_price = float(os.getenv(output_key, "0") or 0)
        except (TypeError, ValueError):
            output_price = 0.0

        return input_price, output_price

    @classmethod
    def calculate_cost(
        cls,
        input_tokens: int,
        output_tokens: int,
        provider: str,
        model: str,
    ) -> float:
        """Calculate estimated USD cost from configured per-million prices."""
        input_price, output_price = cls.get_model_pricing(
            provider,
            model,
        )

        return round(
            (int(input_tokens or 0) / 1_000_000) * input_price
            + (int(output_tokens or 0) / 1_000_000) * output_price,
            10,
        )

    @classmethod
    def record_usage(
        cls,
        input_tokens: int = 0,
        output_tokens: int = 0,
        total_tokens: Optional[int] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        user_id: Optional[str] = None,
        module: Optional[str] = None,
        operation: Optional[str] = None,
        agent: Optional[str] = None,
        project_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        execution_id: Optional[str] = None,
        latency_ms: Optional[float] = None,
        estimated_cost_usd: Optional[float] = None,
        request_id: Optional[str] = None,
        success: Optional[bool] = None,
        error_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Persist one LLM usage event.

        Explicit arguments take precedence; otherwise context values are used.
        """
        input_tokens = int(input_tokens or 0)
        output_tokens = int(output_tokens or 0)

        if total_tokens is None:
            total_tokens = input_tokens + output_tokens
        else:
            total_tokens = int(total_tokens or 0)

        user_id = user_id if user_id is not None else cls.ctx_user_id.get()
        module = module if module is not None else cls.ctx_module.get()
        operation = (
            operation if operation is not None else cls.ctx_operation.get()
        )
        agent = agent if agent is not None else cls.ctx_agent.get()
        project_id = (
            project_id if project_id is not None else cls.ctx_project_id.get()
        )
        conversation_id = (
            conversation_id
            if conversation_id is not None
            else cls.ctx_conversation_id.get()
        )
        execution_id = (
            execution_id
            if execution_id is not None
            else cls.ctx_execution_id.get()
        )

        if estimated_cost_usd is None and provider and model:
            estimated_cost_usd = cls.calculate_cost(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                provider=provider,
                model=model,
            )

        document = {
            "user_id": user_id,
            "module": module,
            "operation": operation,
            "agent": agent,
            "project_id": project_id,
            "conversation_id": conversation_id,
            "execution_id": execution_id,
            "provider": provider,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "latency_ms": (
                float(latency_ms) if latency_ms is not None else None
            ),
            "estimated_cost_usd": float(estimated_cost_usd or 0.0),
            "request_id": request_id,
            "success": success,
            "error_type": error_type,
            "metadata": metadata or {},
            "created_at": datetime.utcnow(),
        }

        # Preserve extra provider-specific fields without overwriting
        # canonical fields.
        for key, value in kwargs.items():
            if key not in document:
                document[key] = value

        try:
            result = llm_usage_collection.insert_one(document)
            document["_id"] = getattr(result, "inserted_id", None)
        except Exception as exc:
            # Usage tracking must never break the actual LLM request.
            print(f"[UsageTracker] Failed to record usage: {exc}")

        return document

    @classmethod
    def _aggregate(cls, logs) -> Dict[str, Any]:
        logs = list(logs)

        return {
            "input_tokens": sum(
                int(x.get("input_tokens", 0) or 0) for x in logs
            ),
            "output_tokens": sum(
                int(x.get("output_tokens", 0) or 0) for x in logs
            ),
            "total_tokens": sum(
                int(x.get("total_tokens", 0) or 0) for x in logs
            ),
            "estimated_cost_usd": round(
                sum(
                    float(x.get("estimated_cost_usd", 0) or 0)
                    for x in logs
                ),
                10,
            ),
            "latency_ms": round(
                sum(
                    float(x.get("latency_ms", 0) or 0)
                    for x in logs
                ),
                2,
            ),
            "calls": len(logs),
        }

    @classmethod
    def _env_budget(cls, name: str, default: float) -> float:
        try:
            value = float(os.getenv(name, str(default)) or 0)
            return max(0.0, value)
        except (TypeError, ValueError):
            return max(0.0, default)

    @classmethod
    def get_budget_limits(cls) -> Dict[str, float]:
        return {
            "execution_usd": cls._env_budget(
                "AETHERA_EXECUTION_BUDGET_USD", cls.DEFAULT_EXECUTION_BUDGET_USD
            ),
            "project_usd": cls._env_budget(
                "AETHERA_PROJECT_BUDGET_USD", cls.DEFAULT_PROJECT_BUDGET_USD
            ),
            "user_daily_usd": cls._env_budget(
                "AETHERA_USER_DAILY_BUDGET_USD", cls.DEFAULT_USER_DAILY_BUDGET_USD
            ),
        }

    @classmethod
    def get_budget_status(
        cls,
        execution_id: Optional[str] = None,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        limits = cls.get_budget_limits()
        execution_cost = (
            cls.get_execution_usage(execution_id).get("estimated_cost_usd", 0.0)
            if execution_id else 0.0
        )
        project_cost = (
            cls.get_project_usage(project_id).get("estimated_cost_usd", 0.0)
            if project_id else 0.0
        )
        user_cost = (
            cls.get_user_usage(user_id, days=1).get("estimated_cost_usd", 0.0)
            if user_id else 0.0
        )

        def pack(spent: float, limit: float) -> Dict[str, Any]:
            enabled = limit > 0
            remaining = max(0.0, limit - spent) if enabled else None
            return {
                "enabled": enabled,
                "limit_usd": limit if enabled else None,
                "spent_usd": round(spent, 10),
                "remaining_usd": round(remaining, 10) if remaining is not None else None,
                "exceeded": bool(enabled and spent >= limit),
                "percent_used": round((spent / limit) * 100, 2) if enabled else 0.0,
            }

        return {
            "execution": pack(execution_cost, limits["execution_usd"]),
            "project": pack(project_cost, limits["project_usd"]),
            "user_daily": pack(user_cost, limits["user_daily_usd"]),
        }

    @classmethod
    def enforce_budget(
        cls,
        execution_id: Optional[str] = None,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fail closed before another paid provider call when a budget is exhausted."""
        status = cls.get_budget_status(
            execution_id=execution_id,
            project_id=project_id,
            user_id=user_id,
        )
        exceeded = [scope for scope, item in status.items() if item.get("exceeded")]
        if exceeded:
            raise cls.BudgetExceededError(
                "Aethera usage budget exceeded: " + ", ".join(exceeded),
                status=status,
            )
        return status

    @classmethod
    def get_execution_usage(cls, execution_id: str) -> Dict[str, Any]:
        if not execution_id:
            return cls._aggregate([])

        return cls._aggregate(
            llm_usage_collection.find({"execution_id": execution_id})
        )

    @classmethod
    def get_project_usage(cls, project_id: str) -> Dict[str, Any]:
        if not project_id:
            return cls._aggregate([])

        return cls._aggregate(
            llm_usage_collection.find({"project_id": project_id})
        )

    @classmethod
    def get_conversation_usage(
        cls,
        conversation_id: str,
    ) -> Dict[str, Any]:
        if not conversation_id:
            return cls._aggregate([])

        return cls._aggregate(
            llm_usage_collection.find(
                {"conversation_id": conversation_id}
            )
        )

    @classmethod
    def get_user_usage(
        cls,
        user_id: str,
        days: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not user_id:
            return cls._aggregate([])

        query: Dict[str, Any] = {"user_id": user_id}

        if days is not None:
            query["created_at"] = {
                "$gte": datetime.utcnow() - timedelta(days=max(0, days))
            }

        return cls._aggregate(llm_usage_collection.find(query))

    @classmethod
    def get_summary(
        cls,
        user_id: Optional[str] = None,
        days: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        General usage summary.

        Optional filters:
            user_id: restrict to one user.
            days: restrict to the last N days.
        """
        query: Dict[str, Any] = {}

        if user_id:
            query["user_id"] = user_id

        if days is not None:
            query["created_at"] = {
                "$gte": datetime.utcnow() - timedelta(days=max(0, days))
            }

        return cls._aggregate(llm_usage_collection.find(query))

    @classmethod
    def get_velocity(
        cls,
        user_id: Optional[str] = None,
        hours: int = 24,
    ) -> Dict[str, Any]:
        """Return token/cost velocity over the requested time window."""
        hours = max(1, int(hours or 24))

        query: Dict[str, Any] = {
            "created_at": {
                "$gte": datetime.utcnow() - timedelta(hours=hours)
            }
        }

        if user_id:
            query["user_id"] = user_id

        summary = cls._aggregate(llm_usage_collection.find(query))

        divisor = float(hours)
        return {
            **summary,
            "hours": hours,
            "tokens_per_hour": (
                summary["total_tokens"] / divisor
            ),
            "cost_usd_per_hour": (
                summary["estimated_cost_usd"] / divisor
            ),
            "calls_per_hour": summary["calls"] / divisor,
        }

    @classmethod
    def get_workload_stats(
        cls,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Aggregate usage by module/agent."""
        query = {"user_id": user_id} if user_id else {}

        logs = list(llm_usage_collection.find(query))

        by_module: Dict[str, Dict[str, Any]] = {}
        by_agent: Dict[str, Dict[str, Any]] = {}

        for log in logs:
            module = log.get("module") or "unknown"
            agent = log.get("agent") or "unknown"

            module_bucket = by_module.setdefault(
                module,
                {
                    "calls": 0,
                    "total_tokens": 0,
                    "estimated_cost_usd": 0.0,
                },
            )
            module_bucket["calls"] += 1
            module_bucket["total_tokens"] += int(
                log.get("total_tokens", 0) or 0
            )
            module_bucket["estimated_cost_usd"] += float(
                log.get("estimated_cost_usd", 0) or 0
            )

            agent_bucket = by_agent.setdefault(
                agent,
                {
                    "calls": 0,
                    "total_tokens": 0,
                    "estimated_cost_usd": 0.0,
                },
            )
            agent_bucket["calls"] += 1
            agent_bucket["total_tokens"] += int(
                log.get("total_tokens", 0) or 0
            )
            agent_bucket["estimated_cost_usd"] += float(
                log.get("estimated_cost_usd", 0) or 0
            )

        return {
            "by_module": by_module,
            "by_agent": by_agent,
            "total_calls": len(logs),
        }

    @classmethod
    def get_memory_usage(
        cls,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Compatibility helper for dashboards that treat memory-related LLM
        operations as a workload category.
        """
        query: Dict[str, Any] = {"module": "memory"}
        if user_id:
            query["user_id"] = user_id

        return cls._aggregate(llm_usage_collection.find(query))

    @classmethod
    def get_compute_stats(
        cls,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return latency/call statistics for provider calls."""
        query: Dict[str, Any] = {}
        if user_id:
            query["user_id"] = user_id

        logs = list(llm_usage_collection.find(query))

        latencies = [
            float(x.get("latency_ms"))
            for x in logs
            if x.get("latency_ms") is not None
        ]

        if not latencies:
            return {
                "calls": 0,
                "total_latency_ms": 0.0,
                "avg_latency_ms": 0.0,
                "min_latency_ms": 0.0,
                "max_latency_ms": 0.0,
            }

        return {
            "calls": len(logs),
            "total_latency_ms": round(sum(latencies), 2),
            "avg_latency_ms": round(sum(latencies) / len(latencies), 2),
            "min_latency_ms": round(min(latencies), 2),
            "max_latency_ms": round(max(latencies), 2),
        }
