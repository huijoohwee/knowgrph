from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get("KG_STORYBOARD_DROP_SMOKE_BASE_URL", "http://localhost:4176").rstrip("/")
TARGET_URL = f"{BASE_URL}/?kgPath=%2F__smoke__%2Fstoryboard-rich-media-drop"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "outputs"
SCREENSHOT_PATH = OUTPUT_DIR / "storyboard-rich-media-drop-browser-smoke.png"


def read_smoke_state(page):
    return page.evaluate("() => window.__kgStoryboardDropSmoke || null")


def load_storyboard_smoke_page(page):
    page.goto(TARGET_URL, wait_until="domcontentloaded")
    page.wait_for_selector('[data-kg-storyboard-drop-smoke-page="1"]')
    canvas_surface = page.locator('[data-kg-flow-editor-surface-root="storyboard"]').first
    expect(canvas_surface).to_be_visible()
    initial_state = read_smoke_state(page) or {}
    if initial_state.get("dropCount", 0) != 0:
      raise AssertionError(f"expected storyboard smoke page to reset dropped state on load, got {initial_state}")
    return canvas_surface


def drag_storyboard_media(page, canvas_surface, source_kind: str, target_x: float, target_y: float) -> str:
    source = page.locator(f'[data-kg-storyboard-drop-smoke-source="{source_kind}"]').first
    expect(source).to_be_visible()
    source_box = source.bounding_box()
    if not source_box:
        raise AssertionError(f"expected bounding box for {source_kind} source")
    before = read_smoke_state(page) or {"dropCount": 0, "droppedNodeIds": []}
    before_count = int(before.get("dropCount", 0))
    before_ids = set(before.get("droppedNodeIds", []))
    payload = {
        "kind": source_kind,
        "label": f"Smoke {source_kind}",
        "url": (
            "data:image/svg+xml;charset=utf-8,"
            "%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20360%20203%22%3E"
            "%3Crect%20width%3D%22360%22%20height%3D%22203%22%20rx%3D%2224%22%20fill%3D%22%230f172a%22/%3E"
            "%3Crect%20x%3D%2218%22%20y%3D%2218%22%20width%3D%22324%22%20height%3D%22167%22%20rx%3D%2218%22%20fill%3D%22%2338bdf8%22/%3E"
            "%3Ctext%20x%3D%22180%22%20y%3D%22112%22%20text-anchor%3D%22middle%22%20font-family%3D%22Inter%2C%20Arial%2C%20sans-serif%22%20font-size%3D%2224%22%20fill%3D%22%23082f49%22%3EStoryboard%20Smoke%20Image%3C/text%3E%3C/svg%3E"
            if source_kind == "image"
            else "https://example.com/storyboard-smoke-video.mp4"
        ),
        "sourceKey": f"smoke:{source_kind}",
    }
    page.evaluate(
        """
        ({ payload, clientX, clientY, startClientX, startClientY }) => {
          window.dispatchEvent(new CustomEvent('kg:media-pointer-drag-drop', {
            detail: { payload, clientX, clientY, startClientX, startClientY }
          }))
        }
        """,
        {
            "payload": payload,
            "clientX": target_x,
            "clientY": target_y,
            "startClientX": source_box["x"] + source_box["width"] / 2,
            "startClientY": source_box["y"] + source_box["height"] / 2,
        },
    )
    page.wait_for_function(
        "(expectedCount) => (window.__kgStoryboardDropSmoke?.dropCount || 0) >= expectedCount",
        arg=before_count + 1,
        timeout=15000,
    )
    after = read_smoke_state(page) or {}
    new_ids = [node_id for node_id in after.get("droppedNodeIds", []) if node_id not in before_ids]
    if len(new_ids) != 1:
        raise AssertionError(f"expected one new dropped node after {source_kind} drag, got {new_ids}")
    return new_ids[0]


def run_single_drop(browser, source_kind: str, target_ratio_x: float, target_ratio_y: float):
    page = browser.new_page(viewport={"width": 1680, "height": 1200})
    try:
        canvas_surface = load_storyboard_smoke_page(page)
        canvas_box = canvas_surface.bounding_box()
        if not canvas_box:
            raise AssertionError("expected storyboard surface bounding box")
        target_x = canvas_box["x"] + canvas_box["width"] * target_ratio_x
        target_y = canvas_box["y"] + canvas_box["height"] * target_ratio_y
        node_id = drag_storyboard_media(page, canvas_surface, source_kind, target_x, target_y)
        smoke_state = read_smoke_state(page) or {}
        expected_kind = {source_kind}
        if smoke_state.get("dropCount") != 1:
            raise AssertionError(f"expected one dropped {source_kind} node, got {smoke_state}")
        if set(smoke_state.get("droppedKinds", [])) != expected_kind:
            raise AssertionError(f"expected dropped {source_kind} kind only, got {smoke_state}")
        if set(smoke_state.get("droppedNodeIds", [])) != {node_id}:
            raise AssertionError(f"expected dropped {source_kind} node id to be retained, got {smoke_state}")
        if smoke_state.get("shiftedNodeIds"):
            raise AssertionError(f"expected {source_kind} drop to preserve existing authored nodes, got {smoke_state}")
        return page
    except Exception:
        page.close()
        raise


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            image_page = run_single_drop(browser, "image", 0.35, 0.15)
            image_page.close()

            video_page = run_single_drop(browser, "video", 0.65, 0.90)
            video_page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
            video_page.close()
            print(f"OK storyboard-rich-media-drop-browser-smoke {TARGET_URL}")
            print(f"Screenshot: {SCREENSHOT_PATH}")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
