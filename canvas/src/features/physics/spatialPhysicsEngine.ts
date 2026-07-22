import {
  addSpatialVectors,
  findSpatialCollision,
  placeSpatialShape,
  raySpatialShapeDistance,
  scaleSpatialVector,
  spatialShapeContainsPoint,
  spatialShapeHighestY,
  spatialShapeLowestY,
} from './spatialPhysicsGeometry'
import {
  compareSpatialIds,
  spatialInteractionIdentity,
  stepSpatialPhysicsState,
  type MutableSpatialBody,
  type SpatialStepState,
} from './spatialPhysicsStep'
import {
  SPATIAL_PHYSICS_SNAPSHOT_FORMAT,
  SPATIAL_PHYSICS_SNAPSHOT_VERSION,
  type SpatialAdvanceResult,
  type SpatialBodySnapshot,
  type SpatialBodySpec,
  type SpatialBodyState,
  type SpatialColliderShape,
  type SpatialColliderSnapshot,
  type SpatialColliderSpec,
  type SpatialGroundSnapshot,
  type SpatialGroundSpec,
  type SpatialInteractionSnapshot,
  type SpatialOverlapQuery,
  type SpatialPhysicsEvent,
  type SpatialPhysicsEventKind,
  type SpatialPhysicsOptions,
  type SpatialPhysicsSnapshot,
  type SpatialQueryFilter,
  type SpatialRayHit,
  type SpatialRayQuery,
  type SpatialVector,
} from './spatialPhysicsTypes'

const ALL_COLLISION_BITS = 0xffff_ffff
const REMAINDER_EPSILON_SCALE = 1e-10
const SURFACE_EPSILON = 1e-10
const EVENT_KINDS = new Set<SpatialPhysicsEventKind>([
  'collision-began', 'collision-ended', 'sensor-began', 'sensor-ended',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be finite`)
  return value
}

function positiveNumber(value: unknown, label: string): number {
  const number = finiteNumber(value, label)
  if (number <= 0) throw new RangeError(`${label} must be positive`)
  return number
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
  return value
}

function unitInterval(value: unknown, label: string): number {
  const number = finiteNumber(value, label)
  if (number < 0 || number > 1) throw new RangeError(`${label} must be between zero and one`)
  return number
}

function stableId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new TypeError(`${label} must be a non-empty, whitespace-stable string`)
  }
  return value
}

function vector(value: unknown, label: string): SpatialVector {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} must contain three numbers`)
  return [
    finiteNumber(value[0], `${label}[0]`),
    finiteNumber(value[1], `${label}[1]`),
    finiteNumber(value[2], `${label}[2]`),
  ]
}

function collisionBits(value: unknown, fallback: number, label: string): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > ALL_COLLISION_BITS) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer`)
  }
  return value >>> 0
}

function normalizedShape(value: unknown, label: string): SpatialColliderShape {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)
  const offset = value.offset === undefined ? [0, 0, 0] as const : vector(value.offset, `${label}.offset`)
  if (value.kind === 'sphere') {
    return { kind: 'sphere', radius: positiveNumber(value.radius, `${label}.radius`), offset }
  }
  if (value.kind === 'cuboid') {
    const halfSize = vector(value.halfSize, `${label}.halfSize`)
    if (halfSize.some(size => size <= 0)) throw new RangeError(`${label}.halfSize must be positive`)
    return { kind: 'cuboid', halfSize, offset }
  }
  throw new TypeError(`${label}.kind must be sphere or cuboid`)
}

function normalizedBody(value: unknown, index: number): MutableSpatialBody {
  if (!isRecord(value)) throw new TypeError(`bodies[${index}] must be an object`)
  if (value.motion !== 'static' && value.motion !== 'dynamic' && value.motion !== 'kinematic') {
    throw new TypeError(`bodies[${index}].motion is invalid`)
  }
  return {
    id: stableId(value.id, `bodies[${index}].id`),
    motion: value.motion,
    position: [...vector(value.position, `bodies[${index}].position`)],
    linearVelocity: [...vector(value.linearVelocity ?? [0, 0, 0], `bodies[${index}].linearVelocity`)],
    mass: positiveNumber(value.mass ?? 1, `bodies[${index}].mass`),
    linearDamping: positiveOrZero(value.linearDamping ?? 0, `bodies[${index}].linearDamping`),
    grounded: false,
    contactIds: new Set(),
    sweepStartPosition: null,
    startOverlapResolved: false,
  }
}

function positiveOrZero(value: unknown, label: string): number {
  const number = finiteNumber(value, label)
  if (number < 0) throw new RangeError(`${label} cannot be negative`)
  return number
}

function normalizedCollider(value: unknown, index: number): SpatialColliderSnapshot {
  if (!isRecord(value)) throw new TypeError(`colliders[${index}] must be an object`)
  if (value.sensor !== undefined && typeof value.sensor !== 'boolean') {
    throw new TypeError(`colliders[${index}].sensor must be boolean`)
  }
  return {
    id: stableId(value.id, `colliders[${index}].id`),
    bodyId: stableId(value.bodyId, `colliders[${index}].bodyId`),
    shape: normalizedShape(value.shape, `colliders[${index}].shape`),
    sensor: value.sensor === true,
    collisionLayer: collisionBits(value.collisionLayer, 1, `colliders[${index}].collisionLayer`),
    collisionMask: collisionBits(value.collisionMask, ALL_COLLISION_BITS, `colliders[${index}].collisionMask`),
    friction: unitInterval(value.friction ?? 0.5, `colliders[${index}].friction`),
    restitution: unitInterval(value.restitution ?? 0, `colliders[${index}].restitution`),
  }
}

function normalizedGround(value: unknown): SpatialGroundSnapshot | null {
  if (value === undefined || value === null) return null
  if (!isRecord(value)) throw new TypeError('ground must be an object')
  if (typeof value.enabled !== 'boolean') throw new TypeError('ground.enabled must be boolean')
  return {
    id: stableId(value.id ?? 'ground', 'ground.id'),
    enabled: value.enabled,
    height: finiteNumber(value.height, 'ground.height'),
    collisionLayer: collisionBits(value.collisionLayer, 1, 'ground.collisionLayer'),
    collisionMask: collisionBits(value.collisionMask, ALL_COLLISION_BITS, 'ground.collisionMask'),
    friction: unitInterval(value.friction ?? 0.5, 'ground.friction'),
    restitution: unitInterval(value.restitution ?? 0, 'ground.restitution'),
  }
}

function cloneShape(shape: SpatialColliderShape): SpatialColliderShape {
  return shape.kind === 'sphere'
    ? { kind: 'sphere', radius: shape.radius, offset: [...(shape.offset ?? [0, 0, 0])] }
    : { kind: 'cuboid', halfSize: [...shape.halfSize], offset: [...(shape.offset ?? [0, 0, 0])] }
}

function cloneCollider(collider: SpatialColliderSnapshot): SpatialColliderSnapshot {
  return { ...collider, shape: cloneShape(collider.shape) }
}

function cloneEvent(event: SpatialPhysicsEvent): SpatialPhysicsEvent {
  return { ...event, colliderIds: [...event.colliderIds], bodyIds: [...event.bodyIds] }
}

function compareInteractions(left: SpatialInteractionSnapshot, right: SpatialInteractionSnapshot): number {
  return compareSpatialIds(left.colliderIds[0], right.colliderIds[0])
    || compareSpatialIds(left.colliderIds[1], right.colliderIds[1])
}

function compareEvents(left: SpatialPhysicsEvent, right: SpatialPhysicsEvent): number {
  return left.tick - right.tick
    || compareSpatialIds(left.colliderIds[0], right.colliderIds[0])
    || compareSpatialIds(left.colliderIds[1], right.colliderIds[1])
    || compareSpatialIds(left.kind, right.kind)
}

export class SpatialPhysicsEngine {
  private fixedStepSeconds: number
  private maxSubSteps: number
  private remainderSeconds = 0
  private readonly state: SpatialStepState

  constructor(options: SpatialPhysicsOptions) {
    if (!isRecord(options)) throw new TypeError('spatial physics options must be an object')
    this.fixedStepSeconds = positiveNumber(options.fixedStepSeconds, 'fixedStepSeconds')
    this.maxSubSteps = positiveSafeInteger(options.maxSubSteps, 'maxSubSteps')
    this.state = {
      bodies: new Map(),
      colliders: new Map(),
      ground: normalizedGround(options.ground),
      gravity: vector(options.gravity, 'gravity'),
      activeInteractions: new Map(),
      pendingEvents: [],
      tick: 0,
    }
    this.replaceBodies(options.bodies ?? [])
    this.replaceColliders(options.colliders ?? [])
    if (this.state.ground && this.state.colliders.has(this.state.ground.id)) {
      throw new Error(`ground id conflicts with collider id: ${this.state.ground.id}`)
    }
  }

  private replaceBodies(values: readonly SpatialBodySpec[]): void {
    this.state.bodies.clear()
    values.forEach((value, index) => {
      const body = normalizedBody(value, index)
      if (this.state.bodies.has(body.id)) throw new Error(`duplicate body id: ${body.id}`)
      this.state.bodies.set(body.id, body)
    })
  }

  private replaceColliders(values: readonly SpatialColliderSpec[]): void {
    this.state.colliders.clear()
    values.forEach((value, index) => {
      const collider = normalizedCollider(value, index)
      if (this.state.colliders.has(collider.id)) throw new Error(`duplicate collider id: ${collider.id}`)
      if (!this.state.bodies.has(collider.bodyId)) {
        throw new Error(`collider ${collider.id} references unknown body ${collider.bodyId}`)
      }
      this.state.colliders.set(collider.id, collider)
    })
  }

  readBody(bodyId: string): SpatialBodyState | null {
    const body = this.state.bodies.get(bodyId)
    if (!body) return null
    return {
      id: body.id,
      motion: body.motion,
      position: [...body.position],
      linearVelocity: [...body.linearVelocity],
      grounded: body.grounded,
      contactIds: [...body.contactIds].sort(compareSpatialIds),
    }
  }

  readBodies(): readonly SpatialBodyState[] {
    return [...this.state.bodies.keys()].sort(compareSpatialIds).map(id => this.readBody(id)!)
  }

  readCollider(colliderId: string): SpatialColliderSnapshot | null {
    const collider = this.state.colliders.get(colliderId)
    return collider ? cloneCollider(collider) : null
  }

  applyImpulse(bodyId: string, impulseValue: SpatialVector): boolean {
    const body = this.state.bodies.get(bodyId)
    if (!body || body.motion !== 'dynamic') return false
    const impulse = vector(impulseValue, 'impulse')
    for (let axis = 0; axis < 3; axis += 1) body.linearVelocity[axis] += impulse[axis] / body.mass
    return true
  }

  setBodyPose(
    bodyId: string,
    positionValue: SpatialVector,
    velocityValue: SpatialVector = [0, 0, 0],
    options: Readonly<{ teleport?: boolean }> = {},
  ): boolean {
    if (!isRecord(options) || (options.teleport !== undefined && typeof options.teleport !== 'boolean')) {
      throw new TypeError('teleport must be boolean')
    }
    const body = this.state.bodies.get(bodyId)
    if (!body) return false
    const position = vector(positionValue, 'position')
    const velocity = vector(velocityValue, 'linearVelocity')
    if (!options.teleport && !body.sweepStartPosition) body.sweepStartPosition = [...body.position]
    body.position.splice(0, 3, ...position)
    body.linearVelocity.splice(0, 3, ...velocity)
    if (options.teleport) {
      body.sweepStartPosition = null
      body.grounded = false
      body.contactIds.clear()
    }
    return true
  }

  advance(elapsedSecondsValue: number): SpatialAdvanceResult {
    const elapsedSeconds = finiteNumber(elapsedSecondsValue, 'elapsedSeconds')
    if (elapsedSeconds < 0) throw new RangeError('elapsedSeconds cannot be negative')
    this.remainderSeconds += elapsedSeconds
    const tolerance = this.fixedStepSeconds * REMAINDER_EPSILON_SCALE
    const availableSteps = Math.floor((this.remainderSeconds + tolerance) / this.fixedStepSeconds)
    const steps = Math.min(availableSteps, this.maxSubSteps)
    this.remainderSeconds -= steps * this.fixedStepSeconds
    if (Math.abs(this.remainderSeconds) <= tolerance) this.remainderSeconds = 0
    for (let index = 0; index < steps; index += 1) this.stepFixed()
    return { steps, tick: this.state.tick, remainderSeconds: this.remainderSeconds }
  }

  stepFixed(): void {
    stepSpatialPhysicsState(this.state, this.fixedStepSeconds)
  }

  drainEvents(): readonly SpatialPhysicsEvent[] {
    const events = this.state.pendingEvents.map(cloneEvent).sort(compareEvents)
    this.state.pendingEvents = []
    return events
  }

  queryPoint(pointValue: SpatialVector, filter?: SpatialQueryFilter): readonly string[] {
    const point = vector(pointValue, 'point')
    const hits = this.queryColliders(filter)
      .filter(collider => spatialShapeContainsPoint(
        placeSpatialShape(collider.shape, this.state.bodies.get(collider.bodyId)!.position), point,
      ))
      .map(collider => collider.id)
    if (this.queryGround(filter) && Math.abs(point[1] - this.state.ground!.height) <= SURFACE_EPSILON) {
      hits.push(this.state.ground!.id)
    }
    return hits.sort(compareSpatialIds)
  }

  queryOverlap(query: SpatialOverlapQuery): readonly string[] {
    const queryShape = placeSpatialShape(normalizedShape(query.shape, 'query.shape'), vector(query.position, 'query.position'))
    const hits = this.queryColliders(query.filter)
      .filter(collider => Boolean(findSpatialCollision(
        queryShape,
        placeSpatialShape(collider.shape, this.state.bodies.get(collider.bodyId)!.position),
      )))
      .map(collider => collider.id)
    if (this.queryGround(query.filter)
      && spatialShapeLowestY(queryShape) <= this.state.ground!.height + SURFACE_EPSILON
      && spatialShapeHighestY(queryShape) >= this.state.ground!.height - SURFACE_EPSILON) {
      hits.push(this.state.ground!.id)
    }
    return hits.sort(compareSpatialIds)
  }

  castRay(query: SpatialRayQuery): readonly SpatialRayHit[] {
    const origin = vector(query.origin, 'ray.origin')
    const direction = vector(query.direction, 'ray.direction')
    const directionLength = Math.hypot(direction[0], direction[1], direction[2])
    if (!(directionLength > 0)) throw new RangeError('ray.direction cannot be zero')
    const unitDirection = scaleSpatialVector(direction, 1 / directionLength)
    const maxDistance = positiveOrZero(query.maxDistance, 'ray.maxDistance')
    const hits: SpatialRayHit[] = []
    for (const collider of this.queryColliders(query.filter)) {
      const distance = raySpatialShapeDistance(
        origin, unitDirection,
        placeSpatialShape(collider.shape, this.state.bodies.get(collider.bodyId)!.position),
      )
      if (distance === null || distance > maxDistance) continue
      hits.push({
        colliderId: collider.id,
        bodyId: collider.bodyId,
        distance,
        point: addSpatialVectors(origin, scaleSpatialVector(unitDirection, distance)),
      })
    }
    if (this.queryGround(query.filter) && Math.abs(unitDirection[1]) > SURFACE_EPSILON) {
      const distance = (this.state.ground!.height - origin[1]) / unitDirection[1]
      if (distance >= 0 && distance <= maxDistance) {
        hits.push({
          colliderId: this.state.ground!.id,
          bodyId: null,
          distance,
          point: addSpatialVectors(origin, scaleSpatialVector(unitDirection, distance)),
        })
      }
    }
    return hits.sort((left, right) => left.distance - right.distance
      || compareSpatialIds(left.colliderId, right.colliderId))
  }

  private queryColliders(filter?: SpatialQueryFilter): SpatialColliderSnapshot[] {
    const layer = collisionBits(filter?.collisionLayer, ALL_COLLISION_BITS, 'filter.collisionLayer')
    const mask = collisionBits(filter?.collisionMask, ALL_COLLISION_BITS, 'filter.collisionMask')
    const excluded = new Set(filter?.excludeColliderIds ?? [])
    return [...this.state.colliders.values()]
      .filter(collider => !excluded.has(collider.id))
      .filter(collider => filter?.includeSensors !== false || !collider.sensor)
      .filter(collider => ((collider.collisionLayer & mask) >>> 0) !== 0
        && ((layer & collider.collisionMask) >>> 0) !== 0)
      .sort((left, right) => compareSpatialIds(left.id, right.id))
  }

  private queryGround(filter?: SpatialQueryFilter): boolean {
    if (!this.state.ground?.enabled || filter?.excludeColliderIds?.includes(this.state.ground.id)) return false
    const layer = collisionBits(filter?.collisionLayer, ALL_COLLISION_BITS, 'filter.collisionLayer')
    const mask = collisionBits(filter?.collisionMask, ALL_COLLISION_BITS, 'filter.collisionMask')
    return ((this.state.ground.collisionLayer & mask) >>> 0) !== 0
      && ((layer & this.state.ground.collisionMask) >>> 0) !== 0
  }

  captureSnapshot(): SpatialPhysicsSnapshot {
    return {
      format: SPATIAL_PHYSICS_SNAPSHOT_FORMAT,
      version: SPATIAL_PHYSICS_SNAPSHOT_VERSION,
      dimension: '3d',
      settings: {
        fixedStepSeconds: this.fixedStepSeconds,
        maxSubSteps: this.maxSubSteps,
        gravity: [...this.state.gravity],
        ground: this.state.ground ? { ...this.state.ground } : null,
      },
      tick: this.state.tick,
      remainderSeconds: this.remainderSeconds,
      bodies: [...this.state.bodies.values()].sort((left, right) => compareSpatialIds(left.id, right.id))
        .map(body => this.bodySnapshot(body)),
      colliders: [...this.state.colliders.values()].sort((left, right) => compareSpatialIds(left.id, right.id))
        .map(cloneCollider),
      activeInteractions: [...this.state.activeInteractions.values()].sort(compareInteractions)
        .map(value => ({ ...value, colliderIds: [...value.colliderIds], bodyIds: [...value.bodyIds] })),
      pendingEvents: this.state.pendingEvents.map(cloneEvent).sort(compareEvents),
    }
  }

  private bodySnapshot(body: MutableSpatialBody): SpatialBodySnapshot {
    return {
      id: body.id,
      motion: body.motion,
      position: [...body.position],
      linearVelocity: [...body.linearVelocity],
      mass: body.mass,
      linearDamping: body.linearDamping,
      grounded: body.grounded,
      contactIds: [...body.contactIds].sort(compareSpatialIds),
      pendingSweepStartPosition: body.sweepStartPosition ? [...body.sweepStartPosition] : null,
    }
  }

  restore(snapshotValue: unknown): void {
    if (!isRecord(snapshotValue)
      || snapshotValue.format !== SPATIAL_PHYSICS_SNAPSHOT_FORMAT
      || snapshotValue.version !== SPATIAL_PHYSICS_SNAPSHOT_VERSION
      || snapshotValue.dimension !== '3d') throw new TypeError('unsupported spatial physics snapshot')
    if (!isRecord(snapshotValue.settings)
      || !Array.isArray(snapshotValue.bodies)
      || !Array.isArray(snapshotValue.colliders)
      || !Array.isArray(snapshotValue.activeInteractions)
      || !Array.isArray(snapshotValue.pendingEvents)) throw new TypeError('malformed spatial physics snapshot')
    const next = new SpatialPhysicsEngine({
      fixedStepSeconds: positiveNumber(snapshotValue.settings.fixedStepSeconds, 'snapshot.settings.fixedStepSeconds'),
      maxSubSteps: positiveSafeInteger(snapshotValue.settings.maxSubSteps, 'snapshot.settings.maxSubSteps'),
      gravity: vector(snapshotValue.settings.gravity, 'snapshot.settings.gravity'),
      ground: snapshotValue.settings.ground as SpatialGroundSpec | undefined,
      bodies: snapshotValue.bodies as readonly SpatialBodySpec[],
      colliders: snapshotValue.colliders as readonly SpatialColliderSpec[],
    })
    next.state.tick = this.snapshotTick(snapshotValue.tick)
    next.remainderSeconds = positiveOrZero(snapshotValue.remainderSeconds, 'snapshot.remainderSeconds')
    next.restoreBodyState(snapshotValue.bodies)
    next.state.activeInteractions = next.readSnapshotInteractions(snapshotValue.activeInteractions)
    next.state.pendingEvents = next.readSnapshotEvents(snapshotValue.pendingEvents)
    this.fixedStepSeconds = next.fixedStepSeconds
    this.maxSubSteps = next.maxSubSteps
    this.remainderSeconds = next.remainderSeconds
    this.state.gravity = next.state.gravity
    this.state.ground = next.state.ground
    this.state.bodies.clear()
    next.state.bodies.forEach((body, id) => this.state.bodies.set(id, body))
    this.state.colliders.clear()
    next.state.colliders.forEach((collider, id) => this.state.colliders.set(id, collider))
    this.state.tick = next.state.tick
    this.state.activeInteractions = next.state.activeInteractions
    this.state.pendingEvents = next.state.pendingEvents
  }

  private snapshotTick(value: unknown): number {
    const tick = positiveOrZero(value, 'snapshot.tick')
    if (!Number.isSafeInteger(tick)) throw new RangeError('snapshot.tick must be a non-negative safe integer')
    return tick
  }

  private restoreBodyState(values: readonly unknown[]): void {
    values.forEach((value, index) => {
      if (!isRecord(value) || typeof value.grounded !== 'boolean' || !Array.isArray(value.contactIds)
        || (value.pendingSweepStartPosition !== null && !Array.isArray(value.pendingSweepStartPosition))) {
        throw new TypeError(`snapshot.bodies[${index}] is malformed`)
      }
      const body = this.state.bodies.get(stableId(value.id, `snapshot.bodies[${index}].id`))!
      body.grounded = value.grounded
      const contactIds = value.contactIds.map((id, contactIndex) => (
        stableId(id, `snapshot.bodies[${index}].contactIds[${contactIndex}]`)
      ))
      if (contactIds.some(id => !this.state.colliders.has(id) && this.state.ground?.id !== id)) {
        throw new Error('snapshot body contact references an unknown collider')
      }
      body.contactIds = new Set(contactIds)
      body.sweepStartPosition = value.pendingSweepStartPosition === null
        ? null
        : [...vector(value.pendingSweepStartPosition, `snapshot.bodies[${index}].pendingSweepStartPosition`)]
    })
  }

  private readSnapshotInteractions(values: readonly unknown[]): Map<string, SpatialInteractionSnapshot> {
    const interactions = new Map<string, SpatialInteractionSnapshot>()
    values.forEach((value, index) => {
      if (!isRecord(value) || !Array.isArray(value.colliderIds) || !Array.isArray(value.bodyIds)
        || value.colliderIds.length !== 2 || value.bodyIds.length !== 2 || typeof value.sensor !== 'boolean') {
        throw new TypeError(`snapshot.activeInteractions[${index}] is malformed`)
      }
      const colliderIds = value.colliderIds.map(id => stableId(id, 'interaction collider id')) as [string, string]
      const bodyIds = value.bodyIds.map(id => id === null ? null : stableId(id, 'interaction body id')) as [string | null, string | null]
      const [key, first, second] = spatialInteractionIdentity(colliderIds[0], colliderIds[1])
      if (first !== colliderIds[0] || second !== colliderIds[1] || interactions.has(key)) {
        throw new Error('snapshot interactions must be unique and code-unit sorted')
      }
      const sensor = this.validateInteractionReferences(colliderIds, bodyIds)
      if (sensor !== value.sensor) throw new Error('snapshot interaction sensor ownership is invalid')
      interactions.set(key, { colliderIds, bodyIds, sensor: value.sensor })
    })
    return interactions
  }

  private validateInteractionReferences(
    colliderIds: readonly [string, string],
    bodyIds: readonly [string | null, string | null],
  ): boolean {
    let sensor = false
    for (let index = 0; index < 2; index += 1) {
      const ground = this.state.ground?.id === colliderIds[index]
      if (ground !== (bodyIds[index] === null)) throw new Error('snapshot interaction ground identity is invalid')
      if (!ground) {
        const collider = this.state.colliders.get(colliderIds[index])
        if (!collider || !this.state.bodies.has(bodyIds[index]!) || collider.bodyId !== bodyIds[index]) {
          throw new Error('snapshot interaction references invalid ownership')
        }
        sensor ||= collider.sensor
      }
    }
    return sensor
  }

  private readSnapshotEvents(values: readonly unknown[]): SpatialPhysicsEvent[] {
    return values.map((value, index) => {
      if (!isRecord(value) || !EVENT_KINDS.has(value.kind as SpatialPhysicsEventKind)
        || !Array.isArray(value.colliderIds) || !Array.isArray(value.bodyIds)
        || value.colliderIds.length !== 2 || value.bodyIds.length !== 2) {
        throw new TypeError(`snapshot.pendingEvents[${index}] is malformed`)
      }
      const tick = this.snapshotTick(value.tick)
      if (tick > this.state.tick) throw new RangeError('snapshot event tick cannot exceed snapshot tick')
      const colliderIds = value.colliderIds.map(id => stableId(id, 'event collider id')) as [string, string]
      const bodyIds = value.bodyIds.map(id => id === null ? null : stableId(id, 'event body id')) as [string | null, string | null]
      const [, first, second] = spatialInteractionIdentity(colliderIds[0], colliderIds[1])
      if (first !== colliderIds[0] || second !== colliderIds[1]) throw new Error('snapshot event ids must be code-unit sorted')
      const sensor = this.validateInteractionReferences(colliderIds, bodyIds)
      if (String(value.kind).startsWith('sensor-') !== sensor) {
        throw new Error('snapshot event sensor ownership is invalid')
      }
      return { kind: value.kind as SpatialPhysicsEventKind, tick, colliderIds, bodyIds }
    }).sort(compareEvents)
  }

  static fromSnapshot(snapshot: unknown): SpatialPhysicsEngine {
    const engine = new SpatialPhysicsEngine({ fixedStepSeconds: 1, maxSubSteps: 1, gravity: [0, 0, 0] })
    engine.restore(snapshot)
    return engine
  }
}
