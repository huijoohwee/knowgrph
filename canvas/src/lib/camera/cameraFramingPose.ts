import {
  readStrybldrCameraSettings,
  resolveStrybldrCameraOrbit,
  type StrybldrCameraSettings,
  type StrybldrCameraShot,
} from '@/features/strybldr/strybldrCamera'

export type CameraFramingVector = readonly [number, number, number]

export type CameraFramingPose = Readonly<{
  position: CameraFramingVector
  target: CameraFramingVector
  up: CameraFramingVector
}>

export type CameraFramingAxis = 'x' | 'y' | 'z'

type ResolveCameraFramingPoseArgs = {
  settings: unknown
  target?: CameraFramingVector
  baseDistance?: number
  up?: CameraFramingVector
}

type ResolveCameraFramingSettingsFromPoseArgs = {
  position: CameraFramingVector
  target?: CameraFramingVector
  baseDistance?: number
  previousSettings?: unknown
}

const DEFAULT_CAMERA_FRAMING_DISTANCE = 100
const MIN_CAMERA_FRAMING_DISTANCE = 0.001
const MAX_CAMERA_FRAMING_DISTANCE = 1_000_000
const MAX_CAMERA_FRAMING_COORDINATE = 1_000_000_000
const VERTICAL_UP_DOT_LIMIT = 0.995

const CAMERA_FRAMING_SHOT_DISTANCE_SCALE: Record<StrybldrCameraShot, number> = {
  wide: 1.4,
  medium: 1,
  'close-up': 0.65,
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function finiteNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function finiteCoordinate(value: unknown, fallback: number): number {
  return clamp(
    finiteNumber(value, fallback),
    -MAX_CAMERA_FRAMING_COORDINATE,
    MAX_CAMERA_FRAMING_COORDINATE,
  )
}

function readVector(
  value: CameraFramingVector | undefined,
  fallback: CameraFramingVector,
): CameraFramingVector {
  if (!Array.isArray(value) || value.length < 3) return fallback
  return [
    finiteCoordinate(value[0], fallback[0]),
    finiteCoordinate(value[1], fallback[1]),
    finiteCoordinate(value[2], fallback[2]),
  ]
}

function readBaseDistance(value: unknown): number {
  return clamp(
    finiteNumber(value, DEFAULT_CAMERA_FRAMING_DISTANCE),
    MIN_CAMERA_FRAMING_DISTANCE,
    MAX_CAMERA_FRAMING_DISTANCE,
  )
}

function vectorLength(vector: CameraFramingVector): number {
  return Math.hypot(vector[0], vector[1], vector[2])
}

function normalizeVector(
  vector: CameraFramingVector,
  fallback: CameraFramingVector,
): CameraFramingVector {
  const length = vectorLength(vector)
  if (!Number.isFinite(length) || length < 1e-9) return fallback
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function dot(left: CameraFramingVector, right: CameraFramingVector): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

function resolveStableUp(
  requestedUp: CameraFramingVector | undefined,
  direction: CameraFramingVector,
): CameraFramingVector {
  const normalizedRequested = normalizeVector(
    readVector(requestedUp, [0, 1, 0]),
    [0, 1, 0],
  )
  if (Math.abs(dot(normalizedRequested, direction)) < VERTICAL_UP_DOT_LIMIT) {
    return normalizedRequested
  }
  const candidates: readonly CameraFramingVector[] = [
    [0, 1, 0],
    [0, 0, -1],
    [1, 0, 0],
  ]
  return candidates.reduce((best, candidate) => (
    Math.abs(dot(candidate, direction)) < Math.abs(dot(best, direction))
      ? candidate
      : best
  ))
}

function freezeVector(vector: CameraFramingVector): CameraFramingVector {
  return Object.freeze([...vector]) as unknown as CameraFramingVector
}

function resolveShot(distance: number, baseDistance: number): StrybldrCameraShot {
  const ratio = distance / baseDistance
  return (Object.keys(CAMERA_FRAMING_SHOT_DISTANCE_SCALE) as StrybldrCameraShot[])
    .reduce((nearest, shot) => (
      Math.abs(CAMERA_FRAMING_SHOT_DISTANCE_SCALE[shot] - ratio)
        < Math.abs(CAMERA_FRAMING_SHOT_DISTANCE_SCALE[nearest] - ratio)
        ? shot
        : nearest
    ), 'medium')
}

export function resolveCameraFramingPose({
  settings: value,
  target: targetValue,
  baseDistance: baseDistanceValue,
  up: requestedUp,
}: ResolveCameraFramingPoseArgs): CameraFramingPose {
  const settings = readStrybldrCameraSettings(value)
  const target = readVector(targetValue, [0, 0, 0])
  const baseDistance = readBaseDistance(baseDistanceValue)
  const distance = clamp(
    baseDistance * CAMERA_FRAMING_SHOT_DISTANCE_SCALE[settings.shot],
    MIN_CAMERA_FRAMING_DISTANCE,
    MAX_CAMERA_FRAMING_DISTANCE,
  )
  const longitude = settings.orbitX * Math.PI
  const latitude = -settings.orbitY * Math.PI / 2
  const horizontalScale = Math.cos(latitude)
  const direction = normalizeVector([
    Math.sin(longitude) * horizontalScale,
    Math.sin(latitude),
    Math.cos(longitude) * horizontalScale,
  ], [0, 0, 1])
  const position: CameraFramingVector = [
    finiteCoordinate(target[0] + direction[0] * distance, target[0]),
    finiteCoordinate(target[1] + direction[1] * distance, target[1]),
    finiteCoordinate(target[2] + direction[2] * distance, target[2]),
  ]
  return Object.freeze({
    position: freezeVector(position),
    target: freezeVector(target),
    up: freezeVector(resolveStableUp(requestedUp, direction)),
  })
}

export function resolveCameraFramingSettingsFromPose({
  position: positionValue,
  target: targetValue,
  baseDistance: baseDistanceValue,
  previousSettings: previousValue,
}: ResolveCameraFramingSettingsFromPoseArgs): StrybldrCameraSettings {
  const previousSettings = readStrybldrCameraSettings(previousValue)
  const baseDistance = readBaseDistance(baseDistanceValue)
  const target = readVector(targetValue, [0, 0, 0])
  const position = readVector(positionValue, [target[0], target[1], target[2] + baseDistance])
  const offset: CameraFramingVector = [
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2],
  ]
  const distance = vectorLength(offset)
  const direction = normalizeVector(offset, [0, 0, 1])
  const orbitX = clamp(Math.atan2(direction[0], direction[2]) / Math.PI, -1, 1)
  const orbitY = clamp(-Math.asin(clamp(direction[1], -1, 1)) * 2 / Math.PI, -1, 1)
  const orbit = resolveStrybldrCameraOrbit(orbitX, orbitY)
  return readStrybldrCameraSettings({
    ...previousSettings,
    ...orbit,
    shot: resolveShot(
      Number.isFinite(distance) && distance >= MIN_CAMERA_FRAMING_DISTANCE ? distance : baseDistance,
      baseDistance,
    ),
  })
}

export function resolveCameraFramingAxisSettings(
  axis: CameraFramingAxis,
  previousSettings?: unknown,
): StrybldrCameraSettings {
  const previous = readStrybldrCameraSettings(previousSettings)
  const orbit = axis === 'x'
    ? resolveStrybldrCameraOrbit(0.5, 0)
    : axis === 'y'
      ? resolveStrybldrCameraOrbit(0, -1)
      : resolveStrybldrCameraOrbit(0, 0)
  return readStrybldrCameraSettings({
    ...previous,
    ...orbit,
  })
}
