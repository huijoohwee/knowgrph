import { buildTimelinePreviewSyncPlan } from '@/components/timeline/timelinePlanSync'
import { readVideoSequenceTimelineModelFromMarkdown } from '@/components/timeline/videoSequenceTimeline'
import { appendMermaidGanttVideoSequenceMediaDrop } from '@/lib/mermaid/mermaidGanttVideoSequenceMediaDrop'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { readYamlFrontmatterMermaidDiagramCodes } from '@/lib/mermaid/mermaidDiagramCode'
import { resolveMermaidGanttCode } from '@/lib/mermaid/mermaidGitGraph'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'

const readVideoSequenceCode = (markdownText: string): string => {
  const meta = parseMarkdownFrontmatter(splitMarkdownLines(markdownText)).meta as {
    flow_diagrams?: { video_sequence?: { value?: unknown } }
  }
  return String(meta.flow_diagrams?.video_sequence?.value || '') ||
    resolveMermaidGanttCode(readYamlFrontmatterMermaidDiagramCodes(markdownText, 'gantt'))
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
      byteSize: 6632,
      displayHeight: 720,
      displayWidth: 1280,
      durationSeconds: 15,
      frameRate: 24,
      kind: 'video',
      label: '港岛仿生局.mp4',
      mimeHint: 'video/mp4',
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
    !nextModel.sources.some(source => (
      source.sourceUrl === '/media/harbor.mp4' &&
      source.originalName === '港岛仿生局.mp4' &&
      source.durationSeconds === 15 &&
      source.displayWidth === 1280 &&
      source.displayHeight === 720 &&
      source.frameRate === 24
    )) ||
    !nextCode.includes('港岛仿生局.mp4 : clip_') ||
    !nextCode.includes('kgsrc_0_0_25') ||
    !nextCode.includes('kgpos_0_5') ||
    !result.rowKey.includes('港岛仿生局.mp4') ||
    !droppedSegment ||
    droppedSegment.timelineStartMinutes !== 0.5 ||
    droppedSegment.timelineEndMinutes !== 0.75
  ) {
    throw new Error(`expected dropped media to persist as a source-backed timeline clip, got ${JSON.stringify({ code: nextCode, model: nextModel, plan: nextPlan, rowKey: result.rowKey })}`)
  }
}

export function testVideoSequenceTimelineMediaDropBootstrapsEmptyTimeline() {
  const markdownText = [
    '---',
    'kgCanvas2dRenderer: "storyboard"',
    'flow_diagrams:',
    '  key: "flow_diagrams"',
    '  type: "object"',
    '  value:',
    '    starter_flowchart:',
    '      key: "starter_flowchart"',
    '      type: "mermaid_flowchart"',
    '      value: |-',
    '        flowchart LR',
    '          source --> storyboard',
    '---',
    '',
    '# Starter',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: '',
    markdownText,
    media: {
      durationSeconds: 15,
      kind: 'video',
      label: '港岛仿生局.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-object',
      url: '/media/harbor.mp4',
    },
    startMinutes: 0.25,
  })
  if (!result) throw new Error('expected empty timeline media drop to bootstrap a source-backed video sequence')
  const nextModel = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  const nextCode = readVideoSequenceCode(result.markdownText)
  const nextPlan = nextModel ? buildTimelinePreviewSyncPlan({ code: nextCode, sources: nextModel.sources }) : null
  const droppedSegment = nextPlan?.segments.find(segment => segment.source.sourceUrl === '/media/harbor.mp4')
  if (
    !nextModel?.enabled ||
    nextModel.sources.length !== 1 ||
    !result.markdownText.includes('kgVideoSequenceTimeline: true') ||
    !result.markdownText.includes('video_sequence:') ||
    !result.markdownText.includes('type: mermaid_gantt') ||
    !nextCode.includes('gantt') ||
    !nextCode.includes('section Source video') ||
    !nextCode.includes('Source video : clip_') ||
    !nextCode.includes('kgsrc_0_0_25') ||
    !nextCode.includes('kgpos_0') ||
    !droppedSegment ||
    droppedSegment.timelineStartMinutes !== 0 ||
    droppedSegment.timelineEndMinutes !== 0.25
  ) {
    throw new Error(`expected dropped media to initialize a timeline clip, got ${JSON.stringify({ code: nextCode, model: nextModel, plan: nextPlan, markdownText: result.markdownText })}`)
  }
}

export function testVideoSequenceTimelineImageDropUsesOneFrameDuration() {
  const markdownText = [
    '---',
    'kgVideoSequenceTimeline: true',
    'flow_diagrams:',
    '  video_sequence:',
    '    key: video_sequence',
    '    type: mermaid_gantt',
    '    value: |-',
    '      gantt',
    '        title Video Sequence',
    '        dateFormat HH:mm',
    '        axisFormat %H:%M',
    '        section Image',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: readVideoSequenceCode(markdownText),
    markdownText,
    media: {
      displayHeight: 720,
      displayWidth: 1280,
      durationSeconds: 1,
      frameRate: 12,
      kind: 'image',
      label: '空武.jpg',
      mimeHint: 'image/jpeg',
      sourceKey: 'synced-r2-object',
      url: '/media/kongwu.jpg',
    },
    startMinutes: 0.25,
  })
  if (!result) throw new Error('expected image drop to append a source-backed one-frame row')
  const nextCode = readVideoSequenceCode(result.markdownText)
  const nextModel = readVideoSequenceTimelineModelFromMarkdown(result.markdownText)
  const imageSpan = buildMermaidGanttTimelineModel(nextCode).taskSpans.find(span => span.label === '空武.jpg image')
  if (
    !nextModel ||
    !nextModel.sources.some(source => source.sourceUrl === '/media/kongwu.jpg' && source.frameRate === 12) ||
    !nextCode.includes('空武.jpg image : clip_') ||
    !nextCode.includes('kgsrc_0_0_001389') ||
    !nextCode.includes('kgpos_0_25') ||
    !nextCode.includes('0.001389m') ||
    nextCode.includes('0.016667m') ||
    nextCode.includes('1s') ||
    !imageSpan ||
    Math.abs(imageSpan.durationMinutes - (1 / 12 / 60)) > 0.000001
  ) {
    throw new Error(`expected dropped image to persist as one frame, got ${JSON.stringify({ code: nextCode, imageSpan, model: nextModel })}`)
  }
}
