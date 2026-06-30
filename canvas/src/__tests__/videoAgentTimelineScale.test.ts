import { buildVideoAgentPipeline } from '@/features/video-agent'
import { buildVideoAgentUrlImportMarkdown } from '@/features/markdown-workspace/workspaceImport/videoAgentUrlImport'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  buildMermaidGanttCodeFromNeutralTimelinePayload,
  readYamlFrontmatterMermaidDiagramCodes,
} from '@/lib/mermaid/mermaidDiagramCode'

export function testVideoAgentTimelineKeepsSecondsScaleForBottomPanel() {
  const code = buildMermaidGanttCodeFromNeutralTimelinePayload({
    title: 'Video Sequence Timeline',
    timelineLanes: [
      { id: 'video', label: 'Source video', tracks: ['source_video'] },
      { id: 'fbf', label: 'Frame-by-frame boxes', tracks: ['frame_box_0_fbf', 'frame_box_1_fbf'] },
      { id: 'audio', label: 'Source audio', tracks: ['source_audio'] },
    ],
    timelineTracks: [
      { durationMs: 60000, id: 'source_video', label: 'Source video', source: 'source-video', startMs: 0, timelineLane: 'video' },
      { durationMs: 700, id: 'frame_box_0_fbf', label: 'Frame-by-frame bbox 0.0s tracked subject', source: 'frameBoundingBox', startMs: 0, timelineLane: 'fbf' },
      { durationMs: 700, id: 'frame_box_1_fbf', label: 'Frame-by-frame bbox 0.7s context object', source: 'frameBoundingBox', startMs: 700, timelineLane: 'fbf' },
      { durationMs: 60000, id: 'source_audio', label: 'Source audio waveform', startMs: 0, timelineLane: 'audio' },
    ],
  })
  const model = buildMermaidGanttTimelineModel(code)
  const secondFrame = model.taskSpans.find(span => /frame_box_1_fbf/.test(span.raw))
  const sourceAudio = model.taskSpans.find(span => /source_audio/.test(span.raw))
  if (!code.includes('kgpos_0_011667')) throw new Error(`expected fractional timeline position token, got ${code}`)
  if (!secondFrame || Math.abs(secondFrame.startMinutes - 0.011667) > 0.0001 || secondFrame.durationMinutes >= 0.02) {
    throw new Error(`expected FBF span to stay at 0.7s scale, got ${JSON.stringify(secondFrame)}`)
  }
  if (!sourceAudio || Math.abs(sourceAudio.durationMinutes - 1) > 0.0001 || model.durationMinutes > 1.01) {
    throw new Error(`expected one-minute source audio to keep BottomPanel duration near 1:00, got ${JSON.stringify(model)}`)
  }
}

export function testVideoAgentImportRoutesProcessToFlowchartAndMediaToTimeline() {
  const sourceUrl = 'https://youtu.be/panelRouteVideo01'
  const result = buildVideoAgentPipeline({ durationMs: 60000, sourceUrl })
  if (result.ok === false) throw new Error(result.reason)
  const ganttCode = buildMermaidGanttCodeFromNeutralTimelinePayload(result.pipeline.renderSpec.data)
  for (const token of ['Source video', 'Frame-by-frame boxes', 'Source audio']) {
    if (!ganttCode.includes(token)) throw new Error(`expected media timeline to include ${token}`)
  }
  for (const token of ['Video agent stages', 'Ingest source', 'Parse multimodal context']) {
    if (ganttCode.includes(token)) throw new Error(`expected media timeline to exclude agent workflow token ${token}`)
  }
  const markdown = buildVideoAgentUrlImportMarkdown({ sourceUrl })
  for (const token of ['video_agent_process:', 'type: "mermaid_flowchart"', 'flowchart LR', 'video_media_timeline:', 'type: "mermaid_gantt"']) {
    if (!markdown.includes(token)) throw new Error(`expected imported document to split process flowchart and media timeline: ${token}`)
  }
  const flowchartCodes = readYamlFrontmatterMermaidDiagramCodes(markdown, 'flowchart')
  const ganttCodes = readYamlFrontmatterMermaidDiagramCodes(markdown, 'gantt')
  const processFlowchart = flowchartCodes.find(code => code.includes('flowchart LR') && code.includes('Ingest source'))
  const mediaGantt = ganttCodes.find(code => code.includes('Source video') && code.includes('Frame-by-frame boxes') && code.includes('Source audio'))
  if (!processFlowchart) throw new Error(`expected Flowchart panels to resolve video-agent process from frontmatter: ${flowchartCodes.join('\n')}`)
  if (!mediaGantt) throw new Error(`expected Timeline panels to resolve media lanes from frontmatter: ${ganttCodes.join('\n')}`)
  if (mediaGantt.includes('Video agent stages') || mediaGantt.includes('Parse multimodal context')) {
    throw new Error(`expected media Timeline panels to exclude video-agent workflow stages: ${mediaGantt}`)
  }
}
