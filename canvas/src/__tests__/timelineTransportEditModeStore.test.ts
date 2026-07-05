import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveVideoSequenceClipEditSnappedMinutes } from '@/components/timeline/videoSequenceClipEdit'
import { shouldSyncTimelineSelectionPlayback } from '@/features/gitgraph/useGanttTimelineSelectionSync'

const root = process.cwd()

function readSource(...parts: string[]): string {
  return readFileSync(resolve(root, 'src', ...parts), 'utf8')
}

export function testTimelineTransportEditModeStoreContract() {
  const timelineTransportText = readSource('components', 'timeline', 'timelineTransport.ts')
  const uiSliceText = readSource('hooks', 'store', 'uiSliceInitialState.ts')
  const graphStateText = readSource('hooks', 'store', 'store-types', 'graph-state-chat-import.ts')
  const documentActionsText = readSource('features', 'gitgraph', 'useGanttTimelineDocumentActions.ts')
  const headerToolsText = readSource('features', 'gitgraph', 'GanttTimelineTransportHeaderTools.tsx')
  const interactionsText = readSource('features', 'gitgraph', 'useGanttTimelineInteractions.ts')
  const interactionModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportInteractionModel.ts')
  const selectionSyncText = readSource('features', 'gitgraph', 'useGanttTimelineSelectionSync.ts')
  const mermaidControlsCssText = readSource('components', 'timeline', 'TimelineTransportControlsMermaidGantt.css')
  const surfaceModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportSurfaceModel.ts')
  for (const token of [
    'timelineTransportAutoSnappingEnabled: boolean',
    'timelineTransportRippleEditingEnabled: boolean',
    'setTimelineTransportAutoSnappingEnabled: (enabled: boolean) => void',
    'setTimelineTransportRippleEditingEnabled: (enabled: boolean) => void',
    'timelineTransportAutoSnappingEnabled: true',
    'timelineTransportRippleEditingEnabled: false',
    'autoSnappingEnabled: state.timelineTransportAutoSnappingEnabled !== false',
    'rippleEditingEnabled: state.timelineTransportRippleEditingEnabled === true',
    'setTimelineTransportAutoSnappingEnabled: state.setTimelineTransportAutoSnappingEnabled',
    'setTimelineTransportRippleEditingEnabled: state.setTimelineTransportRippleEditingEnabled',
    'setTimelineTransportAutoSnappingEnabled(!autoSnappingEnabled)',
    'setTimelineTransportRippleEditingEnabled(!rippleEditingEnabled)',
    'autoSnappingEnabled: transportCommandModel.chromeModelCommands.autoSnappingEnabled',
    'spans: args.timelineModel.taskSpans',
    'playheadMinutes: args.positionMinutes',
    'playheadMinutes: state.playheadMinutes',
    'playheadMinutes: input.dragState.playheadMinutes',
    'resolveSnappedDragDeltaMinutes',
    'resolveVideoSequenceClipEditSnappedMinutes({',
    'targetDurationMinutes: state.mode === \'move\' ? state.span.durationMinutes : undefined',
    'timelineGrid: { minutesPerPixel: state.minutesPerPixel }',
    'timelineGrid: { minutesPerPixel: input.dragState.minutesPerPixel }',
    'shouldSyncTimelineSelectionPlayback({',
    'data-kg-video-sequence-tool-active={button.active ? \'1\' : undefined}',
    'button[data-kg-video-sequence-clip-edit-active="1"]::after',
  ]) {
    if (!`${timelineTransportText}\n${uiSliceText}\n${graphStateText}\n${documentActionsText}\n${headerToolsText}\n${interactionsText}\n${interactionModelText}\n${selectionSyncText}\n${mermaidControlsCssText}\n${surfaceModelText}`.includes(token)) {
      throw new Error(`expected shared timeline edit mode store token: ${token}`)
    }
  }
  if (documentActionsText.includes('React.useState(true)') || documentActionsText.includes('React.useState(false)')) {
    throw new Error('expected auto snapping and ripple editing to avoid component-local state')
  }
  if (interactionsText.includes('setTransportPlaybackPosition(nextPreview.startMinutes)')) {
    throw new Error('expected drag preview to keep the playhead marker independent from the dragged bar')
  }
  const sameRowRewriteSync = shouldSyncTimelineSelectionPlayback({
    playing: false,
    previousSelectedRowKey: '14:task:Clip A : clip_a, kgpos_0, 1m',
    selectedRowKey: '14:task:Clip A : clip_a, kgpos_2, 1m',
  })
  const differentRowSelectionSync = shouldSyncTimelineSelectionPlayback({
    playing: false,
    previousSelectedRowKey: '14:task:Clip A : clip_a, kgpos_0, 1m',
    selectedRowKey: '15:task:Clip B : clip_b, kgpos_2, 1m',
  })
  if (sameRowRewriteSync || !differentRowSelectionSync) {
    throw new Error(`expected selection playback sync to ignore drag row rewrites only: ${JSON.stringify({ differentRowSelectionSync, sameRowRewriteSync })}`)
  }
}

export function testVideoSequenceAutoSnappingMoveEdges() {
  const selectedSpan = { durationMinutes: 3, endMinutes: 13, label: 'Selected', startMinutes: 10 }
  const spans = [
    { durationMinutes: 5, endMinutes: 5, label: 'Left', startMinutes: 0 },
    selectedSpan,
    { durationMinutes: 4, endMinutes: 20, label: 'Right', startMinutes: 16 },
  ]
  const playheadSnapped = resolveVideoSequenceClipEditSnappedMinutes({
    enabled: true,
    excludedSnapPositions: [selectedSpan.startMinutes, selectedSpan.endMinutes],
    playheadMinutes: 8,
    positionMinutes: 8.08,
    selectedSpan,
    spans,
    targetDurationMinutes: selectedSpan.durationMinutes,
  })
  const endEdgeSnapped = resolveVideoSequenceClipEditSnappedMinutes({
    enabled: true,
    excludedSnapPositions: [selectedSpan.startMinutes, selectedSpan.endMinutes],
    positionMinutes: 12.92,
    selectedSpan,
    spans,
    targetDurationMinutes: selectedSpan.durationMinutes,
  })
  const disabled = resolveVideoSequenceClipEditSnappedMinutes({
    enabled: false,
    playheadMinutes: 8,
    positionMinutes: 8.08,
    selectedSpan,
    spans,
    targetDurationMinutes: selectedSpan.durationMinutes,
  })
  const gridSnapped = resolveVideoSequenceClipEditSnappedMinutes({
    enabled: true,
    excludedSnapPositions: [selectedSpan.startMinutes, selectedSpan.endMinutes],
    playheadMinutes: 8,
    positionMinutes: 8.13,
    selectedSpan,
    spans,
    targetDurationMinutes: selectedSpan.durationMinutes,
    timelineGrid: { minutesPerPixel: 0.01 },
  })
  if (playheadSnapped !== 8 || endEdgeSnapped !== 13 || disabled !== 8.08 || gridSnapped !== 8.1) {
    throw new Error(`expected auto snapping to use shared grid snapping, playhead, and both move edges: ${JSON.stringify({ disabled, endEdgeSnapped, gridSnapped, playheadSnapped })}`)
  }
}
