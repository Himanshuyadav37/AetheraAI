import asyncio
import json
import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from navix.navix_agent import NavixAgent

logger = logging.getLogger("nexusai.api.navix")

router = APIRouter(prefix="/api/navix", tags=["Nexus NAVIX"])

# In-memory tracking of active operator sessions for abort capability
active_sessions: Dict[str, NavixAgent] = {}

class NavixExecuteRequest(BaseModel):
    goal: str
    start_url: Optional[str] = None
    max_steps: Optional[int] = 10
    headless: Optional[bool] = True
    session_id: Optional[str] = None

class AbortRequest(BaseModel):
    session_id: str

@router.get("/status")
async def get_navix_status():
    """Health & engine capability check."""
    return {
        "engine": "Nexus NAVIX v1.0",
        "status": "ONLINE",
        "playwright_ready": True,
        "capabilities": [
            "Autonomous DOM interaction",
            "Real-time visual base64 streaming",
            "Dynamic form fill & navigation",
            "Structured data schema extraction"
        ]
    }

@router.get("/presets")
async def get_navix_presets():
    """Quick-start autonomous mission presets."""
    return {
        "presets": [
            {
                "id": "producthunt_ai",
                "title": "ProductHunt Top AI Tools",
                "goal": "Go to ProductHunt, find today's top 5 AI products, and extract their names, taglines, and upvote counts into a table.",
                "url": "https://www.producthunt.com"
            },
            {
                "id": "arxiv_rl",
                "title": "ArXiv DeepSeek / RL Papers",
                "goal": "Search ArXiv for recent papers on 'Reinforcement Learning GRPO' or 'DeepSeek reasoning', and extract top 3 paper titles with abstracts.",
                "url": "https://arxiv.org"
            },
            {
                "id": "hn_trending",
                "title": "HackerNews Trending Stories",
                "goal": "Go to Hacker News, extract the top 5 trending stories with their point counts and submission URLs.",
                "url": "https://news.ycombinator.com"
            },
            {
                "id": "pricing_comparison",
                "title": "Competitor Pricing Extraction",
                "goal": "Navigate to https://linear.app/pricing and extract their pricing tiers, monthly costs, and key feature differences.",
                "url": "https://linear.app/pricing"
            }
        ]
    }

@router.post("/stream")
async def execute_navix_stream(req: NavixExecuteRequest):
    """
    Primary SSE endpoint for streaming live browser actions, thoughts,
    and base64 viewport frames.
    Uses a dedicated ProactorEventLoop worker thread on Windows to guarantee
    subprocesses support under Uvicorn.
    """
    if not req.goal or not req.goal.strip():
        raise HTTPException(status_code=400, detail="Goal cannot be empty")

    import sys
    import threading

    session_id = req.session_id or f"navix_{hash(req.goal)}"
    agent = NavixAgent(
        goal=req.goal,
        start_url=req.start_url,
        max_steps=req.max_steps or 10,
        headless=req.headless if req.headless is not None else True
    )

    active_sessions[session_id] = agent
    queue: asyncio.Queue = asyncio.Queue()
    main_loop = asyncio.get_running_loop()

    def run_agent_in_proactor_worker():
        if sys.platform == "win32":
            thread_loop = asyncio.WindowsProactorEventLoopPolicy().new_event_loop()
        else:
            thread_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(thread_loop)

        async def _runner():
            try:
                async for event in agent.run():
                    main_loop.call_soon_threadsafe(queue.put_nowait, event)
            except Exception as e:
                logger.error(f"[Navix Runner] Error during agent execution: {e}", exc_info=True)
                main_loop.call_soon_threadsafe(queue.put_nowait, {
                    "type": "error",
                    "error": str(e),
                    "message": f"Autonomous operator error: {e}"
                })
            finally:
                main_loop.call_soon_threadsafe(queue.put_nowait, None)

        try:
            thread_loop.run_until_complete(_runner())
        finally:
            thread_loop.close()

    # Launch autonomous agent in background proactor thread
    t = threading.Thread(target=run_agent_in_proactor_worker, daemon=True)
    t.start()

    async def event_generator():
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                event_data = json.dumps(event)
                yield f"data: {event_data}\n\n"
        except Exception as e:
            logger.error(f"[Navix Route] Stream generator error: {e}")
            err_payload = json.dumps({
                "type": "error",
                "error": str(e),
                "message": "Encountered an error during autonomous browser loop."
            })
            yield f"data: {err_payload}\n\n"
        finally:
            active_sessions.pop(session_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/abort")
async def abort_navix_session(req: AbortRequest):
    """Stop an active autonomous session immediately."""
    agent = active_sessions.get(req.session_id)
    if agent:
        agent.abort()
        active_sessions.pop(req.session_id, None)
        return {"success": True, "message": f"Session {req.session_id} abort initiated."}
    return {"success": False, "message": "Session not found or already terminated."}
