import type { XrNativeControllerInput } from '@/features/three/xrNativeControllerInput'
import { setGameFpsMotionInput } from './gameFpsRuntime'
import { armGameModeSimulation } from './gameModeRuntime'

export function applyGameFpsMotionControlInput(input: XrNativeControllerInput): void {
  if (input.source === 'motion') armGameModeSimulation()
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
