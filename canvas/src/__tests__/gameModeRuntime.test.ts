import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGraphStore } from '@/hooks/useGraphStore'
import { GameFpsRunReadyDemoRuntime } from '@/features/canvas/GameFpsRunReadyDemoRuntime'
import { buildKnowgrphAgentReadyToolContracts } from '@/features/agent-ready/knowgrphAgentReadyToolContract.mjs'
import {
  applyGameFpsMotionControlInput,
  releaseGameFpsMotionControlInput,
} from '@/features/game-fps/gameFpsMotionControlAdapter'
import { installGameFpsDesktopInput } from '@/features/game-fps/gameFpsInput'
import {
  advanceGameFpsBy,
  readGameFpsSpatialProfile,
  readGameFpsSnapshot,
  resetGameFpsRuntimeForTests,
  setGameFpsInput,
  startGameFpsMission,
  stopGameFpsMission,
} from '@/features/game-fps/gameFpsRuntime'
import {
  buildGameModeInvocation,
  controlLocalGameMode,
  inspectLocalGameMode,
} from '@/features/game-fps/gameModeMcpRuntime'
import {
  advanceGameModeSimulationBy,
  armGameModeSimulation,
  exitGameModeSurface,
  openGameModeSurface,
  pauseGameModeSimulation,
  readGameModeSnapshot,
  resetGameModeRuntimeForTests,
  restartGameMode,
  startGameMode,
  stopGameMode,
} from '@/features/game-fps/gameModeRuntime'
import { resolveGameModeSceneComposition } from '@/features/game-fps/gameModeSceneComposition'
import { readGameModeXrSpatialProfile } from '@/features/game-fps/gameModeXrSpatialProfile'
import {
  hasGameFpsLineOfSight,
  isGameFpsPositionValid,
  resolveGameFpsMovement,
} from '@/features/game-fps/gameFpsGeometry'
import { GAME_FPS_FIXED_STEP_SECONDS } from '@/features/game-fps/gameFpsModel'
import {
  queueGameFpsDecisions,
  reportGameFpsDecisionLoadFailure,
  resetGameFpsDecisionStoreForTests,
} from '@/features/game-fps/gameFpsDecisionStore'
import { createXrNativeControllerInput } from '@/features/three/xrNativeControllerInput'
import { setSharedXrNativeControllerDemoTerrain } from '@/features/three/xrNativeControllerDemoRuntime'
import { XR_MOTION_REFERENCE_STAGE_PRESETS } from '@/features/three/xrSceneLibrary'
import { motionControlCaptureSurfaceIsOpen } from '@/features/three/motionControlSurfaceRuntime'
import {
  GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME,
  WORKSPACE_RUN_READY_DEMO_ENV,
} from '@/features/workspace-fs/workspaceRunReadyDemos'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'

const source = (...parts: string[]) => readFileSync(resolve(process.cwd(), ...parts), 'utf8')
const waitForUnmountTeardown = async (): Promise<void> => {
  await new Promise<void>(resolveTask => setTimeout(resolveTask, 0))
}

test.beforeEach(() => {
  setSharedXrNativeControllerDemoTerrain('singapore')
  resetGameFpsRuntimeForTests()
  resetGameFpsDecisionStoreForTests()
  resetGameModeRuntimeForTests()
})

test('Game Mode uses one strict native invocation tuple and browser WebMCP pair', async () => {
  assert.equal(buildGameModeInvocation('start'), '/game.mode @canvas #gameplay operation=start')
  assert.equal((await controlLocalGameMode({ invocation: buildGameModeInvocation('open') })).ok, true)
  assert.equal((await controlLocalGameMode({ invocation: '/game.mode @canvas @canvas #gameplay operation=open' })).ok, false)
  assert.equal((await controlLocalGameMode({ invocation: '/game.mode @canvas #gameplay #pose operation=open' })).ok, false)
  assert.equal((await controlLocalGameMode({ invocation: '/game.mode @canvas #gameplay operation=open operation=start' })).ok, false)
  assert.equal((await controlLocalGameMode({ invocation: buildGameModeInvocation('start'), operation: 'start' })).ok, false)
  assert.equal((await controlLocalGameMode({ operation: 'unknown' as 'open' })).ok, false)

  const inspection = inspectLocalGameMode()
  assert.equal(inspection.schema, 'knowgrph-game-mode-mcp/v1')
  assert.equal(inspection.webMcpTools.inspect, 'knowgrph.inspect_local_game_mode')
  assert.equal(inspection.webMcpTools.control, 'knowgrph.control_local_game_mode')
  assert.deepEqual(inspection.runtime.npcActions, ['hold', 'alert', 'engage', 'flee'])
  assert.equal(inspection.runtime.hitscan, 'normalized-slab-aabb')

  const contracts = buildKnowgrphAgentReadyToolContracts({ includeBrowserOnlyTools: true })
  assert.ok(contracts.some(contract => contract.name === 'inspect_local_game_mode'))
  assert.ok(contracts.some(contract => contract.name === 'control_local_game_mode'))
})

test('Game Mode activates the current XR surface and restores its owner on exit', () => {
  const state = useGraphStore.getState()
  state.setCanvasRenderMode('3d')
  state.setCanvas3dMode('xr')
  state.setFloatingPanelView('motionControl')
  state.setFloatingPanelOpen(true)
  assert.equal(openGameModeSurface({ webglSupported: true }), true)
  assert.equal(readGameModeSnapshot().active, true)
  assert.equal(readGameModeSnapshot().surfaceMode, 'xr')
  assert.equal(useGraphStore.getState().floatingPanelView, 'gameMode')
  assert.equal(useGraphStore.getState().floatingPanelOpen, true)
  assert.equal(motionControlCaptureSurfaceIsOpen({
    canvasRenderMode: '3d',
    canvas3dMode: 'xr',
    floatingPanelOpen: true,
    floatingPanelView: 'gameMode',
    mediaCatalogMode: 'xr-3d',
  }), true)
  exitGameModeSurface()
  assert.equal(readGameModeSnapshot().active, false)
  assert.equal(useGraphStore.getState().canvas3dMode, 'xr')
  assert.equal(useGraphStore.getState().floatingPanelView, 'motionControl')
  assert.equal(useGraphStore.getState().floatingPanelOpen, true)
})

test('Game Mode retains the authored XR world while standalone gameplay keeps its arena', () => {
  const xrOverlay = resolveGameModeSceneComposition({
    authoredWorldAvailable: true,
    canvasMode: 'xr',
    gameFpsActive: true,
    gameModeActive: true,
    gameModeSurface: 'xr',
  })
  assert.deepEqual(xrOverlay, {
    gamePresentation: 'xr-authored',
    renderAuthoredWorld: true,
    renderOrbitControls: false,
    retainAuthoredXrScene: true,
    rendererClearOwner: 'authored-world',
  })
  const standalone = resolveGameModeSceneComposition({
    authoredWorldAvailable: false,
    canvasMode: '3d',
    gameFpsActive: true,
    gameModeActive: true,
    gameModeSurface: '3d',
  })
  assert.equal(standalone.gamePresentation, 'arena')
  assert.equal(standalone.renderAuthoredWorld, false)
  assert.equal(standalone.rendererClearOwner, 'game-arena')

  const spatialProfile = readGameModeXrSpatialProfile()
  assert.equal(spatialProfile.id, 'xr-authored')
  const treasure = spatialProfile.map.blockers.find(blocker => blocker.id === 'native-treasure-block')
  assert.ok(treasure)
  assert.equal(spatialProfile.map.blockers.some(blocker => blocker.id.startsWith('terrain:')), false)
  assert.ok(spatialProfile.npcSeeds.every(npc => (
    Math.abs(npc.x) < spatialProfile.map.halfWidth && Math.abs(npc.z) < spatialProfile.map.halfDepth
  )))
  const approach = { x: treasure.centerX - treasure.halfWidth - 0.36, z: treasure.centerZ }
  assert.deepEqual(
    resolveGameFpsMovement(approach, { x: 1, z: 0 }, 0.35, spatialProfile.map),
    approach,
  )
  assert.equal(hasGameFpsLineOfSight(
    { x: treasure.centerX - treasure.halfWidth - 1, z: treasure.centerZ },
    { x: treasure.centerX + treasure.halfWidth + 1, z: treasure.centerZ },
    spatialProfile.map,
  ), false)
})

test('Game Mode waits for normalized player engagement and pauses without advancing', async () => {
  await startGameMode({ decisions: [], surfaceMode: '3d', webglSupported: true })
  assert.equal(readGameModeSnapshot().simulationStatus, 'ready')
  const pendingDecisionCount = readGameFpsSnapshot().pendingDecisions.length
  for (let index = 0; index < 60; index += 1) {
    await advanceGameModeSimulationBy(0.25)
  }
  assert.equal(readGameFpsSnapshot().tick, 0)
  assert.equal(readGameFpsSnapshot().player.health, 100)
  assert.equal(readGameFpsSnapshot().pendingDecisions.length, pendingDecisionCount)

  armGameModeSimulation()
  assert.equal(readGameModeSnapshot().simulationStatus, 'running')
  const queuedAdvances = Array.from({ length: 10 }, () => advanceGameModeSimulationBy(0.25))
  pauseGameModeSimulation()
  await Promise.all(queuedAdvances)
  assert.equal(readGameFpsSnapshot().tick, 0, 'pause must fence advances already queued by rendered frames')

  armGameModeSimulation()
  await advanceGameModeSimulationBy(0.25)
  assert.ok(readGameFpsSnapshot().tick > 0)
  const pausedTick = readGameFpsSnapshot().tick
  pauseGameModeSimulation()
  await advanceGameModeSimulationBy(0.25)
  assert.equal(readGameFpsSnapshot().tick, pausedTick)
})

test('Game Mode desktop lifecycle events fence queued simulation work', async () => {
  const { dom, restore } = initJsdomHarness()
  try {
    await startGameMode({ decisions: [], surfaceMode: '3d', webglSupported: true })
    const canvas = dom.window.document.createElement('canvas')
    const input = installGameFpsDesktopInput(canvas)
    const expectPausedWithoutAdvance = async (dispatch: () => void) => {
      armGameModeSimulation()
      const tick = readGameFpsSnapshot().tick
      const queued = advanceGameModeSimulationBy(0.25)
      dispatch()
      await queued
      assert.equal(readGameModeSnapshot().simulationStatus, 'paused')
      assert.equal(readGameFpsSnapshot().tick, tick)
    }

    await expectPausedWithoutAdvance(() => dom.window.dispatchEvent(new dom.window.Event('blur')))
    await expectPausedWithoutAdvance(() => {
      Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, value: 'hidden' })
      dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
    })
    await expectPausedWithoutAdvance(() => {
      dom.window.document.dispatchEvent(new dom.window.Event('pointerlockchange'))
    })
    input.dispose()
  } finally {
    restore()
  }
})

test('Game Mode terminal missions leave the running simulation state', async () => {
  await startGameMode({ decisions: [], surfaceMode: '3d', webglSupported: true })
  armGameModeSimulation()
  for (let index = 0; index < 60 && readGameFpsSnapshot().phase === 'playing'; index += 1) {
    await advanceGameModeSimulationBy(0.25)
  }
  assert.equal(readGameFpsSnapshot().phase, 'lost')
  assert.equal(readGameModeSnapshot().simulationStatus, 'idle')
  assert.match(readGameModeSnapshot().message, /mission lost at tick 716/i)
})

test('Game Mode restores a previous 2D surface on explicit exit', () => {
  const state = useGraphStore.getState()
  state.setCanvas3dMode('xr')
  state.setCanvasRenderMode('2d')
  assert.equal(openGameModeSurface({ surfaceMode: '3d', webglSupported: true }), true)
  assert.equal(useGraphStore.getState().canvasRenderMode, '3d')
  assert.equal(useGraphStore.getState().canvas3dMode, '3d')
  exitGameModeSurface()
  assert.equal(useGraphStore.getState().canvasRenderMode, '2d')
  assert.equal(useGraphStore.getState().canvas3dMode, 'xr')
})

test('Motion Control input composes with Game FPS and primary fires only on a rising edge', async () => {
  await startGameMode({ decisions: [], surfaceMode: 'xr', webglSupported: true })
  assert.equal(readGameFpsSpatialProfile().id, 'xr-authored')
  const forwardAndFire = createXrNativeControllerInput({
    moveZ: -1,
    primary: true,
    modifier: true,
    source: 'motion',
  })
  applyGameFpsMotionControlInput(forwardAndFire)
  const before = readGameFpsSnapshot()
  await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  const first = readGameFpsSnapshot()
  assert.ok(first.player.z < before.player.z)
  assert.equal(first.ammo, before.ammo - 1)

  applyGameFpsMotionControlInput(forwardAndFire)
  await advanceGameFpsBy(0.25)
  assert.equal(readGameFpsSnapshot().ammo, first.ammo, 'held primary must not auto-fire every frame')

  releaseGameFpsMotionControlInput()
  applyGameFpsMotionControlInput(forwardAndFire)
  await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  assert.equal(readGameFpsSnapshot().ammo, first.ammo - 1, 'a new primary edge must fire once')
})

test('Game Mode Stop and Start resume the same in-memory mission', async () => {
  await startGameMode({ decisions: [], webglSupported: true })
  setGameFpsInput({ forward: 1 })
  await advanceGameFpsBy(0.2)
  setGameFpsInput({ forward: 0 })
  const beforeStop = readGameFpsSnapshot()
  assert.ok(beforeStop.tick > 0)

  stopGameMode()
  assert.equal(readGameFpsSnapshot().phase, 'stopped')
  await startGameMode({ webglSupported: true })
  const resumed = readGameFpsSnapshot()
  assert.equal(resumed.phase, 'playing')
  assert.equal(resumed.tick, beforeStop.tick)
  assert.deepEqual(resumed.player, beforeStop.player)
})

test('Game Mode restarts with the requested spatial profile across live and stopped surface changes', async () => {
  await startGameMode({ decisions: [], surfaceMode: '3d', webglSupported: true })
  setGameFpsInput({ forward: 1 })
  await advanceGameFpsBy(0.2)
  setGameFpsInput({ forward: 0 })
  assert.ok(readGameFpsSnapshot().tick > 0)
  assert.equal(readGameFpsSpatialProfile().id, 'arena')

  const xr = await startGameMode({ surfaceMode: 'xr', webglSupported: true })
  assert.equal(readGameFpsSpatialProfile().id, 'xr-authored')
  assert.equal(readGameFpsSnapshot().tick, 0)
  assert.equal(xr.simulationStatus, 'ready')
  assert.match(xr.message, /restarted for the xr-authored spatial profile/i)

  stopGameMode()
  exitGameModeSurface({ restorePreviousSurface: false })
  await startGameMode({ surfaceMode: '3d', webglSupported: true })
  assert.equal(readGameFpsSpatialProfile().id, 'arena')
  assert.equal(readGameFpsSnapshot().tick, 0)
})

test('Game Mode refreshes the XR spatial profile when the authored terrain changes', async () => {
  await startGameMode({ decisions: [], surfaceMode: 'xr', webglSupported: true })
  const singapore = readGameFpsSpatialProfile()
  assert.deepEqual([singapore.map.halfWidth, singapore.map.halfDepth], [16, 12])

  stopGameMode()
  exitGameModeSurface({ restorePreviousSurface: false })
  setSharedXrNativeControllerDemoTerrain('neutral-volume')
  const neutral = await startGameMode({ surfaceMode: 'xr', webglSupported: true })
  const refreshed = readGameFpsSpatialProfile()
  assert.equal(refreshed.id, 'xr-authored')
  assert.deepEqual([refreshed.map.halfWidth, refreshed.map.halfDepth], [8, 6])
  assert.notDeepEqual(refreshed.map.blockers, singapore.map.blockers)
  assert.equal(readGameFpsSnapshot().tick, 0)
  assert.match(neutral.message, /restarted for the xr-authored spatial profile/i)
})

test('every authored XR preset admits collision-free ground-actor spawns', () => {
  for (const preset of XR_MOTION_REFERENCE_STAGE_PRESETS) {
    setSharedXrNativeControllerDemoTerrain(preset.id)
    const profile = readGameModeXrSpatialProfile()
    const spawns = [profile.playerSpawn, ...profile.npcSeeds]
    for (const spawn of spawns) {
      assert.equal(
        isGameFpsPositionValid(spawn, 0.45, profile.map),
        true,
        `${preset.id} must not place ${'id' in spawn ? spawn.id : 'player'} inside a blocker`,
      )
    }
    for (let index = 0; index < spawns.length; index += 1) {
      for (let peerIndex = index + 1; peerIndex < spawns.length; peerIndex += 1) {
        const distance = Math.hypot(
          spawns[index].x - spawns[peerIndex].x,
          spawns[index].z - spawns[peerIndex].z,
        )
        assert.ok(distance >= 1.2, `${preset.id} spawn pair ${index}/${peerIndex} must not overlap`)
      }
    }
  }

  setSharedXrNativeControllerDemoTerrain('street-grid')
  const street = readGameModeXrSpatialProfile()
  assert.equal(street.map.blockers.some(blocker => (
    ['stage:west-walk', 'stage:east-walk', 'stage:crossing'].includes(blocker.id)
  )), false)
  setSharedXrNativeControllerDemoTerrain('aerial-sky')
  const aerial = readGameModeXrSpatialProfile()
  assert.equal(aerial.map.blockers.some(blocker => blocker.id.startsWith('stage:cloud-bank')), false)
  assert.equal(aerial.map.blockers.some(blocker => blocker.id === 'stage:flight-corridor'), false)
  assert.equal(aerial.map.blockers.some(blocker => blocker.id.startsWith('stage:ground-mass')), true)
})

test('Game Mode fails closed for unreadable Decisions and unavailable WebGL', async () => {
  reportGameFpsDecisionLoadFailure(new Error('malformed local save'))
  queueGameFpsDecisions([{
    decisionId: 'game-fps:test:blocked-restart',
    decisionType: 'quest_flag',
    entityRef: 'game-fps:mission:game-fps-mission-1',
    payload: { event: 'mission_completed', missionId: 'game-fps-mission-1', status: 'won', tick: 1 },
    producedAt: '2026-01-01T00:00:00.000Z',
  }])
  const blockedRestart = restartGameMode({ webglSupported: true })
  assert.equal(blockedRestart.launchStatus, 'error')
  assert.match(blockedRestart.message, /Unreadable .*malformed local save/)
  assert.equal(readGameFpsSnapshot().phase, 'stopped')

  resetGameFpsDecisionStoreForTests()
  const unsupported = await startGameMode({ decisions: [], webglSupported: false })
  assert.equal(unsupported.launchStatus, 'error')
  assert.match(unsupported.message, /WebGL is unavailable/)
  assert.equal(readGameFpsSnapshot().phase, 'stopped')
  assert.equal(inspectLocalGameMode().gameMode.webglSupported, false)
  assert.equal(inspectLocalGameMode().runtime.webglSupported, false)
  assert.equal((await controlLocalGameMode({ operation: 'start' })).ok, false)
})

test('Game Mode panel projects shared owners without a second renderer, world, or save path', () => {
  const panel = source('src', 'features', 'game-fps', 'GameModeFloatingPanelView.tsx')
  const renderer = source('src', 'lib', 'three', 'ThreeGraph.impl.tsx')
  const viewport = source('src', 'components', 'CanvasViewport.tsx')
  const xrRuntime = source('src', 'features', 'canvas', 'XrPhysicsRunReadyDemoRuntime.tsx')
  const runReadyRuntime = source('src', 'features', 'canvas', 'GameFpsRunReadyDemoRuntime.tsx')
  const hud = source('src', 'features', 'game-fps', 'GameFpsHud.tsx')
  assert.equal(panel.includes('<Canvas'), false)
  assert.equal(panel.includes('createGameFpsAuthoredMission'), false)
  assert.match(panel, /GAME_FPS_SAVE_PATH/)
  assert.match(renderer, /GameFpsMissionStageLazy coordinateScale=\{gameFpsCoordinateScale\} presentation=\{sceneComposition\.gamePresentation\}/)
  assert.match(renderer, /sceneComposition\.renderAuthoredWorld \? <XrWorldPlacement/)
  assert.match(renderer, /data-kg-authored-xr-scene-retained/)
  assert.match(renderer, /active=\{active && mode === 'xr' && !gameFpsActive\}/)
  assert.match(renderer, /const rendererLifecycleKey = `scene-canvas-\$\{mode\}`/)
  assert.match(viewport, /gameFpsActive \? <GameFpsHudLazy \/>/)
  assert.equal(runReadyRuntime.includes('persistGameModePendingDecisions'), false)
  assert.match(hud, /data-kg-game-fps-action="save"/)
  assert.match(xrRuntime, /pausedForGameModeRef/)
  assert.match(xrRuntime, /pauseXrNativeControllerDemo\(\)/)
  assert.match(xrRuntime, /resumeXrNativeControllerDemo\(\)/)
})

test('Game FPS document runtime cancels StrictMode replay teardown and restores its surface on true unmount', async () => {
  const previousDemo = process.env[WORKSPACE_RUN_READY_DEMO_ENV]
  const { restore: restoreWindow } = initWindowHarness({ storage: new MemoryStorage() })
  const { dom, restore: restoreDom } = initJsdomHarness(
    '<!doctype html><html><body><section id="root"></section></body></html>',
  )
  const container = dom.window.document.getElementById('root')
  if (!container) throw new Error('missing Game FPS React root container')
  const canvasPrototype = dom.window.HTMLCanvasElement.prototype
  Object.defineProperty(canvasPrototype, 'getContext', {
    configurable: true,
    value: () => ({
      getExtension: (name: string) => name === 'WEBGL_lose_context'
        ? { loseContext: () => void 0 }
        : null,
    }),
  })

  const before = useGraphStore.getState()
  const restoreGraphState = {
    canvasRenderMode: before.canvasRenderMode,
    canvasRenderModeLastFree: before.canvasRenderModeLastFree,
    canvasRenderModeIsAuto: before.canvasRenderModeIsAuto,
    canvas3dMode: before.canvas3dMode,
    floatingPanelOpen: before.floatingPanelOpen,
    floatingPanelView: before.floatingPanelView,
    markdownDocumentName: before.markdownDocumentName,
    markdownDocumentText: before.markdownDocumentText,
    markdownDocumentApplyViewPreset: before.markdownDocumentApplyViewPreset,
  }
  const runtimeElement = React.createElement(
    React.StrictMode,
    null,
    React.createElement(GameFpsRunReadyDemoRuntime),
  )
  let root: ReturnType<typeof createRoot> | null = null

  try {
    delete process.env[WORKSPACE_RUN_READY_DEMO_ENV]
    useGraphStore.setState({
      canvasRenderMode: '2d',
      canvas3dMode: 'xr',
      floatingPanelOpen: true,
      floatingPanelView: 'motionControl',
      markdownDocumentName: `/docs/workspace-seeds/${GAME_FPS_DEMO_WORKSPACE_SEED_BASENAME}`,
      markdownDocumentText: '# Canonical Game FPS demo',
      markdownDocumentApplyViewPreset: false,
    })
    startGameFpsMission({ decisions: [] })
    stopGameFpsMission()

    root = createRoot(container)
    await mountReactRoot(root, runtimeElement, {
      window: dom.window as unknown as Window,
      frames: 1,
    })
    await waitForUnmountTeardown()
    const strictModeStable = readGameModeSnapshot()
    assert.equal(strictModeStable.active, true)
    assert.equal(strictModeStable.surfaceMode, '3d')
    assert.equal(readGameFpsSnapshot().phase, 'playing')
    assert.equal(useGraphStore.getState().canvasRenderMode, '3d')

    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    root = null
    await waitForUnmountTeardown()
    assert.equal(readGameModeSnapshot().active, false)
    assert.equal(readGameFpsSnapshot().phase, 'stopped')
    assert.equal(useGraphStore.getState().canvasRenderMode, '2d')
    assert.equal(useGraphStore.getState().canvas3dMode, 'xr')
    assert.equal(useGraphStore.getState().floatingPanelView, 'motionControl')
    assert.equal(useGraphStore.getState().floatingPanelOpen, true)
  } finally {
    if (root) {
      try {
        await unmountReactRoot(root, { window: dom.window as unknown as Window })
        await waitForUnmountTeardown()
      } catch {
        // Preserve an earlier assertion failure.
      }
    }
    resetGameFpsRuntimeForTests()
    resetGameModeRuntimeForTests()
    useGraphStore.setState(restoreGraphState)
    restoreDom()
    restoreWindow()
    if (previousDemo === undefined) delete process.env[WORKSPACE_RUN_READY_DEMO_ENV]
    else process.env[WORKSPACE_RUN_READY_DEMO_ENV] = previousDemo
  }
})
