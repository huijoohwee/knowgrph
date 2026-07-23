from __future__ import annotations

from typing import Any

from playwright.sync_api import Page

from lib.game_flight_sim_smoke_camera_tracking import (
    poll as _poll,
    pose_changed as _pose_changed,
    read_fixed_follow_state as _read_fixed_follow_state,
    vector_distance as _vector_distance,
    verify_live_fixed_follow_tracking,
)


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


def verify_flight_camera_runtime(page: Page) -> dict[str, Any]:
    live_start, live_end = verify_live_fixed_follow_tracking(page)

    transition_setup = page.evaluate(
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
            pose: store.useGraphStore.getState().captureThreeCameraPose(),
          }
          camera.selectXrNativeControllerCameraMode('free-orbit')
          const canvas = document.querySelector(
            '[data-kg-xr-scene-media-drop="1"] canvas',
          )
          canvas?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          await waitFrames(3)
          await new Promise(resolve => window.setTimeout(resolve, 120))
          const during = {
            ...source.inspectLocalCameraSource(),
            flight: flight.readFlightSimSnapshot(),
            pointerLocked: document.pointerLockElement !== null,
            panelView: store.useGraphStore.getState().floatingPanelView,
            pose: store.useGraphStore.getState().captureThreeCameraPose(),
          }
          return { before, during }
        }
        """
    )
    before = transition_setup["before"]
    free_orbit_before_drag = transition_setup["during"]
    if not free_orbit_before_drag.get("pose"):
        raise AssertionError(
            f"Free Orbit did not expose a camera pose: {transition_setup}"
        )
    canvas = page.locator(
        '[data-kg-xr-scene-media-drop="1"] canvas'
    ).first
    box = canvas.bounding_box()
    if not box:
        raise AssertionError("Flight canvas was not measurable for Free Orbit")
    start_x = box["x"] + box["width"] * 0.5
    start_y = box["y"] + box["height"] * 0.5
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(start_x + 96, start_y + 36, steps=8)
    page.mouse.up()
    free_orbit = _poll(
        page,
        lambda: _read_camera_state(page),
        lambda value: (
            value.get("pose") is not None
            and value["source"]["selected"] == "free-orbit"
            and value["source"]["effectiveOwner"] == "free-orbit"
            and _vector_distance(
                free_orbit_before_drag["pose"]["position"],
                value["pose"]["position"],
            ) > 0.25
            and value["flight"]["tick"] > before["flight"]["tick"]
        ),
        label="Free Orbit camera rotation",
    )
    page.evaluate(
        """
        async () => {
          const camera = await import(
            '/src/features/three/xrNativeControllerCameraRuntime.ts'
          )
          camera.selectXrNativeControllerCameraMode('fixed-follow')
        }
        """
    )
    restored = _poll(
        page,
        lambda: _read_camera_state(page),
        lambda value: (
            value["source"]["selected"] == "fixed-follow"
            and value["source"]["effectiveOwner"] == "fixed-follow"
        ),
        label="Fixed Follow camera restoration",
    )
    expected_catalog = [
        {"id": "fixed-follow", "label": "Fixed Follow"},
        {"id": "free-orbit", "label": "Free Orbit"},
    ]
    catalog = [
        {"id": item["id"], "label": item["label"]}
        for item in before["available"]
    ]
    if (
        before["selected"] != "fixed-follow"
        or before["effectiveOwner"] != "fixed-follow"
        or catalog != expected_catalog
        or free_orbit["source"]["available"] != before["available"]
        or free_orbit_before_drag["pointerLocked"] is not False
        or free_orbit_before_drag["panelView"] != "flightSim"
        or free_orbit_before_drag["flight"]["active"] is not True
        or free_orbit_before_drag["flight"]["phase"] != "flying"
        or free_orbit_before_drag["flight"]["tick"] <= before["flight"]["tick"]
        or restored["source"]["available"] != before["available"]
        or restored["flight"]["active"] is not True
    ):
        raise AssertionError(
            "Flight camera-source transition was not isolated: "
            f"setup={transition_setup} free_orbit={free_orbit} "
            f"restored={restored}"
        )

    timeline_run = page.evaluate(
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
        _poll(
            page,
            lambda: _read_camera_state(page),
            lambda value: (
                value["flight"]["phase"] == "flying"
                and value["flight"]["tick"] > timeline_run["tick"]
            ),
            label="fresh Flight run before Timeline playback",
        )
    finally:
        page.keyboard.up("KeyW")

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
        lambda: _read_fixed_follow_state(page),
        lambda value: (
            value.get("pose") is not None
            and value["source"]["selected"] == "fixed-follow"
            and value["source"]["effectiveOwner"] == "fixed-follow"
            and value["flight"]["active"] is True
            and value["flight"]["phase"] == "stopped"
            and _pose_changed(timeline_end["pose"], value["pose"])
            and _vector_distance(
                value["pose"]["position"],
                value["expectedPose"]["position"],
            ) < 0.35
            and _vector_distance(
                value["pose"]["target"],
                value["expectedPose"]["target"],
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
          flight.restartFlightSim()
          return flight.startFlightSim()
        }
        """
    )
    page.keyboard.down("KeyW")
    try:
        resumed_state = _poll(
            page,
            lambda: _read_camera_state(page),
            lambda value: (
                value["flight"]["phase"] == "flying"
                and value["flight"]["tick"] > resumed["tick"]
            ),
            label="Flight ticks after fixed-follow camera return",
        )
    finally:
        page.keyboard.up("KeyW")

    return {
        "before": before["selected"],
        "during": free_orbit["source"]["selected"],
        "catalog": catalog,
        "pointerLocked": free_orbit_before_drag["pointerLocked"],
        "freeOrbit": {
            "poseBefore": free_orbit_before_drag["pose"],
            "poseAfter": free_orbit["pose"],
        },
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
            "expectedPosition": returned["expectedPose"]["position"],
            "expectedTarget": returned["expectedPose"]["target"],
            "tickAfterResume": resumed_state["flight"]["tick"],
            "liveTracking": {
                "first": {
                    "tick": live_start["flight"]["tick"],
                    "pose": live_start["pose"],
                    "expectedPose": live_start["expectedPose"],
                },
                "second": {
                    "tick": live_end["flight"]["tick"],
                    "pose": live_end["pose"],
                    "expectedPose": live_end["expectedPose"],
                },
            },
        },
    }
