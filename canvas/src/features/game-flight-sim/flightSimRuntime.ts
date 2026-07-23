import { readWebglSupport } from '@/lib/three/webglSupport'
import {
  activateXrSceneSurface,
  registerXrSceneGameplayExitHandler,
} from '@/features/three/xrSceneSurfaceRuntime'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import {
  captureFlightSimMission,
  cloneFlightSimMission,
  createFlightSimMission,
  disposeFlightSimMission,
  tickFlightSimMission,
  type FlightSimMission,
  type FlightSimMissionCapture,
} from './flightSimMission'
import { validateFlightSimMissionDecisions } from './flightSimDecisionAdmission'
import {
  FLIGHT_SIM_FIXED_STEP_SECONDS,
  FLIGHT_SIM_MAX_CATCH_UP_TICKS,
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
import { mergeFlightSimInputs } from './flightSimInput'
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
import {
  boundedFlightSimDeltaSeconds,
  createIdleFlightSimSnapshot,
  flightSimRuntimeErrorMessage,
  freezeFlightSimDecision,
  maximumFlightSimDecisionRunId,
  type FlightSimAdvanceRequest,
  type FlightSimRuntime,
} from './flightSimRuntimeState'
import {
  captureFlightSimAuthoredRuntimeOwnership,
  captureFlightSimPreviousCanvasSurface,
  restoreFlightSimAuthoredRuntime,
  restoreFlightSimPreviousCanvasSurface,
  suspendFlightSimAuthoredRuntime,
  type FlightSimAuthoredRuntimeOwnership,
  type FlightSimPreviousCanvasSurface,
} from './flightSimSurfaceOwnershipRuntime'
import {
  clearFlightSimSurfaceOwnershipFailure,
  reportFlightSimSurfaceEntryFailure,
  reportFlightSimSurfaceRestorationFailure,
  resetFlightSimSurfaceOwnershipStatusForTests,
} from './flightSimSurfaceOwnershipStatus'

export type { FlightSimRuntime } from './flightSimRuntimeState'

type Listener = () => void
function mergedInput(left: FlightSimTickInput, right: FlightSimInputPatch): FlightSimTickInput {
  return mergeFlightSimInputs([left, right])
}
export function createFlightSimRuntime(options: Readonly<{
  profile: FlightSimSpatialProfile
  active?: boolean
  webglSupported?: boolean
  onMissionCreated?: (mission: FlightSimMission) => void
}>): FlightSimRuntime {
  const listeners = new Set<Listener>()
  const pendingDecisions = createFlightSimPendingDecisionIndex(freezeFlightSimDecision)
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
  let snapshot = createIdleFlightSimSnapshot(
    profile,
    options.active ?? true,
    options.webglSupported ?? true,
  )
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
  const resetMission = (active = snapshot.active) => {
    const discardedMission = mission
    mission = null
    if (discardedMission) disposeFlightSimMission(discardedMission)
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
      ...createIdleFlightSimSnapshot(profile, active, snapshot.webglSupported),
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
    const nextRunId = runId + 1
    const previousMission = mission
    const nextMission = createFlightSimMission({
      runId: nextRunId,
      profile,
      decisions: replayHydratedDecisions ? hydratedDecisions : [],
    })
    try {
      options.onMissionCreated?.(nextMission)
    } catch (error) {
      disposeFlightSimMission(nextMission)
      throw error
    }
    generation += 1
    runId = nextRunId
    mission = nextMission
    if (previousMission) disposeFlightSimMission(previousMission)
    hydratedDecisions = Object.freeze([])
    accumulatorSeconds = 0
    input = FLIGHT_SIM_NEUTRAL_INPUT
    pendingInput = FLIGHT_SIM_NEUTRAL_INPUT
    throttleTarget = null
    const capture = captureFlightSimMission(nextMission)
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
  const advanceCurrentMission = async (
    request: FlightSimAdvanceRequest,
  ): Promise<FlightSimSnapshot> => {
    if (!mission || request.generation !== generation || snapshot.phase !== 'flying' || snapshot.runtimeError) {
      return snapshot
    }
    const activeMission = mission
    const workingMission = cloneFlightSimMission(activeMission)
    let adoptedWorkingMission = false
    try {
      const producedDecisions = new Map<string, FlightSimDecisionRecord>()
      accumulatorSeconds += request.deltaSeconds
      let stepped = false
      let catchUpTicks = 0
      let capture = captureFlightSimMission(workingMission)
      let costLog = snapshot.lastCostLog
      while (
        accumulatorSeconds + 1e-10 >= FLIGHT_SIM_FIXED_STEP_SECONDS
        && catchUpTicks < FLIGHT_SIM_MAX_CATCH_UP_TICKS
      ) {
        accumulatorSeconds = Math.max(0, accumulatorSeconds - FLIGHT_SIM_FIXED_STEP_SECONDS)
        catchUpTicks += 1
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
      adoptedWorkingMission = true
      disposeFlightSimMission(activeMission)
      for (const item of producedDecisions.values()) pendingDecisions.retain(item)
      if (throttleTarget === request.throttleSetpoint) throttleTarget = null
      resumePhase = capture.phase
      return publishCapture(capture, costLog)
    } finally {
      if (!adoptedWorkingMission) disposeFlightSimMission(workingMission)
    }
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
      return resetMission(false)
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
        deltaSeconds: boundedFlightSimDeltaSeconds(deltaSeconds),
        generation,
        input: captured.input,
        throttleSetpoint: captured.throttleSetpoint,
      })
      const queued = tickQueue.then(() => advanceCurrentMission(request))
      tickQueue = queued.then(() => undefined, () => undefined)
      return queued.catch(error => {
        if (request.generation === generation) {
          publish({ runtimeError: flightSimRuntimeErrorMessage(error) })
        }
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
        runId = Math.max(runId, maximumFlightSimDecisionRunId(decisions))
        return publish({ runtimeError: null })
      } catch (error) {
        return publish({ phase: 'stopped', runtimeError: flightSimRuntimeErrorMessage(error) })
      }
    },
    resetPersistence: resetMission,
    fail(error) {
      return publish({ phase: 'stopped', runtimeError: flightSimRuntimeErrorMessage(error) })
    },
  })
}
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
let previousCanvasSurface: FlightSimPreviousCanvasSurface | null = null
let authoredRuntimeOwnership: FlightSimAuthoredRuntimeOwnership | null = null
let flightSimSurfaceOpenTail: Promise<void> | null = null
function suspendAuthoredRuntime(): void {
  if (!authoredRuntimeOwnership) {
    authoredRuntimeOwnership = captureFlightSimAuthoredRuntimeOwnership()
  }
  suspendFlightSimAuthoredRuntime()
}
function restoreAuthoredRuntime(): void {
  const ownership = authoredRuntimeOwnership
  authoredRuntimeOwnership = null
  restoreFlightSimAuthoredRuntime(ownership)
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
function restoreSurfaceOwnership(
  previous: FlightSimPreviousCanvasSurface | null,
  restorePreviousSurface: boolean,
): string[] {
  const failures: string[] = []
  try {
    restoreAuthoredRuntime()
  } catch (error) {
    failures.push(flightSimRuntimeErrorMessage(error))
  }
  if (restorePreviousSurface && previous) {
    try {
      restoreFlightSimPreviousCanvasSurface(previous)
    } catch (error) {
      failures.push(flightSimRuntimeErrorMessage(error))
    }
  }
  return failures
}
function failFlightSimSurfaceEntry(
  error: unknown,
  entering: boolean,
  surfaceActivated: boolean,
): FlightSimSnapshot {
  const failures = [flightSimRuntimeErrorMessage(error)]
  if (entering) {
    defaultRuntime.exit()
    if (surfaceActivated) {
      failures.push(...restoreSurfaceOwnership(previousCanvasSurface, true))
    }
    previousCanvasSurface = null
  }
  const message = `Flight Sim surface entry did not complete: ${failures.join('; ')}`
  reportFlightSimSurfaceEntryFailure(message)
  return defaultRuntime.fail(message)
}
async function performFlightSimSurfaceOpen(
  options: FlightSimSurfaceOpenOptions,
): Promise<FlightSimSnapshot> {
  const hydrationToken = beginFlightSimHydration()
  const entering = !defaultRuntime.read().active
  if (entering) previousCanvasSurface = captureFlightSimPreviousCanvasSurface()
  clearFlightSimSurfaceOwnershipFailure()
  let hydrationFinished = false
  let surfaceActivated = false
  try {
    if (!(options.webglSupported ?? readWebglSupport())) {
      hydrationFinished = true
      finishFlightSimHydration(hydrationToken)
      return failFlightSimSurfaceEntry('WebGL is unavailable.', entering, false)
    }
    defaultRuntime.setProfile(readFlightSimXrSpatialProfile())
    const decisions = await loadFlightSimSavedDecisions(
      options.workspace ? { workspace: options.workspace } : {},
    )
    hydrationFinished = true
    if (!finishFlightSimHydration(hydrationToken)) return defaultRuntime.read()
    if (readFlightSimDecisionStore().hydrationBlocked) {
      return failFlightSimSurfaceEntry(
        readFlightSimDecisionStore().error
        || 'Flight Sim Decisions remain blocked until Reset local save succeeds.',
        entering,
        false,
      )
    }
    const hydrated = defaultRuntime.hydrate(decisions)
    if (hydrated.runtimeError) {
      return failFlightSimSurfaceEntry(
        reportFlightSimDecisionLoadFailure(hydrated.runtimeError).error,
        entering,
        false,
      )
    }
    surfaceActivated = activateXrSceneSurface({
      ...(options.openPanel === false ? {} : { panelView: 'flightSim', openPanel: true }),
    })
    if (!surfaceActivated) {
      return failFlightSimSurfaceEntry('The shared XR Canvas is unavailable.', entering, false)
    }
    suspendAuthoredRuntime()
    return defaultRuntime.open(true)
  } catch (error) {
    if (!hydrationFinished && !finishFlightSimHydration(hydrationToken)) {
      return defaultRuntime.read()
    }
    const localError = readFlightSimDecisionStore().error || error
    return failFlightSimSurfaceEntry(localError, entering, surfaceActivated)
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
  const failures = restoreSurfaceOwnership(
    previous,
    options.restorePreviousSurface !== false,
  )
  if (failures.length > 0) {
    const message = `Flight Sim surface restoration did not complete: ${failures.join('; ')}`
    reportFlightSimSurfaceRestorationFailure(message)
    return defaultRuntime.fail(message)
  }
  clearFlightSimSurfaceOwnershipFailure()
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
  resetFlightSimSurfaceOwnershipStatusForTests()
  defaultRuntime = createFlightSimRuntime({ profile, active: false, webglSupported: false })
  return defaultRuntime.read()
}
