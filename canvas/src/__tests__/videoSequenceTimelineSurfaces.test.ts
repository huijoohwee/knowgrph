import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildVideoSequenceTimelineScopes,
  formatVideoSequenceTimelineSecondsOffset,
  resolveVideoSequenceTimelineMediaSeconds,
  resolveVideoSequenceTimelinePositionMinutes,
  resolveVideoSequenceTimelineUnitsPerMs,
  type VideoSequenceTimelineSource,
} from '@/components/timeline/videoSequenceTimeline'
import {
  areVideoSequenceExportSourcesEqual,
  buildVideoSequenceExportPlan,
  resolveVideoSequenceExportPositionSourceTime,
  resolveVideoSequenceExportSourceTimePosition,
} from '@/components/timeline/videoSequenceExport'
import {
  buildMermaidGanttTimelineModel,
  insertMermaidGanttVideoSequenceOperationRow,
  resolveMermaidGanttTimelineDragEffectiveDelta,
  resolveMermaidGanttTimelineDragPreviewSpan,
  updateMermaidGanttVideoSequenceClipGroupTiming,
} from '@/lib/mermaid/mermaidGanttBarInteraction'

const root = process.cwd()

function readSource(...parts: string[]): string {
  return readFileSync(resolve(root, 'src', ...parts), 'utf8')
}

export function testVideoSequenceTimelineSurfacesAreRuntimeReady() {
  const controlsText = readSource('components', 'timeline', 'TimelineTransportControls.tsx')
  const controlsCssText = readSource('components', 'timeline', 'TimelineTransportControls.css')
  const clipEditText = readSource('components', 'timeline', 'VideoSequenceClipEditPanel.tsx')
  const clipEditCssText = readSource('components', 'timeline', 'VideoSequenceClipEditPanel.css')
  const monitorText = readSource('components', 'timeline', 'VideoSequenceMonitorPanel.tsx')
  const monitorCssText = readSource('components', 'timeline', 'VideoSequenceMonitorPanel.css')
  const mediaCanvasText = readSource('components', 'MediaCanvas.tsx')
  const rulerText = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.tsx')
  const rulerCssText = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.css')
  const transportPanelText = readSource('features', 'gitgraph', 'GanttTimelineTransportPanel.tsx')
  const sequenceText = readSource('components', 'timeline', 'videoSequenceTimeline.ts')
  if (
    !controlsText.includes('footer?: React.ReactNode') ||
    !controlsText.includes('contextControls?: React.ReactNode') ||
    !controlsText.includes('rulerAside?: React.ReactNode') ||
    !controlsText.includes('timeline-player-context') ||
    !controlsText.includes('timeline-transport-ruler-aside') ||
    !controlsText.includes('{footer}') ||
    !controlsText.includes('onPlaybackPointerDown') ||
    !controlsCssText.includes('.timeline-transport-ruler-layout:has(.timeline-transport-ruler-aside)') ||
    !controlsCssText.includes('minmax(26rem, 1fr) minmax(18rem, 26rem)') ||
    !clipEditText.includes('VideoSequenceClipEditPanel') ||
    !clipEditText.includes("data-kg-video-sequence-clip-edit") ||
    !clipEditText.includes('data-kg-video-sequence-clip-edit-surface="transport"') ||
    !clipEditText.includes("'split-at-playhead'") ||
    !clipEditText.includes("'snap-to-playhead'") ||
    !clipEditCssText.includes('.timeline-video-sequence-clip-edit-actions') ||
    !controlsText.includes('{contextControls}') ||
    !monitorText.includes('VideoSequenceMonitorPanel') ||
    !monitorText.includes('Audio mixing, syncing, scrubbing, and waveform visualization') ||
    !monitorText.includes('data-kg-video-sequence-slot') ||
    !monitorCssText.includes('aspect-ratio: 16 / 9') ||
    !monitorCssText.includes('.timeline-video-sequence-scope-grid') ||
    !monitorCssText.includes('.timeline-video-sequence-slot-grid') ||
    !rulerText.includes('VideoSequenceTimelineRuler') ||
    !rulerText.includes('TimelineVideoSequenceEmptyState') ||
    !rulerText.includes('VIDEO_SEQUENCE_LANE_TOP_OFFSET_PX + laneIndex * VIDEO_SEQUENCE_LANE_HEIGHT_PX') ||
    !rulerCssText.includes('.timeline-transport-shell--video-sequence') ||
    !rulerCssText.includes('.timeline-transport-track-clip--lane-effect') ||
    !sequenceText.includes('Luma waveform') ||
    !sequenceText.includes('Chroma vectorscope') ||
    !sequenceText.includes('Histogram') ||
    !sequenceText.includes('Audio waveform') ||
    !sequenceText.includes('VIDEO_SEQUENCE_TIMELINE_PLAYBACK_REQUEST_EVENT') ||
    !sequenceText.includes("export type VideoSequenceTimelineToolId = 'cut' | 'splice' | 'mask' | 'grade' | 'speed' | 'adjustment' | 'transition' | 'keyframe' | 'filter' | 'effect'") ||
    !sequenceText.includes("export type VideoSequenceTimelineLaneId = 'video' | 'image' | 'scene' | 'mask' | 'grade' | 'effect' | 'adjustment' | 'transition' | 'keyframe' | 'filter' | 'audio'") ||
    !sequenceText.includes('VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS') ||
    !transportPanelText.includes('dispatchVideoSequenceTimelinePlaybackRequest') ||
    !transportPanelText.includes('previousSelectedRowKeyRef') ||
    !transportPanelText.includes('if (previousSelectedRowKey === selectedRowKey) return') ||
    !transportPanelText.includes('handleVideoSequenceClipEdit') ||
    !transportPanelText.includes('contextControls={(') ||
    !transportPanelText.includes('rulerAside={(') ||
    !transportPanelText.includes('VideoSequenceClipEditPanel') ||
    !transportPanelText.includes('VideoSequenceMonitorPanel') ||
    !mediaCanvasText.includes('VIDEO_SEQUENCE_TIMELINE_PLAYBACK_REQUEST_EVENT') ||
    !mediaCanvasText.includes('if (video.paused || video.ended) writeTransportPosition()') ||
    !mediaCanvasText.includes('resolveTargetSeconds') ||
    !mediaCanvasText.includes('data-kg-video-sequence-playback-fallback')
  ) {
    throw new Error('expected video sequence surfaces to expose live preview, scopes, audio waveform/mix, expanded media/effect slots, and direct playback sync through shared owners')
  }
  if (
    formatVideoSequenceTimelineSecondsOffset(15.09) !== '0:15' ||
    resolveVideoSequenceTimelineMediaSeconds({ durationSeconds: 15, maxMinutes: 1, positionMinutes: 0.5 }) !== 7.5 ||
    resolveVideoSequenceTimelinePositionMinutes({ currentTimeSeconds: 7.5, durationSeconds: 15, maxMinutes: 1 }) !== 0.5 ||
    resolveVideoSequenceTimelineUnitsPerMs({ durationSeconds: 15, maxMinutes: 1, fallbackUnitsPerMs: 1 / 1000 }) !== 1 / 15000
  ) {
    throw new Error('expected video sequence timeline units to map Gantt geometry to playable media seconds')
  }
  const scopes = buildVideoSequenceTimelineScopes({ maxMinutes: 6, positionMinutes: 3, sourceCount: 1, spanCount: 8 })
  if (
    scopes.length !== 6 ||
    scopes.some(scope => scope.samples.length !== 12 || scope.value < 0 || scope.value > 100) ||
    !scopes.some(scope => scope.id === 'luma-waveform') ||
    !scopes.some(scope => scope.id === 'chroma-vectorscope') ||
    !scopes.some(scope => scope.id === 'audio-waveform')
  ) {
    throw new Error(`expected bounded luma/chroma/audio scope samples, got ${JSON.stringify(scopes)}`)
  }
  const code = [
    'gantt',
    '  title Sequence',
    '  section Video',
    '  Opening shot : clip_opening, 09:00, 6m',
  ].join('\n')
  const fullWidthSpan = {
    durationMinutes: 15,
    endMinutes: 15,
    label: '港岛仿生局.mp4',
    lineIndex: 5,
    raw: '港岛仿生局.mp4 : clip_hk, 09:00, 15m',
    rowKey: '5:task:港岛仿生局.mp4 : clip_hk, 09:00, 15m',
    startMinutes: 0,
  }
  const clampedMovePreview = resolveMermaidGanttTimelineDragPreviewSpan({
    deltaMinutes: 3,
    maxMinutes: 15,
    mode: 'move',
    span: fullWidthSpan,
  })
  const expandableMovePreview = resolveMermaidGanttTimelineDragPreviewSpan({
    allowTimelineExpansion: true,
    deltaMinutes: 3,
    maxMinutes: 15,
    mode: 'move',
    span: fullWidthSpan,
  })
  const expandableDelta = resolveMermaidGanttTimelineDragEffectiveDelta({
    allowTimelineExpansion: true,
    deltaMinutes: 3,
    maxMinutes: 15,
    mode: 'move',
    span: fullWidthSpan,
  })
  if (
    clampedMovePreview.startMinutes !== 0 ||
    expandableMovePreview.startMinutes !== 3 ||
    expandableDelta !== 3
  ) {
    throw new Error(`expected video sequence move edits to allow full-width clips to create leading gap, got ${JSON.stringify({ clampedMovePreview, expandableMovePreview, expandableDelta })}`)
  }
  const fullWidthSequenceCode = [
    'gantt',
    '  title Video Sequence',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Video',
    '  港岛仿生局.mp4 : clip_hk, 00:00, 15m',
    '  section Mask',
    '  港岛仿生局.mp4 mask : clip_hk_mask, 00:00, 15m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_hk_grade, 00:00, 15m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_hk_audio, 00:00, 15m',
  ].join('\n')
  const movedFullWidthSequenceCode = updateMermaidGanttVideoSequenceClipGroupTiming({
    code: fullWidthSequenceCode,
    rowLineIndex: 5,
    mode: 'move',
    deltaMinutes: 3,
  })
  const movedFullWidthSequenceModel = buildMermaidGanttTimelineModel(movedFullWidthSequenceCode || '')
  const movedFullWidthVideoSpan = movedFullWidthSequenceModel.taskSpans.find(span => span.label === '港岛仿生局.mp4')
  const preciseTrimmedSequenceCode = updateMermaidGanttVideoSequenceClipGroupTiming({
    code: fullWidthSequenceCode,
    rowLineIndex: 5,
    mode: 'resize-start',
    deltaMinutes: 2,
  })
  const preciseExtendedSequenceCode = updateMermaidGanttVideoSequenceClipGroupTiming({
    code: preciseTrimmedSequenceCode || '',
    rowLineIndex: 5,
    mode: 'resize-end',
    deltaMinutes: 1,
  })
  if (
    !movedFullWidthSequenceCode?.includes('港岛仿生局.mp4 : clip_hk, 00:03, 15m') ||
    movedFullWidthSequenceModel.durationMinutes !== 18 ||
    movedFullWidthVideoSpan?.startMinutes !== 3 ||
    movedFullWidthVideoSpan?.endMinutes !== 18
  ) {
    throw new Error(`expected moved full-width video sequence clip to remain visibly editable from zero-origin timeline, got ${JSON.stringify({ movedFullWidthSequenceCode, movedFullWidthSequenceModel, movedFullWidthVideoSpan })}`)
  }
  if (
    !preciseTrimmedSequenceCode?.includes('港岛仿生局.mp4 : clip_hk, 00:02, 13m') ||
    !preciseTrimmedSequenceCode.includes('港岛仿生局.mp4 mask : clip_hk_mask, 00:02, 13m') ||
    !preciseExtendedSequenceCode?.includes('港岛仿生局.mp4 : clip_hk, 00:02, 14m') ||
    !preciseExtendedSequenceCode.includes('港岛仿生局.mp4 audio : clip_hk_audio, 00:02, 14m')
  ) {
    throw new Error(`expected precise BottomPanel clip trim controls to keep grouped lanes aligned, got ${JSON.stringify({ preciseTrimmedSequenceCode, preciseExtendedSequenceCode })}`)
  }
  const transitionCode = insertMermaidGanttVideoSequenceOperationRow({ code, rowLineIndex: 3, operation: 'transition' })
  const filterCode = insertMermaidGanttVideoSequenceOperationRow({ code: transitionCode || code, rowLineIndex: 3, operation: 'filter' })
  if (
    !transitionCode?.includes('Opening shot transition : clip_opening_transition, 09:00, 6m') ||
    !filterCode?.includes('Opening shot filter : clip_opening_filter, 09:00, 6m')
  ) {
    throw new Error(`expected expanded operation rows for transition and filter, got ${JSON.stringify({ transitionCode, filterCode })}`)
  }
  const sequenceSource: VideoSequenceTimelineSource = {
    byteSize: 100,
    id: 'clip_opening',
    importMode: 'url',
    mimeHint: 'video/mp4',
    originalName: 'opening.mp4',
    relativePath: 'opening.mp4',
    sourceUrl: 'https://media.example.test/opening.mp4',
    workspacePath: '',
  }
  const exportPlan = buildVideoSequenceExportPlan({
    code: [
      'gantt',
      '  title Sequence',
      '  section Video',
      '  Opening shot : clip_opening, 09:00, 2m',
      '  Opening shot splice : clip_opening_splice, 09:02, 4m',
    ].join('\n'),
    filenameHint: 'Sequence.md',
    sources: [sequenceSource],
  })
  const sourceTime = resolveVideoSequenceExportPositionSourceTime({
    plan: exportPlan,
    positionMinutes: 3,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const sourcePosition = resolveVideoSequenceExportSourceTimePosition({
    currentTimeSeconds: 7.5,
    plan: exportPlan,
    preferredPositionMinutes: 3,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  if (
    Math.abs((sourceTime?.sourceTimeSeconds || 0) - 7.5) > 0.0001 ||
    Math.abs((sourcePosition || 0) - 3) > 0.0001
  ) {
    throw new Error(`expected edited video sequence preview sync to resolve through source ranges, got ${JSON.stringify({ sourcePosition, sourceTime })}`)
  }
  const sourceMirror: VideoSequenceTimelineSource = {
    ...sequenceSource,
    id: '',
    sourceUrl: '',
    workspacePath: 'workspace/opening.mp4',
  }
  const sourceSibling: VideoSequenceTimelineSource = {
    ...sequenceSource,
    id: 'closing',
    originalName: 'closing.mp4',
    relativePath: 'closing.mp4',
    sourceUrl: 'https://media.example.test/closing.mp4',
    workspacePath: '',
  }
  if (
    !areVideoSequenceExportSourcesEqual(sequenceSource, sourceMirror) ||
    areVideoSequenceExportSourcesEqual(sequenceSource, sourceSibling)
  ) {
    throw new Error('expected video sequence source identity matching to stay source-owned and avoid broad filename fallbacks')
  }
  const multiSourcePlan = buildVideoSequenceExportPlan({
    code: [
      'gantt',
      '  title Sequence',
      '  section Video',
      '  Opening shot : clip_opening, 09:00, 2m',
      '  Insert shot : closing, 09:04, 2m',
      '  Opening shot splice : clip_opening_splice, 09:08, 4m',
      '  Opening shot splice grade : clip_opening_grade_splice, 09:08, 4m',
      '  Opening shot splice transition : clip_opening_transition_splice, 09:08, 4m',
    ].join('\n'),
    filenameHint: 'Sequence.md',
    sources: [sequenceSource, sourceSibling],
  })
  const segments = multiSourcePlan?.segments || []
  const firstOpening = segments.find(segment => segment.label === 'Opening shot')
  const insertShot = segments.find(segment => segment.label === 'Insert shot')
  const openingSplice = segments.find(segment => segment.label === 'Opening shot splice')
  if (
    multiSourcePlan?.durationMinutes !== 12 ||
    segments.length !== 3 ||
    !firstOpening ||
    !insertShot ||
    !openingSplice ||
    firstOpening.sourceStartRatio !== 0 ||
    Math.abs(firstOpening.sourceEndRatio - (2 / 6)) > 0.0001 ||
    insertShot.source !== sourceSibling ||
    insertShot.timelineStartMinutes !== 4 ||
    insertShot.timelineEndMinutes !== 6 ||
    Math.abs(openingSplice.sourceStartRatio - (2 / 6)) > 0.0001 ||
    openingSplice.sourceEndRatio !== 1 ||
    !openingSplice.hasGrade ||
    openingSplice.hasMask ||
    resolveVideoSequenceExportPositionSourceTime({
      plan: multiSourcePlan,
      positionMinutes: 8,
      source: sequenceSource,
      sourceDurationSeconds: 18,
    })?.sourceTimeSeconds !== 6
  ) {
    throw new Error(`expected gaps, multiple sources, splice ranges, and operation lanes to compile into a stable preview plan, got ${JSON.stringify(multiSourcePlan)}`)
  }
}
