import type { XrNativeControllerInput } from '@/features/three/xrNativeControllerInput'
import { setGameFpsMotionInput } from './gameFpsRuntime'

export function applyGameFpsMotionControlInput(input: XrNativeControllerInput): void {
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
