from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get("KG_RICH_MEDIA_SMOKE_BASE_URL", "http://localhost:4175").rstrip("/")
TARGET_URL = f"{BASE_URL}/__smoke__/rich-media"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "outputs"
SCREENSHOT_PATH = OUTPUT_DIR / "rich-media-browser-smoke.png"


def install_window_open_probe(page) -> None:
    page.evaluate(
        """
        () => {
          window.__kgRichMediaSmokeOpened = []
          window.open = (...args) => {
            window.__kgRichMediaSmokeOpened.push(String(args[0] || ''))
            return null
          }
        }
        """
    )


def click_panel_inset(page, panel_selector: str, target_selector: str, *, inset_x: float = 24, inset_y: float = 24) -> None:
    panel = page.locator(panel_selector).first
    target = page.locator(f"{panel_selector} {target_selector}").first
    expect(panel).to_be_visible()
    expect(target).to_be_visible()
    panel.scroll_into_view_if_needed()
    box = target.bounding_box()
    if not box:
        raise AssertionError(f"expected bounding box for {panel_selector} {target_selector}")
    target.click(
        position={
            "x": min(inset_x, max(8.0, box["width"] - 8.0)),
            "y": min(inset_y, max(8.0, box["height"] - 8.0)),
        }
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 2200})
        try:
            page.goto(TARGET_URL, wait_until="domcontentloaded")
            page.wait_for_selector('[data-kg-rich-media-smoke-page="1"]')
            install_window_open_probe(page)

            preview_surface = page.locator(
                '[data-kg-smoke-panel="text-preview"] [data-kg-rich-media-markdown-preview="1"]'
            ).first
            expect(preview_surface).to_be_visible()
            expect(page.locator('[data-kg-smoke-panel="text-preview"] table')).to_have_count(1)

            click_panel_inset(
                page,
                '[data-kg-smoke-panel="text-edit"]',
                '[data-kg-card-inline-edit="1"]',
            )
            edit_input = page.locator('[data-kg-smoke-panel="text-edit"] textarea[data-kg-card-inline-edit-input]').first
            expect(edit_input).to_be_visible()
            edit_input.fill("## Browser updated\n\nRuntime edit OK.")
            page.locator("body").click(position={"x": 8, "y": 8})
            expect(page.locator('[data-kg-smoke-edit-value="1"]')).to_contain_text("Browser updated")

            expect(page.locator('[data-kg-smoke-panel="iframe-srcdoc"] [data-kg-rich-media-embedded-preview="1"]')).to_be_visible()
            expect(
                page.frame_locator('[data-kg-smoke-panel="iframe-srcdoc"] iframe').locator('[data-kg-smoke-inline-srcdoc="1"]')
            ).to_contain_text("Inline SrcDoc Smoke")

            expect(page.locator('[data-kg-smoke-panel="iframe-snapshot"] [data-kg-webpage-snapshot="1"]')).to_be_visible()

            overlay_link = page.locator('[data-kg-smoke-panel="iframe-open-overlay"] a[aria-label="Click To Open Overlay"]').first
            expect(overlay_link).to_be_visible()
            overlay_link.click()
            opened_urls = page.evaluate("() => window.__kgRichMediaSmokeOpened")
            if "https://example.com/rich-media-open" not in opened_urls:
                raise AssertionError(f"expected click-to-open overlay to capture the target url, got {opened_urls}")

            image_panel = page.locator('[data-kg-smoke-panel="image-zoom"] [data-kg-rich-media-zoom-pan-viewport="1"]').first
            expect(image_panel).to_be_visible()
            expect(page.locator('[data-kg-smoke-panel="image-zoom"] img')).to_have_count(1)
            image_panel.hover()
            page.mouse.wheel(0, -320)

            expect(page.locator('[data-kg-smoke-panel="video-inline"] [data-kg-rich-media-zoom-pan-viewport="1"]')).to_be_visible()
            expect(
                page.frame_locator('[data-kg-smoke-panel="video-inline"] iframe').locator('[data-kg-smoke-video-srcdoc="1"]')
            ).to_contain_text("Video HTML Fallback")

            expect(page.locator('[data-kg-smoke-panel="audio"] audio')).to_have_count(1)

            flow_header = page.locator('[data-kg-smoke-panel="storyboard-widget"] [data-kg-rich-media-storyboard-widget-header="1"]').first
            resize_handle = page.locator('[data-kg-smoke-panel="storyboard-widget"] [data-kg-rich-media-resize-handle="1"]').first
            expect(flow_header).to_be_visible()
            expect(resize_handle).to_be_visible()
            expect(page.locator('[data-kg-smoke-flow-size="1"]')).to_contain_text("320x220")

            page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
            print(f"OK rich-media-browser-smoke {TARGET_URL}")
            print(f"Screenshot: {SCREENSHOT_PATH}")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
