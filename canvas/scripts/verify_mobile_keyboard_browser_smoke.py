from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get("KG_MOBILE_KEYBOARD_SMOKE_BASE_URL", "http://localhost:4177").rstrip("/")
TARGET_URL = f"{BASE_URL}/__smoke__/mobile-keyboard"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "outputs"
SCREENSHOT_PATH = OUTPUT_DIR / "mobile-keyboard-browser-smoke.png"
MOBILE_VIEWPORT = {"width": 390, "height": 844}
KEYBOARD_VIEWPORT = {"width": 390, "height": 520}


def assert_box_within_viewport(page, selector: str) -> None:
    viewport = page.viewport_size
    if not viewport:
        raise AssertionError("expected page viewport size")
    box = page.locator(selector).first.bounding_box()
    if not box:
        raise AssertionError(f"expected visible bounding box for {selector}")
    bottom = float(box["y"]) + float(box["height"])
    if bottom > viewport["height"]:
        raise AssertionError(f"expected {selector} to remain within viewport height {viewport['height']}, got {box}")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport=MOBILE_VIEWPORT)
        try:
            page.goto(TARGET_URL, wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            page.wait_for_selector('[data-kg-mobile-keyboard-smoke-page="1"]')

            stream_button = page.locator('[data-kg-mobile-chat-stream-button="true"]').first
            expect(stream_button).to_be_visible()
            stream_button.click()
            stream_button.click()
            expect(page.locator('[data-kg-mobile-chat-stream-item]').last).to_contain_text("mobile-safe transcript")

            chat_input = page.locator('textarea[data-kg-chat-input="true"]').first
            expect(chat_input).to_be_visible()
            chat_input.click()
            page.set_viewport_size(KEYBOARD_VIEWPORT)
            page.wait_for_timeout(150)
            chat_input.scroll_into_view_if_needed()
            page.wait_for_timeout(150)

            chat_quick_bar = page.locator('[data-kg-chat-grammar-quick-bar="true"]').first
            expect(chat_quick_bar).to_be_visible()
            assert_box_within_viewport(page, '[data-kg-chat-grammar-quick-bar="true"]')
            page.locator('[data-kg-chat-grammar-quick-bar-token="/"]').first.click()
            expect(page.locator('section[aria-label="Chat slash commands"]').first).to_be_visible()
            assert_box_within_viewport(page, 'textarea[data-kg-chat-input="true"]')

            workspace_shell = page.locator('[data-kg-mobile-keyboard-shell="workspace"]').first
            workspace_shell.scroll_into_view_if_needed()
            workspace_host = page.locator('[data-kg-mobile-workspace-inline-host="true"] [data-start-line="1"]').first
            expect(workspace_host).to_be_visible()
            workspace_host.click(position={"x": 20, "y": 18})
            page.wait_for_timeout(250)

            workspace_quick_bar = page.locator('[data-kg-markdown-mobile-grammar-quick-bar="true"]').first
            expect(workspace_quick_bar).to_be_visible()
            workspace_quick_bar.scroll_into_view_if_needed()
            page.wait_for_timeout(150)
            assert_box_within_viewport(page, '[data-kg-markdown-mobile-grammar-quick-bar="true"]')
            page.locator('[data-kg-markdown-mobile-grammar-quick-bar-token="#"]').first.click()
            expect(page.locator('section[aria-label="Semantic commands"]').first).to_be_visible()
            page.keyboard.press("Escape")
            page.wait_for_timeout(150)
            page.locator('[data-kg-markdown-mobile-grammar-quick-bar-token="@"]').first.click()
            expect(page.locator('section[aria-label="Variable toolbar"]').first).to_be_visible()

            page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
            print(f"OK mobile-keyboard-browser-smoke {TARGET_URL}")
            print(f"Screenshot: {SCREENSHOT_PATH}")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
