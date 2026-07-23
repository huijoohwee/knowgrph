import { allocateEntity, createWorld, registerComponent, worldTick } from '../../../../ecs/index.js'
import { snapshotWorld } from '../../../../ecs/world.js'
import {
  FLIGHT_SIM_AIRCRAFT_ENTITY_REF,
  FLIGHT_SIM_FIXED_STEP_SECONDS,
  FLIGHT_SIM_MAX_MISSION_TICKS,
  FLIGHT_SIM_MAX_RUN_ID,
  FLIGHT_SIM_MISSION_ENTITY_REF,
  FLIGHT_SIM_MISSION_ID,
  FLIGHT_SIM_TIMEOUT_COLLIDER_ID,
  FLIGHT_SIM_ZERO_COST_LOG,
  flightSimDecisionId,
  flightSimDecisionProducedAt,
  freezeFlightSimAircraftState,
  normalizeFlightSimInput,
  type FlightSimAircraftState,
  type FlightSimCostLog,
  type FlightSimDecisionEvent,
  type FlightSimDecisionRecord,
  type FlightSimPhase,
  type FlightSimSpatialProfile,
  type FlightSimTickInput,
} from './flightSimModel'
import { validateFlightSimMissionDecisions } from './flightSimDecisionAdmission'
import { integrateFlightModel } from './flightModel'
import {
  flightSimWaypointReached,
  resolveFlightSimAabbMotion,
} from './flightSimSpatialProfile'

const PHASE_READY = 1
const PHASE_FLYING = 2
const PHASE_COMPLETED = 3
const PHASE_CRASHED = 4

type EcsContext = {
  read(entityId: number, component: string, field: string): number
  write(entityId: number, component: string, field: string, value: number): void
  emitDecision(decision: FlightSimDecisionRecord): void
}

type FlightSimWorldTickInput = Readonly<{
  controls: FlightSimTickInput
  throttleSetpoint: number | null
}>

type RuntimeEntity = Readonly<{
  entityRef: string
  components: Record<string, Record<string, number>>
}>

export type FlightSimMissionCapture = Readonly<{
  phase: Exclude<FlightSimPhase, 'stopped'>
  aircraft: FlightSimAircraftState
  waypointIndex: number
  waypointCount: number
  currentWaypointId: string | null
  tick: number
  elapsedSeconds: number
  collisionId: string | null
}>

export type FlightSimMissionTickResult = Readonly<{
  capture: FlightSimMissionCapture
  decisions: readonly FlightSimDecisionRecord[]
  costLog: FlightSimCostLog
}>

export type FlightSimMission = Readonly<{
  world: object
  runId: number
  aircraftEntityId: number
  missionEntityId: number
  profile: FlightSimSpatialProfile
}>

type FlightSimReplayState = Readonly<{
  aircraft: FlightSimAircraftState
  waypointIndex: number
  tick: number
  phase: number
  collisionIndex: number
}>

function boundedRunId(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > FLIGHT_SIM_MAX_RUN_ID) {
    throw new Error('Flight Sim runId must be a bounded positive safe integer')
  }
  return value
}

function phaseName(code: number): Exclude<FlightSimPhase, 'stopped'> {
  if (code === PHASE_COMPLETED) return 'completed'
  if (code === PHASE_CRASHED) return 'crashed'
  if (code === PHASE_FLYING) return 'flying'
  return 'ready'
}

function phaseCode(phase: Exclude<FlightSimPhase, 'stopped'>): number {
  if (phase === 'completed') return PHASE_COMPLETED
  if (phase === 'crashed') return PHASE_CRASHED
  if (phase === 'flying') return PHASE_FLYING
  return PHASE_READY
}

function decision(
  runId: number,
  tick: number,
  event: FlightSimDecisionEvent,
  decisionType: FlightSimDecisionRecord['decisionType'],
  payload: Record<string, unknown>,
): FlightSimDecisionRecord {
  const suffix = String(payload.waypointId || payload.colliderId || 'mission')
  return Object.freeze({
    decisionId: flightSimDecisionId(runId, tick, event, suffix),
    decisionType,
    entityRef: event === 'waypoint_reached'
      ? String(payload.waypointId)
      : FLIGHT_SIM_MISSION_ENTITY_REF,
    payload: Object.freeze({ event, missionId: FLIGHT_SIM_MISSION_ID, runId, tick, ...payload }),
    producedAt: flightSimDecisionProducedAt(tick, event),
  })
}

function payloadNumber(payload: Record<string, unknown>, key: string): number {
  return Number(payload[key])
}

function payloadVector(payload: Record<string, unknown>, key: string): readonly [number, number, number] {
  const value = payload[key] as readonly number[]
  return [Number(value[0]), Number(value[1]), Number(value[2])]
}

function replayFlightSimDecisions(
  profile: FlightSimSpatialProfile,
  values: readonly unknown[],
): FlightSimReplayState {
  const decisions = [...validateFlightSimMissionDecisions(profile, values)].sort((left, right) => {
    const leftRun = Number(left.payload.runId)
    const rightRun = Number(right.payload.runId)
    const runDelta = leftRun - rightRun
    const tickDelta = Number(left.payload.tick) - Number(right.payload.tick)
    return runDelta || tickDelta || left.decisionId.localeCompare(right.decisionId)
  })
  let state: FlightSimReplayState = {
    aircraft: profile.spawn,
    waypointIndex: 0,
    tick: 0,
    phase: PHASE_READY,
    collisionIndex: 0,
  }
  let activeRunId = 0
  for (const item of decisions) {
    const runId = Number(item.payload.runId)
    if (runId !== activeRunId) {
      activeRunId = runId
      state = {
        aircraft: profile.spawn,
        waypointIndex: 0,
        tick: 0,
        phase: PHASE_READY,
        collisionIndex: 0,
      }
    }
    const event = item.payload.event
    const tick = Number(item.payload.tick)
    if (event === 'flight_state') {
      const phase = item.payload.phase === 'completed'
        ? PHASE_COMPLETED
        : item.payload.phase === 'crashed'
          ? PHASE_CRASHED
          : PHASE_FLYING
      state = {
        ...state,
        aircraft: freezeFlightSimAircraftState({
          position: payloadVector(item.payload, 'position'),
          velocity: payloadVector(item.payload, 'velocity'),
          pitch: payloadNumber(item.payload, 'pitch'),
          roll: payloadNumber(item.payload, 'roll'),
          yaw: payloadNumber(item.payload, 'yaw'),
          throttle: payloadNumber(item.payload, 'throttle'),
        }),
        waypointIndex: payloadNumber(item.payload, 'waypointIndex'),
        tick,
        phase,
      }
    } else if (event === 'waypoint_reached') {
      state = {
        ...state,
        waypointIndex: Math.max(state.waypointIndex, payloadNumber(item.payload, 'waypointIndex') + 1),
        tick: Math.max(state.tick, tick),
      }
    } else if (event === 'mission_completed') {
      state = { ...state, phase: PHASE_COMPLETED, tick: Math.max(state.tick, tick) }
    } else if (event === 'mission_crashed') {
      const colliderId = String(item.payload.colliderId)
      state = {
        ...state,
        phase: PHASE_CRASHED,
        tick: Math.max(state.tick, tick),
        collisionIndex: colliderId === FLIGHT_SIM_TIMEOUT_COLLIDER_ID
          ? profile.blockers.length + 1
          : profile.blockers.findIndex(blocker => blocker.id === colliderId) + 1,
      }
    }
  }
  return Object.freeze(state)
}

function replayFlightSimCapture(
  profile: FlightSimSpatialProfile,
  capture: FlightSimMissionCapture,
): FlightSimReplayState {
  if (capture.waypointCount !== profile.waypoints.length) {
    throw new Error('Flight Sim capture waypoint count does not match its spatial profile')
  }
  return Object.freeze({
    aircraft: capture.aircraft,
    waypointIndex: capture.waypointIndex,
    tick: capture.tick,
    phase: phaseCode(capture.phase),
    collisionIndex: capture.collisionId === FLIGHT_SIM_TIMEOUT_COLLIDER_ID
      ? profile.blockers.length + 1
      : capture.collisionId
        ? profile.blockers.findIndex(blocker => blocker.id === capture.collisionId) + 1
        : 0,
  })
}

function emitFlightStateDecision(
  context: EcsContext,
  runId: number,
  tick: number,
  state: FlightSimAircraftState,
  phase: 'flying' | 'completed' | 'crashed',
  waypointIndex: number,
): void {
  context.emitDecision(decision(runId, tick, 'flight_state', 'world_tick_result', {
    position: state.position,
    velocity: state.velocity,
    pitch: state.pitch,
    roll: state.roll,
    yaw: state.yaw,
    throttle: state.throttle,
    waypointIndex,
    phase,
  }))
}

function readAircraft(context: EcsContext, entityId: number): FlightSimAircraftState {
  return freezeFlightSimAircraftState({
    position: [
      context.read(entityId, 'Transform', 'x'),
      context.read(entityId, 'Transform', 'y'),
      context.read(entityId, 'Transform', 'z'),
    ],
    velocity: [
      context.read(entityId, 'Velocity', 'x'),
      context.read(entityId, 'Velocity', 'y'),
      context.read(entityId, 'Velocity', 'z'),
    ],
    pitch: context.read(entityId, 'Attitude', 'pitch'),
    roll: context.read(entityId, 'Attitude', 'roll'),
    yaw: context.read(entityId, 'Attitude', 'yaw'),
    throttle: context.read(entityId, 'FlightControl', 'throttle'),
  })
}

function writeAircraft(context: EcsContext, entityId: number, state: FlightSimAircraftState): void {
  context.write(entityId, 'Transform', 'x', state.position[0])
  context.write(entityId, 'Transform', 'y', state.position[1])
  context.write(entityId, 'Transform', 'z', state.position[2])
  context.write(entityId, 'Velocity', 'x', state.velocity[0])
  context.write(entityId, 'Velocity', 'y', state.velocity[1])
  context.write(entityId, 'Velocity', 'z', state.velocity[2])
  context.write(entityId, 'Attitude', 'pitch', state.pitch)
  context.write(entityId, 'Attitude', 'roll', state.roll)
  context.write(entityId, 'Attitude', 'yaw', state.yaw)
  context.write(entityId, 'FlightControl', 'throttle', state.throttle)
}

export function createFlightSimMission(args: {
  runId: number
  profile: FlightSimSpatialProfile
  decisions?: readonly unknown[]
  initialCapture?: FlightSimMissionCapture
}): FlightSimMission {
  const runId = boundedRunId(args.runId)
  const profile = args.profile
  if (profile.waypoints.length < 1 || profile.waypoints.length > 255) {
    throw new Error('Flight Sim profile must contain from 1 to 255 waypoints')
  }
  if (args.initialCapture && args.decisions) {
    throw new Error('Flight Sim mission accepts Decisions or an internal capture, not both')
  }
  const replay = args.initialCapture
    ? replayFlightSimCapture(profile, args.initialCapture)
    : replayFlightSimDecisions(profile, args.decisions || [])
  let aircraftEntityId = -1
  let missionEntityId = -1

  const flightSystem = (context: EcsContext, tickInput: FlightSimWorldTickInput) => {
    const phase = context.read(missionEntityId, 'Mission', 'phase')
    if (phase === PHASE_COMPLETED || phase === PHASE_CRASHED) return
    const previousTick = context.read(missionEntityId, 'Mission', 'tick')
    if (previousTick >= FLIGHT_SIM_MAX_MISSION_TICKS) {
      throw new Error('Flight Sim mission exhausted its bounded tick range')
    }
    const tick = previousTick + 1
    if (tick === FLIGHT_SIM_MAX_MISSION_TICKS) {
      context.write(missionEntityId, 'Mission', 'tick', tick)
      context.write(missionEntityId, 'Mission', 'elapsed', tick * FLIGHT_SIM_FIXED_STEP_SECONDS)
      context.write(missionEntityId, 'Mission', 'phase', PHASE_CRASHED)
      context.write(missionEntityId, 'Mission', 'collisionIndex', profile.blockers.length + 1)
      const timedOutState = readAircraft(context, aircraftEntityId)
      context.emitDecision(decision(runId, tick, 'mission_crashed', 'quest_flag', {
        status: 'crashed',
        colliderId: FLIGHT_SIM_TIMEOUT_COLLIDER_ID,
        impactSpeed: Math.hypot(...timedOutState.velocity),
      }))
      emitFlightStateDecision(
        context,
        runId,
        tick,
        timedOutState,
        'crashed',
        context.read(missionEntityId, 'Mission', 'waypointIndex'),
      )
      return
    }
    const input = normalizeFlightSimInput(tickInput.controls)
    const captured = readAircraft(context, aircraftEntityId)
    const previous = tickInput.throttleSetpoint === null
      ? captured
      : freezeFlightSimAircraftState({ ...captured, throttle: tickInput.throttleSetpoint })
    const integrated = integrateFlightModel(previous, input)
    const collision = resolveFlightSimAabbMotion(previous, integrated, profile)
    writeAircraft(context, aircraftEntityId, collision.state)
    context.write(missionEntityId, 'Mission', 'tick', tick)
    context.write(
      missionEntityId,
      'Mission',
      'elapsed',
      tick * FLIGHT_SIM_FIXED_STEP_SECONDS,
    )
    context.write(missionEntityId, 'Mission', 'phase', PHASE_FLYING)

    if (collision.collisionId) {
      const colliderIndex = profile.blockers.findIndex(blocker => blocker.id === collision.collisionId)
      context.write(missionEntityId, 'Mission', 'phase', PHASE_CRASHED)
      context.write(missionEntityId, 'Mission', 'collisionIndex', colliderIndex + 1)
      context.emitDecision(decision(runId, tick, 'mission_crashed', 'quest_flag', {
        status: 'crashed',
        colliderId: collision.collisionId,
        impactSpeed: collision.impactSpeed,
      }))
      emitFlightStateDecision(context, runId, tick, readAircraft(context, aircraftEntityId), 'crashed', context.read(missionEntityId, 'Mission', 'waypointIndex'))
      return
    }

    const waypointIndex = context.read(missionEntityId, 'Mission', 'waypointIndex')
    const waypoint = profile.waypoints[waypointIndex]
    if (!waypoint || !flightSimWaypointReached(collision.state.position, waypoint)) {
      emitFlightStateDecision(context, runId, tick, readAircraft(context, aircraftEntityId), 'flying', waypointIndex)
      return
    }
    const nextWaypointIndex = waypointIndex + 1
    context.write(missionEntityId, 'Mission', 'waypointIndex', nextWaypointIndex)
    context.emitDecision(decision(runId, tick, 'waypoint_reached', 'world_tick_result', {
      waypointId: waypoint.id,
      waypointIndex,
    }))
    if (nextWaypointIndex < profile.waypoints.length) {
      emitFlightStateDecision(context, runId, tick, readAircraft(context, aircraftEntityId), 'flying', nextWaypointIndex)
      return
    }
    context.write(missionEntityId, 'Mission', 'phase', PHASE_COMPLETED)
    context.emitDecision(decision(runId, tick, 'mission_completed', 'quest_flag', {
      status: 'completed',
    }))
    emitFlightStateDecision(context, runId, tick, readAircraft(context, aircraftEntityId), 'completed', nextWaypointIndex)
  }

  const world = createWorld({ systems: [flightSystem] })
  registerComponent(world, 'Transform', { x: 'f32', y: 'f32', z: 'f32' })
  registerComponent(world, 'Velocity', { x: 'f32', y: 'f32', z: 'f32' })
  registerComponent(world, 'Attitude', { pitch: 'f32', roll: 'f32', yaw: 'f32' })
  registerComponent(world, 'FlightControl', { throttle: 'f32' })
  registerComponent(world, 'Aircraft', { active: 'u8' })
  registerComponent(world, 'Mission', {
    phase: 'u8',
    tick: 'u32',
    elapsed: 'f64',
    waypointIndex: 'u8',
    collisionIndex: 'u16',
  })
  aircraftEntityId = allocateEntity(world, {
    entityRef: FLIGHT_SIM_AIRCRAFT_ENTITY_REF,
    components: {
      Transform: {
        x: replay.aircraft.position[0],
        y: replay.aircraft.position[1],
        z: replay.aircraft.position[2],
      },
      Velocity: {
        x: replay.aircraft.velocity[0],
        y: replay.aircraft.velocity[1],
        z: replay.aircraft.velocity[2],
      },
      Attitude: {
        pitch: replay.aircraft.pitch,
        roll: replay.aircraft.roll,
        yaw: replay.aircraft.yaw,
      },
      FlightControl: { throttle: replay.aircraft.throttle },
      Aircraft: { active: 1 },
    },
  })
  missionEntityId = allocateEntity(world, {
    entityRef: FLIGHT_SIM_MISSION_ENTITY_REF,
    components: {
      Mission: {
        phase: replay.phase,
        tick: replay.tick,
        elapsed: replay.tick * FLIGHT_SIM_FIXED_STEP_SECONDS,
        waypointIndex: replay.waypointIndex,
        collisionIndex: replay.collisionIndex,
      },
    },
  })
  return Object.freeze({ world, runId, aircraftEntityId, missionEntityId, profile })
}

export function cloneFlightSimMission(mission: FlightSimMission): FlightSimMission {
  return createFlightSimMission({
    runId: mission.runId,
    profile: mission.profile,
    initialCapture: captureFlightSimMission(mission),
  })
}

function component(entity: RuntimeEntity, name: string): Record<string, number> {
  const value = entity.components[name]
  if (!value) throw new Error(`Flight Sim entity ${entity.entityRef} is missing ${name}`)
  return value
}

export function captureFlightSimMission(mission: FlightSimMission): FlightSimMissionCapture {
  const snapshot = snapshotWorld(mission.world) as { entities: RuntimeEntity[] }
  const byRef = new Map(snapshot.entities.map(entity => [entity.entityRef, entity]))
  const aircraftEntity = byRef.get(FLIGHT_SIM_AIRCRAFT_ENTITY_REF)!
  const missionEntity = byRef.get(FLIGHT_SIM_MISSION_ENTITY_REF)!
  const transform = component(aircraftEntity, 'Transform')
  const velocity = component(aircraftEntity, 'Velocity')
  const attitude = component(aircraftEntity, 'Attitude')
  const control = component(aircraftEntity, 'FlightControl')
  const state = component(missionEntity, 'Mission')
  const waypointIndex = state.waypointIndex
  const collisionIndex = state.collisionIndex - 1
  return Object.freeze({
    phase: phaseName(state.phase),
    aircraft: freezeFlightSimAircraftState({
      position: [transform.x, transform.y, transform.z],
      velocity: [velocity.x, velocity.y, velocity.z],
      pitch: attitude.pitch,
      roll: attitude.roll,
      yaw: attitude.yaw,
      throttle: control.throttle,
    }),
    waypointIndex,
    waypointCount: mission.profile.waypoints.length,
    currentWaypointId: mission.profile.waypoints[waypointIndex]?.id || null,
    tick: state.tick,
    elapsedSeconds: state.elapsed,
    collisionId: collisionIndex === mission.profile.blockers.length
      ? FLIGHT_SIM_TIMEOUT_COLLIDER_ID
      : collisionIndex >= 0 ? mission.profile.blockers[collisionIndex]?.id || null : null,
  })
}

function validateZeroCostLog(value: unknown): FlightSimCostLog {
  const cost = value as Record<string, unknown>
  if (!cost || cost.model !== 'none'
    || cost.prompt_tokens !== 0
    || cost.completion_tokens !== 0
    || cost.cache_hits !== 0
    || cost.estimated_cost_usd !== 0
    || cost.incomplete !== false) {
    throw new Error('Flight Sim World_Tick must produce exactly one canonical zero Cost_Log')
  }
  return FLIGHT_SIM_ZERO_COST_LOG
}

export async function tickFlightSimMission(
  mission: FlightSimMission,
  input: FlightSimTickInput,
  throttleSetpoint: number | null = null,
): Promise<FlightSimMissionTickResult> {
  if (throttleSetpoint !== null
    && (!Number.isFinite(throttleSetpoint) || throttleSetpoint < 0 || throttleSetpoint > 1)) {
    throw new Error('Flight Sim throttle setpoint must be a finite number from 0 to 1')
  }
  const result = await worldTick(mission.world, Object.freeze({
    controls: normalizeFlightSimInput(input),
    throttleSetpoint,
  }))
  if (!result.ok) throw new Error(`Flight Sim World_Tick failed: ${result.errorCode}: ${result.message}`)
  if (result.deferred_decisions.length !== 0 || result.cost_logs.length !== 1) {
    throw new Error('Flight Sim World_Tick must remain deterministic and reasoning-free')
  }
  return Object.freeze({
    capture: captureFlightSimMission(mission),
    decisions: Object.freeze(result.decisions.map((item: FlightSimDecisionRecord) => Object.freeze({
      ...item,
      payload: Object.freeze({ ...item.payload }),
    }))),
    costLog: validateZeroCostLog(result.cost_logs[0]),
  })
}
