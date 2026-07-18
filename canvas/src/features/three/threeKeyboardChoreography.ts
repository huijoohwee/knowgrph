import {
  readStrybldrCameraSettings,
  resolveStrybldrCameraOrbit,
  type StrybldrCameraSettings,
} from '@/features/strybldr/strybldrCamera'

export const THREE_KEYBOARD_HOLD_DELAY_MS = 160
export const THREE_KEYBOARD_MAX_FRAME_DELTA_MS = 50

export const THREE_OBJECT_KEYBOARD_STEP_METERS = 0.25
export const THREE_OBJECT_KEYBOARD_FINE_STEP_METERS = 0.05
export const THREE_OBJECT_KEYBOARD_SPEED_METERS_PER_SECOND = 2
export const THREE_OBJECT_KEYBOARD_FINE_SPEED_METERS_PER_SECOND = 0.4
export const THREE_OBJECT_KEYBOARD_MAX_COMMAND_DISTANCE_METERS = 10

export const THREE_CAMERA_KEYBOARD_ORBIT_STEP = 0.08
export const THREE_CAMERA_KEYBOARD_FINE_ORBIT_STEP = 0.02
export const THREE_CAMERA_KEYBOARD_ORBIT_SPEED_PER_SECOND = 0.64
export const THREE_CAMERA_KEYBOARD_FINE_ORBIT_SPEED_PER_SECOND = 0.16
export const THREE_CAMERA_KEYBOARD_MAX_COMMAND_AMOUNT = 2

export const THREE_KEYBOARD_MOVEMENT_KEYS = Object.freeze([
  'w',
  'a',
  's',
  'd',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
] as const)

export type ThreeKeyboardMovementKey = typeof THREE_KEYBOARD_MOVEMENT_KEYS[number]
export type ThreeKeyboardMotionTarget = 'camera' | 'object'
export type ThreeObjectKeyboardMotionVector = readonly [number, number, number]

export type ThreeKeyboardEvent = Readonly<{
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}>

type ThreeObjectKeyboardMotionBounds = Readonly<{
  halfDepth: number
  halfWidth: number
}>

const MOVEMENT_KEY_SET = new Set<string>(THREE_KEYBOARD_MOVEMENT_KEYS)

const MOTION_PROFILES = Object.freeze({
  camera: Object.freeze({
    tapAmount: THREE_CAMERA_KEYBOARD_ORBIT_STEP,
    fineTapAmount: THREE_CAMERA_KEYBOARD_FINE_ORBIT_STEP,
    speedPerSecond: THREE_CAMERA_KEYBOARD_ORBIT_SPEED_PER_SECOND,
    fineSpeedPerSecond: THREE_CAMERA_KEYBOARD_FINE_ORBIT_SPEED_PER_SECOND,
    maxCommandAmount: THREE_CAMERA_KEYBOARD_MAX_COMMAND_AMOUNT,
  }),
  object: Object.freeze({
    tapAmount: THREE_OBJECT_KEYBOARD_STEP_METERS,
    fineTapAmount: THREE_OBJECT_KEYBOARD_FINE_STEP_METERS,
    speedPerSecond: THREE_OBJECT_KEYBOARD_SPEED_METERS_PER_SECOND,
    fineSpeedPerSecond: THREE_OBJECT_KEYBOARD_FINE_SPEED_METERS_PER_SECOND,
    maxCommandAmount: THREE_OBJECT_KEYBOARD_MAX_COMMAND_DISTANCE_METERS,
  }),
})

export function normalizeThreeKeyboardKey(keyValue: string): string {
  const key = String(keyValue || '')
  return key.length === 1 ? key.toLowerCase() : key
}

export function readThreeKeyboardMovementKey(
  keyValue: string,
): ThreeKeyboardMovementKey | null {
  const key = normalizeThreeKeyboardKey(keyValue)
  return MOVEMENT_KEY_SET.has(key) ? key as ThreeKeyboardMovementKey : null
}

export function readThreeKeyboardMovementKeys(
  keys: Iterable<string>,
): readonly ThreeKeyboardMovementKey[] | null {
  const normalized = [...keys].map(readThreeKeyboardMovementKey)
  if (normalized.length === 0 || normalized.some(key => key === null)) return null
  return Object.freeze([...new Set(normalized as ThreeKeyboardMovementKey[])])
}

export function resolveThreeKeyboardMotionDirection(
  keys: Iterable<string>,
): readonly [number, number] | null {
  const normalized = readThreeKeyboardMovementKeys(keys)
  if (!normalized) return null
  const keySet = new Set(normalized)
  const horizontal = Number(keySet.has('d') || keySet.has('ArrowRight'))
    - Number(keySet.has('a') || keySet.has('ArrowLeft'))
  const vertical = Number(keySet.has('s') || keySet.has('ArrowDown'))
    - Number(keySet.has('w') || keySet.has('ArrowUp'))
  const magnitude = Math.hypot(horizontal, vertical)
  return magnitude > 0 ? [horizontal / magnitude, vertical / magnitude] : null
}

export function resolveThreeKeyboardCommandAmount(input: Readonly<{
  amount?: number
  fine: boolean
  target: ThreeKeyboardMotionTarget
}>): number | null {
  const profile = MOTION_PROFILES[input.target]
  const amount = input.amount === undefined
    ? input.fine ? profile.fineTapAmount : profile.tapAmount
    : Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > profile.maxCommandAmount) return null
  return amount
}

export function resolveThreeKeyboardTap(input: Readonly<{
  event: ThreeKeyboardEvent
  target: ThreeKeyboardMotionTarget
}>): Readonly<{ amount: number; key: ThreeKeyboardMovementKey }> | null {
  if (input.event.altKey || input.event.ctrlKey || input.event.metaKey) return null
  const key = readThreeKeyboardMovementKey(input.event.key)
  if (!key) return null
  const amount = resolveThreeKeyboardCommandAmount({
    fine: input.event.shiftKey === true,
    target: input.target,
  })
  return amount === null ? null : Object.freeze({ amount, key })
}

export function resolveThreeKeyboardFrameAmount(input: Readonly<{
  deltaMs: number
  fine: boolean
  target: ThreeKeyboardMotionTarget
}>): number {
  const finiteDeltaMs = Number.isFinite(input.deltaMs) ? input.deltaMs : 0
  const boundedDeltaMs = Math.max(0, Math.min(THREE_KEYBOARD_MAX_FRAME_DELTA_MS, finiteDeltaMs))
  const profile = MOTION_PROFILES[input.target]
  const speed = input.fine ? profile.fineSpeedPerSecond : profile.speedPerSecond
  return speed * boundedDeltaMs / 1000
}

export function resolveThreeObjectKeyboardMotionPosition(input: Readonly<{
  bounds: ThreeObjectKeyboardMotionBounds
  distanceMeters: number
  keys: Iterable<string>
  position: ThreeObjectKeyboardMotionVector
}>): ThreeObjectKeyboardMotionVector | null {
  const direction = resolveThreeKeyboardMotionDirection(input.keys)
  if (!direction || !Number.isFinite(input.distanceMeters) || input.distanceMeters <= 0) return null
  return clampThreeObjectPlanarPosition({
    bounds: input.bounds,
    delta: [direction[0] * input.distanceMeters, direction[1] * input.distanceMeters],
    position: input.position,
  })
}

export function resolveThreeCameraKeyboardFraming(input: Readonly<{
  amount: number
  keys: Iterable<string>
  settings: unknown
}>): StrybldrCameraSettings | null {
  const direction = resolveThreeKeyboardMotionDirection(input.keys)
  if (!direction || !Number.isFinite(input.amount) || input.amount <= 0) return null
  const settings = readStrybldrCameraSettings(input.settings)
  const orbit = resolveStrybldrCameraOrbit(
    settings.orbitX + direction[0] * input.amount,
    settings.orbitY + direction[1] * input.amount,
  )
  return readStrybldrCameraSettings({ ...settings, ...orbit })
}

export function clampThreeObjectPlanarPosition(input: Readonly<{
  bounds: ThreeObjectKeyboardMotionBounds
  delta: readonly [number, number]
  position: ThreeObjectKeyboardMotionVector
}>): ThreeObjectKeyboardMotionVector {
  return Object.freeze([
    Math.max(-input.bounds.halfWidth, Math.min(input.bounds.halfWidth, input.position[0] + input.delta[0])),
    input.position[1],
    Math.max(-input.bounds.halfDepth, Math.min(input.bounds.halfDepth, input.position[2] + input.delta[1])),
  ]) as ThreeObjectKeyboardMotionVector
}
