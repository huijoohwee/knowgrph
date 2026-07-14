from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import expect, sync_playwright
from PIL import Image


BASE_URL = os.environ.get("KG_RICH_MEDIA_SMOKE_BASE_URL", "http://localhost:4175").rstrip("/")
TARGET_URL = f"{BASE_URL}/__smoke__/rich-media"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "outputs"
SCREENSHOT_PATH = OUTPUT_DIR / "rich-media-browser-smoke.png"
CATALOG_PREVIEW_SCREENSHOT_PATH = OUTPUT_DIR / "rich-media-catalog-preview-browser-smoke.png"


def assert_canvas_has_visual_content(canvas, artifact_name: str) -> None:
    artifact_path = OUTPUT_DIR / artifact_name
    canvas.screenshot(path=str(artifact_path))
    with Image.open(artifact_path).convert("RGB") as image:
        channel_spread = [high - low for low, high in image.getextrema()]
    if max(channel_spread) < 16:
        raise AssertionError(f"expected rendered WebGL content in {artifact_name}, got channel spread {channel_spread}")


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


def install_fullscreen_probe(page) -> None:
    page.evaluate(
        """
        () => {
          let fullscreenTarget = null
          Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => fullscreenTarget,
          })
          HTMLElement.prototype.requestFullscreen = function () {
            fullscreenTarget = this
            document.dispatchEvent(new Event('fullscreenchange'))
            return Promise.resolve()
          }
          document.exitFullscreen = function () {
            fullscreenTarget = null
            document.dispatchEvent(new Event('fullscreenchange'))
            return Promise.resolve()
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


def open_text_edit_input(page):
    panel_selector = '[data-kg-smoke-panel="text-edit"]'
    display = page.locator(f'{panel_selector} [data-kg-card-inline-edit="1"]').first
    input_locator = page.locator(f'{panel_selector} [data-kg-card-inline-edit-input="1"]').first
    expect(display).to_be_visible()

    activation_steps = (
        lambda: display.click(timeout=5000),
        lambda: display.dblclick(timeout=5000),
        lambda: display.focus(),
    )
    for activate in activation_steps:
        try:
            activate()
            if activate == activation_steps[-1]:
                page.keyboard.press("Enter")
            input_locator.wait_for(state="visible", timeout=5000)
            return input_locator
        except PlaywrightTimeoutError:
            continue

    raise AssertionError("expected rich media text edit panel to reveal the inline editor surface")


def assert_catalog_preview_parent_placement(page, kind: str) -> None:
    page.locator(f'[data-kg-smoke-open-{kind}-preview="1"]').click()
    preview = page.locator(f'[data-kg-media-catalog-preview-kind="{kind}"]').first
    panel = preview.locator('[data-kg-rich-media-panel="1"]').first
    media = preview.locator("video" if kind == "video" else "img").first
    expect(preview).to_be_visible()
    expect(preview).to_have_attribute("data-kg-media-catalog-preview-placement", "legacy-lightbox")
    expect(panel).to_be_visible()
    expect(panel).to_have_attribute("data-kg-overlay-placement-owner", "parent")
    expect(media).to_be_visible()
    panel_box = panel.bounding_box()
    media_box = media.bounding_box()
    if not panel_box or panel_box["width"] < 900 or panel_box["height"] < 600:
        raise AssertionError(f"expected {kind} Rich Media Panel to reuse the previous lightbox size, got {panel_box}")
    if not media_box or media_box["width"] < 840 or media_box["height"] < 520:
        raise AssertionError(f"expected {kind} media to fill the shared Rich Media Panel, got {media_box}")
    expect(page.locator('[data-kg-media-lightbox="1"]')).to_have_count(0)
    fullscreen_button = preview.locator('[data-kg-media-catalog-preview-fullscreen="1"]')
    expect(fullscreen_button).to_be_visible()
    expect(fullscreen_button).to_have_attribute("aria-label", "Enter fullscreen")
    expect(fullscreen_button).to_have_attribute("aria-pressed", "false")
    fullscreen_button.click()
    expect(fullscreen_button).to_have_attribute("aria-label", "Exit fullscreen")
    expect(fullscreen_button).to_have_attribute("aria-pressed", "true")
    if page.evaluate("() => document.fullscreenElement?.getAttribute('data-kg-media-catalog-preview')") != "1":
        raise AssertionError(f"expected {kind} fullscreen action to target the expanded Rich Media Panel preview")
    fullscreen_button.click()
    expect(fullscreen_button).to_have_attribute("aria-label", "Enter fullscreen")
    expect(fullscreen_button).to_have_attribute("aria-pressed", "false")
    if page.evaluate("() => document.fullscreenElement") is not None:
        raise AssertionError(f"expected {kind} fullscreen exit action to clear the fullscreen target")
    if kind == "video":
        preview.screenshot(path=str(CATALOG_PREVIEW_SCREENSHOT_PATH))
    preview.locator('[data-kg-media-catalog-preview-close="1"]').click()
    expect(preview).to_have_count(0)


def assert_catalog_preview_arrow_navigation(page) -> None:
    page.locator('[data-kg-smoke-open-image-preview="1"]').click()
    preview = page.locator('[data-kg-media-catalog-preview="1"]').first
    expect(preview).to_have_attribute("data-kg-media-catalog-preview-kind", "image")
    expect(preview).to_have_attribute("data-kg-media-catalog-preview-count", "2")

    for key, expected_kind in (
        ("ArrowRight", "video"),
        ("ArrowDown", "image"),
        ("ArrowLeft", "video"),
        ("ArrowUp", "image"),
    ):
        page.keyboard.press(key)
        expect(preview).to_have_attribute("data-kg-media-catalog-preview-kind", expected_kind)
        expect(preview.locator("video" if expected_kind == "video" else "img").first).to_be_visible()

    preview.locator('[data-kg-media-catalog-preview-close="1"]').click()
    expect(preview).to_have_count(0)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 2200})
        try:
            page.goto(TARGET_URL, wait_until="domcontentloaded")
            page.wait_for_selector('[data-kg-rich-media-smoke-page="1"]')
            install_window_open_probe(page)
            install_fullscreen_probe(page)

            preview_surface = page.locator(
                '[data-kg-smoke-panel="text-preview"] [data-kg-rich-media-markdown-preview="1"]'
            ).first
            expect(preview_surface).to_be_visible()
            expect(page.locator('[data-kg-smoke-panel="text-preview"] table')).to_have_count(1)

            edit_input = open_text_edit_input(page)
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

            for panel_id, source_kind in (("image-threejs-raster", "raster"), ("image-threejs-svg", "svg")):
                three_surface = page.locator(
                    f'[data-kg-smoke-panel="{panel_id}"] [data-kg-image-threejs-surface="1"]'
                ).first
                expect(three_surface).to_be_visible()
                expect(three_surface).to_have_attribute("data-kg-image-threejs-source-kind", source_kind)
                expect(three_surface).to_have_attribute("data-kg-image-threejs-load-state", "ready")
                canvas = three_surface.locator("canvas").first
                expect(canvas).to_have_count(1)
                assert_canvas_has_visual_content(canvas, f"{panel_id}.png")
                expect(
                    page.locator(f'[data-kg-smoke-panel="{panel_id}"] [data-kg-image-threejs-fallback="1"]')
                ).to_have_count(0)

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

            assert_catalog_preview_parent_placement(page, "image")
            assert_catalog_preview_parent_placement(page, "video")
            assert_catalog_preview_arrow_navigation(page)

            page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
            print(f"OK rich-media-browser-smoke {TARGET_URL}")
            print(f"Screenshot: {SCREENSHOT_PATH}")
            print(f"Catalog preview screenshot: {CATALOG_PREVIEW_SCREENSHOT_PATH}")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
