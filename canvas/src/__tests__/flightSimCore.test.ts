import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import {
  FLIGHT_SIM_AIRCRAFT_ASSET_SPEC,
  FLIGHT_SIM_OPAQUE_BINARY_FALLBACK_COUNT,
  readFlightSimAircraftAssetSpec,
} from '../features/game-flight-sim/assetSpec/flightSimAssetSpec'
import {
  captureFlightSimMission,
  createFlightSimMission,
  tickFlightSimMission,
} from '../features/game-flight-sim/flightSimMission'
import { validateFlightSimMissionDecisions } from '../features/game-flight-sim/flightSimDecisionAdmission'
import {
  FLIGHT_SIM_MISSION_ENTITY_REF,
  FLIGHT_SIM_MISSION_ID,
  FLIGHT_SIM_FIXED_STEP_SECONDS,
  FLIGHT_SIM_MAX_MISSION_TICKS,
  FLIGHT_SIM_NEUTRAL_INPUT,
  FLIGHT_SIM_TIMEOUT_COLLIDER_ID,
  FLIGHT_SIM_ZERO_COST_LOG,
  flightSimDecisionId,
  flightSimDecisionProducedAt,
  type FlightSimSnapshot,
  type FlightSimSpatialProfile,
} from '../features/game-flight-sim/flightSimModel'
import { resolveFlightSimFollowTarget } from '../features/game-flight-sim/flightSimFollowTarget'
import {
  flightSimHeadingDegrees,
  integrateFlightModel,
} from '../features/game-flight-sim/flightModel'
import {
  flightSimInputFromHeldTouches,
  flightSimInputFromPressedCodes,
  flightSimInputFromStandardGamepad,
  installFlightSimDesktopInput,
  mergeFlightSimInputs,
  releaseFlightSimHeldTouch,
} from '../features/game-flight-sim/flightSimInput'
import { flightSimInputFromMotionController } from '../features/game-flight-sim/flightSimMotionControlAdapter'
import {
  readFlightSimXrSpatialProfile,
  resolveFlightSimAabbMotion,
} from '../features/game-flight-sim/flightSimSpatialProfile'
import {
  claimThreeViewportInputOwnership,
  readThreeViewportInputOwnership,
  releaseThreeViewportInputOwnership,
  shouldDeferThreeCameraProgrammaticInput,
} from '../features/three/threeViewportInputOwnership'

function profile(): FlightSimSpatialProfile {
  return Object.freeze({
    id: 'flight-sim:test',
    sourceKey: 'authored:test',
    aircraftHalfSize: Object.freeze([0.5, 0.5, 0.5] as const),
    spawn: Object.freeze({
      position: Object.freeze([0, 8, 4] as const),
      velocity: Object.freeze([0, 0, -10] as const),
      pitch: 0,
      roll: 0,
      yaw: 0,
      throttle: 0.6,
    }),
    blockers: Object.freeze([
      Object.freeze({
        id: 'ground',
        center: Object.freeze([0, -0.5, 0] as const),
        halfSize: Object.freeze([20, 0.5, 20] as const),
      }),
    ]),
    waypoints: Object.freeze([
      Object.freeze({
        id: 'waypoint-1',
        position: Object.freeze([0, 8, -12] as const),
        radiusMeters: 1,
      }),
    ]),
  })
}

function waypointDecision(tick: number, waypointIndex: number, waypointId: string) {
  return {
    decisionId: flightSimDecisionId(1, tick, 'waypoint_reached', waypointId),
    decisionType: 'world_tick_result',
    entityRef: waypointId,
    payload: {
      event: 'waypoint_reached',
      missionId: FLIGHT_SIM_MISSION_ID,
      runId: 1,
      tick,
      waypointId,
      waypointIndex,
    },
    producedAt: flightSimDecisionProducedAt(tick, 'waypoint_reached'),
  }
}

function completedStateDecision(
  spatial: FlightSimSpatialProfile,
  tick: number,
  waypointIndex: number,
) {
  return {
    decisionId: flightSimDecisionId(1, tick, 'flight_state', 'mission'),
    decisionType: 'world_tick_result',
    entityRef: FLIGHT_SIM_MISSION_ENTITY_REF,
    payload: {
      event: 'flight_state',
      missionId: FLIGHT_SIM_MISSION_ID,
      runId: 1,
      tick,
      position: spatial.spawn.position,
      velocity: spatial.spawn.velocity,
      pitch: spatial.spawn.pitch,
      roll: spatial.spawn.roll,
      yaw: spatial.spawn.yaw,
      throttle: spatial.spawn.throttle,
      waypointIndex,
      phase: 'completed',
    },
    producedAt: flightSimDecisionProducedAt(tick, 'flight_state'),
  }
}

function completedDecision(tick: number) {
  return {
    decisionId: flightSimDecisionId(1, tick, 'mission_completed', 'mission'),
    decisionType: 'quest_flag',
    entityRef: FLIGHT_SIM_MISSION_ENTITY_REF,
    payload: {
      event: 'mission_completed',
      missionId: FLIGHT_SIM_MISSION_ID,
      runId: 1,
      tick,
      status: 'completed',
    },
    producedAt: flightSimDecisionProducedAt(tick, 'mission_completed'),
  }
}

test('source-authored aircraft JSON is validated as the local spec-primary asset', () => {
  assert.equal(FLIGHT_SIM_AIRCRAFT_ASSET_SPEC.id, 'vehicle-airplane')
  assert.equal(FLIGHT_SIM_AIRCRAFT_ASSET_SPEC.representation, 'typescript-json')
  assert.equal(FLIGHT_SIM_AIRCRAFT_ASSET_SPEC.runtimeModelCalls, 0)
  assert.equal(FLIGHT_SIM_AIRCRAFT_ASSET_SPEC.runtimeNetworkCalls, 0)
  assert.equal(FLIGHT_SIM_OPAQUE_BINARY_FALLBACK_COUNT, 0)
  assert.throws(
    () => readFlightSimAircraftAssetSpec({
      ...FLIGHT_SIM_AIRCRAFT_ASSET_SPEC,
      opaqueBinaryFallback: '/remote/airplane.glb',
    }),
    /no opaque binary fallback/,
  )
})

test('Flight supplies a pure scaled follow target to the shared controller camera', () => {
  const snapshot: FlightSimSnapshot = Object.freeze({
    active: true,
    surfaceMode: 'xr',
    webglSupported: true,
    phase: 'flying',
    runId: 7,
    aircraft: Object.freeze({
      position: Object.freeze([1, 2, 3] as const),
      velocity: Object.freeze([0, 0, -10] as const),
      pitch: 0,
      roll: 0,
      yaw: 0,
      throttle: 0.6,
    }),
    waypointIndex: 0,
    waypointCount: 1,
    currentWaypointId: 'waypoint-1',
    tick: 42,
    elapsedSeconds: 0.7,
    collisionId: null,
    pendingDecisions: Object.freeze([]),
    lastCostLog: FLIGHT_SIM_ZERO_COST_LOG,
    runtimeError: null,
    revision: 1,
  })
  assert.deepEqual(resolveFlightSimFollowTarget(snapshot, 2), {
    position: [2, 12, 22],
    target: [2, 5.6, 6],
    fovDegrees: 58,
    resetKey: 7,
    sequence: 42,
  })
})

test('keyboard and standard gamepad controls normalize into one immutable bounded input', () => {
  const keyboard = flightSimInputFromPressedCodes(new Set(['KeyW', 'KeyA', 'KeyE', 'ShiftLeft']))
  const gamepad = flightSimInputFromStandardGamepad({
    connected: true,
    mapping: 'standard',
    axes: [0.5, -0.4],
    buttons: Array.from({ length: 8 }, (_, index) => ({ value: index === 6 ? 0.25 : 0 })),
  })
  const merged = mergeFlightSimInputs([keyboard, gamepad])
  assert.equal(Object.isFrozen(merged), true)
  assert.equal(merged.pitch, 1)
  assert.ok(merged.roll < 0)
  assert.equal(merged.yaw, -1)
  assert.ok(merged.throttleDelta > 0)
  assert.equal(flightSimInputFromStandardGamepad(null), FLIGHT_SIM_NEUTRAL_INPUT)
})

test('left and right yaw controls turn toward their labelled world directions', () => {
  const northbound = profile().spawn
  const keyboardLeft = integrateFlightModel(
    northbound,
    flightSimInputFromPressedCodes(new Set(['KeyQ'])),
  )
  const keyboardRight = integrateFlightModel(
    northbound,
    flightSimInputFromPressedCodes(new Set(['KeyE'])),
  )
  assert.ok(keyboardLeft.velocity[0] < 0)
  assert.ok(flightSimHeadingDegrees(keyboardLeft.yaw) > 180)
  assert.ok(keyboardRight.velocity[0] > 0)
  assert.ok(flightSimHeadingDegrees(keyboardRight.yaw) < 180)
  assert.equal(
    flightSimInputFromStandardGamepad({
      connected: true,
      mapping: 'standard',
      axes: [],
      buttons: Array.from({ length: 8 }, (_, index) => ({
        value: index === 4 ? 1 : 0,
      })),
    }).yaw,
    1,
  )
  assert.equal(flightSimInputFromMotionController({
    moveX: 1,
    moveZ: 0,
    primary: false,
    modifier: true,
    source: 'motion',
  }, true).yaw, -1)
  assert.equal(flightSimInputFromMotionController({
    moveX: -1,
    moveZ: 0,
    primary: false,
    modifier: true,
    source: 'motion',
  }, true).yaw, 1)
  const bankedRight = integrateFlightModel(
    { ...northbound, roll: 0.5 },
    FLIGHT_SIM_NEUTRAL_INPUT,
  )
  assert.ok(bankedRight.velocity[0] > 0)
})

test('releasing one touch pointer preserves every other held flight control', () => {
  const held = new Map([
    [11, 'pitch-up' as const],
    [22, 'roll-right' as const],
  ])
  releaseFlightSimHeldTouch(held, { pointerId: 11 })
  assert.deepEqual([...held], [[22, 'roll-right']])
  assert.deepEqual(flightSimInputFromHeldTouches(held), {
    pitch: 0,
    roll: 1,
    yaw: 0,
    throttleDelta: 0,
  })
  releaseFlightSimHeldTouch(held)
  assert.equal(held.size, 0)
})

test('mounted desktop input clears held controls and pauses on global blur', () => {
  const dom = new JSDOM('<!doctype html><html><body><canvas></canvas></body></html>', {
    url: 'http://localhost',
  })
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
  }
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
  })
  try {
    const inputs = []
    const pauses = []
    const canvas = dom.window.document.querySelector('canvas')!
    const binding = installFlightSimDesktopInput(canvas, {
      onInput: input => inputs.push(input),
      onPause: reason => pauses.push(reason),
    })
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'KeyW' }))
    assert.equal(inputs.at(-1)?.pitch, 1)
    dom.window.dispatchEvent(new dom.window.Event('blur'))
    assert.deepEqual(inputs.at(-1), FLIGHT_SIM_NEUTRAL_INPUT)
    assert.deepEqual(binding.consumeInput(), FLIGHT_SIM_NEUTRAL_INPUT)
    assert.match(pauses.at(-1) || '', /window lost focus/)
    binding.dispose()
  } finally {
    Object.assign(globalThis, previous)
    dom.window.close()
  }
})

test('Flight controls retain input ownership without vetoing programmatic camera choreography', () => {
  const ownerId = 'flight-sim:test-aircraft'
  assert.equal(claimThreeViewportInputOwnership(ownerId, {
    blocksProgrammaticCamera: false,
  }), true)
  try {
    const ownership = readThreeViewportInputOwnership()
    assert.equal(ownership.ownerId, ownerId)
    assert.equal(ownership.blocksProgrammaticCamera, false)
    assert.equal(shouldDeferThreeCameraProgrammaticInput({
      objectInputActive: false,
      viewportInputBlocksProgrammaticCamera: ownership.blocksProgrammaticCamera,
    }), false)
  } finally {
    releaseThreeViewportInputOwnership(ownerId)
  }
})

test('native swept AABB resolution stops before a thin authored slab', () => {
  const spatial = profile()
  const previous = spatial.spawn
  const proposed = Object.freeze({
    ...previous,
    position: Object.freeze([0, 8, -8] as const),
    velocity: Object.freeze([0, 0, -30] as const),
  })
  const collision = resolveFlightSimAabbMotion(previous, proposed, {
    aircraftHalfSize: spatial.aircraftHalfSize,
    blockers: [
      {
        id: 'thin-wall',
        center: [0, 8, 0],
        halfSize: [5, 5, 0.05],
      },
    ],
  })
  assert.equal(collision.collisionId, 'thin-wall')
  assert.ok(collision.state.position[2] > 0.5)
  assert.equal(collision.state.velocity[2], 0)
})

test('native AABB resolution ejects a schema-valid hydrated overlap', () => {
  const spatial = profile()
  const overlapping = Object.freeze({
    ...spatial.spawn,
    position: Object.freeze([0, 8, 0] as const),
  })
  const blocker = {
    id: 'hydrated-wall',
    center: [0, 8, 0] as const,
    halfSize: [5, 5, 0.05] as const,
  }
  const collision = resolveFlightSimAabbMotion(overlapping, overlapping, {
    aircraftHalfSize: spatial.aircraftHalfSize,
    blockers: [blocker],
  })
  assert.equal(collision.collisionId, blocker.id)
  assert.equal(resolveFlightSimAabbMotion(
    collision.state,
    collision.state,
    { aircraftHalfSize: spatial.aircraftHalfSize, blockers: [blocker] },
  ).collisionId, null)
})

test('canonical Flight profile fences every horizontal edge and the flight ceiling', () => {
  const blockerIds = new Set(readFlightSimXrSpatialProfile().blockers.map(blocker => blocker.id))
  for (const id of [
    'flight-sim:boundary-west',
    'flight-sim:boundary-east',
    'flight-sim:boundary-north',
    'flight-sim:boundary-south',
    'flight-sim:boundary-ceiling',
    'flight-sim:terrain-ground',
  ]) {
    assert.equal(blockerIds.has(id), true, `missing bounded Flight collider ${id}`)
  }
})

test('bounded mission terminates at its maximum tick with replayable timeout Decisions', async () => {
  const spatial = profile()
  const mission = createFlightSimMission({
    runId: 1,
    profile: spatial,
    initialCapture: {
      phase: 'flying',
      aircraft: spatial.spawn,
      waypointIndex: 0,
      waypointCount: spatial.waypoints.length,
      currentWaypointId: spatial.waypoints[0].id,
      tick: FLIGHT_SIM_MAX_MISSION_TICKS - 1,
      elapsedSeconds: (FLIGHT_SIM_MAX_MISSION_TICKS - 1) * FLIGHT_SIM_FIXED_STEP_SECONDS,
      collisionId: null,
    },
  })
  const terminal = await tickFlightSimMission(mission, FLIGHT_SIM_NEUTRAL_INPUT)
  assert.equal(terminal.capture.phase, 'crashed')
  assert.equal(terminal.capture.tick, FLIGHT_SIM_MAX_MISSION_TICKS)
  assert.equal(terminal.capture.collisionId, FLIGHT_SIM_TIMEOUT_COLLIDER_ID)
  assert.deepEqual(
    terminal.decisions.map(item => item.payload.event).sort(),
    ['flight_state', 'mission_crashed'],
  )
  const replay = createFlightSimMission({
    runId: 2,
    profile: spatial,
    decisions: terminal.decisions,
  })
  assert.deepEqual(captureFlightSimMission(replay), terminal.capture)
})

test('a canonical-looking completion cannot omit its waypoint and terminal state history', () => {
  assert.throws(() => validateFlightSimMissionDecisions(profile(), [{
    decisionId: 'flight-sim:run-1:tick-1:mission_completed:mission',
    decisionType: 'quest_flag',
    entityRef: 'flight-sim:mission:flight-sim-mission-1',
    payload: {
      event: 'mission_completed',
      missionId: 'flight-sim-mission-1',
      runId: 1,
      tick: 1,
      status: 'completed',
    },
    producedAt: '2026-01-01T00:00:00.022Z',
  }]), /terminal flight state|full waypoint history/)
})

test('Decision admission rejects fabricated waypoint chronology and progress', () => {
  const spatial = profile()
  const waypoint = spatial.waypoints[0]
  assert.throws(
    () => validateFlightSimMissionDecisions(spatial, [waypointDecision(10, 0, waypoint.id)]),
    /following flight state/,
  )
  assert.throws(
    () => validateFlightSimMissionDecisions(spatial, [
      waypointDecision(10, 0, waypoint.id),
      completedStateDecision(spatial, 11, 1),
      completedDecision(11),
    ]),
    /share its tick/,
  )

  const route = Object.freeze({
    ...spatial,
    waypoints: Object.freeze([0, 1, 2].map(index => Object.freeze({
      ...waypoint,
      id: `waypoint-${index + 1}`,
    }))),
  })
  assert.throws(
    () => validateFlightSimMissionDecisions(route, [
      waypointDecision(20, 0, route.waypoints[0].id),
      waypointDecision(10, 1, route.waypoints[1].id),
      waypointDecision(30, 2, route.waypoints[2].id),
      completedStateDecision(route, 30, 3),
      completedDecision(30),
    ]),
    /complete and ordered/,
  )
})

test('native ECS replay is deterministic, model-free, and reconstructs state from Decisions', async () => {
  const run = async () => {
    const mission = createFlightSimMission({ runId: 1, profile: profile() })
    const decisions = []
    let result
    for (let tick = 0; tick < 12; tick += 1) {
      result = await tickFlightSimMission(mission, {
        pitch: tick < 5 ? 0.3 : 0,
        roll: tick < 7 ? -0.2 : 0,
        yaw: 0.1,
        throttleDelta: 0.25,
      })
      decisions.push(...result.decisions)
      assert.deepEqual(result.costLog, FLIGHT_SIM_ZERO_COST_LOG)
    }
    return { capture: captureFlightSimMission(mission), decisions }
  }
  const first = await run()
  const second = await run()
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  assert.equal(first.decisions.filter(item => item.payload.event === 'flight_state').length, 12)

  const hydrated = createFlightSimMission({
    runId: 2,
    profile: profile(),
    decisions: first.decisions,
  })
  assert.deepEqual(captureFlightSimMission(hydrated), first.capture)
})
