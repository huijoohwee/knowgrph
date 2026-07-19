import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { XrPhysicsRunReadyDemoRuntime } from '@/features/canvas/XrPhysicsRunReadyDemoRuntime'
import { XrNativeControllerDemoHud } from '@/features/three/XrNativeControllerDemoHud'
import {
  exitXrNativeControllerDemo,
  readXrNativeControllerDemo,
} from '@/features/three/xrNativeControllerDemoRuntime'
import {
  WORKSPACE_RUN_READY_DEMO_ENV,
  XR_PHYSICS_RUN_READY_DEMO_ID,
} from '@/features/workspace-fs/workspaceRunReadyDemos'
import { resetGraphStoreForTests, useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'

export async function testXrPhysicsRunReadyRuntimeReclaimsOffFallbackWithoutDoubleLaunch() {
  const previousDemo = process.env[WORKSPACE_RUN_READY_DEMO_ENV]
  process.env[WORKSPACE_RUN_READY_DEMO_ENV] = XR_PHYSICS_RUN_READY_DEMO_ID
  const { restore: restoreWindow } = initWindowHarness({ storage: new MemoryStorage() })
  const { dom, restore: restoreDom } = initJsdomHarness(
    '<!doctype html><html><body><section id="root"></section></body></html>',
  )
  const container = dom.window.document.getElementById('root')
  if (!container) throw new Error('missing React root container')

  resetGraphStoreForTests()
  const before = useGraphStore.getState()
  const restoreGraphState = {
    canvasRenderMode: before.canvasRenderMode,
    canvasRenderModeLastFree: before.canvasRenderModeLastFree,
    canvasRenderModeIsAuto: before.canvasRenderModeIsAuto,
    canvas3dMode: before.canvas3dMode,
    floatingPanelOpen: before.floatingPanelOpen,
    bottomSurfaceCollapsed: before.bottomSurfaceCollapsed,
    documentStructureBaselineLock: before.documentStructureBaselineLock,
  }
  let root: ReturnType<typeof createRoot> | null = null
  const runtimeElement = () => React.createElement(
    React.StrictMode,
    null,
    React.createElement(XrPhysicsRunReadyDemoRuntime),
    React.createElement(XrNativeControllerDemoHud),
  )

  try {
    const pristine = readXrNativeControllerDemo()
    if (pristine.phase !== 'off' || pristine.revision !== 0) {
      throw new Error(`expected pristine shared runtime, got ${JSON.stringify(pristine)}`)
    }
    useGraphStore.setState({
      canvasRenderMode: '2d',
      canvasRenderModeLastFree: '2d',
      canvasRenderModeIsAuto: false,
      canvas3dMode: '3d',
      floatingPanelOpen: true,
      bottomSurfaceCollapsed: false,
      documentStructureBaselineLock: false,
    })
    root = createRoot(container)
    await mountReactRoot(root, runtimeElement(), {
      window: dom.window as unknown as Window,
      frames: 1,
    })

    const running = readXrNativeControllerDemo()
    if (running.phase !== 'running' || running.mode !== 'ball' || running.revision !== pristine.revision + 2) {
      throw new Error(`expected exactly one Ball select-and-run launch, got ${JSON.stringify(running)}`)
    }
    const graph = useGraphStore.getState()
    if (graph.canvasRenderMode !== '3d' || graph.canvas3dMode !== 'xr' || graph.floatingPanelOpen || !graph.bottomSurfaceCollapsed) {
      throw new Error('expected run-ready runtime to activate the canonical XR surface')
    }

    await act(async () => { exitXrNativeControllerDemo() })
    const reclaimed = readXrNativeControllerDemo()
    const hud = container.querySelector('[data-kg-xr-playground-hud="1"]')
    if (reclaimed.phase !== 'running' || hud?.getAttribute('data-kg-xr-playground-phase') !== 'running') {
      throw new Error(`expected run-ready mode to reclaim an off fallback before the HUD can overlay the authored XR scene, got ${JSON.stringify(reclaimed)}`)
    }
    const reclaimedRevision = reclaimed.revision
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    root = null
    root = createRoot(container)
    await mountReactRoot(root, runtimeElement(), {
      window: dom.window as unknown as Window,
      frames: 1,
    })
    const remounted = readXrNativeControllerDemo()
    if (remounted.phase !== 'running' || remounted.revision !== reclaimedRevision) {
      throw new Error(`expected the reclaimed native stage to survive StrictMode remount without a second launch, got ${JSON.stringify(remounted)}`)
    }
  } finally {
    if (root) {
      try {
        await unmountReactRoot(root, { window: dom.window as unknown as Window })
      } catch {
        // Preserve an earlier assertion failure.
      }
    }
    resetGraphStoreForTests()
    useGraphStore.setState(restoreGraphState)
    restoreDom()
    restoreWindow()
    if (previousDemo === undefined) delete process.env[WORKSPACE_RUN_READY_DEMO_ENV]
    else process.env[WORKSPACE_RUN_READY_DEMO_ENV] = previousDemo
  }
}
