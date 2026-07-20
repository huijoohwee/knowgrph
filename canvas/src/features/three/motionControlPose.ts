import type { XrAnimationPoseSample } from './xrAnimationCatalog'
import { createXrNativeControllerInput, type XrNativeControllerInput } from './xrNativeControllerInput'
import { MOTION_CONTROL_MIN_CONFIDENCE } from './motionControlConfig'

export type MotionControlLandmark = Readonly<{
  x: number
  y: number
  z: number
  visibility: number
  presence: number
}>

export type MotionControlBoundingBox = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

export type MotionControlPoseFrame = Readonly<{
  timestampMs: number
  confidence: number
  landmarks: readonly MotionControlLandmark[]
  worldLandmarks: readonly MotionControlLandmark[]
}>

const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_ELBOW = 13
const RIGHT_ELBOW = 14
const LEFT_WRIST = 15
const RIGHT_WRIST = 16
const LEFT_HIP = 23
const RIGHT_HIP = 24
const LEFT_KNEE = 25
const RIGHT_KNEE = 26
const MOTION_AXIS_DEAD_ZONE = 0.08
const MOTION_POSE_SMOOTHING_RESPONSE_PER_SECOND = -Math.log(1 - 0.42) * 30
const MOTION_POSE_MAX_SMOOTHING_DELTA_SECONDS = 0.2

type MotionControlCalibration = Readonly<{ lateral: number; depth: number }>

let controllerCalibration: MotionControlCalibration | null = null

const clamp = (value: number, min = -1, max = 1): number => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0))
const midpoint = (a: MotionControlLandmark, b: MotionControlLandmark) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
})
const degrees = (radians: number): number => radians * 180 / Math.PI
const reliable = (landmark: MotionControlLandmark | undefined): boolean => Boolean(
  landmark
  && landmark.visibility >= MOTION_CONTROL_MIN_CONFIDENCE
  && landmark.presence >= MOTION_CONTROL_MIN_CONFIDENCE,
)
const reliableIndexes = (landmarks: readonly MotionControlLandmark[], indexes: readonly number[]): boolean => (
  indexes.every(index => reliable(landmarks[index]))
)
const controllerAxis = (value: number): number => {
  const normalized = clamp(value)
  const magnitude = Math.abs(normalized)
  if (magnitude <= MOTION_AXIS_DEAD_ZONE) return 0
  return Math.sign(normalized) * (magnitude - MOTION_AXIS_DEAD_ZONE) / (1 - MOTION_AXIS_DEAD_ZONE)
}

export function resolveMotionControlTrackingBoundingBox(landmarks: readonly MotionControlLandmark[]): MotionControlBoundingBox | null {
  let reliableCount = 0
  let minX = 1
  let maxX = 0
  let minY = 1
  let maxY = 0
  for (const landmark of landmarks) {
    if (!reliable(landmark)) continue
    reliableCount += 1
    minX = Math.min(minX, landmark.x)
    maxX = Math.max(maxX, landmark.x)
    minY = Math.min(minY, landmark.y)
    maxY = Math.max(maxY, landmark.y)
  }
  if (reliableCount < 8) return null
  const size = clamp(Math.max(maxX - minX, maxY - minY) * 1.45, 0.35, 1)
  const x = clamp((minX + maxX - size) / 2, 0, 1 - size)
  const y = clamp((minY + maxY - size) / 2, 0, 1 - size)
  return Object.freeze({ x, y, width: size, height: size })
}

function armAngles(shoulder: MotionControlLandmark, elbow: MotionControlLandmark, side: -1 | 1) {
  const dx = elbow.x - shoulder.x
  const dy = elbow.y - shoulder.y
  const dz = elbow.z - shoulder.z
  return {
    pitch: clamp(degrees(Math.atan2(dz, Math.hypot(dx, dy))), -100, 100),
    roll: clamp(degrees(Math.atan2(Math.abs(dx), dy)) * -side, -170, 170),
  }
}

export function resetMotionControlCalibration(): void {
  controllerCalibration = null
}

export function motionControlPoseToAnimationPose(frame: MotionControlPoseFrame | null): XrAnimationPoseSample | null {
  if (!frame || frame.landmarks.length < 27 || frame.confidence < 0.5) return null
  const landmarks = frame.landmarks
  if (!reliableIndexes(landmarks, [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW, LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE])) return null
  const world = frame.worldLandmarks.length >= 27 ? frame.worldLandmarks : landmarks
  const leftArm = armAngles(world[LEFT_SHOULDER]!, world[LEFT_ELBOW]!, -1)
  const rightArm = armAngles(world[RIGHT_SHOULDER]!, world[RIGHT_ELBOW]!, 1)
  const shoulder = midpoint(landmarks[LEFT_SHOULDER]!, landmarks[RIGHT_SHOULDER]!)
  const hip = midpoint(landmarks[LEFT_HIP]!, landmarks[RIGHT_HIP]!)
  const knee = midpoint(landmarks[LEFT_KNEE]!, landmarks[RIGHT_KNEE]!)
  const torsoHeight = Math.max(0.06, Math.abs(hip.y - shoulder.y))
  const crouch = clamp((knee.y - hip.y) / torsoHeight < 1.2 ? 1 - (knee.y - hip.y) / (torsoHeight * 1.2) : 0, 0, 1)
  return Object.freeze({
    rootOffsetMeters: Object.freeze([0, 0, 0] as const),
    rootRotationDegrees: Object.freeze([0, clamp((shoulder.x - hip.x) * 80, -32, 32), 0] as const),
    crouch,
    leftArmPitchDegrees: leftArm.pitch,
    rightArmPitchDegrees: rightArm.pitch,
    leftArmRollDegrees: leftArm.roll,
    rightArmRollDegrees: rightArm.roll,
    propCue: 'none',
    eventCues: Object.freeze(['motion-control']),
  })
}

export function motionControlPoseToControllerInput(frame: MotionControlPoseFrame | null): XrNativeControllerInput {
  if (!frame || frame.landmarks.length < 25 || frame.confidence < 0.5) return createXrNativeControllerInput()
  const landmarks = frame.landmarks
  const world = frame.worldLandmarks.length >= 25 ? frame.worldLandmarks : landmarks
  const torsoReliable = reliableIndexes(landmarks, [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP])
  const wristsReliable = reliableIndexes(landmarks, [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_WRIST, RIGHT_WRIST])
  let moveX = 0
  let moveZ = 0
  if (torsoReliable) {
    const shoulder = midpoint(landmarks[LEFT_SHOULDER]!, landmarks[RIGHT_SHOULDER]!)
    const hip = midpoint(landmarks[LEFT_HIP]!, landmarks[RIGHT_HIP]!)
    const worldShoulder = midpoint(world[LEFT_SHOULDER]!, world[RIGHT_SHOULDER]!)
    const worldHip = midpoint(world[LEFT_HIP]!, world[RIGHT_HIP]!)
    const lateral = hip.x - shoulder.x
    const depth = worldShoulder.z - worldHip.z
    controllerCalibration ||= Object.freeze({ lateral, depth })
    moveX = controllerAxis((lateral - controllerCalibration.lateral) * 8)
    moveZ = controllerAxis((depth - controllerCalibration.depth) * 5)
  }
  const bothHandsRaised = wristsReliable
    && landmarks[LEFT_WRIST]!.y < landmarks[LEFT_SHOULDER]!.y
    && landmarks[RIGHT_WRIST]!.y < landmarks[RIGHT_SHOULDER]!.y
  const handsWide = wristsReliable
    && Math.abs(landmarks[LEFT_WRIST]!.x - landmarks[RIGHT_WRIST]!.x) > 0.55
  const active = moveX !== 0 || moveZ !== 0 || bothHandsRaised || handsWide
  return createXrNativeControllerInput({
    moveX,
    moveZ,
    primary: bothHandsRaised,
    modifier: handsWide,
    source: active ? 'motion' : 'none',
  })
}

export function resolveMotionControlPoseSmoothingAlpha(deltaSeconds: number): number {
  const boundedDelta = Math.max(0, Math.min(
    MOTION_POSE_MAX_SMOOTHING_DELTA_SECONDS,
    Number.isFinite(deltaSeconds) ? deltaSeconds : 0,
  ))
  return 1 - Math.exp(-MOTION_POSE_SMOOTHING_RESPONSE_PER_SECOND * boundedDelta)
}

export function smoothMotionControlPose(previous: MotionControlPoseFrame | null, next: MotionControlPoseFrame): MotionControlPoseFrame {
  if (!previous || previous.landmarks.length !== next.landmarks.length) return next
  const alpha = resolveMotionControlPoseSmoothingAlpha((next.timestampMs - previous.timestampMs) / 1000)
  if (alpha <= 0) return previous
  const blend = (before: MotionControlLandmark, after: MotionControlLandmark): MotionControlLandmark => Object.freeze({
    x: before.x + (after.x - before.x) * alpha,
    y: before.y + (after.y - before.y) * alpha,
    z: before.z + (after.z - before.z) * alpha,
    visibility: after.visibility,
    presence: after.presence,
  })
  return Object.freeze({
    ...next,
    landmarks: Object.freeze(next.landmarks.map((landmark, index) => blend(previous.landmarks[index]!, landmark))),
    worldLandmarks: next.worldLandmarks.length === previous.worldLandmarks.length
      ? Object.freeze(next.worldLandmarks.map((landmark, index) => blend(previous.worldLandmarks[index]!, landmark)))
      : next.worldLandmarks,
  })
}
