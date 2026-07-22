import {
  addPlanarVectors,
  crossPlanarVectors,
  dotPlanarVectors,
  findPlanarCollision,
  placePlanarShape,
  planarShapeContainsPoint,
  rayDistanceToPlanarShape,
  scalePlanarVector,
  subtractPlanarVectors,
  worldShapeForCollider,
  type PlanarCollisionManifold,
} from './planarPhysicsGeometry'
import {
  PLANAR_PHYSICS_SNAPSHOT_FORMAT,
  PLANAR_PHYSICS_SNAPSHOT_VERSION,
  type PlanarAdvanceResult,
  type PlanarBodySnapshot,
  type PlanarBodySpec,
  type PlanarBodyState,
  type PlanarColliderShape,
  type PlanarColliderSnapshot,
  type PlanarColliderSpec,
  type PlanarInteractionSnapshot,
  type PlanarOverlapQuery,
  type PlanarPhysicsEvent,
  type PlanarPhysicsEventKind,
  type PlanarPhysicsOptions,
  type PlanarPhysicsSnapshot,
  type PlanarQueryFilter,
  type PlanarRayHit,
  type PlanarRayQuery,
  type PlanarVector,
} from './planarPhysicsTypes'

type MutablePlanarBody = {
  id: string
  motion: PlanarBodySnapshot['motion']
  position: [number, number]
  rotationRadians: number
  linearVelocity: [number, number]
  angularVelocity: number
  mass: number
  rotationalMass: number
  restitution: number
}

const ALL_COLLISION_BITS = 0xffff_ffff
const REMAINDER_EPSILON_SCALE = 1e-10
const EVENT_KINDS = new Set<PlanarPhysicsEventKind>([
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

function vector(value: unknown, label: string): PlanarVector {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${label} must contain two numbers`)
  return [finiteNumber(value[0], `${label}[0]`), finiteNumber(value[1], `${label}[1]`)]
}

function collisionBits(value: unknown, fallback: number, label: string): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > ALL_COLLISION_BITS) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer`)
  }
  return value >>> 0
}

function normalizedShape(value: unknown, label: string): PlanarColliderShape {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`)
  const offset = value.offset === undefined ? [0, 0] as const : vector(value.offset, `${label}.offset`)
  const rotationRadians = value.rotationRadians === undefined
    ? 0
    : finiteNumber(value.rotationRadians, `${label}.rotationRadians`)
  if (value.kind === 'circle') {
    return { kind: 'circle', radius: positiveNumber(value.radius, `${label}.radius`), offset, rotationRadians }
  }
  if (value.kind === 'box') {
    const halfSize = vector(value.halfSize, `${label}.halfSize`)
    if (halfSize[0] <= 0 || halfSize[1] <= 0) throw new RangeError(`${label}.halfSize must be positive`)
    return { kind: 'box', halfSize, offset, rotationRadians }
  }
  throw new TypeError(`${label}.kind must be circle or box`)
}

function normalizedBody(value: unknown, index: number): MutablePlanarBody {
  if (!isRecord(value)) throw new TypeError(`bodies[${index}] must be an object`)
  if (value.motion !== 'static' && value.motion !== 'dynamic' && value.motion !== 'kinematic') {
    throw new TypeError(`bodies[${index}].motion is invalid`)
  }
  return {
    id: stableId(value.id, `bodies[${index}].id`),
    motion: value.motion,
    position: [...vector(value.position, `bodies[${index}].position`)],
    rotationRadians: value.rotationRadians === undefined ? 0 : finiteNumber(value.rotationRadians, `bodies[${index}].rotationRadians`),
    linearVelocity: [...vector(value.linearVelocity ?? [0, 0], `bodies[${index}].linearVelocity`)],
    angularVelocity: value.angularVelocity === undefined ? 0 : finiteNumber(value.angularVelocity, `bodies[${index}].angularVelocity`),
    mass: positiveNumber(value.mass ?? 1, `bodies[${index}].mass`),
    rotationalMass: positiveNumber(value.rotationalMass ?? value.mass ?? 1, `bodies[${index}].rotationalMass`),
    restitution: unitInterval(value.restitution ?? 0, `bodies[${index}].restitution`),
  }
}

function normalizedCollider(value: unknown, index: number): PlanarColliderSnapshot {
  if (!isRecord(value)) throw new TypeError(`colliders[${index}] must be an object`)
  if (value.sensor !== undefined && typeof value.sensor !== 'boolean') throw new TypeError(`colliders[${index}].sensor must be boolean`)
  return {
    id: stableId(value.id, `colliders[${index}].id`),
    bodyId: stableId(value.bodyId, `colliders[${index}].bodyId`),
    shape: normalizedShape(value.shape, `colliders[${index}].shape`),
    sensor: value.sensor === true,
    collisionLayer: collisionBits(value.collisionLayer, 1, `colliders[${index}].collisionLayer`),
    collisionMask: collisionBits(value.collisionMask, ALL_COLLISION_BITS, `colliders[${index}].collisionMask`),
  }
}

function bodySnapshot(body: MutablePlanarBody): PlanarBodySnapshot {
  return {
    ...body,
    position: [...body.position],
    linearVelocity: [...body.linearVelocity],
  }
}

function cloneShape(shape: PlanarColliderShape): PlanarColliderShape {
  return shape.kind === 'circle'
    ? { kind: 'circle', radius: shape.radius, offset: [...(shape.offset ?? [0, 0])], rotationRadians: shape.rotationRadians }
    : { kind: 'box', halfSize: [...shape.halfSize], offset: [...(shape.offset ?? [0, 0])], rotationRadians: shape.rotationRadians }
}

function cloneCollider(collider: PlanarColliderSnapshot): PlanarColliderSnapshot {
  return { ...collider, shape: cloneShape(collider.shape) }
}

function pairKey(leftColliderId: string, rightColliderId: string): string {
  return JSON.stringify(leftColliderId < rightColliderId
    ? [leftColliderId, rightColliderId]
    : [rightColliderId, leftColliderId])
}

function comparePlanarIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareInteractions(left: PlanarInteractionSnapshot, right: PlanarInteractionSnapshot): number {
  return comparePlanarIds(left.colliderIds[0], right.colliderIds[0])
    || comparePlanarIds(left.colliderIds[1], right.colliderIds[1])
}

function compareEvents(left: PlanarPhysicsEvent, right: PlanarPhysicsEvent): number {
  return left.tick - right.tick
    || comparePlanarIds(left.colliderIds[0], right.colliderIds[0])
    || comparePlanarIds(left.colliderIds[1], right.colliderIds[1])
    || comparePlanarIds(left.kind, right.kind)
}

function groupsInteract(left: PlanarColliderSnapshot, right: PlanarColliderSnapshot): boolean {
  return ((left.collisionLayer & right.collisionMask) >>> 0) !== 0
    && ((right.collisionLayer & left.collisionMask) >>> 0) !== 0
}

function inverseMass(body: MutablePlanarBody): number {
  return body.motion === 'dynamic' ? 1 / body.mass : 0
}

function inverseRotationalMass(body: MutablePlanarBody): number {
  return body.motion === 'dynamic' ? 1 / body.rotationalMass : 0
}

function pointVelocity(body: MutablePlanarBody, point: PlanarVector): PlanarVector {
  const arm = subtractPlanarVectors(point, body.position)
  return addPlanarVectors(body.linearVelocity, [-body.angularVelocity * arm[1], body.angularVelocity * arm[0]])
}

function copyEvent(event: PlanarPhysicsEvent): PlanarPhysicsEvent {
  return { ...event, colliderIds: [...event.colliderIds], bodyIds: [...event.bodyIds] }
}

export class PlanarPhysicsEngine {
  private fixedStepSeconds: number
  private maxSubSteps: number
  private gravity: PlanarVector
  private readonly bodies = new Map<string, MutablePlanarBody>()
  private readonly colliders = new Map<string, PlanarColliderSnapshot>()
  private activeInteractions = new Map<string, PlanarInteractionSnapshot>()
  private pendingEvents: PlanarPhysicsEvent[] = []
  private tick = 0
  private remainderSeconds = 0

  constructor(options: PlanarPhysicsOptions) {
    this.fixedStepSeconds = positiveNumber(options.fixedStepSeconds, 'fixedStepSeconds')
    this.maxSubSteps = positiveSafeInteger(options.maxSubSteps, 'maxSubSteps')
    this.gravity = vector(options.gravity, 'gravity')
    this.replaceBodies(options.bodies ?? [])
    this.replaceColliders(options.colliders ?? [])
  }

  private replaceBodies(values: readonly PlanarBodySpec[]): void {
    this.bodies.clear()
    values.forEach((value, index) => {
      const body = normalizedBody(value, index)
      if (this.bodies.has(body.id)) throw new Error(`duplicate body id: ${body.id}`)
      this.bodies.set(body.id, body)
    })
  }

  private replaceColliders(values: readonly PlanarColliderSpec[]): void {
    this.colliders.clear()
    values.forEach((value, index) => {
      const collider = normalizedCollider(value, index)
      if (this.colliders.has(collider.id)) throw new Error(`duplicate collider id: ${collider.id}`)
      if (!this.bodies.has(collider.bodyId)) throw new Error(`collider ${collider.id} references unknown body ${collider.bodyId}`)
      this.colliders.set(collider.id, collider)
    })
  }

  readBody(bodyId: string): PlanarBodyState | null {
    const body = this.bodies.get(bodyId)
    if (!body) return null
    return {
      id: body.id,
      motion: body.motion,
      position: [...body.position],
      rotationRadians: body.rotationRadians,
      linearVelocity: [...body.linearVelocity],
      angularVelocity: body.angularVelocity,
    }
  }

  readCollider(colliderId: string): PlanarColliderSnapshot | null {
    const collider = this.colliders.get(colliderId)
    return collider ? cloneCollider(collider) : null
  }

  applyImpulse(bodyId: string, impulse: PlanarVector, worldPoint?: PlanarVector): boolean {
    const body = this.bodies.get(bodyId)
    if (!body || body.motion !== 'dynamic') return false
    const safeImpulse = vector(impulse, 'impulse')
    body.linearVelocity[0] += safeImpulse[0] / body.mass
    body.linearVelocity[1] += safeImpulse[1] / body.mass
    if (worldPoint) {
      const arm = subtractPlanarVectors(vector(worldPoint, 'worldPoint'), body.position)
      body.angularVelocity += crossPlanarVectors(arm, safeImpulse) / body.rotationalMass
    }
    return true
  }

  applyAngularImpulse(bodyId: string, impulse: number): boolean {
    const body = this.bodies.get(bodyId)
    if (!body || body.motion !== 'dynamic') return false
    body.angularVelocity += finiteNumber(impulse, 'angularImpulse') / body.rotationalMass
    return true
  }

  setKinematicVelocity(bodyId: string, linearVelocity: PlanarVector, angularVelocity = 0): boolean {
    const body = this.bodies.get(bodyId)
    if (!body || body.motion !== 'kinematic') return false
    const nextLinearVelocity = vector(linearVelocity, 'linearVelocity')
    const nextAngularVelocity = finiteNumber(angularVelocity, 'angularVelocity')
    body.linearVelocity = [...nextLinearVelocity]
    body.angularVelocity = nextAngularVelocity
    return true
  }

  advance(elapsedSeconds: number): PlanarAdvanceResult {
    const elapsed = finiteNumber(elapsedSeconds, 'elapsedSeconds')
    if (elapsed < 0) throw new RangeError('elapsedSeconds cannot be negative')
    this.remainderSeconds += elapsed
    const tolerance = this.fixedStepSeconds * REMAINDER_EPSILON_SCALE
    const availableSteps = Math.floor((this.remainderSeconds + tolerance) / this.fixedStepSeconds)
    const steps = Math.min(availableSteps, this.maxSubSteps)
    this.remainderSeconds -= steps * this.fixedStepSeconds
    if (Math.abs(this.remainderSeconds) <= tolerance) this.remainderSeconds = 0
    for (let index = 0; index < steps; index += 1) this.stepFixed()
    return { steps, tick: this.tick, remainderSeconds: this.remainderSeconds }
  }

  stepFixed(): void {
    this.tick += 1
    for (const body of [...this.bodies.values()].sort((left, right) => comparePlanarIds(left.id, right.id))) {
      if (body.motion === 'dynamic') {
        body.linearVelocity[0] += this.gravity[0] * this.fixedStepSeconds
        body.linearVelocity[1] += this.gravity[1] * this.fixedStepSeconds
      }
      if (body.motion === 'static') continue
      body.position[0] += body.linearVelocity[0] * this.fixedStepSeconds
      body.position[1] += body.linearVelocity[1] * this.fixedStepSeconds
      body.rotationRadians += body.angularVelocity * this.fixedStepSeconds
    }
    this.resolveInteractions()
  }

  private resolveInteractions(): void {
    const colliderIds = [...this.colliders.keys()].sort(comparePlanarIds)
    const current = new Map<string, PlanarInteractionSnapshot>()
    for (let leftIndex = 0; leftIndex < colliderIds.length; leftIndex += 1) {
      const leftCollider = this.colliders.get(colliderIds[leftIndex])!
      for (let rightIndex = leftIndex + 1; rightIndex < colliderIds.length; rightIndex += 1) {
        const rightCollider = this.colliders.get(colliderIds[rightIndex])!
        if (leftCollider.bodyId === rightCollider.bodyId || !groupsInteract(leftCollider, rightCollider)) continue
        const leftBody = this.bodies.get(leftCollider.bodyId)!
        const rightBody = this.bodies.get(rightCollider.bodyId)!
        const manifold = findPlanarCollision(
          worldShapeForCollider(bodySnapshot(leftBody), leftCollider),
          worldShapeForCollider(bodySnapshot(rightBody), rightCollider),
        )
        if (!manifold) continue
        const interaction: PlanarInteractionSnapshot = {
          colliderIds: [leftCollider.id, rightCollider.id],
          bodyIds: [leftBody.id, rightBody.id],
          sensor: leftCollider.sensor || rightCollider.sensor,
        }
        current.set(pairKey(leftCollider.id, rightCollider.id), interaction)
        if (!interaction.sensor) this.resolveCollision(leftBody, rightBody, manifold)
      }
    }
    this.recordInteractionChanges(current)
    this.activeInteractions = current
  }

  private resolveCollision(
    left: MutablePlanarBody,
    right: MutablePlanarBody,
    manifold: PlanarCollisionManifold,
  ): void {
    const leftInverseMass = inverseMass(left)
    const rightInverseMass = inverseMass(right)
    const inverseMassSum = leftInverseMass + rightInverseMass
    if (inverseMassSum <= 0) return
    const correction = scalePlanarVector(manifold.normal, manifold.penetration / inverseMassSum)
    left.position[0] -= correction[0] * leftInverseMass
    left.position[1] -= correction[1] * leftInverseMass
    right.position[0] += correction[0] * rightInverseMass
    right.position[1] += correction[1] * rightInverseMass

    const leftArm = subtractPlanarVectors(manifold.contactPoint, left.position)
    const rightArm = subtractPlanarVectors(manifold.contactPoint, right.position)
    const relativeVelocity = subtractPlanarVectors(
      pointVelocity(right, manifold.contactPoint),
      pointVelocity(left, manifold.contactPoint),
    )
    const closingSpeed = dotPlanarVectors(relativeVelocity, manifold.normal)
    if (closingSpeed >= 0) return
    const leftArmNormal = crossPlanarVectors(leftArm, manifold.normal)
    const rightArmNormal = crossPlanarVectors(rightArm, manifold.normal)
    const denominator = inverseMassSum
      + leftArmNormal * leftArmNormal * inverseRotationalMass(left)
      + rightArmNormal * rightArmNormal * inverseRotationalMass(right)
    if (denominator <= 0) return
    const restitution = Math.min(left.restitution, right.restitution)
    const impulseMagnitude = -(1 + restitution) * closingSpeed / denominator
    const impulse = scalePlanarVector(manifold.normal, impulseMagnitude)
    left.linearVelocity[0] -= impulse[0] * leftInverseMass
    left.linearVelocity[1] -= impulse[1] * leftInverseMass
    right.linearVelocity[0] += impulse[0] * rightInverseMass
    right.linearVelocity[1] += impulse[1] * rightInverseMass
    left.angularVelocity -= leftArmNormal * impulseMagnitude * inverseRotationalMass(left)
    right.angularVelocity += rightArmNormal * impulseMagnitude * inverseRotationalMass(right)
  }

  private recordInteractionChanges(current: Map<string, PlanarInteractionSnapshot>): void {
    const changes: PlanarPhysicsEvent[] = []
    const currentKeys = [...current.keys()].sort(comparePlanarIds)
    for (const key of currentKeys) {
      if (this.activeInteractions.has(key)) continue
      const interaction = current.get(key)!
      changes.push(this.interactionEvent(interaction, interaction.sensor ? 'sensor-began' : 'collision-began'))
    }
    for (const key of [...this.activeInteractions.keys()].sort(comparePlanarIds)) {
      if (current.has(key)) continue
      const interaction = this.activeInteractions.get(key)!
      changes.push(this.interactionEvent(interaction, interaction.sensor ? 'sensor-ended' : 'collision-ended'))
    }
    this.pendingEvents.push(...changes.sort(compareEvents))
  }

  private interactionEvent(interaction: PlanarInteractionSnapshot, kind: PlanarPhysicsEventKind): PlanarPhysicsEvent {
    return { kind, tick: this.tick, colliderIds: [...interaction.colliderIds], bodyIds: [...interaction.bodyIds] }
  }

  drainEvents(): readonly PlanarPhysicsEvent[] {
    const events = this.pendingEvents.map(copyEvent)
    this.pendingEvents = []
    return events
  }

  queryPoint(pointValue: PlanarVector, filter?: PlanarQueryFilter): readonly string[] {
    const point = vector(pointValue, 'point')
    return this.queryColliders(filter)
      .filter(collider => planarShapeContainsPoint(
        worldShapeForCollider(bodySnapshot(this.bodies.get(collider.bodyId)!), collider),
        point,
      ))
      .map(collider => collider.id)
  }

  queryOverlap(query: PlanarOverlapQuery): readonly string[] {
    const queryShape = placePlanarShape(
      normalizedShape(query.shape, 'query.shape'),
      vector(query.position, 'query.position'),
      finiteNumber(query.rotationRadians ?? 0, 'query.rotationRadians'),
    )
    return this.queryColliders(query.filter)
      .filter(collider => Boolean(findPlanarCollision(
        queryShape,
        worldShapeForCollider(bodySnapshot(this.bodies.get(collider.bodyId)!), collider),
      )))
      .map(collider => collider.id)
  }

  castRay(query: PlanarRayQuery): readonly PlanarRayHit[] {
    const origin = vector(query.origin, 'ray.origin')
    const direction = vector(query.direction, 'ray.direction')
    const directionLength = Math.hypot(direction[0], direction[1])
    if (directionLength <= 0) throw new RangeError('ray.direction cannot be zero')
    const maxDistance = finiteNumber(query.maxDistance, 'ray.maxDistance')
    if (maxDistance < 0) throw new RangeError('ray.maxDistance cannot be negative')
    const unitDirection = scalePlanarVector(direction, 1 / directionLength)
    const hits: PlanarRayHit[] = []
    for (const collider of this.queryColliders(query.filter)) {
      const distance = rayDistanceToPlanarShape(
        origin,
        unitDirection,
        worldShapeForCollider(bodySnapshot(this.bodies.get(collider.bodyId)!), collider),
      )
      if (distance === null || distance > maxDistance) continue
      hits.push({
        colliderId: collider.id,
        bodyId: collider.bodyId,
        distance,
        point: addPlanarVectors(origin, scalePlanarVector(unitDirection, distance)),
      })
    }
    return hits.sort((left, right) => left.distance - right.distance || comparePlanarIds(left.colliderId, right.colliderId))
  }

  private queryColliders(filter?: PlanarQueryFilter): PlanarColliderSnapshot[] {
    const layer = collisionBits(filter?.collisionLayer, ALL_COLLISION_BITS, 'filter.collisionLayer')
    const mask = collisionBits(filter?.collisionMask, ALL_COLLISION_BITS, 'filter.collisionMask')
    const excluded = new Set(filter?.excludeColliderIds ?? [])
    return [...this.colliders.values()]
      .filter(collider => !excluded.has(collider.id))
      .filter(collider => filter?.includeSensors !== false || !collider.sensor)
      .filter(collider => ((collider.collisionLayer & mask) >>> 0) !== 0 && ((layer & collider.collisionMask) >>> 0) !== 0)
      .sort((left, right) => comparePlanarIds(left.id, right.id))
  }

  captureSnapshot(): PlanarPhysicsSnapshot {
    return {
      format: PLANAR_PHYSICS_SNAPSHOT_FORMAT,
      version: PLANAR_PHYSICS_SNAPSHOT_VERSION,
      dimension: '2d',
      settings: { fixedStepSeconds: this.fixedStepSeconds, maxSubSteps: this.maxSubSteps, gravity: [...this.gravity] },
      tick: this.tick,
      remainderSeconds: this.remainderSeconds,
      bodies: [...this.bodies.values()].sort((left, right) => comparePlanarIds(left.id, right.id)).map(bodySnapshot),
      colliders: [...this.colliders.values()].sort((left, right) => comparePlanarIds(left.id, right.id)).map(cloneCollider),
      activeInteractions: [...this.activeInteractions.values()].sort(compareInteractions).map(interaction => ({
        ...interaction,
        colliderIds: [...interaction.colliderIds],
        bodyIds: [...interaction.bodyIds],
      })),
      pendingEvents: this.pendingEvents.map(copyEvent).sort(compareEvents),
    }
  }

  restore(snapshotValue: unknown): void {
    if (!isRecord(snapshotValue)
      || snapshotValue.format !== PLANAR_PHYSICS_SNAPSHOT_FORMAT
      || snapshotValue.version !== PLANAR_PHYSICS_SNAPSHOT_VERSION
      || snapshotValue.dimension !== '2d') throw new TypeError('unsupported planar physics snapshot')
    if (!isRecord(snapshotValue.settings)
      || !Array.isArray(snapshotValue.bodies)
      || !Array.isArray(snapshotValue.colliders)
      || !Array.isArray(snapshotValue.activeInteractions)
      || !Array.isArray(snapshotValue.pendingEvents)) throw new TypeError('malformed planar physics snapshot')
    const fixedStepSeconds = positiveNumber(snapshotValue.settings.fixedStepSeconds, 'snapshot.settings.fixedStepSeconds')
    const maxSubSteps = positiveSafeInteger(snapshotValue.settings.maxSubSteps, 'snapshot.settings.maxSubSteps')
    const gravity = vector(snapshotValue.settings.gravity, 'snapshot.settings.gravity')
    const tick = finiteNumber(snapshotValue.tick, 'snapshot.tick')
    const remainderSeconds = finiteNumber(snapshotValue.remainderSeconds, 'snapshot.remainderSeconds')
    if (!Number.isSafeInteger(tick) || tick < 0) throw new RangeError('snapshot.tick must be a non-negative safe integer')
    if (remainderSeconds < 0) throw new RangeError('snapshot remainder cannot be negative')

    const next = new PlanarPhysicsEngine({
      fixedStepSeconds,
      maxSubSteps,
      gravity,
      bodies: snapshotValue.bodies as readonly PlanarBodySpec[],
      colliders: snapshotValue.colliders as readonly PlanarColliderSpec[],
    })
    next.tick = tick
    next.remainderSeconds = remainderSeconds
    next.activeInteractions = next.readSnapshotInteractions(snapshotValue.activeInteractions)
    next.pendingEvents = next.readSnapshotEvents(snapshotValue.pendingEvents)
    this.fixedStepSeconds = next.fixedStepSeconds
    this.maxSubSteps = next.maxSubSteps
    this.gravity = next.gravity
    this.bodies.clear()
    next.bodies.forEach((body, id) => this.bodies.set(id, body))
    this.colliders.clear()
    next.colliders.forEach((collider, id) => this.colliders.set(id, collider))
    this.tick = next.tick
    this.remainderSeconds = next.remainderSeconds
    this.activeInteractions = next.activeInteractions
    this.pendingEvents = next.pendingEvents
  }

  private readSnapshotInteractions(values: readonly unknown[]): Map<string, PlanarInteractionSnapshot> {
    const interactions = new Map<string, PlanarInteractionSnapshot>()
    values.forEach((value, index) => {
      if (!isRecord(value) || !Array.isArray(value.colliderIds) || !Array.isArray(value.bodyIds)
        || value.colliderIds.length !== 2 || value.bodyIds.length !== 2 || typeof value.sensor !== 'boolean') {
        throw new TypeError(`snapshot.activeInteractions[${index}] is malformed`)
      }
      const colliderIds = value.colliderIds.map((id, pairIndex) => stableId(id, `interaction collider ${pairIndex}`)) as [string, string]
      const bodyIds = value.bodyIds.map((id, pairIndex) => stableId(id, `interaction body ${pairIndex}`)) as [string, string]
      this.validateInteractionReferences(colliderIds, bodyIds, value.sensor)
      const interaction = { colliderIds, bodyIds, sensor: value.sensor }
      const key = pairKey(colliderIds[0], colliderIds[1])
      if (interactions.has(key)) throw new Error('snapshot contains a duplicate interaction')
      interactions.set(key, interaction)
    })
    return interactions
  }

  private validateInteractionReferences(
    colliderIds: readonly [string, string],
    bodyIds: readonly [string, string],
    sensor?: boolean,
  ): void {
    const left = this.colliders.get(colliderIds[0])
    const right = this.colliders.get(colliderIds[1])
    if (!left || !right || comparePlanarIds(left.id, right.id) >= 0) {
      throw new Error('snapshot interaction collider ids must exist and be code-unit sorted')
    }
    if (left.bodyId !== bodyIds[0] || right.bodyId !== bodyIds[1]) {
      throw new Error('snapshot interaction body ownership is invalid')
    }
    if (sensor !== undefined && sensor !== (left.sensor || right.sensor)) {
      throw new Error('snapshot interaction sensor ownership is invalid')
    }
  }

  private readSnapshotEvents(values: readonly unknown[]): PlanarPhysicsEvent[] {
    return values.map((value, index) => {
      if (!isRecord(value) || !EVENT_KINDS.has(value.kind as PlanarPhysicsEventKind)
        || !Array.isArray(value.colliderIds) || !Array.isArray(value.bodyIds)
        || value.colliderIds.length !== 2 || value.bodyIds.length !== 2) throw new TypeError(`snapshot.pendingEvents[${index}] is malformed`)
      const eventTick = finiteNumber(value.tick, `snapshot.pendingEvents[${index}].tick`)
      if (!Number.isSafeInteger(eventTick) || eventTick < 0 || eventTick > this.tick) throw new RangeError('snapshot event tick is invalid')
      const colliderIds = value.colliderIds.map(id => stableId(id, 'event collider id')) as [string, string]
      const bodyIds = value.bodyIds.map(id => stableId(id, 'event body id')) as [string, string]
      const sensor = String(value.kind).startsWith('sensor-')
      this.validateInteractionReferences(colliderIds, bodyIds, sensor)
      return { kind: value.kind as PlanarPhysicsEventKind, tick: eventTick, colliderIds, bodyIds }
    })
  }

  static fromSnapshot(snapshot: unknown): PlanarPhysicsEngine {
    const engine = new PlanarPhysicsEngine({ fixedStepSeconds: 1, maxSubSteps: 1, gravity: [0, 0] })
    engine.restore(snapshot)
    return engine
  }
}
