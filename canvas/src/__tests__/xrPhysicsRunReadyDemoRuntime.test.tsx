import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { XrPhysicsRunReadyDemoRuntime } from '@/features/canvas/XrPhysicsRunReadyDemoRuntime'
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

export async function testXrPhysicsRunReadyRuntimeAutoStartsOnceAndPreservesExitAcrossRemount() {
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
    const exited = readXrNativeControllerDemo()
    if (exited.phase !== 'off' || exited.revision !== running.revision + 1) {
      throw new Error(`expected one explicit durable exit, got ${JSON.stringify(exited)}`)
    }
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    root = null
    root = createRoot(container)
    await mountReactRoot(root, runtimeElement(), {
      window: dom.window as unknown as Window,
      frames: 1,
    })
    const remounted = readXrNativeControllerDemo()
    if (remounted.phase !== 'off' || remounted.revision !== exited.revision) {
      throw new Error(`expected explicit exit to survive StrictMode remount, got ${JSON.stringify(remounted)}`)
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
