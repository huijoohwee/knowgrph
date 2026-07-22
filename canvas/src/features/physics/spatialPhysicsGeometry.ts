import type {
  SpatialBodySnapshot,
  SpatialColliderShape,
  SpatialColliderSnapshot,
  SpatialVector,
} from './spatialPhysicsTypes'

export type SpatialWorldSphere = Readonly<{
  kind: 'sphere'
  center: SpatialVector
  radius: number
}>

export type SpatialWorldCuboid = Readonly<{
  kind: 'cuboid'
  center: SpatialVector
  halfSize: SpatialVector
}>

export type SpatialWorldShape = SpatialWorldSphere | SpatialWorldCuboid

export type SpatialCollisionManifold = Readonly<{
  normal: SpatialVector
  penetration: number
  contactPoint: SpatialVector
}>

export type SpatialSweptHit = Readonly<{
  time: number
  normal: SpatialVector
}>

const GEOMETRY_EPSILON = 1e-10
const AXES = [0, 1, 2] as const
const SWEEP_AXIS_ORDER = [1, 0, 2] as const

export function addSpatialVectors(left: SpatialVector, right: SpatialVector): SpatialVector {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
}

export function subtractSpatialVectors(left: SpatialVector, right: SpatialVector): SpatialVector {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
}

export function scaleSpatialVector(value: SpatialVector, scale: number): SpatialVector {
  return [value[0] * scale, value[1] * scale, value[2] * scale]
}

export function dotSpatialVectors(left: SpatialVector, right: SpatialVector): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

function unitSpatialVector(value: SpatialVector): SpatialVector | null {
  const length = Math.hypot(value[0], value[1], value[2])
  return length > GEOMETRY_EPSILON ? scaleSpatialVector(value, 1 / length) : null
}

export function placeSpatialShape(
  shape: SpatialColliderShape,
  position: SpatialVector,
): SpatialWorldShape {
  const center = addSpatialVectors(position, shape.offset ?? [0, 0, 0])
  return shape.kind === 'sphere'
    ? { kind: 'sphere', center, radius: shape.radius }
    : { kind: 'cuboid', center, halfSize: shape.halfSize }
}

export function worldShapeForSpatialCollider(
  body: SpatialBodySnapshot,
  collider: SpatialColliderSnapshot,
): SpatialWorldShape {
  return placeSpatialShape(collider.shape, body.position)
}

function sphereSphereManifold(
  left: SpatialWorldSphere,
  right: SpatialWorldSphere,
): SpatialCollisionManifold | null {
  const delta = subtractSpatialVectors(right.center, left.center)
  const distance = Math.hypot(delta[0], delta[1], delta[2])
  const penetration = left.radius + right.radius - distance
  if (penetration < -GEOMETRY_EPSILON) return null
  const normal = unitSpatialVector(delta) ?? [1, 0, 0]
  return {
    normal,
    penetration: Math.max(0, penetration),
    contactPoint: addSpatialVectors(left.center, scaleSpatialVector(normal, left.radius)),
  }
}

function cuboidCuboidManifold(
  left: SpatialWorldCuboid,
  right: SpatialWorldCuboid,
): SpatialCollisionManifold | null {
  const delta = subtractSpatialVectors(right.center, left.center)
  const penetration: [number, number, number] = [0, 0, 0]
  for (const axis of AXES) {
    penetration[axis] = left.halfSize[axis] + right.halfSize[axis] - Math.abs(delta[axis])
    if (penetration[axis] < -GEOMETRY_EPSILON) return null
  }
  let bestAxis: 0 | 1 | 2 = 1
  for (const axis of SWEEP_AXIS_ORDER) {
    if (penetration[axis] < penetration[bestAxis]) bestAxis = axis
  }
  const normal: [number, number, number] = [0, 0, 0]
  normal[bestAxis] = delta[bestAxis] < 0 ? -1 : 1
  return {
    normal,
    penetration: Math.max(0, penetration[bestAxis]),
    contactPoint: [
      (left.center[0] + right.center[0]) / 2,
      (left.center[1] + right.center[1]) / 2,
      (left.center[2] + right.center[2]) / 2,
    ],
  }
}

function sphereCuboidManifold(
  sphere: SpatialWorldSphere,
  cuboid: SpatialWorldCuboid,
): SpatialCollisionManifold | null {
  const closest: [number, number, number] = [0, 0, 0]
  const local: [number, number, number] = [0, 0, 0]
  for (const axis of AXES) {
    local[axis] = sphere.center[axis] - cuboid.center[axis]
    closest[axis] = cuboid.center[axis]
      + Math.max(-cuboid.halfSize[axis], Math.min(cuboid.halfSize[axis], local[axis]))
  }
  const sphereToCuboid = subtractSpatialVectors(closest, sphere.center)
  const distance = Math.hypot(sphereToCuboid[0], sphereToCuboid[1], sphereToCuboid[2])
  if (distance > GEOMETRY_EPSILON) {
    const penetration = sphere.radius - distance
    if (penetration < -GEOMETRY_EPSILON) return null
    return {
      normal: scaleSpatialVector(sphereToCuboid, 1 / distance),
      penetration: Math.max(0, penetration),
      contactPoint: closest,
    }
  }

  let nearestAxis: 0 | 1 | 2 = 1
  let nearestGap = Number.POSITIVE_INFINITY
  for (const axis of SWEEP_AXIS_ORDER) {
    const gap = cuboid.halfSize[axis] - Math.abs(local[axis])
    if (gap < nearestGap) {
      nearestGap = gap
      nearestAxis = axis
    }
  }
  const outward: [number, number, number] = [0, 0, 0]
  outward[nearestAxis] = local[nearestAxis] < 0 ? -1 : 1
  return {
    normal: scaleSpatialVector(outward, -1),
    penetration: sphere.radius + nearestGap,
    contactPoint: addSpatialVectors(sphere.center, scaleSpatialVector(outward, nearestGap)),
  }
}

export function findSpatialCollision(
  left: SpatialWorldShape,
  right: SpatialWorldShape,
): SpatialCollisionManifold | null {
  if (left.kind === 'sphere' && right.kind === 'sphere') return sphereSphereManifold(left, right)
  if (left.kind === 'cuboid' && right.kind === 'cuboid') return cuboidCuboidManifold(left, right)
  if (left.kind === 'sphere' && right.kind === 'cuboid') return sphereCuboidManifold(left, right)
  const manifold = sphereCuboidManifold(right as SpatialWorldSphere, left as SpatialWorldCuboid)
  return manifold ? { ...manifold, normal: scaleSpatialVector(manifold.normal, -1) } : null
}

export function spatialShapeContainsPoint(shape: SpatialWorldShape, point: SpatialVector): boolean {
  if (shape.kind === 'sphere') {
    const delta = subtractSpatialVectors(point, shape.center)
    return dotSpatialVectors(delta, delta) <= shape.radius * shape.radius + GEOMETRY_EPSILON
  }
  return AXES.every(axis => (
    Math.abs(point[axis] - shape.center[axis]) <= shape.halfSize[axis] + GEOMETRY_EPSILON
  ))
}

function raySphereDistance(
  origin: SpatialVector,
  direction: SpatialVector,
  sphere: SpatialWorldSphere,
): number | null {
  const offset = subtractSpatialVectors(origin, sphere.center)
  const along = dotSpatialVectors(offset, direction)
  const constant = dotSpatialVectors(offset, offset) - sphere.radius * sphere.radius
  const discriminant = along * along - constant
  if (discriminant < 0) return null
  const root = Math.sqrt(discriminant)
  const near = -along - root
  const far = -along + root
  if (near >= 0) return near
  return far >= 0 ? far : null
}

function rayCuboidDistance(
  origin: SpatialVector,
  direction: SpatialVector,
  cuboid: SpatialWorldCuboid,
): number | null {
  let entry = Number.NEGATIVE_INFINITY
  let exit = Number.POSITIVE_INFINITY
  for (const axis of AXES) {
    const localOrigin = origin[axis] - cuboid.center[axis]
    if (Math.abs(direction[axis]) <= GEOMETRY_EPSILON) {
      if (Math.abs(localOrigin) > cuboid.halfSize[axis]) return null
      continue
    }
    const first = (-cuboid.halfSize[axis] - localOrigin) / direction[axis]
    const second = (cuboid.halfSize[axis] - localOrigin) / direction[axis]
    entry = Math.max(entry, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
    if (entry > exit) return null
  }
  if (entry >= 0) return entry
  return exit >= 0 ? exit : null
}

export function raySpatialShapeDistance(
  origin: SpatialVector,
  directionValue: SpatialVector,
  shape: SpatialWorldShape,
): number | null {
  const direction = unitSpatialVector(directionValue)
  if (!direction) return null
  return shape.kind === 'sphere'
    ? raySphereDistance(origin, direction, shape)
    : rayCuboidDistance(origin, direction, shape)
}

export function spatialShapeLowestY(shape: SpatialWorldShape): number {
  return shape.center[1] - (shape.kind === 'sphere' ? shape.radius : shape.halfSize[1])
}

export function spatialShapeHighestY(shape: SpatialWorldShape): number {
  return shape.center[1] + (shape.kind === 'sphere' ? shape.radius : shape.halfSize[1])
}

export function spatialShapeGroundContactTime(
  start: SpatialWorldShape,
  end: SpatialWorldShape,
  groundHeight: number,
): number | null {
  const startBottom = spatialShapeLowestY(start)
  const endBottom = spatialShapeLowestY(end)
  if (startBottom <= groundHeight + GEOMETRY_EPSILON) {
    if (Math.abs(startBottom - groundHeight) <= GEOMETRY_EPSILON
      && Math.abs(endBottom - groundHeight) <= GEOMETRY_EPSILON) return 0
    return startBottom < groundHeight || endBottom < groundHeight ? 0 : null
  }
  if (endBottom > groundHeight) return null
  return (startBottom - groundHeight) / (startBottom - endBottom)
}

export function findSweptSpatialCuboidHit(
  leftStart: SpatialWorldCuboid,
  leftEnd: SpatialWorldCuboid,
  rightStart: SpatialWorldCuboid,
  rightEnd: SpatialWorldCuboid,
): SpatialSweptHit | null {
  if (findSpatialCollision(leftStart, rightStart)) return null
  let entryTime = Number.NEGATIVE_INFINITY
  let exitTime = Number.POSITIVE_INFINITY
  let entryAxis: 0 | 1 | 2 | null = null
  const relativeDelta: [number, number, number] = [0, 0, 0]
  for (const axis of SWEEP_AXIS_ORDER) {
    const halfExtent = leftStart.halfSize[axis] + rightStart.halfSize[axis]
    const relativeStart = leftStart.center[axis] - rightStart.center[axis]
    relativeDelta[axis] = (leftEnd.center[axis] - leftStart.center[axis])
      - (rightEnd.center[axis] - rightStart.center[axis])
    const delta = relativeDelta[axis]
    if (Math.abs(delta) <= GEOMETRY_EPSILON) {
      if (Math.abs(relativeStart) > halfExtent) return null
      continue
    }
    const first = (-halfExtent - relativeStart) / delta
    const second = (halfExtent - relativeStart) / delta
    const axisEntry = Math.min(first, second)
    const axisExit = Math.max(first, second)
    if (entryAxis === null || axisEntry > entryTime + GEOMETRY_EPSILON) {
      entryTime = axisEntry
      entryAxis = axis
    }
    exitTime = Math.min(exitTime, axisExit)
    if (entryTime > exitTime + GEOMETRY_EPSILON) return null
  }
  if (entryAxis === null || entryTime < -GEOMETRY_EPSILON
    || entryTime > 1 + GEOMETRY_EPSILON || exitTime < -GEOMETRY_EPSILON) return null
  const normal: [number, number, number] = [0, 0, 0]
  normal[entryAxis] = relativeDelta[entryAxis] > 0 ? 1 : -1
  return { time: Math.max(0, Math.min(1, entryTime)), normal }
}
