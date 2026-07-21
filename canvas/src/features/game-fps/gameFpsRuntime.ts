import {
  captureGameFpsAuthoredMission,
  createGameFpsAuthoredMission,
  tickGameFpsAuthoredMission,
  validateGameFpsDecisions,
  type GameFpsAuthoredMission,
  type GameFpsMissionCapture,
} from './gameFpsMission'
import {
  GAME_FPS_FIXED_STEP_SECONDS,
  GAME_FPS_MAX_FRAME_SECONDS,
  GAME_FPS_MISSION_ID,
  GAME_FPS_WEAPON,
  GAME_FPS_ZERO_COST_LOG,
  clampGameFpsLookDelta,
  clampGameFpsUnit,
  type GameFpsCostLog,
  type GameFpsDecisionRecord,
  type GameFpsInputPatch,
  type GameFpsSpatialProfile,
  type GameFpsSnapshot,
  type GameFpsTickInput,
} from './gameFpsModel'
import { queueGameFpsSimulationInputStep } from './gameFpsSimulationClock'
import {
  readGameModeXrSpatialProfile,
  readGameModeXrSpatialSourceKey,
} from './gameModeXrSpatialProfile'

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

type GameFpsMovementInput = Readonly<Pick<
  GameFpsTickInput,
  'forward' | 'strafe' | 'sprint'
>>

type CapturedGameFpsInput = Readonly<{
  continuous: GameFpsTickInput
  movementPulse: GameFpsMovementInput | null
}>

type PendingTickActions = {
  movementPulse: GameFpsMovementInput | null
  lookYawDelta: number
  lookPitchDelta: number
  fire: boolean
  reload: boolean
}

type InFlightTick = {
  readonly mission: GameFpsAuthoredMission
  stopped: boolean
  resumeRequested: boolean
}

type GameFpsAdvanceRequest = Readonly<{
  deltaSeconds: number
  generation: number
  input: CapturedGameFpsInput
}>

export type GameFpsAdvance = () => Promise<GameFpsSnapshot>

const listeners = new Set<Listener>()
const pendingDecisions = new Map<string, GameFpsDecisionRecord>()
let mission: GameFpsAuthoredMission | null = null
let missionSpatialSourceKey: string | null = null
let accumulatorSeconds = 0
let runId = 0
let generation = 0
let tickQueue: Promise<void> = Promise.resolve()
let inFlightTick: InFlightTick | null = null
let input: MutableInput = freshInput()
let motionInput: MutableMotionInput = freshMotionInput()
let bufferedMovementInput: GameFpsMovementInput | null = null
let pendingTickActions: PendingTickActions = freshPendingTickActions()

function createIdleSnapshot(
  spatialProfile: GameFpsSpatialProfile,
  revision: number,
): GameFpsSnapshot {
  return Object.freeze({
    phase: 'stopped',
    player: Object.freeze({ ...spatialProfile.playerSpawn, health: 100 }),
    npcs: Object.freeze(spatialProfile.npcSeeds.map(seed => Object.freeze({
      id: seed.id,
      x: seed.x,
      z: seed.z,
      health: 100,
      action: 'hold' as const,
    }))),
    ammo: GAME_FPS_WEAPON.magazineCapacity,
    reserve: GAME_FPS_WEAPON.initialReserve,
    enemiesAlive: spatialProfile.npcSeeds.length,
    fireResult: 'idle',
    tick: 0,
    elapsedSeconds: 0,
    pendingDecisions: Object.freeze([]),
    lastCostLog: GAME_FPS_ZERO_COST_LOG,
    runtimeError: null,
    revision,
  })
}

let snapshot: GameFpsSnapshot = createIdleSnapshot(readGameModeXrSpatialProfile(), 0)

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

function freshPendingTickActions(): PendingTickActions {
  return {
    movementPulse: null,
    lookYawDelta: 0,
    lookPitchDelta: 0,
    fire: false,
    reload: false,
  }
}

function freezeMovementInput(
  forward: number,
  strafe: number,
  sprint: boolean,
): GameFpsMovementInput {
  return Object.freeze({ forward, strafe, sprint })
}

function mergeMovementAxis(pending: number, current: number): number {
  if (current === 0) return pending
  if (pending === 0 || Math.sign(pending) === Math.sign(current)) return current
  return clampGameFpsUnit(pending + current)
}

function consumeBufferedMovementInput(): GameFpsMovementInput | null {
  const pending = bufferedMovementInput
  bufferedMovementInput = null
  if (!pending) return null
  const forward = input.forward === 0 ? pending.forward : 0
  const strafe = input.strafe === 0 ? pending.strafe : 0
  if (forward === 0 && strafe === 0) return null
  return freezeMovementInput(forward, strafe, pending.sprint)
}

function freezeDecision(value: GameFpsDecisionRecord): GameFpsDecisionRecord {
  return Object.freeze({ ...value, payload: Object.freeze({ ...value.payload }) })
}

function runtimeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : String(error || 'Game FPS tick failed')
}

class ResumedGameFpsTickFailure extends Error {
  readonly runtimeFailure: unknown

  constructor(runtimeFailure: unknown) {
    super(runtimeErrorMessage(runtimeFailure))
    this.name = 'ResumedGameFpsTickFailure'
    this.runtimeFailure = runtimeFailure
  }
}

export function publishRuntimeFailure(error: unknown): GameFpsSnapshot {
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

function publishPhase(phase: GameFpsSnapshot['phase']): GameFpsSnapshot {
  snapshot = Object.freeze({
    ...snapshot,
    phase,
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
    if ((payload as { missionId?: unknown }).missionId !== GAME_FPS_MISSION_ID) continue
    const candidate = Number((payload as { runId?: unknown }).runId)
    if (Number.isSafeInteger(candidate) && candidate > maximum) maximum = candidate
  }
  return maximum
}

function replaceMission(
  decisionsForRunId: readonly unknown[] = [],
  replayDecisions = true,
): GameFpsSnapshot {
  if (!replayDecisions) validateGameFpsDecisions(decisionsForRunId)
  const maximumKnownRunId = Math.max(runId, maximumPersistedRunId(decisionsForRunId))
  if (maximumKnownRunId >= Number.MAX_SAFE_INTEGER - 1) {
    throw new Error('Game FPS mission exhausted its bounded run identifier range')
  }
  const nextRunId = maximumKnownRunId + 1
  const spatialProfile = readGameModeXrSpatialProfile()
  const nextMission = createGameFpsAuthoredMission({
    runId: nextRunId,
    decisions: replayDecisions ? decisionsForRunId : [],
    spatialProfile,
  })
  runId = nextRunId
  generation += 1
  mission = nextMission
  missionSpatialSourceKey = readGameModeXrSpatialSourceKey()
  accumulatorSeconds = 0
  input = freshInput()
  motionInput = freshMotionInput()
  bufferedMovementInput = null
  pendingTickActions = freshPendingTickActions()
  return publish(captureGameFpsAuthoredMission(nextMission), GAME_FPS_ZERO_COST_LOG, undefined, true)
}

function captureAdvanceInput(): CapturedGameFpsInput {
  const movementPulse = consumeBufferedMovementInput()
  const continuous = Object.freeze({
    forward: clampGameFpsUnit(input.forward + motionInput.forward),
    strafe: clampGameFpsUnit(input.strafe + motionInput.strafe),
    lookYawDelta: input.lookYawDelta,
    lookPitchDelta: input.lookPitchDelta,
    sprint: input.sprint || motionInput.sprint,
    fire: input.fireQueued || motionInput.fireQueued,
    reload: input.reloadQueued,
  })
  input.lookYawDelta = 0
  input.lookPitchDelta = 0
  input.fireQueued = false
  input.reloadQueued = false
  motionInput.fireQueued = false
  return Object.freeze({ continuous, movementPulse })
}

function stageTickActions(queuedInput: CapturedGameFpsInput): void {
  const continuous = queuedInput.continuous
  if (queuedInput.movementPulse) {
    const pending = pendingTickActions.movementPulse
    pendingTickActions.movementPulse = freezeMovementInput(
      clampGameFpsUnit((pending?.forward || 0) + queuedInput.movementPulse.forward),
      clampGameFpsUnit((pending?.strafe || 0) + queuedInput.movementPulse.strafe),
      Boolean(pending?.sprint || queuedInput.movementPulse.sprint),
    )
  }
  pendingTickActions.lookYawDelta = clampGameFpsLookDelta(
    pendingTickActions.lookYawDelta + continuous.lookYawDelta,
  )
  pendingTickActions.lookPitchDelta = clampGameFpsLookDelta(
    pendingTickActions.lookPitchDelta + continuous.lookPitchDelta,
  )
  pendingTickActions.fire ||= continuous.fire
  pendingTickActions.reload ||= continuous.reload
}

function tickInput(queuedInput: CapturedGameFpsInput, firstSubStep: boolean): GameFpsTickInput {
  const continuous = queuedInput.continuous
  const movementPulse = firstSubStep ? pendingTickActions.movementPulse : null
  const value = Object.freeze({
    forward: clampGameFpsUnit(continuous.forward + (movementPulse?.forward || 0)),
    strafe: clampGameFpsUnit(continuous.strafe + (movementPulse?.strafe || 0)),
    lookYawDelta: firstSubStep ? pendingTickActions.lookYawDelta : 0,
    lookPitchDelta: firstSubStep ? pendingTickActions.lookPitchDelta : 0,
    sprint: continuous.sprint || Boolean(movementPulse?.sprint),
    fire: firstSubStep && pendingTickActions.fire,
    reload: firstSubStep && pendingTickActions.reload,
  })
  if (firstSubStep) pendingTickActions = freshPendingTickActions()
  return value
}

async function advanceCurrentMission(
  deltaSeconds: number,
  expectedGeneration: number,
  queuedInput: CapturedGameFpsInput,
): Promise<GameFpsSnapshot> {
  if (!mission || snapshot.phase !== 'playing' || snapshot.runtimeError) return snapshot
  const refreshedMission = refreshGameFpsMissionSpatialProfile()
  if (refreshedMission) return refreshedMission
  const activeMission = mission
  stageTickActions(queuedInput)
  accumulatorSeconds += Math.min(deltaSeconds, GAME_FPS_MAX_FRAME_SECONDS)
  let stepped = false
  let firstSubStep = true
  let capture = captureGameFpsAuthoredMission(activeMission)
  let costLog = snapshot.lastCostLog
  while (accumulatorSeconds + 1e-10 >= GAME_FPS_FIXED_STEP_SECONDS) {
    accumulatorSeconds = Math.max(0, accumulatorSeconds - GAME_FPS_FIXED_STEP_SECONDS)
    const tickLifecycle: InFlightTick = {
      mission: activeMission,
      stopped: false,
      resumeRequested: false,
    }
    inFlightTick = tickLifecycle
    let result: Awaited<ReturnType<typeof tickGameFpsAuthoredMission>>
    try {
      result = await tickGameFpsAuthoredMission(activeMission, tickInput(queuedInput, firstSubStep))
    } catch (error) {
      if (mission === activeMission && tickLifecycle.stopped && tickLifecycle.resumeRequested) {
        throw new ResumedGameFpsTickFailure(error)
      }
      throw error
    } finally {
      if (inFlightTick === tickLifecycle) inFlightTick = null
    }
    if (mission !== activeMission) return snapshot
    const stoppedDuringTick = generation !== expectedGeneration && tickLifecycle.stopped
    if (generation !== expectedGeneration && !stoppedDuringTick) return snapshot
    firstSubStep = false
    stepped = true
    capture = result.capture
    costLog = result.costLog
    for (const decision of result.decisions) {
      if (!pendingDecisions.has(decision.decisionId)) {
        pendingDecisions.set(decision.decisionId, freezeDecision(decision))
      }
    }
    if (stoppedDuringTick) {
      accumulatorSeconds = 0
      const stoppedSnapshot = publish(capture, costLog, 'stopped')
      if (!tickLifecycle.resumeRequested || mission !== activeMission) return stoppedSnapshot
      return publish(capture, costLog, 'playing')
    }
    if (capture.phase !== 'playing') {
      accumulatorSeconds = 0
      break
    }
  }
  return stepped ? publish(capture, costLog) : snapshot
}

export function startGameFpsMission(options: {
  decisions?: readonly unknown[]
} = {}): GameFpsSnapshot {
  if (Object.hasOwn(options, 'decisions')) return replaceMission(options.decisions || [])
  if (!mission) return replaceMission()
  if (missionSpatialSourceKey !== readGameModeXrSpatialSourceKey()) return replaceMission()
  if (snapshot.phase !== 'stopped') return snapshot
  if (inFlightTick?.mission === mission && inFlightTick.stopped) {
    inFlightTick.resumeRequested = true
    return publishPhase('playing')
  }
  return publish(captureGameFpsAuthoredMission(mission), snapshot.lastCostLog)
}

export function hasGameFpsMission(): boolean {
  return mission !== null
}

export function stopGameFpsMission(): GameFpsSnapshot {
  if (!mission || snapshot.phase === 'stopped') return snapshot
  if (inFlightTick?.mission === mission) {
    inFlightTick.stopped = true
    inFlightTick.resumeRequested = false
  }
  generation += 1
  accumulatorSeconds = 0
  input = freshInput()
  motionInput = freshMotionInput()
  bufferedMovementInput = null
  pendingTickActions = freshPendingTickActions()
  return publishPhase('stopped')
}

export function readGameFpsSnapshot(): GameFpsSnapshot {
  return snapshot
}

export function readGameFpsSpatialProfile(): GameFpsSpatialProfile {
  return mission?.spatialProfile || readGameModeXrSpatialProfile()
}

export function readGameFpsRunId(): number {
  return runId
}

export function subscribeGameFpsSnapshot(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setGameFpsInput(patch: GameFpsInputPatch): void {
  const movementPatched = patch.forward !== undefined
    || patch.strafe !== undefined
    || patch.sprint !== undefined
  if (patch.forward !== undefined) input.forward = clampGameFpsUnit(patch.forward)
  if (patch.strafe !== undefined) input.strafe = clampGameFpsUnit(patch.strafe)
  if (patch.lookYawDelta !== undefined) {
    input.lookYawDelta = clampGameFpsLookDelta(input.lookYawDelta + patch.lookYawDelta)
  }
  if (patch.lookPitchDelta !== undefined) {
    input.lookPitchDelta = clampGameFpsLookDelta(input.lookPitchDelta + patch.lookPitchDelta)
  }
  if (patch.sprint !== undefined) input.sprint = Boolean(patch.sprint)
  if (movementPatched && (input.forward !== 0 || input.strafe !== 0)) {
    const pending = bufferedMovementInput
    bufferedMovementInput = freezeMovementInput(
      mergeMovementAxis(pending?.forward || 0, input.forward),
      mergeMovementAxis(pending?.strafe || 0, input.strafe),
      Boolean(pending?.sprint || input.sprint),
    )
  }
  queueGameFpsSimulationInputStep()
}

export function discardGameFpsTransientInput(): void {
  input = freshInput()
  motionInput = freshMotionInput()
  bufferedMovementInput = null
  pendingTickActions = freshPendingTickActions()
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
  queueGameFpsSimulationInputStep()
}

export function reloadGameFpsWeapon(): void {
  input.reloadQueued = true
  queueGameFpsSimulationInputStep()
}

export function restartGameFpsMission(options: Readonly<{
  persistedDecisions?: readonly unknown[]
}> = {}): GameFpsSnapshot {
  return replaceMission(options.persistedDecisions || [], false)
}

export function refreshGameFpsMissionSpatialProfile(): GameFpsSnapshot | null {
  if (!mission || missionSpatialSourceKey === readGameModeXrSpatialSourceKey()) return null
  return replaceMission()
}

export function captureGameFpsAdvance(deltaSeconds: number): GameFpsAdvance {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new Error('Game FPS deltaSeconds must be a non-negative finite number')
  }
  const request = Object.freeze({
    deltaSeconds,
    generation,
    input: captureAdvanceInput(),
  })
  let consumed = false
  return () => {
    if (consumed) {
      return Promise.reject(new Error('Game FPS advance was already consumed'))
    }
    consumed = true
    return enqueueGameFpsAdvance(request)
  }
}

function enqueueGameFpsAdvance(request: GameFpsAdvanceRequest): Promise<GameFpsSnapshot> {
  let resolveResult: (value: GameFpsSnapshot) => void
  let rejectResult: (reason: unknown) => void
  const result = new Promise<GameFpsSnapshot>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  tickQueue = tickQueue.catch(() => undefined).then(async () => {
    if (request.generation !== generation) {
      resolveResult(snapshot)
      return
    }
    try {
      resolveResult(await advanceCurrentMission(request.deltaSeconds, request.generation, request.input))
    } catch (error) {
      const resumedTickFailure = error instanceof ResumedGameFpsTickFailure
      if (request.generation !== generation && !resumedTickFailure) {
        resolveResult(snapshot)
        return
      }
      if (resumedTickFailure) {
        publishRuntimeFailure(error.runtimeFailure)
        rejectResult(error.runtimeFailure)
        return
      }
      publishRuntimeFailure(error)
      rejectResult(error)
    }
  })
  return result
}

export function advanceGameFpsBy(deltaSeconds: number): Promise<GameFpsSnapshot> {
  try {
    return captureGameFpsAdvance(deltaSeconds)()
  } catch (error) {
    return Promise.reject(error)
  }
}

export function acknowledgeGameFpsDecisions(decisionIds: readonly string[]): GameFpsSnapshot {
  let changed = false
  for (const decisionId of new Set(decisionIds)) changed = pendingDecisions.delete(decisionId) || changed
  if (!changed) return snapshot
  snapshot = Object.freeze({
    ...snapshot,
    pendingDecisions: Object.freeze([...pendingDecisions.values()]),
    revision: snapshot.revision + 1,
  })
  for (const listener of [...listeners]) listener()
  return snapshot
}

export function resetGameFpsRuntimeForTests(): GameFpsSnapshot {
  mission = null
  missionSpatialSourceKey = null
  pendingDecisions.clear()
  accumulatorSeconds = 0
  runId = 0
  generation += 1
  inFlightTick = null
  input = freshInput()
  motionInput = freshMotionInput()
  bufferedMovementInput = null
  pendingTickActions = freshPendingTickActions()
  const previousRevision = snapshot.revision
  snapshot = createIdleSnapshot(readGameModeXrSpatialProfile(), previousRevision + 1)
  for (const listener of [...listeners]) listener()
  return snapshot
}
