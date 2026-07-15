import React from 'react'
import type { PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Canvas3dModeId } from '@/lib/config'
import {
  publishCameraFramingRuntime,
  readCameraFramingRuntime,
  subscribeCameraFramingRuntime,
  type CameraFramingRuntimeSource,
} from '@/features/strybldr/cameraFramingRuntime'
import {
  resolveCameraFramingAxisSettings,
  resolveCameraFramingPose,
  resolveCameraFramingSettingsFromPose,
  type CameraFramingPose,
} from '@/lib/camera/cameraFramingPose'
import {
  readSpatialCaptureAxis,
  setSpatialCaptureAxis,
  subscribeSpatialCaptureAxis,
  type SpatialCaptureAxisId,
  type SpatialCaptureViewAxisId,
} from './xrSpatialCaptureTools'
import {
  readModelAssetCameraPose,
  type ModelAssetCameraFit,
  type ModelAssetCameraPose,
} from './modelAssetCameraPose'

type CameraFramingControlsRuntimeArgs = {
  camera: PerspectiveCamera
  controls: OrbitControls
  mode: Canvas3dModeId
  paused: boolean
  modelAssetRenderKey?: string
  modelAssetFit?: ModelAssetCameraFit | null
}

type CameraFramingContext = {
  target: [number, number, number]
  up: [number, number, number]
  baseDistance: number
  near?: number
  far?: number
}

export type CameraFramingSettleScheduler = Readonly<{
  schedule: (callback: () => void, delayMs: number) => unknown
  cancel: (handle: unknown) => void
}>

export type CameraFramingSettledInteraction = Readonly<{
  start: () => void
  change: () => void
  end: () => void
  cancel: () => void
}>

export type ImmediateCanvasPublish = Readonly<{
  revision: number
  contextKey: string
  fit: unknown
}>

const CAMERA_FRAMING_SETTLE_DELAY_MS = 80
const cameraFramingControlsReapplyListeners = new Set<() => void>()
let cameraFramingControlsReapplyRevision = 0

const DEFAULT_CAMERA_FRAMING_SETTLE_SCHEDULER: CameraFramingSettleScheduler = {
  schedule: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel: handle => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
}

export function createCameraFramingSettledInteraction({
  publish,
  scheduler = DEFAULT_CAMERA_FRAMING_SETTLE_SCHEDULER,
  delayMs = CAMERA_FRAMING_SETTLE_DELAY_MS,
}: {
  publish: () => void
  scheduler?: CameraFramingSettleScheduler
  delayMs?: number
}): CameraFramingSettledInteraction {
  let interacting = false
  let settling = false
  let pendingHandle: unknown = null
  const clearPending = () => {
    if (pendingHandle === null) return
    scheduler.cancel(pendingHandle)
    pendingHandle = null
  }
  const schedulePublish = () => {
    clearPending()
    pendingHandle = scheduler.schedule(() => {
      pendingHandle = null
      if (!settling) return
      settling = false
      publish()
    }, Math.max(0, delayMs))
  }
  return Object.freeze({
    start: () => {
      clearPending()
      interacting = true
      settling = false
    },
    change: () => {
      if (settling) schedulePublish()
    },
    end: () => {
      if (!interacting) return
      interacting = false
      settling = true
      schedulePublish()
    },
    cancel: () => {
      clearPending()
      interacting = false
      settling = false
    },
  })
}

export function readCameraFramingControlsReapplyRevision(): number {
  return cameraFramingControlsReapplyRevision
}

export function shouldSkipImmediateCanvasFramingApply({
  source,
  revision,
  contextKey,
  fit,
  immediate,
}: {
  source: CameraFramingRuntimeSource
  revision: number
  contextKey: string
  fit: unknown
  immediate: ImmediateCanvasPublish | null
}): boolean {
  return source === 'canvas'
    && immediate?.revision === revision
    && immediate.contextKey === contextKey
    && immediate.fit === fit
}

function subscribeCameraFramingControlsReapply(listener: () => void): () => void {
  cameraFramingControlsReapplyListeners.add(listener)
  return () => cameraFramingControlsReapplyListeners.delete(listener)
}

const distanceBetween = (a: readonly number[], b: readonly number[]): number => {
  const dx = Number(a[0]) - Number(b[0])
  const dy = Number(a[1]) - Number(b[1])
  const dz = Number(a[2]) - Number(b[2])
  const distance = Math.hypot(dx, dy, dz)
  return Number.isFinite(distance) && distance > 0 ? distance : 1
}

const contextFromModelPose = (pose: ModelAssetCameraPose): CameraFramingContext => ({
  target: pose.target,
  up: pose.up,
  baseDistance: distanceBetween(pose.position, pose.target),
  near: pose.near,
  far: pose.far,
})

export function applyCameraFramingPose({
  camera,
  controls,
  pose,
  near,
  far,
}: {
  camera: PerspectiveCamera
  controls: OrbitControls
  pose: CameraFramingPose
  near?: number
  far?: number
}) {
  camera.up.set(pose.up[0], pose.up[1], pose.up[2])
  camera.position.set(pose.position[0], pose.position[1], pose.position[2])
  controls.target.set(pose.target[0], pose.target[1], pose.target[2])
  if (typeof near === 'number' && Number.isFinite(near) && near > 0) camera.near = near
  if (typeof far === 'number' && Number.isFinite(far) && far > camera.near) camera.far = far
  camera.updateProjectionMatrix()
  camera.lookAt(controls.target)
  controls.update()
}

export function applyModelAssetCameraPose({
  camera,
  controls,
  fit,
  perspectiveCamera,
}: {
  camera: PerspectiveCamera
  controls: OrbitControls
  fit: ModelAssetCameraFit
  perspectiveCamera: PerspectiveCamera
}) {
  const pose = readModelAssetCameraPose(fit)
  camera.up.set(pose.up[0], pose.up[1], pose.up[2])
  camera.position.set(pose.position[0], pose.position[1], pose.position[2])
  controls.target.set(pose.target[0], pose.target[1], pose.target[2])
  perspectiveCamera.fov = 50
  perspectiveCamera.zoom = 1
  perspectiveCamera.near = pose.near
  perspectiveCamera.far = pose.far
  perspectiveCamera.updateProjectionMatrix()
  camera.lookAt(controls.target)
  controls.update()
}

export function requestCameraFramingControlsReapply(): boolean {
  const axis = readSpatialCaptureAxis()
  if (axis !== 'free') {
    setSpatialCaptureAxis(axis)
    return true
  }
  const current = readCameraFramingRuntime()
  if (current.revision === 0) return false
  cameraFramingControlsReapplyRevision += 1
  for (const listener of [...cameraFramingControlsReapplyListeners]) listener()
  return true
}

export function useCameraFramingControlsRuntime({
  camera,
  controls,
  mode,
  paused,
  modelAssetRenderKey,
  modelAssetFit,
}: CameraFramingControlsRuntimeArgs) {
  const framing = React.useSyncExternalStore(
    subscribeCameraFramingRuntime,
    readCameraFramingRuntime,
    readCameraFramingRuntime,
  )
  const reapplyRevision = React.useSyncExternalStore(
    subscribeCameraFramingControlsReapply,
    readCameraFramingControlsReapplyRevision,
    readCameraFramingControlsReapplyRevision,
  )
  const [axisRequest, setAxisRequest] = React.useState<{ axis: SpatialCaptureAxisId; revision: number }>(() => ({
    axis: readSpatialCaptureAxis(),
    revision: 0,
  }))
  const graphBaseDistanceRef = React.useRef(0)
  const graphBaseKeyRef = React.useRef('')
  const applyingPoseRef = React.useRef(false)
  const handledReapplyRevisionRef = React.useRef(reapplyRevision)
  const immediateCanvasPublishRef = React.useRef<ImmediateCanvasPublish | null>(null)
  const contextKey = String(modelAssetRenderKey || '').trim() || 'graph'

  const runProgrammaticPose = React.useCallback((apply: () => void) => {
    applyingPoseRef.current = true
    try {
      apply()
    } finally {
      applyingPoseRef.current = false
    }
  }, [])

  const readContext = React.useCallback((): CameraFramingContext => {
    if (modelAssetFit) return contextFromModelPose(readModelAssetCameraPose(modelAssetFit))
    const key = String(modelAssetRenderKey || 'graph')
    const target: [number, number, number] = [controls.target.x, controls.target.y, controls.target.z]
    const position: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z]
    if (graphBaseKeyRef.current !== key || !(graphBaseDistanceRef.current > 0)) {
      graphBaseKeyRef.current = key
      graphBaseDistanceRef.current = distanceBetween(position, target)
    }
    return {
      target,
      up: [camera.up.x, camera.up.y, camera.up.z],
      baseDistance: graphBaseDistanceRef.current,
    }
  }, [camera, controls, modelAssetFit, modelAssetRenderKey])

  React.useEffect(() => subscribeSpatialCaptureAxis(axis => {
    setAxisRequest(current => ({ axis, revision: current.revision + 1 }))
  }), [])

  React.useEffect(() => {
    if (mode !== 'xr' || paused) immediateCanvasPublishRef.current = null
  }, [mode, paused])

  React.useEffect(() => {
    const key = String(modelAssetRenderKey || '').trim()
    if (!key || !modelAssetFit || paused) return
    if (mode === 'xr' && (axisRequest.axis !== 'free' || framing.revision > 0)) return
    runProgrammaticPose(() => applyModelAssetCameraPose({ camera, controls, fit: modelAssetFit, perspectiveCamera: camera }))
  }, [axisRequest.axis, camera, controls, framing.revision, mode, modelAssetFit, modelAssetRenderKey, paused, runProgrammaticPose])

  React.useEffect(() => {
    if (paused || mode !== 'xr' || !modelAssetFit || axisRequest.axis === 'free') return
    const context = contextFromModelPose(readModelAssetCameraPose(modelAssetFit))
    const current = readCameraFramingRuntime()
    const settings = resolveCameraFramingAxisSettings(
      axisRequest.axis as SpatialCaptureViewAxisId,
      current.settings,
    )
    const pose = resolveCameraFramingPose({
      settings,
      target: context.target,
      baseDistance: context.baseDistance,
      up: context.up,
    })
    runProgrammaticPose(() => applyCameraFramingPose({ camera, controls, pose, near: context.near, far: context.far }))
    publishCameraFramingRuntime({
      anchorId: current.anchorId,
      settings,
      source: 'axis',
    })
  }, [axisRequest, camera, controls, mode, modelAssetFit, paused, runProgrammaticPose])

  React.useEffect(() => {
    if (paused || mode !== 'xr' || framing.revision === 0) return
    const forcedReapply = handledReapplyRevisionRef.current !== reapplyRevision
    handledReapplyRevisionRef.current = reapplyRevision
    if (framing.source === 'axis' && !forcedReapply) return
    const immediateCanvasPublish = immediateCanvasPublishRef.current
    if (shouldSkipImmediateCanvasFramingApply({
      source: framing.source,
      revision: framing.revision,
      contextKey,
      fit: modelAssetFit,
      immediate: immediateCanvasPublish,
    })) {
      immediateCanvasPublishRef.current = null
      return
    }
    immediateCanvasPublishRef.current = null
    const context = readContext()
    if (framing.source !== 'axis' && readSpatialCaptureAxis() !== 'free') setSpatialCaptureAxis('free')
    const pose = resolveCameraFramingPose({
      settings: framing.settings,
      target: context.target,
      baseDistance: context.baseDistance,
      up: context.up,
    })
    runProgrammaticPose(() => applyCameraFramingPose({ camera, controls, pose, near: context.near, far: context.far }))
  }, [camera, contextKey, controls, framing, mode, modelAssetFit, paused, readContext, reapplyRevision, runProgrammaticPose])

  React.useEffect(() => {
    const publishSettledCanvasPose = () => {
      if (paused || mode !== 'xr') return
      const context = readContext()
      const current = readCameraFramingRuntime()
      if (readSpatialCaptureAxis() !== 'free') setSpatialCaptureAxis('free')
      const published = publishCameraFramingRuntime({
        anchorId: current.anchorId,
        settings: resolveCameraFramingSettingsFromPose({
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [controls.target.x, controls.target.y, controls.target.z],
          baseDistance: context.baseDistance,
          previousSettings: current.settings,
        }),
        source: 'canvas',
      })
      immediateCanvasPublishRef.current = published === current
        ? null
        : { revision: published.revision, contextKey, fit: modelAssetFit }
    }
    const settledInteraction = createCameraFramingSettledInteraction({ publish: publishSettledCanvasPose })
    const handleStart = () => {
      if (applyingPoseRef.current) return
      settledInteraction.start()
    }
    const handleChange = () => {
      if (applyingPoseRef.current) {
        settledInteraction.cancel()
        return
      }
      settledInteraction.change()
    }
    const handleEnd = () => settledInteraction.end()
    controls.addEventListener('start', handleStart)
    controls.addEventListener('change', handleChange)
    controls.addEventListener('end', handleEnd)
    return () => {
      settledInteraction.cancel()
      controls.removeEventListener('start', handleStart)
      controls.removeEventListener('change', handleChange)
      controls.removeEventListener('end', handleEnd)
    }
  }, [camera, contextKey, controls, mode, modelAssetFit, paused, readContext])
}
