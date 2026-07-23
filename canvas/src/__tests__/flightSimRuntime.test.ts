import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createFlightSimRuntime,
} from '../features/game-flight-sim/flightSimRuntime'
import {
  FLIGHT_SIM_FIXED_STEP_SECONDS,
  FLIGHT_SIM_MAX_CATCH_UP_TICKS,
  FLIGHT_SIM_MIN_CAPTURE_RADIUS_METERS,
  type FlightSimSpatialProfile,
} from '../features/game-flight-sim/flightSimModel'
import { createFlightSimSimulationClock } from '../features/game-flight-sim/flightSimSimulationClock'
import {
  createFlightSimMission,
  tickFlightSimMission,
  type FlightSimMissionTickResult,
} from '../features/game-flight-sim/flightSimMission'

function profile(): FlightSimSpatialProfile {
  return Object.freeze({
    id: 'flight-sim:runtime-test',
    sourceKey: 'authored:runtime-test',
    aircraftHalfSize: Object.freeze([0.4, 0.4, 0.4] as const),
    spawn: Object.freeze({
      position: Object.freeze([0, 10, 5] as const),
      velocity: Object.freeze([0, 0, -8] as const),
      pitch: 0,
      roll: 0,
      yaw: 0,
      throttle: 0.55,
    }),
    blockers: Object.freeze([
      Object.freeze({
        id: 'ground',
        center: Object.freeze([0, -0.5, 0] as const),
        halfSize: Object.freeze([30, 0.5, 30] as const),
      }),
    ]),
    waypoints: Object.freeze([
      Object.freeze({
        id: 'route-1',
        position: Object.freeze([0, 10, -200] as const),
        radiusMeters: FLIGHT_SIM_MIN_CAPTURE_RADIUS_METERS,
      }),
      Object.freeze({
        id: 'route-2',
        position: Object.freeze([0, 10, -400] as const),
        radiusMeters: FLIGHT_SIM_MIN_CAPTURE_RADIUS_METERS,
      }),
      Object.freeze({
        id: 'route-3',
        position: Object.freeze([0, 10, -600] as const),
        radiusMeters: FLIGHT_SIM_MIN_CAPTURE_RADIUS_METERS,
      }),
    ]),
    landingPad: Object.freeze({
      id: 'landing-pad',
      position: Object.freeze([0, 0, -800] as const),
      radiusMeters: FLIGHT_SIM_MIN_CAPTURE_RADIUS_METERS,
    }),
  })
}

function terminalProfile(): FlightSimSpatialProfile {
  const spatial = profile()
  const objectivePoint = (id: string) => Object.freeze({
    id,
    position: spatial.spawn.position,
    radiusMeters: FLIGHT_SIM_MIN_CAPTURE_RADIUS_METERS,
  })
  return Object.freeze({
    ...spatial,
    waypoints: Object.freeze([
      objectivePoint('spawn-waypoint-1'),
      objectivePoint('spawn-waypoint-2'),
      objectivePoint('spawn-waypoint-3'),
    ]),
    landingPad: objectivePoint('spawn-landing-pad'),
  })
}

test('serialized advances capture immutable input at enqueue time', async () => {
  const runtime = createFlightSimRuntime({ profile: profile() })
  runtime.start()
  runtime.setInput({ roll: 1 })
  const firstAdvance = runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS)
  runtime.setInput({ roll: -1 })
  const first = await firstAdvance
  assert.ok(first.aircraft.roll > 0)

  const second = await runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS)
  assert.ok(second.aircraft.roll < first.aircraft.roll)
  assert.equal(second.tick, 2)
})

test('queued device input resolves each axis to its largest absolute command', async () => {
  const runtime = createFlightSimRuntime({ profile: profile() })
  runtime.start()
  runtime.setInput({ roll: 0.35, yaw: -0.8 })
  runtime.queueInput({ roll: -0.75, yaw: 0.3 })
  const advanced = await runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS)
  assert.ok(advanced.aircraft.roll < 0)
  assert.ok(advanced.aircraft.yaw < 0)
})

test('one advance executes no more than five fixed catch-up ticks', async () => {
  const runtime = createFlightSimRuntime({ profile: profile() })
  runtime.start()
  runtime.setInput({ pitch: 0.1 })
  const first = await runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS * 20)
  assert.equal(first.tick, FLIGHT_SIM_MAX_CATCH_UP_TICKS)
  const second = await runtime.advanceBy(0)
  assert.equal(second.tick, FLIGHT_SIM_MAX_CATCH_UP_TICKS * 2)
})

test('Stop then Start retains exact state while Restart creates a fresh run', async () => {
  const runtime = createFlightSimRuntime({ profile: profile() })
  const ready = runtime.start()
  runtime.setInput({ pitch: 0.4 })
  const flying = await runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS * 3)
  const stopped = runtime.stop()
  assert.equal(stopped.phase, 'stopped')
  assert.equal(stopped.tick, flying.tick)
  assert.deepEqual(stopped.aircraft, flying.aircraft)

  const resumed = runtime.start()
  assert.equal(resumed.tick, flying.tick)
  assert.deepEqual(resumed.aircraft, flying.aircraft)
  assert.equal(resumed.runId, ready.runId)

  const restarted = runtime.restart()
  assert.equal(restarted.phase, 'ready')
  assert.equal(restarted.tick, 0)
  assert.equal(restarted.runId, ready.runId + 1)
  assert.deepEqual(restarted.aircraft, ready.aircraft)
})

test('Stop fences an underway ECS tick without changing the acknowledged state', async () => {
  const runtime = createFlightSimRuntime({ profile: profile() })
  runtime.start()
  runtime.setInput({ pitch: 0.4 })
  const advancing = runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS)
  await Promise.resolve()
  const stopped = runtime.stop()
  const settled = await advancing

  assert.equal(stopped.phase, 'stopped')
  assert.equal(stopped.tick, 0)
  assert.deepEqual(settled, stopped)
  assert.deepEqual(runtime.read(), stopped)

  runtime.start()
  const resumedTick = await runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS)
  assert.equal(resumedTick.tick, 1)
})

test('absolute throttle is projected immediately and committed by the next ECS tick', async () => {
  const runtime = createFlightSimRuntime({ profile: profile() })
  runtime.start()
  const commanded = runtime.setThrottle(0.8)
  assert.equal(commanded.aircraft.throttle, 0.8)
  const stopped = runtime.stop()
  assert.equal(stopped.aircraft.throttle, 0.8)
  const resumed = runtime.start()
  assert.equal(resumed.aircraft.throttle, 0.8)
  const committed = await runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS)
  assert.equal(committed.aircraft.throttle, Math.fround(0.8))
})

test('throttle cannot mutate a terminal aircraft after its Decisions are captured', async () => {
  const spatial = terminalProfile()
  const runtime = createFlightSimRuntime({ profile: spatial })
  runtime.start()
  runtime.setInput({ pitch: 0.1 })
  const terminal = await runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS * 4)
  assert.equal(terminal.phase, 'completed')
  assert.equal(terminal.waypointIndex, 3)
  assert.equal(
    terminal.pendingDecisions.find(item => item.payload.event === 'mission_completed')
      ?.payload.landingPadId,
    spatial.landingPad.id,
  )
  const rejected = runtime.setThrottle(0.1)
  assert.deepEqual(rejected.aircraft, terminal.aircraft)
  assert.deepEqual(rejected.pendingDecisions, terminal.pendingDecisions)
  assert.match(rejected.runtimeError || '', /ready or flying/)
})

test('pending Decisions retain one latest flight state per run and Restart drops an unfinished run', async () => {
  const runtime = createFlightSimRuntime({ profile: profile() })
  runtime.start()
  runtime.setInput({ pitch: 0.1 })
  for (let index = 0; index < 24; index += 1) {
    await runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS)
  }
  const active = runtime.read()
  assert.equal(active.phase, 'flying')
  assert.equal(active.pendingDecisions.length, 1)
  assert.equal(active.pendingDecisions[0].payload.event, 'flight_state')
  assert.equal(active.pendingDecisions[0].payload.tick, active.tick)
  const restarted = runtime.restart()
  assert.equal(restarted.pendingDecisions.length, 0)
  assert.equal(restarted.runId, active.runId + 1)
})

test('hydrated terminal Decisions preserve the terminal mission phase', async () => {
  const spatial = terminalProfile()
  const mission = createFlightSimMission({ runId: 1, profile: spatial })
  const decisions = []
  let terminal: FlightSimMissionTickResult | null = null
  for (let tick = 0; tick < 4; tick += 1) {
    terminal = await tickFlightSimMission(mission, {
      pitch: 0,
      roll: 0,
      yaw: 0,
      throttleDelta: 0,
    })
    decisions.push(...terminal.decisions)
  }
  assert.ok(terminal)
  assert.equal(terminal.capture.phase, 'completed')

  const runtime = createFlightSimRuntime({ profile: spatial })
  runtime.hydrate(decisions)
  const hydrated = runtime.start()
  assert.equal(hydrated.phase, 'completed')
  assert.equal(hydrated.tick, terminal.capture.tick)
  assert.deepEqual(hydrated.aircraft, terminal.capture.aircraft)
})

test('Exit discards the ECS World, pending state, and retained mission progress', async () => {
  const runtime = createFlightSimRuntime({ profile: profile() })
  runtime.start()
  runtime.setInput({ pitch: 0.4 })
  const flying = await runtime.advanceBy(FLIGHT_SIM_FIXED_STEP_SECONDS * 3)
  assert.equal(flying.tick, 3)
  assert.ok(flying.pendingDecisions.length > 0)

  const exited = runtime.exit()
  assert.equal(exited.active, false)
  assert.equal(exited.phase, 'stopped')
  assert.equal(exited.runId, 0)
  assert.equal(exited.tick, 0)
  assert.deepEqual(exited.aircraft, profile().spawn)
  assert.deepEqual(exited.pendingDecisions, [])

  runtime.open(true)
  const restarted = runtime.start()
  assert.equal(restarted.runId, 1)
  assert.equal(restarted.tick, 0)
  assert.deepEqual(restarted.aircraft.position, profile().spawn.position)
  assert.deepEqual(restarted.aircraft.velocity, profile().spawn.velocity)
  assert.equal(restarted.aircraft.throttle, Math.fround(profile().spawn.throttle))
})

test('fixed queued clock coalesces backpressure and disposal fences late requests', async () => {
  let release!: () => void
  const blocked = new Promise<void>(resolve => {
    release = resolve
  })
  let steps = 0
  const clock = createFlightSimSimulationClock({
    minimumStepIntervalMs: 0,
    runStep: async () => {
      steps += 1
      if (steps === 1) await blocked
    },
    onStepError: error => assert.fail(String(error)),
  })
  clock.requestStep()
  await Promise.resolve()
  clock.requestStep()
  clock.requestStep()
  assert.equal(steps, 1)
  release()
  for (let index = 0; index < 5; index += 1) await Promise.resolve()
  assert.equal(steps, 2)
  clock.dispose()
  clock.requestStep()
  for (let index = 0; index < 3; index += 1) await Promise.resolve()
  assert.equal(steps, 2)
})
