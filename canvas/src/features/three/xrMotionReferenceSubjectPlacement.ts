import type { XrMotionReferenceStagePreset, XrMotionReferenceSubject, XrMotionReferenceVector } from './xrMotionReferenceModel'

export function resolveNextXrSubjectPlacement(
  stage: XrMotionReferenceStagePreset,
  index: number,
): XrMotionReferenceVector {
  const columns = Math.max(2, Math.min(6, Math.floor(stage.sizeMeters[0] / 4)))
  const column = index % columns
  const row = Math.floor(index / columns)
  const xStep = Math.min(3.2, stage.sizeMeters[0] / Math.max(columns + 1, 1))
  const zStep = Math.min(3.2, stage.sizeMeters[1] / 5)
  return [
    Number(((column - (columns - 1) / 2) * xStep).toFixed(3)),
    0,
    Number((Math.min(stage.sizeMeters[1] * 0.32, row * zStep) - stage.sizeMeters[1] * 0.16).toFixed(3)),
  ]
}

export function resolveNextXrSubjectId(
  assetId: string,
  subjects: readonly XrMotionReferenceSubject[],
): string {
  const prefix = `xr-subject:${assetId}:`
  const used = new Set(subjects.map(subject => subject.id))
  let ordinal = 1
  while (used.has(`${prefix}${ordinal}`)) ordinal += 1
  return `${prefix}${ordinal}`
}
