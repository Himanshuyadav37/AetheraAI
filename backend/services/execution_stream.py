import asyncio
from datetime import datetime


class ExecutionStreamManager:
    def __init__(self):
        # Maps execution_id -> set of (asyncio.Queue, asyncio.AbstractEventLoop)
        self.active_listeners = {}

    def subscribe(self, execution_id: str) -> asyncio.Queue:
        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        if execution_id not in self.active_listeners:
            self.active_listeners[execution_id] = set()

        self.active_listeners[execution_id].add((queue, loop))
        return queue

    def unsubscribe(self, execution_id: str, queue: asyncio.Queue):
        if execution_id in self.active_listeners:
            to_remove = None

            for item in self.active_listeners[execution_id]:
                if item[0] == queue:
                    to_remove = item
                    break

            if to_remove:
                self.active_listeners[execution_id].discard(to_remove)

            if not self.active_listeners[execution_id]:
                del self.active_listeners[execution_id]

    def publish(self, execution_id: str, event_data: dict):
        if not execution_id:
            return

        execution_id_str = str(execution_id)

        if execution_id_str in self.active_listeners:
            for queue, loop in self.active_listeners[execution_id_str]:
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    event_data,
                )


stream_manager = ExecutionStreamManager()


def publish_agent_event(
    session_id: str,
    event_type: str,
    data: dict,
    collection_name: str = None,
):
    """
    Publish an event (step, thought, complete, failed) to active listeners.

    Step/thought events can optionally be persisted to MongoDB.
    """
    if not session_id:
        return

    session_id_str = str(session_id)

    # This is the common Mongo + SSE boundary for agent output.
    from services.secret_redactor import redact_in_place
    data, _ = redact_in_place(data)
    if "timestamp" not in data:
        data["timestamp"] = datetime.utcnow().isoformat()

    event_payload = {
        "type": event_type,
        "data": data,
    }

    stream_manager.publish(session_id_str, event_payload)

    if collection_name:
        from db.mongo_client import db
        from bson import ObjectId

        try:
            coll = db[collection_name]
            object_id = ObjectId(session_id_str)

            if event_type == "step":
                coll.update_one(
                    {"_id": object_id},
                    {
                        "$push": {"execution_steps": data},
                        "$set": {"updated_at": datetime.utcnow()},
                    },
                )

            elif event_type == "thought":
                coll.update_one(
                    {"_id": object_id},
                    {
                        "$push": {"thoughts": data},
                        "$set": {"updated_at": datetime.utcnow()},
                    },
                )

        except Exception as e:
            print(
                "[Execution Stream] MongoDB persist failed for "
                f"session {session_id_str}: {e}"
            )


def append_execution_step(state: dict, step_dict: dict):
    """
    Append a step to state["execution_steps"] and broadcast it
    to active SSE subscribers.
    """
    from services.secret_redactor import redact_in_place
    step_dict, _ = redact_in_place(step_dict)
    if "execution_steps" not in state:
        state["execution_steps"] = []

    if "timestamp" not in step_dict:
        step_dict["timestamp"] = datetime.utcnow().isoformat()

    state["execution_steps"].append(step_dict)

    execution_id = (
        state.get("execution_id")
        or state.get("parent_execution_id")
    )

    if execution_id:
        publish_agent_event(
            str(execution_id),
            "step",
            step_dict,
            "executions",
        )


def _normalize_files(files):
    """
    Canonical runtime format:

    [
        {"path": "...", "code": "..."},
        ...
    ]

    Accept legacy file entries defensively, but always persist
    the canonical list format.
    """
    if not isinstance(files, list):
        return []

    normalized = []

    for file_data in files:
        if not isinstance(file_data, dict):
            continue

        path = file_data.get("path") or file_data.get("name")
        if not path:
            continue

        code = file_data.get("code")

        if code is None:
            code = file_data.get("content", "")

        normalized.append(
            {
                "path": str(path),
                "code": str(code),
            }
        )

    return normalized


def publish_files_update(
    execution_id: str,
    files: list,
    source: str = "coder",
    message: str = "",
):
    """
    Broadcast generated/fixed project files through SSE and persist them
    using the canonical list format.

    Canonical storage:
        generated_code: [{path, code}, ...]
        fixed_code: [{path, code}, ...]
    """
    if not execution_id:
        return

    normalized_files = _normalize_files(files)

    if not normalized_files:
        return

    execution_id_str = str(execution_id)

    payload = {
        "type": "files_update",
        "data": {
            "files": normalized_files,
            "source": source,
            "message": message
            or f"Project files updated from {source}",
            "timestamp": datetime.utcnow().isoformat(),
        },
    }

    stream_manager.publish(execution_id_str, payload)

    try:
        from db.mongo_client import db
        from bson import ObjectId

        update_doc = {
            "updated_at": datetime.utcnow(),
        }

        if source == "coder":
            update_doc["generated_code"] = normalized_files

        elif source == "debugger":
            update_doc["fixed_code"] = normalized_files

        else:
            # Do not silently write unknown sources into either
            # generated_code or fixed_code.
            return

        db["executions"].update_one(
            {"_id": ObjectId(execution_id_str)},
            {"$set": update_doc},
        )

    except Exception as e:
        print(
            "[Execution Stream] Failed to persist files_update "
            f"for {execution_id_str}: {e}"
        )
