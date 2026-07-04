import {
  buildMermaidGanttTimelineModel,
  splitMermaidGanttVideoSequenceClipAtOffset,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  resolveVideoSequenceClipEditSnappedMinutes,
  resolveVideoSequenceClipEditSplitPointMinutes,
} from '@/components/timeline/videoSequenceClipEdit'
import {
  deleteMermaidGanttVideoSequenceClip,
  deleteMermaidGanttVideoSequenceClipWithRipple,
  duplicateMermaidGanttVideoSequenceClip,
  extractMermaidGanttVideoSequenceAudioRow,
  insertMermaidGanttVideoSequenceBookmark,
  splitMermaidGanttVideoSequenceClipLeftAtOffset,
  splitMermaidGanttVideoSequenceClipPairAtOffset,
  splitMermaidGanttVideoSequenceClipRightAtOffset,
} from '@/lib/mermaid/mermaidGanttVideoSequenceElementActions'
import { resolveGanttTimelineVideoSequenceSplitAction } from '@/features/gitgraph/ganttTimelineVideoSequenceSplitAction'

export function testVideoSequenceElementActionsStaySourceBacked() {
  const code = [
    'gantt',
    '  title Video Sequence Timeline',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Source video',
    '  Source video : clip_source, kgsrc_0_12, kgpos_0, 12m',
  ].join('\n')

  const splitRight = splitMermaidGanttVideoSequenceClipRightAtOffset({
    code,
    rowLineIndex: 5,
    splitOffsetMinutes: 5,
    syncMode: 'selected',
  })
  const splitLeft = splitMermaidGanttVideoSequenceClipLeftAtOffset({
    code,
    rowLineIndex: 5,
    splitOffsetMinutes: 5,
    syncMode: 'selected',
  })
  const splitPair = splitMermaidGanttVideoSequenceClipPairAtOffset({
    code,
    rowLineIndex: 5,
    splitOffsetMinutes: 5,
    syncMode: 'selected',
  })
  const audio = extractMermaidGanttVideoSequenceAudioRow({
    code,
    rowLineIndex: 5,
  })
  const duplicate = duplicateMermaidGanttVideoSequenceClip({
    code,
    rowLineIndex: 5,
    syncMode: 'selected',
  })
  const deleted = deleteMermaidGanttVideoSequenceClip({
    code,
    rowLineIndex: 5,
    syncMode: 'selected',
  })
  const bookmark = insertMermaidGanttVideoSequenceBookmark({
    code,
    positionMinutes: 4,
    rowLineIndex: 5,
  })
  const fractionalCode = [
    'gantt',
    '  title Video Sequence Timeline',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Source video',
    '  Source video : clip_source, kgsrc_0_0_252, kgpos_0, 0.252m',
  ].join('\n')
  const fractionalSplit = splitMermaidGanttVideoSequenceClipAtOffset({
    code: fractionalCode,
    rowLineIndex: 5,
    splitOffsetMinutes: 0.1,
    syncMode: 'selected',
  })

  if (
    !splitRight?.includes('Source video split right : clip_source_split_right, kgsrc_5_12, kgpos_5, 7m') ||
    !splitLeft?.includes('Source video split left : clip_source_split_left, kgsrc_0_5, kgpos_0, 5m') ||
    buildMermaidGanttTimelineModel(splitLeft || '').taskSpans.length !== 1 ||
    !splitPair?.includes('Source video split left : clip_source_split_left, kgsrc_0_5, kgpos_0, 5m') ||
    !splitPair.includes('Source video split right : clip_source_split_right, kgsrc_5_12, kgpos_5, 7m') ||
    !fractionalSplit?.includes('Source video : clip_source, kgsrc_0_0_1, kgpos_0, 0.1m') ||
    !fractionalSplit.includes('Source video splice : clip_source_splice, kgsrc_0_1_0_252, kgpos_0_1, 0.152m') ||
    !audio?.includes('Source video audio : clip_source_audio, kgsrc_0_12, kgpos_0, 12m') ||
    !duplicate?.includes('Source video copy : clip_source_copy, kgsrc_0_12, kgpos_0, 12m') ||
    !bookmark?.code.includes('Source video bookmark : clip_source_bookmark_4, vert, kgsrc_4_4, kgpos_4, 0.001m') ||
    bookmark.lineIndex !== 6 ||
    buildMermaidGanttTimelineModel(duplicate || '').taskSpans.length !== 2 ||
    buildMermaidGanttTimelineModel(deleted || '').taskSpans.length !== 0
  ) {
    throw new Error(`expected source-backed element actions: ${JSON.stringify({ splitLeft, splitPair, splitRight, fractionalSplit, audio, duplicate, deleted, bookmark })}`)
  }

  const rippleCode = [
    'gantt',
    '  title Video Sequence Timeline',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Source video',
    '  Intro : clip_intro, kgsrc_0_4, kgpos_0, 4m',
    '  Scene : clip_scene, kgsrc_4_7, kgpos_5, 3m',
    '  Outro : clip_outro, kgsrc_7_9, kgpos_8, 2m',
  ].join('\n')
  const rippleDeleted = deleteMermaidGanttVideoSequenceClipWithRipple({
    code: rippleCode,
    rowLineIndex: 5,
    syncMode: 'selected',
  })
  const rippleModel = buildMermaidGanttTimelineModel(rippleDeleted || '')
  const snapped = resolveVideoSequenceClipEditSnappedMinutes({
    enabled: true,
    positionMinutes: 2.98,
    selectedSpan: rippleModel.taskSpans[0],
    spans: rippleModel.taskSpans,
  })
  const dragSnapped = resolveVideoSequenceClipEditSnappedMinutes({
    enabled: true,
    excludedSnapPositions: [rippleModel.taskSpans[0]?.startMinutes || 0, rippleModel.taskSpans[0]?.endMinutes || 0],
    positionMinutes: 2.98,
    selectedSpan: rippleModel.taskSpans[0],
    spans: rippleModel.taskSpans,
  })
  const splitPoint = resolveVideoSequenceClipEditSplitPointMinutes({
    autoSnappingEnabled: true,
    positionMinutes: 2.98,
    selectedSpan: rippleModel.taskSpans[0],
    spans: rippleModel.taskSpans,
  })

  if (
    !rippleDeleted?.includes('Scene : clip_scene, kgsrc_4_7, kgpos_1, 3m') ||
    !rippleDeleted.includes('Outro : clip_outro, kgsrc_7_9, kgpos_4, 2m') ||
    snapped !== 3 ||
    dragSnapped !== 2.98 ||
    splitPoint !== 2.98
  ) {
    throw new Error(`expected ripple delete and drag-aware auto snapping: ${JSON.stringify({ dragSnapped, rippleDeleted, snapped, splitPoint })}`)
  }
}

export function testVideoSequenceToolbarSplitKeepsLeftAndRightSourceSegments() {
  const code = [
    'gantt',
    '  title Video Sequence Timeline',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Source video',
    '  Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 : clip_seedance, kgsrc_0_52, kgpos_0_36, 0.87m',
  ].join('\n')
  const model = buildMermaidGanttTimelineModel(code)
  const selectedSpan = model.taskSpans[0]
  const next = selectedSpan ? resolveGanttTimelineVideoSequenceSplitAction({
    autoSnappingEnabled: false,
    code,
    mode: 'pair',
    positionMinutes: selectedSpan.startMinutes + 0.15,
    selectedSpan,
    spans: model.taskSpans,
    timingSyncMode: 'selected',
  }) : null
  const nextModel = buildMermaidGanttTimelineModel(next || '')
  if (
    !next ||
    nextModel.taskSpans.length !== 2 ||
    !next.includes('Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 split left : clip_seedance_split_left') ||
    !next.includes('Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 split right : clip_seedance_split_right') ||
    !next.includes('kgsrc_0_8_966') ||
    !next.includes('kgsrc_8_966_52') ||
    !next.includes('kgpos_0_36') ||
    !next.includes('kgpos_0_15') ||
    next.includes(' splice :') ||
    next.includes('clip_seedance_splice')
  ) {
    throw new Error(`expected toolbar split to keep left and right source segments, got ${JSON.stringify({ next, spans: nextModel.taskSpans })}`)
  }
}
