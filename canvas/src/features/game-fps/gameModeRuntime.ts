import { useGraphStore } from '@/hooks/useGraphStore'
import { activateCanvasGraphSurfaceMode } from '@/lib/canvas/canvas3dMode'
import { readWebglSupport } from '@/lib/three/webglSupport'
import {
  acknowledgeGameFpsDecisions,
  advanceGameFpsBy,
  hasGameFpsMission,
  readGameFpsSpatialProfile,
  readGameFpsSnapshot,
  restartGameFpsMission,
  startGameFpsMission,
  stopGameFpsMission,
} from './gameFpsRuntime'
import {
  GAME_FPS_ARENA_SPATIAL_PROFILE,
  gameFpsSpatialProfilesMatch,
  type GameFpsSpatialProfile,
} from './gameFpsModel'
import {
  loadGameFpsSavedDecisions,
  persistPendingGameFpsDecisions,
  queueGameFpsDecisions,
  readGameFpsDecisionStore,
} from './gameFpsDecisionStore'
import { readGameModeXrSpatialProfile } from './gameModeXrSpatialProfile'

export type GameModeSurfaceMode = '3d' | 'xr'
export type GameModeLaunchStatus = 'idle' | 'loading' | 'ready' | 'error'
export type GameModeSimulationStatus = 'idle' | 'ready' | 'running' | 'paused'

export type GameModeSnapshot = Readonly<{
  active: boolean
  surfaceMode: GameModeSurfaceMode
  webglSupported: boolean
  launchStatus: GameModeLaunchStatus
  simulationStatus: GameModeSimulationStatus
  message: string
  revision: number
}>

type Listener = () => void
type GraphStoreState = ReturnType<typeof useGraphStore.getState>
type PreviousCanvasSurface = Readonly<Pick<
  GraphStoreState,
  'canvasRenderMode' | 'canvas3dMode' | 'floatingPanelOpen' | 'floatingPanelView'
>>

const listeners = new Set<Listener>()
let launchGeneration = 0
let simulationGeneration = 0
let simulationQueue: Promise<void> = Promise.resolve()
let previousCanvasSurface: PreviousCanvasSurface | null = null
let snapshot: GameModeSnapshot = Object.freeze({
  active: false,
  surfaceMode: '3d',
  webglSupported: false,
  launchStatus: 'idle',
  simulationStatus: 'idle',
  message: 'Game Mode is inactive.',
  revision: 0,
})

function publish(update: Partial<Omit<GameModeSnapshot, 'revision'>>): GameModeSnapshot {
  snapshot = Object.freeze({ ...snapshot, ...update, revision: snapshot.revision + 1 })
  for (const listener of [...listeners]) listener()
  return snapshot
}

function fenceSimulationAdvances(): void {
  simulationGeneration += 1
}

function resolveSurfaceMode(requested?: GameModeSurfaceMode): GameModeSurfaceMode {
  if (requested) return requested
  const state = useGraphStore.getState()
  return state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr' ? 'xr' : '3d'
}

function resolveSpatialProfile(surfaceMode: GameModeSurfaceMode): GameFpsSpatialProfile {
  return surfaceMode === 'xr' ? readGameModeXrSpatialProfile() : GAME_FPS_ARENA_SPATIAL_PROFILE
}

export function readGameModeSnapshot(): GameModeSnapshot {
  return snapshot
}

export function subscribeGameModeSnapshot(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function openGameModeSurface(options: Readonly<{
  surfaceMode?: GameModeSurfaceMode
  openPanel?: boolean
  webglSupported?: boolean
}> = {}): boolean {
  const surfaceMode = resolveSurfaceMode(options.surfaceMode)
  const state = useGraphStore.getState()
  const entering = !snapshot.active
  if (entering) {
    fenceSimulationAdvances()
    previousCanvasSurface = Object.freeze({
      canvasRenderMode: state.canvasRenderMode,
      canvas3dMode: state.canvas3dMode,
      floatingPanelOpen: state.floatingPanelOpen,
      floatingPanelView: state.floatingPanelView,
    })
  }
  activateCanvasGraphSurfaceMode({
    mode: surfaceMode,
    setCanvas3dMode: state.setCanvas3dMode,
    setCanvasRenderMode: state.setCanvasRenderMode,
  })
  const activeState = useGraphStore.getState()
  if (activeState.canvasRenderMode !== '3d' || activeState.canvas3dMode !== surfaceMode) {
    if (entering) previousCanvasSurface = null
    return false
  }
  if (options.openPanel !== false) {
    activeState.setFloatingPanelView('gameMode')
    activeState.setFloatingPanelOpen(true)
  }
  const mission = readGameFpsSnapshot()
  publish({
    active: true,
    surfaceMode,
    webglSupported: options.webglSupported ?? readWebglSupport(),
    launchStatus: mission.phase === 'stopped' ? snapshot.launchStatus : 'ready',
    simulationStatus: entering
      ? mission.phase === 'playing' ? 'ready' : mission.phase === 'stopped' && hasGameFpsMission() ? 'paused' : 'idle'
      : snapshot.simulationStatus,
    message: `Game Mode opened on ${surfaceMode === 'xr' ? 'XR Mode' : '3D'}.`,
  })
  return true
}

export async function startGameMode(options: Readonly<{
  decisions?: readonly unknown[]
  surfaceMode?: GameModeSurfaceMode
  openPanel?: boolean
  webglSupported?: boolean
}> = {}): Promise<GameModeSnapshot> {
  if (!openGameModeSurface(options)) {
    return publish({ launchStatus: 'error', message: 'Game Mode could not activate the requested Canvas surface.' })
  }
  const generation = launchGeneration + 1
  launchGeneration = generation
  const decisionStore = readGameFpsDecisionStore()
  if (decisionStore.hydrationBlocked) {
    fenceSimulationAdvances()
    stopGameFpsMission()
    return publish({ launchStatus: 'error', simulationStatus: 'idle', message: decisionStore.error || 'Decision persistence is unreadable.' })
  }
  const webglSupported = options.webglSupported ?? snapshot.webglSupported
  if (!webglSupported) {
    fenceSimulationAdvances()
    stopGameFpsMission()
    return publish({ launchStatus: 'error', simulationStatus: 'idle', message: 'WebGL is unavailable; Game Mode stayed stopped on the local fallback surface.' })
  }
  if (!Object.hasOwn(options, 'decisions') && hasGameFpsMission()) {
    const current = readGameFpsSnapshot()
    const previousSpatialProfile = readGameFpsSpatialProfile()
    const spatialProfile = resolveSpatialProfile(snapshot.surfaceMode)
    if (!gameFpsSpatialProfilesMatch(previousSpatialProfile, spatialProfile)) {
      fenceSimulationAdvances()
      const mission = startGameFpsMission({ spatialProfile })
      return publish({
        launchStatus: 'ready',
        simulationStatus: mission.phase === 'playing' ? 'ready' : 'idle',
        message: `Deterministic ECS mission restarted for the ${spatialProfile.id} spatial profile; move, aim, or fire to engage.`,
      })
    }
    if (current.phase === 'stopped') {
      fenceSimulationAdvances()
      const mission = startGameFpsMission({ spatialProfile })
      return publish({
        launchStatus: 'ready',
        simulationStatus: mission.phase === 'playing' ? 'ready' : 'idle',
        message: mission.phase === 'playing'
          ? `Deterministic ECS mission resumed at tick ${mission.tick}; move, aim, or fire to engage.`
          : `Deterministic ECS mission restored (${mission.phase}); restart explicitly for a fresh run.`,
      })
    }
    return publish({
      launchStatus: 'ready',
      simulationStatus: current.phase === 'playing'
        ? snapshot.simulationStatus === 'running' ? 'running' : 'ready'
        : 'idle',
      message: current.phase === 'playing'
        ? snapshot.simulationStatus === 'running'
          ? 'Deterministic ECS mission is already running.'
          : 'Deterministic ECS mission is ready; move, aim, or fire to engage.'
        : `Deterministic ECS mission is ${current.phase}; restart explicitly for a fresh run.`,
    })
  }
  publish({ launchStatus: 'loading', message: 'Loading validated local Decisions…' })
  try {
    const decisions = Object.hasOwn(options, 'decisions')
      ? [...(options.decisions || [])]
      : await loadGameFpsSavedDecisions()
    if (generation !== launchGeneration || !snapshot.active) return snapshot
    const mission = startGameFpsMission({
      decisions,
      spatialProfile: resolveSpatialProfile(snapshot.surfaceMode),
    })
    fenceSimulationAdvances()
    return publish({
      launchStatus: 'ready',
      simulationStatus: mission.phase === 'playing' ? 'ready' : 'idle',
      message: mission.phase === 'playing'
        ? 'Deterministic ECS mission is ready; move, aim, or fire to engage.'
        : `Deterministic ECS mission restored (${mission.phase}).`,
    })
  } catch (error) {
    if (generation !== launchGeneration) return snapshot
    const message = error instanceof Error && error.message ? error.message : String(error || 'Decision hydration failed')
    return publish({ launchStatus: 'error', simulationStatus: 'idle', message })
  }
}

export function armGameModeSimulation(): GameModeSnapshot {
  const mission = readGameFpsSnapshot()
  if (!snapshot.active || mission.phase !== 'playing' || mission.runtimeError) return snapshot
  if (snapshot.simulationStatus === 'running') return snapshot
  fenceSimulationAdvances()
  return publish({ simulationStatus: 'running', message: 'Deterministic ECS mission running.' })
}

export function pauseGameModeSimulation(message = 'Game Mode paused; resume with player input.'): GameModeSnapshot {
  fenceSimulationAdvances()
  if (snapshot.simulationStatus !== 'running') return snapshot
  return publish({ simulationStatus: 'paused', message })
}

export function advanceGameModeSimulationBy(deltaSeconds: number): Promise<ReturnType<typeof readGameFpsSnapshot>> {
  if (snapshot.simulationStatus !== 'running') return Promise.resolve(readGameFpsSnapshot())
  const queuedGeneration = simulationGeneration
  let resolveResult!: (value: ReturnType<typeof readGameFpsSnapshot>) => void
  let rejectResult!: (reason: unknown) => void
  const result = new Promise<ReturnType<typeof readGameFpsSnapshot>>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  simulationQueue = simulationQueue.catch(() => undefined).then(async () => {
    if (queuedGeneration !== simulationGeneration || snapshot.simulationStatus !== 'running') {
      resolveResult(readGameFpsSnapshot())
      return
    }
    try {
      const mission = await advanceGameFpsBy(deltaSeconds)
      if (queuedGeneration === simulationGeneration && snapshot.simulationStatus === 'running') {
        if (mission.runtimeError) {
          fenceSimulationAdvances()
          publish({ launchStatus: 'error', simulationStatus: 'idle', message: mission.runtimeError })
        } else if (mission.phase !== 'playing') {
          fenceSimulationAdvances()
          publish({
            simulationStatus: 'idle',
            message: `Deterministic ECS mission ${mission.phase} at tick ${mission.tick}.`,
          })
        }
      }
      resolveResult(mission)
    } catch (error) {
      if (queuedGeneration === simulationGeneration) {
        fenceSimulationAdvances()
        const message = error instanceof Error && error.message ? error.message : String(error || 'Game FPS tick failed')
        publish({ launchStatus: 'error', simulationStatus: 'idle', message })
      }
      rejectResult(error)
    }
  })
  return result
}

export function stopGameMode(): GameModeSnapshot {
  launchGeneration += 1
  fenceSimulationAdvances()
  stopGameFpsMission()
  return publish({ launchStatus: 'ready', simulationStatus: 'paused', message: 'Game Mode stopped; the local mission remains available to resume.' })
}

export function restartGameMode(options: Readonly<{ webglSupported?: boolean }> = {}): GameModeSnapshot {
  launchGeneration += 1
  fenceSimulationAdvances()
  if (!snapshot.active && !openGameModeSurface()) {
    return publish({ launchStatus: 'error', message: 'Game Mode could not activate the Canvas.' })
  }
  const decisionStore = readGameFpsDecisionStore()
  if (decisionStore.hydrationBlocked) {
    stopGameFpsMission()
    return publish({ launchStatus: 'error', simulationStatus: 'idle', message: decisionStore.error || 'Decision persistence is unreadable.' })
  }
  const webglSupported = options.webglSupported ?? readWebglSupport()
  if (!webglSupported) {
    stopGameFpsMission()
    return publish({ webglSupported: false, launchStatus: 'error', simulationStatus: 'idle', message: 'WebGL is unavailable; Game Mode stayed stopped on the local fallback surface.' })
  }
  publish({ webglSupported })
  restartGameFpsMission(resolveSpatialProfile(snapshot.surfaceMode))
  return publish({ launchStatus: 'ready', simulationStatus: 'ready', message: 'Game Mode restarted; move, aim, or fire to engage.' })
}

export function exitGameModeSurface(options: Readonly<{ restorePreviousSurface?: boolean }> = {}): GameModeSnapshot {
  launchGeneration += 1
  fenceSimulationAdvances()
  stopGameFpsMission()
  const previous = previousCanvasSurface
  previousCanvasSurface = null
  const next = publish({ active: false, launchStatus: 'idle', simulationStatus: 'idle', message: 'Game Mode exited; the previous Canvas surface can resume.' })
  if (options.restorePreviousSurface !== false && previous) {
    const state = useGraphStore.getState()
    state.setCanvas3dMode(previous.canvas3dMode)
    state.setCanvasRenderMode(previous.canvasRenderMode)
    state.setFloatingPanelView(previous.floatingPanelView)
    state.setFloatingPanelOpen(previous.floatingPanelOpen)
  }
  return next
}

export async function persistGameModePendingDecisions() {
  const mission = readGameFpsSnapshot()
  const decisions = [...mission.pendingDecisions]
  if (decisions.length > 0) queueGameFpsDecisions(decisions)
  const result = await persistPendingGameFpsDecisions()
  if (result.status === 'saved' && decisions.length > 0) {
    acknowledgeGameFpsDecisions(decisions.map(decision => decision.decisionId))
  }
  return result
}

export function resetGameModeRuntimeForTests(): GameModeSnapshot {
  launchGeneration += 1
  fenceSimulationAdvances()
  previousCanvasSurface = null
  stopGameFpsMission()
  return publish({
    active: false,
    surfaceMode: '3d',
    webglSupported: false,
    launchStatus: 'idle',
    simulationStatus: 'idle',
    message: 'Game Mode is inactive.',
  })
}
