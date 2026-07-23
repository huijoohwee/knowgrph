from __future__ import annotations

import time
from typing import Any, Callable

from playwright.sync_api import Page


def _poll(
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


def _vector_distance(
    left: dict[str, float],
    right: dict[str, float],
) -> float:
    return sum(
        (float(left[axis]) - float(right[axis])) ** 2
        for axis in ("x", "y", "z")
    ) ** 0.5


def _read_camera_state(page: Page) -> dict[str, Any]:
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
          return {
            source: source.inspectLocalCameraSource(),
            flight: flight.readFlightSimSnapshot(),
            pose: store.useGraphStore.getState().captureThreeCameraPose(),
            pointerLocked: document.pointerLockElement !== null,
            panelView: store.useGraphStore.getState().floatingPanelView,
          }
        }
        """
    )


def _pose_changed(
    left: dict[str, Any] | None,
    right: dict[str, Any] | None,
    *,
    minimum_distance: float = 1,
) -> bool:
    if not left or not right:
        return False
    return (
        _vector_distance(left["position"], right["position"]) > minimum_distance
        and _vector_distance(left["target"], right["target"]) > minimum_distance
    )


def verify_flight_camera_runtime(page: Page) -> dict[str, Any]:
    source_transition = page.evaluate(
        """
        async () => {
          const camera = await import(
            '/src/features/three/xrNativeControllerCameraRuntime.ts'
          )
          const source = await import(
            '/src/features/strybldr/cameraSourceMcpRuntime.ts'
          )
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          const store = await import('/src/hooks/useGraphStore.ts')
          const waitFrames = async count => {
            for (let index = 0; index < count; index += 1) {
              await new Promise(resolve => requestAnimationFrame(resolve))
            }
          }
          camera.selectXrNativeControllerCameraMode('fixed-follow')
          await waitFrames(3)
          const before = {
            ...source.inspectLocalCameraSource(),
            flight: flight.readFlightSimSnapshot(),
          }
          camera.selectXrNativeControllerCameraMode('free-orbit')
          const canvas = document.querySelector(
            'canvas[data-kg-flight-sim-first-frame="1"]',
          )
          canvas?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          await waitFrames(3)
          await new Promise(resolve => window.setTimeout(resolve, 120))
          const during = {
            ...source.inspectLocalCameraSource(),
            flight: flight.readFlightSimSnapshot(),
            pointerLocked: document.pointerLockElement !== null,
            panelView: store.useGraphStore.getState().floatingPanelView,
          }
          camera.selectXrNativeControllerCameraMode('fixed-follow')
          await waitFrames(3)
          return {
            before,
            during,
            restored: {
              ...source.inspectLocalCameraSource(),
              flight: flight.readFlightSimSnapshot(),
            },
          }
        }
        """
    )
    before = source_transition["before"]
    free_orbit = source_transition["during"]
    restored = source_transition["restored"]
    if (
        before["selected"] != "fixed-follow"
        or free_orbit["selected"] != "free-orbit"
        or free_orbit["effectiveOwner"] != "free-orbit"
        or free_orbit["pointerLocked"] is not False
        or free_orbit["panelView"] != "flightSim"
        or free_orbit["flight"]["active"] is not True
        or free_orbit["flight"]["phase"] != "flying"
        or free_orbit["flight"]["tick"] <= before["flight"]["tick"]
        or restored["selected"] != "fixed-follow"
        or restored["flight"]["active"] is not True
    ):
        raise AssertionError(
            f"Flight camera-source transition was not isolated: {source_transition}"
        )

    timeline_setup = page.evaluate(
        """
        async () => {
          const motion = await import(
            '/src/features/three/xrMotionReferenceRuntime.ts'
          )
          const playback = await import(
            '/src/features/three/xrCameraPlaybackControlsRuntime.ts'
          )
          const timeline = await import(
            '/src/features/three/xrMotionReferenceTimeline.ts'
          )
          const store = await import('/src/hooks/useGraphStore.ts')
          const runtime = motion.readXrMotionReferenceRuntime()
          const anchors = runtime.plan.cast.slice(0, 2)
          if (runtime.plan.camera.length !== 0) {
            return {
              ok: false,
              reason: 'authored Flight seed already contained camera marks',
              cameraMarks: runtime.plan.camera.length,
            }
          }
          if (anchors.length < 2) {
            return { ok: false, reason: 'fewer than two authored camera anchors' }
          }
          const state = store.useGraphStore.getState()
          const previousTransport = {
            documentKey: state.timelineTransportDocumentKey,
            position: state.timelineTransportPosition,
            playing: state.timelineTransportPlaying,
            playbackRate: state.timelineTransportPlaybackRate,
          }
          const endTime = Math.min(4, runtime.plan.durationSeconds)
          motion.setXrMotionReferenceCameraMark({
            timeSeconds: 0,
            anchorId: anchors[0].actorId,
            rig: 'dolly',
            easing: 'linear',
            settings: {
              angle: 'front',
              level: 'eye-level',
              shot: 'medium',
              note: '',
              orbitX: 0,
              orbitY: 0,
              sensorId: 'super-35',
              focalLengthMm: 35,
              focusDistanceMeters: 6,
              aspectRatio: '16:9',
            },
          })
          motion.setXrMotionReferenceCameraMark({
            timeSeconds: endTime,
            anchorId: anchors[1].actorId,
            rig: 'drone',
            easing: 'linear',
            settings: {
              angle: 'right-side',
              level: 'high-angle',
              shot: 'wide',
              note: '',
              orbitX: 0.5,
              orbitY: -0.4,
              sensorId: 'full-frame',
              focalLengthMm: 70,
              focusDistanceMeters: 4,
              aspectRatio: '2.39:1',
            },
          })
          const documentKey = timeline.xrMotionReferenceTimelineDocumentKey(
            state.markdownDocumentName,
          )
          motion.setXrMotionReferencePlayhead(0)
          state.setTimelineTransportState({
            documentKey,
            position: 0,
            playing: true,
          })
          playback.requestXrMotionReferenceCameraPlaybackReapply()
          return {
            ok: true,
            anchorIds: anchors.map(anchor => anchor.actorId),
            cameraMarks:
              motion.readXrMotionReferenceRuntime().plan.camera.length,
            documentKey,
            endTime,
            previousRuntime: runtime,
            previousTransport,
          }
        }
        """
    )
    if (
        timeline_setup.get("ok") is not True
        or timeline_setup.get("cameraMarks") != 2
    ):
        raise AssertionError(f"Timeline camera setup failed: {timeline_setup}")

    timeline_start = _poll(
        page,
        lambda: _read_camera_state(page),
        lambda value: value.get("pose") is not None
        and value["source"]["selected"] == "fixed-follow"
        and value["source"]["effectiveOwner"] == "timeline-playback",
        label="Timeline camera ownership at the first mark",
    )
    page.evaluate(
        """
        async endTime => {
          const motion = await import(
            '/src/features/three/xrMotionReferenceRuntime.ts'
          )
          const playback = await import(
            '/src/features/three/xrCameraPlaybackControlsRuntime.ts'
          )
          const store = await import('/src/hooks/useGraphStore.ts')
          motion.setXrMotionReferencePlayhead(endTime)
          store.useGraphStore.getState().setTimelineTransportState({
            position: endTime / 60,
          })
          playback.requestXrMotionReferenceCameraPlaybackReapply()
        }
        """,
        timeline_setup["endTime"],
    )
    timeline_end = _poll(
        page,
        lambda: _read_camera_state(page),
        lambda value: (
            value.get("pose") is not None
            and value["source"]["effectiveOwner"] == "timeline-playback"
            and _pose_changed(timeline_start["pose"], value["pose"])
            and value["flight"]["tick"] > timeline_start["flight"]["tick"]
        ),
        label="Timeline camera position, target, and Flight tick change",
    )

    page.evaluate(
        """
        async () => {
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          const store = await import('/src/hooks/useGraphStore.ts')
          flight.stopFlightSim()
          store.useGraphStore.getState().setTimelineTransportState({
            playing: false,
          })
        }
        """
    )

    returned = _poll(
        page,
        lambda: page.evaluate(
            """
            async () => {
              const source = await import(
                '/src/features/strybldr/cameraSourceMcpRuntime.ts'
              )
              const flight = await import(
                '/src/features/game-flight-sim/flightSimRuntime.ts'
              )
              const model = await import(
                '/src/features/game-flight-sim/flightModel.ts'
              )
              const native = await import(
                '/src/features/three/xrNativeControllerDemoRuntime.ts'
              )
              const store = await import('/src/hooks/useGraphStore.ts')
              const snapshot = flight.readFlightSimSnapshot()
              const scale = native.XR_NATIVE_CONTROLLER_DEMO_STAGE_SCALE
              const forward = model.flightSimForwardVector(
                snapshot.aircraft.pitch,
                snapshot.aircraft.yaw,
              )
              const expectedTarget = {
                x: snapshot.aircraft.position[0] * scale,
                y: (snapshot.aircraft.position[1] + 0.8) * scale,
                z: snapshot.aircraft.position[2] * scale,
              }
              const expectedPosition = {
                x: expectedTarget.x - forward[0] * 8 * scale,
                y: expectedTarget.y - forward[1] * 2 * scale + 3.2 * scale,
                z: expectedTarget.z - forward[2] * 8 * scale,
              }
              return {
                source: source.inspectLocalCameraSource(),
                flight: snapshot,
                pose: store.useGraphStore.getState().captureThreeCameraPose(),
                expectedPosition,
                expectedTarget,
              }
            }
            """
        ),
        lambda value: (
            value.get("pose") is not None
            and value["source"]["selected"] == "fixed-follow"
            and value["source"]["effectiveOwner"] == "fixed-follow"
            and value["flight"]["active"] is True
            and value["flight"]["phase"] == "stopped"
            and _pose_changed(timeline_end["pose"], value["pose"])
            and _vector_distance(
                value["pose"]["position"],
                value["expectedPosition"],
            ) < 0.35
            and _vector_distance(
                value["pose"]["target"],
                value["expectedTarget"],
            ) < 0.35
        ),
        label="fixed-follow camera pose after Timeline playback",
    )
    page.evaluate(
        """
        async cleanup => {
          const motion = await import(
            '/src/features/three/xrMotionReferenceRuntime.ts'
          )
          const store = await import('/src/hooks/useGraphStore.ts')
          motion.restoreXrMotionReferenceRuntimeSnapshot(
            cleanup.previousRuntime,
          )
          store.useGraphStore.getState().setTimelineTransportState(
            cleanup.previousTransport,
          )
        }
        """,
        {
            "previousRuntime": timeline_setup["previousRuntime"],
            "previousTransport": timeline_setup["previousTransport"],
        },
    )
    cleaned_up = page.evaluate(
        """
        async () => {
          const motion = await import(
            '/src/features/three/xrMotionReferenceRuntime.ts'
          )
          const store = await import('/src/hooks/useGraphStore.ts')
          const state = store.useGraphStore.getState()
          return {
            cameraMarks:
              motion.readXrMotionReferenceRuntime().plan.camera.length,
            dirty: motion.readXrMotionReferenceRuntime().dirty,
            documentKey: state.timelineTransportDocumentKey,
            playing: state.timelineTransportPlaying,
            playbackRate: state.timelineTransportPlaybackRate,
            position: state.timelineTransportPosition,
          }
        }
        """
    )
    if cleaned_up != {
        "cameraMarks": 0,
        "dirty": timeline_setup["previousRuntime"]["dirty"],
        "documentKey": timeline_setup["previousTransport"]["documentKey"],
        "playing": timeline_setup["previousTransport"]["playing"],
        "playbackRate": timeline_setup["previousTransport"]["playbackRate"],
        "position": timeline_setup["previousTransport"]["position"],
    }:
        raise AssertionError(
            f"Timeline camera smoke state was not restored: {cleaned_up}"
        )
    resumed = page.evaluate(
        """
        async () => {
          const flight = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          return flight.startFlightSim()
        }
        """
    )
    resumed_state = _poll(
        page,
        lambda: _read_camera_state(page),
        lambda value: value["flight"]["phase"] == "flying"
        and value["flight"]["tick"] > resumed["tick"],
        label="Flight ticks after fixed-follow camera return",
    )

    return {
        "before": before["selected"],
        "during": free_orbit["selected"],
        "pointerLocked": free_orbit["pointerLocked"],
        "timeline": {
            "anchorIds": timeline_setup["anchorIds"],
            "cameraMarks": timeline_setup["cameraMarks"],
            "effectiveOwner": timeline_end["source"]["effectiveOwner"],
            "startPose": timeline_start["pose"],
            "endPose": timeline_end["pose"],
            "tickBefore": timeline_start["flight"]["tick"],
            "tickAfter": timeline_end["flight"]["tick"],
            "cleanedUp": cleaned_up,
        },
        "returned": {
            "selected": returned["source"]["selected"],
            "effectiveOwner": returned["source"]["effectiveOwner"],
            "pose": returned["pose"],
            "expectedPosition": returned["expectedPosition"],
            "expectedTarget": returned["expectedTarget"],
            "tickAfterResume": resumed_state["flight"]["tick"],
        },
    }
