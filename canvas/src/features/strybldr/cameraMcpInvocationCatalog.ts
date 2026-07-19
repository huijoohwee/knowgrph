import {
  CAMERA_INVOCATION_BINDINGS,
  CAMERA_INVOCATION_COMMANDS,
  CAMERA_INVOCATION_SEMANTICS,
} from './cameraMcpContract.mjs'

export type CanonicalCameraInvocationTokens = Readonly<{
  select: string
  frame: string
  animate: string
  playback: string
  scrub: string
  cameraShot: string
  cameraMotion: string
  cameraSemantic: string
  camera: string
  selectedActor: string
}>

export function resolveCanonicalCameraInvocationTokens(): CanonicalCameraInvocationTokens {
  return {
    select: CAMERA_INVOCATION_COMMANDS.select,
    frame: CAMERA_INVOCATION_COMMANDS.frame,
    animate: CAMERA_INVOCATION_COMMANDS.animate,
    playback: CAMERA_INVOCATION_COMMANDS.playback,
    scrub: CAMERA_INVOCATION_COMMANDS.scrub,
    cameraShot: CAMERA_INVOCATION_SEMANTICS.shot,
    cameraMotion: CAMERA_INVOCATION_SEMANTICS.motion,
    cameraSemantic: CAMERA_INVOCATION_SEMANTICS.camera,
    camera: CAMERA_INVOCATION_BINDINGS.camera,
    selectedActor: CAMERA_INVOCATION_BINDINGS.selectedActor,
  }
}
