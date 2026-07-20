import {
  isXrAnimationPresetId,
  resolveXrAnimationPreset,
  xrAnimationPresetCompatible,
  type XrAnimationTrackKind,
} from './xrAnimationCatalog'
import {
  readXrMotionReferenceRuntime,
  setXrMotionReferenceCastAnimation,
} from './xrMotionReferenceRuntime'
import {
  applyXrConstrainedCastActionPath,
  clearXrConstrainedCastAnimation,
} from './xrConstrainedCastMarkRuntime'

export type XrAnimationAssignmentUpdate = Readonly<{
  operation: 'apply' | 'clear'
  presetId: string
  targetId: string
  trackKind?: XrAnimationTrackKind
}>

export type XrAnimationAssignmentUpdateResult = Readonly<{
  ok: boolean
  message: string
  positionMarksChanged: boolean
}>

export function updateXrAnimationAssignment(
  update: XrAnimationAssignmentUpdate,
): XrAnimationAssignmentUpdateResult {
  const runtime = readXrMotionReferenceRuntime()
  const track = runtime.plan.cast.find(candidate => candidate.actorId === update.targetId)
  if (!track) return { ok: false, message: 'Select a cast actor before applying or clearing animation.', positionMarksChanged: false }
  if (update.operation === 'clear') {
    if (update.trackKind && track.animation && track.animation.kind !== update.trackKind) {
      return { ok: false, message: `${track.label} has ${track.animation.kind}, not ${update.trackKind}.`, positionMarksChanged: false }
    }
    const cleared = clearXrConstrainedCastAnimation(update.targetId)
    if (!cleared.applied) {
      return {
        ok: false,
        message: cleared.reason === 'physics-owned'
          ? 'Stop XR physics before clearing this object\'s authored action path.'
          : 'The selected cast animation could not be cleared.',
        positionMarksChanged: false,
      }
    }
    return { ok: true, message: `Animation cleared from ${track.label}.`, positionMarksChanged: track.animation?.kind === 'action-path' }
  }
  if (!isXrAnimationPresetId(update.presetId)) {
    return { ok: false, message: `Unknown animation preset: ${update.presetId || '(empty)'}.`, positionMarksChanged: false }
  }
  const preset = resolveXrAnimationPreset(update.presetId)
  if (update.trackKind && update.trackKind !== preset.kind) {
    return { ok: false, message: `${preset.id} is a ${preset.kind} preset, not ${update.trackKind}.`, positionMarksChanged: false }
  }
  const subject = runtime.plan.subjects.find(candidate => candidate.id === update.targetId)
  if (!xrAnimationPresetCompatible({
    preset,
    assetId: subject?.assetId,
    category: subject?.category,
    graphActor: !subject,
  })) return { ok: false, message: `${preset.label} is not compatible with ${subject?.label || track.label}.`, positionMarksChanged: false }
  if (preset.kind === 'action-path') {
    const appliedPath = applyXrConstrainedCastActionPath(update.targetId, preset.id)
    if (!appliedPath.applied) {
      return {
        ok: false,
        message: appliedPath.reason === 'physics-owned'
          ? 'Stop XR physics before applying this object\'s authored action path.'
          : 'The action path could not be placed safely in the authored XR scene.',
        positionMarksChanged: false,
      }
    }
  } else {
    setXrMotionReferenceCastAnimation(update.targetId, preset.id)
  }
  return { ok: true, message: `${preset.label} applied to ${track.label}.`, positionMarksChanged: preset.kind === 'action-path' }
}
