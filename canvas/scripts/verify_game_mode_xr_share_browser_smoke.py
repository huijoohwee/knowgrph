from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, quote, urljoin, urlparse

from playwright.sync_api import Page, expect, sync_playwright

from lib.game_mode_xr_share_smoke_source import (
    fetch_validation_markdown,
    normalized_origin,
    origin_label,
    parse_validation_source,
)


BASE_URL = os.environ.get(
    "KG_GAME_MODE_XR_SHARE_SMOKE_BASE_URL",
    "http://localhost:4186",
).rstrip("/")
VALIDATION_SHARE_URL = os.environ.get("KG_GAME_MODE_VALIDATION_SHARE_URL", "").strip()
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "outputs"
ACTIVE_SCREENSHOT_PATH = OUTPUT_DIR / "game-mode-xr-share-browser-smoke-active.png"
RESTORED_SCREENSHOT_PATH = OUTPUT_DIR / "game-mode-xr-share-browser-smoke-restored.png"
EVIDENCE_PATH = OUTPUT_DIR / "game-mode-xr-share-browser-smoke.json"


def local_chromium_executable() -> str | None:
    explicit = os.environ.get("KG_GAME_MODE_XR_SHARE_CHROMIUM_EXECUTABLE", "").strip()
    candidates = [
        Path(explicit) if explicit else None,
        Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        Path("/Applications/Chromium.app/Contents/MacOS/Chromium"),
        Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
    ]
    for candidate in candidates:
        if candidate and candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def poll_evaluate(
    page: Page,
    script: str,
    predicate: Callable[[Any], bool],
    *,
    timeout_ms: int = 120_000,
    interval_ms: int = 200,
) -> Any:
    deadline = time.monotonic() + timeout_ms / 1000
    last_value: Any = None
    while time.monotonic() < deadline:
        last_value = page.evaluate(script)
        if predicate(last_value):
            return last_value
        page.wait_for_timeout(interval_ms)
    raise AssertionError("timed out waiting for the expected browser runtime state")


def read_xr_state(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        async () => {
          const runtime = await import('/src/features/three/xrNativeControllerDemoRuntime.ts')
          return {
            snapshot: runtime.readXrNativeControllerDemo(),
            frame: runtime.readSharedXrNativeControllerDemoFrame(),
          }
        }
        """
    )


def comparable_xr_frame(frame: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in frame.items() if key != "phase"}


def assert_stable_renderer_canvas(page: Page) -> None:
    state = page.evaluate(
        """
        () => {
          const canvases = Array.from(document.querySelectorAll('[data-kg-xr-scene-media-drop="1"] canvas'))
          return {
            count: canvases.length,
            same: canvases.length === 1 && window.__kgGameModeXrShareCanvas === canvases[0],
          }
        }
        """
    )
    if state != {"count": 1, "same": True}:
        raise AssertionError(f"shared XR/Game Mode renderer canvas was not stable: {state}")


def install_restored_frame_capture(page: Page) -> None:
    page.evaluate(
        """
        async () => {
          const runtime = await import('/src/features/three/xrNativeControllerDemoRuntime.ts')
          window.__kgGameModeXrRestoredFrame = null
          const unsubscribe = runtime.subscribeXrNativeControllerDemo(() => {
            if (runtime.readXrNativeControllerDemo().phase !== 'running') return
            window.__kgGameModeXrRestoredFrame = JSON.parse(JSON.stringify(
              runtime.readSharedXrNativeControllerDemoFrame(),
            ))
            unsubscribe()
          })
          window.__kgGameModeXrRestoredFrameCancel = unsubscribe
        }
        """
    )


def main() -> None:
    share_url, share_token, supplied_origin = parse_validation_source(VALIDATION_SHARE_URL)
    expected_markdown_bytes = fetch_validation_markdown(share_url, supplied_origin)
    local_origin = normalized_origin(BASE_URL)
    target_url = f"{BASE_URL}/knowgrph/?kgShare={quote(share_token, safe='')}"
    requests: list[str] = []
    console_error_count = 0
    page_error_count = 0
    failed_response_count = 0
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=local_chromium_executable(),
            args=["--enable-webgl", "--use-angle=swiftshader"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 960})

        def on_console(message: Any) -> None:
            nonlocal console_error_count
            if message.type == "error":
                console_error_count += 1

        def on_page_error(_: Any) -> None:
            nonlocal page_error_count
            page_error_count += 1

        def on_response(response: Any) -> None:
            nonlocal failed_response_count
            if response.status >= 400:
                failed_response_count += 1

        page.on("request", lambda request: requests.append(request.url))
        page.on("console", on_console)
        page.on("pageerror", on_page_error)
        page.on("response", on_response)

        try:
            page.goto(target_url, wait_until="domcontentloaded")

            imported = poll_evaluate(
                page,
                """
                async () => {
                  const store = await import('/src/hooks/useGraphStore.ts')
                  return String(store.useGraphStore.getState().markdownDocumentText || '')
                }
                """,
                lambda value: str(value or "").encode("utf-8") == expected_markdown_bytes,
            )
            if imported.encode("utf-8") != expected_markdown_bytes:
                raise AssertionError("active Markdown bytes did not exactly match the public validation source")

            imported_identity = page.evaluate(
                """
                async () => {
                  const store = await import('/src/hooks/useGraphStore.ts')
                  const registry = await import('/src/features/workspace-fs/workspaceRunReadyDemos.ts')
                  const state = store.useGraphStore.getState()
                  return {
                    pathId: registry.resolveWorkspaceRunReadyDemoIdForDocumentPath(state.markdownDocumentName),
                    sourceId: registry.resolveWorkspaceRunReadyDemoIdForDocument(
                      state.markdownDocumentName,
                      state.markdownDocumentText,
                    ),
                  }
                }
                """
            )
            if imported_identity != {"pathId": "", "sourceId": "xr-physics"}:
                raise AssertionError(f"imported source identity was not frontmatter-owned: {imported_identity}")
            product_document_url = page.evaluate(
                """
                async targetUrl => {
                  const docs = await import('/src/features/canvas/canvasDocDeepLink.ts')
                  const link = docs.parseDocDeepLink(new URL(targetUrl).search)
                  if (!link || link.kind === 'local') return ''
                  return link.kind === 'default-remote'
                    ? docs.buildDefaultDocViewUrl(link.canonicalPath)
                    : docs.buildDocViewUrl(link.workspaceId, link.canonicalPath)
                }
                """,
                target_url,
            )
            if not product_document_url or normalized_origin(product_document_url) != supplied_origin:
                raise AssertionError("product deep-link owner did not resolve the supplied document origin")

            motion_panel = page.locator('[data-kg-motion-control-floating-panel="1"]').first
            expect(motion_panel).to_be_visible(timeout=120_000)
            xr_hud = page.locator('[data-kg-xr-playground-hud="1"]').first
            expect(xr_hud).to_be_visible(timeout=120_000)
            expect(xr_hud).to_have_attribute("data-kg-xr-playground-phase", "running")

            rocket = page.locator('[data-kg-xr-playground-select="rocket"]').first
            expect(rocket).to_be_visible()
            rocket.click()
            expect(xr_hud).to_have_attribute("data-kg-xr-playground-mode", "rocket")
            page.wait_for_timeout(250)

            initial_canvas = page.evaluate(
                """
                () => {
                  const canvases = Array.from(document.querySelectorAll('[data-kg-xr-scene-media-drop="1"] canvas'))
                  if (canvases.length !== 1) return { count: canvases.length, stored: false }
                  window.__kgGameModeXrShareCanvas = canvases[0]
                  return { count: 1, stored: true }
                }
                """
            )
            if initial_canvas != {"count": 1, "stored": True}:
                raise AssertionError(f"initial XR renderer did not expose exactly one canvas: {initial_canvas}")

            initial_xr = read_xr_state(page)
            if initial_xr["snapshot"]["phase"] != "running" or initial_xr["snapshot"]["mode"] != "rocket":
                raise AssertionError(f"initial XR controller was not running in rocket mode: {initial_xr['snapshot']}")

            open_game = page.locator('[data-kg-motion-control-open-target="game-mode"]').first
            expect(open_game).to_be_attached()
            open_game.scroll_into_view_if_needed()
            open_game.click()

            game_panel = page.locator('[data-kg-game-mode-floating-panel="1"]').first
            expect(game_panel).to_be_visible(timeout=30_000)
            expect(game_panel).to_have_attribute("data-kg-game-mode-active", "1")
            expect(page.locator('[data-kg-game-mode-surface="xr"]')).to_have_count(1)
            expect(page.locator('[data-kg-xr-playground-hud="1"]')).to_have_count(0)

            paused_xr = poll_evaluate(
                page,
                """
                async () => {
                  const runtime = await import('/src/features/three/xrNativeControllerDemoRuntime.ts')
                  return {
                    snapshot: runtime.readXrNativeControllerDemo(),
                    frame: runtime.readSharedXrNativeControllerDemoFrame(),
                  }
                }
                """,
                lambda value: value["snapshot"]["phase"] == "paused",
                timeout_ms=30_000,
            )
            if paused_xr["snapshot"]["mode"] != "rocket":
                raise AssertionError("Game Mode changed the selected XR controller mode")
            assert_stable_renderer_canvas(page)
            page.wait_for_timeout(350)
            paused_xr_later = read_xr_state(page)
            if paused_xr_later["snapshot"]["phase"] != "paused" or paused_xr_later["frame"] != paused_xr["frame"]:
                raise AssertionError("XR simulation progressed while Game Mode owned the shared Canvas")

            start_game = page.locator('[data-kg-game-mode-start="1"]').first
            expect(start_game).to_be_visible()
            start_game.click()
            expect(game_panel).to_have_attribute("data-kg-game-mode-phase", "playing", timeout=30_000)
            game_hud = page.locator('[data-kg-game-fps-hud="1"]').first
            expect(game_hud).to_have_attribute("data-kg-game-fps-phase", "playing", timeout=30_000)
            expect(page.locator('canvas[data-kg-game-fps-first-frame="1"]')).to_have_count(1, timeout=30_000)
            expect(page.locator('[data-kg-game-fps-stage="active"]')).to_have_count(1)
            expect(page.locator('[data-kg-game-fps-stage="active"] canvas')).to_have_count(1)
            if game_hud.get_attribute("data-kg-game-fps-runtime-error"):
                raise AssertionError("Game Mode HUD reported a runtime error")
            expect(page.locator('[data-kg-game-mode-runtime-error="1"]')).to_have_count(0)
            assert_stable_renderer_canvas(page)

            npc_rows = page.locator('[data-kg-game-mode-npc-scores="1"] > article')
            if npc_rows.count() != 4:
                raise AssertionError(f"expected four scored NPC rows, got {npc_rows.count()}")
            for row_text in npc_rows.all_inner_texts():
                if not all(action in row_text for action in ["hold", "alert", "engage", "flee"]):
                    raise AssertionError("NPC score row did not expose all four actions")

            web_mcp = page.evaluate(
                """
                async () => {
                  const tools = Array.from(navigator.modelContext?.tools || [])
                  const inspect = tools.find(tool => tool.name === 'knowgrph.inspect_local_game_mode')
                  const control = tools.find(tool => tool.name === 'knowgrph.control_local_game_mode')
                  if (!inspect || !control) return { registered: false }
                  const beforeStop = await inspect.execute()
                  const invalid = await control.execute({
                    invocation: '/game.mode @canvas @canvas #gameplay operation=start',
                  })
                  const stopped = await control.execute({ operation: 'stop' })
                  const strictStart = await control.execute({
                    invocation: '/game.mode @canvas #gameplay operation=start',
                  })
                  return { registered: true, beforeStop, invalid, stopped, strictStart }
                }
                """
            )
            if not web_mcp.get("registered"):
                raise AssertionError("Game Mode browser WebMCP tools were not registered")
            before_stop = web_mcp["beforeStop"]
            runtime = before_stop["runtime"]
            if (
                before_stop["schema"] != "knowgrph-game-mode-mcp/v1"
                or before_stop["gameMode"]["surfaceMode"] != "xr"
                or before_stop["mission"]["phase"] != "playing"
                or runtime["webglSupported"] is not True
                or runtime["rendererOwner"] != "existing-r3f-canvas"
                or runtime["simulationOwner"] != "native-agentic-ecs"
                or runtime["persistenceOwner"] != "browser-local-workspace-fs"
                or runtime["npcActions"] != ["hold", "alert", "engage", "flee"]
                or runtime["hitscan"] != "normalized-slab-aabb"
                or "motion-control" not in runtime["controls"]
            ):
                raise AssertionError("Game Mode WebMCP inspection did not expose the runtime-ready contract")
            if web_mcp["invalid"].get("ok") is not False:
                raise AssertionError("Game Mode WebMCP accepted a duplicate binding token")

            mission_before_stop = before_stop["mission"]
            stopped_mission = web_mcp["stopped"]["game"]["mission"]
            resumed_mission = web_mcp["strictStart"]["game"]["mission"]
            if (
                web_mcp["stopped"].get("ok") is not True
                or stopped_mission["phase"] != "stopped"
                or stopped_mission["tick"] != mission_before_stop["tick"]
                or stopped_mission["player"] != mission_before_stop["player"]
            ):
                raise AssertionError("WebMCP stop did not preserve the current Game Mode mission state")
            if (
                web_mcp["strictStart"].get("ok") is not True
                or resumed_mission["phase"] != "playing"
                or resumed_mission["tick"] != mission_before_stop["tick"]
                or resumed_mission["player"] != mission_before_stop["player"]
            ):
                raise AssertionError("strict WebMCP start did not resume the stopped mission unchanged")

            resumed_tick = resumed_mission["tick"]
            poll_evaluate(
                page,
                """
                async () => (await import('/src/features/game-fps/gameFpsRuntime.ts')).readGameFpsSnapshot().tick
                """,
                lambda value: int(value) > int(resumed_tick),
                timeout_ms=30_000,
            )
            expect(game_panel).to_have_attribute("data-kg-game-mode-phase", "playing")
            assert_stable_renderer_canvas(page)

            active_xr_later = read_xr_state(page)
            if active_xr_later["snapshot"]["phase"] != "paused" or active_xr_later["frame"] != paused_xr["frame"]:
                raise AssertionError("XR frame changed during Game Mode WebMCP lifecycle operations")

            page.screenshot(path=str(ACTIVE_SCREENSHOT_PATH), full_page=True)

            mission_before_companion = page.evaluate(
                """
                async () => (await import('/src/features/game-fps/gameFpsRuntime.ts')).readGameFpsSnapshot()
                """
            )
            motion_companion = page.locator('[data-kg-game-mode-open-companion="motion-control"]').first
            motion_companion.scroll_into_view_if_needed()
            motion_companion.click()
            expect(motion_panel).to_be_visible(timeout=30_000)
            game_target = page.locator('[data-kg-motion-control-target="game-mode"]').first
            expect(game_target).to_be_visible()
            companion_exit = page.evaluate(
                """
                async () => {
                  const gameMode = await import('/src/features/game-fps/gameModeRuntime.ts')
                  const game = await import('/src/features/game-fps/gameFpsRuntime.ts')
                  return { gameMode: gameMode.readGameModeSnapshot(), mission: game.readGameFpsSnapshot() }
                }
                """
            )
            if (
                companion_exit["gameMode"]["active"] is not False
                or companion_exit["mission"]["phase"] != "stopped"
                or companion_exit["mission"]["tick"] < mission_before_companion["tick"]
            ):
                raise AssertionError(
                    "Motion Control handoff did not stop the resumable Game Mode mission without rewinding: "
                    f"before={mission_before_companion}, after={companion_exit}"
                )
            expect(xr_hud).to_be_visible(timeout=30_000)
            expect(xr_hud).to_have_attribute("data-kg-xr-playground-phase", "running")
            motion_xr_started = read_xr_state(page)
            page.wait_for_timeout(350)
            companion_stable = page.evaluate(
                """
                async () => (await import('/src/features/game-fps/gameFpsRuntime.ts')).readGameFpsSnapshot()
                """
            )
            if companion_stable != companion_exit["mission"]:
                raise AssertionError("the stopped Game Mode mission changed while Motion Control owned the surface")
            motion_xr_later = poll_evaluate(
                page,
                """
                async () => {
                  const runtime = await import('/src/features/three/xrNativeControllerDemoRuntime.ts')
                  return {
                    snapshot: runtime.readXrNativeControllerDemo(),
                    frame: runtime.readSharedXrNativeControllerDemoFrame(),
                  }
                }
                """,
                lambda value: value["snapshot"]["phase"] == "running"
                and int(value["frame"]["stepCount"]) > int(motion_xr_started["frame"]["stepCount"]),
                timeout_ms=30_000,
            )
            reopen_game = page.locator('[data-kg-motion-control-open-target="game-mode"]').first
            reopen_game.click()
            expect(game_panel).to_be_visible(timeout=30_000)
            expect(game_panel).to_have_attribute("data-kg-game-mode-active", "1")
            expect(game_panel).to_have_attribute("data-kg-game-mode-phase", "stopped")
            reopened_mission = page.evaluate(
                """
                async () => (await import('/src/features/game-fps/gameFpsRuntime.ts')).readGameFpsSnapshot()
                """
            )
            if reopened_mission != companion_exit["mission"]:
                raise AssertionError("Motion Control did not reopen the same stopped Game Mode mission")
            assert_stable_renderer_canvas(page)

            final_paused_xr = read_xr_state(page)
            if (
                final_paused_xr["snapshot"]["phase"] != "paused"
                or int(final_paused_xr["frame"]["stepCount"]) < int(motion_xr_later["frame"]["stepCount"])
                or final_paused_xr["frame"]["mode"] != motion_xr_later["frame"]["mode"]
                or final_paused_xr["frame"]["objective"] != motion_xr_later["frame"]["objective"]
            ):
                raise AssertionError("reopened Game Mode did not pause the resumed XR owner in place")

            install_restored_frame_capture(page)
            exit_game = page.locator('[data-kg-game-mode-action="exit"]').first
            exit_game.scroll_into_view_if_needed()
            exit_game.click()
            expect(page.locator('[data-kg-game-mode-floating-panel="1"]')).to_have_count(0, timeout=30_000)
            exited_game_mode = poll_evaluate(
                page,
                """
                async () => (await import('/src/features/game-fps/gameModeRuntime.ts')).readGameModeSnapshot()
                """,
                lambda value: value["active"] is False,
                timeout_ms=30_000,
            )
            if exited_game_mode["launchStatus"] != "idle":
                raise AssertionError("Game Mode exit did not return the central launch owner to idle")
            expect(page.locator('[data-kg-game-fps-hud="1"]')).to_have_count(0, timeout=30_000)
            expect(xr_hud).to_be_visible(timeout=30_000)
            expect(xr_hud).to_have_attribute("data-kg-xr-playground-phase", "running")
            expect(xr_hud).to_have_attribute("data-kg-xr-playground-mode", "rocket")

            restored_frame = poll_evaluate(
                page,
                "() => window.__kgGameModeXrRestoredFrame || null",
                lambda value: isinstance(value, dict),
                timeout_ms=30_000,
            )
            if comparable_xr_frame(restored_frame) != comparable_xr_frame(final_paused_xr["frame"]):
                raise AssertionError("XR mode, objective, or body state was not restored exactly on Game Mode exit")
            assert_stable_renderer_canvas(page)

            restored_step_count = int(restored_frame["stepCount"])
            progressed_frame = poll_evaluate(
                page,
                """
                async () => (await import('/src/features/three/xrNativeControllerDemoRuntime.ts')).readSharedXrNativeControllerDemoFrame()
                """,
                lambda value: int(value["stepCount"]) > restored_step_count,
                timeout_ms=30_000,
            )
            if progressed_frame["phase"] != "running" or progressed_frame["mode"] != restored_frame["mode"]:
                raise AssertionError("restored XR controller did not continue in its preserved mode")
            page.screenshot(path=str(RESTORED_SCREENSHOT_PATH), full_page=True)

            allowed_origins = {local_origin, supplied_origin}
            unexpected_origin_count = 0
            unexpected_origins: set[str] = set()
            for request_url in requests:
                parsed = urlparse(request_url)
                if parsed.scheme not in {"http", "https"}:
                    continue
                origin = normalized_origin(request_url)
                if origin not in allowed_origins:
                    unexpected_origin_count += 1
                    unexpected_origins.add(f"request:{origin_label(origin)}")
                if origin == local_origin and parsed.path == "/__fetch_remote":
                    proxied_targets = parse_qs(parsed.query).get("url", [])
                    proxy_target_origin = normalized_origin(
                        urljoin(f"{BASE_URL}/", proxied_targets[0])
                    ) if len(proxied_targets) == 1 else ("", "", 80)
                    if (
                        len(proxied_targets) != 1
                        or proxy_target_origin not in allowed_origins
                    ):
                        unexpected_origin_count += 1
                        unexpected_origins.add(f"proxy:{origin_label(proxy_target_origin)}")
            if unexpected_origin_count:
                raise AssertionError(
                    "browser runtime contacted an origin outside the local and supplied allowlist: "
                    f"{sorted(unexpected_origins)}"
                )
            product_document_fetch_count = requests.count(product_document_url)
            if product_document_fetch_count != 1:
                raise AssertionError("browser runtime did not fetch the exact product-derived validation document once")
            if console_error_count or page_error_count or failed_response_count:
                raise AssertionError(
                    "browser errors were observed: "
                    f"console={console_error_count}, page={page_error_count}, responses={failed_response_count}"
                )

            evidence = {
                "schema": "knowgrph-game-mode-xr-share-browser-smoke/v1",
                "source": {
                    "env": "KG_GAME_MODE_VALIDATION_SHARE_URL",
                    "exactPublicMarkdownBytesImported": True,
                    "publicMarkdownBytes": len(expected_markdown_bytes),
                },
                "renderer": {
                    "canvasCount": 1,
                    "stableDomIdentity": True,
                    "webglSupported": True,
                },
                "gameMode": {
                    "surface": "xr",
                    "phase": "playing",
                    "npcRows": 4,
                    "actions": ["hold", "alert", "engage", "flee"],
                    "webMcpStrict": True,
                    "stopStartStatePreserved": True,
                },
                "motionControl": {
                    "companionRoundTrip": True,
                    "missionStoppedAndPreserved": True,
                    "xrResumedAndProgressed": True,
                },
                "xr": {
                    "pausedDuringGameMode": True,
                    "frameRestoredExactly": True,
                    "mode": restored_frame["mode"],
                    "objective": restored_frame["objective"],
                    "bodyCount": len(restored_frame["bodies"]),
                    "continuedProgress": int(progressed_frame["stepCount"]) > restored_step_count,
                },
                "network": {
                    "allowlistOnly": True,
                    "sourceFetchObserved": True,
                    "productDocumentFetchCount": product_document_fetch_count,
                    "consoleErrors": console_error_count,
                    "pageErrors": page_error_count,
                    "failedResponses": failed_response_count,
                },
                "screenshots": {
                    "active": ACTIVE_SCREENSHOT_PATH.name,
                    "restored": RESTORED_SCREENSHOT_PATH.name,
                },
            }
            EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
            print("OK game-mode-xr-share-browser-smoke")
            print(f"Evidence: {EVIDENCE_PATH}")
            print(f"Active screenshot: {ACTIVE_SCREENSHOT_PATH}")
            print(f"Restored screenshot: {RESTORED_SCREENSHOT_PATH}")
        finally:
            try:
                page.evaluate("() => window.__kgGameModeXrRestoredFrameCancel?.()")
            except Exception:
                pass
            browser.close()


if __name__ == "__main__":
    main()
