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

const DEFAULT_FOLLOW_OFFSET_METERS = Object.freeze([5.8, 3.8, 7.2] as const)

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
  const interactingRef = React.useRef(false)
  const offsetRef = React.useRef(new Vector3())
  const desiredTargetRef = React.useRef(new Vector3())
  const desiredCameraRef = React.useRef(new Vector3())

  React.useEffect(() => {
    const start = () => {
      interactingRef.current = true
    }
    const end = () => {
      interactingRef.current = false
      const target = desiredTargetRef.current
      offsetRef.current.copy(camera.position).sub(target)
    }
    controls.addEventListener('start', start)
    controls.addEventListener('end', end)
    return () => {
      controls.removeEventListener('start', start)
      controls.removeEventListener('end', end)
    }
  }, [camera, controls])

  useFrame((_state, deltaSecondsValue) => {
    const runtime = readXrNativeControllerDemo()
    const active = runtime.followCamera && !suspended
    if (!active) {
      activeRef.current = false
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
      offsetRef.current.set(
        DEFAULT_FOLLOW_OFFSET_METERS[0] * stageScale,
        DEFAULT_FOLLOW_OFFSET_METERS[1] * stageScale,
        DEFAULT_FOLLOW_OFFSET_METERS[2] * stageScale,
      )
      activeRef.current = true
    }
    if (interactingRef.current) return
    const deltaSeconds = Number.isFinite(deltaSecondsValue) ? Math.max(0, Math.min(0.1, deltaSecondsValue)) : 0
    const targetBlend = 1 - Math.exp(-8 * deltaSeconds)
    const cameraBlend = 1 - Math.exp(-5.5 * deltaSeconds)
    desiredCameraRef.current.copy(target).add(offsetRef.current)
    controls.target.lerp(target, targetBlend)
    camera.position.lerp(desiredCameraRef.current, cameraBlend)
    camera.lookAt(controls.target)
    controls.update()
  })
}
