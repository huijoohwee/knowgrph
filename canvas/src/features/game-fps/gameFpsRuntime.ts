import {
  captureGameFpsAuthoredMission,
  createGameFpsAuthoredMission,
  tickGameFpsAuthoredMission,
  type GameFpsAuthoredMission,
  type GameFpsMissionCapture,
} from './gameFpsMission'
import {
  GAME_FPS_FIXED_STEP_SECONDS,
  GAME_FPS_MAX_FRAME_SECONDS,
  GAME_FPS_NPC_SEEDS,
  GAME_FPS_PLAYER_SPAWN,
  GAME_FPS_WEAPON,
  GAME_FPS_ZERO_COST_LOG,
  clampGameFpsLookDelta,
  clampGameFpsUnit,
  type GameFpsCostLog,
  type GameFpsDecisionRecord,
  type GameFpsInputPatch,
  type GameFpsSnapshot,
  type GameFpsTickInput,
} from './gameFpsModel'

type Listener = () => void

type MutableInput = {
  forward: number
  strafe: number
  lookYawDelta: number
  lookPitchDelta: number
  sprint: boolean
  fireQueued: boolean
  reloadQueued: boolean
}

type MutableMotionInput = {
  forward: number
  strafe: number
  sprint: boolean
  primaryHeld: boolean
  fireQueued: boolean
}

const listeners = new Set<Listener>()
const pendingDecisions = new Map<string, GameFpsDecisionRecord>()
let mission: GameFpsAuthoredMission | null = null
let accumulatorSeconds = 0
let runId = 0
let generation = 0
let tickQueue: Promise<void> = Promise.resolve()
let input: MutableInput = freshInput()
let motionInput: MutableMotionInput = freshMotionInput()

let snapshot: GameFpsSnapshot = Object.freeze({
  phase: 'stopped',
  player: Object.freeze({ ...GAME_FPS_PLAYER_SPAWN, health: 100 }),
  npcs: Object.freeze(GAME_FPS_NPC_SEEDS.map(seed => Object.freeze({
    id: seed.id,
    x: seed.x,
    z: seed.z,
    health: 100,
    action: 'hold' as const,
  }))),
  ammo: GAME_FPS_WEAPON.magazineCapacity,
  reserve: GAME_FPS_WEAPON.initialReserve,
  enemiesAlive: GAME_FPS_NPC_SEEDS.length,
  fireResult: 'idle',
  tick: 0,
  elapsedSeconds: 0,
  pendingDecisions: Object.freeze([]),
  lastCostLog: GAME_FPS_ZERO_COST_LOG,
  runtimeError: null,
  revision: 0,
})

function freshInput(): MutableInput {
  return {
    forward: 0,
    strafe: 0,
    lookYawDelta: 0,
    lookPitchDelta: 0,
    sprint: false,
    fireQueued: false,
    reloadQueued: false,
  }
}

function freshMotionInput(): MutableMotionInput {
  return {
    forward: 0,
    strafe: 0,
    sprint: false,
    primaryHeld: false,
    fireQueued: false,
  }
}

function freezeDecision(value: GameFpsDecisionRecord): GameFpsDecisionRecord {
  return Object.freeze({ ...value, payload: Object.freeze({ ...value.payload }) })
}

function runtimeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : String(error || 'Game FPS tick failed')
}

function publishRuntimeFailure(error: unknown): GameFpsSnapshot {
  snapshot = Object.freeze({
    ...snapshot,
    runtimeError: runtimeErrorMessage(error),
    revision: snapshot.revision + 1,
  })
  for (const listener of [...listeners]) listener()
  return snapshot
}

function publish(
  capture: GameFpsMissionCapture,
  costLog: GameFpsCostLog,
  phaseOverride?: GameFpsSnapshot['phase'],
  clearRuntimeError = false,
): GameFpsSnapshot {
  snapshot = Object.freeze({
    ...capture,
    phase: phaseOverride || capture.phase,
    pendingDecisions: Object.freeze([...pendingDecisions.values()]),
    lastCostLog: costLog,
    runtimeError: clearRuntimeError ? null : snapshot.runtimeError,
    revision: snapshot.revision + 1,
  })
  for (const listener of [...listeners]) listener()
  return snapshot
}

function maximumPersistedRunId(decisions: readonly unknown[]): number {
  let maximum = 0
  for (const value of decisions) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const payload = (value as { payload?: unknown }).payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue
    const candidate = Number((payload as { runId?: unknown }).runId)
    if (Number.isSafeInteger(candidate) && candidate > maximum) maximum = candidate
  }
  return maximum
}

function replaceMission(decisions: readonly unknown[] = []): GameFpsSnapshot {
  const nextRunId = Math.max(runId, maximumPersistedRunId(decisions)) + 1
  const nextMission = createGameFpsAuthoredMission({ runId: nextRunId, decisions })
  runId = nextRunId
  generation += 1
  mission = nextMission
  accumulatorSeconds = 0
  input = freshInput()
  motionInput = freshMotionInput()
  return publish(captureGameFpsAuthoredMission(nextMission), GAME_FPS_ZERO_COST_LOG, undefined, true)
}

function tickInput(firstSubStep: boolean): GameFpsTickInput {
  const value = Object.freeze({
    forward: clampGameFpsUnit(input.forward + motionInput.forward),
    strafe: clampGameFpsUnit(input.strafe + motionInput.strafe),
    lookYawDelta: firstSubStep ? input.lookYawDelta : 0,
    lookPitchDelta: firstSubStep ? input.lookPitchDelta : 0,
    sprint: input.sprint || motionInput.sprint,
    fire: firstSubStep && (input.fireQueued || motionInput.fireQueued),
    reload: firstSubStep && input.reloadQueued,
  })
  if (firstSubStep) {
    input.lookYawDelta = 0
    input.lookPitchDelta = 0
    input.fireQueued = false
    input.reloadQueued = false
    motionInput.fireQueued = false
  }
  return value
}

async function advanceCurrentMission(deltaSeconds: number): Promise<GameFpsSnapshot> {
  if (!mission || snapshot.phase !== 'playing' || snapshot.runtimeError) return snapshot
  accumulatorSeconds += Math.min(deltaSeconds, GAME_FPS_MAX_FRAME_SECONDS)
  let stepped = false
  let firstSubStep = true
  let capture = captureGameFpsAuthoredMission(mission)
  let costLog = snapshot.lastCostLog
  while (accumulatorSeconds + 1e-10 >= GAME_FPS_FIXED_STEP_SECONDS) {
    accumulatorSeconds = Math.max(0, accumulatorSeconds - GAME_FPS_FIXED_STEP_SECONDS)
    const result = await tickGameFpsAuthoredMission(mission, tickInput(firstSubStep))
    firstSubStep = false
    stepped = true
    capture = result.capture
    costLog = result.costLog
    for (const decision of result.decisions) {
      if (!pendingDecisions.has(decision.decisionId)) {
        pendingDecisions.set(decision.decisionId, freezeDecision(decision))
      }
    }
    if (capture.phase !== 'playing') {
      accumulatorSeconds = 0
      break
    }
  }
  return stepped ? publish(capture, costLog) : snapshot
}

export function startGameFpsMission(options: { decisions?: readonly unknown[] } = {}): GameFpsSnapshot {
  if (Object.hasOwn(options, 'decisions')) return replaceMission(options.decisions || [])
  if (!mission) return replaceMission()
  if (snapshot.phase !== 'stopped') return snapshot
  return publish(captureGameFpsAuthoredMission(mission), snapshot.lastCostLog)
}

export function hasGameFpsMission(): boolean {
  return mission !== null
}

export function stopGameFpsMission(): GameFpsSnapshot {
  if (!mission || snapshot.phase === 'stopped') return snapshot
  generation += 1
  accumulatorSeconds = 0
  input = freshInput()
  motionInput = freshMotionInput()
  return publish(captureGameFpsAuthoredMission(mission), snapshot.lastCostLog, 'stopped')
}

export function readGameFpsSnapshot(): GameFpsSnapshot {
  return snapshot
}

export function subscribeGameFpsSnapshot(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setGameFpsInput(patch: GameFpsInputPatch): void {
  if (patch.forward !== undefined) input.forward = clampGameFpsUnit(patch.forward)
  if (patch.strafe !== undefined) input.strafe = clampGameFpsUnit(patch.strafe)
  if (patch.lookYawDelta !== undefined) {
    input.lookYawDelta = clampGameFpsLookDelta(input.lookYawDelta + patch.lookYawDelta)
  }
  if (patch.lookPitchDelta !== undefined) {
    input.lookPitchDelta = clampGameFpsLookDelta(input.lookPitchDelta + patch.lookPitchDelta)
  }
  if (patch.sprint !== undefined) input.sprint = Boolean(patch.sprint)
}

export function setGameFpsMotionInput(patch: Readonly<{
  forward: number
  strafe: number
  sprint: boolean
  primary: boolean
}>): void {
  const primary = patch.primary === true
  if (primary && !motionInput.primaryHeld) motionInput.fireQueued = true
  motionInput.forward = clampGameFpsUnit(patch.forward)
  motionInput.strafe = clampGameFpsUnit(patch.strafe)
  motionInput.sprint = patch.sprint === true
  motionInput.primaryHeld = primary
}

export function queueGameFpsFire(): void {
  input.fireQueued = true
}

export function reloadGameFpsWeapon(): void {
  input.reloadQueued = true
}

export function restartGameFpsMission(): GameFpsSnapshot {
  return replaceMission()
}

export function advanceGameFpsBy(deltaSeconds: number): Promise<GameFpsSnapshot> {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    return Promise.reject(new Error('Game FPS deltaSeconds must be a non-negative finite number'))
  }
  const queuedGeneration = generation
  let resolveResult: (value: GameFpsSnapshot) => void
  let rejectResult: (reason: unknown) => void
  const result = new Promise<GameFpsSnapshot>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  tickQueue = tickQueue.catch(() => undefined).then(async () => {
    if (queuedGeneration !== generation) {
      resolveResult(snapshot)
      return
    }
    try {
      resolveResult(await advanceCurrentMission(deltaSeconds))
    } catch (error) {
      publishRuntimeFailure(error)
      rejectResult(error)
    }
  })
  return result
}

export function acknowledgeGameFpsDecisions(decisionIds: readonly string[]): GameFpsSnapshot {
  let changed = false
  for (const decisionId of new Set(decisionIds)) changed = pendingDecisions.delete(decisionId) || changed
  if (!changed || !mission) return snapshot
  const phaseOverride = snapshot.phase === 'stopped' ? 'stopped' : undefined
  return publish(captureGameFpsAuthoredMission(mission), snapshot.lastCostLog, phaseOverride)
}

export function resetGameFpsRuntimeForTests(): GameFpsSnapshot {
  mission = null
  pendingDecisions.clear()
  accumulatorSeconds = 0
  runId = 0
  generation += 1
  input = freshInput()
  motionInput = freshMotionInput()
  const previousRevision = snapshot.revision
  snapshot = Object.freeze({
    phase: 'stopped',
    player: Object.freeze({ ...GAME_FPS_PLAYER_SPAWN, health: 100 }),
    npcs: Object.freeze(GAME_FPS_NPC_SEEDS.map(seed => Object.freeze({
      id: seed.id, x: seed.x, z: seed.z, health: 100, action: 'hold' as const,
    }))),
    ammo: GAME_FPS_WEAPON.magazineCapacity,
    reserve: GAME_FPS_WEAPON.initialReserve,
    enemiesAlive: GAME_FPS_NPC_SEEDS.length,
    fireResult: 'idle',
    tick: 0,
    elapsedSeconds: 0,
    pendingDecisions: Object.freeze([]),
    lastCostLog: GAME_FPS_ZERO_COST_LOG,
    runtimeError: null,
    revision: previousRevision + 1,
  })
  for (const listener of [...listeners]) listener()
  return snapshot
}
