import { buildTimelinePreviewSyncPlan } from '@/components/timeline/timelinePlanSync'
import { readVideoSequenceTimelineModelFromMarkdown } from '@/components/timeline/videoSequenceTimeline'
import { appendMermaidGanttVideoSequenceMediaDrop } from '@/lib/mermaid/mermaidGanttVideoSequenceMediaDrop'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'

const readVideoSequenceCode = (markdownText: string): string => {
  const meta = parseMarkdownFrontmatter(splitMarkdownLines(markdownText)).meta as {
    flow_diagrams?: { video_sequence?: { value?: unknown } }
  }
  return String(meta.flow_diagrams?.video_sequence?.value || '')
}

export function testVideoSequenceTimelineMediaDropAppendsSourceBackedClip() {
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "clip_opening"',
    '    originalName: "opening.mp4"',
    '    relativePath: "opening.mp4"',
    '    importMode: "url"',
    '    sourceUrl: "/media/opening.mp4"',
    '    mimeHint: "video/mp4"',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Video',
    '        Opening : clip_opening, kgsrc_0_1, kgpos_0, 1m',
    '        section Audio',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(markdownText),
    markdownText,
    media: {
      kind: 'video',
      label: '港岛仿生局.mp4',
      sourceKey: 'synced-r2-object',
      url: '/media/harbor.mp4',
    },
    startMinutes: 0.5,
  })
  if (!result) throw new Error('expected video sequence media drop to append a source-backed row')
  const nextModel = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  const nextCode = readVideoSequenceCode(result.markdownText)
  const nextPlan = nextModel ? buildTimelinePreviewSyncPlan({ code: nextCode, sources: nextModel.sources }) : null
  const droppedSegment = nextPlan?.segments.find(segment => segment.source.sourceUrl === '/media/harbor.mp4')
  if (
    !nextModel ||
    nextModel.sources.length !== 2 ||
    !nextModel.sources.some(source => source.sourceUrl === '/media/harbor.mp4' && source.originalName === '港岛仿生局.mp4') ||
    !nextCode.includes('港岛仿生局.mp4 : clip_') ||
    !nextCode.includes('kgpos_0_5') ||
    !result.rowKey.includes('港岛仿生局.mp4') ||
    !droppedSegment ||
    droppedSegment.timelineStartMinutes !== 0.5 ||
    droppedSegment.timelineEndMinutes !== 1.5
  ) {
    throw new Error(`expected dropped media to persist as a source-backed timeline clip, got ${JSON.stringify({ code: nextCode, model: nextModel, plan: nextPlan, rowKey: result.rowKey })}`)
  }
}
