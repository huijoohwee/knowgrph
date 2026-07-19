import type { XrMotionReferenceStageId } from './xrSceneLibrary'

const DEFAULT_FOLLOW_OFFSET_METERS = Object.freeze([0, 6.6, 9.5] as const)
const SINGAPORE_FOLLOW_OFFSET_METERS = Object.freeze([0, 7.4, 11.8] as const)
const SINGAPORE_LOOK_AHEAD_METERS = 4.2
const PLAYGROUND_FOV_DEGREES = 54
const AERIAL_FOV_DEGREES = 60
const AERIAL_FOLLOW_RISE_METERS = 18
const AERIAL_FOLLOW_RETREAT_METERS = 11

export type XrNativeControllerFollowFraming = Readonly<{
  offsetMeters: readonly [number, number, number]
  lookAheadMeters: number
  fovDegrees: number
}>

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Resolves the one native follow-camera composition from stage scale, flight
 * height, and the real canvas aspect. Narrow editor splits need more retreat
 * than a landscape preview or the player and terrain edge fill the frame.
 */
export function resolveXrNativeControllerFollowFraming(args: Readonly<{
  stageId: XrMotionReferenceStageId
  aspect: number
  aerialFactor: number
}>): XrNativeControllerFollowFraming {
  const aerialFactor = clamp(Number(args.aerialFactor) || 0, 0, 1)
  const aspect = clamp(Number(args.aspect) || 1, 0.45, 3.2)
  const narrowRetreat = clamp(Math.sqrt(1.15 / aspect), 1, 1.42)
  const singapore = args.stageId === 'singapore'
  const baseOffset = singapore ? SINGAPORE_FOLLOW_OFFSET_METERS : DEFAULT_FOLLOW_OFFSET_METERS
  const narrowRise = (narrowRetreat - 1) * 2.4
  const narrowFov = (narrowRetreat - 1) * 9
  return Object.freeze({
    offsetMeters: Object.freeze([
      baseOffset[0],
      baseOffset[1] + narrowRise + aerialFactor * AERIAL_FOLLOW_RISE_METERS,
      baseOffset[2] * narrowRetreat + aerialFactor * AERIAL_FOLLOW_RETREAT_METERS,
    ] as const),
    lookAheadMeters: singapore ? SINGAPORE_LOOK_AHEAD_METERS : 0,
    fovDegrees: PLAYGROUND_FOV_DEGREES
      + narrowFov
      + (AERIAL_FOV_DEGREES - PLAYGROUND_FOV_DEGREES) * aerialFactor,
  })
}
