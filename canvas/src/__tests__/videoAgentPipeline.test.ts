import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import {
  VIDEO_AGENT_REFERENCE_BOUNDARY,
  VIDEO_AGENT_SCHEMA_VERSION,
  VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES,
  buildVideoAgentPipeline,
} from '@/features/video-agent'
import { buildVideoSequenceGeneratedFrameThumbnails } from '@/components/timeline/videoSequenceGeneratedFrameThumbnails'
import { projectVideoAgentFrameAnalysisSrcDoc } from '@/features/video-agent/videoAgentFrameAnalysisProjection'
import { HTML_VIDEO_ENGINE_IDS, validateRenderSpec } from '@/features/html-video-renderer'
import { buildMermaidGanttCodeFromNeutralTimelinePayload } from '@/lib/mermaid/mermaidDiagramCode'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { getNodeMediaSpec } from '@/lib/canvas/graph-elements/mediaSpec'
import { normalizeRichMediaPanelInlineSrcDoc } from '@/lib/render/richMediaPanelSrcDoc'
import { RICH_MEDIA_TIMELINE_TRANSPORT_FRAME_MESSAGE } from '@/lib/render/richMediaTimelineSync'

const neutralSourceUrl = 'https://media.example.test/source-video'
const providerBackedSourceUrl = 'https://youtu.be/aBcD123xYz9'

export function testVideoAgentPipelineBuildsE2EIngestionParsingRenderingPlan() {
  const result = buildVideoAgentPipeline({
    sourceUrl: neutralSourceUrl,
    intent: 'Search for relevant moments, plan edits, compile a short result, generate overlays, and stream it.',
    requestedCapabilities: ['search', 'edit', 'compile', 'generate'],
  })
  if (result.ok === false) throw new Error(`expected valid video-agent pipeline, got ${result.reason}`)

  const { pipeline } = result
  if (pipeline.schemaVersion !== VIDEO_AGENT_SCHEMA_VERSION) throw new Error('expected canonical video-agent schema')
  if (pipeline.source.sourceUrl !== neutralSourceUrl || pipeline.source.externalDependency !== false) {
    throw new Error('expected source-owned video input without external runtime dependency')
  }
  if (
    pipeline.referenceBoundary !== VIDEO_AGENT_REFERENCE_BOUNDARY
    || pipeline.referenceBoundary.kind !== 'inspiration-only'
    || pipeline.referenceBoundary.implementation !== 'native-knowgrph'
    || pipeline.referenceBoundary.copyPolicy !== 'no-external-code-copy'
    || pipeline.referenceBoundary.dependencyPolicy !== 'no-external-video-agent-runtime'
    || pipeline.referenceBoundary.runtimeDependency !== false
  ) {
    throw new Error(`expected native inspiration-only reference boundary, got ${JSON.stringify(pipeline.referenceBoundary)}`)
  }
  for (const capability of ['ingest', 'parse', 'search', 'edit', 'compile', 'generate', 'stream']) {
    if (!pipeline.capabilities.includes(capability as never)) {
      throw new Error(`expected video-agent capability ${capability}`)
    }
  }

  const phases = pipeline.stages.map(stage => stage.phase)
  if (phases[0] !== 'ingestion') throw new Error('expected ingestion to be the first video-agent phase')
  if (!phases.includes('parsing')) throw new Error('expected parsing phase for video reasoning')
  if (phases[phases.length - 1] !== 'rendering') throw new Error('expected rendering to finish the video-agent phase plan')
  if (!pipeline.stages.some(stage => stage.capability === 'search' && stage.output.includes('evidence'))) {
    throw new Error('expected search stage to produce evidence windows')
  }
  if (!pipeline.stages.some(stage => stage.capability === 'edit' && stage.output.includes('clip'))) {
    throw new Error('expected editing stage to produce clip decisions')
  }
  if (!pipeline.stages.some(stage => stage.capability === 'compile' && stage.output.includes('render spec'))) {
    throw new Error('expected compilation stage to produce a render spec')
  }
  if (!pipeline.stages.some(stage => stage.capability === 'generate' && stage.output.includes('placeholder'))) {
    throw new Error('expected generation stage to be represented without external generation dependency')
  }
  if (!Array.isArray(pipeline.reasoningArtifacts) || pipeline.reasoningArtifacts.length !== pipeline.capabilities.length) {
    throw new Error('expected one video-agent reasoning artifact per capability')
  }
  if (!Array.isArray(pipeline.frameBoundingBoxes) || pipeline.frameBoundingBoxes.length < 5) {
    throw new Error('expected frame-by-frame bounding boxes for video reasoning')
  }
  if (
    pipeline.datasetRuntime.visualDataset.samples.length !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.savedDatasetArtifact.sampleCount !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.savedDatasetArtifact.annotationCount !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.datasetSplitSummary.total !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.zoneCounting.frames.length !== pipeline.frameBoundingBoxes.length
  ) {
    throw new Error(`expected video-agent frame boxes to load/split/save/count as one visual dataset, got ${JSON.stringify(pipeline.datasetRuntime)}`)
  }
  const savedDataset = JSON.parse(pipeline.datasetRuntime.savedDatasetArtifact.text) as { samples?: unknown }
  if (!Array.isArray(savedDataset.samples) || savedDataset.samples.length !== pipeline.frameBoundingBoxes.length) {
    throw new Error('expected saved visual dataset artifact to contain the frame annotation samples')
  }
  const zoneHitTotal = Object.values(pipeline.datasetRuntime.zoneCounting.totals).reduce((sum, count) => sum + Number(count), 0)
  if (zoneHitTotal !== pipeline.frameBoundingBoxes.length) {
    throw new Error(`expected real-time zone counts to account for every frame detection, got ${zoneHitTotal}`)
  }
  const pipelineFrameTimelineTracks = pipeline.timelineTracks.filter(track => track.source === 'frameBoundingBox' && track.timelineLane === 'fbf')
  if (pipelineFrameTimelineTracks.length !== pipeline.frameBoundingBoxes.length) {
    throw new Error('expected one BottomPanel FBF timeline track per frame bounding box')
  }
  const fbfTimelineCode = buildMermaidGanttCodeFromNeutralTimelinePayload({
    title: 'Video Sequence',
    timelineTracks: pipeline.timelineTracks,
    timelineLanes: [
      { id: 'video-agent-stages', label: 'Video agent stages', tracks: pipeline.timelineTracks.filter(track => track.timelineLane === 'video').map(track => track.id) },
      { id: 'frame-by-frame-boxes', label: 'Frame-by-frame boxes', tracks: pipelineFrameTimelineTracks.map(track => track.id) },
    ],
  })
  const fbfTimelineModel = buildMermaidGanttTimelineModel(fbfTimelineCode)
  const firstFbfSpan = fbfTimelineModel.taskSpans.find(span => /frame_box_0_fbf/.test(span.raw))
  if (!firstFbfSpan) throw new Error('expected neutral timeline data to materialize a BottomPanel FBF span')
  const generatedFrameThumbnails = buildVideoSequenceGeneratedFrameThumbnails({ sourceWindow: null, span: firstFbfSpan })
  const generatedFrameSvg = decodeURIComponent(String(generatedFrameThumbnails[0]?.dataUrl || '').split(',').slice(1).join(','))
  if (
    generatedFrameThumbnails.length < 1
    || !String(generatedFrameThumbnails[0]?.dataUrl || '').startsWith('data:image/svg+xml')
    || !generatedFrameSvg.includes('generated-frame-thumbnail')
    || !generatedFrameSvg.includes('Frame-by-frame bbox')
  ) {
    throw new Error('expected BottomPanel FBF spans to produce image-backed frame thumbnails')
  }
  for (const track of pipelineFrameTimelineTracks) {
    if (!track.label.includes('Frame-by-frame bbox') || !Array.isArray(track.bbox) || track.durationMs <= 0) {
      throw new Error(`expected frame bounding box timeline track to preserve bbox and duration, got ${JSON.stringify(track)}`)
    }
  }
  for (const box of pipeline.frameBoundingBoxes) {
    if (box.bbox.length !== 4 || box.bbox.some(value => typeof value !== 'number' || value < 0 || value > 1)) {
      throw new Error(`expected normalized frame bounding box, got ${JSON.stringify(box)}`)
    }
    if (!box.evidence.startsWith('frame-') || box.confidence <= 0 || box.confidence > 1) {
      throw new Error(`expected frame bounding box evidence and confidence, got ${JSON.stringify(box)}`)
    }
  }
  for (const capability of ['search', 'edit', 'compile', 'generate', 'stream']) {
    const artifact = pipeline.reasoningArtifacts.find(entry => entry.capability === capability)
    if (!artifact?.decision || !artifact.outputArtifact.startsWith('video-agent/') || !artifact.streamSignal.endsWith('ready')) {
      throw new Error(`expected structured reasoning artifact for ${capability}`)
    }
  }
  if (pipeline.stream.primary !== 'video/mp4' || pipeline.stream.fallback !== 'outputSrcDoc' || pipeline.stream.panel !== 'RichMediaPanel') {
    throw new Error('expected stream output to route through RichMediaPanel with outputSrcDoc fallback')
  }
  for (const route of VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES) {
    if (!pipeline.stream.panels.includes(route)) {
      throw new Error(`expected stream output to name RichMediaPanel route ${route}`)
    }
  }
}

export function testVideoAgentPipelineCompilesRenderableSemanticHtmlSpec() {
  const result = buildVideoAgentPipeline({
    sourceUrl: neutralSourceUrl,
    requestedCapabilities: ['ingest', 'parse', 'search', 'edit', 'compile', 'generate', 'stream'],
  })
  if (result.ok === false) throw new Error(`expected valid video-agent pipeline, got ${result.reason}`)

  const validated = validateRenderSpec(result.pipeline.renderSpec)
  if (validated.ok === false) throw new Error(`expected renderable video-agent spec, got ${validated.reason}`)
  if (validated.spec.engineHint !== HTML_VIDEO_ENGINE_IDS.canvas2d) throw new Error('expected canvas-2d as native stream render path')
  for (const semanticTag of ['<main', '<header', '<section', '<article', '<figure', '<figcaption', '<ol', '<li', '<footer', '<output']) {
    if (!validated.spec.html.includes(semanticTag)) throw new Error(`expected semantic HTML tag ${semanticTag}`)
  }
  if (!validated.spec.html.includes('Video agent reasoning trace') || !validated.spec.html.includes('Instant stream')) {
    throw new Error('expected renderable spec to expose reasoning trace and instant stream surfaces')
  }
  if (!validated.spec.html.includes('Frame-by-frame bounding boxes') || !validated.spec.html.includes('frame-box')) {
    throw new Error('expected renderable spec to expose frame-by-frame bounding box overlays')
  }
  if (!String(validated.spec.css || '').includes('@keyframes')) {
    throw new Error('expected video-agent render spec to include runnable timeline keyframes')
  }
  const data = validated.spec.data as {
    referenceBoundary?: unknown
    schemaVersion?: unknown
    sourceVideo?: { url?: unknown; externalDependency?: unknown }
    reasoningArtifacts?: unknown
    frameBoundingBoxes?: unknown
    frameBoundingBoxTimelineTracks?: unknown
    visualDataset?: { samples?: unknown }
    datasetSplitSummary?: { total?: unknown }
    savedDatasetArtifact?: { text?: unknown; sampleCount?: unknown; annotationCount?: unknown }
    zoneCounting?: { frames?: unknown; totals?: Record<string, unknown> }
    timelineTracks?: unknown
    timelineLanes?: unknown
    bottomPanelTimelineSync?: { lane?: unknown; source?: unknown; surface?: unknown; thumbnailMode?: unknown; trackIds?: unknown }
    workspaceFiles?: unknown
    streaming?: { fallback?: unknown; panel?: unknown; panels?: unknown }
  }
  if (data.schemaVersion !== VIDEO_AGENT_SCHEMA_VERSION) throw new Error('expected render data to carry video-agent schema')
  if (data.sourceVideo?.url !== neutralSourceUrl || data.sourceVideo.externalDependency !== false) {
    throw new Error('expected render data to preserve source-owned video URL')
  }
  if (data.referenceBoundary !== VIDEO_AGENT_REFERENCE_BOUNDARY) {
    throw new Error('expected render data to preserve the native inspiration boundary')
  }
  if (!Array.isArray(data.timelineTracks) || data.timelineTracks.length < 12) {
    throw new Error('expected render data to expose all pipeline timeline tracks')
  }
  const frameTimelineTracks = data.timelineTracks.filter(entry => (
    String((entry as { source?: unknown }).source || '') === 'frameBoundingBox'
    && String((entry as { timelineLane?: unknown }).timelineLane || '') === 'fbf'
  ))
  if (frameTimelineTracks.length < 5) {
    throw new Error('expected render data to expose BottomPanel-synced frame-by-frame timeline tracks')
  }
  if (
    !Array.isArray(data.frameBoundingBoxTimelineTracks)
    || data.frameBoundingBoxTimelineTracks.length !== frameTimelineTracks.length
    || data.bottomPanelTimelineSync?.surface !== 'BottomPanel Timeline'
    || data.bottomPanelTimelineSync?.source !== 'frameBoundingBoxes'
    || data.bottomPanelTimelineSync?.lane !== 'fbf'
    || data.bottomPanelTimelineSync?.thumbnailMode !== 'frame-by-frame-image'
  ) {
    throw new Error('expected render data to expose BottomPanel Timeline sync for frame bounding boxes')
  }
  if (!Array.isArray(data.timelineLanes) || !data.timelineLanes.some(entry => String((entry as { label?: unknown }).label || '') === 'Frame-by-frame boxes')) {
    throw new Error('expected render data to route frame boxes through a frame-by-frame timeline lane')
  }
  if (!Array.isArray(data.reasoningArtifacts) || !data.reasoningArtifacts.some(entry => String((entry as { streamSignal?: unknown }).streamSignal || '') === 'stream-ready')) {
    throw new Error('expected render data to expose stream-ready reasoning artifacts')
  }
  if (!Array.isArray(data.frameBoundingBoxes) || !data.frameBoundingBoxes.some(entry => Array.isArray((entry as { bbox?: unknown }).bbox))) {
    throw new Error('expected render data to expose frame-by-frame bounding boxes')
  }
  if (
    !Array.isArray(data.visualDataset?.samples)
    || data.visualDataset.samples.length !== data.frameBoundingBoxes.length
    || data.datasetSplitSummary?.total !== data.frameBoundingBoxes.length
    || data.savedDatasetArtifact?.sampleCount !== data.frameBoundingBoxes.length
    || data.savedDatasetArtifact.annotationCount !== data.frameBoundingBoxes.length
    || typeof data.savedDatasetArtifact.text !== 'string'
    || !Array.isArray(data.zoneCounting?.frames)
    || data.zoneCounting.frames.length !== data.frameBoundingBoxes.length
  ) {
    throw new Error('expected render data to expose dataset load, split, save, and real-time zone-counting artifacts')
  }
  if (!Array.isArray(data.workspaceFiles) || !data.workspaceFiles.some(entry => String((entry as { role?: unknown }).role || '') === 'stream-output')) {
    throw new Error('expected render data to expose stream manifest workspace output')
  }
  for (const role of ['visual-annotation-dataset', 'real-time-zone-counting']) {
    if (!Array.isArray(data.workspaceFiles) || !data.workspaceFiles.some(entry => String((entry as { role?: unknown }).role || '') === role)) {
      throw new Error(`expected render data workspace files to expose ${role}`)
    }
  }
  if (data.streaming?.fallback !== 'outputSrcDoc' || data.streaming.panel !== 'RichMediaPanel') {
    throw new Error('expected render data to expose streamable RichMediaPanel fallback')
  }
  if (!Array.isArray(data.streaming?.panels)) {
    throw new Error('expected render data to expose RichMediaPanel routes')
  }
  for (const route of VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES) {
    if (!data.streaming.panels.includes(route)) {
      throw new Error(`expected render data to expose RichMediaPanel route ${route}`)
    }
  }
}

export function testVideoAgentPipelineProjectsProviderFrameImagesIntoFbfTimeline() {
  const result = buildVideoAgentPipeline({
    sourceUrl: providerBackedSourceUrl,
    requestedCapabilities: ['search', 'edit', 'compile', 'generate'],
  })
  if (result.ok === false) throw new Error(`expected provider-backed video-agent pipeline, got ${result.reason}`)
  const frameTimelineTracks = result.pipeline.timelineTracks.filter(track => track.source === 'frameBoundingBox' && track.timelineLane === 'fbf')
  if (!frameTimelineTracks.length) throw new Error('expected provider-backed FBF timeline tracks')
  if (!frameTimelineTracks.every(track => String(track.thumbnailUrl || '').startsWith('/__video_frame?'))) {
    throw new Error(`expected every provider-backed FBF track to carry a source frame endpoint, got ${JSON.stringify(frameTimelineTracks)}`)
  }
  const thirdFrameRequest = new URL(String(frameTimelineTracks[2]?.thumbnailUrl || ''), 'http://localhost')
  if (thirdFrameRequest.searchParams.get('time') !== '2.8') {
    throw new Error(`expected FBF source frame endpoint to preserve subsecond timeline position, got ${thirdFrameRequest.searchParams.get('time')}`)
  }
  const renderHtml = result.pipeline.renderSpec.html
  const renderCss = String(result.pipeline.renderSpec.css || '')
  const renderedFrameImages = renderHtml.match(/class="thumbnail-source"/g) || []
  if (
    renderedFrameImages.length !== frameTimelineTracks.length
    || !renderHtml.includes('/__video_frame?')
    || !renderHtml.includes("knowgrph:render-frame")
    || !renderHtml.includes('frameState(timeMs)')
    || !renderHtml.includes('updateFrameImage')
    || !renderHtml.includes('data-kg-video-agent-frame-url-template')
    || !renderHtml.includes('--kg-video-agent-progress')
    || !renderCss.includes('object-fit:contain')
    || renderHtml.includes('kgVideoAgentFrameBox')
  ) {
    throw new Error('expected video-agent Rich Media HTML to switch source frames and bounding boxes only from the shared timeline clock')
  }
  const renderDom = new JSDOM(`<!doctype html><html><body>${renderHtml}</body></html>`, {
    runScripts: 'dangerously',
    url: 'http://localhost',
  })
  const laterFrame = result.pipeline.frameBoundingBoxes[2]
  if (!laterFrame) throw new Error('expected a later provider frame for timeline sync validation')
  renderDom.window.dispatchEvent(new renderDom.window.CustomEvent('knowgrph:render-frame', {
    detail: { timeMs: laterFrame.timestampMs },
  }))
  const visibleFrameImages = Array.from(renderDom.window.document.querySelectorAll('.frame-images > li:not([hidden])')) as Element[]
  const visibleFrameBoxes = Array.from(renderDom.window.document.querySelectorAll('.frame-box:not([hidden])')) as Element[]
  if (
    visibleFrameImages.length !== 1
    || visibleFrameBoxes.length !== 1
    || visibleFrameImages[0]?.getAttribute('data-frame-index') !== String(laterFrame.frameIndex)
    || visibleFrameBoxes[0]?.getAttribute('data-frame-index') !== String(laterFrame.frameIndex)
  ) {
    throw new Error('expected the shared render-frame event to select the matching Rich Media frame image and bounding box')
  }
  renderDom.window.dispatchEvent(new renderDom.window.CustomEvent('knowgrph:render-frame', {
    detail: { timeMs: laterFrame.timestampMs + 400 },
  }))
  const segmentVisibleFrame = renderDom.window.document.querySelector('.frame-images > li:not([hidden])')
  const segmentVisibleBox = renderDom.window.document.querySelector('.frame-box:not([hidden])')
  if (
    segmentVisibleFrame?.getAttribute('data-frame-index') !== String(laterFrame.frameIndex)
    || segmentVisibleBox?.getAttribute('data-frame-index') !== String(laterFrame.frameIndex)
  ) {
    throw new Error('expected video-agent Rich Media frame selection to remain segment-accurate between FBF timestamps')
  }
  const interpolatedRenderedLeft = String((segmentVisibleBox as HTMLElement | null)?.style?.left || '')
  if (!interpolatedRenderedLeft || interpolatedRenderedLeft === '22%') {
    throw new Error(`expected video-agent Rich Media bounding box to interpolate inside the active FBF segment, got ${interpolatedRenderedLeft || '<empty>'}`)
  }
  const segmentVisibleImageSrc = String(segmentVisibleFrame?.querySelector('img')?.getAttribute('src') || '')
  if (!segmentVisibleImageSrc.includes('time=') || segmentVisibleImageSrc.includes('time=2.8')) {
    throw new Error(`expected video-agent Rich Media source frame image to track the live timeline bucket, got ${segmentVisibleImageSrc}`)
  }
  renderDom.window.close()

  const externalPanelSrcDoc = `<main><section class="thumbnail"><img class="thumbnail-source" src="${frameTimelineTracks[0]?.thumbnailUrl || ''}" alt=""><section class="frame-boxes"></section></section></main>`
  const projectedPanelSrcDoc = projectVideoAgentFrameAnalysisSrcDoc({
    frameBoundingBoxes: result.pipeline.frameBoundingBoxes,
    srcDoc: externalPanelSrcDoc,
  })
  const projectedDom = new JSDOM(`<!doctype html><html><body>${projectedPanelSrcDoc}</body></html>`, {
    runScripts: 'dangerously',
    url: 'http://localhost',
  })
  projectedDom.window.dispatchEvent(new projectedDom.window.CustomEvent('knowgrph:render-frame', {
    detail: { timeMs: laterFrame.timestampMs + 400 },
  }))
  const projectedImages = projectedDom.window.document.querySelectorAll('[data-kg-video-agent-frame-analysis] img')
  const projectedVisibleImage = projectedDom.window.document.querySelector('[data-kg-video-agent-frame-analysis] li:not([hidden])')
  const projectedVisibleBox = projectedDom.window.document.querySelector('[data-kg-video-agent-frame-analysis] mark:not([hidden])')
  const projectedRoot = projectedDom.window.document.querySelector('[data-kg-video-agent-frame-analysis]')
  if (
    projectedImages.length !== result.pipeline.frameBoundingBoxes.length
    || projectedVisibleImage?.getAttribute('data-kg-video-agent-frame') !== String(laterFrame.frameIndex)
    || projectedVisibleBox?.getAttribute('data-kg-video-agent-frame') !== String(laterFrame.frameIndex)
    || projectedRoot?.getAttribute('data-kg-video-agent-frame-state') !== String(laterFrame.frameIndex)
  ) {
    throw new Error('expected external Rich Media panel srcdoc to reuse the shared frame-analysis projection and timeline clock')
  }
  const projectedVisibleBoxLeft = String((projectedVisibleBox as HTMLElement | null)?.style?.left || '')
  if (!projectedVisibleBoxLeft || projectedVisibleBoxLeft === '22%') {
    throw new Error(`expected projected Rich Media bounding box to interpolate inside the active FBF segment, got ${projectedVisibleBoxLeft || '<empty>'}`)
  }
  const projectedVisibleImageSrc = String(projectedVisibleImage?.querySelector('img')?.getAttribute('src') || '')
  if (!projectedVisibleImageSrc.includes('time=') || projectedVisibleImageSrc.includes('time=2.8')) {
    throw new Error(`expected projected Rich Media source frame image to follow the live timeline bucket, got ${projectedVisibleImageSrc}`)
  }
  projectedDom.window.close()

  const routeSpecificSpec = getNodeMediaSpec({
    id: 'route-specific-frame-analysis',
    type: 'RichMediaPanel',
    label: 'Video Agent Frame Analysis',
    kind: { key: 'kind', type: 'string', value: 'video-agent-frame-analysis' },
    srcDoc: { key: 'srcDoc', type: 'string', value: externalPanelSrcDoc },
    properties: {
      outputSrcDoc: renderHtml,
      frameBoundingBoxes: JSON.stringify(result.pipeline.frameBoundingBoxes),
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0])
  const routeSpecificSrcDoc = String(routeSpecificSpec && 'srcDoc' in routeSpecificSpec ? routeSpecificSpec.srcDoc || '' : '')
  if (
    !routeSpecificSpec
    || routeSpecificSpec.kind !== 'iframe'
    || !routeSpecificSrcDoc.includes('data-kg-video-agent-frame-analysis')
    || routeSpecificSrcDoc.includes('Reason through video, then stream the result')
  ) {
    throw new Error('expected Rich Media panel media spec to preserve route-specific authored srcDoc instead of collapsing to connected outputSrcDoc')
  }
  const streamArtifactSpec = getNodeMediaSpec({
    id: 'stream-artifact-panel',
    type: 'RichMediaPanel',
    label: 'Rendered MP4 Artifact',
    srcDoc: { key: 'srcDoc', type: 'string', value: externalPanelSrcDoc },
    properties: {
      outputSrcDoc: renderHtml,
      frameBoundingBoxes: JSON.stringify(result.pipeline.frameBoundingBoxes),
    },
  } as unknown as Parameters<typeof getNodeMediaSpec>[0])
  const streamArtifactSrcDoc = String(streamArtifactSpec && 'srcDoc' in streamArtifactSpec ? streamArtifactSpec.srcDoc || '' : '')
  if (
    !streamArtifactSpec
    || streamArtifactSpec.kind !== 'iframe'
    || !streamArtifactSrcDoc.includes('Reason through video, then stream the result')
    || streamArtifactSrcDoc.includes('data-kg-video-agent-frame-analysis')
  ) {
    throw new Error('expected Rendered MP4 Artifact Rich Media panel to keep connected stream output instead of reusing analysis srcDoc')
  }

  const bridgedPanelSrcDoc = normalizeRichMediaPanelInlineSrcDoc({
    srcDoc: projectedPanelSrcDoc,
    title: 'Video Agent Frame Analysis',
  })
  const bridgedDom = new JSDOM(bridgedPanelSrcDoc, {
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    url: 'http://localhost',
  })
  bridgedDom.window.dispatchEvent(new bridgedDom.window.MessageEvent('message', {
    data: {
      type: RICH_MEDIA_TIMELINE_TRANSPORT_FRAME_MESSAGE,
      timeMs: laterFrame.timestampMs + 400,
      playbackRate: 1,
      playing: false,
    },
  }))
  const bridgedVisibleImage = bridgedDom.window.document.querySelector('[data-kg-video-agent-frame-analysis] li:not([hidden])')
  const bridgedVisibleBox = bridgedDom.window.document.querySelector('[data-kg-video-agent-frame-analysis] mark:not([hidden])')
  if (
    bridgedVisibleImage?.getAttribute('data-kg-video-agent-frame') !== String(laterFrame.frameIndex)
    || bridgedVisibleBox?.getAttribute('data-kg-video-agent-frame') !== String(laterFrame.frameIndex)
  ) {
    throw new Error('expected Rich Media panel timeline bridge to drive projected frame images and bounding boxes without a custom renderer')
  }
  bridgedDom.window.close()

  const renderData = result.pipeline.renderSpec.data as { sourceVideo?: unknown; timelineTracks?: unknown; timelineLanes?: unknown }
  const fbfTimelineCode = buildMermaidGanttCodeFromNeutralTimelinePayload(renderData)
  if (!fbfTimelineCode.includes('kgthumb_')) {
    throw new Error(`expected provider-backed neutral timeline to carry source-frame thumbnail metadata, got ${fbfTimelineCode}`)
  }
  const fbfTimelineModel = buildMermaidGanttTimelineModel(fbfTimelineCode)
  const firstFbfSpan = fbfTimelineModel.taskSpans.find(span => /frame_box_0_fbf/.test(span.raw))
  if (!firstFbfSpan) throw new Error('expected provider-backed neutral timeline to materialize an FBF span')
  const sourceFrameThumbnails = buildVideoSequenceGeneratedFrameThumbnails({ sourceWindow: null, span: firstFbfSpan })
  if (
    sourceFrameThumbnails.length !== 1
    || !String(sourceFrameThumbnails[0]?.dataUrl || '').startsWith('/__video_frame?')
    || sourceFrameThumbnails[0]?.format !== 'png'
  ) {
    throw new Error(`expected FBF thumbnail strip to use the source frame endpoint, got ${JSON.stringify(sourceFrameThumbnails)}`)
  }
}

export function testVideoAgentPipelineRejectsInvalidInputsAndAvoidsExternalDependencyImports() {
  const missingSource = buildVideoAgentPipeline({ sourceUrl: '' })
  if (missingSource.ok !== false || missingSource.errorCode !== 'invalid_source') {
    throw new Error('expected missing video-agent source URL to fail before parsing or rendering')
  }
  const badCapability = buildVideoAgentPipeline({
    sourceUrl: neutralSourceUrl,
    requestedCapabilities: ['ingest', 'external_editor'],
  })
  if (badCapability.ok !== false || badCapability.errorCode !== 'invalid_capability') {
    throw new Error('expected unsupported video-agent capability to fail with a structured error')
  }

  const sourceText = readFileSync(resolve(process.cwd(), 'src', 'features', 'video-agent', 'videoAgentPipeline.ts'), 'utf8')
  for (const forbidden of ['video-db', 'VideoDB', '@video-db', 'Director(', 'VIDEODB_API_KEY']) {
    if (sourceText.includes(forbidden)) throw new Error(`video-agent pipeline must not import or depend on ${forbidden}`)
  }
  if (!sourceText.includes('VIDEO_AGENT_REFERENCE_BOUNDARY')) {
    throw new Error('expected video-agent pipeline to expose one native reference boundary owner')
  }
}
