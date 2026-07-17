import React from 'react'
import type { PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Canvas3dModeId } from '@/lib/config'
import { resolveCameraVerticalFovDegrees } from '@/lib/camera/cameraFramingPose'
import { applyCameraFramingPose } from './cameraFramingControlsRuntime'
import {
  XR_MOTION_STAGE_MIN_CAMERA_Y,
  XR_MOTION_STAGE_SPAN,
  xrMotionReferenceWorldPosition,
} from './xrMotionReferenceCoordinates'
import {
  resolveXrMotionReferenceStage,
  sampleXrMotionReferenceCameraPose,
  sampleXrMotionReferenceCameraSettings,
} from './xrMotionReferenceModel'
import {
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from './xrMotionReferenceRuntime'
import { xrChoreographyCanDriveCamera } from './xrCameraControlOwnership'

type CameraPlaybackReapplyListener = () => void
const cameraPlaybackReapplyListeners = new Set<CameraPlaybackReapplyListener>()
let cameraPlaybackReapplyRevision = 0

const subscribeCameraPlaybackReapply = (listener: CameraPlaybackReapplyListener): (() => void) => {
  cameraPlaybackReapplyListeners.add(listener)
  return () => cameraPlaybackReapplyListeners.delete(listener)
}

const readCameraPlaybackReapplyRevision = (): number => cameraPlaybackReapplyRevision

export function requestXrMotionReferenceCameraPlaybackReapply(): void {
  cameraPlaybackReapplyRevision += 1
  for (const listener of [...cameraPlaybackReapplyListeners]) listener()
}

export function useXrMotionReferenceCameraPlayback({
  camera,
  controls,
  mode,
  paused,
  playing,
  xrEmptyWorld,
}: {
  camera: PerspectiveCamera
  controls: OrbitControls
  mode: Canvas3dModeId
  paused: boolean
  playing: boolean
  xrEmptyWorld: boolean
}) {
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )
  const reapplyRevision = React.useSyncExternalStore(
    subscribeCameraPlaybackReapply,
    readCameraPlaybackReapplyRevision,
    readCameraPlaybackReapplyRevision,
  )
  const previousPlayingRef = React.useRef(playing)

  const applyTrackedPose = React.useCallback(() => {
    if (paused || !xrChoreographyCanDriveCamera({ mode, xrEmptyWorld, cameraMarkCount: runtime.plan.camera.length })) return
    const pose = sampleXrMotionReferenceCameraPose(runtime.plan.camera, runtime.playheadSeconds)
    const settings = sampleXrMotionReferenceCameraSettings(runtime.plan.camera, runtime.playheadSeconds)
    if (!pose || !settings) return
    const stage = resolveXrMotionReferenceStage(runtime.plan.stageId)
    const scale = XR_MOTION_STAGE_SPAN / Math.max(stage.sizeMeters[0], stage.sizeMeters[1], 1)
    camera.fov = resolveCameraVerticalFovDegrees(settings.focalLengthMm)
    applyCameraFramingPose({
      camera,
      controls,
      pose: {
        position: xrMotionReferenceWorldPosition(pose.position, scale),
        target: xrMotionReferenceWorldPosition(pose.target, scale),
        up: pose.up,
      },
      minimumY: XR_MOTION_STAGE_MIN_CAMERA_Y,
    })
  }, [camera, controls, mode, paused, runtime.plan.camera, runtime.plan.stageId, runtime.playheadSeconds, xrEmptyWorld])

  React.useEffect(() => {
    applyTrackedPose()
  }, [applyTrackedPose, reapplyRevision])

  React.useEffect(() => {
    const playbackStarted = playing && !previousPlayingRef.current
    previousPlayingRef.current = playing
    if (playbackStarted) applyTrackedPose()
  }, [applyTrackedPose, playing])
}
