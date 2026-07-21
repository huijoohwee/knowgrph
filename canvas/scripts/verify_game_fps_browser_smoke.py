from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

from lib.game_mode_xr_share_scene_contract import (
    assert_game_overlay_subtree,
    read_scene_contract,
)


BASE_URL = os.environ.get("KG_GAME_FPS_SMOKE_BASE_URL", "http://localhost:4185").rstrip("/")
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "outputs"
SCREENSHOT_PATH = OUTPUT_DIR / "game-fps-browser-smoke.png"
EVIDENCE_PATH = OUTPUT_DIR / "game-fps-browser-smoke.json"
GAME_FPS_AUTHORED_XR_NODES = {
    "kg_graph_xr_stage",
    "kg_xr_motion_reference_stage",
}


def numeric_attribute(locator, name: str) -> float:
    value = locator.get_attribute(name)
    if value is None:
        raise AssertionError(f"missing {name}")
    return float(value)


def local_chromium_executable() -> str | None:
    explicit = os.environ.get("KG_GAME_FPS_CHROMIUM_EXECUTABLE", "").strip()
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


def assert_game_fps_xr_scene(page) -> dict[str, object]:
    renderer = page.evaluate(
        """
        () => {
          const roots = Array.from(document.querySelectorAll('[data-kg-xr-scene-media-drop="1"]'))
          const canvases = roots.flatMap(root => Array.from(root.querySelectorAll('canvas')))
          return { rootCount: roots.length, canvasCount: canvases.length }
        }
        """
    )
    if renderer != {"rootCount": 1, "canvasCount": 1}:
        raise AssertionError(f"Game FPS did not use exactly one authored XR Canvas: {renderer}")

    scene = read_scene_contract(page)
    if scene.get("ready") is not True:
        raise AssertionError(f"Game FPS XR scene snapshot was unavailable: {scene}")
    names = set(scene.get("names") or [])
    missing_authored_nodes = sorted(GAME_FPS_AUTHORED_XR_NODES - names)
    if missing_authored_nodes:
        raise AssertionError(
            "Game FPS replaced the authored XR graph scene: "
            f"missing={missing_authored_nodes}, observed={sorted(names)}"
        )
    assert_game_overlay_subtree(scene)
    if (
        scene.get("retained") != "1"
        or scene.get("presentation") != "xr-authored"
        or scene.get("spatialProfile") != "xr-authored"
        or not str(scene.get("cameraFov") or "").strip()
    ):
        raise AssertionError(f"Game FPS did not publish the canonical XR scene contract: {scene}")
    return {
        "surface": "xr",
        "canvasCount": 1,
        "authoredXrSceneRetained": True,
        "gameMissionSubtreeActorsOnly": True,
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target_url = f"{BASE_URL}/"
    local_origin = urlparse(BASE_URL).netloc
    requests: list[str] = []
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_responses: list[dict[str, object]] = []

    with sync_playwright() as playwright:
        executable = local_chromium_executable()
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=executable,
            args=["--enable-webgl", "--use-angle=swiftshader"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("request", lambda request: requests.append(request.url))
        page.on(
            "response",
            lambda response: failed_responses.append(
                {"status": response.status, "url": response.url}
            )
            if response.status >= 400
            else None,
        )
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        try:
            page.goto(target_url, wait_until="domcontentloaded")
            hud = page.locator('[data-kg-game-fps-hud="1"]').first
            expect(hud).to_be_visible(timeout=120_000)
            page.wait_for_selector('canvas[data-kg-game-fps-first-frame="1"]', timeout=120_000)
            scene_evidence = assert_game_fps_xr_scene(page)

            initial_tick = numeric_attribute(hud, "data-kg-game-fps-tick")
            initial_x = numeric_attribute(hud, "data-kg-game-fps-player-x")
            initial_z = numeric_attribute(hud, "data-kg-game-fps-player-z")
            initial_ammo = numeric_attribute(hud, "data-kg-game-fps-ammo")
            expect(hud).to_have_attribute("data-kg-game-fps-enemies-alive", "4")

            page.keyboard.down("KeyW")
            page.wait_for_timeout(500)
            page.keyboard.up("KeyW")
            page.wait_for_timeout(150)
            moved_x = numeric_attribute(hud, "data-kg-game-fps-player-x")
            moved_z = numeric_attribute(hud, "data-kg-game-fps-player-z")
            if abs(moved_x - initial_x) < 0.001 and abs(moved_z - initial_z) < 0.001:
                raise AssertionError("W input did not move the player")
            page.wait_for_timeout(300)
            released_x = numeric_attribute(hud, "data-kg-game-fps-player-x")
            released_z = numeric_attribute(hud, "data-kg-game-fps-player-z")
            if abs(released_x - moved_x) > 0.02 or abs(released_z - moved_z) > 0.02:
                raise AssertionError("W key release did not neutralize desktop movement")
            page.keyboard.down("KeyW")
            page.wait_for_timeout(180)
            page.keyboard.up("KeyW")
            page.wait_for_timeout(100)
            second_cycle_z = numeric_attribute(hud, "data-kg-game-fps-player-z")
            if abs(second_cycle_z - released_z) < 0.001:
                raise AssertionError("a second W cycle was no longer accepted after key release")

            webmcp = page.evaluate(
                """
                async () => {
                  const tools = Array.from(navigator.modelContext?.tools || [])
                  const inspect = tools.find(tool => tool.name === 'knowgrph.inspect_local_game_mode')
                  const control = tools.find(tool => tool.name === 'knowgrph.control_local_game_mode')
                  if (!inspect || !control) return { registered: false }
                  const snapshot = await inspect.execute()
                  const rejected = await control.execute({ invocation: '/game.mode @canvas @canvas #gameplay operation=open' })
                  return {
                    registered: true,
                    active: snapshot.gameMode.active,
                    phase: snapshot.mission.phase,
                    schema: snapshot.schema,
                    rejectedDuplicateBinding: rejected.ok === false,
                  }
                }
                """
            )
            if webmcp != {
                "registered": True,
                "active": True,
                "phase": "playing",
                "schema": "knowgrph-game-mode-mcp/v1",
                "rejectedDuplicateBinding": True,
            }:
                raise AssertionError(f"Game Mode browser WebMCP was not runtime ready: {webmcp}")

            fire = page.locator('[data-kg-game-fps-action="fire"]').first
            expect(fire).to_be_visible()
            fire.click()
            page.wait_for_timeout(250)
            fired_ammo = numeric_attribute(hud, "data-kg-game-fps-ammo")
            if fired_ammo >= initial_ammo:
                raise AssertionError("fire did not consume ammunition in the next simulation tick")
            fire_result = hud.get_attribute("data-kg-game-fps-fire-result") or ""
            if fire_result not in {"hit", "miss"}:
                raise AssertionError(f"unexpected fire result {fire_result!r}")

            current_tick = numeric_attribute(hud, "data-kg-game-fps-tick")
            if current_tick <= initial_tick:
                raise AssertionError("simulation tick did not advance")

            page.set_viewport_size({"width": 390, "height": 844})
            touch_forward = page.locator('[data-kg-game-fps-touch="forward"]').first
            expect(touch_forward).to_be_visible()
            touch_before_x = numeric_attribute(hud, "data-kg-game-fps-player-x")
            touch_before_z = numeric_attribute(hud, "data-kg-game-fps-player-z")
            touch_forward.dispatch_event("pointerdown", {"pointerId": 41, "pointerType": "touch"})
            page.wait_for_timeout(300)
            touch_moved_x = numeric_attribute(hud, "data-kg-game-fps-player-x")
            touch_moved_z = numeric_attribute(hud, "data-kg-game-fps-player-z")
            if abs(touch_moved_x - touch_before_x) < 0.001 and abs(touch_moved_z - touch_before_z) < 0.001:
                raise AssertionError("touch forward input did not move the player")
            touch_forward.dispatch_event("pointerup", {"pointerId": 41, "pointerType": "touch"})
            page.wait_for_timeout(150)
            touch_released_x = numeric_attribute(hud, "data-kg-game-fps-player-x")
            touch_released_z = numeric_attribute(hud, "data-kg-game-fps-player-z")
            page.wait_for_timeout(250)
            if (
                abs(numeric_attribute(hud, "data-kg-game-fps-player-x") - touch_released_x) > 0.02
                or abs(numeric_attribute(hud, "data-kg-game-fps-player-z") - touch_released_z) > 0.02
            ):
                raise AssertionError("touch release did not neutralize mobile movement")

            restart = page.locator('[data-kg-game-fps-action="restart"]').first
            restart.click()
            expect(hud).to_have_attribute("data-kg-game-fps-tick", "0", timeout=30_000)
            completion = page.evaluate(
                """
                async () => {
                  const runtime = await import('/src/features/game-fps/gameFpsRuntime.ts')
                  const geometry = await import('/src/features/game-fps/gameFpsGeometry.ts')
                  const fixedStep = 1 / 60
                  const spatialMap = runtime.readGameFpsSpatialProfile().map
                  const visibleTarget = snapshot => snapshot.npcs
                    .filter(npc => npc.health > 0 && geometry.hasGameFpsLineOfSight(snapshot.player, npc, spatialMap))
                    .sort((left, right) => {
                      const leftDistance = Math.hypot(left.x - snapshot.player.x, left.z - snapshot.player.z)
                      const rightDistance = Math.hypot(right.x - snapshot.player.x, right.z - snapshot.player.z)
                      return leftDistance - rightDistance || left.id.localeCompare(right.id)
                    })[0]
                  let reloadObserved = false
                  for (let iteration = 0; iteration < 80; iteration += 1) {
                    let before = runtime.readGameFpsSnapshot()
                    if (before.phase !== 'playing') break
                    if (before.ammo === 0) {
                      reloadObserved = true
                      runtime.reloadGameFpsWeapon()
                      await runtime.advanceGameFpsBy(fixedStep)
                      before = runtime.readGameFpsSnapshot()
                    }
                    const target = visibleTarget(before)
                    if (!target) throw new Error('authored browser mission exposed no reachable target')
                    const deltaX = target.x - before.player.x
                    const deltaZ = target.z - before.player.z
                    const horizontalDistance = Math.hypot(deltaX, deltaZ)
                    runtime.setGameFpsInput({
                      lookYawDelta: Math.atan2(-deltaX, -deltaZ) - before.player.yaw,
                      lookPitchDelta: Math.atan2(1.1 - 1.6, horizontalDistance) - before.player.pitch,
                    })
                    runtime.queueGameFpsFire()
                    const after = await runtime.advanceGameFpsBy(fixedStep)
                    if (!['hit', 'eliminated'].includes(after.fireResult)) {
                      throw new Error(`unexpected browser fire result ${after.fireResult}`)
                    }
                    if (after.phase === 'playing') await runtime.advanceGameFpsBy(0.2)
                  }
                  const completed = runtime.readGameFpsSnapshot()
                  return {
                    phase: completed.phase,
                    enemiesAlive: completed.enemiesAlive,
                    pendingDecisionCount: completed.pendingDecisions.length,
                    reloadObserved,
                  }
                }
                """
            )
            if completion["phase"] != "won" or completion["enemiesAlive"] != 0:
                raise AssertionError(f"mission did not complete in browser: {completion}")
            if not completion["reloadObserved"]:
                raise AssertionError("browser completion did not exercise reload")
            expect(hud).to_have_attribute("data-kg-game-fps-phase", "won", timeout=10_000)
            save_decisions = page.locator('[data-kg-game-fps-action="save"]').first
            expect(save_decisions).to_be_visible(timeout=10_000)
            save_decisions.click()
            expect(hud).to_have_attribute("data-kg-game-fps-save-status", "saved", timeout=10_000)
            saved = page.evaluate(
                """
                async () => {
                  const store = await import('/src/features/game-fps/gameFpsDecisionStore.ts')
                  const decisions = await store.loadGameFpsSavedDecisions()
                  return {
                    count: decisions.length,
                    path: store.GAME_FPS_SAVE_PATH,
                    status: store.readGameFpsDecisionStore().status,
                  }
                }
                """
            )
            if saved["count"] <= 0 or saved["path"] != "/game-fps/mission-1-decisions.md":
                raise AssertionError(f"browser Decisions save was not readable: {saved}")

            page.reload(wait_until="domcontentloaded")
            hud = page.locator('[data-kg-game-fps-hud="1"]').first
            expect(hud).to_be_visible(timeout=120_000)
            page.wait_for_selector('canvas[data-kg-game-fps-first-frame="1"]', timeout=120_000)
            expect(hud).to_have_attribute("data-kg-game-fps-phase", "won", timeout=10_000)
            restored_phase = hud.get_attribute("data-kg-game-fps-phase")

            malformed_save = "---\ntitle: Malformed Game FPS Save\nflow:\n  nodes: [\n---\n"
            page.evaluate(
                """
                async malformed => {
                  const workspaceModule = await import('/src/features/workspace-fs/workspaceFs.ts')
                  const store = await import('/src/features/game-fps/gameFpsDecisionStore.ts')
                  const workspace = await workspaceModule.getWorkspaceFs()
                  await workspace.writeFileText(store.GAME_FPS_SAVE_PATH, malformed)
                }
                """,
                malformed_save,
            )
            page.reload(wait_until="domcontentloaded")
            hud = page.locator('[data-kg-game-fps-hud="1"]').first
            expect(hud).to_be_visible(timeout=120_000)
            expect(hud).to_have_attribute("data-kg-game-fps-save-status", "error", timeout=10_000)
            save_error = hud.get_attribute("data-kg-game-fps-save-error") or ""
            if "/game-fps/mission-1-decisions.md" not in save_error:
                raise AssertionError(f"malformed save error did not name the local path: {save_error}")
            expect(hud.get_by_role("alert")).to_contain_text("/game-fps/mission-1-decisions.md")
            reset_save = page.locator('[data-kg-game-fps-action="reset-save"]').first
            expect(reset_save).to_be_visible()
            expect(page.locator('[data-kg-game-fps-action="retry-save"]')).to_have_count(0)
            preserved = page.evaluate(
                """
                async () => {
                  const workspaceModule = await import('/src/features/workspace-fs/workspaceFs.ts')
                  const store = await import('/src/features/game-fps/gameFpsDecisionStore.ts')
                  const workspace = await workspaceModule.getWorkspaceFs()
                  return workspace.readFileText(store.GAME_FPS_SAVE_PATH)
                }
                """
            )
            if preserved != malformed_save:
                raise AssertionError("malformed browser save bytes changed before explicit reset")
            reset_save.click()
            expect(hud).to_have_attribute("data-kg-game-fps-save-status", "saved", timeout=10_000)
            expect(hud).to_have_attribute("data-kg-game-fps-phase", "playing", timeout=10_000)
            expect(hud).to_have_attribute("data-kg-game-fps-enemies-alive", "4")

            page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
            non_local = sorted(
                {
                    request
                    for request in requests
                    if urlparse(request).netloc and urlparse(request).netloc != local_origin
                }
            )
            local_runtime_requests = sorted(
                {
                    urlparse(request).path
                    for request in requests
                    if urlparse(request).netloc == local_origin
                    and urlparse(request).path.startswith("/__")
                }
            )
            if non_local:
                raise AssertionError(f"runtime made non-local requests: {non_local}")
            if "/__kg_fs_list" in local_runtime_requests:
                raise AssertionError("Game FPS bootstrap scanned the unrelated docs mirror")
            if console_errors or page_errors or failed_responses:
                raise AssertionError(
                    "browser errors: "
                    f"console={console_errors}, page={page_errors}, responses={failed_responses}"
                )

            evidence = {
                "targetUrl": target_url,
                "viewport": {"width": 390, "height": 844},
                "firstFrame": True,
                "renderer": scene_evidence,
                "movement": {"from": [initial_x, initial_z], "to": [moved_x, moved_z]},
                "desktopRelease": {
                    "releasedAt": [released_x, released_z],
                    "secondCycleZ": second_cycle_z,
                },
                "webMcp": webmcp,
                "fire": {"ammoBefore": initial_ammo, "ammoAfter": fired_ammo, "result": fire_result},
                "tick": {"before": initial_tick, "after": current_tick},
                "completion": completion,
                "save": saved,
                "reload": {"restoredPhase": restored_phase},
                "malformedSave": {
                    "error": save_error,
                    "preservedBeforeReset": preserved == malformed_save,
                    "retryHidden": True,
                    "resetPhase": hud.get_attribute("data-kg-game-fps-phase"),
                    "resetSaveStatus": hud.get_attribute("data-kg-game-fps-save-status"),
                },
                "nonLocalRequests": non_local,
                "localRuntimeRequestPaths": local_runtime_requests,
                "consoleErrors": console_errors,
                "pageErrors": page_errors,
                "failedResponses": failed_responses,
                "screenshot": str(SCREENSHOT_PATH),
            }
            EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
            print(f"OK game-fps-browser-smoke {target_url}")
            print(f"Evidence: {EVIDENCE_PATH}")
            print(f"Screenshot: {SCREENSHOT_PATH}")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
