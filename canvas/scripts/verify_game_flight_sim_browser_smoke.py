from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

from playwright.sync_api import Page, expect, sync_playwright

from lib.game_flight_sim_smoke_camera import verify_flight_camera_runtime
from lib.game_flight_sim_smoke_mobile import verify_mobile_flight_hud
from lib.game_flight_sim_smoke_scene import (
    FLIGHT_MISSION_NODE,
    assert_active_flight_scene,
    read_flight_scene,
)
from lib.game_flight_sim_smoke_source import (
    SOURCE_BASENAME,
    apply_and_verify_exact_authored_source,
)


BASE_URL = os.environ.get(
    "KG_GAME_FLIGHT_SIM_SMOKE_BASE_URL",
    "http://localhost:4187",
).rstrip("/")
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "outputs"
SCREENSHOT_PATH = OUTPUT_DIR / "game-flight-sim-browser-smoke.png"
EVIDENCE_PATH = OUTPUT_DIR / "game-flight-sim-browser-smoke.json"
FLIGHT_TOOL_NAMES = {
    "knowgrph.inspect_local_flight_sim",
    "knowgrph.control_local_flight_sim",
}


def local_chromium_executable() -> str | None:
    explicit = os.environ.get(
        "KG_GAME_FLIGHT_SIM_CHROMIUM_EXECUTABLE",
        "",
    ).strip()
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


def poll(
    page: Page,
    read: Callable[[], Any],
    accepted: Callable[[Any], bool],
    *,
    label: str,
    timeout_ms: int = 30_000,
) -> Any:
    deadline = time.monotonic() + timeout_ms / 1000
    last_value: Any = None
    while time.monotonic() < deadline:
        last_value = read()
        if accepted(last_value):
            return last_value
        page.wait_for_timeout(100)
    raise AssertionError(f"timed out waiting for {label}: {last_value}")


def read_runtime(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        async () => {
          const runtime = await import('/src/features/game-flight-sim/flightSimRuntime.ts')
          return runtime.readFlightSimSnapshot()
        }
        """
    )


def web_mcp_control(page: Page, invocation: str) -> dict[str, Any]:
    return page.evaluate(
        """
        async invocation => {
          const tools = Array.from(navigator.modelContext?.tools || [])
          const control = tools.find(
            tool => tool.name === 'knowgrph.control_local_flight_sim',
          )
          if (!control) return { ok: false, missingTool: true }
          return control.execute({ invocation })
        }
        """,
        invocation,
    )


def position_distance(
    left: list[float],
    right: list[float],
) -> float:
    return sum((a - b) ** 2 for a, b in zip(left, right)) ** 0.5


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target_url = f"{BASE_URL}/"
    local_origin = urlparse(BASE_URL).netloc
    requests: list[str] = []
    fs_list_requests: list[dict[str, Any]] = []
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_responses: list[dict[str, Any]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=local_chromium_executable(),
            args=["--enable-webgl", "--use-angle=swiftshader"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        def record_request(request: Any) -> None:
            requests.append(request.url)
            if urlparse(request.url).path != "/__kg_fs_list":
                return
            try:
                body = json.loads(request.post_data or "{}")
            except (TypeError, json.JSONDecodeError):
                body = {}
            fs_list_requests.append(
                {
                    "method": request.method,
                    "path": str(body.get("path") or ""),
                }
            )

        page.on("request", record_request)
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
            source_application, source = apply_and_verify_exact_authored_source(
                page
            )
            hud = page.locator('[data-kg-flight-sim-hud="1"]').first
            expect(hud).to_be_visible(timeout=120_000)
            page.wait_for_selector(
                'canvas[data-kg-flight-sim-first-frame="1"]',
                timeout=120_000,
            )
            page.evaluate(
                """
                () => {
                  const root = document.querySelector(
                    '[data-kg-xr-scene-media-drop="1"]',
                  )
                  window.__kgFlightSimCanvas = root?.querySelector('canvas') || null
                }
                """
            )

            initial = poll(
                page,
                lambda: read_runtime(page),
                lambda value: value.get("active") is True
                and value.get("phase") in {"ready", "flying"}
                and value.get("runtimeError") is None,
                label="source-backed Flight Sim activation",
                timeout_ms=120_000,
            )
            active_scene = poll(
                page,
                lambda: read_flight_scene(page),
                lambda value: FLIGHT_MISSION_NODE in set(value.get("names") or []),
                label="Flight actor-only scene",
                timeout_ms=120_000,
            )
            assert_active_flight_scene(active_scene)

            web_mcp = page.evaluate(
                """
                async () => {
                  const tools = Array.from(navigator.modelContext?.tools || [])
                  const flightTools = tools
                    .filter(tool => tool.name.includes('local_flight_sim'))
                    .map(tool => tool.name)
                    .sort()
                  const inspect = tools.find(
                    tool => tool.name === 'knowgrph.inspect_local_flight_sim',
                  )
                  const control = tools.find(
                    tool => tool.name === 'knowgrph.control_local_flight_sim',
                  )
                  if (!inspect || !control) {
                    return { flightTools, registered: false }
                  }
                  const snapshot = await inspect.execute()
                  const rejected = await control.execute({
                    invocation: '/flight.sim @canvas @canvas #flight operation=inspect',
                  })
                  return {
                    registered: true,
                    flightTools,
                    schema: snapshot.schema,
                    active: snapshot.flightSim.active,
                    phase: snapshot.flightSim.phase,
                    rendererOwner: snapshot.runtime.rendererOwner,
                    sceneOwner: snapshot.runtime.sceneOwner,
                    simulationOwner: snapshot.runtime.simulationOwner,
                    runtimeNetworkCalls: snapshot.runtime.runtimeNetworkCalls,
                    runtimeModelCalls: snapshot.runtime.runtimeModelCalls,
                    rejectedDuplicateBinding: rejected.ok === false,
                  }
                }
                """
            )
            if web_mcp != {
                "registered": True,
                "flightTools": sorted(FLIGHT_TOOL_NAMES),
                "schema": "knowgrph-flight-sim-mcp/v1",
                "active": True,
                "phase": initial["phase"],
                "rendererOwner": "existing-r3f-canvas",
                "sceneOwner": "authored-xr-terrain",
                "simulationOwner": "native-agentic-ecs",
                "runtimeNetworkCalls": 0,
                "runtimeModelCalls": 0,
                "rejectedDuplicateBinding": True,
            }:
                raise AssertionError(f"strict Flight WebMCP was not ready: {web_mcp}")

            page.keyboard.down("KeyW")
            page.keyboard.down("KeyD")
            moved = poll(
                page,
                lambda: read_runtime(page),
                lambda value: value.get("phase") == "flying"
                and value.get("tick", 0) > initial["tick"]
                and abs(value["aircraft"]["pitch"]) > 0.001
                and abs(value["aircraft"]["roll"]) > 0.001
                and position_distance(
                    value["aircraft"]["position"],
                    initial["aircraft"]["position"],
                ) > 0.01,
                label="desktop Flight input",
            )
            page.keyboard.up("KeyD")
            page.keyboard.up("KeyW")
            hud_pitch = float(
                hud.get_attribute("data-kg-flight-sim-pitch") or "nan"
            )
            hud_roll = float(
                hud.get_attribute("data-kg-flight-sim-roll") or "nan"
            )
            telemetry_runtime = read_runtime(page)
            if (
                not all(value == value for value in (hud_pitch, hud_roll))
                or abs(hud_pitch - telemetry_runtime["aircraft"]["pitch"]) > 0.01
                or abs(hud_roll - telemetry_runtime["aircraft"]["roll"]) > 0.01
            ):
                raise AssertionError(
                    "Flight HUD pitch/roll telemetry did not track the aircraft: "
                    f"hud={[hud_pitch, hud_roll]}, "
                    f"runtime={[telemetry_runtime['aircraft']['pitch'], telemetry_runtime['aircraft']['roll']]}"
                )

            page.evaluate("window.dispatchEvent(new Event('blur'))")
            blur_stopped = poll(
                page,
                lambda: read_runtime(page),
                lambda value: value.get("phase") == "stopped",
                label="window-blur Flight stop",
            )
            page.wait_for_timeout(350)
            blur_frozen = read_runtime(page)
            if (
                blur_frozen["phase"] != "stopped"
                or blur_frozen["tick"] != blur_stopped["tick"]
            ):
                raise AssertionError(
                    f"window blur did not freeze Flight ticks: {blur_frozen}"
                )
            blur_resume_result = web_mcp_control(
                page,
                "/flight.sim @canvas #flight operation=start",
            )
            blur_resumed = blur_resume_result["flight"]["flightSim"]
            if (
                blur_resume_result.get("ok") is not True
                or blur_resumed["phase"] != "flying"
                or blur_resumed["tick"] != blur_stopped["tick"]
            ):
                raise AssertionError(
                    f"Flight did not resume its blur-stopped state: {blur_resume_result}"
                )
            page.keyboard.down("KeyD")
            fresh_input = poll(
                page,
                lambda: read_runtime(page),
                lambda value: value.get("tick", 0) > blur_resumed["tick"]
                and abs(
                    value["aircraft"]["roll"]
                    - blur_resumed["aircraft"]["roll"]
                ) > 0.001,
                label="fresh post-blur Flight input",
            )
            page.keyboard.up("KeyD")

            throttle_result = web_mcp_control(
                page,
                "/flight.sim @canvas #flight operation=throttle throttle=0.75",
            )
            if (
                throttle_result.get("ok") is not True
                or abs(
                    throttle_result["flight"]["flightSim"]["aircraft"]["throttle"]
                    - 0.75
                ) > 1e-6
            ):
                raise AssertionError(
                    f"strict absolute throttle control failed: {throttle_result}"
                )

            stopped_result = web_mcp_control(
                page,
                "/flight.sim @canvas #flight operation=stop",
            )
            stopped = stopped_result["flight"]["flightSim"]
            if stopped_result.get("ok") is not True or stopped["phase"] != "stopped":
                raise AssertionError(f"Flight stop failed: {stopped_result}")
            page.wait_for_timeout(350)
            frozen = read_runtime(page)
            if frozen["tick"] != stopped["tick"] or frozen["phase"] != "stopped":
                raise AssertionError(f"Flight stop did not freeze simulation: {frozen}")

            resumed_result = web_mcp_control(
                page,
                "/flight.sim @canvas #flight operation=start",
            )
            resumed = resumed_result["flight"]["flightSim"]
            if (
                resumed_result.get("ok") is not True
                or resumed["phase"] != "flying"
                or resumed["tick"] != stopped["tick"]
            ):
                raise AssertionError(
                    f"Flight start did not retain stopped state: {resumed_result}"
                )
            resumed_advanced = poll(
                page,
                lambda: read_runtime(page),
                lambda value: value.get("tick", 0) > resumed["tick"],
                label="resumed Flight ticks",
            )

            restarted_result = web_mcp_control(
                page,
                "/flight.sim @canvas #flight operation=restart",
            )
            restarted = restarted_result["flight"]["flightSim"]
            if (
                restarted_result.get("ok") is not True
                or restarted["phase"] != "ready"
                or restarted["tick"] != 0
                or restarted["runId"] <= resumed_advanced["runId"]
            ):
                raise AssertionError(f"Flight restart was not fresh: {restarted_result}")
            page.keyboard.down("KeyW")
            replayed = poll(
                page,
                lambda: read_runtime(page),
                lambda value: value.get("phase") == "flying"
                and value.get("tick", 0) > 0,
                label="post-restart Flight input",
            )
            page.keyboard.up("KeyW")

            camera = verify_flight_camera_runtime(page)
            camera_advanced = poll(
                page,
                lambda: read_runtime(page),
                lambda value: value.get("active") is True
                and value.get("phase") == "flying"
                and value.get("tick", 0)
                > camera["returned"]["tickAfterResume"],
                label="Flight ticks after camera-source transition",
            )
            expect(hud).to_have_attribute(
                "data-kg-flight-sim-phase",
                "flying",
                timeout=10_000,
            )
            if float(hud.get_attribute("data-kg-flight-sim-airspeed") or "0") <= 0:
                raise AssertionError("Flight HUD did not publish live airspeed")
            final_runtime = read_runtime(page)
            final_scene = read_flight_scene(page)
            assert_active_flight_scene(
                final_scene,
                completed_waypoint_count=final_runtime["waypointIndex"],
                waypoint_count=final_runtime["waypointCount"],
            )
            if (
                final_scene["authoredSceneSignature"]
                != active_scene["authoredSceneSignature"]
            ):
                raise AssertionError(
                    "authored XR scene identity changed across the Flight lifecycle"
                )
            mobile_layout = verify_mobile_flight_hud(page)
            page.screenshot(path=str(SCREENSHOT_PATH), full_page=False)

            non_local_requests = sorted(
                {
                    request
                    for request in requests
                    if urlparse(request).netloc
                    and urlparse(request).netloc != local_origin
                }
            )
            local_runtime_paths = sorted(
                {
                    urlparse(request).path
                    for request in requests
                    if urlparse(request).netloc == local_origin
                    and urlparse(request).path.startswith("/__")
                }
            )
            if non_local_requests:
                raise AssertionError(
                    f"Flight runtime made non-local requests: {non_local_requests}"
                )
            expected_seed_root = (
                Path(__file__).resolve().parents[2] / "docs" / "workspace-seeds"
            ).resolve()
            invalid_fs_list_requests = [
                request
                for request in fs_list_requests
                if (
                    request["method"] != "POST"
                    or not request["path"]
                    or Path(request["path"]).resolve() != expected_seed_root
                )
            ]
            if invalid_fs_list_requests:
                raise AssertionError(
                    "Flight bootstrap scanned an unrelated docs mirror: "
                    f"{invalid_fs_list_requests}"
                )
            if console_errors or page_errors or failed_responses:
                raise AssertionError(
                    "browser errors: "
                    f"console={console_errors}, page={page_errors}, "
                    f"responses={failed_responses}"
                )

            evidence = {
                "targetUrl": target_url,
                "source": source,
                "sourceApplication": source_application,
                "activation": {
                    "automatic": True,
                    "initialPhase": initial["phase"],
                    "sourceBasename": SOURCE_BASENAME,
                },
                "renderer": {
                    "canvasCount": active_scene["canvasCount"],
                    "authoredXrSceneRetained": True,
                    "actorOnlyMission": True,
                    "authoredSceneStableAcrossLifecycle": True,
                },
                "playableFrame": {
                    "firstFrame": True,
                    "tickBefore": initial["tick"],
                    "tickAfterInput": moved["tick"],
                    "positionBefore": initial["aircraft"]["position"],
                    "positionAfter": moved["aircraft"]["position"],
                    "hudPitch": hud_pitch,
                    "hudRoll": hud_roll,
                },
                "webMcp": web_mcp,
                "lifecycle": {
                    "blurStoppedTick": blur_stopped["tick"],
                    "blurFrozenTick": blur_frozen["tick"],
                    "blurResumedTick": blur_resumed["tick"],
                    "freshInputTick": fresh_input["tick"],
                    "stoppedTick": stopped["tick"],
                    "frozenTick": frozen["tick"],
                    "resumedTick": resumed["tick"],
                    "resumedAdvancedTick": resumed_advanced["tick"],
                    "restartRunId": restarted["runId"],
                    "postRestartTick": replayed["tick"],
                },
                "camera": {
                    **camera,
                    "tickAfter": camera_advanced["tick"],
                },
                "mobileHud": mobile_layout,
                "throttle": 0.75,
                "nonLocalRequests": non_local_requests,
                "localRuntimeRequestPaths": local_runtime_paths,
                "workspaceSeedListRequests": fs_list_requests,
                "consoleErrors": console_errors,
                "pageErrors": page_errors,
                "failedResponses": failed_responses,
                "screenshot": str(SCREENSHOT_PATH),
            }
            EVIDENCE_PATH.write_text(
                json.dumps(evidence, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"OK game-flight-sim-browser-smoke {target_url}")
            print(f"Evidence: {EVIDENCE_PATH}")
            print(f"Screenshot: {SCREENSHOT_PATH}")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
