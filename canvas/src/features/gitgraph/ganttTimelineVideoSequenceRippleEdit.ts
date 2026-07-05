import {
  type MermaidGanttBarDragMode,
  type MermaidGanttTimelineTaskSpan,
  type MermaidGanttVideoSequenceTimingSyncMode,
  updateMermaidGanttVideoSequenceClipTiming,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import { rippleMermaidGanttVideoSequenceTimelineFromBoundary } from '@/lib/mermaid/mermaidGanttVideoSequenceElementActions'

function resolveRippleBoundaryDelta(args: {
  deltaMinutes: number
  mode: MermaidGanttBarDragMode
}): number {
  if (args.mode === 'resize-start') return 0
  return args.deltaMinutes
}

export function applyGanttTimelineVideoSequenceRippleEdit(args: {
  code: string | null
  deltaMinutes: number
  enabled: boolean
  mode: MermaidGanttBarDragMode
  selectedSpan: MermaidGanttTimelineTaskSpan
  syncMode: MermaidGanttVideoSequenceTimingSyncMode
}): string | null {
  if (!args.enabled || !args.code) return args.code
  const rippleDeltaMinutes = resolveRippleBoundaryDelta({
    deltaMinutes: args.deltaMinutes,
    mode: args.mode,
  })
  if (!rippleDeltaMinutes) return args.code
  return rippleMermaidGanttVideoSequenceTimelineFromBoundary({
    boundaryMinutes: args.selectedSpan.endMinutes,
    code: args.code,
    deltaMinutes: rippleDeltaMinutes,
    rowLineIndex: args.selectedSpan.lineIndex,
    syncMode: args.syncMode,
  }) || args.code
}

export function updateGanttTimelineVideoSequenceClipTimingWithRipple(args: {
  code: string
  deltaMinutes: number
  enabled: boolean
  mode: MermaidGanttBarDragMode
  rowLineIndex: number
  selectedSpan: MermaidGanttTimelineTaskSpan
  syncMode: MermaidGanttVideoSequenceTimingSyncMode
}): string | null {
  return applyGanttTimelineVideoSequenceRippleEdit({
    code: updateMermaidGanttVideoSequenceClipTiming({
      code: args.code,
      rowLineIndex: args.rowLineIndex,
      mode: args.mode,
      deltaMinutes: args.deltaMinutes,
      syncMode: args.syncMode,
    }),
    deltaMinutes: args.deltaMinutes,
    enabled: args.enabled,
    mode: args.mode,
    selectedSpan: args.selectedSpan,
    syncMode: args.syncMode,
  })
}
