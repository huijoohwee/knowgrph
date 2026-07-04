import { resolveVideoSequenceClipEditSplitPointMinutes } from '@/components/timeline/videoSequenceClipEdit'
import { resolveVideoSequenceTimelineLane } from '@/components/timeline/videoSequenceTimeline'
import {
  type MermaidGanttTimelineTaskSpan,
  type MermaidGanttVideoSequenceTimingSyncMode,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import { splitMermaidGanttVideoSequenceClipLeftAtOffset, splitMermaidGanttVideoSequenceClipPairAtOffset, splitMermaidGanttVideoSequenceClipRightAtOffset } from '@/lib/mermaid/mermaidGanttVideoSequenceElementActions'

const SOURCE_BACKED_SPLIT_SYNC_LANES = new Set(['video', 'image', 'scene', 'audio'])

export function resolveGanttTimelineVideoSequenceTimingSyncMode(args: {
  span: MermaidGanttTimelineTaskSpan
  timingSyncMode: MermaidGanttVideoSequenceTimingSyncMode
}): MermaidGanttVideoSequenceTimingSyncMode {
  return SOURCE_BACKED_SPLIT_SYNC_LANES.has(resolveVideoSequenceTimelineLane(args.span))
    ? args.timingSyncMode
    : 'selected'
}

export function resolveGanttTimelineVideoSequenceSplitAction(args: {
  autoSnappingEnabled: boolean
  code: string
  mode: 'left' | 'pair' | 'right'
  positionMinutes: number
  selectedSpan: MermaidGanttTimelineTaskSpan
  spans: readonly MermaidGanttTimelineTaskSpan[]
  timingSyncMode: MermaidGanttVideoSequenceTimingSyncMode
}): string | null {
  const splitPointMinutes = resolveVideoSequenceClipEditSplitPointMinutes({
    autoSnappingEnabled: args.autoSnappingEnabled,
    positionMinutes: args.positionMinutes,
    selectedSpan: args.selectedSpan,
    spans: args.spans,
  })
  if (splitPointMinutes == null) return null
  const splitArgs = {
    code: args.code,
    rowLineIndex: args.selectedSpan.lineIndex,
    splitOffsetMinutes: splitPointMinutes - args.selectedSpan.startMinutes,
    syncMode: resolveGanttTimelineVideoSequenceTimingSyncMode({
      span: args.selectedSpan,
      timingSyncMode: args.timingSyncMode,
    }),
  }
  if (args.mode === 'left') return splitMermaidGanttVideoSequenceClipLeftAtOffset(splitArgs)
  if (args.mode === 'right') return splitMermaidGanttVideoSequenceClipRightAtOffset(splitArgs)
  return splitMermaidGanttVideoSequenceClipPairAtOffset(splitArgs)
}
