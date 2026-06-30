import {
  VIDEO_AGENT_REFERENCE_BOUNDARY,
  VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES,
  VIDEO_AGENT_SCHEMA_VERSION,
  buildVideoAgentDatasetPanelSrcDoc,
  buildVideoAgentPipeline,
} from '@/features/video-agent'
import { projectVideoAgentFrameAnalysisSrcDoc } from '@/features/video-agent/videoAgentFrameAnalysisProjection'
import {
  VIDEO_AGENT_WORKSPACE_OUTPUT_ROOT_PATH,
  buildVideoAgentTimestampedWorkspaceOutputFolderPath,
  resolveVideoAgentImportOutputParentPath,
} from '@/features/video-agent/videoAgentWorkspaceOutput'
import { writeWorkspaceFileTextEnsuringFile } from '@/features/chat/chatWorkspaceFsWrite'
import { ensureWorkspaceDocsMirrorFolder, upsertWorkspaceDocsMirrorText } from '@/features/workspace-fs/workspaceSeedProvider'
import { buildMermaidGanttCodeFromNeutralTimelinePayload } from '@/lib/mermaid/mermaidDiagramCode'
import { getYouTubeId } from 'grph-shared/rich-media/providers'
import { joinWorkspacePath, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { yamlQuote } from './yaml'

type VideoAgentUrlImportDocumentArgs = {
  sourceName?: string | null
  sourceText?: string | null
  sourceTranscriptJsonText?: string | null
  sourceUrl: string
  workspaceOutputRoot?: WorkspacePath | null
}

type VideoAgentTranscriptSegment = {
  durationMs: number
  endMs: number
  index: number
  startMs: number
  text: string
}

const SOURCE_SPEC_NODE_ID = 'html_video_source_spec'
const RENDERER_NODE_ID = 'html_video_renderer_node'
const STREAM_PANEL_NODE_ID = 'html_video_stream_panel'
const FRAME_ANALYSIS_PANEL_NODE_ID = 'video_agent_frame_analysis_panel'
const DATASET_PANEL_NODE_ID = 'video_agent_dataset_panel'

const cleanInline = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim()

const sanitizeFilenamePart = (value: unknown): string => {
  const safe = cleanInline(value)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return safe || 'video'
}

const jsonBlock = (value: unknown): string => JSON.stringify(value)

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const buildFrameAnalysisPanelBaseSrcDoc = (frameBoundingBoxes: ReadonlyArray<{ frameImageUrl?: unknown }>): string => {
  const firstFrameImageUrl = String(frameBoundingBoxes.find(box => String(box.frameImageUrl || '').trim())?.frameImageUrl || '').trim()
  return [
    '<main aria-label="Video agent frame analysis">',
    '<section class="thumbnail" aria-label="Timeline-synchronized frame-by-frame annotation">',
    `<img class="thumbnail-source" src="${escapeHtml(firstFrameImageUrl)}" alt="">`,
    '<section class="frame-boxes" aria-label="Frame-by-frame bounding boxes"></section>',
    '</section>',
    '</main>',
  ].join('')
}

const buildVideoAgentStreamPanelSrcDoc = (args: {
  frameCount: number
  sourcePlaybackUrl: string
  sourceUrl: string
  transcriptSegmentCount: number
}): string => [
  '<main data-kg-video-agent-stream-panel="1" aria-label="Video agent stream output">',
  '<section class="source-playback" data-kg-video-agent-source-playback="1" aria-label="Audio-capable source playback">',
  `<iframe title="Audio-capable source video playback" src="${escapeHtml(args.sourcePlaybackUrl || args.sourceUrl)}" allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
  '</section>',
  '<section aria-label="Video agent stream contract">',
  '<h2>Stream output</h2>',
  `<p data-kg-video-agent-source-url="${escapeHtml(args.sourceUrl)}">Source playback, frame analysis, annotation data, and transcript windows share the timeline transport clock.</p>`,
  `<p><strong>${Math.max(0, args.frameCount)}</strong> frame samples, <strong>${Math.max(0, args.transcriptSegmentCount)}</strong> transcript windows.</p>`,
  '</section>',
  '<script>(function(){var root=document.querySelector("[data-kg-video-agent-stream-panel]");window.addEventListener("knowgrph:render-frame",function(event){var timeMs=Number(event&&event.detail&&event.detail.timeMs)||0;if(root)root.setAttribute("data-kg-video-agent-render-time-ms",String(timeMs));});}());</script>',
  '</main>',
].join('')

const readNumber = (value: unknown): number | null => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const secondsToMs = (value: unknown): number | null => {
  const n = readNumber(value)
  return n === null ? null : Math.max(0, Math.round(n * 1000))
}

const readTranscriptSegmentsFromJson = (text: string): VideoAgentTranscriptSegment[] => {
  if (!text.trim()) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  const rawSegments = Array.isArray((parsed as { segments?: unknown })?.segments)
    ? (parsed as { segments?: unknown[] }).segments || []
    : []
  return rawSegments.map((segment, index) => {
    const record = segment as Record<string, unknown>
    const startMs = secondsToMs(record.start) ?? secondsToMs(record.start_seconds) ?? readNumber(record.startMs) ?? 0
    const durationMs = Math.max(1, secondsToMs(record.duration) ?? readNumber(record.durationMs) ?? 1000)
    const endMs = Math.max(startMs + 1, secondsToMs(record.end) ?? readNumber(record.endMs) ?? startMs + durationMs)
    return { durationMs, endMs, index, startMs, text: cleanInline(record.text) }
  }).filter(segment => !!segment.text)
}

const readTranscriptSegmentsFromMarkdown = (text: string, durationMs: number): VideoAgentTranscriptSegment[] => {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map(cleanInline)
    .filter(line => line && line !== '---' && !/^kg[A-Z]/.test(line) && !/^https?:\/\//i.test(line))
  const stepMs = Math.max(1, Math.floor(Math.max(1, durationMs) / Math.max(1, lines.length)))
  return lines.map((line, index) => {
    const startMs = index * stepMs
    const endMs = index === lines.length - 1 ? Math.max(startMs + 1, durationMs) : startMs + stepMs
    return { durationMs: Math.max(1, endMs - startMs), endMs, index, startMs, text: line.replace(/^#+\s*/, '') }
  }).filter(segment => !!segment.text)
}

const buildTranscriptImportArtifacts = (args: {
  durationMs: number
  frameBoundingBoxes: ReadonlyArray<{ frameIndex: number; timestampMs: number }>
  sourceText: string
  sourceTranscriptJsonText?: string | null
}) => {
  const jsonSegments = readTranscriptSegmentsFromJson(String(args.sourceTranscriptJsonText || ''))
  const segments = jsonSegments.length > 0
    ? jsonSegments
    : readTranscriptSegmentsFromMarkdown(args.sourceText, args.durationMs)
  const segmentForTime = (timestampMs: number, fallbackIndex: number): VideoAgentTranscriptSegment | null => {
    const active = segments.find(segment => timestampMs >= segment.startMs && timestampMs < segment.endMs)
    if (active) return active
    return segments.reduce<VideoAgentTranscriptSegment | null>((best, segment) => {
      const bestDistance = best ? Math.min(Math.abs(timestampMs - best.startMs), Math.abs(timestampMs - best.endMs)) : Number.POSITIVE_INFINITY
      const distance = Math.min(Math.abs(timestampMs - segment.startMs), Math.abs(timestampMs - segment.endMs))
      return distance < bestDistance ? segment : best
    }, null) || segments[Math.min(segments.length - 1, fallbackIndex % Math.max(1, segments.length))] || null
  }
  return {
    sourceTranscript: {
      schemaVersion: 'knowgrph-video-agent-transcript/v1',
      source: jsonSegments.length > 0 ? 'youtube-transcript-json' : 'youtube-transcript-markdown',
      format: jsonSegments.length > 0 ? 'json' : 'markdown',
      segmentCount: segments.length,
      segments,
    },
    frameByFrameTranscript: args.frameBoundingBoxes.map((box, index) => {
      const segment = segmentForTime(box.timestampMs, index)
      return {
        frameIndex: box.frameIndex,
        timestampMs: box.timestampMs,
        transcriptSegmentIndex: segment?.index ?? -1,
        segmentStartMs: segment?.startMs ?? 0,
        segmentEndMs: segment?.endMs ?? 0,
        text: segment?.text || '',
      }
    }),
  }
}

const readTranscriptDurationMs = (args: Pick<VideoAgentUrlImportDocumentArgs, 'sourceTranscriptJsonText'>): number => {
  const segments = readTranscriptSegmentsFromJson(String(args.sourceTranscriptJsonText || ''))
  return segments.reduce((durationMs, segment) => Math.max(durationMs, segment.endMs), 0)
}

const pushBlockScalar = (lines: string[], indent: string, key: string, value: string): void => {
  const text = String(value || '').replace(/\r/g, '').trim()
  if (!text) return
  lines.push(`${indent}${key}: |-`)
  for (const line of text.split('\n')) lines.push(`${indent}  ${line}`)
}

const pushStringList = (lines: string[], indent: string, key: string, values: readonly string[]): void => {
  const cleaned = values.map(cleanInline).filter(Boolean)
  if (!cleaned.length) return
  lines.push(`${indent}${key}:`)
  for (const value of cleaned) lines.push(`${indent}  - ${yamlQuote(value)}`)
}

const pushFrameBoxes = (
  lines: string[],
  indent: string,
  frameBoundingBoxes: ReadonlyArray<{
    bbox: readonly [number, number, number, number]
    confidence: number
    frameIndex: number
    label: string
    timestampMs: number
  }>,
): void => {
  if (!frameBoundingBoxes.length) return
  lines.push(`${indent}frameBoundingBoxes:`)
  for (const box of frameBoundingBoxes) {
    lines.push(`${indent}  - {frameIndex: ${box.frameIndex}, timestampMs: ${box.timestampMs}, label: ${yamlQuote(box.label)}, bbox: [${box.bbox.join(', ')}], confidence: ${box.confidence}}`)
  }
}

export function buildVideoAgentUrlImportDocumentName(args: { sourceName?: string | null; sourceUrl: string }): string {
  const sourceName = cleanInline(args.sourceName).replace(/\.source\.md$/i, '').replace(/\.(md|markdown)$/i, '')
  const youtubeId = getYouTubeId(args.sourceUrl)
  const base = sanitizeFilenamePart(sourceName || youtubeId || args.sourceUrl)
  return `${base}.video-agent.md`
}

export function buildVideoAgentUrlImportMarkdown(args: VideoAgentUrlImportDocumentArgs): string {
  const sourceUrl = cleanInline(args.sourceUrl)
  const workspaceOutputRoot = normalizeWorkspacePath(args.workspaceOutputRoot || VIDEO_AGENT_WORKSPACE_OUTPUT_ROOT_PATH)
  const transcriptDurationMs = readTranscriptDurationMs(args)
  const result = buildVideoAgentPipeline({
    sourceUrl,
    intent: 'Load, parse, annotate, count zones, compile, generate, and stream the imported video.',
    durationMs: transcriptDurationMs || undefined,
    workspaceOutputRoot,
  })
  if (result.ok === false) throw new Error(result.reason)

  const pipeline = result.pipeline
  const renderSpec = pipeline.renderSpec
  const sourceText = String(args.sourceText || '').trim()
  const transcriptArtifacts = buildTranscriptImportArtifacts({
    durationMs: renderSpec.durationMs,
    frameBoundingBoxes: pipeline.frameBoundingBoxes,
    sourceText,
    sourceTranscriptJsonText: args.sourceTranscriptJsonText,
  })
  const renderData: Record<string, unknown> = {
    ...(renderSpec.data as Record<string, unknown>),
    sourceTranscript: transcriptArtifacts.sourceTranscript,
    frameByFrameTranscript: transcriptArtifacts.frameByFrameTranscript,
  }
  const sourcePlaybackUrl = String((renderData.sourceVideo as { playbackEmbedUrl?: unknown })?.playbackEmbedUrl || sourceUrl)
  const dataJson = jsonBlock(renderData)
  const frameBoundingBoxesJson = jsonBlock(pipeline.frameBoundingBoxes)
  const sourceTranscriptJson = jsonBlock(transcriptArtifacts.sourceTranscript)
  const frameByFrameTranscriptJson = jsonBlock(transcriptArtifacts.frameByFrameTranscript)
  const frameAnalysisSrcDoc = projectVideoAgentFrameAnalysisSrcDoc({
    frameBoundingBoxes: pipeline.frameBoundingBoxes,
    srcDoc: buildFrameAnalysisPanelBaseSrcDoc(pipeline.frameBoundingBoxes),
  })
  const streamPanelSrcDoc = buildVideoAgentStreamPanelSrcDoc({
    frameCount: pipeline.frameBoundingBoxes.length,
    sourcePlaybackUrl,
    sourceUrl,
    transcriptSegmentCount: transcriptArtifacts.sourceTranscript.segmentCount,
  })
  const datasetPanelSrcDoc = buildVideoAgentDatasetPanelSrcDoc(pipeline.datasetRuntime)
  const visualDatasetJson = jsonBlock(pipeline.datasetRuntime.visualDataset)
  const mergedVisualDatasetJson = jsonBlock(pipeline.datasetRuntime.mergedVisualDataset)
  const zoneCountingJson = jsonBlock(pipeline.datasetRuntime.zoneCounting)
  const ganttCode = buildMermaidGanttCodeFromNeutralTimelinePayload(renderData)
  const youtubeId = getYouTubeId(sourceUrl)

  const lines: string[] = [
    '---',
    '$schema: "kgc-pipeline/v1"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "flowEditor"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'kgVideoAgentImport: true',
    `kgWorkspaceOutputRoot: ${yamlQuote(workspaceOutputRoot)}`,
  ]
  if (youtubeId) lines.push(`kgYoutubeVideoId: ${yamlQuote(youtubeId)}`)
  lines.push(
    'kgVideoSequenceTimeline: true',
    'kgVideoSequenceSources:',
    '  - id: "video_agent_source"',
    '    originalName: "Video agent source"',
    `    sourceUrl: ${yamlQuote(sourceUrl)}`,
    '    importMode: "url"',
    `    durationSeconds: ${Math.max(1, Math.round(renderSpec.durationMs / 1000))}`,
    `    frameRate: ${renderSpec.fps}`,
    `    displayWidth: ${renderSpec.width}`,
    `    displayHeight: ${renderSpec.height}`,
    'videoAgentRuntimeContract:',
    `  schema: ${yamlQuote(VIDEO_AGENT_SCHEMA_VERSION)}`,
    '  sourceUrls:',
    `    - ${yamlQuote(sourceUrl)}`,
    '  outputStore:',
    `    workspaceRoot: ${yamlQuote(VIDEO_AGENT_WORKSPACE_OUTPUT_ROOT_PATH)}`,
    `    workspacePath: ${yamlQuote(workspaceOutputRoot)}`,
    '  dependencyPolicy:',
    '    - "no-external-video-agent-runtime"',
    '    - "no copied external code"',
    '  referenceBoundary:',
    `    kind: ${yamlQuote(VIDEO_AGENT_REFERENCE_BOUNDARY.kind)}`,
    `    implementation: ${yamlQuote(VIDEO_AGENT_REFERENCE_BOUNDARY.implementation)}`,
    `    copyPolicy: ${yamlQuote(VIDEO_AGENT_REFERENCE_BOUNDARY.copyPolicy)}`,
    `    dependencyPolicy: ${yamlQuote(VIDEO_AGENT_REFERENCE_BOUNDARY.dependencyPolicy)}`,
    '    runtimeDependency: false',
  )
  pushStringList(lines, '  ', 'capabilities', pipeline.capabilities)
  pushStringList(lines, '  ', 'streamPanels', [...VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES])
  pushStringList(lines, '  ', 'sourceTruth', [
    'canvas/src/features/video-agent/videoAgentPipeline.ts',
    'canvas/src/features/video-agent/videoAgentDatasetRuntime.ts',
    'canvas/src/features/html-video-renderer/htmlVideoFlowNode.ts',
    'canvas/src/features/visual-annotation-engine/annotationDataset.ts',
  ])
  pushStringList(lines, '  ', 'outputBoundary', [
    'source manifest',
    'sourcePlaybackUrl',
    'frameBoundingBoxes',
    'frameByFrameSamples',
    'sourceTranscript',
    'frameByFrameTranscript',
    'richMediaPanels',
    'visualAnnotationE2E',
    'datasetOperationSummary',
    'visualDataset',
    'mergedVisualDataset',
    'datasetSplitSummary',
    'savedDatasetArtifact',
    'zoneCounting',
    'timelineTracks',
    `workspace output store ${workspaceOutputRoot}`,
    'video/mp4 or outputSrcDoc stream fallback',
  ])
  pushFrameBoxes(lines, '  ', pipeline.frameBoundingBoxes)
  lines.push(
    'flow_diagrams:',
    '  video_agent_timeline:',
    '    key: "video_agent_timeline"',
    '    type: "mermaid_gantt"',
  )
  pushBlockScalar(lines, '    ', 'value', ganttCode)
  lines.push(
    'flow:',
    '  direction: "LR"',
    '  edgeType: "smoothstep"',
    '  nodes:',
    `    - id: ${yamlQuote(SOURCE_SPEC_NODE_ID)}`,
    '      type: "InputWidget"',
    '      label: "Video Agent Render Spec"',
    '      position: {x: 0, y: 0}',
    '      properties:',
    '        "frontmatter:primitive": "node"',
    '        "flow:widgetFormId": "htmlVideoRenderSpecInput"',
    '        "flow:portTypes":',
    '          out:',
    '            html: "html_video_spec"',
    '            css: "html_video_spec"',
    '            data_json: "html_video_spec"',
    '            sourcePlaybackUrl: "html_video_artifact"',
    '            frameBoundingBoxes: "annotation_json"',
    '            sourceTranscript: "transcript_json"',
    '            frameByFrameTranscript: "transcript_json"',
    '            visualDataset: "annotation_json"',
    '            mergedVisualDataset: "annotation_json"',
    '            zoneCounting: "annotation_json"',
  )
  pushBlockScalar(lines, '        ', 'html', renderSpec.html)
  pushBlockScalar(lines, '        ', 'css', renderSpec.css)
  pushBlockScalar(lines, '        ', 'data_json', dataJson)
  lines.push(`        sourcePlaybackUrl: ${yamlQuote(sourcePlaybackUrl)}`)
  pushBlockScalar(lines, '        ', 'frameBoundingBoxes', frameBoundingBoxesJson)
  pushBlockScalar(lines, '        ', 'sourceTranscript', sourceTranscriptJson)
  pushBlockScalar(lines, '        ', 'frameByFrameTranscript', frameByFrameTranscriptJson)
  pushBlockScalar(lines, '        ', 'visualDataset', visualDatasetJson)
  pushBlockScalar(lines, '        ', 'mergedVisualDataset', mergedVisualDatasetJson)
  pushBlockScalar(lines, '        ', 'zoneCounting', zoneCountingJson)
  lines.push(
    `    - id: ${yamlQuote(RENDERER_NODE_ID)}`,
    '      type: "HtmlVideoRenderer"',
    '      label: "Video Agent HTML Stream Renderer"',
    '      position: {x: 420, y: 0}',
    '      properties:',
    '        "frontmatter:primitive": "node"',
    '        "flow:widgetFormId": "htmlVideoRenderer"',
    '        "flow:portTypes":',
    '          in:',
    '            html_in: "html_video_spec"',
    '            css_in: "html_video_spec"',
    '            data_json_in: "html_video_spec"',
    '            frameBoundingBoxes_in: "annotation_json"',
    '            frameByFrameTranscript_in: "transcript_json"',
    '            sourcePlaybackUrl_in: "html_video_artifact"',
    '          out:',
    '            videoUrl: "html_video_artifact"',
    '            sourcePlaybackUrl: "html_video_artifact"',
    '            outputSrcDoc: "html_video_artifact"',
    '            outputPath: "html_video_artifact"',
    '            renderJobId: "html_video_artifact"',
    '            frameBoundingBoxes: "annotation_json"',
    `        duration_ms: ${renderSpec.durationMs}`,
    `        fps: ${renderSpec.fps}`,
    `        width: ${renderSpec.width}`,
    `        height: ${renderSpec.height}`,
    `        engine_hint: ${yamlQuote(renderSpec.engineHint)}`,
  )
  pushBlockScalar(lines, '        ', 'html', renderSpec.html)
  pushBlockScalar(lines, '        ', 'css', renderSpec.css)
  pushBlockScalar(lines, '        ', 'data_json', dataJson)
  pushBlockScalar(lines, '        ', 'outputSrcDoc', renderSpec.html)
  lines.push(`        sourcePlaybackUrl: ${yamlQuote(sourcePlaybackUrl)}`)
  pushBlockScalar(lines, '        ', 'frameBoundingBoxes', frameBoundingBoxesJson)
  pushBlockScalar(lines, '        ', 'frameByFrameTranscript', frameByFrameTranscriptJson)
  lines.push(
    `    - id: ${yamlQuote(STREAM_PANEL_NODE_ID)}`,
    '      type: "RichMediaPanel"',
    '      label: "Video Agent Stream Output"',
    '      position: {x: 860, y: 0}',
    '      properties:',
    '        "frontmatter:primitive": "node"',
    '        "flow:widgetFormId": "richMediaPanel"',
    '        richMediaActiveTab: "auto"',
    '        kind: "iframe"',
    '        videoAgentKind: "stream"',
    '        media_interactive: true',
    `        sourceUrl: ${yamlQuote(sourceUrl)}`,
    `        sourcePlaybackUrl: ${yamlQuote(sourcePlaybackUrl)}`,
    '        "flow:portTypes":',
    '          in:',
    '            outputSrcDoc: "html_video_artifact"',
    '            videoUrl: "html_video_artifact"',
    '            sourcePlaybackUrl: "html_video_artifact"',
    '            frameBoundingBoxes: "annotation_json"',
    '            frameByFrameTranscript: "transcript_json"',
    '          out:',
    '            outputSrcDoc: "html_video_artifact"',
    '            frameBoundingBoxes: "annotation_json"',
    '            frameByFrameTranscript: "transcript_json"',
  )
  pushBlockScalar(lines, '        ', 'outputSrcDoc', streamPanelSrcDoc)
  pushBlockScalar(lines, '        ', 'frameBoundingBoxes', frameBoundingBoxesJson)
  pushBlockScalar(lines, '        ', 'frameByFrameTranscript', frameByFrameTranscriptJson)
  lines.push(
    `    - id: ${yamlQuote(FRAME_ANALYSIS_PANEL_NODE_ID)}`,
    '      type: "RichMediaPanel"',
    '      label: "Video Agent Frame Analysis"',
    '      position: {x: 860, y: 420}',
    '      properties:',
    '        "frontmatter:primitive": "node"',
    '        "flow:widgetFormId": "richMediaPanel"',
    '        richMediaActiveTab: "text"',
    '        kind: "video-agent-frame-analysis"',
    '        freezeConnectedOutput: true',
    `        sourceUrl: ${yamlQuote(sourceUrl)}`,
    '        "flow:portTypes":',
    '          in:',
    '            outputSrcDoc: "rich_media_inline_html"',
    '            frameBoundingBoxes: "annotation_json"',
    '            frameByFrameTranscript: "transcript_json"',
    '          out:',
    '            outputSrcDoc: "rich_media_inline_html"',
    '            frameBoundingBoxes: "annotation_json"',
    '            frameByFrameTranscript: "transcript_json"',
  )
  pushBlockScalar(lines, '        ', 'srcDoc', frameAnalysisSrcDoc)
  pushBlockScalar(lines, '        ', 'frameBoundingBoxes', frameBoundingBoxesJson)
  pushBlockScalar(lines, '        ', 'frameByFrameTranscript', frameByFrameTranscriptJson)
  lines.push(
    `    - id: ${yamlQuote(DATASET_PANEL_NODE_ID)}`,
    '      type: "RichMediaPanel"',
    '      label: "Video Agent Dataset and Zone Counts"',
    '      position: {x: 860, y: 840}',
    '      properties:',
    '        "frontmatter:primitive": "node"',
    '        "flow:widgetFormId": "richMediaPanel"',
    '        richMediaActiveTab: "text"',
    '        freezeConnectedOutput: true',
    '        "flow:portTypes":',
    '          in:',
    '            outputSrcDoc: "rich_media_inline_html"',
    '            visualDataset: "annotation_json"',
    '            mergedVisualDataset: "annotation_json"',
    '            zoneCounting: "annotation_json"',
  )
  pushBlockScalar(lines, '        ', 'outputSrcDoc', datasetPanelSrcDoc)
  pushBlockScalar(lines, '        ', 'visualDataset', visualDatasetJson)
  pushBlockScalar(lines, '        ', 'mergedVisualDataset', mergedVisualDatasetJson)
  pushBlockScalar(lines, '        ', 'zoneCounting', zoneCountingJson)
  lines.push(
    '  edges:',
    `    - {id: "video-agent-e01", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "html", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "html_in"}`,
    `    - {id: "video-agent-e02", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "css", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "css_in"}`,
    `    - {id: "video-agent-e03", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "data_json", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "data_json_in"}`,
    `    - {id: "video-agent-e04", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "frameBoundingBoxes", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "frameBoundingBoxes_in"}`,
    `    - {id: "video-agent-e04b", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "frameByFrameTranscript", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "frameByFrameTranscript_in"}`,
    `    - {id: "video-agent-e04c", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "sourcePlaybackUrl", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "sourcePlaybackUrl_in"}`,
    `    - {id: "video-agent-e05", source: ${yamlQuote(RENDERER_NODE_ID)}, sourceHandle: "outputSrcDoc", target: ${yamlQuote(STREAM_PANEL_NODE_ID)}, targetHandle: "outputSrcDoc"}`,
    `    - {id: "video-agent-e05b", source: ${yamlQuote(RENDERER_NODE_ID)}, sourceHandle: "sourcePlaybackUrl", target: ${yamlQuote(STREAM_PANEL_NODE_ID)}, targetHandle: "sourcePlaybackUrl"}`,
    `    - {id: "video-agent-e06", source: ${yamlQuote(RENDERER_NODE_ID)}, sourceHandle: "frameBoundingBoxes", target: ${yamlQuote(STREAM_PANEL_NODE_ID)}, targetHandle: "frameBoundingBoxes"}`,
    `    - {id: "video-agent-e07", source: ${yamlQuote(RENDERER_NODE_ID)}, sourceHandle: "outputSrcDoc", target: ${yamlQuote(FRAME_ANALYSIS_PANEL_NODE_ID)}, targetHandle: "outputSrcDoc"}`,
    `    - {id: "video-agent-e08", source: ${yamlQuote(RENDERER_NODE_ID)}, sourceHandle: "frameBoundingBoxes", target: ${yamlQuote(FRAME_ANALYSIS_PANEL_NODE_ID)}, targetHandle: "frameBoundingBoxes"}`,
    `    - {id: "video-agent-e08b", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "frameByFrameTranscript", target: ${yamlQuote(FRAME_ANALYSIS_PANEL_NODE_ID)}, targetHandle: "frameByFrameTranscript"}`,
    `    - {id: "video-agent-e09", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "visualDataset", target: ${yamlQuote(DATASET_PANEL_NODE_ID)}, targetHandle: "visualDataset"}`,
    `    - {id: "video-agent-e10", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "mergedVisualDataset", target: ${yamlQuote(DATASET_PANEL_NODE_ID)}, targetHandle: "mergedVisualDataset"}`,
    `    - {id: "video-agent-e11", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "zoneCounting", target: ${yamlQuote(DATASET_PANEL_NODE_ID)}, targetHandle: "zoneCounting"}`,
    '---',
    '',
    '# Video Agent Import',
    '',
    `Source: ${sourceUrl}`,
    '',
    '## Parsed Outputs',
    '',
    `- Frame boxes: ${pipeline.frameBoundingBoxes.length}`,
    `- Transcript segments: ${transcriptArtifacts.sourceTranscript.segmentCount}`,
    `- Frame transcript rows: ${transcriptArtifacts.frameByFrameTranscript.length}`,
    `- Visual dataset samples: ${pipeline.datasetRuntime.visualDataset.samples.length}`,
    `- Merged dataset samples: ${pipeline.datasetRuntime.mergedVisualDataset.samples.length}`,
    `- Saved annotations: ${pipeline.datasetRuntime.savedDatasetArtifact.annotationCount}`,
    `- Zone-counted frames: ${pipeline.datasetRuntime.zoneCounting.frames.length}`,
    `- Timeline tracks: ${pipeline.timelineTracks.length}`,
    '',
  )
  if (sourceText) {
    lines.push('## Source Transcript', '', sourceText, '')
  }
  return lines.join('\n')
}

export async function materializeVideoAgentUrlImportDocument(args: {
  fs: WorkspaceFs
  parentPath?: WorkspacePath | null
  sourceName?: string | null
  sourceText?: string | null
  sourceTranscriptJsonText?: string | null
  sourceUrl: string
}): Promise<WorkspacePath> {
  const parentPath = resolveVideoAgentImportOutputParentPath(args.parentPath)
  const outputFolderPath = buildVideoAgentTimestampedWorkspaceOutputFolderPath(parentPath)
  const createdPath = joinWorkspacePath(
    outputFolderPath,
    buildVideoAgentUrlImportDocumentName(args),
  )
  const text = buildVideoAgentUrlImportMarkdown({ ...args, workspaceOutputRoot: outputFolderPath })
  await writeWorkspaceFileTextEnsuringFile({
    fs: args.fs,
    path: createdPath,
    text,
  })
  await ensureWorkspaceDocsMirrorFolder({ workspacePath: outputFolderPath })
  await upsertWorkspaceDocsMirrorText({ workspacePath: createdPath, text })
  return normalizeWorkspacePath(createdPath)
}
