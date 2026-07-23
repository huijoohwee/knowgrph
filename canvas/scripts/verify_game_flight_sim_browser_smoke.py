from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

from playwright.sync_api import Page, expect, sync_playwright

from lib.game_flight_sim_smoke_camera import verify_flight_camera_runtime
from lib.game_flight_sim_smoke_lifecycle import (
    verify_blur_lifecycle,
    verify_initial_ready_hold,
    verify_stop_start_lifecycle,
    verify_surface_failure_paths,
)
from lib.game_flight_sim_smoke_mobile import verify_mobile_flight_hud
from lib.game_flight_sim_smoke_scene import (
    FLIGHT_MISSION_NODE,
    assert_active_flight_scene,
    read_flight_scene,
)
from lib.game_flight_sim_smoke_source import (
    SOURCE_BASENAME,
    apply_and_verify_exact_authored_source,
    prepare_authored_physics_surface,
)
from lib.game_flight_sim_smoke_web_mcp import (
    control_flight_via_web_mcp,
    verify_flight_exit,
    verify_flight_web_mcp,
)
from lib.game_flight_sim_smoke_vite import prepare_stable_candidate_page


BASE_URL = os.environ.get(
    "KG_GAME_FLIGHT_SIM_SMOKE_BASE_URL",
    "http://localhost:4187",
).rstrip("/")
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "outputs"
RUN_INDEX = int(os.environ.get("KG_GAME_FLIGHT_SIM_SMOKE_RUN_INDEX", "1"))
RUN_COUNT = int(os.environ.get("KG_GAME_FLIGHT_SIM_SMOKE_RUN_COUNT", "1"))
EXPECTED_HEAD = os.environ.get("KG_GAME_FLIGHT_SIM_EXPECTED_HEAD", "").strip()
EXPECTED_BRANCH = os.environ.get(
    "KG_GAME_FLIGHT_SIM_EXPECTED_BRANCH",
    "",
).strip()
EXPECTED_SOURCE_SHA256 = os.environ.get(
    "KG_GAME_FLIGHT_SIM_EXPECTED_SOURCE_SHA256",
    "",
).strip()
OUTPUT_STEM = f"game-flight-sim-browser-smoke-run-{RUN_INDEX}"
SCREENSHOT_PATH = OUTPUT_DIR / f"{OUTPUT_STEM}.png"
EVIDENCE_PATH = OUTPUT_DIR / f"{OUTPUT_STEM}.json"
FIRST_PLAYABLE_FRAME_LIMIT_MS = 3_000


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


def position_distance(
    left: list[float],
    right: list[float],
) -> float:
    return sum((a - b) ** 2 for a, b in zip(left, right)) ** 0.5


def request_record(request: Any) -> dict[str, str]:
    return {
        "method": str(request.method),
        "url": str(request.url),
        "path": urlparse(request.url).path,
    }


def request_is_proof_local_read(
    request: Any,
    local_origin: str,
) -> bool:
    parsed = urlparse(request.url)
    if parsed.netloc != local_origin:
        return False
    if request.method in {"GET", "HEAD"}:
        return not parsed.path.startswith("/__")
    return request.method == "POST" and parsed.path == "/__kg_fs_list"


def main() -> None:
    if RUN_INDEX < 1 or RUN_INDEX > RUN_COUNT:
        raise AssertionError(
            f"invalid serial run identity: {RUN_INDEX}/{RUN_COUNT}"
        )
    if len(EXPECTED_HEAD) != 40 or any(
        character not in "0123456789abcdef" for character in EXPECTED_HEAD
    ):
        raise AssertionError(f"invalid expected candidate HEAD: {EXPECTED_HEAD}")
    if not EXPECTED_BRANCH:
        raise AssertionError("missing expected candidate branch")
    if len(EXPECTED_SOURCE_SHA256) != 64 or any(
        character not in "0123456789abcdef"
        for character in EXPECTED_SOURCE_SHA256
    ):
        raise AssertionError(
            f"invalid expected source SHA-256: {EXPECTED_SOURCE_SHA256}"
        )
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target_url = f"{BASE_URL}/"
    local_origin = urlparse(BASE_URL).netloc
    requests: list[dict[str, str]] = []
    blocked_requests: list[dict[str, str]] = []
    fs_list_requests: list[dict[str, Any]] = []
    console_errors: list[str] = []
    page_errors: list[str] = []
    failed_responses: list[dict[str, Any]] = []
    web_mcp_calls: list[dict[str, Any]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=local_chromium_executable(),
            args=["--enable-webgl", "--use-angle=swiftshader"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        def route_request(route: Any, request: Any) -> None:
            if request_is_proof_local_read(request, local_origin):
                route.continue_()
                return
            blocked_requests.append(request_record(request))
            route.abort("blockedbyclient")

        def record_request(request: Any) -> None:
            requests.append(request_record(request))
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

        page.route("**/*", route_request)
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
            prepare_stable_candidate_page(page, target_url)
            console_errors.clear()
            page_errors.clear()
            failed_responses.clear()
            physics_baseline = prepare_authored_physics_surface(page)
            source_application, source = apply_and_verify_exact_authored_source(
                page
            )
            hud = page.locator('[data-kg-flight-sim-hud="1"]').first
            expect(hud).to_be_visible(timeout=120_000)
            page.wait_for_selector(
                'canvas[data-kg-flight-sim-first-frame="1"]',
                timeout=120_000,
            )
            first_playable_frame = page.evaluate(
                """
                () => {
                  const proof = window.__kgFlightSimFirstFrameProof
                  if (!proof) return null
                  const end = Number(proof.firstFrameAtMs)
                  const start = Number(proof.startedAtMs)
                  return {
                    startMs: start,
                    endMs: end,
                    durationMs: end - start,
                    preExisting: Boolean(proof.preExisting),
                  }
                }
                """
            )
            if (
                not isinstance(first_playable_frame, dict)
                or first_playable_frame.get("durationMs") is None
                or first_playable_frame["durationMs"] < 0
                or first_playable_frame["durationMs"] != first_playable_frame["durationMs"]
                or first_playable_frame["durationMs"] > FIRST_PLAYABLE_FRAME_LIMIT_MS
                or first_playable_frame.get("preExisting") is True
            ):
                raise AssertionError(
                    "Flight first playable frame was not newly produced within "
                    f"the source-apply deadline: {first_playable_frame}"
                )
            runtime_identity = page.evaluate(
                """
                async () => {
                  const identity = await import(
                    '/src/features/runtime-identity/knowgrphRuntimeIdentity.ts'
                  )
                  return identity.getKnowgrphRuntimeIdentity()
                }
                """
            )
            if (
                runtime_identity.get("knowgrphRevision") != EXPECTED_HEAD
                or runtime_identity.get("branch") != EXPECTED_BRANCH
            ):
                raise AssertionError(
                    "browser runtime identity does not match candidate checkout: "
                    f"expected={EXPECTED_BRANCH}@{EXPECTED_HEAD}, "
                    f"actual={runtime_identity}"
                )
            if (
                source.get("sha256") != EXPECTED_SOURCE_SHA256
                or source.get("authoredSeedSha256")
                != EXPECTED_SOURCE_SHA256
                or source.get("workspaceSourceSha256")
                != EXPECTED_SOURCE_SHA256
            ):
                raise AssertionError(
                    "disk, bundled, and WorkspaceFs source identities diverged: "
                    f"{source}"
                )
            initial, ready_held = verify_initial_ready_hold(page)
            if (
                initial["aircraft"]["position"][1] <= 0
                or initial["aircraft"]["airspeed"] <= 0
            ):
                raise AssertionError(
                    "Flight first playable frame is not airborne-capable: "
                    f"{initial['aircraft']}"
                )
            active_scene = poll(
                page,
                lambda: read_flight_scene(page),
                lambda value: FLIGHT_MISSION_NODE in set(value.get("names") or []),
                label="Flight actor-only scene",
                timeout_ms=120_000,
            )
            assert_active_flight_scene(active_scene)

            web_mcp = verify_flight_web_mcp(page, initial)
            web_mcp_calls.extend(web_mcp["calls"])

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

            blur = verify_blur_lifecycle(page, web_mcp_calls)

            throttle_result = control_flight_via_web_mcp(
                page,
                "/flight.sim @canvas #flight operation=throttle throttle=0.75",
                web_mcp_calls,
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

            stop_start = verify_stop_start_lifecycle(page, web_mcp_calls)
            stopped = stop_start["stopped"]
            frozen = stop_start["frozen"]
            resumed = stop_start["resumed"]
            resumed_advanced = stop_start["advanced"]

            restarted_result = control_flight_via_web_mcp(
                page,
                "/flight.sim @canvas #flight operation=restart",
                web_mcp_calls,
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
            _, inactive_inspection, post_exit = verify_flight_exit(
                page,
                web_mcp_calls,
                source_application["priorSurface"],
            )
            surface_failures = verify_surface_failure_paths(page)

            non_local_requests = sorted(
                {
                    request["url"]
                    for request in requests
                    if urlparse(request["url"]).netloc != local_origin
                }
            )
            local_runtime_paths = sorted(
                {
                    request["path"]
                    for request in requests
                    if urlparse(request["url"]).netloc == local_origin
                    and request["path"].startswith("/__")
                }
            )
            if non_local_requests or blocked_requests:
                raise AssertionError(
                    "Flight runtime attempted non-read-only or non-local requests: "
                    f"nonLocal={non_local_requests}, blocked={blocked_requests}"
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
            if not fs_list_requests or invalid_fs_list_requests:
                raise AssertionError(
                    "Flight bootstrap scanned an unrelated docs mirror: "
                    f"requests={fs_list_requests}, invalid={invalid_fs_list_requests}"
                )
            if console_errors or page_errors or failed_responses:
                raise AssertionError(
                    "browser errors: "
                    f"console={console_errors}, page={page_errors}, "
                    f"responses={failed_responses}"
                )

            evidence = {
                "schema": "knowgrph-flight-sim-browser-run/v2",
                "runIndex": RUN_INDEX,
                "runCount": RUN_COUNT,
                "candidate": {
                    "head": EXPECTED_HEAD,
                    "branch": EXPECTED_BRANCH,
                    "runtimeRevision": runtime_identity["knowgrphRevision"],
                    "runtimeBranch": runtime_identity["branch"],
                },
                "targetUrl": target_url,
                "source": source,
                "sourceApplication": source_application,
                "physicsBaseline": physics_baseline,
                "activation": {
                    "automatic": True,
                    "initialPhase": initial["phase"],
                    "readyHeldAtTickZero": ready_held["tick"] == 0,
                    "sourceBasename": SOURCE_BASENAME,
                },
                "renderer": {
                    "canvasCount": active_scene["canvasCount"],
                    "documentCanvasCount":
                        active_scene["documentCanvasCount"],
                    "rendererCanvasCount":
                        active_scene["rendererCanvasCount"],
                    "auxiliaryCanvasCount":
                        active_scene["auxiliaryCanvasCount"],
                    "auxiliaryCanvasesLocalOnly":
                        active_scene["auxiliaryCanvasesLocalOnly"],
                    "preFlightCanvasIdentityRetained":
                        active_scene["canvasStable"],
                    "authoredXrSceneRetained": True,
                    "physicsSourceSha256":
                        physics_baseline["sourceSha256"],
                    "authoredSceneSignature":
                        active_scene["authoredSceneSignature"],
                    "atmosphereTerrainSignature":
                        active_scene["atmosphereTerrainSignature"],
                    "actorOnlyMission": True,
                    "authoredSceneStableAcrossLifecycle": True,
                },
                "playableFrame": {
                    "firstFrame": True,
                    **first_playable_frame,
                    "limitMs": FIRST_PLAYABLE_FRAME_LIMIT_MS,
                    "airborneCapable": (
                        initial["aircraft"]["airspeed"] > 0
                        and initial["aircraft"]["position"][1] > 0
                    ),
                    "initialAltitude": initial["aircraft"]["position"][1],
                    "initialAirspeed": initial["aircraft"]["airspeed"],
                    "tickBefore": initial["tick"],
                    "tickAfterInput": moved["tick"],
                    "positionBefore": initial["aircraft"]["position"],
                    "positionAfter": moved["aircraft"]["position"],
                    "hudPitch": hud_pitch,
                    "hudRoll": hud_roll,
                },
                "webMcp": {
                    **web_mcp,
                    "calls": web_mcp_calls,
                    "inactiveInspect": inactive_inspection["result"],
                },
                "lifecycle": {
                    "blurStoppedTick": blur["stopped"]["tick"],
                    "blurFrozenTick": blur["frozen"]["tick"],
                    "blurResumedTick": blur["resumed"]["tick"],
                    "freshInputTick": blur["freshInput"]["tick"],
                    "stoppedTick": stopped["tick"],
                    "frozenTick": frozen["tick"],
                    "resumedTick": resumed["tick"],
                    "resumedAdvancedTick": resumed_advanced["tick"],
                    "restartRunId": restarted["runId"],
                    "postRestartTick": replayed["tick"],
                    "exitStateDiscarded": True,
                    "postExit": post_exit,
                    "surfaceFailurePaths": surface_failures,
                },
                "camera": {
                    **camera,
                    "tickAfter": camera_advanced["tick"],
                },
                "mobileHud": mobile_layout,
                "throttle": 0.75,
                "nonLocalRequests": non_local_requests,
                "blockedRequests": blocked_requests,
                "requests": requests,
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
