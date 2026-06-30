import { buildVideoSequenceClipEditDetailsLabel } from '@/components/timeline/videoSequenceClipEdit'
import { shouldUseTimelineSecondsForVideoSequenceClipEdit } from '@/components/timeline/videoSequenceTimeline'
import { buildMermaidGanttCodeFromNeutralTimelinePayload } from '@/lib/mermaid/mermaidDiagramCode'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'

export function testFrameByFrameClipContextUsesTimelineSeconds() {
  const frameByFrameContextCode = buildMermaidGanttCodeFromNeutralTimelinePayload({
    title: 'Video Sequence',
    timelineLanes: [{ id: 'frame-by-frame-boxes', label: 'Frame-by-frame boxes', tracks: ['frame_box_4_fbf'] }],
    timelineTracks: [{
      durationMs: 700,
      id: 'frame_box_4_fbf',
      label: 'Frame-by-frame bbox 2.8s tracked subject',
      source: 'frameBoundingBox',
      startMs: 2800,
      timelineLane: 'fbf',
    }],
  })
  const frameByFrameSpan = buildMermaidGanttTimelineModel(frameByFrameContextCode).taskSpans[0] || null
  if (
    shouldUseTimelineSecondsForVideoSequenceClipEdit(frameByFrameSpan) ||
    buildVideoSequenceClipEditDetailsLabel({
      maxMinutes: 1,
      mediaDurationSeconds: 60,
      selectedSpan: frameByFrameSpan,
      useTimelineSeconds: shouldUseTimelineSecondsForVideoSequenceClipEdit(frameByFrameSpan),
    }) !== 'Selected clip: Frame-by-frame bbox 2.8s tracked subject. Start 0:03. End 0:04. Duration 0:01.'
  ) {
    throw new Error('expected frame-by-frame clip context to preserve source seconds after transport scaling')
  }
}
