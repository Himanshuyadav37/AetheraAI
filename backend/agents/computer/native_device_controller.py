import os
import sys
import time
import io
import base64
import ctypes
import subprocess
import webbrowser
import logging
from typing import Dict, Any, Optional, Tuple
from PIL import Image

logger = logging.getLogger("aethera.astra.native")

class NativeDeviceController:
    """
    Direct Native Host OS Controller for Astra Agent.
    Operates real local desktop applications, browsers, mouse/keyboard, and screen capture.
    """

    def __init__(self):
        self.last_url: str = "Host Desktop Environment"
        self.last_title: str = "Windows Host OS"
        self.last_screenshot_base64: str = ""
        self.cursor_position: Tuple[int, int] = (640, 360)

    def capture_desktop_screenshot(self) -> str:
        """Capture real active Windows desktop screen using low-level GDI."""
        try:
            user32 = ctypes.windll.user32
            gdi32 = ctypes.windll.gdi32
            
            w = user32.GetSystemMetrics(0)
            h = user32.GetSystemMetrics(1)
            
            hdc = user32.GetDC(0)
            cdc = gdi32.CreateCompatibleDC(hdc)
            hbmp = gdi32.CreateCompatibleBitmap(hdc, w, h)
            gdi32.SelectObject(cdc, hbmp)
            gdi32.BitBlt(cdc, 0, 0, w, h, hdc, 0, 0, 0x00CC0020)

            class BITMAPINFOHEADER(ctypes.Structure):
                _fields_ = [
                    ('biSize', ctypes.c_uint32),
                    ('biWidth', ctypes.c_int32),
                    ('biHeight', ctypes.c_int32),
                    ('biPlanes', ctypes.c_uint16),
                    ('biBitCount', ctypes.c_uint16),
                    ('biCompression', ctypes.c_uint32),
                    ('biSizeImage', ctypes.c_uint32),
                    ('biXPelsPerMeter', ctypes.c_int32),
                    ('biYPelsPerMeter', ctypes.c_int32),
                    ('biClrUsed', ctypes.c_uint32),
                    ('biClrImportant', ctypes.c_uint32)
                ]

            bmi = BITMAPINFOHEADER()
            bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
            bmi.biWidth = w
            bmi.biHeight = -h
            bmi.biPlanes = 1
            bmi.biBitCount = 32
            bmi.biCompression = 0

            buf = (ctypes.c_char * (w * h * 4))()
            gdi32.GetDIBits(cdc, hbmp, 0, h, buf, ctypes.byref(bmi), 0)
            gdi32.DeleteObject(hbmp)
            gdi32.DeleteDC(cdc)
            user32.ReleaseDC(0, hdc)

            img = Image.frombuffer('RGBA', (w, h), buf, 'raw', 'BGRA', 0, 1)
            img = img.convert('RGB')
            img.thumbnail((1280, 720))
            
            out_buf = io.BytesIO()
            img.save(out_buf, format='JPEG', quality=70)
            b64 = "data:image/jpeg;base64," + base64.b64encode(out_buf.getvalue()).decode("utf-8")
            self.last_screenshot_base64 = b64
            return b64
        except Exception as e:
            logger.warning(f"Error capturing real desktop screenshot: {e}")
            return self.last_screenshot_base64 or ""

    def get_active_window_title(self) -> str:
        """Get the title of currently focused application on the user's host OS."""
        try:
            user32 = ctypes.windll.user32
            hwnd = user32.GetForegroundWindow()
            length = user32.GetWindowTextLengthW(hwnd)
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buff, length + 1)
            title = buff.value
            if title:
                self.last_title = title
                return title
        except Exception as e:
            logger.debug(f"Could not get active window title: {e}")
        return self.last_title

    def open_native_browser(self, url: str) -> Dict[str, Any]:
        """Launch URL directly in the user's actual default browser on their local machine."""
        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"https://{url}"

        try:
            # Open directly in Windows default browser
            if sys.platform == "win32":
                os.system(f'start "" "{url}"')
            else:
                webbrowser.open(url)
            
            time.sleep(2.0)
            self.last_url = url
            self.get_active_window_title()
            screenshot = self.capture_desktop_screenshot()

            return {
                "success": True,
                "action": "open_native_browser",
                "target": "real_device",
                "url": url,
                "title": self.last_title,
                "screenshot": screenshot,
                "message": f"Opened {url} on your desktop."
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to open browser on device: {str(e)}"}

    def search_native_web(self, query: str, engine: str = "youtube") -> Dict[str, Any]:
        """Execute search on user's real computer desktop without spawning duplicate windows."""
        import pyautogui

        if "youtube" in engine.lower() or "youtube" in query.lower() or "youtube" in self.last_url.lower():
            target_url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
        else:
            target_url = f"https://www.google.com/search?q={query.replace(' ', '+')}"

        try:
            # 1. Try to update current active tab via Address bar hotkey (Ctrl + L) to avoid extra windows
            pyautogui.hotkey("ctrl", "l")
            time.sleep(0.2)
            pyautogui.write(target_url, interval=0.01)
            pyautogui.press("enter")
            time.sleep(2.0)
            self.last_url = target_url
            self.get_active_window_title()
            screenshot = self.capture_desktop_screenshot()
            return {
                "success": True,
                "action": "search_native_web",
                "target": "real_device",
                "query": query,
                "url": target_url,
                "title": self.last_title,
                "screenshot": screenshot,
                "message": f"Searched for {query} on your desktop."
            }
        except Exception:
            # Fallback to direct launch
            return self.open_native_browser(target_url)

    def play_native_video(self) -> Dict[str, Any]:
        """Click and play the first video on the user's active desktop screen."""
        import pyautogui

        try:
            # On YouTube search results, click the first video thumbnail position (center-left)
            screen_w = ctypes.windll.user32.GetSystemMetrics(0)
            screen_h = ctypes.windll.user32.GetSystemMetrics(1)
            
            # Click the primary video result area on screen
            click_x = int(screen_w * 0.42)
            click_y = int(screen_h * 0.38)
            
            pyautogui.click(click_x, click_y)
            time.sleep(1.5)
            
            # Press Space or 'k' to ensure playback
            pyautogui.press("space")
            time.sleep(0.5)

            self.get_active_window_title()
            screenshot = self.capture_desktop_screenshot()

            return {
                "success": True,
                "action": "play_native_video",
                "target": "real_device",
                "title": self.last_title,
                "screenshot": screenshot,
                "message": "Playing the video on your desktop."
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to play video on desktop: {str(e)}"}

    def toggle_playback(self) -> Dict[str, Any]:
        """Toggle play/pause on the active video window on user's real desktop."""
        import pyautogui
        try:
            pyautogui.press("space")
            screenshot = self.capture_desktop_screenshot()
            return {"success": True, "action": "toggle_playback", "screenshot": screenshot}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_native_application(self, app_name: str) -> Dict[str, Any]:
        """Launch actual desktop software (e.g. Notepad, Calc, Spotify, Chrome, VS Code) on user's PC."""
        app_map = {
            "notepad": "notepad.exe",
            "calculator": "calc.exe",
            "calc": "calc.exe",
            "explorer": "explorer.exe",
            "files": "explorer.exe",
            "file manager": "explorer.exe",
            "chrome": "start chrome",
            "edge": "start msedge",
            "cmd": "start cmd",
            "terminal": "start wt",
            "vscode": "code .",
            "code": "code ."
        }

        cmd = app_map.get(app_name.lower().strip(), app_name)
        try:
            subprocess.Popen(cmd, shell=True)
            time.sleep(1.0)
            self.get_active_window_title()
            screenshot = self.capture_desktop_screenshot()

            return {
                "success": True,
                "action": "open_native_application",
                "target": "real_device",
                "app": app_name,
                "title": self.last_title,
                "screenshot": screenshot,
                "message": f"Launched {app_name} on your device."
            }
        except Exception as e:
            return {"success": False, "error": f"Failed to launch app '{app_name}': {str(e)}"}

    def click_native_mouse(self, x: Optional[int] = None, y: Optional[int] = None) -> Dict[str, Any]:
        """Move and click actual mouse on the user's host OS screen."""
        try:
            import pyautogui
            if x is not None and y is not None:
                pyautogui.moveTo(x, y, duration=0.2)
                pyautogui.click(x, y)
                self.cursor_position = (x, y)
            else:
                pyautogui.click()

            time.sleep(0.5)
            screenshot = self.capture_desktop_screenshot()
            return {"success": True, "action": "click", "position": self.cursor_position, "screenshot": screenshot}
        except Exception as e:
            return {"success": False, "error": f"Mouse click failed: {str(e)}"}

    def type_native_keyboard(self, text: str, press_enter: bool = True) -> Dict[str, Any]:
        """Type text directly into the user's active desktop window."""
        try:
            import pyautogui
            pyautogui.write(text, interval=0.03)
            if press_enter:
                pyautogui.press("enter")

            time.sleep(0.5)
            screenshot = self.capture_desktop_screenshot()
            return {"success": True, "action": "type", "text": text, "screenshot": screenshot}
        except Exception as e:
            return {"success": False, "error": f"Keyboard typing failed: {str(e)}"}

    def press_native_hotkey(self, *keys: str) -> Dict[str, Any]:
        """Press system hotkey (e.g. ['ctrl', 't'], ['alt', 'tab']) on host OS."""
        try:
            import pyautogui
            pyautogui.hotkey(*keys)
            time.sleep(0.5)
            screenshot = self.capture_desktop_screenshot()
            return {"success": True, "action": "hotkey", "keys": list(keys), "screenshot": screenshot}
        except Exception as e:
            return {"success": False, "error": f"Hotkey failed: {str(e)}"}

# Global singleton for host computer control
native_controller = NativeDeviceController()

