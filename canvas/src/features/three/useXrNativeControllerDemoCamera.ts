import React from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { resolveXrMotionReferenceStage } from './xrSceneLibrary'
import { XR_MOTION_STAGE_SPAN } from './xrMotionReferenceCoordinates'
import { readXrMotionReferenceRuntime } from './xrMotionReferenceRuntime'
import {
  readSharedXrNativeControllerDemoFrame,
  readXrNativeControllerDemo,
} from './xrNativeControllerDemoRuntime'

const DEFAULT_FOLLOW_OFFSET_METERS = Object.freeze([0, 6.6, 9.5] as const)
const PLAYGROUND_FOV_DEGREES = 54

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
    const stageScale = XR_MOTION_STAGE_SPAN / Math.max(stage.sizeMeters[0], stage.sizeMeters[1], 1)
    const target = desiredTargetRef.current.set(
      frame.cameraTarget[0] * stageScale,
      frame.cameraTarget[1] * stageScale,
      frame.cameraTarget[2] * stageScale,
    )
    if (!activeRef.current) {
      previousFovRef.current = camera.fov
      offsetRef.current.set(
        DEFAULT_FOLLOW_OFFSET_METERS[0] * stageScale,
        DEFAULT_FOLLOW_OFFSET_METERS[1] * stageScale,
        DEFAULT_FOLLOW_OFFSET_METERS[2] * stageScale,
      )
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
    if (Math.abs(camera.fov - PLAYGROUND_FOV_DEGREES) > 0.01) {
      camera.fov = PLAYGROUND_FOV_DEGREES
      camera.updateProjectionMatrix()
    }
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
    const deltaSeconds = Number.isFinite(deltaSecondsValue) ? Math.max(0, Math.min(0.1, deltaSecondsValue)) : 0
    const targetBlend = 1 - Math.exp(-8 * deltaSeconds)
    const cameraBlend = 1 - Math.exp(-5.5 * deltaSeconds)
    const externallyDisplaced = resetDetected || (
      controls.target.distanceTo(target) > stageScale * 2.5
      || camera.position.distanceTo(desiredCameraRef.current) > stageScale * 2.5
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
