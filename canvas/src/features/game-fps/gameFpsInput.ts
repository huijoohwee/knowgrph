import {
  queueGameFpsFire,
  reloadGameFpsWeapon,
  setGameFpsInput,
} from './gameFpsRuntime'
import type { GameFpsInputPatch } from './gameFpsModel'

const MOVE_CODES = new Set([
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
    if (MOVE_CODES.has(event.code)) {
      pressed.add(event.code)
      publishMovement()
      event.preventDefault()
      return
    }
    if (event.code === 'KeyR' && !event.repeat) {
      reloadGameFpsWeapon()
      event.preventDefault()
    } else if (event.code === 'Space' && !event.repeat) {
      queueGameFpsFire()
      event.preventDefault()
    }
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (!MOVE_CODES.delete(event.code)) return
    publishMovement()
    event.preventDefault()
  }
  const onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== element) return
    setGameFpsInput({
      lookYawDelta: -event.movementX * 0.0022,
      lookPitchDelta: -event.movementY * 0.0018,
    })
  }
  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || document.pointerLockElement !== element) return
    queueGameFpsFire()
  }
  const onPointerLockChange = () => {
    element.dataset.kgGameFpsPointerLock = document.pointerLockElement === element ? 'locked' : 'released'
    if (document.pointerLockElement !== element) releaseInput()
  }
  const requestPointerLock = async () => {
    if (document.pointerLockElement === element) return
    const result = element.requestPointerLock()
    if (result && typeof (result as Promise<void>).then === 'function') await result
  }
  const onCanvasClick = () => {
    void requestPointerLock().catch(() => {
      element.dataset.kgGameFpsPointerLock = 'unavailable'
    })
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', releaseInput)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  element.addEventListener('click', onCanvasClick)

  return Object.freeze({
    requestPointerLock,
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseInput)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      element.removeEventListener('click', onCanvasClick)
      if (document.pointerLockElement === element) void document.exitPointerLock()
      releaseInput()
    },
  })
}
