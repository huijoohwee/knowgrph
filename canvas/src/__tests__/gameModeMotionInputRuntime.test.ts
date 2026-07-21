import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyGameFpsMotionControlInput,
  releaseGameFpsMotionControlInput,
} from '@/features/game-fps/gameFpsMotionControlAdapter'
import {
  advanceGameFpsBy,
  readGameFpsSnapshot,
  readGameFpsSpatialProfile,
} from '@/features/game-fps/gameFpsRuntime'
import {
  advanceGameModeSimulationBy,
  pauseGameModeSimulation,
  readGameModeSnapshot,
  reportGameModeSimulationFailure,
  startGameMode,
} from '@/features/game-fps/gameModeRuntime'
import {
  GAME_FPS_FIXED_STEP_SECONDS,
  GAME_FPS_SHARED_XR_PROFILE_ID,
} from '@/features/game-fps/gameFpsModel'
import { createXrNativeControllerInput } from '@/features/three/xrNativeControllerInput'
import { createGameFpsSimulationClock } from '@/features/game-fps/gameFpsSimulationClock'
import { installGameModeRuntimeTestLifecycle } from './helpers/gameModeRuntimeTestLifecycle'

installGameModeRuntimeTestLifecycle('game-mode-motion-input-runtime')

async function settleSimulationClock(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve()
}

test('Motion Control input composes with Game FPS and primary fires only on a rising edge', async () => {
  await startGameMode({ decisions: [], webglSupported: true })
  assert.equal(readGameFpsSpatialProfile().id, GAME_FPS_SHARED_XR_PROFILE_ID)
  const forwardAndFire = createXrNativeControllerInput({
    moveZ: -1, primary: true, modifier: true, source: 'motion',
  })
  applyGameFpsMotionControlInput(forwardAndFire, true)
  const before = readGameFpsSnapshot()
  await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  const first = readGameFpsSnapshot()
  assert.ok(first.player.z < before.player.z)
  assert.equal(first.ammo, before.ammo - 1)
  applyGameFpsMotionControlInput(forwardAndFire, true)
  await advanceGameFpsBy(0.25)
  assert.equal(readGameFpsSnapshot().ammo, first.ammo, 'held primary must not auto-fire every frame')
  releaseGameFpsMotionControlInput()
  applyGameFpsMotionControlInput(forwardAndFire, true)
  await advanceGameFpsBy(GAME_FPS_FIXED_STEP_SECONDS)
  assert.equal(readGameFpsSnapshot().ammo, first.ammo - 1, 'a new primary edge must fire once')
})

test('Motion Control requires a neutral edge after a lifecycle pause', async () => {
  await startGameMode({ decisions: [], webglSupported: true })
  const heldMotion = createXrNativeControllerInput({
    moveZ: -1, primary: true, source: 'motion',
  })
  const neutralMotion = createXrNativeControllerInput()

  applyGameFpsMotionControlInput(heldMotion, true)
  pauseGameModeSimulation()
  const paused = readGameFpsSnapshot()
  applyGameFpsMotionControlInput(neutralMotion, false)
  applyGameFpsMotionControlInput(heldMotion, true)
  const rejected = await advanceGameModeSimulationBy(GAME_FPS_FIXED_STEP_SECONDS)
  assert.equal(readGameModeSnapshot().simulationStatus, 'paused')
  assert.equal(rejected.tick, paused.tick)
  assert.equal(rejected.ammo, paused.ammo)

  applyGameFpsMotionControlInput(neutralMotion, true)
  applyGameFpsMotionControlInput(heldMotion, true)
  const resumed = await advanceGameModeSimulationBy(GAME_FPS_FIXED_STEP_SECONDS)
  assert.equal(readGameModeSnapshot().simulationStatus, 'running')
  assert.equal(resumed.tick, paused.tick + 1)
  assert.equal(resumed.ammo, paused.ammo - 1)
})

test('Motion Control tracking loss requires a reliable neutral edge before held input resumes', async () => {
  await startGameMode({ decisions: [], webglSupported: true })
  const heldMotion = createXrNativeControllerInput({
    moveZ: -1, primary: true, source: 'motion',
  })
  const neutralMotion = createXrNativeControllerInput()

  applyGameFpsMotionControlInput(heldMotion, true)
  const first = await advanceGameModeSimulationBy(GAME_FPS_FIXED_STEP_SECONDS)
  applyGameFpsMotionControlInput(neutralMotion, false)
  applyGameFpsMotionControlInput(heldMotion, true)
  const rejected = await advanceGameModeSimulationBy(0.25)
  assert.equal(rejected.ammo, first.ammo)
  assert.equal(rejected.player.z, first.player.z)

  applyGameFpsMotionControlInput(neutralMotion, true)
  applyGameFpsMotionControlInput(heldMotion, true)
  const resumed = await advanceGameModeSimulationBy(GAME_FPS_FIXED_STEP_SECONDS)
  assert.equal(resumed.ammo, first.ammo - 1)
  assert.ok(resumed.player.z < first.player.z)
})

test('a live fixed-clock rejection publishes through the Game Mode runtime owner', async () => {
  await startGameMode({ decisions: [], webglSupported: true })
  const clock = createGameFpsSimulationClock({
    runStep: async () => {
      throw new Error('fixed Game Mode clock failed')
    },
    onStepError: reportGameModeSimulationFailure,
    minimumStepIntervalMs: 0,
  })

  clock.requestStep()
  await settleSimulationClock()
  clock.dispose()

  assert.equal(readGameModeSnapshot().launchStatus, 'error')
  assert.equal(readGameModeSnapshot().simulationStatus, 'idle')
  assert.equal(readGameFpsSnapshot().runtimeError, 'fixed Game Mode clock failed')
})
