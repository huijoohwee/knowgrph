from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


BASE_URL = os.environ.get("KG_GAME_FPS_SMOKE_BASE_URL", "http://localhost:4185").rstrip("/")
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "outputs"
SCREENSHOT_PATH = OUTPUT_DIR / "game-fps-browser-smoke.png"
EVIDENCE_PATH = OUTPUT_DIR / "game-fps-browser-smoke.json"


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
            touch_forward.dispatch_event("pointerdown", {"pointerId": 41, "pointerType": "touch"})
            page.wait_for_timeout(200)
            touch_forward.dispatch_event("pointerup", {"pointerId": 41, "pointerType": "touch"})

            restart = page.locator('[data-kg-game-fps-action="restart"]').first
            restart.click()
            completion = page.evaluate(
                """
                async () => {
                  const runtime = await import('/src/features/game-fps/gameFpsRuntime.ts')
                  const geometry = await import('/src/features/game-fps/gameFpsGeometry.ts')
                  const fixedStep = 1 / 60
                  const visibleTarget = snapshot => snapshot.npcs
                    .filter(npc => npc.health > 0 && geometry.hasGameFpsLineOfSight(snapshot.player, npc))
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
                "movement": {"from": [initial_x, initial_z], "to": [moved_x, moved_z]},
                "fire": {"ammoBefore": initial_ammo, "ammoAfter": fired_ammo, "result": fire_result},
                "tick": {"before": initial_tick, "after": current_tick},
                "completion": completion,
                "save": saved,
                "reload": {"restoredPhase": restored_phase},
                "malformedSave": {
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
