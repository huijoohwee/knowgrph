import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildVideoSequenceTimelineCueSamples,
  buildVideoSequenceTimelineFrameSamples,
  buildVideoSequenceTimelineScopes,
  buildVideoSequenceTimelineWaveformSamples,
  formatVideoSequenceTimelineSecondsOffset,
  resolveVideoSequenceTimelineMediaSeconds,
  resolveVideoSequenceTimelinePositionMinutes,
  resolveVideoSequenceTimelineUnitsPerMs,
  resolveVisibleVideoSequenceTimelineLaneCount,
  resolveVisibleVideoSequenceTimelineLanes,
  type VideoSequenceTimelineSource,
} from '@/components/timeline/videoSequenceTimeline'
import {
  areVideoSequenceExportSourcesEqual,
  buildVideoSequenceExportPlan,
  buildVideoSequencePreviewSyncPlan,
  resolveVideoSequenceExportPositionSourceTime,
  resolveVideoSequenceExportSourceTimePosition,
} from '@/components/timeline/videoSequenceExport'
import {
  buildMermaidGanttTimelineModel,
  insertMermaidGanttVideoSequenceOperationRow,
  resolveMermaidGanttTimelineDragEffectiveDelta,
  resolveMermaidGanttTimelineDragPreviewSpan,
  updateMermaidGanttCodeRowTiming,
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
  const mediaCanvasText = readSource('components', 'MediaCanvas.tsx')
  const rulerText = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.tsx')
  const rulerCssText = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.css')
  const transportPanelText = readSource('features', 'gitgraph', 'GanttTimelineTransportPanel.tsx')
  const sequenceText = readSource('components', 'timeline', 'videoSequenceTimeline.ts')
  if (
    controlsText.includes('footer?: React.ReactNode') ||
    controlsText.includes('{footer}') ||
    !controlsText.includes('contextControls?: React.ReactNode') ||
    controlsText.includes('rulerAside?: React.ReactNode') ||
    controlsText.includes('rulerBelow?: React.ReactNode') ||
    controlsText.includes('timeline-transport-ruler-aside') ||
    controlsText.includes('timeline-transport-ruler-below') ||
    !controlsText.includes('timeline-player-context') ||
    !controlsText.includes('showInlineProgress?: boolean') ||
    !controlsText.includes('!showRange && showInlineProgress') ||
    !controlsText.includes('onPlaybackPointerDown') ||
    !controlsCssText.includes('.timeline-player-progress::-webkit-progress-value') ||
    !controlsCssText.includes('.timeline-transport-chrome--mermaid-gantt .timeline-player-progress') ||
    !controlsCssText.includes('min-height: calc(76px + (var(--kg-video-sequence-lane-count, 4) * 36px))') ||
    !controlsCssText.includes('line-height: 36px') ||
    controlsCssText.includes('.timeline-transport-ruler-layout:has(.timeline-transport-ruler-aside)') ||
    controlsCssText.includes('.timeline-transport-ruler-below') ||
    !clipEditText.includes('VideoSequenceClipEditPanel') ||
    !clipEditText.includes("data-kg-video-sequence-clip-edit") ||
    !clipEditText.includes('data-kg-video-sequence-clip-edit-surface="transport"') ||
    !clipEditText.includes("'split-at-playhead'") ||
    !clipEditText.includes("'snap-to-playhead'") ||
    !clipEditCssText.includes('.timeline-video-sequence-clip-edit-actions') ||
    !controlsText.includes('{contextControls}') ||
    !rulerText.includes('VideoSequenceTimelineRuler') ||
    !rulerText.includes('TimelineVideoSequenceEmptyState') ||
    !rulerText.includes('data-kg-video-sequence-clip-cues="1"') ||
    !rulerText.includes('data-kg-video-sequence-clip-frames="1"') ||
    !rulerText.includes('data-kg-video-sequence-audio-waveform="1"') ||
    !rulerText.includes('data-kg-video-sequence-ruler-scopes="1"') ||
    !rulerText.includes('timeline-video-sequence-ruler-scope-strip') ||
    !rulerText.includes('timeline-video-sequence-ruler-scope-bars') ||
    rulerText.includes('timeline-video-sequence-ruler-scope-header') ||
    rulerText.includes('<meter') ||
    !rulerText.includes('VIDEO_SEQUENCE_LANE_HEIGHT_PX = 36') ||
    !rulerText.includes('resolveVisibleVideoSequenceTimelineLanes(taskSpans)') ||
    !rulerText.includes('visibleLanes.map(lane =>') ||
    !rulerText.includes('visibleLaneIndexById.get(lane)') ||
    !rulerText.includes('buildVideoSequenceTimelineCueSamples') ||
    !rulerText.includes('buildVideoSequenceTimelineFrameSamples') ||
    !rulerText.includes('buildVideoSequenceTimelineWaveformSamples') ||
    !rulerText.includes('timeline-video-sequence-clip-timecode') ||
    !rulerText.includes('VIDEO_SEQUENCE_LANE_TOP_OFFSET_PX + laneIndex * VIDEO_SEQUENCE_LANE_HEIGHT_PX') ||
    !rulerCssText.includes('.timeline-transport-shell--video-sequence') ||
    !rulerCssText.includes('.timeline-transport-track-clip--lane-effect') ||
    !rulerCssText.includes('.timeline-video-sequence-ruler-content .timeline-transport-track-clip-move') ||
    !rulerCssText.includes('inset: 0 8px') ||
    !rulerCssText.includes('touch-action: none') ||
    !rulerCssText.includes('.timeline-video-sequence-ruler-content .timeline-transport-track-handle') ||
    !rulerCssText.includes('z-index: 3') ||
    !rulerCssText.includes('.timeline-video-sequence-clip-frame-strip') ||
    !rulerCssText.includes('.timeline-video-sequence-clip-frame') ||
    !rulerCssText.includes('.timeline-video-sequence-clip-cues') ||
    !rulerCssText.includes('.timeline-video-sequence-clip-timecode') ||
    !rulerCssText.includes('.timeline-video-sequence-audio-waveform-bar') ||
    !rulerCssText.includes('.timeline-video-sequence-ruler-scope-strip') ||
    rulerCssText.includes('.timeline-video-sequence-ruler-scope-header') ||
    !rulerCssText.includes('height: 32px') ||
    !rulerCssText.includes('top: calc(24px + (var(--kg-video-sequence-lane-count, 11) * 36px) + 2px)') ||
    !rulerCssText.includes('grid-template-columns: repeat(6, minmax(5.5rem, 1fr))') ||
    !rulerCssText.includes('.timeline-video-sequence-ruler-scope-bar') ||
    rulerCssText.includes('.timeline-video-sequence-slot-grid') ||
    !sequenceText.includes('Luma waveform') ||
    !sequenceText.includes('Chroma vectorscope') ||
    !sequenceText.includes('Histogram') ||
    !sequenceText.includes('Audio waveform') ||
    !sequenceText.includes('buildVideoSequenceTimelineCueSamples') ||
    !sequenceText.includes('buildVideoSequenceTimelineFrameSamples') ||
    !sequenceText.includes('buildVideoSequenceTimelineWaveformSamples') ||
    !sequenceText.includes('VIDEO_SEQUENCE_TIMELINE_PLAYBACK_REQUEST_EVENT') ||
    !sequenceText.includes("export type VideoSequenceTimelineToolId = 'cut' | 'splice' | 'mask' | 'grade' | 'speed' | 'adjustment' | 'transition' | 'keyframe' | 'filter' | 'effect'") ||
    !sequenceText.includes("export type VideoSequenceTimelineLaneId = 'video' | 'image' | 'scene' | 'mask' | 'grade' | 'effect' | 'adjustment' | 'transition' | 'keyframe' | 'filter' | 'audio'") ||
    !sequenceText.includes('VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS') ||
    !transportPanelText.includes('dispatchVideoSequenceTimelinePlaybackRequest') ||
    !transportPanelText.includes('previousSelectedRowKeyRef') ||
    !transportPanelText.includes('if (previousSelectedRowKey === selectedRowKey) return') ||
    !transportPanelText.includes('handleVideoSequenceClipEdit') ||
    !transportPanelText.includes('resolveVisibleVideoSequenceTimelineLaneCount') ||
    !transportPanelText.includes("'--kg-video-sequence-lane-count': visibleLaneCount") ||
    !transportPanelText.includes('showInlineProgress={false}') ||
    !transportPanelText.includes('contextControls={(') ||
    transportPanelText.includes('rulerAside={(') ||
    transportPanelText.includes('rulerBelow={(') ||
    !transportPanelText.includes('VideoSequenceClipEditPanel') ||
    transportPanelText.includes('VideoSequenceMonitorPanel') ||
    !transportPanelText.includes('scopes={monitorScopes}') ||
    !mediaCanvasText.includes('VIDEO_SEQUENCE_TIMELINE_PLAYBACK_REQUEST_EVENT') ||
    !mediaCanvasText.includes('if (video.paused || video.ended) writeTransportPosition()') ||
    !mediaCanvasText.includes('resolveTargetSeconds') ||
    !mediaCanvasText.includes('data-kg-video-sequence-playback-fallback')
  ) {
    throw new Error('expected video sequence surfaces to expose embedded ruler scopes, clip cues, audio waveform/mix, header tools, and direct playback sync through shared owners')
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
  const waveformSamples = buildVideoSequenceTimelineWaveformSamples({ sampleCount: 16, seedText: 'narration 港岛仿生局.mp4 audio' })
  const frameSamples = buildVideoSequenceTimelineFrameSamples({ sampleCount: 10, seedText: '港岛仿生局.mp4 video' })
  const cueSamples = buildVideoSequenceTimelineCueSamples({ sampleCount: 12, seedText: '港岛仿生局.mp4 video' })
  if (
    waveformSamples.length !== 16 ||
    waveformSamples.some(sample => sample < 0 || sample > 100) ||
    waveformSamples.join(',') !== buildVideoSequenceTimelineWaveformSamples({ sampleCount: 16, seedText: 'narration 港岛仿生局.mp4 audio' }).join(',')
  ) {
    throw new Error(`expected deterministic bounded audio waveform samples for timeline ruler, got ${JSON.stringify(waveformSamples)}`)
  }
  if (
    frameSamples.length !== 10 ||
    frameSamples.some(sample => sample < 0 || sample > 100) ||
    frameSamples.join(',') !== buildVideoSequenceTimelineFrameSamples({ sampleCount: 10, seedText: '港岛仿生局.mp4 video' }).join(',')
  ) {
    throw new Error(`expected deterministic bounded media frame samples for timeline ruler, got ${JSON.stringify(frameSamples)}`)
  }
  if (
    cueSamples.length !== 12 ||
    cueSamples.some(sample => sample < 0 || sample > 100) ||
    cueSamples.join(',') !== buildVideoSequenceTimelineCueSamples({ sampleCount: 12, seedText: '港岛仿生局.mp4 video' }).join(',')
  ) {
    throw new Error(`expected deterministic bounded media cue samples for timeline ruler, got ${JSON.stringify(cueSamples)}`)
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
  const movedFullWidthSequenceCode = updateMermaidGanttCodeRowTiming({
    code: fullWidthSequenceCode,
    rowLineIndex: 5,
    mode: 'move',
    deltaMinutes: 3,
  })
  const movedFullWidthSequenceModel = buildMermaidGanttTimelineModel(movedFullWidthSequenceCode || '')
  const movedFullWidthVideoSpan = movedFullWidthSequenceModel.taskSpans.find(span => span.label === '港岛仿生局.mp4')
  const visibleSequenceLanes = resolveVisibleVideoSequenceTimelineLanes(movedFullWidthSequenceModel.taskSpans)
  const preciseTrimmedSequenceCode = updateMermaidGanttCodeRowTiming({
    code: fullWidthSequenceCode,
    rowLineIndex: 5,
    mode: 'resize-start',
    deltaMinutes: 2,
  })
  const preciseExtendedSequenceCode = updateMermaidGanttCodeRowTiming({
    code: preciseTrimmedSequenceCode || '',
    rowLineIndex: 5,
    mode: 'resize-end',
    deltaMinutes: 1,
  })
  if (
    !movedFullWidthSequenceCode?.includes('港岛仿生局.mp4 : clip_hk, kgsrc_0_15, 00:03, 15m') ||
    movedFullWidthSequenceModel.durationMinutes !== 18 ||
    movedFullWidthVideoSpan?.startMinutes !== 3 ||
    movedFullWidthVideoSpan?.endMinutes !== 18 ||
    resolveVisibleVideoSequenceTimelineLaneCount(movedFullWidthSequenceModel.taskSpans) !== 4 ||
    visibleSequenceLanes.map(lane => lane.id).join(',') !== 'video,mask,grade,audio'
  ) {
    throw new Error(`expected moved full-width video sequence clip to remain visibly editable in a compact active-lane stack, got ${JSON.stringify({ movedFullWidthSequenceCode, movedFullWidthSequenceModel, movedFullWidthVideoSpan, visibleSequenceLanes })}`)
  }
  if (
    !preciseTrimmedSequenceCode?.includes('港岛仿生局.mp4 : clip_hk, kgsrc_2_15, 00:02, 13m') ||
    !preciseTrimmedSequenceCode.includes('港岛仿生局.mp4 mask : clip_hk_mask, 00:00, 15m') ||
    !preciseExtendedSequenceCode?.includes('港岛仿生局.mp4 : clip_hk, kgsrc_2_16, 00:02, 14m') ||
    !preciseExtendedSequenceCode.includes('港岛仿生局.mp4 audio : clip_hk_audio, 00:00, 15m')
  ) {
    throw new Error(`expected precise BottomPanel clip trim controls to edit only the selected lane, got ${JSON.stringify({ preciseTrimmedSequenceCode, preciseExtendedSequenceCode })}`)
  }
  const splitSequenceCode = [
    'gantt',
    '  title Video Sequence',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Video',
    '  港岛仿生局.mp4 : clip_hk, 00:00, 1m',
    '  港岛仿生局.mp4 splice : clip_hk_splice, 00:01, 4m',
    '  section Mask',
    '  港岛仿生局.mp4 mask : clip_hk_mask, 00:00, 1m',
    '  港岛仿生局.mp4 mask splice : clip_hk_mask_splice, 00:01, 4m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_hk_grade, 00:00, 1m',
    '  港岛仿生局.mp4 grade splice : clip_hk_grade_splice, 00:01, 4m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_hk_audio, 00:00, 1m',
    '  港岛仿生局.mp4 audio splice : clip_hk_audio_splice, 00:01, 4m',
  ].join('\n')
  const splitSequenceModel = buildMermaidGanttTimelineModel(splitSequenceCode)
  const splitSpliceSpan = splitSequenceModel.taskSpans.find(span => span.label === '港岛仿生局.mp4 splice')
  const movedSplitSequenceCode = splitSpliceSpan
    ? updateMermaidGanttCodeRowTiming({
        code: splitSequenceCode,
        rowLineIndex: splitSpliceSpan.lineIndex,
        mode: 'move',
        deltaMinutes: 1,
      })
    : null
  const trimmedSplitSequenceCode = splitSpliceSpan
    ? updateMermaidGanttCodeRowTiming({
        code: splitSequenceCode,
        rowLineIndex: splitSpliceSpan.lineIndex,
        mode: 'resize-start',
        deltaMinutes: 1,
      })
    : null
  if (
    !splitSpliceSpan ||
    !movedSplitSequenceCode?.includes('港岛仿生局.mp4 splice : clip_hk_splice, kgsrc_1_5, 00:02, 4m') ||
    !movedSplitSequenceCode.includes('港岛仿生局.mp4 audio splice : clip_hk_audio_splice, 00:01, 4m') ||
    !trimmedSplitSequenceCode?.includes('港岛仿生局.mp4 splice : clip_hk_splice, kgsrc_2_5, 00:02, 3m') ||
    !trimmedSplitSequenceCode.includes('港岛仿生局.mp4 mask splice : clip_hk_mask_splice, 00:01, 4m')
  ) {
    throw new Error(`expected split/splice timeline clips to remain draggable and resizable as independently editable bars, got ${JSON.stringify({ movedSplitSequenceCode, splitSpliceSpan, trimmedSplitSequenceCode })}`)
  }
  const transitionCode = insertMermaidGanttVideoSequenceOperationRow({ code, rowLineIndex: 3, operation: 'transition' })
  const filterCode = insertMermaidGanttVideoSequenceOperationRow({ code: transitionCode || code, rowLineIndex: 3, operation: 'filter' })
  if (
    !transitionCode?.includes('Opening shot transition : clip_opening_transition, kgsrc_0_6, 09:00, 6m') ||
    !filterCode?.includes('Opening shot filter : clip_opening_filter, kgsrc_0_6, 09:00, 6m')
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
  const movedSpliceOrderPlan = buildVideoSequenceExportPlan({
    code: [
      'gantt',
      '  title Video Sequence',
      '  section Video',
      '  港岛仿生局.mp4 : clip_opening, 00:03, 1m',
      '  港岛仿生局.mp4 splice : clip_opening_splice, 00:01, 1m',
    ].join('\n'),
    filenameHint: 'Sequence.md',
    sources: [sequenceSource],
  })
  const movedBaseSourceTime = resolveVideoSequenceExportPositionSourceTime({
    plan: movedSpliceOrderPlan,
    positionMinutes: 3.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const movedSpliceSourceTime = resolveVideoSequenceExportPositionSourceTime({
    plan: movedSpliceOrderPlan,
    positionMinutes: 1.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const movedBasePosition = resolveVideoSequenceExportSourceTimePosition({
    currentTimeSeconds: 3.75,
    plan: movedSpliceOrderPlan,
    preferredPositionMinutes: 3.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  if (
    Math.abs((movedBaseSourceTime?.sourceTimeSeconds || 0) - 3.75) > 0.0001 ||
    Math.abs((movedSpliceSourceTime?.sourceTimeSeconds || 0) - 11.25) > 0.0001 ||
    Math.abs((movedBasePosition || 0) - 3.5) > 0.0001
  ) {
    throw new Error(`expected moved split clips to preserve source order instead of visible timeline order, got ${JSON.stringify({ movedBasePosition, movedBaseSourceTime, movedSpliceSourceTime })}`)
  }
  const decoupledAudioPreviewCode = [
    'gantt',
    '  title Video Sequence',
    '  section Video',
    '  港岛仿生局.mp4 : clip_opening, 00:00, 5m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_opening_grade, 00:00, 15m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_opening_audio, 00:04, 1m',
  ].join('\n')
  const decoupledAudioModel = buildMermaidGanttTimelineModel(decoupledAudioPreviewCode)
  const decoupledAudioSpan = decoupledAudioModel.taskSpans.find(span => span.label === '港岛仿生局.mp4 audio')
  const decoupledVideoExportPlan = buildVideoSequenceExportPlan({
    code: decoupledAudioPreviewCode,
    filenameHint: 'Sequence.md',
    sources: [sequenceSource],
  })
  const decoupledAudioPreviewPlan = buildVideoSequencePreviewSyncPlan({
    code: decoupledAudioPreviewCode,
    filenameHint: 'Sequence.md',
    selectedRowKey: decoupledAudioSpan?.rowKey,
    sources: [sequenceSource],
  })
  const decoupledVideoSourceTime = resolveVideoSequenceExportPositionSourceTime({
    plan: decoupledVideoExportPlan,
    positionMinutes: 4.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const decoupledAudioSourceTime = resolveVideoSequenceExportPositionSourceTime({
    plan: decoupledAudioPreviewPlan,
    positionMinutes: 4.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const decoupledAudioPosition = resolveVideoSequenceExportSourceTimePosition({
    currentTimeSeconds: 4.5,
    plan: decoupledAudioPreviewPlan,
    preferredPositionMinutes: 4.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  if (
    !decoupledAudioSpan ||
    Math.abs((decoupledVideoSourceTime?.sourceTimeSeconds || 0) - 13.5) > 0.0001 ||
    Math.abs((decoupledAudioSourceTime?.sourceTimeSeconds || 0) - 4.5) > 0.0001 ||
    Math.abs((decoupledAudioPosition || 0) - 4.5) > 0.0001
  ) {
    throw new Error(`expected Media canvas preview sync to follow the selected decoupled audio strip instead of the video lane, got ${JSON.stringify({ decoupledAudioPosition, decoupledAudioSourceTime, decoupledAudioSpan, decoupledVideoSourceTime })}`)
  }
  const multiLanePreviewCode = [
    'gantt',
    '  title Video Sequence',
    '  section Video',
    '  港岛仿生局.mp4 : clip_opening, 00:03, 1m',
    '  港岛仿生局.mp4 splice : clip_opening_splice, 00:01, 1m',
    '  section Mask',
    '  港岛仿生局.mp4 mask : clip_opening_mask, 00:00, 1m',
    '  港岛仿生局.mp4 mask splice : clip_opening_mask_splice, 00:01, 1m',
    '  港岛仿生局.mp4 mask splice splice : clip_opening_mask_splice_splice, 00:02, 3m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_opening_grade, 00:00, 1m',
    '  港岛仿生局.mp4 grade splice : clip_opening_grade_splice, 00:01, 1m',
    '  港岛仿生局.mp4 grade splice splice : clip_opening_grade_splice_splice, 00:02, 3m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_opening_audio, 00:00, 1m',
    '  港岛仿生局.mp4 audio splice : clip_opening_audio_splice, 00:06, 1m',
    '  港岛仿生局.mp4 audio splice splice : clip_opening_audio_splice_splice, 00:13, 2m',
  ].join('\n')
  const multiLaneModel = buildMermaidGanttTimelineModel(multiLanePreviewCode)
  const selectedMaskSpan = multiLaneModel.taskSpans.find(span => span.label === '港岛仿生局.mp4 mask splice splice')
  const selectedMaskPreviewPlan = buildVideoSequencePreviewSyncPlan({
    code: multiLanePreviewCode,
    filenameHint: 'Sequence.md',
    selectedRowKey: selectedMaskSpan?.rowKey,
    sources: [sequenceSource],
  })
  const selectedMaskSourceTime = resolveVideoSequenceExportPositionSourceTime({
    plan: selectedMaskPreviewPlan,
    positionMinutes: 2.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const selectedMaskPosition = resolveVideoSequenceExportSourceTimePosition({
    currentTimeSeconds: 2.5,
    plan: selectedMaskPreviewPlan,
    preferredPositionMinutes: 2.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  if (
    !selectedMaskSpan ||
    Math.abs((selectedMaskSourceTime?.sourceTimeSeconds || 0) - 2.5) > 0.0001 ||
    Math.abs((selectedMaskPosition || 0) - 2.5) > 0.0001
  ) {
    throw new Error(`expected multi-lane BottomPanel preview sync to use absolute timeline timecodes across mask/grade/audio edits, got ${JSON.stringify({ selectedMaskPosition, selectedMaskSourceTime, selectedMaskSpan })}`)
  }
  const boundedAudioPreviewCode = [
    'gantt',
    '  title Video Sequence',
    '  section Video',
    '  港岛仿生局.mp4 : clip_opening, 00:01, 3m',
    '  section Mask',
    '  港岛仿生局.mp4 mask : clip_opening_mask, 00:03, 1m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_opening_grade, 00:03, 12m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_opening_audio, 00:02, 2m',
  ].join('\n')
  const boundedAudioModel = buildMermaidGanttTimelineModel(boundedAudioPreviewCode)
  const boundedAudioSpan = boundedAudioModel.taskSpans.find(span => span.label === '港岛仿生局.mp4 audio')
  const boundedAudioPreviewPlan = buildVideoSequencePreviewSyncPlan({
    code: boundedAudioPreviewCode,
    filenameHint: 'Sequence.md',
    selectedRowKey: boundedAudioSpan?.rowKey,
    sources: [sequenceSource],
  })
  const boundedAudioSourceTime = resolveVideoSequenceExportPositionSourceTime({
    plan: boundedAudioPreviewPlan,
    positionMinutes: 15,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const boundedAudioPosition = resolveVideoSequenceExportSourceTimePosition({
    currentTimeSeconds: 15,
    plan: boundedAudioPreviewPlan,
    preferredPositionMinutes: 15,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  if (
    !boundedAudioSpan ||
    Math.abs((boundedAudioSourceTime?.sourceTimeSeconds || 0) - 4) > 0.0001 ||
    Math.abs((boundedAudioPosition || 0) - 4) > 0.0001
  ) {
    throw new Error(`expected out-of-strip audio sync to clamp to the selected strip boundary instead of falling back to full media time, got ${JSON.stringify({ boundedAudioPosition, boundedAudioSourceTime, boundedAudioSpan })}`)
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
