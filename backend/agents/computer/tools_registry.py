import os
import subprocess
from typing import Dict, Any, List, Tuple
from agents.computer.browser_manager import session_manager

# Action Safety Classification
SAFE_ACTIONS = {
    "open_browser", "navigate", "search_web", "click_element",
    "type_into_element", "scroll_page", "go_back", "go_forward",
    "refresh", "open_tab", "close_tab", "get_current_url",
    "get_page_title", "inspect_page", "take_screenshot",
    "get_running_applications", "get_screen_state", "get_active_application",
    "inspect_system"
}

SENSITIVE_ACTIONS = {
    "delete_file", "send_message", "send_email", "submit_form",
    "purchase_item", "modify_system_settings", "execute_privileged_bash"
}

TOOLS_DEFINITIONS = [
    {
        "name": "open_browser",
        "description": "Open or focus the persistent browser on a target URL.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to open (e.g. 'https://youtube.com' or 'https://google.com')"}
            },
            "required": ["url"]
        },
        "is_sensitive": False
    },
    {
        "name": "navigate",
        "description": "Navigate active browser to a new URL.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "Destination URL"}
            },
            "required": ["url"]
        },
        "is_sensitive": False
    },
    {
        "name": "search_web",
        "description": "Search on Google, YouTube, or current active platform.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword or phrase"},
                "engine": {"type": "string", "enum": ["google", "youtube"], "default": "google"}
            },
            "required": ["query"]
        },
        "is_sensitive": False
    },
    {
        "name": "click_element",
        "description": "Click a button, link, video thumbnail, or element by text or selector.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Visible text or label on the element (e.g. 'first video', 'Subscribe', 'Python Tutorial')"},
                "selector": {"type": "string", "description": "CSS selector if known (e.g. 'button.submit')"},
                "coordinates": {"type": "array", "items": {"type": "integer"}, "description": "[x, y] screen coordinates fallback"}
            }
        },
        "is_sensitive": False
    },
    {
        "name": "type_into_element",
        "description": "Type text into a search bar, input field, or textarea.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text to type"},
                "selector": {"type": "string", "description": "CSS selector of input (optional)"},
                "press_enter": {"type": "boolean", "default": True, "description": "Whether to press Enter after typing"}
            },
            "required": ["text"]
        },
        "is_sensitive": False
    },
    {
        "name": "scroll_page",
        "description": "Scroll active page up or down.",
        "parameters": {
            "type": "object",
            "properties": {
                "direction": {"type": "string", "enum": ["down", "up"], "default": "down"},
                "amount": {"type": "integer", "default": 500}
            }
        },
        "is_sensitive": False
    },
    {
        "name": "go_back",
        "description": "Navigate back in browser history.",
        "parameters": {"type": "object", "properties": {}},
        "is_sensitive": False
    },
    {
        "name": "go_forward",
        "description": "Navigate forward in browser history.",
        "parameters": {"type": "object", "properties": {}},
        "is_sensitive": False
    },
    {
        "name": "refresh",
        "description": "Reload active page.",
        "parameters": {"type": "object", "properties": {}},
        "is_sensitive": False
    },
    {
        "name": "take_screenshot",
        "description": "Capture current real-time viewport screenshot.",
        "parameters": {"type": "object", "properties": {}},
        "is_sensitive": False
    },
    {
        "name": "open_application",
        "description": "Open a desktop application (e.g. 'notepad', 'calc', 'explorer', 'code').",
        "parameters": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string", "description": "Name or command of application"}
            },
            "required": ["app_name"]
        },
        "is_sensitive": False
    },
    {
        "name": "delete_file",
        "description": "Delete a file or folder from disk (Requires Confirmation).",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path to file to delete"}
            },
            "required": ["path"]
        },
        "is_sensitive": True
    }
]

from agents.computer.native_device_controller import native_controller

def execute_registered_tool(tool_name: str, params: Dict[str, Any], session_id: str) -> Dict[str, Any]:
    """
    Execute tool against the user's real host desktop computer and browser.
    Controls the real default browser (Chrome/Edge), clicks on real screen, and launches native software.
    """
    try:
        if tool_name in ("open_browser", "navigate"):
            url = params.get("url", "https://www.youtube.com")
            return native_controller.open_native_browser(url)

        elif tool_name == "search_web":
            query = params.get("query", "")
            engine = params.get("engine", "youtube")
            return native_controller.search_native_web(query, engine)

        elif tool_name == "click_element":
            text = (params.get("text") or "").lower()
            coords = params.get("coordinates")
            
            # If user wants to play video / first result
            if any(v in text for v in ["first video", "first result", "play", "play it", "play video", "watch", "song"]):
                return native_controller.play_native_video()
            elif coords:
                return native_controller.click_native_mouse(coords[0], coords[1])
            else:
                return native_controller.click_native_mouse()

        elif tool_name == "type_into_element":
            text = params.get("text", "")
            press_enter = params.get("press_enter", True)
            return native_controller.type_native_keyboard(text, press_enter=press_enter)

        elif tool_name == "scroll_page":
            direction = params.get("direction", "down")
            amount = params.get("amount", 500)
            try:
                import pyautogui
                clicks = -amount // 100 if direction == "down" else amount // 100
                pyautogui.scroll(clicks)
            except Exception:
                pass
            screenshot = native_controller.capture_desktop_screenshot()
            return {"success": True, "action": "scroll", "screenshot": screenshot}

        elif tool_name == "go_back":
            return native_controller.press_native_hotkey("alt", "left")

        elif tool_name == "go_forward":
            return native_controller.press_native_hotkey("alt", "right")

        elif tool_name == "refresh":
            return native_controller.press_native_hotkey("f5")

        elif tool_name == "take_screenshot":
            screenshot = native_controller.capture_desktop_screenshot()
            return {
                "success": True,
                "screenshot": screenshot,
                "url": native_controller.last_url,
                "title": native_controller.last_title
            }

        elif tool_name == "open_application":
            app = params.get("app_name", "notepad")
            return native_controller.open_native_application(app)

        else:
            return {"success": False, "error": f"Tool '{tool_name}' not implemented."}
    except Exception as e:
        return {"success": False, "error": f"Native device tool execution failed: {str(e)}"}



