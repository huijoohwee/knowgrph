import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import {
  VIDEO_AGENT_REFERENCE_BOUNDARY,
  VIDEO_AGENT_SCHEMA_VERSION,
  VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES,
  buildVideoAgentDatasetPanelSrcDoc,
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
import {
  assertProviderBackedTimelineFrameSamples,
  assertProviderFrameSampleToken,
  assertProviderFrameThumbnails,
} from './helpers/videoAgentTimelineFrameSamples'

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
  for (const capability of ['ingest', 'parse', 'annotate', 'dataset', 'zone_count', 'search', 'edit', 'compile', 'generate', 'stream']) {
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
  if (!pipeline.stages.some(stage => stage.capability === 'annotate' && stage.output.includes('bounding boxes'))) {
    throw new Error('expected annotation stage to produce frame-by-frame bounding boxes')
  }
  if (!pipeline.stages.some(stage => stage.capability === 'dataset' && stage.output.includes('saved visual annotation dataset'))) {
    throw new Error('expected dataset stage to load, split, merge, and save annotations')
  }
  if (!pipeline.stages.some(stage => stage.capability === 'zone_count' && stage.output.includes('zone counting'))) {
    throw new Error('expected zone-counting stage to produce a real-time counting timeline')
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
  if (!Array.isArray(pipeline.frameBoundingBoxes) || pipeline.frameBoundingBoxes.length < 8) {
    throw new Error('expected granular frame-by-frame bounding boxes for video reasoning')
  }
  const expectedDetectionCount = pipeline.frameBoundingBoxes.reduce((total, box) => (
    total + Math.max(1, box.detections.length)
  ), 0)
  if (expectedDetectionCount < pipeline.frameBoundingBoxes.length * 2) {
    throw new Error('expected multi-object frame detections for every video-agent frame')
  }
  if (
    pipeline.datasetRuntime.visualDataset.samples.length !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.mergedVisualDataset.samples.length !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.savedDatasetArtifact.sampleCount !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.savedDatasetArtifact.annotationCount !== expectedDetectionCount
    || pipeline.datasetRuntime.datasetSplitSummary.total !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.datasetOperationSummary.loadedSamples !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.datasetOperationSummary.mergedSamples !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.datasetOperationSummary.savedSamples !== pipeline.frameBoundingBoxes.length
    || pipeline.datasetRuntime.zoneCounting.frames.length !== pipeline.frameBoundingBoxes.length
  ) {
    throw new Error(`expected video-agent frame boxes to load/split/merge/save/count as one visual dataset, got ${JSON.stringify(pipeline.datasetRuntime)}`)
  }
  const savedDataset = JSON.parse(pipeline.datasetRuntime.savedDatasetArtifact.text) as { datasetId?: unknown; samples?: unknown }
  if (
    savedDataset.datasetId !== pipeline.datasetRuntime.mergedVisualDataset.datasetId
    || !Array.isArray(savedDataset.samples)
    || savedDataset.samples.length !== pipeline.frameBoundingBoxes.length
  ) {
    throw new Error('expected saved visual dataset artifact to contain the merged frame annotation samples')
  }
  const zoneHitTotal = Object.values(pipeline.datasetRuntime.zoneCounting.totals).reduce((sum, count) => sum + Number(count), 0)
  if (zoneHitTotal !== expectedDetectionCount) {
    throw new Error(`expected real-time zone counts to account for every frame detection, got ${zoneHitTotal}`)
  }
  const datasetPanelSrcDoc = buildVideoAgentDatasetPanelSrcDoc(pipeline.datasetRuntime)
  for (const token of [
    'data-kg-video-agent-dataset-panel',
    'Load, split, merge, save',
    'Real-time zone counting',
    'knowgrph:render-frame',
  ]) {
    if (!datasetPanelSrcDoc.includes(token)) {
      throw new Error(`expected dataset Rich Media projection to expose ${token}`)
    }
  }
  const datasetPanelDom = new JSDOM(datasetPanelSrcDoc, { runScripts: 'dangerously', url: 'http://localhost' })
  const targetFrame = pipeline.datasetRuntime.zoneCounting.frames[2]
  datasetPanelDom.window.dispatchEvent(new datasetPanelDom.window.CustomEvent('knowgrph:render-frame', {
    detail: { timeMs: targetFrame?.timestampMs || 0 },
  }))
  const datasetPanelRoot = datasetPanelDom.window.document.querySelector('[data-kg-video-agent-dataset-panel]')
  if (datasetPanelRoot?.getAttribute('data-kg-video-agent-active-frame') !== String(targetFrame?.frameIndex)) {
    throw new Error('expected dataset Rich Media projection to follow the shared frame clock')
  }
  datasetPanelDom.window.close()
  const pipelineFrameTimelineTracks = pipeline.timelineTracks.filter(track => track.source === 'frameBoundingBox' && track.timelineLane === 'fbf')
  if (pipelineFrameTimelineTracks.length !== 1 || pipelineFrameTimelineTracks[0]?.frameSampleCount !== pipeline.frameBoundingBoxes.length) {
    throw new Error('expected BottomPanel FBF timeline to keep one compact media track backed by granular frame boxes')
  }
  const fbfTimelineCode = buildMermaidGanttCodeFromNeutralTimelinePayload({
    title: 'Video Sequence',
    timelineTracks: pipeline.timelineTracks,
    timelineLanes: [
      { id: 'video-agent-stages', label: 'Video agent stages', tracks: pipeline.timelineTracks.filter(track => track.timelineLane === 'video').map(track => track.id) },
      { id: 'frame-by-frame-boxes', label: 'Frame-by-frame boxes', tracks: pipelineFrameTimelineTracks.map(track => track.id) },
      { id: 'source-audio', label: 'Source audio', tracks: pipeline.timelineTracks.filter(track => track.timelineLane === 'audio').map(track => track.id) },
    ],
  })
  const fbfTimelineModel = buildMermaidGanttTimelineModel(fbfTimelineCode)
  const firstFbfSpan = fbfTimelineModel.taskSpans.find(span => /video_agent_frame_by_frame_boxes/.test(span.raw))
  if (!firstFbfSpan) throw new Error('expected neutral timeline data to materialize a BottomPanel FBF span')
  const generatedFrameThumbnails = buildVideoSequenceGeneratedFrameThumbnails({ sourceWindow: null, span: firstFbfSpan })
  const generatedFrameSvg = decodeURIComponent(String(generatedFrameThumbnails[0]?.dataUrl || '').split(',').slice(1).join(','))
  if (
    generatedFrameThumbnails.length < 1
    || !String(generatedFrameThumbnails[0]?.dataUrl || '').startsWith('data:image/svg+xml')
    || !generatedFrameSvg.includes('generated-frame-thumbnail')
    || !generatedFrameSvg.includes('Frame-by-frame annotation samples')
  ) {
    throw new Error('expected BottomPanel FBF spans to produce native semantic frame samples')
  }
  for (const track of pipelineFrameTimelineTracks) {
    if (!track.label.includes('Frame-by-frame annotation samples') || !Array.isArray(track.bbox) || track.durationMs !== pipeline.renderSpec.durationMs) {
      throw new Error(`expected compact frame bounding box timeline track to preserve bbox and source duration, got ${JSON.stringify(track)}`)
    }
  }
  for (const box of pipeline.frameBoundingBoxes) {
    if (box.bbox.length !== 4 || box.bbox.some(value => typeof value !== 'number' || value < 0 || value > 1)) {
      throw new Error(`expected normalized frame bounding box, got ${JSON.stringify(box)}`)
    }
    if (box.detections.length < 2 || box.detections.some(detection => detection.bbox.length !== 4)) {
      throw new Error(`expected every frame to expose multi-object detections, got ${JSON.stringify(box)}`)
    }
    if (!box.evidence.startsWith('frame-') || box.confidence <= 0 || box.confidence > 1) {
      throw new Error(`expected frame bounding box evidence and confidence, got ${JSON.stringify(box)}`)
    }
  }
  const firstFrameBox = pipeline.frameBoundingBoxes[0]?.bbox
  if (!firstFrameBox || firstFrameBox[1] < 0.35 || firstFrameBox[3] < 0.2) {
    throw new Error(`expected first frame bbox seed to target lower-frame subject content, got ${JSON.stringify(firstFrameBox)}`)
  }
  for (const capability of ['annotate', 'dataset', 'zone_count', 'search', 'edit', 'compile', 'generate', 'stream']) {
    const artifact = pipeline.reasoningArtifacts.find(entry => entry.capability === capability)
    if (!artifact?.decision || !artifact.outputArtifact.startsWith('/docs_/video-agent/') || !artifact.streamSignal.endsWith('ready')) {
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
  for (const htmlToken of [
    'Granular frame-by-frame dataset strip',
    'Audio-capable source video playback',
    'data-kg-video-agent-source-playback',
    'Rich Media panel routes',
    'Real-time zone counts',
    'data-kg-video-agent-frame-strip-index',
    'data-kg-video-agent-zone-frame',
  ]) {
    if (!validated.spec.html.includes(htmlToken)) throw new Error(`expected renderable spec to expose ${htmlToken}`)
  }
  if (!String(validated.spec.css || '').includes('@keyframes')) {
    throw new Error('expected video-agent render spec to include runnable timeline keyframes')
  }
  const data = validated.spec.data as {
    referenceBoundary?: unknown
    schemaVersion?: unknown
    sourceVideo?: { url?: unknown; externalDependency?: unknown; playbackEmbedUrl?: unknown }
    reasoningArtifacts?: unknown
    frameBoundingBoxes?: unknown
    frameByFrameSamples?: unknown
    frameBoundingBoxTimelineTracks?: unknown
    richMediaPanels?: unknown
    visualAnnotationE2E?: { steps?: unknown; runtimeDependency?: unknown; implementation?: unknown }
    datasetOperationSummary?: { loadedSamples?: unknown; mergedSamples?: unknown; savedSamples?: unknown; zoneCountedFrames?: unknown }
    visualDataset?: { samples?: unknown }
    mergedVisualDataset?: { samples?: unknown }
    datasetSplitSummary?: { total?: unknown }
    savedDatasetArtifact?: { text?: unknown; sampleCount?: unknown; annotationCount?: unknown }
    zoneCounting?: { frames?: unknown; totals?: Record<string, unknown> }
    timelineTracks?: unknown
    timelineLanes?: unknown
    bottomPanelTimelineSync?: { lane?: unknown; source?: unknown; surface?: unknown; thumbnailMode?: unknown; trackIds?: unknown }
    workspaceFiles?: Array<{ path?: unknown; role?: unknown }>
    workspaceOutputRoot?: unknown
    streaming?: { fallback?: unknown; panel?: unknown; panels?: unknown }
  }
  if (data.schemaVersion !== VIDEO_AGENT_SCHEMA_VERSION) throw new Error('expected render data to carry video-agent schema')
  if (data.sourceVideo?.url !== neutralSourceUrl || data.sourceVideo.externalDependency !== false) {
    throw new Error('expected render data to preserve source-owned video URL')
  }
  if (data.sourceVideo.playbackEmbedUrl !== neutralSourceUrl) {
    throw new Error('expected render data to expose audio-capable source playback embed URL')
  }
  if (data.referenceBoundary !== VIDEO_AGENT_REFERENCE_BOUNDARY) {
    throw new Error('expected render data to preserve the native inspiration boundary')
  }
  if (!Array.isArray(data.timelineTracks) || data.timelineTracks.length !== 3) {
    throw new Error('expected render data to expose compact media timeline tracks')
  }
  const frameTimelineTracks = data.timelineTracks.filter(entry => (
    String((entry as { source?: unknown }).source || '') === 'frameBoundingBox'
    && String((entry as { timelineLane?: unknown }).timelineLane || '') === 'fbf'
  ))
  if (frameTimelineTracks.length !== 1) {
    throw new Error('expected render data to expose one BottomPanel-synced frame-by-frame media track')
  }
  if (
    !Array.isArray(data.frameBoundingBoxTimelineTracks)
    || data.frameBoundingBoxTimelineTracks.length !== 1
    || data.bottomPanelTimelineSync?.surface !== 'BottomPanel Timeline'
    || data.bottomPanelTimelineSync?.source !== 'video+frameBoundingBoxes+audio'
    || data.bottomPanelTimelineSync?.lane !== 'video-fbf-audio'
    || data.bottomPanelTimelineSync?.thumbnailMode !== 'semantic-frame-samples'
  ) {
    throw new Error('expected render data to expose BottomPanel Timeline sync for video, FBF, and audio tracks')
  }
  if (
    !Array.isArray(data.timelineLanes)
    || !data.timelineLanes.some(entry => String((entry as { label?: unknown }).label || '') === 'Frame-by-frame boxes')
    || !data.timelineLanes.some(entry => String((entry as { label?: unknown }).label || '') === 'Source audio')
  ) {
    throw new Error('expected render data to route frame boxes and source audio through BottomPanel Timeline lanes')
  }
  if (!Array.isArray(data.reasoningArtifacts) || !data.reasoningArtifacts.some(entry => String((entry as { streamSignal?: unknown }).streamSignal || '') === 'stream-ready')) {
    throw new Error('expected render data to expose stream-ready reasoning artifacts')
  }
  if (!Array.isArray(data.frameBoundingBoxes) || !data.frameBoundingBoxes.some(entry => Array.isArray((entry as { bbox?: unknown }).bbox))) {
    throw new Error('expected render data to expose frame-by-frame bounding boxes')
  }
  const frameBoundingBoxRecords = data.frameBoundingBoxes as Array<{ detections?: unknown }>
  const frameBoundingBoxCount = frameBoundingBoxRecords.length
  const expectedDetectionCount = frameBoundingBoxRecords.reduce((total, box) => (
    total + Math.max(1, Array.isArray(box.detections) ? box.detections.length : 0)
  ), 0)
  if (expectedDetectionCount < frameBoundingBoxCount * 2) {
    throw new Error('expected render data to expose multi-object detections per frame')
  }
  if (!Array.isArray(data.frameByFrameSamples) || data.frameByFrameSamples.length !== frameBoundingBoxCount) {
    throw new Error('expected render data to expose one frame-by-frame dataset sample per bounding box')
  }
  if (
    !data.frameByFrameSamples.some(entry => (
      String((entry as { sampleId?: unknown }).sampleId || '').trim().length > 0
      && Number((entry as { annotationCount?: unknown }).annotationCount || 0) > 0
      && typeof (entry as { cumulativeZoneCounts?: unknown }).cumulativeZoneCounts === 'object'
    ))
  ) {
    throw new Error('expected frame-by-frame samples to preserve sample ids, annotation counts, and cumulative zone counts')
  }
  if (!Array.isArray(data.richMediaPanels) || data.richMediaPanels.length !== VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES.length) {
    throw new Error('expected render data to expose every Rich Media panel route')
  }
  for (const route of VIDEO_AGENT_RICH_MEDIA_PANEL_ROUTES) {
    if (!data.richMediaPanels.some(entry => (
      String((entry as { route?: unknown }).route || '') === route
      && String((entry as { timelineSync?: unknown }).timelineSync || '') === 'knowgrph:render-frame'
    ))) {
      throw new Error(`expected Rich Media panel route ${route} to reuse the shared render-frame timeline clock`)
    }
  }
  const visualAnnotationE2ESteps = Array.isArray(data.visualAnnotationE2E?.steps) ? data.visualAnnotationE2E.steps : []
  if (
    data.visualAnnotationE2E?.implementation !== 'native-knowgrph'
    || data.visualAnnotationE2E.runtimeDependency !== false
    || visualAnnotationE2ESteps.length === 0
    || !['load', 'annotate', 'split', 'merge', 'save', 'zone_count'].every(step => visualAnnotationE2ESteps.some(entry => String((entry as { id?: unknown }).id || '') === step))
  ) {
    throw new Error('expected render data to expose the native visual annotation E2E load/annotate/split/merge/save/zone-counting contract')
  }
  if (
    !Array.isArray(data.visualDataset?.samples)
    || data.visualDataset.samples.length !== frameBoundingBoxCount
    || !Array.isArray(data.mergedVisualDataset?.samples)
    || data.mergedVisualDataset.samples.length !== frameBoundingBoxCount
    || data.datasetSplitSummary?.total !== frameBoundingBoxCount
    || data.datasetOperationSummary?.loadedSamples !== frameBoundingBoxCount
    || data.datasetOperationSummary?.mergedSamples !== frameBoundingBoxCount
    || data.datasetOperationSummary?.savedSamples !== frameBoundingBoxCount
    || data.datasetOperationSummary?.zoneCountedFrames !== frameBoundingBoxCount
    || data.savedDatasetArtifact?.sampleCount !== frameBoundingBoxCount
    || data.savedDatasetArtifact.annotationCount !== expectedDetectionCount
    || typeof data.savedDatasetArtifact.text !== 'string'
    || !Array.isArray(data.zoneCounting?.frames)
    || data.zoneCounting.frames.length !== frameBoundingBoxCount
  ) {
    throw new Error('expected render data to expose dataset load, split, merge, save, and real-time zone-counting artifacts')
  }
  const workspaceFiles = Array.isArray(data.workspaceFiles) ? data.workspaceFiles : []
  if (data.workspaceOutputRoot !== '/docs_/video-agent' || !workspaceFiles.some(entry => String(entry.role || '') === 'stream-output') || !workspaceFiles.every(entry => String(entry.path || '').startsWith('/docs_/video-agent/'))) {
    throw new Error('expected render data to expose stream manifest workspace output under /docs_/video-agent')
  }
  for (const role of ['dataset-operation-summary', 'visual-annotation-dataset', 'real-time-zone-counting']) {
    if (!workspaceFiles.some(entry => String(entry.role || '') === role)) {
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

export function testVideoAgentPipelineProjectsProviderFrameImagesIntoFrameAnalysis() {
  const result = buildVideoAgentPipeline({
    sourceUrl: providerBackedSourceUrl,
    requestedCapabilities: ['search', 'edit', 'compile', 'generate'],
  })
  if (result.ok === false) throw new Error(`expected provider-backed video-agent pipeline, got ${result.reason}`)
  const frameTimelineTracks = result.pipeline.timelineTracks.filter(track => track.source === 'frameBoundingBox' && track.timelineLane === 'fbf')
  if (frameTimelineTracks.length !== 1) throw new Error('expected provider-backed compact FBF timeline track')
  assertProviderBackedTimelineFrameSamples(frameTimelineTracks)
  const renderHtml = result.pipeline.renderSpec.html
  const renderCss = String(result.pipeline.renderSpec.css || '')
  const renderedFrameImages = renderHtml.match(/class="thumbnail-source"/g) || []
  if (
    renderedFrameImages.length !== result.pipeline.frameBoundingBoxes.length
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
  const firstFrameImageUrl = String(result.pipeline.frameBoundingBoxes[0]?.frameImageUrl || '')
  if (!firstFrameImageUrl.startsWith('/__video_frame?')) {
    throw new Error(`expected Rich Media frame analysis data to keep source frame endpoints, got ${firstFrameImageUrl || '<empty>'}`)
  }
  const firstFrameRequest = new URL(firstFrameImageUrl, 'http://localhost')
  const expectedFirstFrameTime = firstFrameRequest.searchParams.get('time') || '0'
  renderDom.window.dispatchEvent(new renderDom.window.CustomEvent('knowgrph:render-frame', {
    detail: { timeMs: laterFrame.timestampMs },
  }))
  const visibleFrameImages = Array.from(renderDom.window.document.querySelectorAll('.frame-images > li:not([hidden])')) as Element[]
  const visibleFrameBoxes = Array.from(renderDom.window.document.querySelectorAll('.frame-box:not([hidden])')) as Element[]
  if (
    visibleFrameImages.length !== 1
    || visibleFrameBoxes.length < 2
    || visibleFrameImages[0]?.getAttribute('data-frame-index') !== String(laterFrame.frameIndex)
    || visibleFrameBoxes[0]?.getAttribute('data-frame-index') !== String(laterFrame.frameIndex)
  ) {
    throw new Error('expected the shared render-frame event to select the matching Rich Media frame image and multi-object bounding boxes')
  }
  const activeStripItem = renderDom.window.document.querySelector('[data-kg-video-agent-frame-strip-index][data-active="1"]')
  const activeZoneFrame = renderDom.window.document.querySelector('[data-kg-video-agent-zone-frame]:not([hidden])')
  if (
    activeStripItem?.getAttribute('data-kg-video-agent-frame-strip-index') !== String(laterFrame.frameIndex)
    || activeZoneFrame?.getAttribute('data-kg-video-agent-zone-frame') !== String(laterFrame.frameIndex)
  ) {
    throw new Error('expected the shared render-frame event to sync frame strip and real-time zone-count rows')
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
  if (!segmentVisibleImageSrc.includes('time=') || segmentVisibleImageSrc.includes(`time=${expectedFirstFrameTime}`)) {
    throw new Error(`expected video-agent Rich Media source frame image to track the live timeline bucket, got ${segmentVisibleImageSrc}`)
  }
  renderDom.window.close()

  const externalPanelSrcDoc = `<main><section class="thumbnail"><img class="thumbnail-source" src="${firstFrameImageUrl}" alt=""><section class="frame-boxes"></section></section></main>`
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
  const projectedVisibleBoxes = projectedDom.window.document.querySelectorAll('[data-kg-video-agent-frame-analysis] mark:not([hidden])')
  const projectedRoot = projectedDom.window.document.querySelector('[data-kg-video-agent-frame-analysis]')
  if (
    projectedImages.length !== result.pipeline.frameBoundingBoxes.length
    || projectedVisibleImage?.getAttribute('data-kg-video-agent-frame') !== String(laterFrame.frameIndex)
    || projectedVisibleBox?.getAttribute('data-kg-video-agent-frame') !== String(laterFrame.frameIndex)
    || projectedRoot?.getAttribute('data-kg-video-agent-frame-state') !== String(laterFrame.frameIndex)
  ) {
    throw new Error('expected external Rich Media panel srcdoc to reuse the shared frame-analysis projection and timeline clock')
  }
  if (projectedVisibleBoxes.length < 2) {
    throw new Error('expected projected Rich Media panel to render multi-object boxes for the active frame')
  }
  const projectedVisibleBoxLeft = String((projectedVisibleBox as HTMLElement | null)?.style?.left || '')
  if (!projectedVisibleBoxLeft || projectedVisibleBoxLeft === '22%') {
    throw new Error(`expected projected Rich Media bounding box to interpolate inside the active FBF segment, got ${projectedVisibleBoxLeft || '<empty>'}`)
  }
  const projectedVisibleImageSrc = String(projectedVisibleImage?.querySelector('img')?.getAttribute('src') || '')
  if (!projectedVisibleImageSrc.includes('time=') || projectedVisibleImageSrc.includes(`time=${expectedFirstFrameTime}`)) {
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
  if (!fbfTimelineCode.includes('kgframes_') || fbfTimelineCode.includes('kgthumb_')) {
    throw new Error(`expected provider-backed compact FBF transport to carry bounded frame samples without single-thumbnail metadata, got ${fbfTimelineCode}`)
  }
  const fbfTimelineModel = buildMermaidGanttTimelineModel(fbfTimelineCode)
  const firstFbfSpan = fbfTimelineModel.taskSpans.find(span => /video_agent_frame_by_frame_boxes/.test(span.raw))
  if (!firstFbfSpan) throw new Error('expected provider-backed neutral timeline to materialize an FBF span')
  assertProviderFrameSampleToken(firstFbfSpan.raw)
  const generatedFrameThumbnails = buildVideoSequenceGeneratedFrameThumbnails({ sourceWindow: null, span: firstFbfSpan })
  assertProviderFrameThumbnails(generatedFrameThumbnails)
}

export function testVideoAgentPipelineRejectsInvalidInputsAndAvoidsExternalDependencyImports() {
  const missingSource = buildVideoAgentPipeline({ sourceUrl: '' })
  if (missingSource.ok !== false || missingSource.errorCode !== 'invalid_source') {
    throw new Error('expected missing video-agent source URL to fail before parsing or rendering')
  }
  const badCapability = buildVideoAgentPipeline({ sourceUrl: neutralSourceUrl, requestedCapabilities: ['ingest', 'external_editor'] })
  if (badCapability.ok !== false || badCapability.errorCode !== 'invalid_capability') {
    throw new Error('expected unsupported video-agent capability to fail with a structured error')
  }

  const sourceText = readFileSync(resolve(process.cwd(), 'src', 'features', 'video-agent', 'videoAgentPipeline.ts'), 'utf8')
  for (const forbidden of ['video-db', 'VideoDB', '@video-db', 'Director(', 'VIDEODB_API_KEY', 'roboflow', 'supervision']) {
    if (sourceText.includes(forbidden)) throw new Error(`video-agent pipeline must not import or depend on ${forbidden}`)
  }
  if (!sourceText.includes('VIDEO_AGENT_REFERENCE_BOUNDARY')) throw new Error('expected video-agent pipeline to expose one native reference boundary owner')
}
