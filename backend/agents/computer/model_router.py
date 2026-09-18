import json
import logging
import requests
from typing import Dict, Any, List, Optional
from config import settings
from llm.groq_client import generate_response as groq_generate

logger = logging.getLogger("aethera.astra.router")

def call_gemini_model(prompt: str, system_prompt: str = None, max_tokens: int = 4096) -> Optional[str]:
    """Call Google Gemini 3.6 Flash for advanced multimodal & intent reasoning."""
    gemini_key = getattr(settings, "GEMINI_API_KEY", "")
    if not gemini_key or not gemini_key.strip():
        return None

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={gemini_key.strip()}"
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": f"System Instructions:\n{system_prompt}"}]})
            contents.append({"role": "model", "parts": [{"text": "Understood. I will operate strictly as instructed."}]})
        
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": max_tokens
            }
        }
        res = requests.post(url, json=payload, timeout=4)
        if res.status_code == 200:
            res_json = res.json()
            candidates = res_json.get("candidates", [])
            if candidates and "content" in candidates[0]:
                parts = candidates[0]["content"].get("parts", [])
                if parts and "text" in parts[0]:
                    return parts[0]["text"]
    except Exception as e:
        logger.warning(f"Gemini router fallback error: {e}")
    return None

def generate_astra_plan(prompt: str, context_state: Dict[str, Any], history: List[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Decide the next action and voice feedback using fast heuristics + Gemini primary + Groq fallback.
    """
    clean_p = prompt.strip().lower()
    curr_url = (context_state.get("current_url") or "").lower()

    # Fast-Path Deterministic Heuristics (Instant sub-10ms response)
    # 1. Open YouTube / Variations
    if any(clean_p.startswith(x) or clean_p == x for x in ["open youtube", "open youtbe", "open yt", "youtube.com", "launch youtube", "go to youtube"]):
        return {
            "thought": "Direct navigation to YouTube.",
            "action": {"tool": "open_browser", "params": {"url": "https://www.youtube.com"}, "requires_approval": False},
            "voice_response": "YouTube is open. What would you like to search?",
            "is_finished": False
        }

    # 2. Open Google / Search engine
    if any(clean_p.startswith(x) or clean_p == x for x in ["open google", "launch google", "google.com", "go to google"]):
        return {
            "thought": "Direct navigation to Google Search.",
            "action": {"tool": "open_browser", "params": {"url": "https://www.google.com"}, "requires_approval": False},
            "voice_response": "Google is open.",
            "is_finished": False
        }

    # 3. Play first video / click first video / play it
    if any(x in clean_p for x in ["play the first video", "play first video", "play the first one", "click first video", "play 1st video", "play it", "play this", "play video", "play song", "play the video", "first video"]):
        return {
            "thought": "Clicking the first video on the page.",
            "action": {"tool": "click_element", "params": {"text": "first video"}, "requires_approval": False},
            "voice_response": "Playing the video.",
            "is_finished": False
        }

    # 4. Search on active platform (e.g. YouTube or Google)
    if clean_p.startswith("search ") or clean_p.startswith("find ") or clean_p.startswith("search for "):
        q = clean_p.replace("search for ", "").replace("search ", "").replace("find ", "").strip()
        engine = "youtube" if "youtube" in curr_url or "youtube" in clean_p or any("youtube" in (m.get("content","").lower()) for m in (history or [])) else "google"
        return {
            "thought": f"Searching for '{q}' on {engine}.",
            "action": {"tool": "search_web", "params": {"query": q, "engine": engine}, "requires_approval": False},
            "voice_response": f"Searching for {q} on {engine.capitalize()}.",
            "is_finished": False
        }

    # 5. Go Back / Forward / Refresh
    if clean_p in ["go back", "back", "previous page"]:
        return {
            "thought": "Navigating to previous page.",
            "action": {"tool": "go_back", "params": {}},
            "voice_response": "Going back.",
            "is_finished": False
        }
    if clean_p in ["go forward", "forward", "next page"]:
        return {
            "thought": "Navigating forward in history.",
            "action": {"tool": "go_forward", "params": {}},
            "voice_response": "Going forward.",
            "is_finished": False
        }
    if clean_p in ["refresh", "reload", "refresh page"]:
        return {
            "thought": "Reloading the current page.",
            "action": {"tool": "refresh", "params": {}},
            "voice_response": "Page refreshed.",
            "is_finished": False
        }

    system_prompt = """You are Astra, the elite Autonomous AI Computer & Browser Agent of Aethera OS.
You operate the computer and persistent browser in real-time.
You have continuous multi-turn memory.

RULES:
1. ALWAYS remember the current application and active webpage state.
2. If the user says "search Python", and the current page is YouTube, use YouTube search directly (`search_web` with engine="youtube").
3. If the user says "play the first video" or "play the first one", click the first video thumbnail (`click_element` with text="first video").
4. If the user says "go back", use go_back tool.
5. If the user says "close it", close the active application/tab.
6. Provide a concise, natural, warm spoken response in "voice_response" (e.g. "YouTube is open. What would you like to search?", "Playing the first video.").
7. Choose the single best tool to execute from:
   - `open_browser` { "url": "..." }
   - `navigate` { "url": "..." }
   - `search_web` { "query": "...", "engine": "google" | "youtube" }
   - `click_element` { "text": "first video" | "..." , "selector": "..." }
   - `type_into_element` { "text": "...", "selector": "...", "press_enter": true }
   - `scroll_page` { "direction": "down" | "up", "amount": 500 }
   - `go_back` {}
   - `go_forward` {}
   - `refresh` {}
   - `open_application` { "app_name": "notepad" | "..." }
   - `none` {}

Return STRICT JSON:
{
  "thought": "Internal reasoning about current state and user intent.",
  "action": {
    "tool": "open_browser" | "search_web" | "click_element" | "type_into_element" | "scroll_page" | "go_back" | "open_application" | "none",
    "params": { ... },
    "requires_approval": false,
    "approval_reason": ""
  },
  "voice_response": "Short natural spoken response to the user.",
  "is_finished": true
}
"""

    context_str = json.dumps(context_state, indent=2)
    history_str = ""
    if history:
        for m in history[-6:]:
            history_str += f"{m.get('role', 'user').upper()}: {m.get('content', '')}\n"

    user_query = f"""CURRENT ACTIVE CONTEXT:
{context_str}

RECENT CONVERSATION HISTORY:
{history_str if history_str else 'Start of new session'}

USER COMMAND:
{prompt}

Decide next action in JSON format:"""

    # 1. Try Gemini 3.6 Flash with 4s timeout
    gemini_out = call_gemini_model(user_query, system_prompt=system_prompt)
    if gemini_out:
        try:
            cleaned = gemini_out.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0].strip()
            return json.loads(cleaned)
        except Exception:
            pass

    # 2. Ultra-fast Groq fallback
    try:
        groq_prompt = f"{system_prompt}\n\n{user_query}"
        groq_out = groq_generate(groq_prompt, max_tokens=1024)
        cleaned = groq_out.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()
        return json.loads(cleaned)
    except Exception as e:
        logger.error(f"Groq fallback failed: {e}")
        return {
            "thought": "Direct execution fallback.",
            "action": {"tool": "none", "params": {}},
            "voice_response": f"I processed your request: {prompt}",
            "is_finished": True
        }
