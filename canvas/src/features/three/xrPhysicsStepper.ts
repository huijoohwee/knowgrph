import type {
  XrPhysicsBodyConfig,
  XrPhysicsStaticCollider,
  XrPhysicsVector,
  XrPhysicsWorldConfig,
} from './xrPhysicsModel'
import { compareXrPhysicsIds } from './xrPhysicsModel'

type MutableVector = [number, number, number]
type Axis = 0 | 1 | 2

type SweptAabbHit = Readonly<{
  time: number
  axis: Axis
  normal: number
}>

type AabbCollision = Readonly<{
  time: number
  sweep: SweptAabbHit | null
  penetration: MutableVector | null
  startedOverlapping: boolean
}>

type CollisionEvent = {
  kind: 'floor' | 'static' | 'pair'
  left: XrPhysicsBodyConfig
  right?: XrPhysicsBodyConfig
  collider?: XrPhysicsStaticCollider
  time: number
}

const SWEEP_EPSILON = 1e-9
const SWEEP_SEPARATION = 1e-7
const SWEEP_AXIS_ORDER: readonly Axis[] = [1, 0, 2]

export type XrPhysicsBodyState = Readonly<{
  subjectId: string
  position: XrPhysicsVector
  velocity: XrPhysicsVector
  grounded: boolean
  contacts: readonly string[]
}>

export type XrPhysicsSimulation = {
  readonly bodies: Map<string, MutableXrPhysicsBodyState>
  elapsedSeconds: number
  stepCount: number
}

type MutableXrPhysicsBodyState = {
  subjectId: string
  position: MutableVector
  velocity: MutableVector
  grounded: boolean
  contacts: Set<string>
  sweepStartPosition: MutableVector | null
  startOverlapResolved: boolean
}

export type XrPhysicsStepResult = Readonly<{
  stepped: boolean
  contactCount: number
  elapsedSeconds: number
  stepCount: number
}>

function mutableVector(value: XrPhysicsVector): MutableVector {
  return [value[0], value[1], value[2]]
}

function bodyState(config: XrPhysicsBodyConfig): MutableXrPhysicsBodyState {
  return {
    subjectId: config.subjectId,
    position: mutableVector(config.spawnPosition),
    velocity: mutableVector(config.initialVelocity),
    grounded: false,
    contacts: new Set(),
    sweepStartPosition: null,
    startOverlapResolved: false,
  }
}

export function createXrPhysicsSimulation(world: XrPhysicsWorldConfig): XrPhysicsSimulation {
  return {
    bodies: new Map(world.bodies.map(config => [config.subjectId, bodyState(config)])),
    elapsedSeconds: 0,
    stepCount: 0,
  }
}

export function resetXrPhysicsSimulation(
  simulation: XrPhysicsSimulation,
  world: XrPhysicsWorldConfig,
): void {
  simulation.bodies.clear()
  for (const config of world.bodies) simulation.bodies.set(config.subjectId, bodyState(config))
  simulation.elapsedSeconds = 0
  simulation.stepCount = 0
}

export function readXrPhysicsSimulationBody(
  simulation: XrPhysicsSimulation,
  subjectId: string,
): XrPhysicsBodyState | null {
  const state = simulation.bodies.get(String(subjectId || '').trim())
  if (!state) return null
  return Object.freeze({
    subjectId: state.subjectId,
    position: Object.freeze([...state.position]) as XrPhysicsVector,
    velocity: Object.freeze([...state.velocity]) as XrPhysicsVector,
    grounded: state.grounded,
    contacts: Object.freeze([...state.contacts].sort(compareXrPhysicsIds)),
  })
}

export function captureXrPhysicsSimulation(
  simulation: XrPhysicsSimulation,
): readonly XrPhysicsBodyState[] {
  return Object.freeze([...simulation.bodies.keys()].sort(compareXrPhysicsIds)
    .map(subjectId => readXrPhysicsSimulationBody(simulation, subjectId)!))
}

function groupsInteract(
  left: Pick<XrPhysicsBodyConfig, 'collisionGroup' | 'collisionMask'>,
  right: Pick<XrPhysicsBodyConfig, 'collisionGroup' | 'collisionMask'>,
): boolean {
  return ((left.collisionGroup & right.collisionMask) >>> 0) !== 0
    && ((right.collisionGroup & left.collisionMask) >>> 0) !== 0
}

function inverseMass(config: XrPhysicsBodyConfig): number {
  return config.mode === 'dynamic' ? 1 / config.mass : 0
}

function bodyCenter(state: MutableXrPhysicsBodyState, config: XrPhysicsBodyConfig): MutableVector {
  return [state.position[0], state.position[1] + config.sizeMeters[1] / 2, state.position[2]]
}

function bodyCenterAt(position: XrPhysicsVector, config: XrPhysicsBodyConfig): MutableVector {
  return [position[0], position[1] + config.sizeMeters[1] / 2, position[2]]
}

function overlaps(
  leftCenter: XrPhysicsVector,
  leftSize: XrPhysicsVector,
  rightCenter: XrPhysicsVector,
  rightSize: XrPhysicsVector,
): MutableVector | null {
  const penetration: MutableVector = [0, 0, 0]
  for (let axis = 0; axis < 3; axis += 1) {
    penetration[axis] = (leftSize[axis] + rightSize[axis]) / 2
      - Math.abs(rightCenter[axis] - leftCenter[axis])
    if (penetration[axis] <= 0) return null
  }
  return penetration
}

function sweptAabb(
  leftStart: XrPhysicsVector,
  leftEnd: XrPhysicsVector,
  leftSize: XrPhysicsVector,
  rightStart: XrPhysicsVector,
  rightEnd: XrPhysicsVector,
  rightSize: XrPhysicsVector,
): SweptAabbHit | null {
  let entryTime = Number.NEGATIVE_INFINITY
  let exitTime = Number.POSITIVE_INFINITY
  let entryAxis: Axis | null = null
  const relativeDelta: MutableVector = [0, 0, 0]

  for (const axis of SWEEP_AXIS_ORDER) {
    const halfExtent = (leftSize[axis] + rightSize[axis]) / 2
    const relativeStart = leftStart[axis] - rightStart[axis]
    relativeDelta[axis] = (leftEnd[axis] - leftStart[axis]) - (rightEnd[axis] - rightStart[axis])
    const delta = relativeDelta[axis]
    if (Math.abs(delta) <= SWEEP_EPSILON) {
      if (Math.abs(relativeStart) > halfExtent) return null
      continue
    }
    const firstTime = (-halfExtent - relativeStart) / delta
    const secondTime = (halfExtent - relativeStart) / delta
    const axisEntry = Math.min(firstTime, secondTime)
    const axisExit = Math.max(firstTime, secondTime)
    if (entryAxis === null || axisEntry > entryTime + SWEEP_EPSILON) {
      entryTime = axisEntry
      entryAxis = axis
    }
    exitTime = Math.min(exitTime, axisExit)
    if (entryTime > exitTime + SWEEP_EPSILON) return null
  }

  if (entryAxis === null
    || entryTime < -SWEEP_EPSILON
    || entryTime > 1 + SWEEP_EPSILON
    || exitTime < -SWEEP_EPSILON) return null
  const time = Math.min(1, Math.max(0, entryTime))
  return Object.freeze({ time, axis: entryAxis, normal: relativeDelta[entryAxis] > 0 ? -1 : 1 })
}

function detectAabbCollision(
  leftStart: XrPhysicsVector,
  leftEnd: XrPhysicsVector,
  leftSize: XrPhysicsVector,
  rightStart: XrPhysicsVector,
  rightEnd: XrPhysicsVector,
  rightSize: XrPhysicsVector,
): AabbCollision | null {
  const startPenetration = overlaps(leftStart, leftSize, rightStart, rightSize)
  if (startPenetration) return Object.freeze({
    time: 0, sweep: null, penetration: startPenetration, startedOverlapping: true,
  })
  const sweep = sweptAabb(leftStart, leftEnd, leftSize, rightStart, rightEnd, rightSize)
  if (sweep) {
    return Object.freeze({ time: sweep.time, sweep, penetration: null, startedOverlapping: false })
  }
  const endPenetration = overlaps(leftEnd, leftSize, rightEnd, rightSize)
  return endPenetration
    ? Object.freeze({ time: 1, sweep: null, penetration: endPenetration, startedOverlapping: false })
    : null
}

function minimumAxis(penetration: XrPhysicsVector): Axis {
  if (penetration[1] <= penetration[0] && penetration[1] <= penetration[2]) return 1
  return penetration[0] <= penetration[2] ? 0 : 2
}

function axisSign(delta: number, leftId: string, rightId: string): number {
  if (delta > 0) return 1
  if (delta < 0) return -1
  return compareXrPhysicsIds(leftId, rightId) <= 0 ? 1 : -1
}

function applySurfaceVelocity(
  velocity: MutableVector,
  axis: Axis,
  normal: number,
  restitution: number,
  friction: number,
  stepSeconds: number,
): void {
  const normalVelocity = velocity[axis] * normal
  if (normalVelocity < 0) velocity[axis] -= (1 + restitution) * normalVelocity * normal
  const drag = Math.max(0, 1 - friction * stepSeconds * 12)
  for (let index = 0; index < 3; index += 1) {
    if (index !== axis) velocity[index] *= drag
  }
}

function floorCollisionTime(
  state: MutableXrPhysicsBodyState,
  config: XrPhysicsBodyConfig,
  world: XrPhysicsWorldConfig,
  startPosition: XrPhysicsVector,
): number {
  const floor = world.floor
  if (!floor.enabled || !groupsInteract(config, floor)) return Number.POSITIVE_INFINITY
  const startY = startPosition[1]
  const endY = state.position[1]
  if (startY <= floor.height) {
    return startY < floor.height || endY < floor.height || state.velocity[1] < 0
      ? 0
      : Number.POSITIVE_INFINITY
  }
  return endY < floor.height
    ? (startY - floor.height) / (startY - endY)
    : Number.POSITIVE_INFINITY
}

function resolveFloor(
  state: MutableXrPhysicsBodyState,
  config: XrPhysicsBodyConfig,
  world: XrPhysicsWorldConfig,
  startPosition: XrPhysicsVector,
  stepSeconds: number,
): number {
  const floor = world.floor
  const time = floorCollisionTime(state, config, world, startPosition)
  if (!Number.isFinite(time)) return 0
  state.contacts.add('floor')
  if (config.mode === 'trigger') return 1
  if (config.mode !== 'dynamic') return 1
  if (startPosition[1] < floor.height) {
    if (!state.startOverlapResolved) {
      state.position.splice(0, 3, ...startPosition)
      state.startOverlapResolved = true
    }
  } else if (!(time === 0 && state.startOverlapResolved)) {
    const endPosition = mutableVector(state.position)
    for (let axis = 0; axis < 3; axis += 1) {
      state.position[axis] = startPosition[axis] + (endPosition[axis] - startPosition[axis]) * time
    }
  }
  state.position[1] = floor.height
  state.grounded = true
  applySurfaceVelocity(
    state.velocity, 1, 1, Math.max(config.restitution, floor.restitution),
    Math.sqrt(config.friction * floor.friction), stepSeconds,
  )
  return 1
}

function resolveStaticCollider(
  state: MutableXrPhysicsBodyState,
  config: XrPhysicsBodyConfig,
  collider: XrPhysicsStaticCollider,
  startPosition: XrPhysicsVector,
  stepSeconds: number,
): number {
  const collision = detectStaticCollision(state, config, collider, startPosition)
  if (!collision) return 0
  state.contacts.add(collider.id)
  if (config.mode === 'trigger' || collider.trigger || config.mode !== 'dynamic') return 1
  let axis: Axis
  let normal: number
  if (collision.startedOverlapping) {
    if (!state.startOverlapResolved) {
      state.position.splice(0, 3, startPosition[0], startPosition[1], startPosition[2])
      state.startOverlapResolved = true
    }
    const center = bodyCenter(state, config)
    const penetration = overlaps(center, config.sizeMeters, collider.center, collider.sizeMeters)
    if (!penetration) return 1
    axis = minimumAxis(penetration)
    normal = axisSign(center[axis] - collider.center[axis], config.subjectId, collider.id)
    state.position[axis] += normal * (penetration[axis] + SWEEP_SEPARATION)
  } else if (collision.sweep) {
    const endPosition = mutableVector(state.position)
    axis = collision.sweep.axis
    normal = collision.sweep.normal
    for (let index = 0; index < 3; index += 1) {
      state.position[index] = startPosition[index]
        + (endPosition[index] - startPosition[index]) * collision.sweep.time
    }
    state.position[axis] += normal * SWEEP_SEPARATION
  } else {
    const penetration = collision.penetration!
    const endCenter = bodyCenter(state, config)
    axis = minimumAxis(penetration)
    normal = axisSign(endCenter[axis] - collider.center[axis], config.subjectId, collider.id)
    state.position[axis] += normal * (penetration[axis] + SWEEP_SEPARATION)
  }
  if (axis === 1 && normal > 0) state.grounded = true
  applySurfaceVelocity(
    state.velocity,
    axis,
    normal,
    Math.max(config.restitution, collider.restitution),
    Math.sqrt(config.friction * collider.friction),
    stepSeconds,
  )
  return 1
}

function detectStaticCollision(
  state: MutableXrPhysicsBodyState,
  config: XrPhysicsBodyConfig,
  collider: XrPhysicsStaticCollider,
  startPosition: XrPhysicsVector,
): AabbCollision | null {
  if (!groupsInteract(config, collider)) return null
  return detectAabbCollision(
    bodyCenterAt(startPosition, config),
    bodyCenter(state, config),
    config.sizeMeters,
    collider.center,
    collider.center,
    collider.sizeMeters,
  )
}

function resolveBodyPair(
  leftState: MutableXrPhysicsBodyState,
  left: XrPhysicsBodyConfig,
  rightState: MutableXrPhysicsBodyState,
  right: XrPhysicsBodyConfig,
  leftStartPosition: XrPhysicsVector,
  rightStartPosition: XrPhysicsVector,
  stepSeconds: number,
): number {
  const collision = detectBodyPairCollision(
    leftState, left, rightState, right, leftStartPosition, rightStartPosition,
  )
  if (!collision) return 0
  leftState.contacts.add(right.subjectId)
  rightState.contacts.add(left.subjectId)
  if (left.mode === 'trigger' || right.mode === 'trigger') return 1
  const leftInverseMass = inverseMass(left)
  const rightInverseMass = inverseMass(right)
  const inverseMassSum = leftInverseMass + rightInverseMass
  if (inverseMassSum === 0) return 1
  let axis: Axis
  let normal: number
  if (collision.startedOverlapping) {
    if (leftInverseMass > 0 && !leftState.startOverlapResolved) {
      leftState.position.splice(0, 3, ...leftStartPosition)
      leftState.startOverlapResolved = true
    }
    if (rightInverseMass > 0 && !rightState.startOverlapResolved) {
      rightState.position.splice(0, 3, ...rightStartPosition)
      rightState.startOverlapResolved = true
    }
    const leftCenter = bodyCenter(leftState, left)
    const rightCenter = bodyCenter(rightState, right)
    const penetration = overlaps(leftCenter, left.sizeMeters, rightCenter, right.sizeMeters)
    if (!penetration) return 1
    axis = minimumAxis(penetration)
    normal = axisSign(rightCenter[axis] - leftCenter[axis], left.subjectId, right.subjectId)
    const correction = penetration[axis] + SWEEP_SEPARATION
    leftState.position[axis] -= normal * correction * leftInverseMass / inverseMassSum
    rightState.position[axis] += normal * correction * rightInverseMass / inverseMassSum
  } else if (collision.sweep) {
    const leftEndPosition = mutableVector(leftState.position)
    const rightEndPosition = mutableVector(rightState.position)
    for (let index = 0; index < 3; index += 1) {
      if (leftInverseMass > 0) leftState.position[index] = leftStartPosition[index]
        + (leftEndPosition[index] - leftStartPosition[index]) * collision.sweep.time
      if (rightInverseMass > 0) rightState.position[index] = rightStartPosition[index]
        + (rightEndPosition[index] - rightStartPosition[index]) * collision.sweep.time
    }
    axis = collision.sweep.axis
    normal = -collision.sweep.normal
    leftState.position[axis] -= normal * SWEEP_SEPARATION * leftInverseMass / inverseMassSum
    rightState.position[axis] += normal * SWEEP_SEPARATION * rightInverseMass / inverseMassSum
  } else {
    const penetration = collision.penetration!
    const leftEndCenter = bodyCenter(leftState, left)
    const rightEndCenter = bodyCenter(rightState, right)
    axis = minimumAxis(penetration)
    normal = axisSign(rightEndCenter[axis] - leftEndCenter[axis], left.subjectId, right.subjectId)
    const correction = penetration[axis] + SWEEP_SEPARATION
    leftState.position[axis] -= normal * correction * leftInverseMass / inverseMassSum
    rightState.position[axis] += normal * correction * rightInverseMass / inverseMassSum
  }
  if (axis === 1) {
    if (normal < 0 && leftInverseMass > 0) leftState.grounded = true
    if (normal > 0 && rightInverseMass > 0) rightState.grounded = true
  }
  const relativeNormalVelocity = (rightState.velocity[axis] - leftState.velocity[axis]) * normal
  if (relativeNormalVelocity < 0) {
    const restitution = Math.max(left.restitution, right.restitution)
    const impulse = -(1 + restitution) * relativeNormalVelocity / inverseMassSum
    leftState.velocity[axis] -= impulse * leftInverseMass * normal
    rightState.velocity[axis] += impulse * rightInverseMass * normal
  }
  const friction = Math.sqrt(left.friction * right.friction)
  const drag = Math.max(0, 1 - friction * stepSeconds * 8)
  for (let index = 0; index < 3; index += 1) {
    if (index !== axis) {
      if (leftInverseMass > 0) leftState.velocity[index] *= drag
      if (rightInverseMass > 0) rightState.velocity[index] *= drag
    }
  }
  return 1
}

function detectBodyPairCollision(
  leftState: MutableXrPhysicsBodyState,
  left: XrPhysicsBodyConfig,
  rightState: MutableXrPhysicsBodyState,
  right: XrPhysicsBodyConfig,
  leftStartPosition: XrPhysicsVector,
  rightStartPosition: XrPhysicsVector,
): AabbCollision | null {
  if (!groupsInteract(left, right)) return null
  return detectAabbCollision(
    bodyCenterAt(leftStartPosition, left), bodyCenter(leftState, left), left.sizeMeters,
    bodyCenterAt(rightStartPosition, right), bodyCenter(rightState, right), right.sizeMeters,
  )
}

function integrate(
  state: MutableXrPhysicsBodyState,
  config: XrPhysicsBodyConfig,
  world: XrPhysicsWorldConfig,
  stepSeconds: number,
): void {
  state.grounded = false
  state.contacts.clear()
  state.startOverlapResolved = false
  if (config.mode !== 'dynamic') return
  const damping = Math.exp(-config.linearDamping * stepSeconds)
  for (let axis = 0; axis < 3; axis += 1) {
    state.velocity[axis] = (state.velocity[axis] + world.gravity[axis] * stepSeconds) * damping
    state.position[axis] += state.velocity[axis] * stepSeconds
  }
}

export function stepXrPhysicsSimulation(args: {
  simulation: XrPhysicsSimulation
  world: XrPhysicsWorldConfig
  staticColliders?: readonly XrPhysicsStaticCollider[]
  stepSeconds?: number
}): XrPhysicsStepResult {
  const stepSeconds = Number.isFinite(args.stepSeconds) && Number(args.stepSeconds) > 0
    ? Math.min(Number(args.stepSeconds), 1 / 15)
    : args.world.fixedStepSeconds
  const configs = [...args.world.bodies].sort((left, right) => compareXrPhysicsIds(left.subjectId, right.subjectId))
  const colliders = [...(args.staticColliders || [])].sort((left, right) => compareXrPhysicsIds(left.id, right.id))
  const startPositions = new Map<string, XrPhysicsVector>()
  for (const config of configs) {
    const state = args.simulation.bodies.get(config.subjectId)
    if (state) {
      startPositions.set(config.subjectId, mutableVector(state.sweepStartPosition || state.position))
      state.sweepStartPosition = null
      integrate(state, config, args.world, stepSeconds)
    }
  }
  let contactCount = 0
  const events: CollisionEvent[] = []
  for (const left of configs) {
    events.push({ kind: 'floor', left, time: 0 })
    for (const collider of colliders) events.push({ kind: 'static', left, collider, time: 0 })
  }
  for (let leftIndex = 0; leftIndex < configs.length; leftIndex += 1) {
    const left = configs[leftIndex]!
    for (let rightIndex = leftIndex + 1; rightIndex < configs.length; rightIndex += 1) {
      events.push({ kind: 'pair', left, right: configs[rightIndex]!, time: 0 })
    }
  }
  const eventTime = (event: CollisionEvent): number => {
    const leftState = args.simulation.bodies.get(event.left.subjectId)!
    const leftStart = startPositions.get(event.left.subjectId)!
    if (event.kind === 'floor') return floorCollisionTime(leftState, event.left, args.world, leftStart)
    if (event.kind === 'static') {
      return detectStaticCollision(leftState, event.left, event.collider!, leftStart)?.time
        ?? Number.POSITIVE_INFINITY
    }
    const rightState = args.simulation.bodies.get(event.right!.subjectId)!
    return detectBodyPairCollision(
      leftState, event.left, rightState, event.right!, leftStart, startPositions.get(event.right!.subjectId)!,
    )?.time ?? Number.POSITIVE_INFINITY
  }
  while (events.length) {
    for (const event of events) event.time = eventTime(event)
    events.sort((left, right) => left.time === right.time
      ? compareXrPhysicsIds(left.left.subjectId, right.left.subjectId)
        || compareXrPhysicsIds(
          left.kind === 'floor' ? 'floor' : left.kind === 'static' ? left.collider!.id : left.right!.subjectId,
          right.kind === 'floor' ? 'floor' : right.kind === 'static' ? right.collider!.id : right.right!.subjectId,
        )
      : left.time - right.time)
    const event = events.shift()!
    if (!Number.isFinite(event.time)) break
    const leftState = args.simulation.bodies.get(event.left.subjectId)!
    const leftStart = startPositions.get(event.left.subjectId)!
    if (event.kind === 'floor') {
      contactCount += resolveFloor(leftState, event.left, args.world, leftStart, stepSeconds)
    } else if (event.kind === 'static') {
      contactCount += resolveStaticCollider(leftState, event.left, event.collider!, leftStart, stepSeconds)
    } else {
      const rightState = args.simulation.bodies.get(event.right!.subjectId)!
      contactCount += resolveBodyPair(
        leftState, event.left, rightState, event.right!, leftStart,
        startPositions.get(event.right!.subjectId)!, stepSeconds,
      )
    }
  }
  args.simulation.elapsedSeconds += stepSeconds
  args.simulation.stepCount += 1
  return Object.freeze({
    stepped: true,
    contactCount,
    elapsedSeconds: args.simulation.elapsedSeconds,
    stepCount: args.simulation.stepCount,
  })
}

export function applyXrPhysicsSimulationImpulse(
  simulation: XrPhysicsSimulation,
  config: XrPhysicsBodyConfig,
  impulse: XrPhysicsVector,
): boolean {
  const state = simulation.bodies.get(config.subjectId)
  if (!state || config.mode !== 'dynamic' || !Array.isArray(impulse) || !impulse.every(Number.isFinite)) return false
  for (let axis = 0; axis < 3; axis += 1) state.velocity[axis] += impulse[axis] / config.mass
  return true
}

export function setXrPhysicsSimulationBodyPose(
  simulation: XrPhysicsSimulation,
  subjectId: string,
  position: XrPhysicsVector,
  velocity: XrPhysicsVector = [0, 0, 0],
): boolean {
  const state = simulation.bodies.get(String(subjectId || '').trim())
  if (!state
    || !Array.isArray(position)
    || !Array.isArray(velocity)
    || !position.every(Number.isFinite)
    || !velocity.every(Number.isFinite)) return false
  if (!state.sweepStartPosition) state.sweepStartPosition = mutableVector(state.position)
  state.position.splice(0, 3, position[0], position[1], position[2])
  state.velocity.splice(0, 3, velocity[0], velocity[1], velocity[2])
  return true
}
