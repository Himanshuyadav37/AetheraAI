import uuid
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from agents.computer.astra_graph import AstraRunner, get_or_create_state, _AGENT_STATES
from agents.computer.browser_manager import session_manager
from agents.computer.executor import get_system_telemetry
from auth.dependencies import get_current_user
from config import settings
from db.computer_service import (
    create_or_update_computer_session,
    get_computer_session,
    get_computer_sessions,
    delete_computer_session
)

logger = logging.getLogger("aethera.astra.api")
router = APIRouter()

ADMIN_EMAILS = set(email.lower().strip() for email in settings.ADMIN_EMAILS_LIST)

def check_computer_admin(user=Depends(get_current_user)):
    """Enforce strict admin authorization for Astra OS and Autonomous Browser Agent."""
    email = (user.get("email") or "").lower().strip()
    role = (user.get("role") or "").lower().strip()
    is_admin = bool(user.get("is_admin"))
    if email not in ADMIN_EMAILS and role != "admin" and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Astra OS & Autonomous Computer Control is restricted to administrators only."
        )
    return user

class ComputerTaskRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    auto_approve: Optional[bool] = False
    history: Optional[List[Dict[str, Any]]] = None

class ComputerApprovalRequest(BaseModel):
    session_id: str
    approved: bool
    feedback: Optional[str] = None

class ResetSessionRequest(BaseModel):
    session_id: str

# Active WebSocket connections per session_id
_WS_CONNECTIONS: Dict[str, List[WebSocket]] = {}

@router.get("/system-status")
def system_status(admin=Depends(check_computer_admin)):
    """Retrieve real-time OS telemetry, memory, and CPU metrics (Admin Only)."""
    return get_system_telemetry()

@router.post("/run")
async def run_computer_task(req: ComputerTaskRequest, user=Depends(check_computer_admin)):
    """Execute an autonomous Astra computer & browser task (Admin Only)."""
    user_id = user.get("sub") or user.get("id") or "system"
    session_id = req.session_id or f"astra_{uuid.uuid4().hex[:12]}"

    import asyncio

    # Broadcast helper for active WebSockets
    def broadcast_event(event: Dict[str, Any]):
        if session_id in _WS_CONNECTIONS:
            for ws in _WS_CONNECTIONS[session_id]:
                try:
                    asyncio.create_task(ws.send_text(json.dumps(event)))
                except Exception:
                    pass

    runner = AstraRunner(
        session_id=session_id,
        prompt=req.prompt,
        user_id=user_id,
        history=req.history
    )

    # Run in thread pool to isolate Playwright sync loop from Uvicorn asyncio loop
    result = await asyncio.to_thread(
        runner.execute,
        auto_approve=req.auto_approve or False,
        on_event_callback=broadcast_event
    )

    # Persist session state
    await asyncio.to_thread(
        create_or_update_computer_session,
        session_id=session_id,
        user_id=user_id,
        title=req.prompt[:50],
        prompt=req.prompt,
        steps=result.get("steps", []),
        final_output=result.get("voice_response") or result.get("final_output"),
        status=result.get("status", "completed"),
        pending_approval=result.get("pending_approval"),
        system_telemetry=get_system_telemetry()
    )

    return result

@router.post("/approve")
def approve_computer_action(req: ComputerApprovalRequest, user=Depends(check_computer_admin)):
    """Approve or reject a pending sensitive action step (Admin Only)."""
    session = get_computer_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Computer session not found")

    user_id = user.get("sub") or user.get("id") or "system"
    state = get_or_create_state(req.session_id)
    pending = state.pending_approval

    if not pending:
        raise HTTPException(status_code=400, detail="No pending approval for this session")

    if not req.approved:
        state.pending_approval = None
        return {
            "session_id": req.session_id,
            "status": "rejected",
            "voice_response": "Action cancelled by user.",
            "final_output": "Action cancelled by user."
        }

    # Execute approved tool
    from agents.computer.tools_registry import execute_registered_tool
    tool_name = pending.get("tool")
    tool_params = pending.get("params", {})
    tool_res = execute_registered_tool(tool_name, tool_params, req.session_id)
    state.pending_approval = None

    sess = session_manager.get(req.session_id)
    return {
        "session_id": req.session_id,
        "status": "completed",
        "voice_response": f"Approved and executed {tool_name}.",
        "tool_result": tool_res,
        "screenshot": sess.last_screenshot_base64 if sess else "",
        "current_url": sess.last_url if sess else ""
    }

@router.post("/reset")
def reset_session(req: ResetSessionRequest, admin=Depends(check_computer_admin)):
    """Reset persistent browser and agent context (Admin Only)."""
    session_manager.close_session(req.session_id)
    if req.session_id in _AGENT_STATES:
        del _AGENT_STATES[req.session_id]
    return {"success": True, "message": f"Session {req.session_id} reset successfully."}

@router.get("/screenshot/{session_id}")
def get_session_screenshot(session_id: str, admin=Depends(check_computer_admin)):
    """Retrieve real-time desktop screenshot for active session (Admin Only)."""
    from agents.computer.native_device_controller import native_controller
    real_screen = native_controller.capture_desktop_screenshot()
    sess = session_manager.get(session_id)
    
    screenshot = real_screen or (sess.last_screenshot_base64 if sess else None)
    return {
        "has_screenshot": bool(screenshot),
        "screenshot": screenshot,
        "url": native_controller.last_url or (sess.last_url if sess else "about:blank"),
        "title": native_controller.last_title or (sess.last_title if sess else "Windows Host OS"),
        "cursor_position": native_controller.cursor_position if native_controller else [640, 360]
    }

@router.get("/sessions")
def list_sessions(user=Depends(check_computer_admin)):
    """List Astra computer sessions (Admin Only)."""
    user_id = user.get("sub") or user.get("id") or "system"
    return get_computer_sessions(user_id)

@router.get("/sessions/{session_id}")
def get_session(session_id: str, admin=Depends(check_computer_admin)):
    """Get Astra computer session details (Admin Only)."""
    session = get_computer_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Computer session not found")
    return session

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, admin=Depends(check_computer_admin)):
    """Delete Astra computer session (Admin Only)."""
    session_manager.close_session(session_id)
    if session_id in _AGENT_STATES:
        del _AGENT_STATES[session_id]
    success = delete_computer_session(session_id)
    return {"success": True, "message": "Session deleted"}

class AudioTranscribeRequest(BaseModel):
    audio_base64: str
    language: Optional[str] = "en"

@router.post("/transcribe-voice")
def transcribe_voice(req: AudioTranscribeRequest, admin=Depends(check_computer_admin)):
    """Ultra-fast Whisper Large v3 voice transcription fallback via Groq (Admin Only)."""
    try:
        import base64
        import io
        from llm.groq_client import get_client

        clean_b64 = req.audio_base64
        if "," in clean_b64:
            clean_b64 = clean_b64.split(",")[1]

        audio_bytes = base64.b64decode(clean_b64)
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "recording.webm"

        client = get_client()
        transcription = client.audio.transcriptions.create(
            file=("recording.webm", audio_bytes),
            model="whisper-large-v3-turbo",
            response_format="json",
            language=req.language if req.language in ("en", "hi") else None
        )
        text = transcription.text if hasattr(transcription, "text") else transcription.get("text", "")
        return {"success": True, "transcript": text}
    except Exception as e:
        logger.warning(f"Whisper transcription error: {e}")
        return {"success": False, "error": str(e), "transcript": ""}

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    if session_id not in _WS_CONNECTIONS:
        _WS_CONNECTIONS[session_id] = []
    _WS_CONNECTIONS[session_id].append(websocket)

    # Send initial state
    sess = session_manager.get(session_id)
    if sess:
        await websocket.send_text(json.dumps({
            "type": "init",
            "url": sess.last_url,
            "title": sess.last_title,
            "screenshot": sess.last_screenshot_base64,
            "cursor_position": sess.cursor_position
        }))

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            action_type = msg.get("type")
            if action_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        if session_id in _WS_CONNECTIONS and websocket in _WS_CONNECTIONS[session_id]:
            _WS_CONNECTIONS[session_id].remove(websocket)
