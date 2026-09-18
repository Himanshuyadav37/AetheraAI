import asyncio
import json
import logging
import re
from typing import AsyncGenerator, Dict, Any, List, Optional
from navix.browser_engine import NavixBrowserEngine
from llm.groq_client import generate_response

logger = logging.getLogger("aethera.navix.agent")

class NavixAgent:
    """
    Autonomous Cognitive Web Operator Agent (Aethera NAVIX).
    Executes multi-step browser navigation, form fills, data extraction,
    and streams real-time visual thought traces.
    """
    def __init__(
        self,
        goal: str,
        start_url: Optional[str] = None,
        max_steps: int = 12,
        headless: bool = True
    ):
        self.goal = goal
        self.start_url = start_url.strip() if start_url and start_url.strip() else ""
        self.max_steps = max(3, min(max_steps, 25))
        self.headless = headless
        self.browser = NavixBrowserEngine(headless=self.headless)
        self.step_history: List[Dict[str, Any]] = []
        self.extracted_items: List[Dict[str, Any]] = []
        self.is_aborted = False

    def abort(self):
        """Signal the agent loop to terminate immediately."""
        self.is_aborted = True
        logger.info("[Navix Agent] Abort requested by user.")

    def _determine_initial_url(self) -> str:
        """Infer direct URL or fallback to Google/DuckDuckGo search."""
        if self.start_url:
            return self.start_url
        
        # Check if goal specifies a direct domain
        url_match = re.search(r"https?://[^\s]+|(?:www\.)?[a-zA-Z0-9-]+\.(?:com|org|io|ai|net|gov|edu|dev)", self.goal)
        if url_match:
            found = url_match.group(0)
            return found if found.startswith("http") else f"https://{found}"
        
        # Default to a fast search portal
        clean_query = self.goal.replace(" ", "+")
        return f"https://duckduckgo.com/?q={clean_query}"

    def _format_elements_table(self, elements: List[Dict[str, Any]]) -> str:
        """Format interactive elements into a high-density, token-efficient table."""
        if not elements:
            return "No obvious interactive elements found."
        lines = []
        for el in elements[:35]:
            label = el['text'] or el.get('placeholder') or el.get('selector') or 'Element'
            lines.append(f"[{el['action_id']}] Tag: <{el['tag']}> | Text: '{label[:40]}' | Selector: {el['selector']}")
        return "\n".join(lines)

    def _clean_llm_json(self, raw_text: str) -> Dict[str, Any]:
        """Extract and parse structured JSON action from LLM response."""
        try:
            # Match outermost json object
            match = re.search(r"\{[\s\S]*\}", raw_text)
            if match:
                parsed = json.loads(match.group(0))
                return parsed
        except Exception as e:
            logger.warning(f"[Navix Agent] JSON parse failed on text: {raw_text[:200]} ({e})")
        
        # Fallback default action
        return {
            "thought": "Browsing and scrolling to inspect page content.",
            "action": "scroll",
            "direction": "down",
            "amount": 500
        }

    async def run(self) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Main autonomous execution generator.
        Yields live SSE-compatible JSON event dictionaries at each micro-step.
        """
        logger.info(f"[Navix Agent] Initializing run with Goal: '{self.goal}'")
        target_url = self._determine_initial_url()

        yield {
            "type": "status",
            "phase": "INITIALIZING",
            "message": "Spawning isolated Playwright Chromium instance...",
            "step": 0,
            "total_steps": self.max_steps,
            "goal": self.goal,
            "url": target_url
        }

        try:
            await self.browser.start()

            yield {
                "type": "status",
                "phase": "NAVIGATING",
                "message": f"Navigating to initial target: {target_url}",
                "step": 0,
                "url": target_url
            }

            nav_res = await self.browser.navigate(target_url)
            screenshot = await self.browser.capture_screenshot_base64()

            yield {
                "type": "step",
                "step": 1,
                "total_steps": self.max_steps,
                "phase": "OBSERVING",
                "thought": f"Arrived at {self.browser.current_url}. Analyzing DOM structure and visual cues.",
                "action": "navigate",
                "target": target_url,
                "url": self.browser.current_url,
                "cursor": self.browser.last_cursor_position,
                "screenshot": screenshot,
                "extracted_data": self.extracted_items
            }

            self.step_history.append({
                "step": 1,
                "action": "navigate",
                "url": self.browser.current_url,
                "thought": "Initial page load"
            })

            # Autonomous Step Loop
            current_step = 2
            while current_step <= self.max_steps and not self.is_aborted:
                # 1. Observe Page
                elements = await self.browser.get_interactive_dom_elements()
                page_text = await self.browser.extract_main_text()
                elements_summary = self._format_elements_table(elements)

                # 2. Formulate LLM Prompt
                prompt = f"""You are Aethera NAVIX, an elite autonomous web operator agent.
User Goal: "{self.goal}"

Current State:
- URL: {self.browser.current_url}
- Interactive Elements on screen:
{elements_summary}

Page text excerpt:
\"\"\"{page_text[:1200]}\"\"\"

Previous actions taken:
{json.dumps(self.step_history[-4:], indent=2)}

Decide the NEXT single best action to advance the goal.
Respond ONLY with a valid JSON object matching one of these action schemas:

1. Click an element:
{{"thought": "...", "action": "click", "target_id": "elem_1", "selector": "#btn-id", "text": "optional button text"}}

2. Type into an input:
{{"thought": "...", "action": "type", "target_id": "elem_2", "selector": "input[type='search']", "value": "search query", "press_enter": true}}

3. Scroll page:
{{"thought": "...", "action": "scroll", "direction": "down", "amount": 600}}

4. Extract data items found on this page:
{{"thought": "...", "action": "extract", "items": [{{"title": "...", "price": "...", "detail": "..."}}]}}

5. Goal completed:
{{"thought": "...", "action": "finish", "summary": "Comprehensive markdown response answering user goal", "extracted_data": [...]}}

Return RAW JSON only. Do not wrap in markdown quotes if possible."""

                yield {
                    "type": "status",
                    "phase": "THINKING",
                    "message": f"Step {current_step}: Reasoner analyzing next browser interaction...",
                    "step": current_step
                }

                llm_response = generate_response(prompt, max_tokens=1024)
                decision = self._clean_llm_json(llm_response)

                action_type = decision.get("action", "scroll").lower()
                thought = decision.get("thought", f"Executing {action_type} action.")

                logger.info(f"[Navix Agent] Step {current_step} Decision: {decision}")

                # 3. Execute Decision
                if action_type == "click":
                    target_id = decision.get("target_id")
                    selector = decision.get("selector")
                    text = decision.get("text")

                    # Resolve target_id if provided
                    if target_id:
                        for el in elements:
                            if el["action_id"] == target_id:
                                selector = el["selector"]
                                text = el["text"]
                                break

                    await self.browser.click(selector=selector, text=text)

                elif action_type == "type":
                    target_id = decision.get("target_id")
                    selector = decision.get("selector", "input")
                    value = decision.get("value", "")
                    press_enter = decision.get("press_enter", True)

                    if target_id:
                        for el in elements:
                            if el["action_id"] == target_id:
                                selector = el["selector"]
                                break

                    await self.browser.type_text(selector=selector, text=value, press_enter=press_enter)

                elif action_type == "scroll":
                    direction = decision.get("direction", "down")
                    amount = decision.get("amount", 500)
                    await self.browser.scroll(direction=direction, amount=amount)

                elif action_type == "navigate":
                    url = decision.get("url")
                    if url:
                        await self.browser.navigate(url)

                elif action_type == "extract":
                    new_items = decision.get("items", [])
                    if isinstance(new_items, list):
                        self.extracted_items.extend(new_items)

                elif action_type == "finish":
                    summary = decision.get("summary", "Task executed and findings compiled successfully.")
                    final_data = decision.get("extracted_data", [])
                    if isinstance(final_data, list) and final_data:
                        self.extracted_items.extend(final_data)

                    screenshot = await self.browser.capture_screenshot_base64()
                    yield {
                        "type": "step",
                        "step": current_step,
                        "total_steps": self.max_steps,
                        "phase": "COMPLETED",
                        "thought": thought,
                        "action": "finish",
                        "url": self.browser.current_url,
                        "cursor": self.browser.last_cursor_position,
                        "screenshot": screenshot,
                        "summary": summary,
                        "extracted_data": self.extracted_items
                    }
                    break

                # Post-action observation & visual capture
                screenshot = await self.browser.capture_screenshot_base64()
                
                # Check for any inline extracted data in any action
                if "extracted_data" in decision and isinstance(decision["extracted_data"], list):
                    self.extracted_items.extend(decision["extracted_data"])

                self.step_history.append({
                    "step": current_step,
                    "action": action_type,
                    "url": self.browser.current_url,
                    "thought": thought
                })

                yield {
                    "type": "step",
                    "step": current_step,
                    "total_steps": self.max_steps,
                    "phase": "EXECUTED",
                    "thought": thought,
                    "action": action_type,
                    "action_detail": decision,
                    "url": self.browser.current_url,
                    "cursor": self.browser.last_cursor_position,
                    "screenshot": screenshot,
                    "extracted_data": self.extracted_items
                }

                current_step += 1
                await asyncio.sleep(0.8)

            # Final summary generation if loop naturally finished
            if not self.is_aborted and action_type != "finish":
                final_text = await self.browser.extract_main_text()
                sum_prompt = f"Summarize the outcome of this web operation for goal: '{self.goal}'. Extracted web text: {final_text[:2000]}. Provide clear, markdown formatted conclusions."
                final_summary = generate_response(sum_prompt, max_tokens=1000)
                final_screenshot = await self.browser.capture_screenshot_base64()

                yield {
                    "type": "step",
                    "step": current_step,
                    "total_steps": self.max_steps,
                    "phase": "COMPLETED",
                    "thought": "Reached final step limit. Compiled executive findings report.",
                    "action": "finish",
                    "url": self.browser.current_url,
                    "cursor": self.browser.last_cursor_position,
                    "screenshot": final_screenshot,
                    "summary": final_summary,
                    "extracted_data": self.extracted_items
                }

        except Exception as e:
            logger.error(f"[Navix Agent] Unhandled error during execution: {e}", exc_info=True)
            yield {
                "type": "error",
                "phase": "FAILED",
                "error": str(e),
                "message": f"Autonomous operator encountered an issue: {e}"
            }
        finally:
            logger.info("[Navix Agent] Closing browser session...")
            await self.browser.close()
            yield {
                "type": "status",
                "phase": "IDLE",
                "message": "Operator session ended. Browser instance terminated."
            }
