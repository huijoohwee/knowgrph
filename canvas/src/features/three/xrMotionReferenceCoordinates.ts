import type { XrMotionReferenceVector } from './xrMotionReferenceModel'

export const XR_MOTION_STAGE_SPAN = 520
export const XR_MOTION_STAGE_GROUND_Y = 0
export const XR_MOTION_STAGE_FLOOR_DEPTH = -72
export const XR_MOTION_STAGE_MIN_CAMERA_Y = 8
export const XR_MOTION_STAGE_CAMERA_TARGET: readonly [number, number, number] = [0, 42, 0]
export const XR_MOTION_STAGE_CAMERA_POSITION: readonly [number, number, number] = [360, 260, 440]

export function xrMotionReferenceWorldPosition(
  position: XrMotionReferenceVector,
  scale: number,
  groundY = XR_MOTION_STAGE_GROUND_Y,
): [number, number, number] {
  return [
    position[0] * scale,
    groundY + position[1] * scale,
    position[2] * scale,
  ]
}
