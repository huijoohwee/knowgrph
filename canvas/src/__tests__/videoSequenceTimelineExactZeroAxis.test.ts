import { resolveVideoSequenceRulerInsetPixelMetrics } from '@/components/timeline/videoSequenceTimelineRulerGeometry'
import { appendMermaidGanttVideoSequenceMediaDrop } from '@/lib/mermaid/mermaidGanttVideoSequenceMediaDrop'
import { formatPositionToken } from '@/lib/mermaid/mermaidGanttTimelineModel'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { readYamlFrontmatterMermaidDiagramCodes } from '@/lib/mermaid/mermaidDiagramCode'
import { resolveMermaidGanttCode } from '@/lib/mermaid/mermaidGitGraph'

function readVideoSequenceCode(markdownText: string): string {
  const meta = parseMarkdownFrontmatter(splitMarkdownLines(markdownText)).meta as {
    flow_diagrams?: { video_sequence?: { value?: unknown } }
  }
  return String(meta.flow_diagrams?.video_sequence?.value || '') ||
    resolveMermaidGanttCode(readYamlFrontmatterMermaidDiagramCodes(markdownText, 'gantt'))
}

export function testVideoSequenceTimelineExactZeroAxisRegression() {
  const insetMetrics = resolveVideoSequenceRulerInsetPixelMetrics(728)
  if (insetMetrics.insetLeftPx !== 14 || insetMetrics.widthPx !== 700) {
    throw new Error(`expected shared inset pixel metrics to match the visual time-axis, got ${JSON.stringify(insetMetrics)}`)
  }
  if (formatPositionToken(0.01, 'kgpos_0_01') !== 'kgpos_0') {
    throw new Error('expected near-zero source-backed positions to serialize as exact kgpos_0')
  }
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
    '        section Source video',
    '---',
    '',
  ].join('\n')
  const result = appendMermaidGanttVideoSequenceMediaDrop({
    code: '',
    markdownText,
    media: {
      durationSeconds: 52,
      kind: 'video',
      label: 'Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4',
      mimeHint: 'video/mp4',
      sourceKey: 'synced-r2-seedance',
      url: '/media/seedance.mp4',
    },
    startMinutes: 0.01,
  })
  const nextCode = result ? readVideoSequenceCode(result.markdownText) : ''
  if (!result || !nextCode.includes('Seedance_2.0_is_on_Artlist-77FAnT935IE.mp4 : clip_') || !nextCode.includes('kgpos_0') || nextCode.includes('kgpos_0_01')) {
    throw new Error(`expected near-axis source-backed media drops to start at exact 00:00, got ${JSON.stringify({ nextCode })}`)
  }
}
