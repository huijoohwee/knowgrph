import { useGraphStore } from '@/hooks/useGraphStore'
import { activateCanvasGraphSurfaceMode } from '@/lib/canvas/canvas3dMode'
import { readWebglSupport } from '@/lib/three/webglSupport'
import {
  acknowledgeGameFpsDecisions,
  hasGameFpsMission,
  readGameFpsSnapshot,
  restartGameFpsMission,
  startGameFpsMission,
  stopGameFpsMission,
} from './gameFpsRuntime'
import {
  loadGameFpsSavedDecisions,
  persistPendingGameFpsDecisions,
  queueGameFpsDecisions,
  readGameFpsDecisionStore,
} from './gameFpsDecisionStore'

export type GameModeSurfaceMode = '3d' | 'xr'
export type GameModeLaunchStatus = 'idle' | 'loading' | 'ready' | 'error'

export type GameModeSnapshot = Readonly<{
  active: boolean
  surfaceMode: GameModeSurfaceMode
  webglSupported: boolean
  launchStatus: GameModeLaunchStatus
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
let previousCanvasSurface: PreviousCanvasSurface | null = null
let snapshot: GameModeSnapshot = Object.freeze({
  active: false,
  surfaceMode: '3d',
  webglSupported: false,
  launchStatus: 'idle',
  message: 'Game Mode is inactive.',
  revision: 0,
})

function publish(update: Partial<Omit<GameModeSnapshot, 'revision'>>): GameModeSnapshot {
  snapshot = Object.freeze({ ...snapshot, ...update, revision: snapshot.revision + 1 })
  for (const listener of [...listeners]) listener()
  return snapshot
}

function resolveSurfaceMode(requested?: GameModeSurfaceMode): GameModeSurfaceMode {
  if (requested) return requested
  const state = useGraphStore.getState()
  return state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr' ? 'xr' : '3d'
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
  publish({
    active: true,
    surfaceMode,
    webglSupported: options.webglSupported ?? readWebglSupport(),
    launchStatus: readGameFpsSnapshot().phase === 'stopped' ? snapshot.launchStatus : 'ready',
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
    stopGameFpsMission()
    return publish({ launchStatus: 'error', message: decisionStore.error || 'Decision persistence is unreadable.' })
  }
  const webglSupported = options.webglSupported ?? snapshot.webglSupported
  if (!webglSupported) {
    stopGameFpsMission()
    return publish({ launchStatus: 'error', message: 'WebGL is unavailable; Game Mode stayed stopped on the local fallback surface.' })
  }
  if (!Object.hasOwn(options, 'decisions') && hasGameFpsMission()) {
    const current = readGameFpsSnapshot()
    if (current.phase === 'stopped') {
      const mission = startGameFpsMission()
      return publish({ launchStatus: 'ready', message: `Deterministic ECS mission resumed at tick ${mission.tick}.` })
    }
    return publish({
      launchStatus: 'ready',
      message: current.phase === 'playing'
        ? 'Deterministic ECS mission is already running.'
        : `Deterministic ECS mission is ${current.phase}; restart explicitly for a fresh run.`,
    })
  }
  publish({ launchStatus: 'loading', message: 'Loading validated local Decisions…' })
  try {
    const decisions = Object.hasOwn(options, 'decisions')
      ? [...(options.decisions || [])]
      : await loadGameFpsSavedDecisions()
    if (generation !== launchGeneration || !snapshot.active) return snapshot
    const mission = startGameFpsMission({ decisions })
    return publish({
      launchStatus: 'ready',
      message: mission.phase === 'playing'
        ? 'Deterministic ECS mission running.'
        : `Deterministic ECS mission restored (${mission.phase}).`,
    })
  } catch (error) {
    if (generation !== launchGeneration) return snapshot
    const message = error instanceof Error && error.message ? error.message : String(error || 'Decision hydration failed')
    return publish({ launchStatus: 'error', message })
  }
}

export function stopGameMode(): GameModeSnapshot {
  launchGeneration += 1
  stopGameFpsMission()
  return publish({ launchStatus: 'ready', message: 'Game Mode stopped; the local mission remains available to resume.' })
}

export function restartGameMode(options: Readonly<{ webglSupported?: boolean }> = {}): GameModeSnapshot {
  launchGeneration += 1
  if (!snapshot.active && !openGameModeSurface()) {
    return publish({ launchStatus: 'error', message: 'Game Mode could not activate the Canvas.' })
  }
  const decisionStore = readGameFpsDecisionStore()
  if (decisionStore.hydrationBlocked) {
    stopGameFpsMission()
    return publish({ launchStatus: 'error', message: decisionStore.error || 'Decision persistence is unreadable.' })
  }
  const webglSupported = options.webglSupported ?? readWebglSupport()
  if (!webglSupported) {
    stopGameFpsMission()
    return publish({ webglSupported: false, launchStatus: 'error', message: 'WebGL is unavailable; Game Mode stayed stopped on the local fallback surface.' })
  }
  publish({ webglSupported })
  restartGameFpsMission()
  return publish({ launchStatus: 'ready', message: 'Game Mode restarted with a fresh deterministic mission.' })
}

export function exitGameModeSurface(options: Readonly<{ restorePreviousSurface?: boolean }> = {}): GameModeSnapshot {
  launchGeneration += 1
  stopGameFpsMission()
  const previous = previousCanvasSurface
  previousCanvasSurface = null
  const next = publish({ active: false, launchStatus: 'idle', message: 'Game Mode exited; the previous Canvas surface can resume.' })
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
  previousCanvasSurface = null
  stopGameFpsMission()
  return publish({
    active: false,
    surfaceMode: '3d',
    webglSupported: false,
    launchStatus: 'idle',
    message: 'Game Mode is inactive.',
  })
}
