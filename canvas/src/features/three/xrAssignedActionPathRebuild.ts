import type { XrMotionReferencePlan } from './xrMotionReferenceModel'
import { xrMotionReferenceCastTrackRecord } from './xrMotionReferenceRuntimeRecords'

export function rebuildAssignedXrActionPaths(input: Readonly<{
  durationSeconds: number
  plan: XrMotionReferencePlan
}>): readonly Record<string, unknown>[] {
  const durationRatio = input.plan.durationSeconds > 0
    ? input.durationSeconds / input.plan.durationSeconds
    : 1
  return input.plan.cast.map(track => {
    const record = xrMotionReferenceCastTrackRecord(track)
    if (track.animation?.kind !== 'action-path') return record
    return {
      ...record,
      marks: track.marks.map(mark => ({
        timeSeconds: mark.timeSeconds * durationRatio,
        position: [...mark.position],
        transition: mark.transition,
        gait: mark.gait,
      })),
    }
  })
}
