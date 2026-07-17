import type { XrMotionReferencePlan } from './xrMotionReferenceModel'

export type XrMotionReferenceMarkSelection =
  | Readonly<{ kind: 'cast'; actorId: string; markId: string }>
  | Readonly<{ kind: 'camera'; markId: string }>
  | null

export function resolveExistingXrMotionReferenceMarkSelection(
  plan: XrMotionReferencePlan,
  selection: XrMotionReferenceMarkSelection,
): XrMotionReferenceMarkSelection {
  if (!selection) return null
  if (selection.kind === 'cast') {
    return plan.cast.some(track => track.actorId === selection.actorId && track.marks.some(mark => mark.id === selection.markId)) ? selection : null
  }
  return plan.camera.some(mark => mark.id === selection.markId) ? selection : null
}

function nearestMarkByTime<T extends { id: string; timeSeconds: number }>(marks: readonly T[], targetTimeSeconds: number): T | undefined {
  return marks.reduce<T | undefined>((closest, mark) => (
    !closest || Math.abs(mark.timeSeconds - targetTimeSeconds) < Math.abs(closest.timeSeconds - targetTimeSeconds) ? mark : closest
  ), undefined)
}

export function resolveRetimedCastMarkSelection(plan: XrMotionReferencePlan, actorId: string, targetTimeSeconds: number): XrMotionReferenceMarkSelection {
  const mark = nearestMarkByTime(plan.cast.find(track => track.actorId === actorId)?.marks || [], targetTimeSeconds)
  return mark ? { kind: 'cast', actorId, markId: mark.id } : null
}

export function resolveRetimedCameraMarkSelection(plan: XrMotionReferencePlan, targetTimeSeconds: number): XrMotionReferenceMarkSelection {
  const mark = nearestMarkByTime(plan.camera, targetTimeSeconds)
  return mark ? { kind: 'camera', markId: mark.id } : null
}
