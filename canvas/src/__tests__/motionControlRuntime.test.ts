import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { findAgenticOsInvocationByToken } from '@/features/agentic-os/agenticOsDocInvocations'
import {
  buildMotionControlInvocation,
  controlLocalMotionControl,
  inspectLocalMotionControl,
} from '@/features/three/motionControlMcpRuntime'
import {
  motionControlPoseToAnimationPose,
  motionControlPoseToControllerInput,
  resetMotionControlCalibration,
  smoothMotionControlPose,
  type MotionControlLandmark,
  type MotionControlPoseFrame,
} from '@/features/three/motionControlPose'
import {
  readMotionControlSnapshot,
  startMotionControl,
  stopMotionControl,
} from '@/features/three/motionControlRuntime'

const source = (...parts: string[]): string => readFileSync(resolve(process.cwd(), ...parts), 'utf8')
const landmark = (x: number, y: number, z = 0): MotionControlLandmark => Object.freeze({ x, y, z, visibility: 0.95, presence: 0.96 })

function poseFrame(timestampMs: number): MotionControlPoseFrame {
  const landmarks = Array.from({ length: 33 }, (_, index) => landmark(0.5, 0.1 + index * 0.018, 0))
  landmarks[11] = landmark(0.4, 0.35, -0.05)
  landmarks[12] = landmark(0.6, 0.35, -0.05)
  landmarks[13] = landmark(0.28, 0.47, -0.12)
  landmarks[14] = landmark(0.72, 0.47, -0.12)
  landmarks[15] = landmark(0.18, 0.22, -0.2)
  landmarks[16] = landmark(0.82, 0.22, -0.2)
  landmarks[23] = landmark(0.46, 0.58, 0)
  landmarks[24] = landmark(0.54, 0.58, 0)
  landmarks[25] = landmark(0.46, 0.76, 0.02)
  landmarks[26] = landmark(0.54, 0.76, 0.02)
  const world = landmarks.map(item => landmark(item.x - 0.5, item.y - 0.58, item.z))
  return Object.freeze({ timestampMs, confidence: 0.92, landmarks: Object.freeze(landmarks), worldLandmarks: Object.freeze(world) })
}

async function testCaptureEndedLifecycle() {
  class CameraTrack extends EventTarget {
    readyState: MediaStreamTrackState = 'live'
    stopped = false

    end(): void {
      this.readyState = 'ended'
      this.dispatchEvent(new Event('ended'))
    }

    stop(): void {
      this.stopped = true
      this.readyState = 'ended'
    }
  }

  const track = new CameraTrack()
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream
  let resolvePlay = () => void 0
  let playCalled = false
  const playPromise = new Promise<void>(resolve => { resolvePlay = resolve })
  const video = {
    autoplay: false,
    muted: false,
    pause: () => void 0,
    play: () => {
      playCalled = true
      return playPromise
    },
    playsInline: false,
    srcObject: null,
  }
  const fakeDocument = Object.assign(new EventTarget(), {
    createElement: () => video,
    visibilityState: 'visible',
  })
  const fakeWindow = Object.assign(new EventTarget(), {
    cancelAnimationFrame: () => void 0,
    isSecureContext: true,
    requestAnimationFrame: () => 1,
  })
  const descriptors = new Map(['document', 'navigator', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaDevices: { getUserMedia: async () => stream } },
    })
    const beforeStops = readMotionControlSnapshot().revision
    await Promise.all([stopMotionControl(), stopMotionControl()])
    if (readMotionControlSnapshot().revision !== beforeStops + 1) {
      throw new Error('expected concurrent stop calls to share one serialized teardown')
    }
    const starting = startMotionControl('wasm')
    for (let attempt = 0; attempt < 12 && readMotionControlSnapshot().phase !== 'requesting-camera'; attempt += 1) {
      await Promise.resolve()
    }
    if (readMotionControlSnapshot().phase !== 'requesting-camera') throw new Error('expected camera request phase before lifecycle test')
    for (let attempt = 0; attempt < 12 && !playCalled; attempt += 1) await Promise.resolve()
    if (!playCalled) throw new Error('expected camera preview to bind before lifecycle test')
    track.end()
    resolvePlay()
    await starting
    await Promise.resolve()
    const ended = readMotionControlSnapshot()
    if (ended.phase !== 'error' || ended.cameraActive || ended.pose || !track.stopped) {
      throw new Error('expected a revoked or ended camera track to clear capture and publish an error')
    }
  } finally {
    resolvePlay()
    await stopMotionControl()
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

export async function testMotionControlRuntimeIsLiteRtInvocableAndXrReady() {
  const frame = poseFrame(1)
  resetMotionControlCalibration()
  const animationPose = motionControlPoseToAnimationPose(frame)
  const controllerInput = motionControlPoseToControllerInput(frame)
  if (!animationPose || !Number.isFinite(animationPose.leftArmRollDegrees) || !Number.isFinite(animationPose.rightArmRollDegrees)) {
    throw new Error('expected finite Motion Control pose projection for native XR humanoids')
  }
  if (controllerInput.source !== 'motion' || controllerInput.primary !== true || controllerInput.modifier !== true) {
    throw new Error('expected tracked pose to enter the canonical native XR controller input pipeline')
  }
  const leaningLandmarks = [...frame.landmarks]
  leaningLandmarks[11] = landmark(0.32, 0.35, -0.05)
  leaningLandmarks[12] = landmark(0.52, 0.35, -0.05)
  const leaningFrame = Object.freeze({ ...frame, timestampMs: 2, landmarks: Object.freeze(leaningLandmarks) })
  const mirroredControllerInput = motionControlPoseToControllerInput(leaningFrame)
  if (mirroredControllerInput.moveX <= 0) {
    throw new Error('expected lateral motion to follow the mirrored local preview')
  }
  const idleLandmarks = [...frame.landmarks]
  idleLandmarks[15] = landmark(0.44, 0.5)
  idleLandmarks[16] = landmark(0.56, 0.5)
  const idleFrame = Object.freeze({ ...frame, timestampMs: 3, landmarks: Object.freeze(idleLandmarks) })
  resetMotionControlCalibration()
  const idleInput = motionControlPoseToControllerInput(idleFrame)
  if (idleInput.source !== 'none' || idleInput.moveX !== 0 || idleInput.moveZ !== 0) {
    throw new Error('expected neutral calibration and dead zones to suppress idle controller motion')
  }
  const unreliableLandmarks = [...leaningFrame.landmarks]
  unreliableLandmarks[11] = Object.freeze({ ...unreliableLandmarks[11]!, visibility: 0.1 })
  unreliableLandmarks[15] = landmark(0.44, 0.5)
  unreliableLandmarks[16] = landmark(0.56, 0.5)
  if (motionControlPoseToControllerInput(Object.freeze({ ...leaningFrame, landmarks: Object.freeze(unreliableLandmarks) })).source !== 'none') {
    throw new Error('expected unreliable required joints to fail closed instead of driving XR controls')
  }
  const raisedLandmarks = [...frame.landmarks]
  raisedLandmarks[13] = landmark(0.2, 0.18, -0.08)
  raisedLandmarks[14] = landmark(0.8, 0.18, -0.08)
  const raisedWorld = raisedLandmarks.map(item => landmark(item.x - 0.5, item.y - 0.58, item.z))
  const raisedPose = motionControlPoseToAnimationPose(Object.freeze({ ...frame, landmarks: Object.freeze(raisedLandmarks), worldLandmarks: Object.freeze(raisedWorld) }))
  if (!raisedPose || raisedPose.leftArmRollDegrees <= 90 || raisedPose.rightArmRollDegrees >= -90) {
    throw new Error('expected raised arms to rotate visibly outward and upward around the humanoid local Y axis')
  }
  const smoothed = smoothMotionControlPose(frame, poseFrame(3))
  if (smoothed.timestampMs !== 3 || smoothed.landmarks.length !== 33 || smoothed.worldLandmarks.length !== 33) {
    throw new Error('expected stable 33-landmark normalized and world-coordinate smoothing')
  }

  const invocation = buildMotionControlInvocation('start', 'auto')
  if (invocation !== '/motion.control @canvas #pose operation=start backend=auto') {
    throw new Error(`expected canonical / @ # Motion Control invocation, received ${invocation}`)
  }
  if (buildMotionControlInvocation('open') !== '/motion.control @canvas #pose operation=open') {
    throw new Error('expected open invocation to omit the start-only backend field')
  }
  for (const [token, kind] of [['/motion.control', 'command'], ['#pose', 'semantic'], ['@canvas', 'binding']] as const) {
    if (findAgenticOsInvocationByToken(token)?.kind !== kind) throw new Error(`expected ${token} in the shared ${kind} catalog`)
  }
  const inspection = inspectLocalMotionControl()
  if (inspection.schema !== 'knowgrph-motion-control-mcp/v1'
    || inspection.runtimeSchema !== 'knowgrph-motion-control/v1'
    || inspection.webMcpTools.control !== 'knowgrph.control_local_motion_control'
    || inspection.webMcpTools.inspect !== 'knowgrph.inspect_local_motion_control'
    || inspection.drivers.selectedHumanoid !== true
    || inspection.drivers.nativePhysicsController !== true
    || inspection.privacy.frameUpload !== false
    || inspection.privacy.framePersistence !== false) {
    throw new Error('expected browser WebMCP and local-only privacy metadata from the canonical Motion Control runtime')
  }
  const rejected = await controlLocalMotionControl({ invocation: '/motion.control @canvas #pose operation=start backend=auto extra=true' })
  if (rejected.ok !== false) throw new Error('expected unknown invocation fields to fail closed')
  const rejectedStructured = await controlLocalMotionControl({ operation: 'open', extra: true } as never)
  if (rejectedStructured.ok !== false) throw new Error('expected unknown structured fields to fail closed')

  const runtimeSource = source('src', 'features', 'three', 'motionControlRuntime.ts')
  const assetScript = source('scripts', 'prepare-litert-assets.mjs')
  const panelSource = source('src', 'features', 'three', 'MotionControlFloatingPanelView.tsx')
  const stageSource = source('src', 'features', 'three', 'XrNativeControllerDemoStage.tsx')
  for (const marker of [
    "import('@litertjs/core')",
    'loadLiteRt(',
    'loadAndCompile(',
    'getUserMedia(',
    'track.stop()',
    'input.delete()',
    'output?.delete()',
    'requestAnimationFrame',
    'model.getInputDetails()',
    'model.getOutputDetails()',
    "model.options.accelerator === 'wasm'",
    "effectiveBackend: 'webgpu+wasm'",
    'valuesAreFinite(',
    "permission: 'prompting'",
    "addEventListener('ended'",
    'document.visibilityState',
    'resetMotionControlCalibration()',
    'stopPromise',
  ]) {
    if (!runtimeSource.includes(marker)) throw new Error(`expected production LiteRT runtime lifecycle marker ${marker}`)
  }
  for (const marker of ['POSE_TASK_SHA256', 'MAX_POSE_TASK_BYTES', 'AbortSignal.timeout(', 'storage.googleapis.com/mediapipe-models/', 'copyFile(', 'pose_landmarks_detector.tflite', 'readBoundedResponseBytes(']) {
    if (!assetScript.includes(marker)) throw new Error(`expected same-origin licensed LiteRT asset preparation marker ${marker}`)
  }
  for (const marker of ['floatingPanelCatalogSurfaceClassName()', 'floatingPanelCatalogBodyClassName(', 'data-kg-motion-control-start', 'data-kg-motion-control-invocation-chip-renderer="shared-markdown-sigil"']) {
    if (!panelSource.includes(marker)) throw new Error(`expected shared FloatingPanel Motion Control layout marker ${marker}`)
  }
  if (!stageSource.includes('mergeXrNativeControllerInputs(keyboard, gamepad, motion)')) {
    throw new Error('expected Motion Control to merge before the single native XR physics step')
  }

  await testCaptureEndedLifecycle()

  const forbiddenOwner = ['andris', 'gauracs'].join('')
  const forbiddenRepository = ['LiteRT.js', 'Mocap'].join('-')
  for (const path of [
    ['src', 'features', 'three', 'motionControlRuntime.ts'],
    ['src', 'features', 'three', 'motionControlPose.ts'],
    ['src', 'features', 'three', 'motionControlConfig.ts'],
    ['src', 'features', 'three', 'MotionControlFloatingPanelView.tsx'],
    ['src', 'features', 'three', 'motionControlMcpRuntime.ts'],
    ['src', 'features', 'agent-ready', 'motionControlAgentReadyContract.mjs'],
    ['src', 'features', 'agent-ready', 'motionControlWebMcpTools.ts'],
    ['scripts', 'prepare-litert-assets.mjs'],
    ['package.json'],
    ['..', 'package-lock.json'],
  ]) {
    const text = source(...path)
    if (text.includes(forbiddenOwner) || text.includes(forbiddenRepository)) {
      throw new Error(`expected clean-room Motion Control source without inspiration-repository dependencies: ${path.join('/')}`)
    }
  }
}
