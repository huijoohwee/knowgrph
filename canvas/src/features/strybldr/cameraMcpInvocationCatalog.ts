import { findAgenticOsInvocationByToken } from '@/features/agentic-os/agenticOsDocInvocations'
import { CAMERA_INVOCATION_COMMANDS } from './cameraMcpContract.mjs'

export type CanonicalCameraInvocationTokens = Readonly<{
  frame: string
  animate: string
  playback: string
  scrub: string
  cameraShot: string
  cameraMotion: string
  camera: string
  selectedActor: string
}>

export function resolveCanonicalCameraInvocationTokens(): CanonicalCameraInvocationTokens | null {
  const frame = findAgenticOsInvocationByToken(CAMERA_INVOCATION_COMMANDS.frame)
  const animate = findAgenticOsInvocationByToken(CAMERA_INVOCATION_COMMANDS.animate)
  const playback = findAgenticOsInvocationByToken(CAMERA_INVOCATION_COMMANDS.playback)
  const scrub = findAgenticOsInvocationByToken(CAMERA_INVOCATION_COMMANDS.scrub)
  const cameraShot = findAgenticOsInvocationByToken('#camera-shot')
  const cameraMotion = findAgenticOsInvocationByToken('#camera-motion')
  const camera = findAgenticOsInvocationByToken('@camera')
  const selectedActor = findAgenticOsInvocationByToken('@selected-actor')
  if (!frame || frame.kind !== 'command'
    || !animate || animate.kind !== 'command'
    || !playback || playback.kind !== 'command'
    || !scrub || scrub.kind !== 'command'
    || !cameraShot || cameraShot.kind !== 'semantic'
    || !cameraMotion || cameraMotion.kind !== 'semantic'
    || !camera || camera.kind !== 'binding'
    || !selectedActor || selectedActor.kind !== 'binding') return null
  return {
    frame: frame.token,
    animate: animate.token,
    playback: playback.token,
    scrub: scrub.token,
    cameraShot: cameraShot.token,
    cameraMotion: cameraMotion.token,
    camera: camera.token,
    selectedActor: selectedActor.token,
  }
}
