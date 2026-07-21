import {
  queueGameFpsFire,
  reloadGameFpsWeapon,
  setGameFpsInput,
} from './gameFpsRuntime'
import type { GameFpsInputPatch } from './gameFpsModel'
import { armGameModeSimulation, pauseGameModeSimulation } from './gameModeRuntime'

export type GameFpsTouchAction = 'forward' | 'back' | 'left' | 'right' | 'look-left' | 'look-right'

const MOVE_CODES: ReadonlySet<string> = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'KeyA',
  'KeyD',
  'KeyS',
  'KeyW',
  'ShiftLeft',
  'ShiftRight',
])

export function updateGameFpsPressedCode(
  pressedCodes: Set<string>,
  code: string,
  pressed: boolean,
): boolean {
  if (!MOVE_CODES.has(code)) return false
  if (pressed) {
    pressedCodes.add(code)
    return true
  }
  return pressedCodes.delete(code)
}

export function gameFpsInputPatchFromPressedCodes(codes: ReadonlySet<string>): GameFpsInputPatch {
  const forward = Number(codes.has('KeyW') || codes.has('ArrowUp'))
    - Number(codes.has('KeyS') || codes.has('ArrowDown'))
  const strafe = Number(codes.has('KeyD') || codes.has('ArrowRight'))
    - Number(codes.has('KeyA') || codes.has('ArrowLeft'))
  return {
    forward,
    strafe,
    sprint: codes.has('ShiftLeft') || codes.has('ShiftRight'),
  }
}

export function gameFpsInputPatchFromHeldTouches(
  heldTouches: ReadonlyMap<number, GameFpsTouchAction>,
): GameFpsInputPatch {
  const actions = new Set(heldTouches.values())
  return {
    forward: Number(actions.has('forward')) - Number(actions.has('back')),
    strafe: Number(actions.has('right')) - Number(actions.has('left')),
  }
}

export function releaseGameFpsHeldTouch(
  heldTouches: Map<number, GameFpsTouchAction>,
  event?: Event,
): void {
  if (event && 'pointerId' in event) {
    heldTouches.delete(Number(event.pointerId))
    return
  }
  heldTouches.clear()
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  return element.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName)
}

export type GameFpsInputOwner = Readonly<{
  requestPointerLock: () => Promise<void>
  dispose: () => void
}>

export function installGameFpsDesktopInput(element: HTMLCanvasElement): GameFpsInputOwner {
  const pressed = new Set<string>()

  const publishMovement = () => setGameFpsInput(gameFpsInputPatchFromPressedCodes(pressed))
  const releaseInput = () => {
    pressed.clear()
    setGameFpsInput({ forward: 0, strafe: 0, sprint: false })
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return
    if (updateGameFpsPressedCode(pressed, event.code, true)) {
      armGameModeSimulation()
      publishMovement()
      event.preventDefault()
      return
    }
    if (event.code === 'KeyR' && !event.repeat) {
      armGameModeSimulation()
      reloadGameFpsWeapon()
      event.preventDefault()
    } else if (event.code === 'Space' && !event.repeat) {
      armGameModeSimulation()
      queueGameFpsFire()
      event.preventDefault()
    }
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (!updateGameFpsPressedCode(pressed, event.code, false)) return
    publishMovement()
    event.preventDefault()
  }
  const onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== element) return
    if (event.movementX || event.movementY) armGameModeSimulation()
    setGameFpsInput({
      lookYawDelta: -event.movementX * 0.0022,
      lookPitchDelta: -event.movementY * 0.0018,
    })
  }
  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || document.pointerLockElement !== element) return
    armGameModeSimulation()
    queueGameFpsFire()
  }
  const onPointerLockChange = () => {
    element.dataset.kgGameFpsPointerLock = document.pointerLockElement === element ? 'locked' : 'released'
    if (document.pointerLockElement !== element) {
      releaseInput()
      pauseGameModeSimulation('Game Mode paused when pointer control was released.')
    }
  }
  const requestPointerLock = async () => {
    if (document.pointerLockElement === element) return
    const result = element.requestPointerLock()
    if (result && typeof (result as Promise<void>).then === 'function') await result
  }
  const onCanvasClick = () => {
    armGameModeSimulation()
    void requestPointerLock().catch(() => {
      element.dataset.kgGameFpsPointerLock = 'unavailable'
    })
  }
  const onWindowBlur = () => {
    releaseInput()
    pauseGameModeSimulation('Game Mode paused when the window lost focus.')
  }
  const onWindowResize = () => {
    releaseInput()
    pauseGameModeSimulation('Game Mode paused while the viewport changed.')
  }
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'hidden') return
    releaseInput()
    pauseGameModeSimulation('Game Mode paused while the document is hidden.')
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('resize', onWindowResize)
  document.addEventListener('visibilitychange', onVisibilityChange)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  element.addEventListener('click', onCanvasClick)

  return Object.freeze({
    requestPointerLock,
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('resize', onWindowResize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      element.removeEventListener('click', onCanvasClick)
      if (document.pointerLockElement === element) void document.exitPointerLock()
      releaseInput()
    },
  })
}
