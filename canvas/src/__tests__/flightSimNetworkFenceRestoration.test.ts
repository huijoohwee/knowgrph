import assert from 'node:assert/strict'
import test from 'node:test'

import { useGraphStore } from '@/hooks/useGraphStore'
import {
  installFlightSimGameplayNetworkFence,
  uninstallFlightSimGameplayNetworkFence,
} from '@/features/game-flight-sim/flightSimExternalCallGuard'
import {
  advanceFlightSimByFixedStep,
  exitFlightSimSurface,
  openFlightSimSurface,
  readFlightSimSnapshot,
  resetFlightSimRuntimeForTests,
  setFlightSimInput,
  startFlightSim,
} from '@/features/game-flight-sim/flightSimRuntime'
import {
  resetFlightSimDecisionStoreForTests,
} from '@/features/game-flight-sim/flightSimDecisionStore'
import {
  FLIGHT_SIM_SURFACE_RESTORATION_FAILURE_CODE,
  readFlightSimSurfaceOwnershipStatus,
} from '@/features/game-flight-sim/flightSimSurfaceOwnershipStatus'
import type { WorkspaceFs } from '@/features/workspace-fs/types'

type FlightSimNetworkFenceHost = NonNullable<
  Parameters<typeof installFlightSimGameplayNetworkFence>[1]
>

function createFetchHost() {
  const originalFetch = async (): Promise<Response> => ({} as Response)
  const host = { fetch: originalFetch } as FlightSimNetworkFenceHost
  return { host, originalFetch }
}

function makeFetchReadOnly(
  host: FlightSimNetworkFenceHost,
): typeof host.fetch {
  const guardedFetch = host.fetch
  Object.defineProperty(host, 'fetch', {
    configurable: true,
    value: guardedFetch,
    writable: false,
  })
  return guardedFetch
}

function makeFetchWritable(
  host: FlightSimNetworkFenceHost,
): void {
  Object.defineProperty(host, 'fetch', {
    configurable: true,
    value: host.fetch,
    writable: true,
  })
}

function captureCanvasSurface() {
  const state = useGraphStore.getState()
  return {
    canvas3dMode: state.canvas3dMode,
    canvasRenderMode: state.canvasRenderMode,
    canvasRenderModeIsAuto: state.canvasRenderModeIsAuto,
    canvasRenderModeLastFree: state.canvasRenderModeLastFree,
    floatingPanelOpen: state.floatingPanelOpen,
    floatingPanelView: state.floatingPanelView,
  }
}

test('failed network-fence uninstall retains only its retryable ownership', t => {
  const { host, originalFetch } = createFetchHost()
  t.after(() => {
    makeFetchWritable(host)
    uninstallFlightSimGameplayNetworkFence()
  })

  installFlightSimGameplayNetworkFence(() => undefined, host)
  const guardedFetch = makeFetchReadOnly(host)

  assert.throws(
    uninstallFlightSimGameplayNetworkFence,
    /network fence restoration failed: fetch:/i,
  )
  assert.equal(host.fetch, guardedFetch)

  makeFetchWritable(host)
  uninstallFlightSimGameplayNetworkFence()
  assert.equal(host.fetch, originalFetch)
})

test('Flight exit disposes its World and restores Canvas after network restoration fails', async t => {
  resetFlightSimDecisionStoreForTests()
  resetFlightSimRuntimeForTests()
  useGraphStore.getState().resetAll()
  useGraphStore.setState({
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    canvasRenderModeIsAuto: false,
    canvasRenderModeLastFree: '2d',
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    floatingPanelOpen: false,
    floatingPanelView: 'motionControl',
  } as never)
  const priorSurface = captureCanvasSurface()
  const { host, originalFetch } = createFetchHost()
  t.after(() => {
    makeFetchWritable(host)
    uninstallFlightSimGameplayNetworkFence()
    if (readFlightSimSnapshot().active) exitFlightSimSurface()
    resetFlightSimDecisionStoreForTests()
    resetFlightSimRuntimeForTests()
    useGraphStore.getState().resetAll()
  })

  const opened = await openFlightSimSurface({
    openPanel: false,
    webglSupported: true,
    workspace: {
      readFileText: async () => null,
    } as unknown as WorkspaceFs,
  })
  assert.equal(opened.active, true)
  startFlightSim()
  setFlightSimInput({ pitch: 0.4 })
  const flying = await advanceFlightSimByFixedStep()
  assert.equal(flying.tick, 1)

  installFlightSimGameplayNetworkFence(() => undefined, host)
  const guardedFetch = makeFetchReadOnly(host)
  const exited = exitFlightSimSurface()
  const restorationFailure = readFlightSimSurfaceOwnershipStatus().failure

  assert.equal(exited.active, false)
  assert.equal(exited.phase, 'stopped')
  assert.equal(exited.runId, 0)
  assert.equal(exited.tick, 0)
  assert.deepEqual(exited.pendingDecisions, [])
  assert.match(exited.runtimeError || '', /network fence restoration failed/i)
  assert.equal(
    restorationFailure?.code,
    FLIGHT_SIM_SURFACE_RESTORATION_FAILURE_CODE,
  )
  assert.deepEqual(captureCanvasSurface(), priorSurface)
  assert.equal(host.fetch, guardedFetch)

  makeFetchWritable(host)
  uninstallFlightSimGameplayNetworkFence()
  assert.equal(host.fetch, originalFetch)
})
