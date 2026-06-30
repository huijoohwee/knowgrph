import {
  VIDEO_AGENT_REFERENCE_BOUNDARY,
  VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES,
  VIDEO_AGENT_SCHEMA_VERSION,
  buildVideoAgentPipeline,
} from '@/features/video-agent'
import { projectVideoAgentFrameAnalysisSrcDoc } from '@/features/video-agent/videoAgentFrameAnalysisProjection'
import { buildMermaidGanttCodeFromNeutralTimelinePayload } from '@/lib/mermaid/mermaidDiagramCode'
import { getYouTubeId } from 'grph-shared/rich-media/providers'
import { WORKSPACE_ROOT_PATH, normalizeWorkspacePath } from '@/features/workspace-fs/path'
import type { WorkspaceFs, WorkspacePath } from '@/features/workspace-fs/types'
import { yamlQuote } from './yaml'

type VideoAgentUrlImportDocumentArgs = {
  sourceName?: string | null
  sourceText?: string | null
  sourceUrl: string
}

const SOURCE_SPEC_NODE_ID = 'html_video_source_spec'
const RENDERER_NODE_ID = 'html_video_renderer_node'
const STREAM_PANEL_NODE_ID = 'html_video_stream_panel'
const FRAME_ANALYSIS_PANEL_NODE_ID = 'video_agent_frame_analysis_panel'

const cleanInline = (value: unknown): string => String(value || '').replace(/\s+/g, ' ').trim()

const sanitizeFilenamePart = (value: unknown): string => {
  const safe = cleanInline(value)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return safe || 'video'
}

const jsonBlock = (value: unknown): string => JSON.stringify(value, null, 2)

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
  const result = buildVideoAgentPipeline({
    sourceUrl,
    intent: 'Load, parse, annotate, count zones, compile, generate, and stream the imported video.',
  })
  if (result.ok === false) throw new Error(result.reason)

  const pipeline = result.pipeline
  const renderSpec = pipeline.renderSpec
  const renderData = renderSpec.data as Record<string, unknown>
  const dataJson = jsonBlock(renderData)
  const frameBoundingBoxesJson = jsonBlock(pipeline.frameBoundingBoxes)
  const frameAnalysisSrcDoc = projectVideoAgentFrameAnalysisSrcDoc({
    frameBoundingBoxes: pipeline.frameBoundingBoxes,
    srcDoc: renderSpec.html,
  })
  const ganttCode = buildMermaidGanttCodeFromNeutralTimelinePayload(renderData)
  const youtubeId = getYouTubeId(sourceUrl)
  const sourceText = String(args.sourceText || '').trim()

  const lines: string[] = [
    '---',
    '$schema: "kgc-pipeline/v1"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "flowEditor"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'kgVideoAgentImport: true',
  ]
  if (youtubeId) lines.push(`kgYoutubeVideoId: ${yamlQuote(youtubeId)}`)
  lines.push(
    'videoAgentRuntimeContract:',
    `  schema: ${yamlQuote(VIDEO_AGENT_SCHEMA_VERSION)}`,
    '  sourceUrls:',
    `    - ${yamlQuote(sourceUrl)}`,
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
    'frameBoundingBoxes',
    'frameByFrameSamples',
    'richMediaPanels',
    'visualAnnotationE2E',
    'datasetOperationSummary',
    'visualDataset',
    'mergedVisualDataset',
    'datasetSplitSummary',
    'savedDatasetArtifact',
    'zoneCounting',
    'timelineTracks',
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
    '            frameBoundingBoxes: "annotation_json"',
  )
  pushBlockScalar(lines, '        ', 'html', renderSpec.html)
  pushBlockScalar(lines, '        ', 'css', renderSpec.css)
  pushBlockScalar(lines, '        ', 'data_json', dataJson)
  pushBlockScalar(lines, '        ', 'frameBoundingBoxes', frameBoundingBoxesJson)
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
    '          out:',
    '            videoUrl: "html_video_artifact"',
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
  pushBlockScalar(lines, '        ', 'frameBoundingBoxes', frameBoundingBoxesJson)
  lines.push(
    `    - id: ${yamlQuote(STREAM_PANEL_NODE_ID)}`,
    '      type: "RichMediaPanel"',
    '      label: "Video Agent Stream Output"',
    '      position: {x: 860, y: 0}',
    '      properties:',
    '        "frontmatter:primitive": "node"',
    '        "flow:widgetFormId": "richMediaPanel"',
    '        richMediaActiveTab: "text"',
    '        "flow:portTypes":',
    '          in:',
    '            outputSrcDoc: "html_video_artifact"',
    '            videoUrl: "html_video_artifact"',
    '            frameBoundingBoxes: "annotation_json"',
    '          out:',
    '            outputSrcDoc: "html_video_artifact"',
    '            frameBoundingBoxes: "annotation_json"',
  )
  pushBlockScalar(lines, '        ', 'outputSrcDoc', renderSpec.html)
  pushBlockScalar(lines, '        ', 'frameBoundingBoxes', frameBoundingBoxesJson)
  lines.push(
    `    - id: ${yamlQuote(FRAME_ANALYSIS_PANEL_NODE_ID)}`,
    '      type: "RichMediaPanel"',
    '      label: "Video Agent Frame Analysis"',
    '      position: {x: 860, y: 420}',
    '      properties:',
    '        "frontmatter:primitive": "node"',
    '        "flow:widgetFormId": "richMediaPanel"',
    '        richMediaActiveTab: "text"',
    '        "flow:portTypes":',
    '          in:',
    '            outputSrcDoc: "rich_media_inline_html"',
    '            frameBoundingBoxes: "annotation_json"',
    '          out:',
    '            outputSrcDoc: "rich_media_inline_html"',
    '            frameBoundingBoxes: "annotation_json"',
  )
  pushBlockScalar(lines, '        ', 'outputSrcDoc', frameAnalysisSrcDoc)
  pushBlockScalar(lines, '        ', 'frameBoundingBoxes', frameBoundingBoxesJson)
  lines.push(
    '  edges:',
    `    - {id: "video-agent-e01", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "html", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "html_in"}`,
    `    - {id: "video-agent-e02", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "css", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "css_in"}`,
    `    - {id: "video-agent-e03", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "data_json", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "data_json_in"}`,
    `    - {id: "video-agent-e04", source: ${yamlQuote(SOURCE_SPEC_NODE_ID)}, sourceHandle: "frameBoundingBoxes", target: ${yamlQuote(RENDERER_NODE_ID)}, targetHandle: "frameBoundingBoxes_in"}`,
    `    - {id: "video-agent-e05", source: ${yamlQuote(RENDERER_NODE_ID)}, sourceHandle: "outputSrcDoc", target: ${yamlQuote(STREAM_PANEL_NODE_ID)}, targetHandle: "outputSrcDoc"}`,
    `    - {id: "video-agent-e06", source: ${yamlQuote(RENDERER_NODE_ID)}, sourceHandle: "frameBoundingBoxes", target: ${yamlQuote(STREAM_PANEL_NODE_ID)}, targetHandle: "frameBoundingBoxes"}`,
    `    - {id: "video-agent-e07", source: ${yamlQuote(RENDERER_NODE_ID)}, sourceHandle: "outputSrcDoc", target: ${yamlQuote(FRAME_ANALYSIS_PANEL_NODE_ID)}, targetHandle: "outputSrcDoc"}`,
    `    - {id: "video-agent-e08", source: ${yamlQuote(RENDERER_NODE_ID)}, sourceHandle: "frameBoundingBoxes", target: ${yamlQuote(FRAME_ANALYSIS_PANEL_NODE_ID)}, targetHandle: "frameBoundingBoxes"}`,
    '---',
    '',
    '# Video Agent Import',
    '',
    `Source: ${sourceUrl}`,
    '',
    '## Parsed Outputs',
    '',
    `- Frame boxes: ${pipeline.frameBoundingBoxes.length}`,
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
  sourceUrl: string
}): Promise<WorkspacePath> {
  const createdPath = await args.fs.createFile({
    parentPath: args.parentPath || WORKSPACE_ROOT_PATH,
    name: buildVideoAgentUrlImportDocumentName(args),
    text: buildVideoAgentUrlImportMarkdown(args),
  })
  return normalizeWorkspacePath(createdPath)
}
