import {
  resolveXrMotionReferenceStage,
  sampleXrMotionReferenceMarks,
  type XrMotionReferencePlan,
} from './xrMotionReferenceModel'
import {
  buildXrAnimationActionPath,
  isXrAnimationPresetId,
  resolveXrAnimationPreset,
  xrAnimationPresetCompatible,
  type XrAnimationAssignment,
  type XrAnimationPathMark,
  type XrAnimationPresetId,
} from './xrAnimationCatalog'
import {
  xrMotionReferenceCastTrackRecord,
  xrMotionReferencePlanRecord,
} from './xrMotionReferenceRuntimeRecords'

export type XrMotionReferenceCastAnimationEdit = Readonly<{
  actionPath: boolean
  value: Record<string, unknown>
}>

export function buildXrMotionReferenceCastAnimationEdit(input: Readonly<{
  actionPathMarks?: readonly XrAnimationPathMark[]
  actorId: string
  plan: XrMotionReferencePlan
  playheadSeconds: number
  presetId: XrAnimationPresetId
}>): XrMotionReferenceCastAnimationEdit | null {
  if (!isXrAnimationPresetId(input.presetId)) return null
  const sourceTrack = input.plan.cast.find(track => track.actorId === input.actorId)
  if (!sourceTrack) return null
  const preset = resolveXrAnimationPreset(input.presetId)
  const subject = input.plan.subjects.find(candidate => candidate.id === input.actorId)
  if (!xrAnimationPresetCompatible({
    preset,
    assetId: subject?.assetId,
    category: subject?.category,
    graphActor: !subject,
  })) return null
  const stage = resolveXrMotionReferenceStage(input.plan.stageId)
  const cast = input.plan.cast.map(track => {
    if (track.actorId !== input.actorId) return xrMotionReferenceCastTrackRecord(track)
    if (preset.kind !== 'action-path') {
      const animation: XrAnimationAssignment = {
        kind: preset.kind,
        presetId: preset.id,
        startTimeSeconds: 0,
        loop: preset.loop,
      }
      return { ...xrMotionReferenceCastTrackRecord(track), animation }
    }
    const animation: XrAnimationAssignment = {
      kind: preset.kind,
      presetId: preset.id,
      startTimeSeconds: 0,
      loop: preset.loop,
    }
    const origin = sampleXrMotionReferenceMarks(track.marks, input.playheadSeconds)
    return {
      ...xrMotionReferenceCastTrackRecord(track),
      animation,
      marks: input.actionPathMarks || buildXrAnimationActionPath({
        presetId: preset.id,
        durationSeconds: input.plan.durationSeconds,
        origin,
        stageSizeMeters: stage.sizeMeters,
      }),
    }
  })
  return Object.freeze({
    actionPath: preset.kind === 'action-path',
    value: { ...xrMotionReferencePlanRecord(input.plan), cast },
  })
}

export function buildXrMotionReferenceCastAnimationClearEdit(input: Readonly<{
  actorId: string
  plan: XrMotionReferencePlan
  playheadSeconds: number
}>): Record<string, unknown> | null {
  if (!input.plan.cast.some(track => track.actorId === input.actorId && track.animation)) return null
  const cast = input.plan.cast.map(track => {
    if (track.actorId !== input.actorId) return xrMotionReferenceCastTrackRecord(track)
    if (track.animation?.kind !== 'action-path') return { ...xrMotionReferenceCastTrackRecord(track), animation: null }
    const position = sampleXrMotionReferenceMarks(track.marks, input.playheadSeconds)
    return {
      ...xrMotionReferenceCastTrackRecord(track),
      animation: null,
      marks: [{ timeSeconds: 0, position: [...position], transition: 'hold', gait: 'hold' }],
    }
  })
  return { ...xrMotionReferencePlanRecord(input.plan), cast }
}
