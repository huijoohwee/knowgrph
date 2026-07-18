import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createXrNativeControllerInput,
  mergeXrNativeControllerInputs,
  readXrNativeControllerGamepadInput,
  readXrNativeControllerKeyboardInput,
  shouldConsumeXrNativeControllerKeyUp,
} from '@/features/three/xrNativeControllerInput'
import {
  XR_NATIVE_CONTROLLER_DEMO_PLAYER_ID,
  createXrNativeControllerDemoRuntime,
  readXrNativeControllerDemoRuntimeFrame,
  resetXrNativeControllerDemoRuntime,
  setXrNativeControllerDemoRuntimeInput,
  stepXrNativeControllerDemoRuntime,
  stepXrNativeControllerDemoRuntimeTicks,
} from '@/features/three/xrNativeControllerDemoRuntime'
import {
  buildXrPhysicsInvocation,
} from '@/features/three/xrSceneMcpContract.mjs'
import {
  normalizeXrPhysicsControl,
  parseXrInteractiveInvocation,
} from '@/features/three/xrSceneInteractiveInvocation'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function near(actual: number, expected: number, tolerance: number, message: string): void {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`${message}: expected ${expected}, got ${actual}`)
}

function source(...parts: string[]): string {
  return readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')
}

function runningRuntime(mode: 'ball' | 'rocket' = 'ball') {
  const runtime = createXrNativeControllerDemoRuntime()
  runtime.mode = mode
  runtime.phase = 'running'
  stepXrNativeControllerDemoRuntimeTicks(runtime, 2)
  return runtime
}

export function testXrNativeControllerInputNormalizesKeyboardAndGamepad() {
  const keyboard = readXrNativeControllerKeyboardInput(new Set(['KeyW', 'KeyD', 'ShiftLeft']))
  near(Math.hypot(keyboard.moveX, keyboard.moveZ), 1, 1e-9, 'diagonal keyboard input must normalize')
  assert(keyboard.moveX > 0 && keyboard.moveZ < 0 && keyboard.modifier, 'keyboard must map movement and modifier')
  const primaryGamepad = readXrNativeControllerGamepadInput({
    connected: true,
    axes: [0.5, 0.1],
    buttons: [{ pressed: true, value: 1 }],
  })
  assert(primaryGamepad.moveX > 0 && primaryGamepad.moveZ === 0, 'gamepad dead zone must suppress stick drift')
  assert(primaryGamepad.primary && primaryGamepad.source === 'gamepad', 'standard south button must map to primary')
  const shoulderGamepad = readXrNativeControllerGamepadInput({
    connected: true,
    axes: [0, -0.8],
    buttons: Array.from({ length: 6 }, (_, index) => ({ pressed: index === 5, value: index === 5 ? 1 : 0 })),
  })
  assert(shoulderGamepad.modifier && shoulderGamepad.moveZ < 0, 'standard shoulder and vertical stick must map')
  const merged = mergeXrNativeControllerInputs(keyboard, primaryGamepad)
  assert(merged.source === 'mixed' && merged.primary && merged.modifier, 'keyboard and gamepad must merge into one canonical state')
  assert(readXrNativeControllerGamepadInput(null).source === 'none', 'missing gamepads must fail closed')
  assert(!shouldConsumeXrNativeControllerKeyUp({ active: false, code: 'Space', editableTarget: false, wasCaptured: true }), 'inactive demo must not cancel Space keyup')
  assert(!shouldConsumeXrNativeControllerKeyUp({ active: true, code: 'Space', editableTarget: false, wasCaptured: false }), 'uncaptured keyup must remain available to focused controls')
  assert(shouldConsumeXrNativeControllerKeyUp({ active: true, code: 'Space', editableTarget: false, wasCaptured: true }), 'active captured input must suppress the matching browser action')
}

export function testXrNativeBallControllerIsDeterministicAndInteractive() {
  const chunked = runningRuntime('ball')
  const exact = runningRuntime('ball')
  const input = createXrNativeControllerInput({ moveZ: -1, modifier: true, source: 'keyboard' })
  setXrNativeControllerDemoRuntimeInput(chunked, input)
  setXrNativeControllerDemoRuntimeInput(exact, input)
  for (let index = 0; index < 120; index += 1) stepXrNativeControllerDemoRuntime(chunked, 1 / 60)
  stepXrNativeControllerDemoRuntimeTicks(exact, 240)
  const chunkedFrame = readXrNativeControllerDemoRuntimeFrame(chunked)
  const exactFrame = readXrNativeControllerDemoRuntimeFrame(exact)
  assert(JSON.stringify(chunkedFrame) === JSON.stringify(exactFrame), 'fixed input must replay identically across render chunks')
  assert(chunkedFrame.player.position[2] < 3, `ball movement must drive the shared rigid body forward, got ${JSON.stringify(chunkedFrame.player)}`)
  assert(Math.abs(chunkedFrame.ballRotation[0]) > 0.1 && Math.abs(chunkedFrame.ballRotation[1]) > 0.01, 'ball displacement and modifier must produce visible roll and torque')
  const crate = chunkedFrame.bodies.find(body => body.subjectId === 'native-crate-a')
  assert(crate && crate.position[2] < -1.2, 'ball controller must push a dynamic physics interaction prop')

  resetXrNativeControllerDemoRuntime(chunked)
  chunked.phase = 'running'
  stepXrNativeControllerDemoRuntimeTicks(chunked, 2)
  setXrNativeControllerDemoRuntimeInput(chunked, createXrNativeControllerInput({ primary: true, source: 'keyboard' }))
  stepXrNativeControllerDemoRuntimeTicks(chunked, 1)
  const jumped = readXrNativeControllerDemoRuntimeFrame(chunked)
  assert(jumped.player.velocity[1] > 6 && !jumped.player.grounded, 'ball primary action must jump only from supported contact')
  setXrNativeControllerDemoRuntimeInput(chunked, createXrNativeControllerInput({ moveX: 1, source: 'keyboard' }))
  stepXrNativeControllerDemoRuntimeTicks(chunked, 24)
  assert(readXrNativeControllerDemoRuntimeFrame(chunked).player.position[0] > 0.02, 'ball must retain bounded air steering')
}

export function testXrNativeRocketControllerThrustsTiltsAndStabilizes() {
  const runtime = runningRuntime('rocket')
  setXrNativeControllerDemoRuntimeInput(runtime, createXrNativeControllerInput({
    moveX: 1,
    moveZ: -1,
    primary: true,
    source: 'gamepad',
  }))
  stepXrNativeControllerDemoRuntimeTicks(runtime, 120)
  const thrust = readXrNativeControllerDemoRuntimeFrame(runtime)
  assert(thrust.player.position[1] > 1 && thrust.player.position[0] > 0, 'rocket must combine vertical thrust with directional boosters')
  assert(thrust.rocketThrusting && thrust.rocketRotation[0] < -0.1 && thrust.rocketRotation[2] < -0.1, 'rocket must expose thrust and bounded directional tilt')
  assert(Math.abs(thrust.rocketRotation[0]) <= Math.PI * 0.25 && Math.abs(thrust.rocketRotation[2]) <= Math.PI * 0.25, 'rocket tilt must stay bounded')
  const poseBeforeSwitch = JSON.stringify({ position: thrust.player.position, velocity: thrust.player.velocity })
  runtime.mode = 'ball'
  const switched = readXrNativeControllerDemoRuntimeFrame(runtime)
  assert(JSON.stringify({ position: switched.player.position, velocity: switched.player.velocity }) === poseBeforeSwitch, 'controller switching must preserve pose and velocity')
  runtime.mode = 'rocket'
  setXrNativeControllerDemoRuntimeInput(runtime, createXrNativeControllerInput({ modifier: true, source: 'keyboard' }))
  stepXrNativeControllerDemoRuntimeTicks(runtime, 120)
  const stabilized = readXrNativeControllerDemoRuntimeFrame(runtime)
  assert(Math.abs(stabilized.rocketRotation[0]) < Math.abs(thrust.rocketRotation[0]) * 0.4, 'modifier must stabilize pitch toward upright')
  assert(Math.abs(stabilized.rocketRotation[2]) < Math.abs(thrust.rocketRotation[2]) * 0.4, 'modifier must stabilize roll toward upright')
  resetXrNativeControllerDemoRuntime(runtime)
  const reset = readXrNativeControllerDemoRuntimeFrame(runtime)
  assert(reset.stepCount === 0 && reset.player.subjectId === XR_NATIVE_CONTROLLER_DEMO_PLAYER_ID, 'reset must restore the authored native controller simulation')
  assert(JSON.stringify(reset.player.position) === JSON.stringify([0, 0, 4.2]), 'reset must restore the exact authored spawn pose')
}

export function testXrNativeControllerDemoUsesCanonicalSurfaceAndMcpRoute() {
  const invocation = buildXrPhysicsInvocation('controller', 'develop-run', { mode: 'rocket' })
  const parsed = parseXrInteractiveInvocation(invocation)
  assert(parsed?.action === 'physics' && parsed.physics.scope === 'controller', 'controller invocation must reuse the canonical XR physics command')
  assert(parsed.physics.operation === 'develop-run' && parsed.physics.controllerMode === 'rocket', 'controller invocation must preserve operation and mode')
  assert(normalizeXrPhysicsControl({ scope: 'controller', operation: 'select', controllerMode: 'ball' })?.controllerMode === 'ball', 'structured MCP controller selection must normalize')
  assert(normalizeXrPhysicsControl({ scope: 'controller', operation: 'select' }) === null, 'controller selection must reject a missing mode')

  const workbench = source('features', 'command-menu', 'XrSimulationWorkbench.tsx')
  const controls = source('features', 'command-menu', 'XrNativeControllerDemoControls.tsx')
  const stage = source('features', 'three', 'XrNativeControllerDemoStage.tsx')
  const graphStage = source('features', 'three', 'XrGraphStage.tsx')
  const camera = source('features', 'three', 'useXrNativeControllerDemoCamera.ts')
  const threeControls = source('features', 'three', 'Controls.tsx')
  assert(workbench.includes('<XrNativeControllerDemoControls'), 'existing Simulation workbench must own the demo controls')
  for (const marker of ['data-kg-xr-native-controller-demo="1"', 'data-kg-xr-native-controller-action={marker}', 'marker="develop-run"', 'data-kg-xr-native-controller-invocation']) {
    assert(controls.includes(marker), `native controller UI must expose ${marker}`)
  }
  assert(graphStage.includes('<XrNativeControllerDemoStage'), 'canonical graph XR stage must mount the native procedural demo')
  assert(stage.includes('navigator.getGamepads()') && stage.includes('readXrNativeControllerKeyboardInput'), 'stage runtime must unify standard gamepad and keyboard input')
  assert(camera.includes('controls.target.lerp') && threeControls.includes('useXrNativeControllerDemoCamera'), 'shared camera owner must provide smooth controller following')

  const corePaths = [
    ['features', 'three', 'xrNativeControllerInput.ts'],
    ['features', 'three', 'xrNativeControllerDemoRuntime.ts'],
    ['features', 'three', 'XrNativeControllerDemoStage.tsx'],
    ['features', 'three', 'useXrNativeControllerDemoCamera.ts'],
    ['features', 'command-menu', 'XrNativeControllerDemoControls.tsx'],
  ] as const
  const forbiddenOwner = ['8', 'th', 'wall'].join('')
  const forbiddenProject = ['studio', 'physics', 'playground', 'example'].join('-')
  for (const pathParts of corePaths) {
    const text = source(...pathParts)
    assert(text.split('\n').length < 600, `${pathParts.at(-1)} must stay below the source budget`)
    assert(!text.toLowerCase().includes(forbiddenOwner) && !text.toLowerCase().includes(forbiddenProject), `${pathParts.at(-1)} must stay clean-room`)
  }
  const runtimeSource = source('features', 'three', 'xrNativeControllerDemoRuntime.ts')
  assert(runtimeSource.includes("from './xrPhysicsStepper'"), 'controller demo must reuse the existing deterministic solver')
  assert(!/from ['"](?![.@/])/.test(runtimeSource), 'headless controller runtime must not add an external dependency')
}
