import asyncio
from datetime import datetime
from typing import Dict, Set

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
                loop.call_soon_threadsafe(queue.put_nowait, event_data)

stream_manager = ExecutionStreamManager()

def append_execution_step(state: dict, step_dict: dict):
    """
    Helper function to append a step to state["execution_steps"]
    and broadcast it to all active SSE subscribers in real-time.
    """
    if "execution_steps" not in state:
        state["execution_steps"] = []

    # Inject timestamp if not present
    if "timestamp" not in step_dict:
        step_dict["timestamp"] = datetime.utcnow().isoformat()

    state["execution_steps"].append(step_dict)

    execution_id = state.get("execution_id") or state.get("parent_execution_id")
    if execution_id:
        stream_manager.publish(
            str(execution_id),
            {
                "type": "step",
                "data": step_dict
            }
        )
