import { buildVideoAgentPipeline } from '@/features/video-agent'
import { buildVideoAgentUrlImportMarkdown } from '@/features/markdown-workspace/workspaceImport/videoAgentUrlImport'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  buildMermaidGanttCodeFromNeutralTimelinePayload,
  readYamlFrontmatterMermaidDiagramCodes,
} from '@/lib/mermaid/mermaidDiagramCode'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (...parts: string[]): string => readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')

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
  for (const token of [
    'video_agent_process:',
    'type: "mermaid_flowchart"',
    'floatingPanelView: "flowchart"',
    'bottomPanelTab: "flowchart"',
    'flowchart LR',
    'video_media_timeline:',
    'type: "mermaid_gantt"',
    'floatingPanelView: "timeline"',
    'bottomPanelTab: "timeline"',
  ]) {
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
  const mediaTimelineModel = buildMermaidGanttTimelineModel(mediaGantt)
  if (
    mediaTimelineModel.taskSpans.length !== 3
    || !mediaTimelineModel.taskSpans.some(span => /video_agent_source_video/.test(span.raw))
    || !mediaTimelineModel.taskSpans.some(span => /video_agent_frame_by_frame_boxes/.test(span.raw))
    || !mediaTimelineModel.taskSpans.some(span => /video_agent_source_audio/.test(span.raw))
    || mediaTimelineModel.taskSpans.some(span => /frame_box_\d+_fbf/.test(span.raw))
    || mediaGantt.includes('kgthumb_')
  ) {
    throw new Error(`expected imported media Timeline to keep compact VIDEO/FBF/AUDIO tracks without per-frame overlap rows: ${mediaGantt}`)
  }
}

export function testVideoAgentStructuredDiagramFloatingPanelOpenEventRoutesMediaAndProcessPanels() {
  const utilsText = readSource('features/canvas/utils.ts')
  const launcherText = readSource('features/toolbar/ToolbarMenuLauncher.tsx')
  const presetText = readSource('features', 'parsers', 'canvasFrontmatterPreset.ts')
  const uiSliceText = readSource('hooks', 'store', 'uiSliceInitialState.ts')
  const timelineBottomText = readSource('features', 'gitgraph', 'TimelineBottomPanelView.tsx')
  const timelineFloatingText = readSource('features', 'gitgraph', 'TimelineFloatingPanelView.tsx')
  for (const tab of ['flowchart', 'gantt', 'timeline']) {
    if (!utilsText.includes(`| '${tab}'`)) throw new Error(`expected floating-panel open event type to include ${tab}`)
    if (!launcherText.includes(`tab === '${tab}'`) || !launcherText.includes(`? '${tab}'`)) {
      throw new Error(`expected ToolbarMenuLauncher to route floating-panel tab ${tab}`)
    }
    if (!uiSliceText.includes(`|| view === '${tab}'`)) {
      throw new Error(`expected floating-panel store setter to accept ${tab} without remapping to propsPanel`)
    }
  }
  for (const token of [
    'shouldRetainVideoSequenceFloatingPanelView',
    "new Set(['timeline', 'flowchart', 'gantt', 'flowEditor'])",
    '!shouldRetainVideoSequenceFloatingPanelView(current.floatingPanelView)',
    'videoSequenceModel?.enabled',
    '(videoSequenceModel?.enabled || !timelineCode) && ganttCode',
    '<GanttTimelineTransportPanel code={ganttCode} compact={false} />',
    '<TimelineVideoSequenceEmptyState compact={false} />',
  ]) {
    if (!`${presetText}\n${timelineFloatingText}`.includes(token)) throw new Error(`expected video-agent floating panel routing to preserve explicit ${token}`)
  }
  for (const staleToken of ['TimelineTransportControls', 'data-kg-gantt-timeline-transport']) {
    if (timelineFloatingText.includes(staleToken)) throw new Error(`expected video-agent FloatingPanel Timeline to avoid BottomPanel transport owner token: ${staleToken}`)
  }
  for (const token of [
    'readVideoSequenceTimelineModelFromMarkdown',
    'const videoSequenceModel = React.useMemo',
    '(videoSequenceModel?.enabled || !timelineCode) && ganttCode',
    '<GanttTimelineTransportPanel code={ganttCode} compact={compact} />',
  ]) {
    if (!timelineBottomText.includes(token)) throw new Error(`expected video-agent BottomPanel Timeline to keep transport owner token: ${token}`)
  }
}

export function testVideoAgentTimelineDenseFbfClipsDoNotForceOverlap() {
  const rulerText = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.tsx')
  const surfaceModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportSurfaceModel.ts')
  const sequenceTimelineText = readSource('components', 'timeline', 'videoSequenceTimeline.ts')
  const cssText = [
    readSource('components', 'timeline', 'VideoSequenceTimelineRuler.css'),
    readSource('components', 'timeline', 'VideoSequenceTimelineDenseFbf.css'),
  ].join('\n')
  const compactMediaText = readSource('components', 'timeline', 'VideoSequenceCompactMediaLane.tsx')
  if (!rulerText.includes('VIDEO_SEQUENCE_DENSE_FBF_MAX_DURATION_MINUTES') || !rulerText.includes("lane === 'fbf' && !compactVideoAgentFbf && !verticalMarker")) {
    throw new Error('expected BottomPanel Timeline to mark temporally dense FBF clips')
  }
  for (const token of [
    'data-kg-video-sequence-dense-fbf={denseFbfClip ?',
    'data-kg-video-agent-compact-fbf={compactVideoAgentFbf ?',
    'data-kg-video-agent-compact-media={compactVideoAgentMedia ?',
    'VIDEO_AGENT_COMPACT_BOTTOM_PANEL_DISABLED_LANE_IDS',
    "VIDEO_AGENT_COMPACT_BOTTOM_PANEL_DISABLED_LANE_IDS: readonly VideoSequenceTimelineLaneId[] = ['video', 'audio']",
    'const rulerDisabledLaneIds = React.useMemo',
    'compactVideoAgentTimeline',
    'resolveVisibleVideoSequenceTimelineLaneCount(transportSession.timelineModel.taskSpans, { disabledLaneIds: rulerDisabledLaneIds })',
    'const compactVideoAgentTimeline = React.useMemo',
    'timelineModel.taskSpans.every(span => isVideoAgentCompactMediaSpan(span, resolveVideoSequenceTimelineLane(span)))',
    'scopes: compactVideoAgentTimeline ? [] : transportSession.monitorScopes',
    "const showMediaCues = showsMediaContent && lane !== 'audio' && !compactVideoAgentMedia",
    'const showCompactVideoAgentFbfThumbnails = compactVideoAgentFbf && !nativeFrameSamples.length',
    'const thumbnailSamples = compactVideoAgentMedia && !showCompactVideoAgentFbfThumbnails ? []',
    "&& !verticalMarker && !compactVideoAgentMedia",
    "lane === 'fbf' && !compactVideoAgentFbf && !verticalMarker",
    'compactVideoAgentMedia ? 0 : (index % 2) * 2',
    '[data-kg-video-agent-compact-fbf="1"]',
    '.timeline-transport-track-clip[data-kg-video-agent-compact-media="1"]:not(.timeline-transport-track-clip--milestone):not([data-kg-video-sequence-dense-fbf="1"]):not([data-kg-video-agent-compact-fbf="1"])',
    '.timeline-transport-track-clip[data-kg-video-agent-compact-fbf="1"]',
    '.timeline-transport-track-clip[data-kg-video-agent-compact-media="1"]::before',
    '[data-kg-video-agent-compact-media="1"] .timeline-transport-track-clip-move',
    '[data-kg-video-agent-compact-media="1"] .timeline-video-sequence-clip-timecode',
    '!verticalMarker && !compactVideoAgentMedia',
    '[data-kg-video-agent-compact-media="1"] .timeline-video-sequence-audio-waveform',
    'timeline-video-sequence-compact-fbf-rail',
    'timeline-video-sequence-compact-fbf-preview',
    'data-kg-video-agent-compact-fbf-preview="1"',
    'data-kg-video-agent-compact-fbf-thumbnail="1"',
    'data-kg-video-agent-compact-fbf-samples',
    'formatVideoSequenceTimelineSecondsOffset',
    'Math.min(14, sampleCount || 10)',
    'VIDEO_AGENT_COMPACT_TRACK_PATTERN',
    '[data-kg-video-agent-compact-fbf="1"] .timeline-video-sequence-clip-frame-strip',
    '[data-kg-video-agent-compact-fbf="1"]:hover .timeline-video-sequence-compact-fbf-preview',
    '[data-kg-video-agent-compact-fbf="1"]:focus-within .timeline-video-sequence-compact-fbf-preview',
    'timeline-video-sequence-compact-fbf-thumbnail',
    '[data-kg-video-agent-compact-fbf="1"] .timeline-video-sequence-clip-cues',
    '[data-kg-video-agent-compact-fbf="1"] .timeline-video-sequence-nested-strip',
    '[data-kg-video-sequence-dense-fbf="1"]',
    'min-width: 8px',
    'overflow: hidden',
    '.timeline-video-sequence-clip-thumbnail',
    'min-width: 0',
    '.timeline-transport-track-clip-label',
    '.timeline-video-sequence-clip-timecode',
  ]) {
    if (!`${rulerText}\n${surfaceModelText}\n${sequenceTimelineText}\n${cssText}\n${compactMediaText}`.includes(token)) {
      throw new Error(`expected dense FBF no-overlap guard token: ${token}`)
    }
  }
  for (const staleToken of [
    '[data-kg-video-agent-compact-fbf="1"] .timeline-video-sequence-clip-thumbnail-strip',
    '[data-kg-video-agent-compact-fbf="1"] .timeline-video-sequence-clip-thumbnail-caption',
  ]) {
    if (cssText.includes(staleToken)) throw new Error(`expected compact FBF to avoid stale shared thumbnail strip selector: ${staleToken}`)
  }
}
