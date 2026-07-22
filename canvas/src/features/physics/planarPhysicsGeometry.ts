import type {
  PlanarBodySnapshot,
  PlanarColliderShape,
  PlanarColliderSnapshot,
  PlanarVector,
} from './planarPhysicsTypes'

export type PlanarWorldCircle = Readonly<{
  kind: 'circle'
  center: PlanarVector
  radius: number
}>

export type PlanarWorldBox = Readonly<{
  kind: 'box'
  center: PlanarVector
  halfSize: PlanarVector
  rotationRadians: number
}>

export type PlanarWorldShape = PlanarWorldCircle | PlanarWorldBox

export type PlanarCollisionManifold = Readonly<{
  normal: PlanarVector
  penetration: number
  contactPoint: PlanarVector
}>

const GEOMETRY_EPSILON = 1e-10

export function addPlanarVectors(left: PlanarVector, right: PlanarVector): PlanarVector {
  return [left[0] + right[0], left[1] + right[1]]
}

export function subtractPlanarVectors(left: PlanarVector, right: PlanarVector): PlanarVector {
  return [left[0] - right[0], left[1] - right[1]]
}

export function scalePlanarVector(value: PlanarVector, scale: number): PlanarVector {
  return [value[0] * scale, value[1] * scale]
}

export function dotPlanarVectors(left: PlanarVector, right: PlanarVector): number {
  return left[0] * right[0] + left[1] * right[1]
}

export function crossPlanarVectors(left: PlanarVector, right: PlanarVector): number {
  return left[0] * right[1] - left[1] * right[0]
}

export function rotatePlanarVector(value: PlanarVector, radians: number): PlanarVector {
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return [value[0] * cosine - value[1] * sine, value[0] * sine + value[1] * cosine]
}

function unitVector(value: PlanarVector): PlanarVector | null {
  const length = Math.hypot(value[0], value[1])
  return length > GEOMETRY_EPSILON ? [value[0] / length, value[1] / length] : null
}

function boxAxes(box: PlanarWorldBox): readonly [PlanarVector, PlanarVector] {
  const horizontal = rotatePlanarVector([1, 0], box.rotationRadians)
  return [horizontal, [-horizontal[1], horizontal[0]]]
}

export function placePlanarShape(
  shape: PlanarColliderShape,
  position: PlanarVector,
  rotationRadians: number,
): PlanarWorldShape {
  const offset = rotatePlanarVector(shape.offset ?? [0, 0], rotationRadians)
  const center = addPlanarVectors(position, offset)
  if (shape.kind === 'circle') return { kind: 'circle', center, radius: shape.radius }
  return {
    kind: 'box',
    center,
    halfSize: shape.halfSize,
    rotationRadians: rotationRadians + (shape.rotationRadians ?? 0),
  }
}

export function worldShapeForCollider(
  body: PlanarBodySnapshot,
  collider: PlanarColliderSnapshot,
): PlanarWorldShape {
  return placePlanarShape(collider.shape, body.position, body.rotationRadians)
}

function shapeSupport(shape: PlanarWorldShape, direction: PlanarVector): PlanarVector {
  const normalizedDirection = unitVector(direction) ?? [1, 0]
  if (shape.kind === 'circle') {
    return addPlanarVectors(shape.center, scalePlanarVector(normalizedDirection, shape.radius))
  }
  const [horizontal, vertical] = boxAxes(shape)
  const horizontalSign = dotPlanarVectors(normalizedDirection, horizontal) >= 0 ? 1 : -1
  const verticalSign = dotPlanarVectors(normalizedDirection, vertical) >= 0 ? 1 : -1
  return addPlanarVectors(shape.center, addPlanarVectors(
    scalePlanarVector(horizontal, shape.halfSize[0] * horizontalSign),
    scalePlanarVector(vertical, shape.halfSize[1] * verticalSign),
  ))
}

function contactBetweenSupports(
  left: PlanarWorldShape,
  right: PlanarWorldShape,
  normal: PlanarVector,
): PlanarVector {
  const leftPoint = shapeSupport(left, normal)
  const rightPoint = shapeSupport(right, scalePlanarVector(normal, -1))
  return scalePlanarVector(addPlanarVectors(leftPoint, rightPoint), 0.5)
}

function circleCircleManifold(
  left: PlanarWorldCircle,
  right: PlanarWorldCircle,
): PlanarCollisionManifold | null {
  const delta = subtractPlanarVectors(right.center, left.center)
  const distance = Math.hypot(delta[0], delta[1])
  const penetration = left.radius + right.radius - distance
  if (penetration < -GEOMETRY_EPSILON) return null
  const normal = unitVector(delta) ?? [1, 0]
  return {
    normal,
    penetration: Math.max(0, penetration),
    contactPoint: addPlanarVectors(left.center, scalePlanarVector(normal, left.radius)),
  }
}

function boxBoxManifold(
  left: PlanarWorldBox,
  right: PlanarWorldBox,
): PlanarCollisionManifold | null {
  const leftAxes = boxAxes(left)
  const rightAxes = boxAxes(right)
  const axes = [...leftAxes, ...rightAxes]
  const centerDelta = subtractPlanarVectors(right.center, left.center)
  let bestNormal: PlanarVector = [1, 0]
  let leastPenetration = Number.POSITIVE_INFINITY
  for (const axis of axes) {
    const leftRadius = left.halfSize[0] * Math.abs(dotPlanarVectors(axis, leftAxes[0]))
      + left.halfSize[1] * Math.abs(dotPlanarVectors(axis, leftAxes[1]))
    const rightRadius = right.halfSize[0] * Math.abs(dotPlanarVectors(axis, rightAxes[0]))
      + right.halfSize[1] * Math.abs(dotPlanarVectors(axis, rightAxes[1]))
    const signedDistance = dotPlanarVectors(centerDelta, axis)
    const penetration = leftRadius + rightRadius - Math.abs(signedDistance)
    if (penetration < -GEOMETRY_EPSILON) return null
    if (penetration < leastPenetration) {
      leastPenetration = penetration
      bestNormal = signedDistance >= 0 ? axis : scalePlanarVector(axis, -1)
    }
  }
  return {
    normal: bestNormal,
    penetration: Math.max(0, leastPenetration),
    contactPoint: contactBetweenSupports(left, right, bestNormal),
  }
}

function circleBoxManifold(
  circle: PlanarWorldCircle,
  box: PlanarWorldBox,
): PlanarCollisionManifold | null {
  const [horizontal, vertical] = boxAxes(box)
  const centerOffset = subtractPlanarVectors(circle.center, box.center)
  const localCenter: PlanarVector = [
    dotPlanarVectors(centerOffset, horizontal),
    dotPlanarVectors(centerOffset, vertical),
  ]
  const closestLocal: PlanarVector = [
    Math.max(-box.halfSize[0], Math.min(box.halfSize[0], localCenter[0])),
    Math.max(-box.halfSize[1], Math.min(box.halfSize[1], localCenter[1])),
  ]
  const closest = addPlanarVectors(box.center, addPlanarVectors(
    scalePlanarVector(horizontal, closestLocal[0]),
    scalePlanarVector(vertical, closestLocal[1]),
  ))
  const circleToBox = subtractPlanarVectors(closest, circle.center)
  const distance = Math.hypot(circleToBox[0], circleToBox[1])
  if (distance > GEOMETRY_EPSILON) {
    const penetration = circle.radius - distance
    if (penetration < -GEOMETRY_EPSILON) return null
    return { normal: scalePlanarVector(circleToBox, 1 / distance), penetration: Math.max(0, penetration), contactPoint: closest }
  }

  const horizontalGap = box.halfSize[0] - Math.abs(localCenter[0])
  const verticalGap = box.halfSize[1] - Math.abs(localCenter[1])
  const useHorizontal = horizontalGap <= verticalGap
  const outwardAxis = useHorizontal ? horizontal : vertical
  const localCoordinate = useHorizontal ? localCenter[0] : localCenter[1]
  const outward = scalePlanarVector(outwardAxis, localCoordinate >= 0 ? 1 : -1)
  const faceGap = useHorizontal ? horizontalGap : verticalGap
  return {
    normal: scalePlanarVector(outward, -1),
    penetration: circle.radius + faceGap,
    contactPoint: addPlanarVectors(circle.center, scalePlanarVector(outward, faceGap)),
  }
}

export function findPlanarCollision(
  left: PlanarWorldShape,
  right: PlanarWorldShape,
): PlanarCollisionManifold | null {
  if (left.kind === 'circle' && right.kind === 'circle') return circleCircleManifold(left, right)
  if (left.kind === 'box' && right.kind === 'box') return boxBoxManifold(left, right)
  if (left.kind === 'circle' && right.kind === 'box') return circleBoxManifold(left, right)
  const manifold = circleBoxManifold(right as PlanarWorldCircle, left as PlanarWorldBox)
  return manifold ? { ...manifold, normal: scalePlanarVector(manifold.normal, -1) } : null
}

export function planarShapeContainsPoint(shape: PlanarWorldShape, point: PlanarVector): boolean {
  if (shape.kind === 'circle') {
    const delta = subtractPlanarVectors(point, shape.center)
    return dotPlanarVectors(delta, delta) <= shape.radius * shape.radius + GEOMETRY_EPSILON
  }
  const [horizontal, vertical] = boxAxes(shape)
  const offset = subtractPlanarVectors(point, shape.center)
  return Math.abs(dotPlanarVectors(offset, horizontal)) <= shape.halfSize[0] + GEOMETRY_EPSILON
    && Math.abs(dotPlanarVectors(offset, vertical)) <= shape.halfSize[1] + GEOMETRY_EPSILON
}

function rayCircleDistance(
  origin: PlanarVector,
  direction: PlanarVector,
  circle: PlanarWorldCircle,
): number | null {
  const offset = subtractPlanarVectors(origin, circle.center)
  const along = dotPlanarVectors(offset, direction)
  const constant = dotPlanarVectors(offset, offset) - circle.radius * circle.radius
  const discriminant = along * along - constant
  if (discriminant < 0) return null
  const root = Math.sqrt(discriminant)
  const near = -along - root
  const far = -along + root
  if (near >= 0) return near
  return far >= 0 ? far : null
}

function rayBoxDistance(
  origin: PlanarVector,
  direction: PlanarVector,
  box: PlanarWorldBox,
): number | null {
  const [horizontal, vertical] = boxAxes(box)
  const offset = subtractPlanarVectors(origin, box.center)
  const localOrigin: PlanarVector = [dotPlanarVectors(offset, horizontal), dotPlanarVectors(offset, vertical)]
  const localDirection: PlanarVector = [dotPlanarVectors(direction, horizontal), dotPlanarVectors(direction, vertical)]
  let entry = Number.NEGATIVE_INFINITY
  let exit = Number.POSITIVE_INFINITY
  for (const axis of [0, 1] as const) {
    if (Math.abs(localDirection[axis]) <= GEOMETRY_EPSILON) {
      if (Math.abs(localOrigin[axis]) > box.halfSize[axis]) return null
      continue
    }
    const first = (-box.halfSize[axis] - localOrigin[axis]) / localDirection[axis]
    const second = (box.halfSize[axis] - localOrigin[axis]) / localDirection[axis]
    entry = Math.max(entry, Math.min(first, second))
    exit = Math.min(exit, Math.max(first, second))
    if (entry > exit) return null
  }
  if (exit < 0) return null
  return Math.max(0, entry)
}

export function rayDistanceToPlanarShape(
  origin: PlanarVector,
  unitDirection: PlanarVector,
  shape: PlanarWorldShape,
): number | null {
  return shape.kind === 'circle'
    ? rayCircleDistance(origin, unitDirection, shape)
    : rayBoxDistance(origin, unitDirection, shape)
}
