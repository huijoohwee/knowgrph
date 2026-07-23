import assert from 'node:assert/strict'
import test from 'node:test'
import { readWebglSupport } from '../lib/three/webglSupport'
import {
  armFlightSimReadyFrame,
  beginFlightSimHudUpdate,
  beginFlightSimReadyFrame,
  completeFlightSimHudUpdate,
  completeFlightSimReadyFrame,
  FLIGHT_SIM_GAMEPLAY_NETWORK_BLOCK_LIMIT_MS,
  FLIGHT_SIM_HUD_UPDATE_LIMIT_MS,
  FLIGHT_SIM_READY_FRAME_LIMIT_MS,
  FLIGHT_SIM_WEBGL_ADMISSION_LIMIT_MS,
  measureFlightSimGameplayNetworkBlock,
  measureFlightSimWebglAdmission,
  readFlightSimDeadlineSnapshot,
  resetFlightSimDeadlineRuntimeForTests,
} from '../features/game-flight-sim/flightSimDeadlineRuntime'
import {
  createFlightSimRuntime,
} from '../features/game-flight-sim/flightSimRuntime'
import {
  FLIGHT_SIM_MIN_CAPTURE_RADIUS_METERS,
  type FlightSimSnapshot,
  type FlightSimSpatialProfile,
} from '../features/game-flight-sim/flightSimModel'

function profile(): FlightSimSpatialProfile {
  const radiusMeters = FLIGHT_SIM_MIN_CAPTURE_RADIUS_METERS
  return Object.freeze({
    id: 'flight-sim:deadline-test',
    sourceKey: 'authored:deadline-test',
    aircraftHalfSize: Object.freeze([0.5, 0.5, 0.5] as const),
    spawn: Object.freeze({
      position: Object.freeze([0, 20, 0] as const),
      velocity: Object.freeze([0, 0, -10] as const),
      pitch: 0,
      roll: 0,
      yaw: 0,
      throttle: 0.6,
    }),
    blockers: Object.freeze([]),
    waypoints: Object.freeze([
      Object.freeze({ id: 'waypoint-1', position: Object.freeze([0, 20, -200] as const), radiusMeters }),
      Object.freeze({ id: 'waypoint-2', position: Object.freeze([0, 20, -400] as const), radiusMeters }),
      Object.freeze({ id: 'waypoint-3', position: Object.freeze([0, 20, -600] as const), radiusMeters }),
    ]),
    landingPad: Object.freeze({
      id: 'landing-pad',
      position: Object.freeze([0, 0, -800] as const),
      radiusMeters,
    }),
  })
}

function missionState(snapshot: FlightSimSnapshot) {
  const { revision: _revision, runtimeError: _runtimeError, ...state } = snapshot
  return state
}

test('actual WebGL probe is synchronous and a probe over 100 ms fails closed', () => {
  resetFlightSimDeadlineRuntimeForTests()
  let contextReleased = false
  const documentValue = {
    createElement: () => ({
      getContext: (kind: string) => kind === 'webgl2'
        ? {
            getExtension: () => ({
              loseContext: () => {
                contextReleased = true
              },
            }),
          }
        : null,
    }),
  } as unknown as Document
  const onTimeClock = [10, 10 + FLIGHT_SIM_WEBGL_ADMISSION_LIMIT_MS]
  const onTime = measureFlightSimWebglAdmission(
    () => readWebglSupport(documentValue),
    () => onTimeClock.shift()!,
  )
  assert.equal(onTime.available, true)
  assert.equal(onTime.observation.synchronous, true)
  assert.equal(onTime.observation.withinLimit, true)
  assert.equal(contextReleased, true)

  const lateClock = [20, 20 + FLIGHT_SIM_WEBGL_ADMISSION_LIMIT_MS + 0.001]
  const late = measureFlightSimWebglAdmission(
    () => readWebglSupport(documentValue),
    () => lateClock.shift()!,
  )
  assert.equal(late.observation.available, true)
  assert.equal(late.observation.withinLimit, false)
  assert.equal(late.available, false, 'an available but late probe must fail admission closed')
})

test('ready-frame and HUD deadlines record asynchronous presentation semantics', () => {
  resetFlightSimDeadlineRuntimeForTests()
  const readyRequest = beginFlightSimReadyFrame(() => 30)
  armFlightSimReadyFrame(readyRequest, 4, 0)
  const ready = completeFlightSimReadyFrame(
    4,
    0,
    () => 30 + FLIGHT_SIM_READY_FRAME_LIMIT_MS,
  )
  assert.equal(ready?.withinLimit, true)
  assert.equal(ready?.synchronous, false)
  assert.equal(ready?.source, 'shared-r3f-ready-frame')

  const lateReadyRequest = beginFlightSimReadyFrame(() => 40)
  armFlightSimReadyFrame(lateReadyRequest, 5, 0)
  const lateReady = completeFlightSimReadyFrame(
    5,
    0,
    () => 40 + FLIGHT_SIM_READY_FRAME_LIMIT_MS + 0.001,
  )
  assert.equal(lateReady?.withinLimit, false)

  beginFlightSimHudUpdate(7, () => 50)
  const hud = completeFlightSimHudUpdate(
    7,
    () => 50 + FLIGHT_SIM_HUD_UPDATE_LIMIT_MS,
  )
  assert.equal(hud?.withinLimit, true)
  assert.equal(hud?.synchronous, false)
  assert.equal(hud?.revision, 7)

  beginFlightSimHudUpdate(8, () => 80)
  const lateHud = completeFlightSimHudUpdate(
    8,
    () => 80 + FLIGHT_SIM_HUD_UPDATE_LIMIT_MS + 0.001,
  )
  assert.equal(lateHud?.withinLimit, false)
})

test('production runtime blocks a gameplay network attempt within 1 s and retains mission state', () => {
  resetFlightSimDeadlineRuntimeForTests()
  const runtime = createFlightSimRuntime({ profile: profile() })
  const before = runtime.start()
  let executorInvoked = false
  const rejected = runtime.rejectGameplayNetworkAttempt(
    'fetch:unit-deadline-proof',
    () => {
      executorInvoked = true
    },
  )
  const observation = readFlightSimDeadlineSnapshot().gameplayNetworkBlock
  assert.equal(executorInvoked, false)
  assert.deepEqual(missionState(rejected), missionState(before))
  assert.match(rejected.runtimeError || '', /fetch:unit-deadline-proof/)
  assert.equal(observation?.operation, 'fetch:unit-deadline-proof')
  assert.equal(observation?.synchronous, true)
  assert.equal(observation?.withinLimit, true)
  assert.ok((observation?.elapsedMs ?? Infinity) <= FLIGHT_SIM_GAMEPLAY_NETWORK_BLOCK_LIMIT_MS)
  runtime.exit()
})

test('gameplay network deadline marks a block over 1 s as a hard failure', () => {
  resetFlightSimDeadlineRuntimeForTests()
  const expectedError = new Error('synthetic blocked operation')
  const lateClock = [90, 90 + FLIGHT_SIM_GAMEPLAY_NETWORK_BLOCK_LIMIT_MS + 0.001]
  assert.throws(
    () => measureFlightSimGameplayNetworkBlock(
      'fetch:late-deadline-proof',
      () => {
        throw expectedError
      },
      () => lateClock.shift()!,
    ),
    error => error === expectedError,
  )
  const observation = readFlightSimDeadlineSnapshot().gameplayNetworkBlock
  assert.equal(observation?.operation, 'fetch:late-deadline-proof')
  assert.equal(observation?.withinLimit, false)
})
