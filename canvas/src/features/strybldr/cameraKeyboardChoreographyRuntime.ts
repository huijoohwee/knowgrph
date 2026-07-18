import { useGraphStore } from '@/hooks/useGraphStore'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  serializeXrMotionReferencePlan,
} from '@/features/three/xrMotionReferenceModel'
import {
  markXrMotionReferenceSaved,
  readXrMotionReferenceRuntime,
  restoreXrMotionReferenceRuntimeSnapshot,
  setXrMotionReferenceCameraMarkChoreography,
  setXrMotionReferencePlayhead,
} from '@/features/three/xrMotionReferenceRuntime'
import {
  resolveThreeCameraKeyboardFraming,
  type ThreeKeyboardMovementKey,
} from '@/features/three/threeKeyboardChoreography'
import {
  publishCameraFramingRuntime,
  readCameraFramingRuntime,
} from './cameraFramingRuntime'

export type CameraKeyboardChoreographyResult = Readonly<{
  ok: boolean
  message: string
  timeSeconds?: number
}>

function persistCameraChoreography(): boolean {
  const state = useGraphStore.getState()
  const serialized = serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan)
  state.updateGraphMetadata({ [XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]: serialized })
  if (useGraphStore.getState().graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY] !== serialized) return false
  markXrMotionReferenceSaved(serialized)
  return true
}

export function applyCameraKeyboardChoreography(input: Readonly<{
  action: 'animate' | 'frame'
  amount: number
  anchorId: string
  keys: readonly ThreeKeyboardMovementKey[]
  markId: string
  requireAnchorMatch: boolean
}>): CameraKeyboardChoreographyResult {
  if (input.action === 'frame') {
    const current = readCameraFramingRuntime()
    const settings = resolveThreeCameraKeyboardFraming({ amount: input.amount, keys: input.keys, settings: current.settings })
    if (!settings) return Object.freeze({ ok: false, message: 'Use a directional WASD or arrow-key chord for Camera framing.' })
    const framing = publishCameraFramingRuntime({ anchorId: input.anchorId, settings, source: 'panel' })
    return Object.freeze({ ok: true, message: `Camera framing moved around ${framing.anchorId}.` })
  }

  const previous = readXrMotionReferenceRuntime()
  const selectedMarkId = previous.selectedMark?.kind === 'camera' ? previous.selectedMark.markId : ''
  const markId = input.markId || selectedMarkId
  const mark = previous.plan.camera.find(candidate => candidate.id === markId)
  if (!mark || (input.requireAnchorMatch && mark.anchorId !== input.anchorId)) {
    return Object.freeze({ ok: false, message: 'Select a matching Camera choreography mark before keyboard movement.' })
  }
  const settings = resolveThreeCameraKeyboardFraming({ amount: input.amount, keys: input.keys, settings: mark.settings })
  if (!settings) return Object.freeze({ ok: false, message: 'Use a directional WASD or arrow-key chord for Camera choreography.' })
  setXrMotionReferenceCameraMarkChoreography({ markId: mark.id, settings })
  if (!persistCameraChoreography()) {
    restoreXrMotionReferenceRuntimeSnapshot(previous)
    return Object.freeze({ ok: false, message: 'Camera keyboard choreography could not be written to graph metadata.' })
  }
  publishCameraFramingRuntime({ anchorId: mark.anchorId, settings, source: 'panel' })
  setXrMotionReferencePlayhead(mark.timeSeconds)
  return Object.freeze({
    ok: true,
    message: `Camera choreography mark moved with ${input.keys.join('+')} by ${input.amount.toFixed(3)} orbit units.`,
    timeSeconds: mark.timeSeconds,
  })
}
