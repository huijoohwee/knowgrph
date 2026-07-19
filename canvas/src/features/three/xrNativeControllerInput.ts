export type XrNativeControllerInputSource = 'none' | 'keyboard' | 'gamepad' | 'mixed'

export type XrNativeControllerInput = Readonly<{
  moveX: number
  moveZ: number
  primary: boolean
  modifier: boolean
  source: XrNativeControllerInputSource
}>

type GamepadLike = Readonly<{
  connected?: boolean
  mapping?: string
  axes?: ArrayLike<number>
  buttons?: ArrayLike<Readonly<{ pressed?: boolean; value?: number }>>
}>

const GAMEPAD_DEAD_ZONE = 0.16
const MOVEMENT_CODES = Object.freeze({
  left: new Set(['KeyA', 'ArrowLeft']),
  right: new Set(['KeyD', 'ArrowRight']),
  forward: new Set(['KeyW', 'ArrowUp']),
  backward: new Set(['KeyS', 'ArrowDown']),
  primary: new Set(['Space']),
  modifier: new Set(['ShiftLeft', 'ShiftRight']),
})

function clampAxis(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(-1, Math.min(1, parsed)) : 0
}

function normalizeAxis(value: unknown): number {
  const axis = clampAxis(value)
  const magnitude = Math.abs(axis)
  if (magnitude <= GAMEPAD_DEAD_ZONE) return 0
  return Math.sign(axis) * (magnitude - GAMEPAD_DEAD_ZONE) / (1 - GAMEPAD_DEAD_ZONE)
}

function normalizeMovement(moveXValue: unknown, moveZValue: unknown): readonly [number, number] {
  const moveX = clampAxis(moveXValue)
  const moveZ = clampAxis(moveZValue)
  const magnitude = Math.hypot(moveX, moveZ)
  return magnitude > 1 ? Object.freeze([moveX / magnitude, moveZ / magnitude]) : Object.freeze([moveX, moveZ])
}

function buttonPressed(gamepad: GamepadLike, indexes: readonly number[]): boolean {
  const buttons = gamepad.buttons
  if (!buttons) return false
  return indexes.some(index => {
    const button = buttons[index]
    return Boolean(button?.pressed || Number(button?.value || 0) > 0.5)
  })
}

function hasCode(codes: ReadonlySet<string>, allowed: ReadonlySet<string>): boolean {
  for (const code of codes) if (allowed.has(code)) return true
  return false
}

export function createXrNativeControllerInput(
  value: Partial<Omit<XrNativeControllerInput, 'source'>> & { source?: XrNativeControllerInputSource } = {},
): XrNativeControllerInput {
  const [moveX, moveZ] = normalizeMovement(value.moveX, value.moveZ)
  return Object.freeze({
    moveX,
    moveZ,
    primary: value.primary === true,
    modifier: value.modifier === true,
    source: value.source || 'none',
  })
}

export function readXrNativeControllerKeyboardInput(codes: ReadonlySet<string>): XrNativeControllerInput {
  const left = hasCode(codes, MOVEMENT_CODES.left)
  const right = hasCode(codes, MOVEMENT_CODES.right)
  const forward = hasCode(codes, MOVEMENT_CODES.forward)
  const backward = hasCode(codes, MOVEMENT_CODES.backward)
  const primary = hasCode(codes, MOVEMENT_CODES.primary)
  const modifier = hasCode(codes, MOVEMENT_CODES.modifier)
  const active = left || right || forward || backward || primary || modifier
  return createXrNativeControllerInput({
    moveX: Number(right) - Number(left),
    moveZ: Number(backward) - Number(forward),
    primary,
    modifier,
    source: active ? 'keyboard' : 'none',
  })
}

export function readXrNativeControllerGamepadInput(gamepad: GamepadLike | null | undefined): XrNativeControllerInput {
  if (!gamepad || gamepad.connected === false) return createXrNativeControllerInput()
  const moveX = normalizeAxis(gamepad.axes?.[0])
  const moveZ = normalizeAxis(gamepad.axes?.[1])
  const primary = buttonPressed(gamepad, [0])
  const modifier = buttonPressed(gamepad, [4, 5, 6, 7])
  const active = moveX !== 0 || moveZ !== 0 || primary || modifier
  return createXrNativeControllerInput({
    moveX,
    moveZ,
    primary,
    modifier,
    source: active ? 'gamepad' : 'none',
  })
}

export function mergeXrNativeControllerInputs(
  keyboard: XrNativeControllerInput,
  gamepad: XrNativeControllerInput,
): XrNativeControllerInput {
  const keyboardActive = keyboard.source !== 'none'
  const gamepadActive = gamepad.source !== 'none'
  const source: XrNativeControllerInputSource = keyboardActive && gamepadActive
    ? 'mixed'
    : gamepadActive ? 'gamepad' : keyboardActive ? 'keyboard' : 'none'
  return createXrNativeControllerInput({
    moveX: keyboard.moveX + gamepad.moveX,
    moveZ: keyboard.moveZ + gamepad.moveZ,
    primary: keyboard.primary || gamepad.primary,
    modifier: keyboard.modifier || gamepad.modifier,
    source,
  })
}

export function xrNativeControllerInputCode(code: unknown): boolean {
  const normalized = String(code || '')
  return Object.values(MOVEMENT_CODES).some(codes => codes.has(normalized))
}

export function shouldConsumeXrNativeControllerKeyUp(args: {
  active: boolean
  code: unknown
  editableTarget: boolean
  wasCaptured: boolean
}): boolean {
  return args.active
    && args.wasCaptured
    && !args.editableTarget
    && xrNativeControllerInputCode(args.code)
}
