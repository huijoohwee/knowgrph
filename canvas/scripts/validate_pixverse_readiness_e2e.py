#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError, Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


APP_URL = os.environ.get("KG_PIXVERSE_READINESS_URL", "http://localhost:5173/")
SCREENSHOT_PATH = Path(
    os.environ.get(
        "KG_PIXVERSE_READINESS_SCREENSHOT",
        "/tmp/knowgrph-pixverse-readiness-e2e.png",
    )
)


def fail(page: Page, message: str) -> None:
    SCREENSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
    raise AssertionError(f"{message}\nScreenshot: {SCREENSHOT_PATH}")


def read_integration_json(page: Page) -> str:
    locator = page.locator("[aria-label='Main panel'] input, [aria-label='Main panel'] textarea")
    values = locator.evaluate_all(
        """elements => elements
          .map(element => {
            if ('value' in element && typeof element.value === 'string') return element.value
            return element.textContent || ''
          })
          .filter(value => value.includes('pixverseVideo'))"""
    )
    if not values:
        raise AssertionError("Could not locate integrationConfigsJson value containing pixverseVideo")
    return str(values[0])


def expect_integration_state(page: Page, *, enabled: bool, strategy: str) -> None:
    expected_enabled = '"enabled":true' if enabled else '"enabled":false'
    expected_strategy = f'"strategy":"{strategy}"'
    value = read_integration_json(page)
    if expected_enabled not in value or expected_strategy not in value:
        raise AssertionError(
            f"Expected integration json to contain {expected_enabled} and {expected_strategy}, got: {value[:240]}"
        )


def open_settings_integrations(page: Page) -> None:
    page.goto(APP_URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.get_by_role("button", name="Settings").click()
    page.get_by_role("tab", name="Integrations").click()


def filter_settings(page: Page, query: str) -> None:
    search = page.locator("[aria-label='Main panel'] input[placeholder*='Search']").first
    if search.count():
        search.fill(query)


def launch_chromium(playwright):
    errors: list[str] = []
    for launch_options in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
        try:
            return playwright.chromium.launch(headless=True, **launch_options)
        except PlaywrightError as exc:
            label = launch_options.get("channel", "bundled chromium")
            errors.append(f"{label}: {exc}")
    browser_path = os.environ.get("KG_PIXVERSE_READINESS_BROWSER_PATH", "").strip()
    if browser_path:
        try:
            return playwright.chromium.launch(headless=True, executable_path=browser_path)
        except PlaywrightError as exc:
            errors.append(f"KG_PIXVERSE_READINESS_BROWSER_PATH: {exc}")
    raise AssertionError(
        "Could not launch Chromium for PixVerse readiness E2E. "
        "Install Playwright browsers, use a system Chrome channel, or set KG_PIXVERSE_READINESS_BROWSER_PATH.\n"
        + "\n".join(errors)
    )


def main() -> int:
    with sync_playwright() as playwright:
        browser = launch_chromium(playwright)
        page = browser.new_page(viewport={"width": 1440, "height": 1080})
        try:
            open_settings_integrations(page)
            filter_settings(page, "integrationConfigsJson")
            page.get_by_role("button", name="PixVerse Auto").wait_for(timeout=15000)
            page.get_by_role("button", name="PixVerse I2V").wait_for(timeout=15000)
            page.get_by_role("button", name="PixVerse Transition").wait_for(timeout=15000)

            expect_integration_state(page, enabled=False, strategy="auto")

            page.get_by_role("button", name="PixVerse Auto").click()
            page.wait_for_timeout(250)
            expect_integration_state(page, enabled=True, strategy="auto")

            page.get_by_role("button", name="PixVerse Transition").click()
            page.wait_for_timeout(250)
            expect_integration_state(page, enabled=True, strategy="transition-video")

            page.get_by_role("button", name="PixVerse I2V").click()
            page.wait_for_timeout(250)
            expect_integration_state(page, enabled=True, strategy="image-to-video")

            page.get_by_role("button", name="Disable PixVerse").click()
            page.wait_for_timeout(250)
            expect_integration_state(page, enabled=False, strategy="auto")

            filter_settings(page, "PixVerse Video Generation")
            page.get_by_role("button", name=re.compile(r"^PixVerse Video Generation")).wait_for(timeout=15000)
            page.get_by_role("link", name="Open PixVerse Video Generation Docs").wait_for(timeout=15000)

            SCREENSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
            print("PixVerse readiness E2E passed")
            print(f"Screenshot: {SCREENSHOT_PATH}")
            return 0
        except (AssertionError, PlaywrightTimeoutError) as exc:
            fail(page, str(exc))
            return 1
        finally:
            browser.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
