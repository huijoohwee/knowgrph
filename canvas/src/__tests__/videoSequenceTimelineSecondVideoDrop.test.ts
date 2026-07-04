import { buildTimelinePreviewSyncPlan } from '@/components/timeline/timelinePlanSync'
import { readVideoSequenceTimelineModelFromMarkdown } from '@/components/timeline/videoSequenceTimeline'
import { appendMermaidGanttVideoSequenceMediaDrop } from '@/lib/mermaid/mermaidGanttVideoSequenceMediaDrop'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { readYamlFrontmatterMermaidDiagramCodes } from '@/lib/mermaid/mermaidDiagramCode'
import { resolveMermaidGanttCode } from '@/lib/mermaid/mermaidGitGraph'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'

const readVideoSequenceCode = (markdownText: string): string => {
  const meta = parseMarkdownFrontmatter(splitMarkdownLines(markdownText)).meta as { flow_diagrams?: { video_sequence?: { value?: unknown } } }
  return String(meta.flow_diagrams?.video_sequence?.value || '') || resolveMermaidGanttCode(readYamlFrontmatterMermaidDiagramCodes(markdownText, 'gantt'))
}

export function testVideoSequenceTimelineSecondVideoDropKeepsDistinctVisibleSource() {
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "clip_seedance"',
    '    originalName: "Seedance.mp4"',
    '    relativePath: "Seedance.mp4"',
    '    importMode: "url"',
    '    sourceUrl: "/media/seedance.mp4"',
    '    mimeHint: "video/mp4"',
    '    durationSeconds: 52',
    '    frameRate: 24',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Source video',
    '        Seedance.mp4 : clip_seedance, kgsrc_0_0_86, kgpos_0, 0.86m',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(markdownText),
    markdownText,
    media: {
      byteSize: 1102000,
      durationSeconds: 60,
      frameRate: 24,
      kind: 'video',
      label: 'flower.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object:flower',
      url: '/media/flower.mp4',
    },
    startMinutes: 0.44,
  })
  if (!result) throw new Error('expected second video drop to append a source-backed row')
  const nextCode = readVideoSequenceCode(result.markdownText)
  const nextModel = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  const nextPlan = nextModel ? buildTimelinePreviewSyncPlan({ code: nextCode, sources: nextModel.sources }) : null
  const flowerSource = nextModel?.sources.find(source => source.sourceUrl === '/media/flower.mp4')
  const flowerSpan = buildMermaidGanttTimelineModel(nextCode).taskSpans.find(span => span.label === 'flower.mp4')
  const flowerSegment = nextPlan?.segments.find(segment => segment.source.sourceUrl === '/media/flower.mp4')
  const keepsDistinctFlowerSource = !!flowerSource
    && !!flowerSpan
    && !!flowerSegment
    && flowerSource.id !== 'clip_seedance'
    && nextCode.includes(`flower.mp4 : ${flowerSource.id}, kgsrc_0_1, kgpos_0_44, 1m`)
    && !flowerSpan.raw.includes('clip_seedance')
    && Math.abs(flowerSegment.timelineStartMinutes - 0.44) <= 0.0001
    && Math.abs(flowerSegment.timelineEndMinutes - 1.44) <= 0.0001
  if (!keepsDistinctFlowerSource) {
    throw new Error(`expected second video drop to keep a distinct visible source id and segment, got ${JSON.stringify({ code: nextCode, model: nextModel, plan: nextPlan, span: flowerSpan })}`)
  }
}
