import React from 'react'
import {
  readMediaCatalogMode,
  subscribeMediaCatalogMode,
} from '@/features/command-menu/mediaCatalogModeRuntime'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  readMotionControlSnapshot,
  stopMotionControl,
  subscribeMotionControl,
} from './motionControlRuntime'
import { motionControlCaptureSurfaceIsOpen } from './motionControlSurfaceRuntime'

let mountedLifecycleOwnerCount = 0

export function MotionControlXrLifecycleGuard() {
  const mediaCatalogMode = React.useSyncExternalStore(
    subscribeMediaCatalogMode,
    readMediaCatalogMode,
    readMediaCatalogMode,
  )
  const captureSurfaceOpen = useGraphStore(state => motionControlCaptureSurfaceIsOpen({
    canvas3dMode: state.canvas3dMode,
    canvasRenderMode: state.canvasRenderMode,
    floatingPanelOpen: state.floatingPanelOpen,
    floatingPanelView: state.floatingPanelView,
    mediaCatalogMode,
  }))
  const runtime = React.useSyncExternalStore(
    subscribeMotionControl,
    readMotionControlSnapshot,
    readMotionControlSnapshot,
  )
  const captureActive = runtime.cameraActive
    || runtime.phase === 'requesting-camera'
    || runtime.phase === 'loading-model'
    || runtime.phase === 'running'

  React.useEffect(() => {
    mountedLifecycleOwnerCount += 1
    return () => {
      mountedLifecycleOwnerCount = Math.max(0, mountedLifecycleOwnerCount - 1)
      queueMicrotask(() => {
        if (mountedLifecycleOwnerCount > 0) return
        const snapshot = readMotionControlSnapshot()
        if (snapshot.phase === 'off' && !snapshot.cameraActive) return
        void stopMotionControl('Motion Control stopped when its lifecycle owner unmounted.')
      })
    }
  }, [])

  React.useEffect(() => {
    if (captureSurfaceOpen || !captureActive) return
    void stopMotionControl('Motion Control stopped when its XR FloatingPanel surface closed.')
  }, [captureActive, captureSurfaceOpen])

  return null
}
