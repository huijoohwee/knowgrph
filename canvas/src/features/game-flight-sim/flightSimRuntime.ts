import { useGraphStore } from '@/hooks/useGraphStore'
import { readWebglSupport } from '@/lib/three/webglSupport'
import {
  activateXrSceneSurface,
  isXrGameplaySurfaceView,
  registerXrSceneGameplayExitHandler,
} from '@/features/three/xrSceneSurfaceRuntime'
import {
  pauseXrPhysicsRuntime,
  playXrPhysicsRuntime,
  readXrPhysicsRuntime,
} from '@/features/three/xrPhysicsRuntime'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import {
  captureFlightSimMission,
  cloneFlightSimMission,
  createFlightSimMission,
  tickFlightSimMission,
  type FlightSimMission,
  type FlightSimMissionCapture,
} from './flightSimMission'
import { validateFlightSimMissionDecisions } from './flightSimDecisionAdmission'
import {
  FLIGHT_SIM_FIXED_STEP_SECONDS,
  FLIGHT_SIM_MAX_FRAME_SECONDS,
  FLIGHT_SIM_MAX_RUN_ID,
  FLIGHT_SIM_NEUTRAL_INPUT,
  FLIGHT_SIM_ZERO_COST_LOG,
  isFlightSimInputNeutral,
  normalizeFlightSimInput,
  type FlightSimCostLog,
  type FlightSimDecisionRecord,
  type FlightSimInputPatch,
  type FlightSimPhase,
  type FlightSimSnapshot,
  type FlightSimSpatialProfile,
  type FlightSimTickInput,
} from './flightSimModel'
import { readFlightSimXrSpatialProfile } from './flightSimSpatialProfile'
import {
  loadFlightSimSavedDecisions,
  persistPendingFlightSimDecisions,
  queueFlightSimDecisions,
  readFlightSimDecisionStore,
  reportFlightSimDecisionLoadFailure,
  resetFlightSimLocalSave,
  type FlightSimDecisionStoreSnapshot,
} from './flightSimDecisionStore'
import {
  beginFlightSimHydration,
  cancelFlightSimHydration,
  finishFlightSimHydration,
  readFlightSimHydrationPending,
} from './flightSimHydrationGate'
import { createFlightSimPendingDecisionIndex } from './flightSimPendingDecisions'
type Listener = () => void
type AdvanceRequest = Readonly<{
  deltaSeconds: number
  generation: number
  input: FlightSimTickInput
  throttleSetpoint: number | null
}>
export type FlightSimRuntime = Readonly<{
  profile: () => FlightSimSpatialProfile
  read: () => FlightSimSnapshot
  subscribe: (listener: Listener) => () => void
  open: (webglSupported?: boolean) => FlightSimSnapshot
  start: () => FlightSimSnapshot
  stop: () => FlightSimSnapshot
  restart: () => FlightSimSnapshot
  exit: () => FlightSimSnapshot
  setProfile: (profile: FlightSimSpatialProfile) => FlightSimSnapshot
  setInput: (patch: FlightSimInputPatch) => FlightSimSnapshot
  queueInput: (patch: FlightSimInputPatch) => FlightSimSnapshot
  setThrottle: (value: number) => FlightSimSnapshot
  advanceBy: (deltaSeconds: number) => Promise<FlightSimSnapshot>
  acknowledgeDecisions: (ids: readonly string[]) => FlightSimSnapshot
  hydrate: (decisions: readonly unknown[]) => FlightSimSnapshot
  resetPersistence: () => FlightSimSnapshot
  fail: (error: unknown) => FlightSimSnapshot
}>
function freezeDecision(value: FlightSimDecisionRecord): FlightSimDecisionRecord {
  return Object.freeze({ ...value, payload: Object.freeze({ ...value.payload }) })
}
function runtimeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : String(error || 'Flight Sim runtime failed')
}
function idleSnapshot(profile: FlightSimSpatialProfile, active: boolean, webglSupported: boolean): FlightSimSnapshot {
  return Object.freeze({
    active,
    surfaceMode: 'xr',
    webglSupported,
    phase: 'stopped',
    runId: 0,
    aircraft: profile.spawn,
    waypointIndex: 0,
    waypointCount: profile.waypoints.length,
    currentWaypointId: profile.waypoints[0]?.id || null,
    tick: 0,
    elapsedSeconds: 0,
    collisionId: null,
    pendingDecisions: Object.freeze([]),
    lastCostLog: FLIGHT_SIM_ZERO_COST_LOG,
    runtimeError: null,
    revision: 0,
  })
}
function boundedDeltaSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Flight Sim delta must be a non-negative finite number')
  return Math.min(value, FLIGHT_SIM_MAX_FRAME_SECONDS)
}
function mergedInput(left: FlightSimTickInput, right: FlightSimInputPatch): FlightSimTickInput {
  return normalizeFlightSimInput({
    pitch: left.pitch + (right.pitch ?? 0),
    roll: left.roll + (right.roll ?? 0),
    yaw: left.yaw + (right.yaw ?? 0),
    throttleDelta: left.throttleDelta + (right.throttleDelta ?? 0),
  })
}
function maximumDecisionRunId(decisions: readonly FlightSimDecisionRecord[]): number {
  return decisions.reduce((maximum, item) => Math.max(maximum, Number(item.payload.runId)), 0)
}
export function createFlightSimRuntime(options: Readonly<{
  profile: FlightSimSpatialProfile
  active?: boolean
  webglSupported?: boolean
}>): FlightSimRuntime {
  const listeners = new Set<Listener>()
  const pendingDecisions = createFlightSimPendingDecisionIndex(freezeDecision)
  let profile = options.profile
  let mission: FlightSimMission | null = null
  let runId = 0
  let generation = 0
  let accumulatorSeconds = 0
  let input = FLIGHT_SIM_NEUTRAL_INPUT
  let pendingInput = FLIGHT_SIM_NEUTRAL_INPUT
  let throttleTarget: number | null = null
  let hydratedDecisions: readonly FlightSimDecisionRecord[] = Object.freeze([])
  let resumePhase: Exclude<FlightSimPhase, 'stopped'> = 'ready'
  let tickQueue: Promise<void> = Promise.resolve()
  let snapshot = idleSnapshot(profile, options.active ?? true, options.webglSupported ?? true)
  const notify = () => {
    for (const listener of [...listeners]) listener()
  }
  const publish = (
    update: Partial<Omit<FlightSimSnapshot, 'revision'>>,
  ): FlightSimSnapshot => {
    snapshot = Object.freeze({ ...snapshot, ...update, revision: snapshot.revision + 1 })
    notify()
    return snapshot
  }
  const publishCapture = (
    capture: FlightSimMissionCapture,
    costLog: FlightSimCostLog,
    phase: FlightSimPhase = capture.phase,
    clearError = false,
  ) => publish({
    ...capture,
    active: snapshot.active,
    webglSupported: snapshot.webglSupported,
    phase,
    runId,
    pendingDecisions: pendingDecisions.values(),
    lastCostLog: costLog,
    runtimeError: clearError ? null : snapshot.runtimeError,
  })
  const resetMission = () => {
    mission = null
    pendingDecisions.clear()
    hydratedDecisions = Object.freeze([])
    runId = 0
    generation += 1
    accumulatorSeconds = 0
    input = FLIGHT_SIM_NEUTRAL_INPUT
    pendingInput = FLIGHT_SIM_NEUTRAL_INPUT
    throttleTarget = null
    resumePhase = 'ready'
    snapshot = Object.freeze({
      ...idleSnapshot(profile, snapshot.active, snapshot.webglSupported),
      revision: snapshot.revision + 1,
    })
    notify()
    return snapshot
  }
  const replaceMission = (replayHydratedDecisions = false) => {
    if (runId >= FLIGHT_SIM_MAX_RUN_ID) return publish({
      phase: 'stopped',
      runtimeError: 'Flight Sim exhausted its bounded run range; reset the local save.',
    })
    runId += 1
    generation += 1
    mission = createFlightSimMission({
      runId,
      profile,
      decisions: replayHydratedDecisions ? hydratedDecisions : [],
    })
    hydratedDecisions = Object.freeze([])
    accumulatorSeconds = 0
    input = FLIGHT_SIM_NEUTRAL_INPUT
    pendingInput = FLIGHT_SIM_NEUTRAL_INPUT
    throttleTarget = null
    const capture = captureFlightSimMission(mission)
    resumePhase = capture.phase
    return publishCapture(capture, FLIGHT_SIM_ZERO_COST_LOG, capture.phase, true)
  }
  const armFromInput = (value: FlightSimTickInput) => {
    if (isFlightSimInputNeutral(value) || !mission || snapshot.phase !== 'ready') return snapshot
    resumePhase = 'flying'
    return publish({ phase: 'flying' })
  }
  const capturedInput = () => {
    const combined = mergedInput(input, pendingInput)
    pendingInput = FLIGHT_SIM_NEUTRAL_INPUT
    const throttleSetpoint = throttleTarget
    return Object.freeze({ input: combined, throttleSetpoint })
  }
  const advanceCurrentMission = async (request: AdvanceRequest): Promise<FlightSimSnapshot> => {
    if (!mission || request.generation !== generation || snapshot.phase !== 'flying' || snapshot.runtimeError) {
      return snapshot
    }
    const activeMission = mission
    const workingMission = cloneFlightSimMission(activeMission)
    const producedDecisions = new Map<string, FlightSimDecisionRecord>()
    accumulatorSeconds += request.deltaSeconds
    let stepped = false
    let capture = captureFlightSimMission(workingMission)
    let costLog = snapshot.lastCostLog
    while (accumulatorSeconds + 1e-10 >= FLIGHT_SIM_FIXED_STEP_SECONDS) {
      accumulatorSeconds = Math.max(0, accumulatorSeconds - FLIGHT_SIM_FIXED_STEP_SECONDS)
      const result = await tickFlightSimMission(
        workingMission,
        request.input,
        request.throttleSetpoint,
      )
      if (mission !== activeMission || generation !== request.generation) return snapshot
      stepped = true
      capture = result.capture
      costLog = result.costLog
      for (const item of result.decisions) {
        producedDecisions.set(item.decisionId, item)
      }
      if (capture.phase === 'completed' || capture.phase === 'crashed') {
        accumulatorSeconds = 0
        break
      }
    }
    if (!stepped || mission !== activeMission || generation !== request.generation) return snapshot
    mission = workingMission
    for (const item of producedDecisions.values()) pendingDecisions.retain(item)
    if (throttleTarget === request.throttleSetpoint) throttleTarget = null
    resumePhase = capture.phase
    return publishCapture(capture, costLog)
  }
  return Object.freeze({
    profile: () => profile,
    read: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    open(webglSupported = true) {
      return publish({
        active: true,
        webglSupported,
        runtimeError: webglSupported ? null : 'WebGL is unavailable; Flight Sim stayed stopped.',
      })
    },
    start() {
      if (!snapshot.active) return publish({ runtimeError: 'Open Flight Sim before starting.' })
      if (!snapshot.webglSupported) return publish({ phase: 'stopped', runtimeError: 'WebGL is unavailable; Flight Sim stayed stopped.' })
      if (!mission) return replaceMission(true)
      if (snapshot.runtimeError) return snapshot
      if (snapshot.phase !== 'stopped') return snapshot
      return publish({ phase: resumePhase })
    },
    stop() {
      if (!mission || snapshot.phase === 'stopped') return snapshot
      resumePhase = snapshot.phase
      generation += 1
      accumulatorSeconds = 0
      input = FLIGHT_SIM_NEUTRAL_INPUT
      pendingInput = FLIGHT_SIM_NEUTRAL_INPUT
      return publish({ phase: 'stopped' })
    },
    restart() {
      if (!snapshot.active) return publish({ runtimeError: 'Open Flight Sim before restarting.' })
      if (!snapshot.webglSupported) return publish({ phase: 'stopped', runtimeError: 'WebGL is unavailable; Flight Sim stayed stopped.' })
      const priorPhase = snapshot.phase === 'stopped' ? resumePhase : snapshot.phase
      if (priorPhase === 'ready' || priorPhase === 'flying') pendingDecisions.discardRun(runId)
      return replaceMission()
    },
    exit() {
      generation += 1
      accumulatorSeconds = 0
      input = FLIGHT_SIM_NEUTRAL_INPUT
      pendingInput = FLIGHT_SIM_NEUTRAL_INPUT
      throttleTarget = null
      return publish({ active: false, phase: 'stopped' })
    },
    setProfile(nextProfile) {
      if (profile.sourceKey === nextProfile.sourceKey) return snapshot
      profile = nextProfile
      return resetMission()
    },
    setInput(patch) {
      input = normalizeFlightSimInput({ ...input, ...patch })
      if (patch.throttleDelta && patch.throttleDelta !== 0) throttleTarget = null
      return armFromInput(input)
    },
    queueInput(patch) {
      pendingInput = mergedInput(pendingInput, patch)
      return armFromInput(pendingInput)
    },
    setThrottle(value) {
      if (snapshot.phase !== 'ready' && snapshot.phase !== 'flying') {
        return publish({ runtimeError: 'Flight Sim throttle requires a ready or flying mission.' })
      }
      const numeric = Number(value)
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
        throw new Error('Flight Sim throttle must be a finite number from 0 to 1')
      }
      throttleTarget = numeric
      armFromInput(normalizeFlightSimInput({
        throttleDelta: Math.sign(numeric - snapshot.aircraft.throttle),
      }))
      return publish({
        aircraft: Object.freeze({ ...snapshot.aircraft, throttle: numeric }),
      })
    },
    advanceBy(deltaSeconds) {
      const captured = capturedInput()
      const request = Object.freeze({
        deltaSeconds: boundedDeltaSeconds(deltaSeconds),
        generation,
        input: captured.input,
        throttleSetpoint: captured.throttleSetpoint,
      })
      const queued = tickQueue.then(() => advanceCurrentMission(request))
      tickQueue = queued.then(() => undefined, () => undefined)
      return queued.catch(error => {
        if (request.generation === generation) publish({ runtimeError: runtimeErrorMessage(error) })
        throw error
      })
    },
    acknowledgeDecisions(ids) {
      pendingDecisions.acknowledge(ids)
      return publish({ pendingDecisions: pendingDecisions.values() })
    },
    hydrate(values) {
      if (mission) return snapshot
      try {
        const decisions = validateFlightSimMissionDecisions(profile, values)
        hydratedDecisions = decisions
        runId = Math.max(runId, maximumDecisionRunId(decisions))
        return publish({ runtimeError: null })
      } catch (error) {
        return publish({ phase: 'stopped', runtimeError: runtimeErrorMessage(error) })
      }
    },
    resetPersistence: resetMission,
    fail(error) {
      return publish({ phase: 'stopped', runtimeError: runtimeErrorMessage(error) })
    },
  })
}
type GraphStoreState = ReturnType<typeof useGraphStore.getState>
type PreviousCanvasSurface = Readonly<Pick<
  GraphStoreState,
  'canvasRenderMode' | 'canvas3dMode' | 'floatingPanelOpen' | 'floatingPanelView'
>>
type AuthoredRuntimeOwnership = Readonly<{
  physicsWasPlaying: boolean
  timelineWasPlaying: boolean
}>
type FlightSimSurfaceOpenOptions = Readonly<{
  openPanel?: boolean
  webglSupported?: boolean
  workspace?: WorkspaceFs
}>
let defaultRuntime = createFlightSimRuntime({
  profile: readFlightSimXrSpatialProfile(),
  active: false,
  webglSupported: false,
})
let previousCanvasSurface: PreviousCanvasSurface | null = null
let authoredRuntimeOwnership: AuthoredRuntimeOwnership | null = null
let flightSimSurfaceOpenTail: Promise<void> | null = null
function suspendAuthoredRuntime(): void {
  if (!authoredRuntimeOwnership) {
    const state = useGraphStore.getState()
    authoredRuntimeOwnership = Object.freeze({
      physicsWasPlaying: readXrPhysicsRuntime().phase === 'playing',
      timelineWasPlaying: state.timelineTransportPlaying === true,
    })
  }
  pauseXrPhysicsRuntime()
  useGraphStore.getState().setTimelineTransportState({ playing: false })
}
function restoreAuthoredRuntime(): void {
  const ownership = authoredRuntimeOwnership
  authoredRuntimeOwnership = null
  if (!ownership) return
  if (ownership.physicsWasPlaying) playXrPhysicsRuntime()
  else pauseXrPhysicsRuntime()
  useGraphStore.getState().setTimelineTransportState({ playing: ownership.timelineWasPlaying })
}
export function readFlightSimSnapshot(): FlightSimSnapshot {
  return defaultRuntime.read()
}
export function readFlightSimSpatialProfile(): FlightSimSpatialProfile {
  return defaultRuntime.profile()
}
export function subscribeFlightSimSnapshot(listener: Listener): () => void {
  return defaultRuntime.subscribe(listener)
}
export function isFlightSimHydrationPending(): boolean {
  return readFlightSimHydrationPending()
}
async function performFlightSimSurfaceOpen(
  options: FlightSimSurfaceOpenOptions,
): Promise<FlightSimSnapshot> {
  const hydrationToken = beginFlightSimHydration()
  const entering = !defaultRuntime.read().active
  const state = useGraphStore.getState()
  if (entering) {
    previousCanvasSurface = Object.freeze({
      canvasRenderMode: state.canvasRenderMode,
      canvas3dMode: state.canvas3dMode,
      floatingPanelOpen: state.floatingPanelOpen,
      floatingPanelView: isXrGameplaySurfaceView(state.floatingPanelView)
        ? 'motionControl'
        : state.floatingPanelView,
    })
  }
  try {
    const activated = activateXrSceneSurface({
      ...(options.openPanel === false ? {} : { panelView: 'flightSim', openPanel: true }),
      beforePanelCommit: () => {
        defaultRuntime.setProfile(readFlightSimXrSpatialProfile())
      },
    })
    if (!activated) {
      finishFlightSimHydration(hydrationToken)
      if (entering) previousCanvasSurface = null
      return defaultRuntime.open(false)
    }
    suspendAuthoredRuntime()
    const admitted = defaultRuntime.open(options.webglSupported ?? readWebglSupport())
    if (!admitted.webglSupported) {
      finishFlightSimHydration(hydrationToken)
      return admitted
    }
    try {
      const decisions = await loadFlightSimSavedDecisions(
        options.workspace ? { workspace: options.workspace } : {},
      )
      if (!finishFlightSimHydration(hydrationToken)) return defaultRuntime.read()
      if (readFlightSimDecisionStore().hydrationBlocked) {
        return defaultRuntime.fail(
          readFlightSimDecisionStore().error
          || 'Flight Sim Decisions remain blocked until Reset local save succeeds.',
        )
      }
      const hydrated = defaultRuntime.hydrate(decisions)
      if (!hydrated.runtimeError) return hydrated
      return defaultRuntime.fail(reportFlightSimDecisionLoadFailure(hydrated.runtimeError).error)
    } catch {
      if (!finishFlightSimHydration(hydrationToken)) return defaultRuntime.read()
      return defaultRuntime.fail(
        readFlightSimDecisionStore().error
        || 'Flight Sim Decisions are unreadable; reset the local save before starting.',
      )
    }
  } catch (error) {
    if (!finishFlightSimHydration(hydrationToken)) return defaultRuntime.read()
    if (entering) previousCanvasSurface = null
    return defaultRuntime.fail(error)
  }
}
export function openFlightSimSurface(
  options: FlightSimSurfaceOpenOptions = {},
): Promise<FlightSimSnapshot> {
  const opening = flightSimSurfaceOpenTail
    ? flightSimSurfaceOpenTail.then(() => performFlightSimSurfaceOpen(options))
    : performFlightSimSurfaceOpen(options)
  const tail = opening.then(() => undefined, () => undefined)
  flightSimSurfaceOpenTail = tail
  void tail.then(() => {
    if (flightSimSurfaceOpenTail === tail) flightSimSurfaceOpenTail = null
  })
  return opening
}
export function startFlightSim(): FlightSimSnapshot
export function startFlightSim(options: FlightSimSurfaceOpenOptions): Promise<FlightSimSnapshot>
export function startFlightSim(
  options?: FlightSimSurfaceOpenOptions,
): FlightSimSnapshot | Promise<FlightSimSnapshot> {
  if (options) return openFlightSimSurface(options).then(opened => (
    opened.active && opened.webglSupported && !opened.runtimeError
      ? startFlightSim()
      : opened
  ))
  if (readFlightSimHydrationPending()) {
    return defaultRuntime.fail('Flight Sim Decisions are still loading; wait before starting.')
  }
  if (readFlightSimDecisionStore().hydrationBlocked) {
    return defaultRuntime.fail(
      readFlightSimDecisionStore().error
      || 'Flight Sim Decisions are unreadable; reset the local save before starting.',
    )
  }
  return defaultRuntime.start()
}
export function stopFlightSim(): FlightSimSnapshot {
  return defaultRuntime.stop()
}
export function restartFlightSim(): FlightSimSnapshot {
  if (readFlightSimHydrationPending()) {
    return defaultRuntime.fail('Flight Sim Decisions are still loading; wait before restarting.')
  }
  if (readFlightSimDecisionStore().hydrationBlocked) {
    return defaultRuntime.fail(
      readFlightSimDecisionStore().error
      || 'Flight Sim Decisions are unreadable; reset the local save before restarting.',
    )
  }
  return defaultRuntime.restart()
}
export function setFlightSimInput(patch: FlightSimInputPatch): FlightSimSnapshot {
  return defaultRuntime.setInput(patch)
}
export function queueFlightSimInput(patch: FlightSimInputPatch): FlightSimSnapshot {
  return defaultRuntime.queueInput(patch)
}
export function setFlightSimThrottle(value: number): FlightSimSnapshot {
  return defaultRuntime.setThrottle(value)
}
export function advanceFlightSimBy(deltaSeconds: number): Promise<FlightSimSnapshot> {
  return defaultRuntime.advanceBy(deltaSeconds)
}
export function advanceFlightSimByFixedStep(): Promise<FlightSimSnapshot> {
  return advanceFlightSimBy(FLIGHT_SIM_FIXED_STEP_SECONDS)
}
export function acknowledgeFlightSimDecisions(ids: readonly string[]): FlightSimSnapshot {
  return defaultRuntime.acknowledgeDecisions(ids)
}
export async function persistFlightSimPendingDecisions(options: Readonly<{
  workspace?: WorkspaceFs
}> = {}): Promise<FlightSimDecisionStoreSnapshot> {
  const decisions = [...defaultRuntime.read().pendingDecisions]
  if (decisions.length > 0) queueFlightSimDecisions(decisions)
  const saved = await persistPendingFlightSimDecisions(options)
  if (saved.status === 'saved' && decisions.length > 0) {
    defaultRuntime.acknowledgeDecisions(decisions.map(item => item.decisionId))
  }
  return saved
}
export async function resetFlightSimLocalPersistence(options: Readonly<{
  workspace?: WorkspaceFs
}> = {}): Promise<FlightSimDecisionStoreSnapshot> {
  const reset = await resetFlightSimLocalSave(options)
  if (reset.status === 'saved') defaultRuntime.resetPersistence()
  return reset
}
export function exitFlightSimSurface(
  options: Readonly<{ restorePreviousSurface?: boolean }> = {},
): FlightSimSnapshot {
  cancelFlightSimHydration()
  const previous = previousCanvasSurface
  previousCanvasSurface = null
  const next = defaultRuntime.exit()
  restoreAuthoredRuntime()
  if (options.restorePreviousSurface !== false && previous) {
    const state = useGraphStore.getState()
    state.setCanvas3dMode(previous.canvas3dMode)
    state.setCanvasRenderMode(previous.canvasRenderMode)
    state.setFloatingPanelView(previous.floatingPanelView)
    state.setFloatingPanelOpen(previous.floatingPanelOpen)
  }
  return next
}
export const exitFlightSim = exitFlightSimSurface

registerXrSceneGameplayExitHandler('flightSim', () => {
  if (defaultRuntime.read().active) exitFlightSimSurface({ restorePreviousSurface: false })
})

export function resetFlightSimRuntimeForTests(
  profile: FlightSimSpatialProfile = readFlightSimXrSpatialProfile(),
): FlightSimSnapshot {
  cancelFlightSimHydration()
  flightSimSurfaceOpenTail = null
  previousCanvasSurface = null
  restoreAuthoredRuntime()
  defaultRuntime = createFlightSimRuntime({ profile, active: false, webglSupported: false })
  return defaultRuntime.read()
}
