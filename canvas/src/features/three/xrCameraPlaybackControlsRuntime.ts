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

export function useXrMotionReferenceCameraPlayback({
  camera,
  controls,
  mode,
  paused,
  xrEmptyWorld,
}: {
  camera: PerspectiveCamera
  controls: OrbitControls
  mode: Canvas3dModeId
  paused: boolean
  xrEmptyWorld: boolean
}) {
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )

  React.useEffect(() => {
    if (paused || mode !== 'xr' || xrEmptyWorld || runtime.plan.camera.length === 0) return
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
}
