import time
import json
import logging
from typing import Dict, Any, List, Optional
from agents.computer.browser_manager import session_manager
from agents.computer.tools_registry import execute_registered_tool, SENSITIVE_ACTIONS
from agents.computer.model_router import generate_astra_plan

logger = logging.getLogger("aethera.astra.graph")

class AstraAgentState:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.conversation_history: List[Dict[str, str]] = []
        self.current_application: str = "Browser"
        self.current_url: str = "about:blank"
        self.current_title: str = "Aethera Sandbox"
        self.previous_actions: List[Dict[str, Any]] = []
        self.pending_approval: Optional[Dict[str, Any]] = None

    def to_context_dict(self) -> Dict[str, Any]:
        sess = session_manager.get(self.session_id)
        dom_data = sess.get_dom_summary() if sess else {}
        url = sess.last_url if sess else self.current_url
        title = sess.last_title if sess else self.current_title
        
        return {
            "current_application": self.current_application,
            "current_url": url,
            "current_title": title,
            "is_browser_active": sess.is_active if sess else False,
            "visible_headings": dom_data.get("headings", [])[:3],
            "visible_inputs": dom_data.get("inputs", [])[:3],
            "visible_videos_or_links": dom_data.get("videos", [])[:4] or dom_data.get("buttons", [])[:4],
            "last_action": self.previous_actions[-1] if self.previous_actions else None
        }

# Agent State cache per session_id
_AGENT_STATES: Dict[str, AstraAgentState] = {}

def get_or_create_state(session_id: str) -> AstraAgentState:
    if session_id not in _AGENT_STATES:
        _AGENT_STATES[session_id] = AstraAgentState(session_id)
    return _AGENT_STATES[session_id]

class AstraRunner:
    def __init__(self, session_id: str, prompt: str, user_id: str = "system", history: Optional[List[Dict[str, str]]] = None):
        self.session_id = session_id
        self.prompt = prompt
        self.user_id = user_id
        self.state = get_or_create_state(session_id)
        if history:
            # Sync incoming frontend chat history
            self.state.conversation_history = [
                {"role": m.get("role", "user"), "content": m.get("content", "")}
                for m in history if m.get("content")
            ]
        self.steps: List[Dict[str, Any]] = []

    def execute(self, auto_approve: bool = False, on_event_callback=None) -> Dict[str, Any]:
        """
        Full ReAct Execution Loop:
        Understand -> Read Context -> Plan -> Execute Tool -> Observe & Verify -> Voice Response
        """
        # 1. Update conversation history
        if not self.state.conversation_history or self.state.conversation_history[-1].get("content") != self.prompt:
            self.state.conversation_history.append({"role": "user", "content": self.prompt})

        # 2. Extract current context
        context = self.state.to_context_dict()

        if on_event_callback:
            on_event_callback({
                "type": "understanding",
                "message": f"Analyzing intent: '{self.prompt}' with active context: {context.get('current_title')} ({context.get('current_url')})"
            })

        # 3. Model Planning
        plan = generate_astra_plan(
            prompt=self.prompt,
            context_state=context,
            history=self.state.conversation_history
        )

        thought = plan.get("thought", "Analyzing command...")
        action = plan.get("action", {})
        tool_name = action.get("tool", "none")
        tool_params = action.get("params", {})
        requires_approval = action.get("requires_approval", False)
        approval_reason = action.get("approval_reason", "")
        voice_response = plan.get("voice_response", "Command executed.")

        # Check if sensitive action
        if tool_name in SENSITIVE_ACTIONS or requires_approval:
            if not auto_approve:
                pending = {
                    "tool": tool_name,
                    "params": tool_params,
                    "reason": approval_reason or "Sensitive system action requires user confirmation."
                }
                self.state.pending_approval = pending
                return {
                    "session_id": self.session_id,
                    "status": "requires_approval",
                    "thought": thought,
                    "pending_approval": pending,
                    "voice_response": f"I need your approval before {tool_name}.",
                    "steps": self.steps,
                    "screenshot": session_manager.get(self.session_id).last_screenshot_base64 if session_manager.get(self.session_id) else None
                }

        step_record = {
            "step_number": len(self.steps) + 1,
            "thought": thought,
            "tool": tool_name,
            "params": tool_params,
            "status": "executing",
            "timestamp": time.time()
        }
        self.steps.append(step_record)

        if on_event_callback:
            on_event_callback({
                "type": "planning",
                "thought": thought,
                "tool": tool_name,
                "params": tool_params
            })

        # 4. Tool Execution & Observation
        tool_result = {}
        if tool_name != "none":
            if on_event_callback:
                on_event_callback({
                    "type": "tool_executing",
                    "tool": tool_name,
                    "params": tool_params
                })

            tool_result = execute_registered_tool(tool_name, tool_params, self.session_id)
            step_record["observation"] = tool_result
            step_record["status"] = "completed" if tool_result.get("success", False) else "failed"

            if on_event_callback:
                on_event_callback({
                    "type": "observation",
                    "result": tool_result,
                    "screenshot": tool_result.get("screenshot")
                })
        else:
            step_record["observation"] = {"success": True, "message": "Direct response."}
            step_record["status"] = "completed"

        # 5. Update State & Verify
        from agents.computer.native_device_controller import native_controller
        sess = session_manager.get(self.session_id)
        current_screenshot = tool_result.get("screenshot") or native_controller.last_screenshot_base64 or (sess.last_screenshot_base64 if sess else "")
        self.state.current_url = tool_result.get("url") or native_controller.last_url or (sess.last_url if sess else self.state.current_url)
        self.state.current_title = tool_result.get("title") or native_controller.last_title or (sess.last_title if sess else self.state.current_title)
        self.state.previous_actions.append({"tool": tool_name, "params": tool_params, "time": time.time()})

        # Record assistant reply into history
        self.state.conversation_history.append({"role": "assistant", "content": voice_response})

        final_payload = {
            "session_id": self.session_id,
            "status": "completed",
            "thought": thought,
            "tool": tool_name,
            "tool_params": tool_params,
            "tool_result": tool_result,
            "steps": self.steps,
            "voice_response": voice_response,
            "final_output": voice_response,
            "current_url": self.state.current_url,
            "current_title": self.state.current_title,
            "cursor_position": sess.cursor_position if sess else [640, 360],
            "screenshot": current_screenshot,
            "pending_approval": None
        }

        if on_event_callback:
            on_event_callback({
                "type": "completed",
                "final_payload": final_payload
            })

        return final_payload
