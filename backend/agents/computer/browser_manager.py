import os
import sys
import time
import base64
import queue
import threading
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("aethera.astra.browser")

try:
    from playwright.sync_api import sync_playwright, Playwright, Browser, BrowserContext, Page
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("Playwright is not installed.")

class BrowserWorkerThread(threading.Thread):
    """
    Dedicated worker thread per browser session.
    All Playwright COM and browser operations run strictly on this single thread.
    """
    def __init__(self, session_id: str):
        super().__init__(daemon=True, name=f"AstraBrowserWorker-{session_id}")
        self.session_id = session_id
        self.task_queue = queue.Queue()
        self.running = True
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.last_url: str = "about:blank"
        self.last_title: str = "Astra Engine"
        self.last_screenshot_base64: Optional[str] = None
        self.cursor_position: Tuple[int, int] = (640, 360)
        self.ready_event = threading.Event()
        self.start()
        self.ready_event.wait(timeout=10)

    def run(self):
        try:
            if PLAYWRIGHT_AVAILABLE:
                self.playwright = sync_playwright().start()
                self.browser = self.playwright.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-blink-features=AutomationControlled"
                    ]
                )
                self.context = self.browser.new_context(
                    viewport={"width": 1280, "height": 720},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                )
                self.page = self.context.new_page()
                self.last_url = "https://www.google.com"
                self.last_title = "Astra Browser"
        except Exception as e:
            logger.error(f"Failed to initialize Playwright on worker thread {self.session_id}: {e}")
        finally:
            self.ready_event.set()

        while self.running:
            try:
                task = self.task_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            action, args, kwargs, result_future = task
            try:
                if action == "navigate":
                    res = self._do_navigate(*args, **kwargs)
                elif action == "search_web":
                    res = self._do_search_web(*args, **kwargs)
                elif action == "click_element":
                    res = self._do_click_element(*args, **kwargs)
                elif action == "type_into_element":
                    res = self._do_type_into_element(*args, **kwargs)
                elif action == "scroll_page":
                    res = self._do_scroll_page(*args, **kwargs)
                elif action == "go_back":
                    res = self._do_go_back()
                elif action == "go_forward":
                    res = self._do_go_forward()
                elif action == "refresh":
                    res = self._do_refresh()
                elif action == "get_dom_summary":
                    res = self._do_get_dom_summary()
                elif action == "take_screenshot":
                    res = self._capture_screenshot()
                elif action == "close":
                    self._do_close()
                    res = {"success": True}
                    result_future["result"] = res
                    result_future["event"].set()
                    break
                else:
                    res = {"success": False, "error": f"Unknown action {action}"}
                
                result_future["result"] = res
            except Exception as e:
                result_future["result"] = {"success": False, "error": str(e)}
            finally:
                result_future["event"].set()

    def dispatch(self, action: str, *args, **kwargs) -> Any:
        future = {"event": threading.Event(), "result": None}
        self.task_queue.put((action, args, kwargs, future))
        future["event"].wait(timeout=25)
        return future["result"] or {"success": False, "error": "Operation timed out"}

    def _capture_screenshot(self) -> str:
        if not self.page or self.page.is_closed():
            return self.last_screenshot_base64 or ""
        try:
            b = self.page.screenshot(type="jpeg", quality=75)
            self.last_screenshot_base64 = f"data:image/jpeg;base64,{base64.b64encode(b).decode('utf-8')}"
            return self.last_screenshot_base64
        except Exception as e:
            logger.error(f"Screenshot error: {e}")
            return self.last_screenshot_base64 or ""

    def _do_navigate(self, url: str) -> Dict[str, Any]:
        if not self.page:
            return {"success": False, "error": "Browser page not initialized"}
        target = url.strip()
        if not target.startswith("http://") and not target.startswith("https://"):
            target = f"https://{target}"

        try:
            self.page.goto(target, timeout=12000, wait_until="domcontentloaded")
        except Exception:
            try:
                self.page.goto(target, timeout=8000, wait_until="commit")
            except Exception as e2:
                logger.warning(f"Goto error: {e2}")

        time.sleep(0.5)
        self.last_url = self.page.url
        self.last_title = self.page.title()
        screenshot = self._capture_screenshot()

        return {
            "success": True,
            "url": self.last_url,
            "title": self.last_title,
            "screenshot": screenshot,
            "dom_summary": self._do_get_dom_summary()
        }

    def _do_search_web(self, query: str, engine: str = "google") -> Dict[str, Any]:
        if not self.page:
            return {"success": False, "error": "Browser page not initialized"}

        if "youtube" in self.last_url.lower() or engine.lower() == "youtube" or "youtube" in query.lower():
            target_search_url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
            try:
                self.page.goto(target_search_url, timeout=12000, wait_until="domcontentloaded")
                try:
                    self.page.wait_for_selector("ytd-video-renderer, a#video-title", timeout=5000)
                except Exception:
                    pass
            except Exception as e:
                logger.warning(f"Search goto error: {e}")
        else:
            self._do_navigate(f"https://www.google.com/search?q={query.replace(' ', '+')}")

        time.sleep(1.0)
        self.last_url = self.page.url
        self.last_title = self.page.title()
        screenshot = self._capture_screenshot()

        return {
            "success": True,
            "action": "search_web",
            "query": query,
            "url": self.last_url,
            "title": self.last_title,
            "screenshot": screenshot,
            "dom_summary": self._do_get_dom_summary()
        }

    def _do_click_element(self, selector: str = None, text: str = None, coordinates: Tuple[int, int] = None) -> Dict[str, Any]:
        if not self.page:
            return {"success": False, "error": "Browser page not initialized"}

        target_elem = None
        clicked_pos = (640, 360)

        # 1. Check if user intends to play first video or click first result
        is_video_intent = text and any(v in text.lower() for v in ["first video", "first result", "first one", "play", "play it", "play video", "watch", "song", "video"])
        
        if is_video_intent:
            video_selectors = [
                "ytd-video-renderer a#video-title",
                "ytd-video-renderer a#thumbnail",
                "ytd-video-renderer h3 a",
                "ytd-rich-grid-media a#video-title",
                "ytd-item-section-renderer #video-title",
                "#contents ytd-video-renderer a",
                "a#video-title",
                "a[href*='/watch']"
            ]
            for sel in video_selectors:
                try:
                    target_elem = self.page.query_selector(sel)
                    if target_elem:
                        break
                except Exception:
                    pass

        if not target_elem and selector:
            try:
                target_elem = self.page.query_selector(selector)
            except Exception:
                pass

        if not target_elem and text:
            try:
                target_elem = self.page.query_selector(f"text={text}") or self.page.query_selector(f"a:has-text('{text}'), button:has-text('{text}')")
            except Exception:
                pass

        if target_elem:
            try:
                box = target_elem.bounding_box()
                if box:
                    clicked_pos = (int(box["x"] + box["width"] / 2), int(box["y"] + box["height"] / 2))
                    self.cursor_position = clicked_pos
                target_elem.click(timeout=8000)
            except Exception as click_err:
                logger.warning(f"Direct click failed, attempting javascript click: {click_err}")
                try:
                    target_elem.evaluate("el => el.click()")
                except Exception:
                    pass

            # Wait for video page navigation and ensure player plays
            time.sleep(2.0)
            try:
                self.page.evaluate("""() => {
                    const video = document.querySelector('video');
                    if (video) {
                        video.play().catch(() => {});
                    }
                    // Skip ads button if present
                    const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
                    if (skipBtn) skipBtn.click();
                }""")
            except Exception:
                pass

        elif coordinates:
            x, y = coordinates
            self.cursor_position = (x, y)
            self.page.mouse.click(x, y)
            clicked_pos = (x, y)
        else:
            return {"success": False, "error": f"Element not found text='{text}' selector='{selector}'"}

        time.sleep(1.0)
        self.last_url = self.page.url
        self.last_title = self.page.title()
        screenshot = self._capture_screenshot()

        return {
            "success": True,
            "action": "click_element",
            "clicked_position": clicked_pos,
            "url": self.last_url,
            "title": self.last_title,
            "screenshot": screenshot,
            "dom_summary": self._do_get_dom_summary()
        }

    def _do_type_into_element(self, text: str, selector: str = None, press_enter: bool = True) -> Dict[str, Any]:
        if not self.page:
            return {"success": False, "error": "Browser page not initialized"}

        target_elem = None
        if selector:
            target_elem = self.page.query_selector(selector)
        if not target_elem:
            target_elem = self.page.query_selector("input:focus, textarea:focus, input[type='text'], input[type='search'], input#search")

        if target_elem:
            target_elem.click()
            target_elem.fill("")
            target_elem.type(text, delay=35)
            if press_enter:
                self.page.keyboard.press("Enter")
                time.sleep(1.0)
        else:
            self.page.keyboard.type(text, delay=35)
            if press_enter:
                self.page.keyboard.press("Enter")
                time.sleep(1.0)

        time.sleep(0.5)
        self.last_url = self.page.url
        self.last_title = self.page.title()
        screenshot = self._capture_screenshot()

        return {
            "success": True,
            "action": "type_into_element",
            "typed_text": text,
            "url": self.last_url,
            "title": self.last_title,
            "screenshot": screenshot,
            "dom_summary": self._do_get_dom_summary()
        }

    def _do_scroll_page(self, direction: str = "down", amount: int = 500) -> Dict[str, Any]:
        if not self.page:
            return {"success": False, "error": "Browser not initialized"}
        delta_y = amount if direction.lower() == "down" else -amount
        self.page.mouse.wheel(0, delta_y)
        time.sleep(0.5)
        return {
            "success": True,
            "action": "scroll_page",
            "screenshot": self._capture_screenshot()
        }

    def _do_go_back(self) -> Dict[str, Any]:
        if not self.page:
            return {"success": False}
        self.page.go_back(wait_until="commit")
        time.sleep(0.5)
        self.last_url = self.page.url
        self.last_title = self.page.title()
        return {"success": True, "url": self.last_url, "title": self.last_title, "screenshot": self._capture_screenshot()}

    def _do_go_forward(self) -> Dict[str, Any]:
        if not self.page:
            return {"success": False}
        self.page.go_forward(wait_until="commit")
        time.sleep(0.5)
        self.last_url = self.page.url
        self.last_title = self.page.title()
        return {"success": True, "url": self.last_url, "title": self.last_title, "screenshot": self._capture_screenshot()}

    def _do_refresh(self) -> Dict[str, Any]:
        if not self.page:
            return {"success": False}
        self.page.reload(wait_until="commit")
        time.sleep(0.5)
        return {"success": True, "url": self.page.url, "title": self.page.title(), "screenshot": self._capture_screenshot()}

    def _do_get_dom_summary(self) -> Dict[str, Any]:
        if not self.page or self.page.is_closed():
            return {"headings": [], "inputs": [], "buttons": [], "videos": []}
        try:
            return self.page.evaluate("""() => {
                const res = { headings: [], inputs: [], buttons: [], videos: [] };
                document.querySelectorAll('h1, h2, h3').forEach(h => {
                    const t = h.innerText.trim();
                    if (t && res.headings.length < 4) res.headings.push(t);
                });
                document.querySelectorAll('input, textarea').forEach(inp => {
                    if (inp.offsetParent !== null && res.inputs.length < 4) {
                        res.inputs.push({ placeholder: inp.placeholder || '', id: inp.id || '', value: inp.value || '' });
                    }
                });
                document.querySelectorAll('button, a').forEach(btn => {
                    const t = btn.innerText.trim();
                    if (btn.offsetParent !== null && t && res.buttons.length < 6) {
                        res.buttons.push({ text: t });
                    }
                });
                document.querySelectorAll('ytd-video-renderer, ytd-rich-item-renderer, .video-item').forEach(item => {
                    const titleEl = item.querySelector('#video-title, h3, a');
                    if (titleEl && res.videos.length < 5) {
                        res.videos.push({ title: titleEl.innerText.trim() });
                    }
                });
                return res;
            }""")
        except Exception:
            return {}

    def _do_close(self):
        try:
            if self.page and not self.page.is_closed():
                self.page.close()
            if self.context:
                self.context.close()
            if self.browser:
                self.browser.close()
            if self.playwright:
                self.playwright.stop()
        except Exception:
            pass

class BrowserSession:
    """Thread-safe proxy around the dedicated worker thread."""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.worker = BrowserWorkerThread(session_id)

    @property
    def is_active(self) -> bool:
        return self.worker.running and bool(self.worker.page)

    @property
    def last_url(self) -> str:
        return self.worker.last_url

    @property
    def last_title(self) -> str:
        return self.worker.last_title

    @property
    def last_screenshot_base64(self) -> Optional[str]:
        return self.worker.last_screenshot_base64

    @property
    def cursor_position(self) -> Tuple[int, int]:
        return self.worker.cursor_position

    def navigate(self, url: str) -> Dict[str, Any]:
        return self.worker.dispatch("navigate", url)

    def search_web(self, query: str, engine: str = "google") -> Dict[str, Any]:
        return self.worker.dispatch("search_web", query, engine)

    def click_element(self, selector: str = None, text: str = None, coordinates: Tuple[int, int] = None) -> Dict[str, Any]:
        return self.worker.dispatch("click_element", selector=selector, text=text, coordinates=coordinates)

    def type_into_element(self, text: str, selector: str = None, press_enter: bool = True) -> Dict[str, Any]:
        return self.worker.dispatch("type_into_element", text=text, selector=selector, press_enter=press_enter)

    def scroll_page(self, direction: str = "down", amount: int = 500) -> Dict[str, Any]:
        return self.worker.dispatch("scroll_page", direction=direction, amount=amount)

    def go_back(self) -> Dict[str, Any]:
        return self.worker.dispatch("go_back")

    def go_forward(self) -> Dict[str, Any]:
        return self.worker.dispatch("go_forward")

    def refresh(self) -> Dict[str, Any]:
        return self.worker.dispatch("refresh")

    def get_dom_summary(self) -> Dict[str, Any]:
        return self.worker.dispatch("get_dom_summary")

    def take_screenshot(self) -> str:
        return self.worker.dispatch("take_screenshot")

    def close(self):
        self.worker.dispatch("close")

class SessionManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(SessionManager, cls).__new__(cls)
                cls._instance.sessions: Dict[str, BrowserSession] = {}
        return cls._instance

    def get_or_create(self, session_id: str) -> BrowserSession:
        if session_id not in self.sessions:
            self.sessions[session_id] = BrowserSession(session_id)
        return self.sessions[session_id]

    def get(self, session_id: str) -> Optional[BrowserSession]:
        return self.sessions.get(session_id)

    def close_session(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id].close()
            del self.sessions[session_id]

    def close_all(self):
        for sid, sess in list(self.sessions.items()):
            sess.close()
        self.sessions.clear()

session_manager = SessionManager()
