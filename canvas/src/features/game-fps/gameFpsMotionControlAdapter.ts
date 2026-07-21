import type { XrNativeControllerInput } from '@/features/three/xrNativeControllerInput'
import { setGameFpsMotionInput } from './gameFpsRuntime'
import { authorizeGameModeMotionInput } from './gameModeRuntime'

export function applyGameFpsMotionControlInput(
  input: XrNativeControllerInput,
  tracked: boolean,
): void {
  const active = input.source === 'motion'
  if (!authorizeGameModeMotionInput({ active, tracked })) {
    releaseGameFpsMotionControlInput()
    return
  }
  setGameFpsMotionInput({
    forward: -input.moveZ,
    strafe: input.moveX,
    sprint: input.modifier,
    primary: input.primary,
  })
}

export function releaseGameFpsMotionControlInput(): void {
  setGameFpsMotionInput({ forward: 0, strafe: 0, sprint: false, primary: false })
}
