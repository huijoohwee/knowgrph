export const XR_PHYSICS_SURFACE_CONTACT_DRAG_RATE = 12
export const XR_PHYSICS_BODY_CONTACT_DRAG_RATE = 8

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function resolveXrPhysicsContactDrag(
  friction: number,
  responseRate: number,
  stepSeconds: number,
): number {
  return Math.exp(
    -finiteNonNegative(friction)
    * finiteNonNegative(responseRate)
    * finiteNonNegative(stepSeconds),
  )
}

export function resolveXrPhysicsRelativeContactVelocities(
  leftVelocity: number,
  rightVelocity: number,
  leftInverseMass: number,
  rightInverseMass: number,
  drag: number,
): readonly [number, number] {
  const inverseMassSum = finiteNonNegative(leftInverseMass) + finiteNonNegative(rightInverseMass)
  if (!(inverseMassSum > 0)) return Object.freeze([leftVelocity, rightVelocity])
  const relativeVelocity = rightVelocity - leftVelocity
  const impulse = relativeVelocity * (Math.min(1, finiteNonNegative(drag)) - 1) / inverseMassSum
  return Object.freeze([
    leftVelocity - impulse * finiteNonNegative(leftInverseMass),
    rightVelocity + impulse * finiteNonNegative(rightInverseMass),
  ])
}
