import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isXrPhysicsRunReadyDemoActive } from '@/features/workspace-fs/workspaceRunReadyDemos'
import {
  developAndRunXrNativeControllerDemo,
  exitXrNativeControllerDemo,
  readXrNativeControllerDemo,
  selectXrNativeControllerDemoMode,
  subscribeXrNativeControllerDemo,
} from '@/features/three/xrNativeControllerDemoRuntime'
import { stopXrPhysicsRuntime } from '@/features/three/xrPhysicsRuntime'
import { ensureXrPhysicsRunReadyDemoRunning } from './xrPhysicsRunReadyLifecycle'

export function XrPhysicsRunReadyDemoRuntime() {
  const markdownDocumentName = useGraphStore(state => state.markdownDocumentName)
  const active = isXrPhysicsRunReadyDemoActive(markdownDocumentName)
  const dedicatedDemo = isXrPhysicsRunReadyDemoActive()
  const ownsDocumentLaunchRef = React.useRef(false)
  const surfaceInitializedRef = React.useRef(false)
  const unmountTeardownTokenRef = React.useRef(0)
  const runtime = React.useSyncExternalStore(
    subscribeXrNativeControllerDemo,
    readXrNativeControllerDemo,
    readXrNativeControllerDemo,
  )
  const phase = runtime.phase
  const revision = runtime.revision
  React.useLayoutEffect(() => {
    unmountTeardownTokenRef.current += 1
    return () => {
      const teardownToken = unmountTeardownTokenRef.current + 1
      unmountTeardownTokenRef.current = teardownToken
      queueMicrotask(() => {
        if (unmountTeardownTokenRef.current !== teardownToken) return
        if (!ownsDocumentLaunchRef.current) return
        ownsDocumentLaunchRef.current = false
        if (isXrPhysicsRunReadyDemoActive()) return
        if (readXrNativeControllerDemo().phase !== 'off') exitXrNativeControllerDemo()
      })
    }
  }, [])
  React.useLayoutEffect(() => {
    if (!active) {
      surfaceInitializedRef.current = false
      if (ownsDocumentLaunchRef.current) {
        ownsDocumentLaunchRef.current = false
        if (readXrNativeControllerDemo().phase !== 'off') exitXrNativeControllerDemo()
      }
      return undefined
    }
    const state = useGraphStore.getState()
    if (!surfaceInitializedRef.current) {
      surfaceInitializedRef.current = true
      const activatesXrSurface = state.canvasRenderMode !== '3d' || state.canvas3dMode !== 'xr'
      state.setCanvasRenderMode('3d')
      state.setCanvas3dMode('xr')
      if (activatesXrSurface) {
        state.setFloatingPanelOpen(false)
        state.setBottomSurfaceCollapsed(true)
      }
    }
    const launched = ensureXrPhysicsRunReadyDemoRunning(readXrNativeControllerDemo(), {
      selectMode: selectXrNativeControllerDemoMode,
      developAndRun: () => {
        stopXrPhysicsRuntime()
        return developAndRunXrNativeControllerDemo()
      },
    })
    if (launched && !dedicatedDemo) ownsDocumentLaunchRef.current = true
    return undefined
  }, [active, dedicatedDemo, phase, revision])
  return null
}
