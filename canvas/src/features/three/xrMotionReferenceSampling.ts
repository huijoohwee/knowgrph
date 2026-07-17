import { resolveCameraFramingPose, type CameraFramingPose } from '@/lib/camera/cameraFramingPose'
import { readStrybldrCameraSettings, type StrybldrCameraSettings } from '@/features/strybldr/strybldrCamera'
import { sampleXrChoreographyEasing } from './xrChoreographyEasing'
import type {
  XrMotionReferenceCameraMark,
  XrMotionReferenceCameraRig,
  XrMotionReferenceCastTrack,
  XrMotionReferenceMark,
  XrMotionReferenceVector,
} from './xrMotionReferenceModel'
import type { XrCameraMoveId } from './xrCameraMoveCatalog'

export const XR_MOTION_REFERENCE_CAMERA_BASELINE_METERS = 8

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

function round(value: number, places = 4): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

function interpolateVector(left: XrMotionReferenceVector, right: XrMotionReferenceVector, progress: number): XrMotionReferenceVector {
  return [
    round(left[0] + (right[0] - left[0]) * progress),
    round(left[1] + (right[1] - left[1]) * progress),
    round(left[2] + (right[2] - left[2]) * progress),
  ]
}

function normalizeDirection(vector: XrMotionReferenceVector): XrMotionReferenceVector {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (!(length > 0.000001)) return [0, 1, 0]
  return [round(vector[0] / length), round(vector[1] / length), round(vector[2] / length)]
}

export function sampleXrMotionReferenceMarks(marks: readonly XrMotionReferenceMark[], timeSeconds: number): XrMotionReferenceVector {
  if (marks.length === 0) return [0, 0, 0]
  if (timeSeconds <= marks[0]!.timeSeconds) return marks[0]!.position
  const last = marks[marks.length - 1]!
  if (timeSeconds >= last.timeSeconds) return last.position
  for (let index = 1; index < marks.length; index += 1) {
    const right = marks[index]!
    if (timeSeconds > right.timeSeconds) continue
    const left = marks[index - 1]!
    if (Math.abs(timeSeconds - right.timeSeconds) < 0.000001) return right.position
    const span = Math.max(0.001, right.timeSeconds - left.timeSeconds)
    const progress = sampleXrChoreographyEasing(left.transition, (timeSeconds - left.timeSeconds) / span)
    return interpolateVector(left.position, right.position, progress)
  }
  return last.position
}

export function sampleXrMotionReferenceFacingY(marks: readonly XrMotionReferenceMark[], timeSeconds: number): number {
  if (marks.length < 2) return 0
  let rightIndex = marks.findIndex(mark => mark.timeSeconds > timeSeconds)
  if (rightIndex < 0) rightIndex = marks.length - 1
  if (rightIndex === 0) rightIndex = 1
  let leftIndex = rightIndex - 1
  while (leftIndex >= 0 && rightIndex < marks.length) {
    const left = marks[leftIndex]!
    const right = marks[rightIndex]!
    const deltaX = right.position[0] - left.position[0]
    const deltaZ = right.position[2] - left.position[2]
    if (Math.hypot(deltaX, deltaZ) > 0.001) return Math.atan2(deltaX, deltaZ)
    if (rightIndex < marks.length - 1) rightIndex += 1
    else leftIndex -= 1
  }
  return 0
}

function resolveCameraSegment(marks: readonly XrMotionReferenceCameraMark[], timeSeconds: number) {
  for (let index = 1; index < marks.length; index += 1) {
    if (timeSeconds <= marks[index]!.timeSeconds) return { left: marks[index - 1]!, right: marks[index]! }
  }
  return null
}

function sampleCameraSettingsBetween(
  left: XrMotionReferenceCameraMark,
  right: XrMotionReferenceCameraMark,
  progress: number,
): StrybldrCameraSettings {
  return readStrybldrCameraSettings({
    ...left.settings,
    orbitX: left.settings.orbitX + (right.settings.orbitX - left.settings.orbitX) * progress,
    orbitY: left.settings.orbitY + (right.settings.orbitY - left.settings.orbitY) * progress,
    focalLengthMm: left.settings.focalLengthMm + (right.settings.focalLengthMm - left.settings.focalLengthMm) * progress,
  })
}

function addHandheldMotion(pose: CameraFramingPose, timeSeconds: number, linearProgress: number): CameraFramingPose {
  const envelope = Math.sin(Math.PI * linearProgress)
  const phase = timeSeconds * Math.PI * 2
  return Object.freeze({
    position: [
      round(pose.position[0] + Math.sin(phase * 2.13) * 0.035 * envelope),
      round(pose.position[1] + Math.sin(phase * 2.87) * 0.02 * envelope),
      pose.position[2],
    ],
    target: [
      round(pose.target[0] + Math.sin(phase * 1.71) * 0.018 * envelope),
      pose.target[1],
      pose.target[2],
    ],
    up: pose.up,
  })
}

export function sampleXrMotionReferenceCameraPose(
  marks: readonly XrMotionReferenceCameraMark[],
  timeSeconds: number,
  cast: readonly XrMotionReferenceCastTrack[] = [],
): CameraFramingPose | null {
  if (marks.length === 0) return null
  if (timeSeconds <= marks[0]!.timeSeconds) return marks[0]!.pose
  const last = marks[marks.length - 1]!
  if (timeSeconds >= last.timeSeconds) return last.pose
  const segment = resolveCameraSegment(marks, timeSeconds)
  if (!segment) return last.pose
  const { left, right } = segment
  if (Math.abs(timeSeconds - right.timeSeconds) < 0.000001) return right.pose
  const span = Math.max(0.001, right.timeSeconds - left.timeSeconds)
  const linearProgress = clamp((timeSeconds - left.timeSeconds) / span, 0, 1)
  const progress = sampleXrChoreographyEasing(left.easing, linearProgress)
  if (progress <= 0.000001) return left.pose
  const anchorTrack = left.anchorId === right.anchorId
    ? cast.find(track => track.actorId === left.anchorId)
    : undefined
  let pose = anchorTrack
    ? resolveCameraFramingPose({
        settings: sampleCameraSettingsBetween(left, right, progress),
        target: sampleXrMotionReferenceMarks(anchorTrack.marks, timeSeconds),
        baseDistance: XR_MOTION_REFERENCE_CAMERA_BASELINE_METERS,
      })
    : Object.freeze({
        position: interpolateVector(left.pose.position, right.pose.position, progress),
        target: interpolateVector(left.pose.target, right.pose.target, progress),
        up: normalizeDirection(interpolateVector(left.pose.up, right.pose.up, progress)),
      })
  if (left.rig === 'handheld') pose = addHandheldMotion(pose, timeSeconds, linearProgress)
  return pose
}

export function sampleXrMotionReferenceCameraRig(
  marks: readonly XrMotionReferenceCameraMark[],
  timeSeconds: number,
): XrMotionReferenceCameraRig {
  if (marks.length === 0) return 'dolly'
  const segment = resolveCameraSegment(marks, timeSeconds)
  return segment?.left.rig || marks[marks.length - 1]!.rig
}

export function sampleXrMotionReferenceCameraMoveId(
  marks: readonly XrMotionReferenceCameraMark[],
  timeSeconds: number,
): XrCameraMoveId {
  if (marks.length === 0) return 'custom'
  const segment = resolveCameraSegment(marks, timeSeconds)
  return segment?.left.moveId || marks[marks.length - 1]!.moveId
}

export function sampleXrMotionReferenceCameraSettings(
  marks: readonly XrMotionReferenceCameraMark[],
  timeSeconds: number,
): Readonly<StrybldrCameraSettings> | null {
  if (marks.length === 0) return null
  if (timeSeconds <= marks[0]!.timeSeconds) return marks[0]!.settings
  const last = marks[marks.length - 1]!
  if (timeSeconds >= last.timeSeconds) return last.settings
  const segment = resolveCameraSegment(marks, timeSeconds)
  if (!segment) return last.settings
  if (Math.abs(timeSeconds - segment.right.timeSeconds) < 0.000001) return segment.right.settings
  const span = Math.max(0.001, segment.right.timeSeconds - segment.left.timeSeconds)
  const progress = sampleXrChoreographyEasing(segment.left.easing, (timeSeconds - segment.left.timeSeconds) / span)
  return Object.freeze(sampleCameraSettingsBetween(segment.left, segment.right, progress))
}
