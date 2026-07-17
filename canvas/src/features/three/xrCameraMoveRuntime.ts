import type { StrybldrCameraSettings } from '@/features/strybldr/strybldrCamera'
import {
  buildXrCameraMoveMarkDrafts,
  type XrCameraMovePresetId,
} from './xrCameraMoveCatalog'
import { XR_MOTION_REFERENCE_MAX_CAMERA_MARKS } from './xrMotionReferenceModel'
import {
  readXrMotionReferenceRuntime,
  setXrMotionReferenceCameraMark,
  setXrMotionReferenceCameraRig,
} from './xrMotionReferenceRuntime'

export type ApplyXrCameraMoveResult = Readonly<{
  applied: boolean
  message: string
  startTimeSeconds?: number
  endTimeSeconds?: number
}>

export function applyXrCameraMove(args: {
  moveId: XrCameraMovePresetId
  anchorId: string
  playheadSeconds: number
  moveDurationSeconds?: number
  settings: StrybldrCameraSettings
}): ApplyXrCameraMoveResult {
  const runtime = readXrMotionReferenceRuntime()
  if (!runtime.plan.cast.some(track => track.actorId === args.anchorId)) {
    return Object.freeze({ applied: false, message: 'Select a cast subject before applying a subject-bound Camera move.' })
  }
  const drafts = buildXrCameraMoveMarkDrafts({
    ...args,
    planDurationSeconds: runtime.plan.durationSeconds,
  })
  const existingTimes = new Set(runtime.plan.camera.map(mark => mark.timeSeconds.toFixed(3)))
  const additions = new Set(drafts.map(mark => mark.timeSeconds.toFixed(3)).filter(time => !existingTimes.has(time))).size
  if (runtime.plan.camera.length + additions > XR_MOTION_REFERENCE_MAX_CAMERA_MARKS) {
    return Object.freeze({ applied: false, message: `Camera choreography needs ${additions} free mark slots for this move.` })
  }
  setXrMotionReferenceCameraRig(drafts[0].rig)
  drafts.forEach(mark => setXrMotionReferenceCameraMark(mark))
  return Object.freeze({
    applied: true,
    message: `Camera move applied from ${drafts[0].timeSeconds.toFixed(2)}s to ${drafts[1].timeSeconds.toFixed(2)}s.`,
    startTimeSeconds: drafts[0].timeSeconds,
    endTimeSeconds: drafts[1].timeSeconds,
  })
}
