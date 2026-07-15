import {
  QuadraticBezierCurve3,
  Quaternion,
  TubeGeometry,
  Vector3,
} from 'three'

export type CurvedEdgeGeometryScratch = {
  start: Vector3
  end: Vector3
  vector: Vector3
  direction: Vector3
  up: Vector3
  perpendicularBase: Vector3
  perpendicular: Vector3
  control: Vector3
  rotationQuaternion: Quaternion
}

type CurvedEdgeTubeGeometryParams = {
  start: readonly [number, number, number]
  end: readonly [number, number, number]
  curvature: number
  resolution: number
  rotation: number
  width: number
  scratch: CurvedEdgeGeometryScratch
}

const isFinitePoint = (point: readonly [number, number, number]): boolean =>
  Number.isFinite(point[0]) && Number.isFinite(point[1]) && Number.isFinite(point[2])

export function createCurvedEdgeGeometryScratch(): CurvedEdgeGeometryScratch {
  return {
    start: new Vector3(),
    end: new Vector3(),
    vector: new Vector3(),
    direction: new Vector3(),
    up: new Vector3(0, 0, 1),
    perpendicularBase: new Vector3(),
    perpendicular: new Vector3(),
    control: new Vector3(),
    rotationQuaternion: new Quaternion(),
  }
}

export function buildCurvedEdgeTubeGeometry({
  start: startPoint,
  end: endPoint,
  curvature,
  resolution,
  rotation,
  width,
  scratch,
}: CurvedEdgeTubeGeometryParams): TubeGeometry | null {
  if (!isFinitePoint(startPoint) || !isFinitePoint(endPoint)) return null
  if (![curvature, resolution, rotation, width].every(Number.isFinite)) return null

  const start = scratch.start.set(startPoint[0], startPoint[1], startPoint[2])
  const end = scratch.end.set(endPoint[0], endPoint[1], endPoint[2])
  const vector = scratch.vector.subVectors(end, start)
  const length = vector.length()
  if (!Number.isFinite(length) || length < 1e-3) return null

  const direction = scratch.direction.copy(vector).normalize()
  const up = Math.abs(direction.z) < 0.99
    ? scratch.up.set(0, 0, 1)
    : scratch.up.set(0, 1, 0)
  const perpendicularBase = scratch.perpendicularBase.crossVectors(direction, up).normalize()
  scratch.rotationQuaternion.setFromAxisAngle(direction, rotation)
  const perpendicular = scratch.perpendicular
    .copy(perpendicularBase)
    .applyQuaternion(scratch.rotationQuaternion)
    .normalize()
  const offsetMagnitude = Math.max(0, curvature) * (length * 0.5)
  const control = scratch.control.copy(start).add(end).multiplyScalar(0.5)
  control.add(perpendicular.multiplyScalar(offsetMagnitude))

  const safeResolution = Math.floor(resolution)
  const tubularSegments = Math.max(16, Math.min(64, safeResolution * 2 || 32))
  const radialSegments = Math.max(8, Math.min(32, safeResolution || 16))
  const tubeRadius = Math.max(0.25, width * 0.5)
  return new TubeGeometry(
    new QuadraticBezierCurve3(start, control, end),
    tubularSegments,
    tubeRadius,
    radialSegments,
    false,
  )
}
