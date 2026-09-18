"""
Aethera AI - Centralized LLM Token Usage Tracker & Analytics Engine
Handles:
1. Thread/Async-safe context propagation (user_id, project_id, module, operation, agent).
2. Token extraction from LLM provider responses (Groq, OpenAI, Gemini).
3. Exact tokenizer fallback (tiktoken cl100k_base).
4. Idempotent persistent logging to MongoDB 'usage_logs'.
5. Dynamic database aggregations (Summary, Velocity, Quota, Module/Agent Breakdown).
"""

import os
import uuid
import logging
import contextvars
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from bson import ObjectId

logger = logging.getLogger("aethera.usage")

# ── Async-safe Context Variables ─────────────────────────────────────
ctx_user_id = contextvars.ContextVar("usage_user_id", default="system")
ctx_module = contextvars.ContextVar("usage_module", default="general")
ctx_operation = contextvars.ContextVar("usage_operation", default="llm_call")
ctx_agent = contextvars.ContextVar("usage_agent", default="assistant")
ctx_project_id = contextvars.ContextVar("usage_project_id", default=None)
ctx_conversation_id = contextvars.ContextVar("usage_conversation_id", default=None)

# ── Tiktoken Tokenizer Fallback ──────────────────────────────────────
_tiktoken_encoder = None

def get_tokenizer_encoder():
    global _tiktoken_encoder
    if _tiktoken_encoder is None:
        try:
            import tiktoken
            _tiktoken_encoder = tiktoken.get_encoding("cl100k_base")
        except Exception as e:
            logger.warning(f"Could not load tiktoken cl100k_base encoder: {e}")
            _tiktoken_encoder = False
    return _tiktoken_encoder if _tiktoken_encoder is not False else None


def count_tokens_fallback(text: str, model: str = "") -> int:
    """Exact token counting fallback using tiktoken when provider usage is absent."""
    if not text:
        return 0
    enc = get_tokenizer_encoder()
    if enc is not None:
        try:
            return len(enc.encode(str(text)))
        except Exception:
            pass
    # Fallback to standard word/char ratio if tokenizer fails
    return max(1, int(len(str(text)) / 3.8))


class UsageTracker:
    """Centralized singleton usage tracking and aggregation engine."""

    @staticmethod
    def set_context(
        user_id: Optional[str] = None,
        module: Optional[str] = None,
        operation: Optional[str] = None,
        agent: Optional[str] = None,
        project_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ):
        """Sets active request context for subsequent downstream LLM calls in this thread/coroutine."""
        if user_id is not None:
            ctx_user_id.set(str(user_id))
        if module is not None:
            ctx_module.set(str(module))
        if operation is not None:
            ctx_operation.set(str(operation))
        if agent is not None:
            ctx_agent.set(str(agent))
        if project_id is not None:
            ctx_project_id.set(str(project_id))
        if conversation_id is not None:
            ctx_conversation_id.set(str(conversation_id))

    @staticmethod
    def extract_usage_from_completion(
        completion: Any,
        prompt_text: str = "",
        completion_text: str = "",
        model: str = ""
    ) -> Dict[str, int]:
        """
        Extracts token counts.
        Prioritizes completion.usage from the LLM provider API (Groq/OpenAI).
        Falls back to tiktoken tokenizer if provider usage is unavailable.
        """
        usage = getattr(completion, "usage", None)
        if usage is not None:
            prompt_tok = getattr(usage, "prompt_tokens", None)
            comp_tok = getattr(usage, "completion_tokens", None)
            tot_tok = getattr(usage, "total_tokens", None)
            if prompt_tok is not None and comp_tok is not None:
                p_int = int(prompt_tok)
                c_int = int(comp_tok)
                t_int = int(tot_tok) if tot_tok is not None else (p_int + c_int)
                return {
                    "input_tokens": p_int,
                    "output_tokens": c_int,
                    "total_tokens": t_int
                }

        # Fallback to tokenizer
        inp = count_tokens_fallback(prompt_text, model)
        out = count_tokens_fallback(completion_text, model)
        return {
            "input_tokens": inp,
            "output_tokens": out,
            "total_tokens": inp + out
        }

    @staticmethod
    def record_usage(
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        module: Optional[str] = None,
        operation: Optional[str] = None,
        agent: Optional[str] = None,
        project_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        provider: str = "groq",
        model: str = "openai/gpt-oss-120b",
        input_tokens: int = 0,
        output_tokens: int = 0,
        total_tokens: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Idempotently logs an LLM request to MongoDB 'usage_logs'.
        Attributes to authenticated user, module, and operation.
        """
        from db.mongo_client import db

        effective_user = str(user_id or ctx_user_id.get())
        effective_module = str(module or ctx_module.get())
        effective_operation = str(operation or ctx_operation.get())
        effective_agent = str(agent or ctx_agent.get())
        effective_project = project_id or ctx_project_id.get()
        effective_conversation = conversation_id or ctx_conversation_id.get()
        effective_req_id = request_id or str(uuid.uuid4())

        # Normalize module name
        norm_mod = effective_module.lower().strip()
        if "eng" in norm_mod or "code" in norm_mod or "dev" in norm_mod:
            effective_module = "engineer"
        elif "conv" in norm_mod or "chat" in norm_mod:
            effective_module = "conversation"
        elif "edu" in norm_mod or "learn" in norm_mod:
            effective_module = "education"
        elif "res" in norm_mod:
            effective_module = "research"
        elif "auto" in norm_mod or "flow" in norm_mod:
            effective_module = "automation"
        elif "nav" in norm_mod:
            effective_module = "navix"

        inp = max(0, int(input_tokens or 0))
        out = max(0, int(output_tokens or 0))
        tot = int(total_tokens) if total_tokens is not None else (inp + out)

        now_utc = datetime.now(timezone.utc)
        record = {
            "user_id": effective_user,
            "request_id": effective_req_id,
            "module": effective_module,
            "operation": effective_operation,
            "agent": effective_agent,
            "project_id": str(effective_project) if effective_project else None,
            "conversation_id": str(effective_conversation) if effective_conversation else None,
            "provider": provider,
            "model": model,
            "input_tokens": inp,
            "output_tokens": out,
            "total_tokens": tot,
            "created_at": now_utc,
            "timestamp": now_utc.isoformat()
        }

        try:
            col = db["usage_logs"]
            # Idempotency check: avoid duplicate inserts for the same request_id
            existing = col.find_one({"request_id": effective_req_id})
            if not existing:
                col.insert_one(dict(record))
                logger.info(
                    f"[Usage Logged] user={effective_user} module={effective_module} "
                    f"agent={effective_agent} tokens={tot} (in={inp}, out={out})"
                )
            else:
                logger.debug(f"[Usage Deduplicated] request_id {effective_req_id} already logged.")
        except Exception as e:
            logger.error(f"Failed to record usage log: {e}", exc_info=True)

        return record

    @staticmethod
    def get_user_query_filter(user_id: str) -> Dict[str, Any]:
        """Normalizes user_id matching to accommodate string and ObjectId formats."""
        clean_id = str(user_id).strip()
        or_list = [{"user_id": clean_id}]
        if ObjectId.is_valid(clean_id):
            or_list.append({"user_id": ObjectId(clean_id)})
        return {"$or": or_list}

    @staticmethod
    def get_usage_summary(user_id: str) -> Dict[str, Any]:
        """
        Calculates 100% REAL lifetime tokens, monthly quota (used/remaining/pct),
        and module breakdown from 'usage_logs'.
        """
        from db.mongo_client import db, get_user_limit

        user_filter = UsageTracker.get_user_query_filter(user_id)
        col = db["usage_logs"]

        now = datetime.now(timezone.utc)
        # Start of current calendar month
        start_of_month = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)

        # Monthly limit: default 500,000 for Aethera Free tier
        quota_limit = 500000
        try:
            custom_limit = get_user_limit(user_id)
            if custom_limit and custom_limit >= 500000:
                quota_limit = custom_limit
        except Exception:
            pass

        # Query all logs for this user
        user_logs = list(col.find(user_filter))

        total_tokens_lifetime = 0
        used_tokens_month = 0
        total_requests = len(user_logs)

        modules_breakdown = {
            "engineer": 0,
            "conversation": 0,
            "education": 0,
            "research": 0,
            "automation": 0
        }

        for log in user_logs:
            tok = int(log.get("total_tokens", 0) or 0)
            total_tokens_lifetime += tok

            # Check if within current monthly cycle
            created_dt = log.get("created_at")
            if isinstance(created_dt, datetime):
                if created_dt.tzinfo is None:
                    created_dt = created_dt.replace(tzinfo=timezone.utc)
                if created_dt >= start_of_month:
                    used_tokens_month += tok
            else:
                used_tokens_month += tok

            mod = str(log.get("module", "engineer")).lower()
            if mod in modules_breakdown:
                modules_breakdown[mod] += tok
            elif "conv" in mod or "chat" in mod:
                modules_breakdown["conversation"] += tok
            elif "edu" in mod:
                modules_breakdown["education"] += tok
            elif "res" in mod:
                modules_breakdown["research"] += tok
            elif "auto" in mod:
                modules_breakdown["automation"] += tok
            else:
                modules_breakdown["engineer"] += tok

        remaining_tokens = max(0, quota_limit - used_tokens_month)
        usage_pct = round(min(100.0, (used_tokens_month / quota_limit) * 100), 2) if quota_limit > 0 else 0.0

        return {
            "total_tokens": total_tokens_lifetime,
            "monthly_limit": quota_limit,
            "used_tokens": used_tokens_month,
            "remaining_tokens": remaining_tokens,
            "usage_percentage": usage_pct,
            "requests": total_requests,
            "modules": modules_breakdown,
            # Convenient aliases
            "total_quota": quota_limit,
            "used": used_tokens_month,
            "remaining": remaining_tokens,
            "percentage": usage_pct,
            "all_time_tokens": total_tokens_lifetime
        }

    @staticmethod
    def get_velocity_data(user_id: str, range_key: str = "7d", time_range: str = None) -> Dict[str, Any]:
        """
        Dynamically calculates consumption velocity for 24H, 7D, or 30D.
        Groups by hour (24H) or by day (7D, 30D).
        Returns real peak, average, and has_data flag.
        """
        from db.mongo_client import db

        user_filter = UsageTracker.get_user_query_filter(user_id)
        col = db["usage_logs"]

        now = datetime.now(timezone.utc)
        effective_range = (time_range or range_key or "7d").lower().strip()
        range_key = effective_range

        if range_key == "24h":
            start_time = now - timedelta(hours=24)
            time_filter = {"$and": [user_filter, {"created_at": {"$gte": start_time}}]}
            logs = list(col.find(time_filter))

            # Generate 24 hourly buckets
            slots = []
            for i in range(23, -1, -1):
                slot_time = now - timedelta(hours=i)
                label = slot_time.strftime("%H:00")
                slots.append({"label": label, "hour": slot_time.hour, "day": slot_time.day, "tokens": 0})

            for log in logs:
                dt = log.get("created_at")
                if isinstance(dt, datetime):
                    for s in slots:
                        if s["hour"] == dt.hour and s["day"] == dt.day:
                            s["tokens"] += int(log.get("total_tokens", 0) or 0)
                            break

            total_tokens = sum(s["tokens"] for s in slots)
            max_slot = max(slots, key=lambda x: x["tokens"]) if slots else {"label": "N/A", "tokens": 0}
            peak_val = max_slot["tokens"]
            avg_val = int(total_tokens / len(slots)) if slots else 0

            max_token_ceiling = peak_val or 1
            chart_items = [
                {
                    "day": s["label"],
                    "tokens": s["tokens"],
                    "height": max(15, round((s["tokens"] / max_token_ceiling) * 100)) if s["tokens"] > 0 else 0
                }
                for s in slots
            ]

            return {
                "has_data": total_tokens > 0,
                "range": "24h",
                "items": chart_items,
                "peak_day": max_slot["label"] if total_tokens > 0 else "N/A",
                "peak_tokens": peak_val,
                "avg_tokens_day": avg_val,
                "message": "Real 24-hour velocity" if total_tokens > 0 else "No usage recorded"
            }

        elif range_key == "30d":
            start_time = now - timedelta(days=30)
            time_filter = {"$and": [user_filter, {"created_at": {"$gte": start_time}}]}
            logs = list(col.find(time_filter))

            # Generate 30 daily buckets
            slots = []
            for i in range(29, -1, -1):
                slot_time = now - timedelta(days=i)
                label = slot_time.strftime("%b %d")
                slots.append({"label": label, "date_str": slot_time.strftime("%Y-%m-%d"), "tokens": 0})

            for log in logs:
                dt = log.get("created_at")
                if isinstance(dt, datetime):
                    log_date = dt.strftime("%Y-%m-%d")
                    for s in slots:
                        if s["date_str"] == log_date:
                            s["tokens"] += int(log.get("total_tokens", 0) or 0)
                            break

            total_tokens = sum(s["tokens"] for s in slots)
            max_slot = max(slots, key=lambda x: x["tokens"]) if slots else {"label": "N/A", "tokens": 0}
            peak_val = max_slot["tokens"]
            avg_val = int(total_tokens / len(slots)) if slots else 0

            max_token_ceiling = peak_val or 1
            chart_items = [
                {
                    "day": s["label"],
                    "tokens": s["tokens"],
                    "height": max(15, round((s["tokens"] / max_token_ceiling) * 100)) if s["tokens"] > 0 else 0
                }
                for s in slots
            ]

            return {
                "has_data": total_tokens > 0,
                "range": "30d",
                "items": chart_items,
                "peak_day": max_slot["label"] if total_tokens > 0 else "N/A",
                "peak_tokens": peak_val,
                "avg_tokens_day": avg_val,
                "message": "Real 30-day velocity" if total_tokens > 0 else "No usage recorded"
            }

        else: # 7d (Default)
            start_time = now - timedelta(days=7)
            time_filter = {"$and": [user_filter, {"created_at": {"$gte": start_time}}]}
            logs = list(col.find(time_filter))

            # Generate 7 daily slots (Mon-Sun chronologically ending today)
            slots = []
            for i in range(6, -1, -1):
                slot_time = now - timedelta(days=i)
                label = slot_time.strftime("%a")
                slots.append({"label": label, "date_str": slot_time.strftime("%Y-%m-%d"), "tokens": 0})

            for log in logs:
                dt = log.get("created_at")
                if isinstance(dt, datetime):
                    log_date = dt.strftime("%Y-%m-%d")
                    for s in slots:
                        if s["date_str"] == log_date:
                            s["tokens"] += int(log.get("total_tokens", 0) or 0)
                            break

            total_tokens = sum(s["tokens"] for s in slots)
            max_slot = max(slots, key=lambda x: x["tokens"]) if slots else {"label": "N/A", "tokens": 0}
            peak_val = max_slot["tokens"]
            avg_val = int(total_tokens / 7)

            max_token_ceiling = peak_val or 1
            chart_items = [
                {
                    "day": s["label"],
                    "tokens": s["tokens"],
                    "height": max(15, round((s["tokens"] / max_token_ceiling) * 100)) if s["tokens"] > 0 else 0
                }
                for s in slots
            ]

            return {
                "has_data": total_tokens > 0,
                "range": "7d",
                "items": chart_items,
                "peak_day": max_slot["label"] if total_tokens > 0 else "N/A",
                "peak_tokens": peak_val,
                "avg_tokens_day": avg_val,
                "message": "Real 7-day velocity" if total_tokens > 0 else "No usage recorded"
            }

    @staticmethod
    def get_agent_workload_breakdown(user_id: str) -> List[Dict[str, Any]]:
        """Calculates exact workload percentages and token counts per module/agent."""
        summary = UsageTracker.get_usage_summary(user_id)
        modules = summary.get("modules", {})
        total = sum(modules.values()) or 0

        engine_meta = [
            {"name": "Engineer AI", "key": "engineer", "path": "/workspace?agent=engineer"},
            {"name": "Research AI", "key": "research", "path": "/workspace?agent=research"},
            {"name": "Education AI", "key": "education", "path": "/workspace?agent=education"},
            {"name": "Automation AI", "key": "automation", "path": "/workspace?agent=automation"},
            {"name": "Conversational AI", "key": "conversation", "path": "/workspace?agent=conversational"},
        ]

        breakdown = []
        for em in engine_meta:
            tokens_val = modules.get(em["key"], 0)
            pct = round((tokens_val / total) * 100) if total > 0 else 0
            breakdown.append({
                "name": em["name"],
                "key": em["key"],
                "tokens": f"{tokens_val:,}",
                "tokens_num": tokens_val,
                "percentage": pct,
                "path": em["path"]
            })

        return breakdown

    @staticmethod
    def get_project_usage(user_id: str) -> List[Dict[str, Any]]:
        """Calculates project-level token usage and execution counts for the authenticated user."""
        from db.mongo_client import db

        user_filter = UsageTracker.get_user_query_filter(user_id)
        projects_col = db["projects"]
        logs_col = db["usage_logs"]

        projects = list(projects_col.find(user_filter))
        results = []

        for p in projects:
            p_id = str(p.get("_id") or p.get("project_id", ""))
            p_name = p.get("project_plan", {}).get("project_name") or p.get("name") or "Aethera Project"

            # Aggregate logs for this project
            p_logs = list(logs_col.find({"$or": [{"project_id": p_id}, {"project_id": str(p.get("_id"))}]}))
            p_tokens = sum(int(l.get("total_tokens", 0) or 0) for l in p_logs)

            results.append({
                "project_id": p_id,
                "name": p_name,
                "status": p.get("status", "active"),
                "total_tokens": p_tokens,
                "executions_count": len(p_logs),
                "created_at": p.get("created_at")
            })

        return results

    @staticmethod
    def get_conversation_usage(user_id: str) -> List[Dict[str, Any]]:
        """Calculates conversation-level token usage for the authenticated user."""
        from db.mongo_client import db

        user_filter = UsageTracker.get_user_query_filter(user_id)
        convs_col = db["conversations"]
        logs_col = db["usage_logs"]

        convs = list(convs_col.find(user_filter).sort("updated_at", -1).limit(30))
        results = []

        for c in convs:
            c_id = str(c.get("_id"))
            c_title = c.get("title") or "New Chat"
            c_logs = list(logs_col.find({"$or": [{"conversation_id": c_id}, {"conversation_id": str(c.get("_id"))}]}))
            c_tokens = sum(int(l.get("total_tokens", 0) or 0) for l in c_logs)

            results.append({
                "conversation_id": c_id,
                "title": c_title,
                "agent_type": c.get("agent_type", "conversational"),
                "total_tokens": c_tokens,
                "message_count": len(c.get("messages", [])),
                "updated_at": c.get("updated_at") or c.get("created_at")
            })

        return results

    @staticmethod
    def get_memory_and_vector_stats(user_id: str) -> Dict[str, Any]:
        """Returns real database counts for continuous memory and vector storage."""
        from db.mongo_client import db

        user_filter = UsageTracker.get_user_query_filter(user_id)

        # 1. Memory stats
        personal_facts_count = db["user_memory"].count_documents({
            "$or": [
                {"user_id": str(user_id), "type": "fact"},
                {"user_id": str(user_id)}
            ]
        })
        learned_rules_count = db["learnings"].count_documents(user_filter)
        global_insights_count = db["learnings"].count_documents({"user_id": "system"})

        # 2. Vector knowledge stats
        doc_count = db["documents"].count_documents(user_filter)
        # Also check vector store if accessible
        real_vector_count = doc_count
        try:
            from rag.vector_store import get_vector_store
            store = get_vector_store()
            if hasattr(store, "count"):
                # Count in user namespace or personal collection if exists
                user_col_name = f"user_memory_{user_id}"
                try:
                    c = store.count(user_col_name)
                    if c > 0:
                        real_vector_count = max(real_vector_count, c)
                except Exception:
                    pass
        except Exception:
            pass

        return {
            "memory": {
                "total_rules": learned_rules_count,
                "personal_facts": personal_facts_count,
                "global_insights": global_insights_count,
            },
            "vector_store": {
                "total_vectors": real_vector_count,
                "namespaces_count": 1 if real_vector_count > 0 else 0,
                "namespaces": ["# personal_knowledge"] if real_vector_count > 0 else [],
                "quota": "50 MB Cloud Quota",
                "cloud": "Aethera Neural Store",
                "status": "Connected" if real_vector_count > 0 else "Empty"
            }
        }

    @staticmethod
    def get_recent_activities(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Returns actual recent transactions from usage_logs and executions for the user."""
        from db.mongo_client import db

        user_filter = UsageTracker.get_user_query_filter(user_id)
        logs_col = db["usage_logs"]

        logs = list(logs_col.find(user_filter).sort("created_at", -1).limit(limit))
        activities = []

        now = datetime.now(timezone.utc)
        for idx, l in enumerate(logs):
            dt = l.get("created_at")
            time_str = "Recently"
            if isinstance(dt, datetime):
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                diff = now - dt
                secs = int(diff.total_seconds())
                if secs < 60:
                    time_str = "Just now"
                elif secs < 3600:
                    time_str = f"{secs // 60}m ago"
                elif secs < 86400:
                    time_str = f"{secs // 3600}h ago"
                else:
                    time_str = f"{secs // 86400}d ago"

            mod = l.get("module", "engineer").capitalize()
            op = l.get("operation", "LLM Inference").replace("_", " ").title()
            tok = int(l.get("total_tokens", 0) or 0)
            activities.append({
                "id": str(l.get("_id", f"act-{idx+1}")),
                "title": f"{mod} — {op}",
                "agent": f"{l.get('agent', 'Assistant').capitalize()} Agent",
                "model": l.get("model", "Groq LPU"),
                "tokens": f"{tok:,} tokens",
                "time": time_str,
                "status": "COMPLETED"
            })

        return activities

    @staticmethod
    def get_compute_credits(user_id: str) -> Dict[str, Any]:
        """
        Calculates compute credits if actual compute operations exist.
        Returns is_available=False ('Not available') if compute engine has not run jobs.
        """
        from db.mongo_client import db

        user_filter = UsageTracker.get_user_query_filter(user_id)
        # Check if actual compute container execution records exist
        compute_jobs_count = db["executions"].count_documents({
            "$and": [user_filter, {"terminal_output": {"$exists": True, "$ne": ""}}]
        })

        if compute_jobs_count == 0:
            return {
                "is_available": False,
                "status": "Not available",
                "total": 0,
                "used": 0,
                "remaining": 0,
                "balance_usd": "Not available"
            }

        # If user has run terminal/sandbox jobs, compute real credits (1 job = 10 credits)
        total_quota_credits = 1000
        used_credits = min(total_quota_credits, compute_jobs_count * 10)
        remaining_credits = max(0, total_quota_credits - used_credits)

        return {
            "is_available": True,
            "status": "Active",
            "total": total_quota_credits,
            "used": used_credits,
            "remaining": remaining_credits,
            "balance_usd": f"${(remaining_credits * 0.01):.2f} Balance"
        }
