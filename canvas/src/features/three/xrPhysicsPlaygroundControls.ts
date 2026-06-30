import {
  XR_PHYSICS_CONTROLLER_MODES,
  type XrPhysicsControllerMode,
  type XrPhysicsPlaygroundControls,
} from '@/features/three/xrPhysicsPlaygroundModel'

type XrPhysicsControlsListener = (controls: XrPhysicsPlaygroundControls) => void

type KeyboardControlTarget = {
  addEventListener: (type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void) => void
  removeEventListener: (type: 'keydown' | 'keyup', listener: (event: KeyboardEvent) => void) => void
}

const listeners = new Set<XrPhysicsControlsListener>()
const activeCodes = new Set<string>()
const controlState: Required<XrPhysicsPlaygroundControls> = {
  activeMode: 'roll',
  moveX: 0,
  moveY: 0,
  jump: false,
  thrust: false,
  stabilize: false,
}

function emitControls() {
  const snapshot = readXrPhysicsPlaygroundControls()
  for (const listener of listeners) listener(snapshot)
}

function clampAxis(value: number): number {
  if (value < -1) return -1
  if (value > 1) return 1
  return value
}

function applyCodeState() {
  const left = activeCodes.has('ArrowLeft') || activeCodes.has('KeyA')
  const right = activeCodes.has('ArrowRight') || activeCodes.has('KeyD')
  const up = activeCodes.has('ArrowUp') || activeCodes.has('KeyW')
  const down = activeCodes.has('ArrowDown') || activeCodes.has('KeyS')
  controlState.moveX = clampAxis((right ? 1 : 0) - (left ? 1 : 0))
  controlState.moveY = clampAxis((up ? 1 : 0) - (down ? 1 : 0))
  controlState.jump = activeCodes.has('Space')
  controlState.thrust = activeCodes.has('Space') || activeCodes.has('Enter')
  controlState.stabilize = activeCodes.has('ShiftLeft') || activeCodes.has('ShiftRight')
}

function setModeFromCode(code: string): boolean {
  if (code === 'Digit1' || code === 'KeyR') {
    setXrPhysicsPlaygroundMode('roll')
    return true
  }
  if (code === 'Digit2' || code === 'KeyT') {
    setXrPhysicsPlaygroundMode('thrust')
    return true
  }
  return false
}

function shouldSkipKeyboardEvent(event: KeyboardEvent): boolean {
  const target = event.target
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function handleKeyboardControl(event: KeyboardEvent, pressed: boolean) {
  if (shouldSkipKeyboardEvent(event)) return
  if (pressed && setModeFromCode(event.code)) {
    event.preventDefault()
    return
  }
  const supportedCode = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'KeyA',
    'KeyD',
    'KeyW',
    'KeyS',
    'Space',
    'Enter',
    'ShiftLeft',
    'ShiftRight',
  ].includes(event.code)
  if (!supportedCode) return
  event.preventDefault()
  if (pressed) {
    activeCodes.add(event.code)
  } else {
    activeCodes.delete(event.code)
  }
  applyCodeState()
  emitControls()
}

export function readXrPhysicsPlaygroundControls(): XrPhysicsPlaygroundControls {
  return { ...controlState }
}

export function setXrPhysicsPlaygroundMode(activeMode: XrPhysicsControllerMode): void {
  if (!XR_PHYSICS_CONTROLLER_MODES.includes(activeMode)) return
  if (controlState.activeMode === activeMode) return
  controlState.activeMode = activeMode
  emitControls()
}

export function subscribeXrPhysicsPlaygroundControls(listener: XrPhysicsControlsListener): () => void {
  listeners.add(listener)
  listener(readXrPhysicsPlaygroundControls())
  return () => listeners.delete(listener)
}

export function installXrPhysicsKeyboardControls(target?: KeyboardControlTarget | null): () => void {
  const keyboardTarget = target || (typeof window !== 'undefined' ? window : null)
  if (!keyboardTarget) return () => undefined
  const handleKeyDown = (event: KeyboardEvent) => handleKeyboardControl(event, true)
  const handleKeyUp = (event: KeyboardEvent) => handleKeyboardControl(event, false)
  keyboardTarget.addEventListener('keydown', handleKeyDown)
  keyboardTarget.addEventListener('keyup', handleKeyUp)
  return () => {
    keyboardTarget.removeEventListener('keydown', handleKeyDown)
    keyboardTarget.removeEventListener('keyup', handleKeyUp)
    activeCodes.clear()
    applyCodeState()
    emitControls()
  }
}
