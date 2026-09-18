import asyncio
import base64
import logging
from typing import Optional, Dict, Any, List
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logger = logging.getLogger("nexusai.navix.browser")

class NavixBrowserEngine:
    """
    Enterprise-grade Async Playwright controller for autonomous web operations.
    Handles viewport emulation, element interaction, token-efficient DOM pruning,
    and real-time base64 frame streaming.
    """
    def __init__(self, headless: bool = True, viewport_width: int = 1280, viewport_height: int = 800):
        self.headless = headless
        self.viewport_width = viewport_width
        self.viewport_height = viewport_height
        self._pw = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.current_url: str = "about:blank"
        self.last_cursor_position: Dict[str, int] = {"x": 0, "y": 0}

    async def start(self) -> None:
        """Launch the Chromium instance and create an active page session."""
        if self.browser:
            return

        logger.info("[Navix Browser] Launching Playwright Chromium instance...")
        self._pw = await async_playwright().start()
        
        launch_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
            "--disable-blink-features=AutomationControlled",
        ]

        self.browser = await self._pw.chromium.launch(
            headless=self.headless,
            args=launch_args
        )

        self.context = await self.browser.new_context(
            viewport={"width": self.viewport_width, "height": self.viewport_height},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            locale="en-US",
            timezone_id="America/New_York",
            device_scale_factor=1,
            ignore_https_errors=True
        )

        self.page = await self.context.new_page()
        # Prevent webdriver detection
        await self.page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)
        logger.info("[Navix Browser] Browser session initialized successfully.")

    async def close(self) -> None:
        """Gracefully terminate page, context, and browser."""
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self._pw:
                await self._pw.stop()
        except Exception as e:
            logger.warning(f"[Navix Browser] Teardown warning: {e}")
        finally:
            self.page = None
            self.context = None
            self.browser = None
            self._pw = None

    async def navigate(self, url: str) -> Dict[str, Any]:
        """Navigate to a target URL with automatic scheme resolution and wait."""
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url

        logger.info(f"[Navix Browser] Navigating to: {url}")
        try:
            response = await self.page.goto(url, wait_until="domcontentloaded", timeout=25000)
            # Brief pause for dynamic hydration
            await asyncio.sleep(1.2)
            self.current_url = self.page.url
            status = response.status if response else 200
            return {
                "success": True,
                "url": self.current_url,
                "status": status,
                "title": await self.page.title()
            }
        except Exception as e:
            logger.error(f"[Navix Browser] Navigation error for {url}: {e}")
            self.current_url = self.page.url if self.page else url
            return {
                "success": False,
                "url": self.current_url,
                "error": str(e)
            }

    async def click(self, selector: Optional[str] = None, text: Optional[str] = None) -> Dict[str, Any]:
        """Click on an element using CSS selector or text heuristic, tracking coordinates."""
        if not self.page:
            return {"success": False, "error": "No active page"}

        logger.info(f"[Navix Browser] Attempting click -> selector: {selector}, text: {text}")
        try:
            locator = None
            if selector and selector.strip():
                locator = self.page.locator(selector).first
            elif text and text.strip():
                locator = self.page.get_by_text(text, exact=False).first

            if not locator or await locator.count() == 0:
                # Fallback: try role or broad locator
                if text:
                    locator = self.page.locator(f"button:has-text('{text}'), a:has-text('{text}')").first

            if locator and await locator.count() > 0:
                box = await locator.bounding_box()
                if box:
                    self.last_cursor_position = {
                        "x": int(box["x"] + box["width"] / 2),
                        "y": int(box["y"] + box["height"] / 2)
                    }
                await locator.click(timeout=6000)
                await asyncio.sleep(1.0)
                self.current_url = self.page.url
                return {
                    "success": True,
                    "cursor": self.last_cursor_position,
                    "url": self.current_url
                }
            return {"success": False, "error": f"Element not found (selector: {selector}, text: {text})"}
        except Exception as e:
            logger.warning(f"[Navix Browser] Click failed: {e}")
            return {"success": False, "error": str(e)}

    async def type_text(self, selector: str, text: str, press_enter: bool = False) -> Dict[str, Any]:
        """Type string into an input element with optional Enter submission."""
        if not self.page:
            return {"success": False, "error": "No active page"}

        logger.info(f"[Navix Browser] Typing into {selector}: '{text}' (Enter: {press_enter})")
        try:
            locator = self.page.locator(selector).first
            if await locator.count() == 0:
                # Fallback: try finding first input or textarea if selector is generic
                locator = self.page.locator("input[type='text'], input[type='search'], input:not([type='hidden']), textarea").first

            box = await locator.bounding_box()
            if box:
                self.last_cursor_position = {
                    "x": int(box["x"] + box["width"] / 2),
                    "y": int(box["y"] + box["height"] / 2)
                }

            await locator.click()
            await locator.fill("")
            await locator.type(text, delay=25)
            
            if press_enter:
                await self.page.keyboard.press("Enter")
                await asyncio.sleep(1.5)
            else:
                await asyncio.sleep(0.5)

            self.current_url = self.page.url
            return {
                "success": True,
                "cursor": self.last_cursor_position,
                "url": self.current_url
            }
        except Exception as e:
            logger.warning(f"[Navix Browser] Typing failed: {e}")
            return {"success": False, "error": str(e)}

    async def scroll(self, direction: str = "down", amount: int = 500) -> Dict[str, Any]:
        """Scroll page up or down."""
        if not self.page:
            return {"success": False, "error": "No active page"}

        delta = amount if direction.lower() == "down" else -amount
        await self.page.evaluate(f"window.scrollBy(0, {delta});")
        await asyncio.sleep(0.6)
        return {"success": True, "direction": direction, "amount": amount}

    async def capture_screenshot_base64(self) -> str:
        """Capture optimized JPEG base64 screenshot for real-time frontend streaming."""
        if not self.page:
            return ""
        try:
            img_bytes = await self.page.screenshot(type="jpeg", quality=75)
            encoded = base64.b64encode(img_bytes).decode("utf-8")
            return f"data:image/jpeg;base64,{encoded}"
        except Exception as e:
            logger.warning(f"[Navix Browser] Screenshot capture failed: {e}")
            return ""

    async def get_interactive_dom_elements(self) -> List[Dict[str, Any]]:
        """
        Token-efficient DOM scanner that extracts clickable and input elements
        with coordinate positions, tags, classes, and visible labels.
        """
        if not self.page:
            return []

        js_script = """
        () => {
            const elements = [];
            const candidates = document.querySelectorAll(
                'button, a[href], input, textarea, select, [role="button"], [role="link"], [role="searchbox"], [onclick]'
            );
            
            let idCounter = 1;
            candidates.forEach((el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                
                // Filter out non-visible elements
                if (rect.width <= 4 || rect.height <= 4 || style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
                    return;
                }
                
                // Build a reliable CSS selector
                let selector = '';
                if (el.id) {
                    selector = `#${el.id}`;
                } else if (el.name) {
                    selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
                } else if (el.getAttribute('placeholder')) {
                    selector = `${el.tagName.toLowerCase()}[placeholder="${el.getAttribute('placeholder')}"]`;
                } else if (el.getAttribute('aria-label')) {
                    selector = `${el.tagName.toLowerCase()}[aria-label="${el.getAttribute('aria-label')}"]`;
                } else {
                    const tag = el.tagName.toLowerCase();
                    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
                    selector = `${tag}${cls}`;
                }

                const text = (el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim();
                
                elements.push({
                    action_id: `elem_${idCounter++}`,
                    tag: el.tagName.toLowerCase(),
                    type: el.type || null,
                    selector: selector,
                    text: text.slice(0, 100),
                    placeholder: el.getAttribute('placeholder') || null,
                    href: el.getAttribute('href') || null,
                    x: Math.round(rect.x + rect.width / 2),
                    y: Math.round(rect.y + rect.height / 2)
                });
            });
            return elements.slice(0, 45); // Return top 45 salient interactive elements
        }
        """
        try:
            return await self.page.evaluate(js_script)
        except Exception as e:
            logger.warning(f"[Navix Browser] Interactive element extraction failed: {e}")
            return []

    async def extract_main_text(self) -> str:
        """Extract primary page text content for context analysis and data extraction."""
        if not self.page:
            return ""
        js_extract = """
        () => {
            const body = document.body;
            if (!body) return '';
            const clone = body.cloneNode(true);
            const scripts = clone.querySelectorAll('script, style, noscript, svg, nav, footer');
            scripts.forEach(s => s.remove());
            return clone.innerText.slice(0, 4000);
        }
        """
        try:
            return await self.page.evaluate(js_extract)
        except Exception:
            return ""
