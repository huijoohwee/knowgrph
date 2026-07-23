from __future__ import annotations

import time
from typing import Any, Callable

from playwright.sync_api import Page


def read_camera_state(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        async () => {
          const source = await import(
            '/src/features/strybldr/cameraSourceMcpRuntime.ts'
          )
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          const store = await import('/src/hooks/useGraphStore.ts')
          const canvas = document.querySelector(
            '[data-kg-xr-scene-media-drop="1"] canvas',
          )
          return {
            source: source.inspectLocalCameraSource(),
            flight: flight.readFlightSimSnapshot(),
            pose: store.useGraphStore.getState().captureThreeCameraPose(),
            pointerLocked: document.pointerLockElement === canvas,
            pointerState: canvas?.dataset.kgFlightSimPointerLock || '',
            panelView: store.useGraphStore.getState().floatingPanelView,
          }
        }
        """
    )


def poll(
    page: Page,
    read: Callable[[], dict[str, Any]],
    accepted: Callable[[dict[str, Any]], bool],
    *,
    label: str,
    timeout_ms: int = 15_000,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_ms / 1000
    last_value: dict[str, Any] = {}
    while time.monotonic() < deadline:
        last_value = read()
        if accepted(last_value):
            return last_value
        page.wait_for_timeout(100)
    raise AssertionError(f"timed out waiting for {label}: {last_value}")


def select_camera_via_catalog(
    page: Page,
    camera_id: str,
) -> dict[str, Any]:
    started = time.monotonic()
    result = page.evaluate(
        """
        async cameraId => {
          const camera = await import(
            '/src/features/strybldr/cameraMcpRuntime.ts'
          )
          return camera.controlLocalCamera({
            invocation:
              `/camera.select @camera #camera camera=${cameraId}`,
          })
        }
        """,
        camera_id,
    )
    state = poll(
        page,
        lambda: read_camera_state(page),
        lambda value: (
            value.get("pose") is not None
            and value["source"]["selected"] == camera_id
            and value["source"]["effectiveOwner"] == camera_id
        ),
        label=f"{camera_id} Camera catalog selection",
        timeout_ms=1_000,
    )
    observed_ms = (time.monotonic() - started) * 1_000
    result_source = (result.get("camera") or {}).get("source") or {}
    if (
        result.get("ok") is not True
        or result.get("action") != "select"
        or result.get("elapsedMs", -1) < 0
        or result.get("elapsedMs", 1_001) > 1_000
        or result.get("deadlineMs") != 1_000
        or result_source.get("selected") != camera_id
        or result_source.get("effectiveOwner") != camera_id
        or observed_ms > 1_000
    ):
        raise AssertionError(
            f"Camera catalog selection failed for {camera_id}: "
            f"result={result} state={state} observedMs={observed_ms}"
        )
    return {
        "cameraId": camera_id,
        "invocation":
            f"/camera.select @camera #camera camera={camera_id}",
        "observedMs": observed_ms,
        "result": result,
        "state": state,
    }


def vector_distance(
    left: dict[str, float],
    right: dict[str, float],
) -> float:
    return sum(
        (float(left[axis]) - float(right[axis])) ** 2
        for axis in ("x", "y", "z")
    ) ** 0.5


def pose_changed(
    left: dict[str, Any] | None,
    right: dict[str, Any] | None,
    *,
    minimum_distance: float = 1,
) -> bool:
    if not left or not right:
        return False
    return (
        vector_distance(left["position"], right["position"]) > minimum_distance
        and vector_distance(left["target"], right["target"]) > minimum_distance
    )


def read_fixed_follow_state(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        async () => {
          const source = await import(
            '/src/features/strybldr/cameraSourceMcpRuntime.ts'
          )
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          const native = await import(
            '/src/features/three/xrNativeControllerDemoRuntime.ts'
          )
          const coordinates = await import(
            '/src/features/game-flight-sim/flightSimSpatialScale.ts'
          )
          const store = await import('/src/hooks/useGraphStore.ts')
          const snapshot = flight.readFlightSimSnapshot()
          const scale = coordinates.resolveFlightSimGameplayCoordinateScale(
            native.XR_NATIVE_CONTROLLER_DEMO_STAGE_SCALE,
            true,
          )
          const horizontal = Math.cos(snapshot.aircraft.pitch)
          const forward = [
            -Math.sin(snapshot.aircraft.yaw) * horizontal,
            Math.sin(snapshot.aircraft.pitch),
            -Math.cos(snapshot.aircraft.yaw) * horizontal,
          ]
          const target = {
            x: snapshot.aircraft.position[0] * scale,
            y: (snapshot.aircraft.position[1] + 0.8) * scale,
            z: snapshot.aircraft.position[2] * scale,
          }
          const position = {
            x: target.x - forward[0] * 8 * scale,
            y: target.y - forward[1] * 2 * scale + 3.2 * scale,
            z: target.z - forward[2] * 8 * scale,
          }
          return {
            source: source.inspectLocalCameraSource(),
            flight: snapshot,
            pose: store.useGraphStore.getState().captureThreeCameraPose(),
            expectedPose: { position, target },
          }
        }
        """
    )


def verify_live_fixed_follow_tracking(
    page: Page,
) -> tuple[dict[str, Any], dict[str, Any]]:
    fresh_run = page.evaluate(
        """
        async () => {
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          flight.restartFlightSim()
          return flight.startFlightSim()
        }
        """
    )
    page.keyboard.down("KeyW")
    try:
        live_start = poll(
            page,
            lambda: read_fixed_follow_state(page),
            lambda value: (
                value.get("pose") is not None
                and value["source"]["selected"] == "fixed-follow"
                and value["source"]["effectiveOwner"] == "fixed-follow"
                and value["flight"]["phase"] == "flying"
                and value["flight"]["tick"] > fresh_run["tick"]
                and vector_distance(
                    value["pose"]["position"],
                    value["expectedPose"]["position"],
                ) < 4.5
                and vector_distance(
                    value["pose"]["target"],
                    value["expectedPose"]["target"],
                ) < 3
            ),
            label="first running fixed-follow sample",
        )
        live_end = poll(
            page,
            lambda: read_fixed_follow_state(page),
            lambda value: (
                value.get("pose") is not None
                and value["source"]["effectiveOwner"] == "fixed-follow"
                and value["flight"]["phase"] == "flying"
                and value["flight"]["tick"] >= live_start["flight"]["tick"] + 8
                and pose_changed(
                    live_start["expectedPose"],
                    value["expectedPose"],
                    minimum_distance=0.75,
                )
                and pose_changed(
                    live_start["pose"],
                    value["pose"],
                    minimum_distance=0.5,
                )
                and vector_distance(
                    value["pose"]["position"],
                    value["expectedPose"]["position"],
                ) < 5
                and vector_distance(
                    value["pose"]["target"],
                    value["expectedPose"]["target"],
                ) < 3.5
            ),
            label="second running fixed-follow sample",
        )
    finally:
        page.keyboard.up("KeyW")
    return live_start, live_end


def _start_flying(page: Page, label: str) -> dict[str, Any]:
    started = page.evaluate(
        """
        async () => {
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          flight.restartFlightSim()
          return flight.startFlightSim()
        }
        """
    )
    page.keyboard.down("KeyW")
    try:
        return poll(
            page,
            lambda: read_camera_state(page),
            lambda value: (
                value["flight"]["phase"] == "flying"
                and value["flight"]["tick"] > started["tick"]
            ),
            label=label,
        )
    finally:
        page.keyboard.up("KeyW")


def _lock_flight_canvas(page: Page) -> dict[str, Any]:
    canvas = page.locator(
        '[data-kg-xr-scene-media-drop="1"] canvas'
    ).first
    canvas.scroll_into_view_if_needed()
    box = canvas.bounding_box()
    if not box:
        raise AssertionError("Flight canvas was not measurable for pointer lock")
    canvas.click(
        force=True,
        position={
            "x": box["width"] * 0.5,
            "y": box["height"] * 0.5,
        },
    )
    return poll(
        page,
        lambda: read_camera_state(page),
        lambda value: (
            value["pointerLocked"] is True
            and value["pointerState"] == "locked"
        ),
        label="Flight canvas pointer capture",
    )


def verify_camera_pointer_transitions(page: Page) -> dict[str, Any]:
    fixed_selection = select_camera_via_catalog(page, "fixed-follow")
    _start_flying(page, "Flight run before Fixed Follow pointer release")
    fixed_locked = _lock_flight_canvas(page)
    fixed_release = page.evaluate(
        """
        async () => {
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          const canvas = document.querySelector(
            '[data-kg-xr-scene-media-drop="1"] canvas',
          )
          const before = flight.readFlightSimSnapshot()
          const released = new Promise(resolve => {
            const timeout = window.setTimeout(
              () => resolve('timeout'),
              1_000,
            )
            document.addEventListener('pointerlockchange', () => {
              window.clearTimeout(timeout)
              resolve('released')
            }, { once: true })
          })
          await document.exitPointerLock()
          const event = await released
          return {
            event,
            before,
            after: flight.readFlightSimSnapshot(),
            pointerLocked: document.pointerLockElement === canvas,
            pointerState: canvas?.dataset.kgFlightSimPointerLock || '',
          }
        }
        """
    )
    if (
        fixed_release["event"] != "released"
        or fixed_release["pointerLocked"] is not False
        or fixed_release["pointerState"] != "released"
        or fixed_release["after"]["phase"] != "stopped"
        or fixed_release["after"]["tick"] != fixed_release["before"]["tick"]
        or fixed_release["after"]["aircraft"]
        != fixed_release["before"]["aircraft"]
    ):
        raise AssertionError(
            f"Fixed Follow pointer release did not pause unchanged: "
            f"{fixed_release}"
        )

    select_camera_via_catalog(page, "fixed-follow")
    _start_flying(page, "Flight run before Free Orbit pointer-lock exit")
    free_locked = _lock_flight_canvas(page)
    free_transition = page.evaluate(
        """
        async () => {
          const camera = await import(
            '/src/features/strybldr/cameraMcpRuntime.ts'
          )
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          const canvas = document.querySelector(
            '[data-kg-xr-scene-media-drop="1"] canvas',
          )
          const before = flight.readFlightSimSnapshot()
          const released = new Promise(resolve => {
            const timeout = window.setTimeout(
              () => resolve('timeout'),
              1_000,
            )
            document.addEventListener('pointerlockchange', () => {
              window.clearTimeout(timeout)
              resolve('released')
            }, { once: true })
          })
          const result = camera.controlLocalCamera({
            invocation:
              '/camera.select @camera #camera camera=free-orbit',
          })
          await document.exitPointerLock()
          const event = await released
          const after = flight.readFlightSimSnapshot()
          await new Promise(resolve => window.setTimeout(resolve, 120))
          return {
            event,
            result,
            before,
            after,
            later: flight.readFlightSimSnapshot(),
            pointerLocked: document.pointerLockElement === canvas,
            pointerState: canvas?.dataset.kgFlightSimPointerLock || '',
          }
        }
        """
    )
    result = free_transition["result"]
    if (
        free_transition["event"] != "released"
        or result.get("ok") is not True
        or result.get("elapsedMs", 1_001) > 1_000
        or (result.get("camera") or {}).get("source", {}).get("selected")
        != "free-orbit"
        or free_transition["pointerLocked"] is not False
        or free_transition["pointerState"] != "released"
        or free_transition["after"]["phase"] != "flying"
        or free_transition["after"]["tick"]
        != free_transition["before"]["tick"]
        or free_transition["after"]["aircraft"]
        != free_transition["before"]["aircraft"]
        or free_transition["later"]["phase"] != "flying"
        or free_transition["later"]["tick"]
        <= free_transition["after"]["tick"]
    ):
        raise AssertionError(
            f"Free Orbit pointer-lock exit did not preserve the run: "
            f"{free_transition}"
        )
    return {
        "fixedFollow": {
            "selection": fixed_selection,
            "locked": fixed_locked,
            "released": fixed_release,
        },
        "freeOrbit": {
            "locked": free_locked,
            "transition": free_transition,
        },
    }
