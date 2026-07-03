import type {
  MermaidGanttBarDragMode,
  MermaidGanttBarDragPreview,
  MermaidGanttTimelineDragPreview,
  MermaidGanttTimelineTaskSpan,
} from './mermaidGanttBarInteraction'

export const MERMAID_GANTT_BAR_DRAG_COMMIT_MIN_DELTA_PX = 4
export const MERMAID_GANTT_BAR_DRAG_EDGE_SCROLL_THRESHOLD_PX = 72
export const MERMAID_GANTT_BAR_DRAG_EDGE_SCROLL_STEP_PX = 28
export const MERMAID_GANTT_BAR_MIN_INTERACTION_WIDTH_PX = 24
export const MERMAID_GANTT_BAR_MIN_INTERACTION_HEIGHT_PX = 18

export function isMermaidGanttBarDragMode(value: unknown): value is MermaidGanttBarDragMode {
  return value === 'move' || value === 'resize-start' || value === 'resize-end'
}

export function shouldExposeMermaidGanttBarInteraction(row: { kind?: string | null } | null | undefined): boolean {
  return row?.kind === 'task'
}

export function resolveMermaidGanttBarDragPreview(args: {
  mode: MermaidGanttBarDragMode
  originClientX: number
  clientX: number
}): MermaidGanttBarDragPreview {
  const deltaPx = args.clientX - args.originClientX
  if (args.mode === 'resize-start') {
    return {
      deltaPx,
      offsetPx: deltaPx,
      widthDeltaPx: -deltaPx,
    }
  }
  if (args.mode === 'resize-end') {
    return {
      deltaPx,
      offsetPx: 0,
      widthDeltaPx: deltaPx,
    }
  }
  return {
    deltaPx,
    offsetPx: deltaPx,
    widthDeltaPx: 0,
  }
}

export function resolveMermaidGanttBarDragCommitted(deltaPx: number): boolean {
  return Math.abs(deltaPx) >= MERMAID_GANTT_BAR_DRAG_COMMIT_MIN_DELTA_PX
}

export function resolveMermaidGanttTimelineDragPreviewSpan(args: {
  allowTimelineExpansion?: boolean
  deltaMinutes: number
  maxMinutes: number
  stepMinutes?: number
  mode: MermaidGanttBarDragMode
  span: MermaidGanttTimelineTaskSpan
}): MermaidGanttTimelineDragPreview {
  const minimumDurationMinutes = resolveMermaidGanttTimelineDragStep(args.stepMinutes)
  const durationMinutes = Math.max(minimumDurationMinutes, args.span.durationMinutes)
  const endMinutes = args.span.startMinutes + durationMinutes
  const deltaMinutes = normalizeMermaidGanttTimelineDragDeltaMinutes(args.deltaMinutes, minimumDurationMinutes)
  const maxMinutes = normalizeMermaidGanttTimelineDragDeltaMinutes(args.maxMinutes, minimumDurationMinutes)
  if (args.mode === 'resize-start') {
    const nextStartMinutes = clampGanttTimelineMinutes(args.span.startMinutes + deltaMinutes, 0, Math.max(0, endMinutes - minimumDurationMinutes))
    return {
      durationMinutes: Math.max(minimumDurationMinutes, endMinutes - nextStartMinutes),
      rowKey: args.span.rowKey,
      startMinutes: nextStartMinutes,
    }
  }
  if (args.mode === 'resize-end') {
    if (args.allowTimelineExpansion) {
      return {
        durationMinutes: Math.max(minimumDurationMinutes, durationMinutes + deltaMinutes),
        rowKey: args.span.rowKey,
        startMinutes: args.span.startMinutes,
      }
    }
    return {
      durationMinutes: clampGanttTimelineMinutes(durationMinutes + deltaMinutes, minimumDurationMinutes, Math.max(minimumDurationMinutes, maxMinutes - args.span.startMinutes)),
      rowKey: args.span.rowKey,
      startMinutes: args.span.startMinutes,
    }
  }
  const maxMoveStartMinutes = args.allowTimelineExpansion
    ? Math.max(0, maxMinutes)
    : Math.max(0, maxMinutes - durationMinutes)
  return {
    durationMinutes,
    rowKey: args.span.rowKey,
    startMinutes: clampGanttTimelineMinutes(args.span.startMinutes + deltaMinutes, 0, maxMoveStartMinutes),
  }
}

export function resolveMermaidGanttTimelineDragEffectiveDelta(args: {
  allowTimelineExpansion?: boolean
  deltaMinutes: number
  maxMinutes: number
  stepMinutes?: number
  mode: MermaidGanttBarDragMode
  span: MermaidGanttTimelineTaskSpan
}): number {
  const preview = resolveMermaidGanttTimelineDragPreviewSpan(args)
  if (args.mode === 'resize-end') {
    return preview.durationMinutes - Math.max(resolveMermaidGanttTimelineDragStep(args.stepMinutes), args.span.durationMinutes)
  }
  return preview.startMinutes - args.span.startMinutes
}

function resolveMermaidGanttTimelineDragStep(value: number | null | undefined): number {
  const step = Number(value)
  return Number.isFinite(step) && step > 0 ? step : 1
}

function normalizeMermaidGanttTimelineDragDeltaMinutes(value: number, stepMinutes: number): number {
  const minutes = Number(value)
  const step = resolveMermaidGanttTimelineDragStep(stepMinutes)
  if (!Number.isFinite(minutes)) return 0
  if (step >= 1) return Math.round(minutes)
  return Number((Math.round(minutes / step) * step).toFixed(3))
}

function clampGanttTimelineMinutes(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
