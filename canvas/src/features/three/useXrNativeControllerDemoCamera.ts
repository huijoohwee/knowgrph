import React from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { isXrPhysicsRunReadyDemoActive } from '@/features/workspace-fs/workspaceRunReadyDemos'
import { resolveXrMotionReferenceStage } from './xrSceneLibrary'
import { XR_MOTION_STAGE_SPAN } from './xrMotionReferenceCoordinates'
import { readXrMotionReferenceRuntime } from './xrMotionReferenceRuntime'
import {
  XR_NATIVE_CONTROLLER_DEMO_STAGE_SCALE,
  readSharedXrNativeControllerDemoFrame,
  readXrNativeControllerDemo,
} from './xrNativeControllerDemoRuntime'

const DEFAULT_FOLLOW_OFFSET_METERS = Object.freeze([0, 6.6, 9.5] as const)
const PLAYGROUND_FOV_DEGREES = 54
const AERIAL_FOV_DEGREES = 60
const AERIAL_ALTITUDE_START_METERS = 3
const AERIAL_ALTITUDE_RANGE_METERS = 17
const AERIAL_FOLLOW_RISE_METERS = 18
const AERIAL_FOLLOW_RETREAT_METERS = 11

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function useXrNativeControllerDemoCamera({
  camera,
  controls,
  suspended,
}: {
  camera: PerspectiveCamera
  controls: OrbitControls
  suspended: boolean
}) {
  const activeRef = React.useRef(false)
  const controlsCapabilitiesRef = React.useRef<null | {
    enablePan: boolean
    enableRotate: boolean
    enableZoom: boolean
  }>(null)
  const offsetRef = React.useRef(new Vector3())
  const desiredTargetRef = React.useRef(new Vector3())
  const desiredCameraRef = React.useRef(new Vector3())
  const desiredOffsetRef = React.useRef(new Vector3())
  const lastStepCountRef = React.useRef(-1)
  const previousFovRef = React.useRef<number | null>(null)

  React.useEffect(() => () => {
    if (previousFovRef.current !== null) {
      camera.fov = previousFovRef.current
      camera.updateProjectionMatrix()
    }
    if (controlsCapabilitiesRef.current) {
      Object.assign(controls, controlsCapabilitiesRef.current)
      controlsCapabilitiesRef.current = null
    }
  }, [camera, controls])

  useFrame((_state, deltaSecondsValue) => {
    const runtime = readXrNativeControllerDemo()
    const active = runtime.followCamera && !suspended
    if (!active) {
      if (activeRef.current && previousFovRef.current !== null) {
        camera.fov = previousFovRef.current
        camera.updateProjectionMatrix()
        previousFovRef.current = null
      }
      if (controlsCapabilitiesRef.current) {
        Object.assign(controls, controlsCapabilitiesRef.current)
        controlsCapabilitiesRef.current = null
      }
      activeRef.current = false
      lastStepCountRef.current = -1
      return
    }
    const frame = readSharedXrNativeControllerDemoFrame()
    const stage = resolveXrMotionReferenceStage(readXrMotionReferenceRuntime().plan.stageId)
    const stageScale = isXrPhysicsRunReadyDemoActive()
      ? XR_NATIVE_CONTROLLER_DEMO_STAGE_SCALE
      : XR_MOTION_STAGE_SPAN / Math.max(stage.sizeMeters[0], stage.sizeMeters[1], 1)
    const deltaSeconds = Number.isFinite(deltaSecondsValue) ? Math.max(0, Math.min(0.1, deltaSecondsValue)) : 0
    const altitude = Math.max(0, frame.player.position[1])
    const aerialFactor = frame.mode === 'rocket'
      ? clamp01((altitude - AERIAL_ALTITUDE_START_METERS) / AERIAL_ALTITUDE_RANGE_METERS)
      : 0
    const target = desiredTargetRef.current.set(
      frame.cameraTarget[0] * (1 - aerialFactor * 0.22) * stageScale,
      frame.cameraTarget[1] * (1 - aerialFactor * 0.58) * stageScale,
      frame.cameraTarget[2] * (1 - aerialFactor * 0.18) * stageScale,
    )
    desiredOffsetRef.current.set(
      DEFAULT_FOLLOW_OFFSET_METERS[0] * stageScale,
      (DEFAULT_FOLLOW_OFFSET_METERS[1] + aerialFactor * AERIAL_FOLLOW_RISE_METERS) * stageScale,
      (DEFAULT_FOLLOW_OFFSET_METERS[2] + aerialFactor * AERIAL_FOLLOW_RETREAT_METERS) * stageScale,
    )
    if (!activeRef.current) {
      previousFovRef.current = camera.fov
      offsetRef.current.copy(desiredOffsetRef.current)
      controls.target.copy(target)
      camera.position.copy(target).add(offsetRef.current)
      camera.lookAt(target)
      controls.update()
      activeRef.current = true
    }
    if (!controlsCapabilitiesRef.current) {
      controlsCapabilitiesRef.current = {
        enablePan: controls.enablePan,
        enableRotate: controls.enableRotate,
        enableZoom: controls.enableZoom,
      }
    }
    // Movement is world-relative, so the hero shot keeps a fixed yaw. This
    // preserves W/A/S/D and stick direction as the player translates.
    controls.enablePan = false
    controls.enableRotate = false
    controls.enableZoom = false
    const desiredFov = PLAYGROUND_FOV_DEGREES + (AERIAL_FOV_DEGREES - PLAYGROUND_FOV_DEGREES) * aerialFactor
    if (Math.abs(camera.fov - desiredFov) > 0.01) {
      camera.fov += (desiredFov - camera.fov) * (1 - Math.exp(-4 * deltaSeconds))
      camera.updateProjectionMatrix()
    }
    offsetRef.current.lerp(desiredOffsetRef.current, 1 - Math.exp(-2.6 * deltaSeconds))
    desiredCameraRef.current.copy(target).add(offsetRef.current)
    const resetDetected = lastStepCountRef.current >= 0 && frame.stepCount < lastStepCountRef.current
    lastStepCountRef.current = frame.stepCount
    if (runtime.phase !== 'running') {
      if (resetDetected) {
        controls.target.copy(target)
        camera.position.copy(desiredCameraRef.current)
        camera.lookAt(target)
        controls.update()
      }
      return
    }
    const targetBlend = 1 - Math.exp(-8 * deltaSeconds)
    const cameraBlend = 1 - Math.exp(-5.5 * deltaSeconds)
    const externallyDisplaced = resetDetected || (
      controls.target.distanceTo(target) > stageScale * (2.5 + aerialFactor * 10)
      || camera.position.distanceTo(desiredCameraRef.current) > stageScale * (2.5 + aerialFactor * 10)
    )
    if (externallyDisplaced) {
      controls.target.copy(target)
      camera.position.copy(desiredCameraRef.current)
    } else {
      controls.target.lerp(target, targetBlend)
      camera.position.lerp(desiredCameraRef.current, cameraBlend)
    }
    camera.lookAt(controls.target)
    controls.update()
  })
}
