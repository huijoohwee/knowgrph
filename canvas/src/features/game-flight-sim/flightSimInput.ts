import {
  FLIGHT_SIM_NEUTRAL_INPUT,
  clampFlightSimUnit,
  normalizeFlightSimInput,
  type FlightSimInputPatch,
  type FlightSimTickInput,
} from './flightSimModel'

export type FlightSimTouchControl = 'pitch-up' | 'pitch-down' | 'roll-left' | 'roll-right'
  | 'yaw-left' | 'yaw-right' | 'throttle-up' | 'throttle-down'

export type StandardGamepadLike = Readonly<{
  connected?: boolean
  mapping?: string
  axes: readonly number[]
  buttons: readonly Readonly<{ value: number; pressed?: boolean }>[]
}>

export type FlightSimInputBinding = Readonly<{
  consumeInput: () => FlightSimTickInput
  requestPointerLock: () => Promise<void>
  dispose: () => void
}>

const CONTROL_CODES = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ControlLeft',
  'ControlRight',
  'KeyA',
  'KeyD',
  'KeyE',
  'KeyQ',
  'KeyS',
  'KeyW',
  'ShiftLeft',
  'ShiftRight',
])

const GAMEPAD_DEAD_ZONE = 0.12
let touchInput = FLIGHT_SIM_NEUTRAL_INPUT

function digital(positive: boolean, negative: boolean): number {
  return Number(positive) - Number(negative)
}

function deadZone(value: unknown): number {
  const normalized = clampFlightSimUnit(value, 'Flight Sim gamepad axis')
  if (Math.abs(normalized) <= GAMEPAD_DEAD_ZONE) return 0
  const magnitude = (Math.abs(normalized) - GAMEPAD_DEAD_ZONE) / (1 - GAMEPAD_DEAD_ZONE)
  return Math.sign(normalized) * magnitude
}

function buttonValue(gamepad: StandardGamepadLike, index: number): number {
  const button = gamepad.buttons[index]
  if (!button) return 0
  return clampFlightSimUnit(button.pressed ? Math.max(button.value, 1) : button.value, 'Flight Sim gamepad button')
}

export function updateFlightSimPressedCode(
  pressedCodes: Set<string>,
  code: string,
  pressed: boolean,
): boolean {
  if (!CONTROL_CODES.has(code)) return false
  if (pressed) {
    const previousSize = pressedCodes.size
    pressedCodes.add(code)
    return pressedCodes.size !== previousSize
  }
  return pressedCodes.delete(code)
}

export function flightSimInputFromPressedCodes(codes: ReadonlySet<string>): FlightSimTickInput {
  return normalizeFlightSimInput({
    pitch: digital(
      codes.has('KeyW') || codes.has('ArrowUp'),
      codes.has('KeyS') || codes.has('ArrowDown'),
    ),
    roll: digital(
      codes.has('KeyD') || codes.has('ArrowRight'),
      codes.has('KeyA') || codes.has('ArrowLeft'),
    ),
    yaw: digital(codes.has('KeyQ'), codes.has('KeyE')),
    throttleDelta: digital(
      codes.has('ShiftLeft') || codes.has('ShiftRight'),
      codes.has('ControlLeft') || codes.has('ControlRight'),
    ),
  })
}

export function flightSimInputFromHeldTouches(
  heldTouches: ReadonlyMap<number, FlightSimTouchControl>,
): FlightSimTickInput {
  const controls = new Set(heldTouches.values())
  return normalizeFlightSimInput({
    pitch: digital(controls.has('pitch-up'), controls.has('pitch-down')),
    roll: digital(controls.has('roll-right'), controls.has('roll-left')),
    yaw: digital(controls.has('yaw-left'), controls.has('yaw-right')),
    throttleDelta: digital(controls.has('throttle-up'), controls.has('throttle-down')),
  })
}

export function setFlightSimTouchInput(value: FlightSimInputPatch): FlightSimTickInput {
  touchInput = normalizeFlightSimInput(value)
  return touchInput
}

export function readFlightSimTouchInput(): FlightSimTickInput {
  return touchInput
}

export function releaseFlightSimHeldTouch(
  heldTouches: Map<number, FlightSimTouchControl>,
  event?: Pick<PointerEvent, 'pointerId'>,
): void {
  if (event) heldTouches.delete(event.pointerId)
  else heldTouches.clear()
}

export function flightSimInputFromPointerDelta(
  movementX: unknown,
  movementY: unknown,
): FlightSimTickInput {
  const x = Number(movementX)
  const y = Number(movementY)
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Flight Sim pointer deltas must be finite')
  return normalizeFlightSimInput({
    pitch: -y * 0.018,
    yaw: -x * 0.014,
  })
}

export function flightSimInputFromStandardGamepad(
  gamepad: StandardGamepadLike | null | undefined,
): FlightSimTickInput {
  if (!gamepad || gamepad.connected === false || (gamepad.mapping && gamepad.mapping !== 'standard')) {
    return FLIGHT_SIM_NEUTRAL_INPUT
  }
  const leftShoulder = buttonValue(gamepad, 4)
  const rightShoulder = buttonValue(gamepad, 5)
  const leftTrigger = buttonValue(gamepad, 6)
  const rightTrigger = buttonValue(gamepad, 7)
  return normalizeFlightSimInput({
    pitch: -deadZone(gamepad.axes[1] ?? 0),
    roll: deadZone(gamepad.axes[0] ?? 0),
    yaw: leftShoulder - rightShoulder,
    throttleDelta: rightTrigger - leftTrigger,
  })
}

export function readStandardFlightSimGamepad(
  navigatorValue: Pick<Navigator, 'getGamepads'> | null = typeof navigator === 'undefined' ? null : navigator,
): FlightSimTickInput {
  const gamepads = navigatorValue?.getGamepads?.()
  const gamepad = gamepads ? [...gamepads].find(value => value?.connected && value.mapping === 'standard') : null
  return flightSimInputFromStandardGamepad(gamepad)
}

export function mergeFlightSimInputs(inputs: readonly FlightSimInputPatch[]): FlightSimTickInput {
  return normalizeFlightSimInput(inputs.reduce<Required<FlightSimInputPatch>>((merged, input) => ({
    pitch: merged.pitch + (input.pitch ?? 0),
    roll: merged.roll + (input.roll ?? 0),
    yaw: merged.yaw + (input.yaw ?? 0),
    throttleDelta: merged.throttleDelta + (input.throttleDelta ?? 0),
  }), { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0 }))
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  return Boolean(element && (element.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName)))
}

export function installFlightSimDesktopInput(
  element: HTMLCanvasElement,
  options: Readonly<{
    onInput: (input: FlightSimTickInput) => void
    onPause?: (reason: string) => void
    shouldPauseOnPointerRelease?: () => boolean
    shouldRequestPointerLock?: () => boolean
  }>,
): FlightSimInputBinding {
  const pressedCodes = new Set<string>()
  let pointerInput = FLIGHT_SIM_NEUTRAL_INPUT
  const currentInput = () => mergeFlightSimInputs([
    flightSimInputFromPressedCodes(pressedCodes),
    pointerInput,
  ])
  const publishKeyboard = () => options.onInput(currentInput())
  const release = (reason?: string) => {
    pressedCodes.clear()
    pointerInput = FLIGHT_SIM_NEUTRAL_INPUT
    options.onInput(FLIGHT_SIM_NEUTRAL_INPUT)
    if (reason) options.onPause?.(reason)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target) || !CONTROL_CODES.has(event.code)) return
    updateFlightSimPressedCode(pressedCodes, event.code, true)
    publishKeyboard()
    event.preventDefault()
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (!CONTROL_CODES.has(event.code)) return
    updateFlightSimPressedCode(pressedCodes, event.code, false)
    publishKeyboard()
    event.preventDefault()
  }
  const onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== element || (!event.movementX && !event.movementY)) return
    pointerInput = mergeFlightSimInputs([
      pointerInput,
      flightSimInputFromPointerDelta(event.movementX, event.movementY),
    ])
    options.onInput(currentInput())
  }
  const onPointerLockChange = () => {
    element.dataset.kgFlightSimPointerLock = document.pointerLockElement === element ? 'locked' : 'released'
    if (document.pointerLockElement !== element) {
      release(options.shouldPauseOnPointerRelease?.() === false
        ? undefined
        : 'Flight Sim paused when pointer control was released.')
    }
  }
  const requestPointerLock = async () => {
    if (options.shouldRequestPointerLock?.() === false) return
    if (document.pointerLockElement === element) return
    const result = element.requestPointerLock()
    if (result && typeof (result as Promise<void>).then === 'function') await result
  }
  const onCanvasClick = () => void requestPointerLock().catch(() => {
    element.dataset.kgFlightSimPointerLock = 'unavailable'
  })
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') release('Flight Sim paused while the document is hidden.')
  }
  const onBlur = () => release('Flight Sim paused when the window lost focus.')

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  document.addEventListener('visibilitychange', onVisibilityChange)
  element.addEventListener('click', onCanvasClick)

  return Object.freeze({
    consumeInput() {
      const value = currentInput()
      pointerInput = FLIGHT_SIM_NEUTRAL_INPUT
      return value
    },
    requestPointerLock,
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      element.removeEventListener('click', onCanvasClick)
      if (document.pointerLockElement === element) void document.exitPointerLock()
      delete element.dataset.kgFlightSimPointerLock
      release()
    },
  })
}
