import type { KanbanDropPosition } from './kanbanReorder'

export type KanbanBlockedMoveReason =
  | 'start-of-lane'
  | 'end-of-lane'
  | 'start-of-board'
  | 'end-of-board'

export const isKanbanMoveNoOp = (args: {
  groupToRowIds: ReadonlyMap<string, readonly string[]>
  draggedRowId: string
  sourceGroupKey: string
  targetGroupKey: string
  targetRowId: string | null
  position: KanbanDropPosition
}): boolean => {
  if (args.sourceGroupKey !== args.targetGroupKey) return false
  const rowIds = args.groupToRowIds.get(args.sourceGroupKey) || []
  const sourceIndex = rowIds.indexOf(args.draggedRowId)
  if (sourceIndex < 0) return false
  if (!args.targetRowId) {
    return sourceIndex === rowIds.length - 1
  }
  const targetIndex = rowIds.indexOf(args.targetRowId)
  if (targetIndex < 0) return false
  if (args.position === 'before') {
    return targetIndex === sourceIndex + 1
  }
  if (args.position === 'after') {
    return targetIndex === sourceIndex - 1
  }
  return false
}

export const buildKanbanDropOutcomeText = (args: {
  kind: 'blocked' | 'cancelled' | 'no-op' | 'committed'
  sourceLaneLabel?: string | null
  targetLaneLabel?: string | null
  targetCardLabel?: string | null
  blockedReason?: KanbanBlockedMoveReason | null
}): string => {
  const sourceLaneLabel = String(args.sourceLaneLabel || '').trim()
  const targetLaneLabel = String(args.targetLaneLabel || '').trim()
  const targetCardLabel = String(args.targetCardLabel || '').trim()
  const blockedReason = args.blockedReason || null
  if (args.kind === 'blocked') {
    if (blockedReason === 'start-of-lane') {
      return sourceLaneLabel ? `No change: already at start of ${sourceLaneLabel}` : 'No change: already at start'
    }
    if (blockedReason === 'end-of-lane') {
      return sourceLaneLabel ? `No change: already at end of ${sourceLaneLabel}` : 'No change: already at end'
    }
    if (blockedReason === 'start-of-board') {
      return sourceLaneLabel ? `No change: already in first lane ${sourceLaneLabel}` : 'No change: already in first lane'
    }
    if (blockedReason === 'end-of-board') {
      return sourceLaneLabel ? `No change: already in last lane ${sourceLaneLabel}` : 'No change: already in last lane'
    }
    return 'No change'
  }
  if (args.kind === 'cancelled') {
    return sourceLaneLabel ? `Drag cancelled in ${sourceLaneLabel}` : 'Drag cancelled'
  }
  if (args.kind === 'committed') {
    if (targetCardLabel && targetLaneLabel) {
      return `Moved next to ${targetCardLabel} in ${targetLaneLabel}`
    }
    if (targetLaneLabel) {
      return `Moved to end of ${targetLaneLabel}`
    }
    return 'Move completed'
  }
  if (targetCardLabel && targetLaneLabel) {
    return `No change: already aligned with ${targetCardLabel} in ${targetLaneLabel}`
  }
  if (targetLaneLabel) {
    return `No change: already at end of ${targetLaneLabel}`
  }
  return 'No change'
}
