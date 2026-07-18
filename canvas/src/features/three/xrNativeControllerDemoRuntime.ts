import {
  readXrPhysicsStaticColliders,
  readXrPhysicsWorld,
  type XrPhysicsBodyConfig,
  type XrPhysicsStaticCollider,
  type XrPhysicsVector,
  type XrPhysicsWorldConfig,
} from './xrPhysicsModel'
import {
  applyXrPhysicsSimulationImpulse,
  captureXrPhysicsSimulation,
  createXrPhysicsSimulation,
  readXrPhysicsSimulationBody,
  resetXrPhysicsSimulation,
  stepXrPhysicsSimulation,
  type XrPhysicsBodyState,
  type XrPhysicsSimulation,
} from './xrPhysicsStepper'
import {
  createXrNativeControllerInput,
  type XrNativeControllerInput,
} from './xrNativeControllerInput'

export const XR_NATIVE_CONTROLLER_DEMO_SCHEMA = 'knowgrph-xr-native-controller-demo/v1'
export const XR_NATIVE_CONTROLLER_DEMO_PLAYER_ID = 'native-controller'
export const XR_NATIVE_CONTROLLER_DEMO_MODES = ['ball', 'rocket'] as const

export type XrNativeControllerDemoMode = (typeof XR_NATIVE_CONTROLLER_DEMO_MODES)[number]
export type XrNativeControllerDemoPhase = 'off' | 'ready' | 'running' | 'paused'

export type XrNativeControllerDemoSnapshot = Readonly<{
  schema: typeof XR_NATIVE_CONTROLLER_DEMO_SCHEMA
  phase: XrNativeControllerDemoPhase
  mode: XrNativeControllerDemoMode
  followCamera: boolean
  fixedRateHz: number
  revision: number
}>

export type XrNativeControllerDemoFrame = Readonly<{
  schema: typeof XR_NATIVE_CONTROLLER_DEMO_SCHEMA
  phase: XrNativeControllerDemoPhase
  mode: XrNativeControllerDemoMode
  elapsedSeconds: number
  stepCount: number
  player: XrPhysicsBodyState
  bodies: readonly XrPhysicsBodyState[]
  input: XrNativeControllerInput
  ballRotation: XrPhysicsVector
  rocketRotation: XrPhysicsVector
  rocketThrusting: boolean
  cameraTarget: XrPhysicsVector
}>

export type XrNativeControllerDemoRuntime = {
  accumulatorSeconds: number
  ballRotation: [number, number, number]
  input: XrNativeControllerInput
  mode: XrNativeControllerDemoMode
  phase: XrNativeControllerDemoPhase
  previousPlayerPosition: [number, number, number]
  previousPrimary: boolean
  rocketRotation: [number, number, number]
  simulation: XrPhysicsSimulation
  snapshotRevision: number
  readonly colliders: readonly XrPhysicsStaticCollider[]
  readonly playerConfig: XrPhysicsBodyConfig
  readonly world: XrPhysicsWorldConfig
}

type Listener = () => void
const listeners = new Set<Listener>()
const FIXED_RATE_HZ = 120
const BALL_RADIUS = 0.5
const BALL_GROUND_ACCELERATION = 19
const BALL_AIR_CONTROL = 0.34
const BALL_JUMP_VELOCITY = 7.2
const BALL_MAX_SPEED = 8.5
const ROCKET_LATERAL_ACCELERATION = 10.5
const ROCKET_VERTICAL_ACCELERATION = 18
const ROCKET_MAX_TILT_RADIANS = Math.PI * 0.24
const ROCKET_TILT_RESPONSE = 8
const ROCKET_STABILIZE_RESPONSE = 14

function demoWorld(): XrPhysicsWorldConfig {
  return readXrPhysicsWorld({
    gravity: [0, -9.81, 0],
    fixedStepSeconds: 1 / FIXED_RATE_HZ,
    maxSubSteps: 12,
    floor: { enabled: true, height: 0, friction: 0.78, restitution: 0.08 },
    bodies: {
      [XR_NATIVE_CONTROLLER_DEMO_PLAYER_ID]: {
        mode: 'dynamic',
        sizeMeters: [1, 1, 1],
        spawnPosition: [0, 0, 4.2],
        mass: 1.4,
        friction: 0.72,
        restitution: 0.2,
        linearDamping: 0.4,
      },
      'native-crate-a': {
        mode: 'dynamic',
        sizeMeters: [1.1, 1.1, 1.1],
        spawnPosition: [0, 0, -1.2],
        mass: 2.2,
        friction: 0.66,
        restitution: 0.12,
        linearDamping: 0.5,
      },
      'native-crate-b': {
        mode: 'dynamic',
        sizeMeters: [0.8, 0.8, 0.8],
        spawnPosition: [1.5, 0, -2.5],
        mass: 0.9,
        friction: 0.58,
        restitution: 0.36,
        linearDamping: 0.3,
      },
    },
  })
}

function demoColliders(): readonly XrPhysicsStaticCollider[] {
  return readXrPhysicsStaticColliders([
    { id: 'native-wall-west', center: [-7.75, 1.5, 0], sizeMeters: [0.5, 3, 16] },
    { id: 'native-wall-east', center: [7.75, 1.5, 0], sizeMeters: [0.5, 3, 16] },
    { id: 'native-wall-north', center: [0, 1.5, -7.75], sizeMeters: [16, 3, 0.5] },
    { id: 'native-wall-south', center: [0, 1.5, 7.75], sizeMeters: [16, 3, 0.5] },
    { id: 'native-platform', center: [3.9, 0.45, -4.3], sizeMeters: [3.6, 0.9, 3] },
  ])
}

function mutablePosition(body: XrPhysicsBodyState): [number, number, number] {
  return [body.position[0], body.position[1], body.position[2]]
}

function playerBody(runtime: XrNativeControllerDemoRuntime): XrPhysicsBodyState {
  return readXrPhysicsSimulationBody(runtime.simulation, XR_NATIVE_CONTROLLER_DEMO_PLAYER_ID)!
}

function impulseForAcceleration(
  runtime: XrNativeControllerDemoRuntime,
  acceleration: XrPhysicsVector,
  stepSeconds: number,
): void {
  const mass = runtime.playerConfig.mass
  applyXrPhysicsSimulationImpulse(runtime.simulation, runtime.playerConfig, [
    acceleration[0] * mass * stepSeconds,
    acceleration[1] * mass * stepSeconds,
    acceleration[2] * mass * stepSeconds,
  ])
}

function driveBall(runtime: XrNativeControllerDemoRuntime, stepSeconds: number): void {
  const body = playerBody(runtime)
  const grounded = body.grounded || body.position[1] <= 0.001
  const control = grounded ? 1 : BALL_AIR_CONTROL
  const modifierScale = runtime.input.modifier ? 1.28 : 1
  const horizontalSpeed = Math.hypot(body.velocity[0], body.velocity[2])
  const desired = Math.hypot(runtime.input.moveX, runtime.input.moveZ) > 0
  const accelerationScale = desired && horizontalSpeed < BALL_MAX_SPEED
    ? BALL_GROUND_ACCELERATION * control * modifierScale
    : 0
  impulseForAcceleration(runtime, [
    runtime.input.moveX * accelerationScale,
    0,
    runtime.input.moveZ * accelerationScale,
  ], stepSeconds)
  if (runtime.input.primary && !runtime.previousPrimary && grounded) {
    applyXrPhysicsSimulationImpulse(runtime.simulation, runtime.playerConfig, [
      0,
      BALL_JUMP_VELOCITY * runtime.playerConfig.mass,
      0,
    ])
  }
}

function approach(current: number, target: number, response: number, stepSeconds: number): number {
  return current + (target - current) * (1 - Math.exp(-response * stepSeconds))
}

function driveRocket(runtime: XrNativeControllerDemoRuntime, stepSeconds: number): void {
  const stabilize = runtime.input.modifier
  const targetPitch = stabilize ? 0 : runtime.input.moveZ * ROCKET_MAX_TILT_RADIANS
  const targetRoll = stabilize ? 0 : -runtime.input.moveX * ROCKET_MAX_TILT_RADIANS
  const response = stabilize ? ROCKET_STABILIZE_RESPONSE : ROCKET_TILT_RESPONSE
  runtime.rocketRotation[0] = approach(runtime.rocketRotation[0], targetPitch, response, stepSeconds)
  runtime.rocketRotation[2] = approach(runtime.rocketRotation[2], targetRoll, response, stepSeconds)
  const upward = runtime.input.primary ? ROCKET_VERTICAL_ACCELERATION : 0
  impulseForAcceleration(runtime, [
    runtime.input.moveX * ROCKET_LATERAL_ACCELERATION + Math.sin(-runtime.rocketRotation[2]) * upward * 0.38,
    upward,
    runtime.input.moveZ * ROCKET_LATERAL_ACCELERATION + Math.sin(runtime.rocketRotation[0]) * upward * 0.38,
  ], stepSeconds)
  if (stabilize) {
    const body = playerBody(runtime)
    impulseForAcceleration(runtime, [
      -body.velocity[0] * 1.6,
      runtime.input.primary ? 0 : -body.velocity[1] * 0.35,
      -body.velocity[2] * 1.6,
    ], stepSeconds)
  }
}

function updateBallRotation(runtime: XrNativeControllerDemoRuntime): void {
  const current = playerBody(runtime).position
  const dx = current[0] - runtime.previousPlayerPosition[0]
  const dz = current[2] - runtime.previousPlayerPosition[2]
  runtime.ballRotation[0] += dz / BALL_RADIUS
  runtime.ballRotation[2] -= dx / BALL_RADIUS
  if (runtime.mode === 'ball' && runtime.input.modifier) {
    runtime.ballRotation[1] += Math.hypot(runtime.input.moveX, runtime.input.moveZ) * 0.035
  }
  runtime.previousPlayerPosition = [current[0], current[1], current[2]]
}

function stepFixed(runtime: XrNativeControllerDemoRuntime): void {
  const stepSeconds = runtime.world.fixedStepSeconds
  if (runtime.mode === 'ball') driveBall(runtime, stepSeconds)
  else driveRocket(runtime, stepSeconds)
  runtime.previousPrimary = runtime.input.primary
  stepXrPhysicsSimulation({
    simulation: runtime.simulation,
    world: runtime.world,
    staticColliders: runtime.colliders,
    stepSeconds,
  })
  updateBallRotation(runtime)
}

function notify(): void {
  for (const listener of [...listeners]) listener()
}

export function createXrNativeControllerDemoRuntime(): XrNativeControllerDemoRuntime {
  const world = demoWorld()
  const simulation = createXrPhysicsSimulation(world)
  const playerConfig = world.bodies.find(body => body.subjectId === XR_NATIVE_CONTROLLER_DEMO_PLAYER_ID)!
  const position = readXrPhysicsSimulationBody(simulation, XR_NATIVE_CONTROLLER_DEMO_PLAYER_ID)!.position
  return {
    accumulatorSeconds: 0,
    ballRotation: [0, 0, 0],
    colliders: demoColliders(),
    input: createXrNativeControllerInput(),
    mode: 'ball',
    phase: 'off',
    playerConfig,
    previousPlayerPosition: [position[0], position[1], position[2]],
    previousPrimary: false,
    rocketRotation: [0, 0, 0],
    simulation,
    snapshotRevision: 0,
    world,
  }
}

export function resetXrNativeControllerDemoRuntime(runtime: XrNativeControllerDemoRuntime): void {
  resetXrPhysicsSimulation(runtime.simulation, runtime.world)
  runtime.accumulatorSeconds = 0
  runtime.ballRotation = [0, 0, 0]
  runtime.input = createXrNativeControllerInput()
  runtime.previousPlayerPosition = mutablePosition(playerBody(runtime))
  runtime.previousPrimary = false
  runtime.rocketRotation = [0, 0, 0]
}

export function setXrNativeControllerDemoRuntimeInput(
  runtime: XrNativeControllerDemoRuntime,
  input: XrNativeControllerInput,
): void {
  runtime.input = createXrNativeControllerInput(input)
}

export function stepXrNativeControllerDemoRuntime(
  runtime: XrNativeControllerDemoRuntime,
  deltaSecondsValue: number,
): number {
  if (runtime.phase !== 'running') return 0
  const deltaSeconds = Number.isFinite(deltaSecondsValue) ? Math.max(0, Math.min(0.25, deltaSecondsValue)) : 0
  runtime.accumulatorSeconds += deltaSeconds
  const stepSeconds = runtime.world.fixedStepSeconds
  const tolerance = stepSeconds * 1e-9
  let steps = 0
  while (runtime.accumulatorSeconds + tolerance >= stepSeconds && steps < runtime.world.maxSubSteps) {
    stepFixed(runtime)
    runtime.accumulatorSeconds = Math.max(0, runtime.accumulatorSeconds - stepSeconds)
    steps += 1
  }
  return steps
}

export function stepXrNativeControllerDemoRuntimeTicks(
  runtime: XrNativeControllerDemoRuntime,
  ticksValue: number,
): number {
  const ticks = Number(ticksValue)
  if (runtime.phase === 'off' || !Number.isInteger(ticks) || ticks < 1 || ticks > 1200) return 0
  for (let index = 0; index < ticks; index += 1) stepFixed(runtime)
  return ticks
}

export function readXrNativeControllerDemoRuntimeFrame(
  runtime: XrNativeControllerDemoRuntime,
): XrNativeControllerDemoFrame {
  const player = playerBody(runtime)
  return Object.freeze({
    schema: XR_NATIVE_CONTROLLER_DEMO_SCHEMA,
    phase: runtime.phase,
    mode: runtime.mode,
    elapsedSeconds: runtime.simulation.elapsedSeconds,
    stepCount: runtime.simulation.stepCount,
    player,
    bodies: captureXrPhysicsSimulation(runtime.simulation),
    input: runtime.input,
    ballRotation: Object.freeze([...runtime.ballRotation]) as XrPhysicsVector,
    rocketRotation: Object.freeze([...runtime.rocketRotation]) as XrPhysicsVector,
    rocketThrusting: runtime.mode === 'rocket' && runtime.input.primary,
    cameraTarget: Object.freeze([
      player.position[0],
      player.position[1] + (runtime.mode === 'rocket' ? 1.25 : 0.8),
      player.position[2],
    ]) as XrPhysicsVector,
  })
}

const sharedRuntime = createXrNativeControllerDemoRuntime()

function createSharedSnapshot(): XrNativeControllerDemoSnapshot {
  return Object.freeze({
    schema: XR_NATIVE_CONTROLLER_DEMO_SCHEMA,
    phase: sharedRuntime.phase,
    mode: sharedRuntime.mode,
    followCamera: sharedRuntime.phase !== 'off',
    fixedRateHz: FIXED_RATE_HZ,
    revision: sharedRuntime.snapshotRevision,
  })
}

let sharedSnapshot = createSharedSnapshot()

function publishShared(): XrNativeControllerDemoSnapshot {
  sharedRuntime.snapshotRevision += 1
  sharedSnapshot = createSharedSnapshot()
  notify()
  return sharedSnapshot
}

export function readXrNativeControllerDemo(): XrNativeControllerDemoSnapshot {
  return sharedSnapshot
}

export function subscribeXrNativeControllerDemo(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function developAndRunXrNativeControllerDemo(): XrNativeControllerDemoSnapshot {
  resetXrNativeControllerDemoRuntime(sharedRuntime)
  sharedRuntime.phase = 'running'
  return publishShared()
}

export function pauseXrNativeControllerDemo(): XrNativeControllerDemoSnapshot {
  if (sharedRuntime.phase === 'running') sharedRuntime.phase = 'paused'
  return publishShared()
}

export function resumeXrNativeControllerDemo(): XrNativeControllerDemoSnapshot {
  if (sharedRuntime.phase === 'paused' || sharedRuntime.phase === 'ready') sharedRuntime.phase = 'running'
  return publishShared()
}

export function resetSharedXrNativeControllerDemo(): XrNativeControllerDemoSnapshot {
  const phase = sharedRuntime.phase === 'off' ? 'ready' : sharedRuntime.phase
  resetXrNativeControllerDemoRuntime(sharedRuntime)
  sharedRuntime.phase = phase === 'paused' ? 'paused' : phase === 'running' ? 'running' : 'ready'
  return publishShared()
}

export function exitXrNativeControllerDemo(): XrNativeControllerDemoSnapshot {
  resetXrNativeControllerDemoRuntime(sharedRuntime)
  sharedRuntime.phase = 'off'
  return publishShared()
}

export function selectXrNativeControllerDemoMode(mode: XrNativeControllerDemoMode): XrNativeControllerDemoSnapshot {
  if (!XR_NATIVE_CONTROLLER_DEMO_MODES.includes(mode)) return readXrNativeControllerDemo()
  sharedRuntime.mode = mode
  return publishShared()
}

export function setSharedXrNativeControllerDemoInput(input: XrNativeControllerInput): void {
  setXrNativeControllerDemoRuntimeInput(sharedRuntime, input)
}

export function stepSharedXrNativeControllerDemo(deltaSeconds: number): number {
  return stepXrNativeControllerDemoRuntime(sharedRuntime, deltaSeconds)
}

export function readSharedXrNativeControllerDemoFrame(): XrNativeControllerDemoFrame {
  return readXrNativeControllerDemoRuntimeFrame(sharedRuntime)
}
