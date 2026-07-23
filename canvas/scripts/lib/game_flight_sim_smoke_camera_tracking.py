from __future__ import annotations

import time
from typing import Any, Callable

from playwright.sync_api import Page


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
          const store = await import('/src/hooks/useGraphStore.ts')
          const snapshot = flight.readFlightSimSnapshot()
          const scale = native.XR_NATIVE_CONTROLLER_DEMO_STAGE_SCALE
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
          const camera = await import(
            '/src/features/three/xrNativeControllerCameraRuntime.ts'
          )
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          camera.selectXrNativeControllerCameraMode('fixed-follow')
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
