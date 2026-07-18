export const THREE_OBJECT_KEYBOARD_STEP_METERS = 0.25
export const THREE_OBJECT_KEYBOARD_FINE_STEP_METERS = 0.05
export const THREE_OBJECT_KEYBOARD_HOLD_DELAY_MS = 160
export const THREE_OBJECT_KEYBOARD_SPEED_METERS_PER_SECOND = 2
export const THREE_OBJECT_KEYBOARD_FINE_SPEED_METERS_PER_SECOND = 0.4
export const THREE_OBJECT_KEYBOARD_MAX_FRAME_DELTA_MS = 50
export const THREE_OBJECT_KEYBOARD_MAX_COMMAND_DISTANCE_METERS = 10

export const THREE_OBJECT_KEYBOARD_MOVEMENT_KEYS = Object.freeze([
  'w',
  'a',
  's',
  'd',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
] as const)

export type ThreeObjectKeyboardMovementKey = typeof THREE_OBJECT_KEYBOARD_MOVEMENT_KEYS[number]
export type ThreeObjectKeyboardMotionVector = readonly [number, number, number]

export type ThreeObjectKeyboardEvent = Readonly<{
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

const MOVEMENT_KEY_SET = new Set<string>(THREE_OBJECT_KEYBOARD_MOVEMENT_KEYS)

export function normalizeThreeObjectKeyboardKey(keyValue: string): string {
  const key = String(keyValue || '')
  return key.length === 1 ? key.toLowerCase() : key
}

export function readThreeObjectKeyboardMovementKey(
  keyValue: string,
): ThreeObjectKeyboardMovementKey | null {
  const key = normalizeThreeObjectKeyboardKey(keyValue)
  return MOVEMENT_KEY_SET.has(key) ? key as ThreeObjectKeyboardMovementKey : null
}

export function readThreeObjectKeyboardMovementKeys(
  keys: Iterable<string>,
): readonly ThreeObjectKeyboardMovementKey[] | null {
  const normalized = [...keys].map(readThreeObjectKeyboardMovementKey)
  if (normalized.length === 0 || normalized.some(key => key === null)) return null
  return Object.freeze([...new Set(normalized as ThreeObjectKeyboardMovementKey[])])
}

export function resolveThreeObjectKeyboardTapDelta(
  event: ThreeObjectKeyboardEvent,
): readonly [number, number] | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null
  const key = readThreeObjectKeyboardMovementKey(event.key)
  if (!key) return null
  const step = event.shiftKey
    ? THREE_OBJECT_KEYBOARD_FINE_STEP_METERS
    : THREE_OBJECT_KEYBOARD_STEP_METERS
  if (key === 'a' || key === 'ArrowLeft') return [-step, 0]
  if (key === 'd' || key === 'ArrowRight') return [step, 0]
  if (key === 'w' || key === 'ArrowUp') return [0, -step]
  return [0, step]
}

export function resolveThreeObjectKeyboardMotionDirection(
  keys: Iterable<string>,
): readonly [number, number] | null {
  const normalized = readThreeObjectKeyboardMovementKeys(keys)
  if (!normalized) return null
  const normalizedKeys = new Set(normalized)
  const x = Number(normalizedKeys.has('d') || normalizedKeys.has('ArrowRight'))
    - Number(normalizedKeys.has('a') || normalizedKeys.has('ArrowLeft'))
  const z = Number(normalizedKeys.has('s') || normalizedKeys.has('ArrowDown'))
    - Number(normalizedKeys.has('w') || normalizedKeys.has('ArrowUp'))
  const magnitude = Math.hypot(x, z)
  return magnitude > 0 ? [x / magnitude, z / magnitude] : null
}

export function resolveThreeObjectKeyboardMotionFrameDistance(
  deltaMs: number,
  fine: boolean,
): number {
  const finiteDeltaMs = Number.isFinite(deltaMs) ? deltaMs : 0
  const boundedDeltaMs = Math.max(
    0,
    Math.min(THREE_OBJECT_KEYBOARD_MAX_FRAME_DELTA_MS, finiteDeltaMs),
  )
  const speed = fine
    ? THREE_OBJECT_KEYBOARD_FINE_SPEED_METERS_PER_SECOND
    : THREE_OBJECT_KEYBOARD_SPEED_METERS_PER_SECOND
  return speed * boundedDeltaMs / 1000
}

export function resolveThreeObjectKeyboardMotionPosition(input: Readonly<{
  bounds: ThreeObjectKeyboardMotionBounds
  distanceMeters: number
  keys: Iterable<string>
  position: ThreeObjectKeyboardMotionVector
}>): ThreeObjectKeyboardMotionVector | null {
  const direction = resolveThreeObjectKeyboardMotionDirection(input.keys)
  if (!direction || !Number.isFinite(input.distanceMeters) || input.distanceMeters <= 0) return null
  return clampThreeObjectPlanarPosition({
    bounds: input.bounds,
    delta: [direction[0] * input.distanceMeters, direction[1] * input.distanceMeters],
    position: input.position,
  })
}

export function clampThreeObjectPlanarPosition(input: Readonly<{
  bounds: ThreeObjectKeyboardMotionBounds
  delta: readonly [number, number]
  position: ThreeObjectKeyboardMotionVector
}>): ThreeObjectKeyboardMotionVector {
  const nextPosition = Object.freeze([
    Math.max(
      -input.bounds.halfWidth,
      Math.min(input.bounds.halfWidth, input.position[0] + input.delta[0]),
    ),
    input.position[1],
    Math.max(
      -input.bounds.halfDepth,
      Math.min(input.bounds.halfDepth, input.position[2] + input.delta[1]),
    ),
  ]) as ThreeObjectKeyboardMotionVector
  return nextPosition
}
