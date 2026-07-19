import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isXrPhysicsRunReadyDemoActive } from '@/features/workspace-fs/workspaceRunReadyDemos'
import {
  developAndRunXrNativeControllerDemo,
  readXrNativeControllerDemo,
  selectXrNativeControllerDemoMode,
  subscribeXrNativeControllerDemo,
} from '@/features/three/xrNativeControllerDemoRuntime'
import { stopXrPhysicsRuntime } from '@/features/three/xrPhysicsRuntime'
import { ensureXrPhysicsRunReadyDemoRunning } from './xrPhysicsRunReadyLifecycle'

export function XrPhysicsRunReadyDemoRuntime() {
  const runtime = React.useSyncExternalStore(
    subscribeXrNativeControllerDemo,
    readXrNativeControllerDemo,
    readXrNativeControllerDemo,
  )
  const phase = runtime.phase
  const revision = runtime.revision
  React.useLayoutEffect(() => {
    if (!isXrPhysicsRunReadyDemoActive()) return undefined
    const state = useGraphStore.getState()
    state.setCanvasRenderMode('3d')
    state.setCanvas3dMode('xr')
    state.setFloatingPanelOpen(false)
    state.setBottomSurfaceCollapsed(true)
    ensureXrPhysicsRunReadyDemoRunning(readXrNativeControllerDemo(), {
      selectMode: selectXrNativeControllerDemoMode,
      developAndRun: () => {
        stopXrPhysicsRuntime()
        return developAndRunXrNativeControllerDemo()
      },
    })
    return undefined
  }, [phase, revision])
  return null
}
