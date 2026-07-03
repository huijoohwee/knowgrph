import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { resolveVideoSequenceClipEditSnappedMinutes } from '@/components/timeline/videoSequenceClipEdit'
import {
  deleteMermaidGanttVideoSequenceClip,
  deleteMermaidGanttVideoSequenceClipWithRipple,
  duplicateMermaidGanttVideoSequenceClip,
  extractMermaidGanttVideoSequenceAudioRow,
  insertMermaidGanttVideoSequenceBookmark,
  splitMermaidGanttVideoSequenceClipRightAtOffset,
} from '@/lib/mermaid/mermaidGanttVideoSequenceElementActions'

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

  if (
    !splitRight?.includes('Source video split right : clip_source_split_right, kgsrc_5_12, kgpos_5, 7m') ||
    !audio?.includes('Source video audio : clip_source_audio, kgsrc_0_12, kgpos_0, 12m') ||
    !duplicate?.includes('Source video copy : clip_source_copy, kgsrc_0_12, kgpos_0, 12m') ||
    !bookmark?.code.includes('Source video bookmark : clip_source_bookmark_4, vert, kgsrc_4_4, kgpos_4, 0.001m') ||
    bookmark.lineIndex !== 6 ||
    buildMermaidGanttTimelineModel(duplicate || '').taskSpans.length !== 2 ||
    buildMermaidGanttTimelineModel(deleted || '').taskSpans.length !== 0
  ) {
    throw new Error(`expected source-backed element actions: ${JSON.stringify({ splitRight, audio, duplicate, deleted, bookmark })}`)
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

  if (
    !rippleDeleted?.includes('Scene : clip_scene, kgsrc_4_7, kgpos_1, 3m') ||
    !rippleDeleted.includes('Outro : clip_outro, kgsrc_7_9, kgpos_4, 2m') ||
    snapped !== 3
  ) {
    throw new Error(`expected ripple delete and auto snapping: ${JSON.stringify({ rippleDeleted, snapped })}`)
  }
}
