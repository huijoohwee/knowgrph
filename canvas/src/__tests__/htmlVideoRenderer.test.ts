import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  HTML_VIDEO_ENGINE_IDS,
  KNOWGRPH_HTML_VIDEO_ENGINE,
  buildHtmlVideoRendererRegistryDraft,
  buildRenderJobId,
  createHtmlVideoEngineRegistry,
  createHtmlVideoEngineRegistryFromRuntimeConfig,
  resolveHtmlVideoEngine,
  runHtmlVideoRenderJob,
  validateRenderSpec,
  type RenderEngine,
  type RenderSpec,
} from '@/features/html-video-renderer'
import {
  FLOW_HTML_VIDEO_RENDERER_FORM_ID,
  FLOW_HTML_VIDEO_RENDERER_NODE_LABEL,
  FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID,
  FLOW_HTML_VIDEO_RENDERER_WIDGET_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { buildCanonicalWidgetRegistryDraft, getWidgetRegistryEntryLabel } from '@/features/flow-editor-manager/registryTemplates'
import { isRichMediaVideoOutputTargetNode, resolveRichMediaWidgetKind } from '@/features/chat/richMediaRun'
import { buildHtmlVideoPreviewSrcDocFromNode } from '@/features/html-video-renderer/htmlVideoFlowNode'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'

const validSpec = (): RenderSpec => ({
  html: '<main><h1>Quarterly Update</h1></main>',
  css: 'main { color: black; }',
  data: { b: 2, a: { nested: true } },
  durationMs: 3000,
  fps: 30,
  width: 1280,
  height: 720,
})

const mockEngine = (engineId: string): RenderEngine => ({
  engineId,
  async render(spec) {
    return {
      blob: new Blob([`mp4:${engineId}:${spec.html}`], { type: 'video/mp4' }),
      engineId,
      durationMs: spec.durationMs,
      fps: spec.fps,
      width: spec.width,
      height: spec.height,
    }
  },
})

export function testHtmlVideoRendererValidatesSpecAndRejectsInvalidInput() {
  const ok = validateRenderSpec(validSpec())
  if (ok.ok === false) throw new Error(`expected valid spec, got ${ok.reason}`)
  if (ok.spec.html !== validSpec().html || ok.spec.fps !== 30) throw new Error('expected validator to preserve input fields')

  for (const candidate of [
    { ...validSpec(), html: '   ' },
    { ...validSpec(), durationMs: 0 },
    { ...validSpec(), fps: 121 },
    { ...validSpec(), width: 7681 },
    { ...validSpec(), height: 4321 },
    { ...validSpec(), engineHint: 'x'.repeat(256) },
  ]) {
    const result = validateRenderSpec(candidate)
    if (result.ok === true) throw new Error(`expected invalid spec for ${JSON.stringify(candidate)}`)
  }
}

export function testHtmlVideoEngineResolverReadsEnvAtInvocationAndHonorsHint() {
  const previous = process.env[KNOWGRPH_HTML_VIDEO_ENGINE]
  try {
    const registry = createHtmlVideoEngineRegistry([
      mockEngine(HTML_VIDEO_ENGINE_IDS.headlessBrowser),
      mockEngine(HTML_VIDEO_ENGINE_IDS.canvas2d),
    ])
    delete process.env[KNOWGRPH_HTML_VIDEO_ENGINE]
    const missing = resolveHtmlVideoEngine(registry)
    if (missing.ok === true || missing.errorCode !== 'engine_not_configured') throw new Error('expected missing env to fail')

    process.env[KNOWGRPH_HTML_VIDEO_ENGINE] = HTML_VIDEO_ENGINE_IDS.headlessBrowser
    const fromEnv = resolveHtmlVideoEngine(registry)
    if (!fromEnv.ok || fromEnv.engine.engineId !== HTML_VIDEO_ENGINE_IDS.headlessBrowser) throw new Error('expected env-selected engine')

    process.env[KNOWGRPH_HTML_VIDEO_ENGINE] = HTML_VIDEO_ENGINE_IDS.headlessBrowser
    const fromHint = resolveHtmlVideoEngine(registry, HTML_VIDEO_ENGINE_IDS.canvas2d)
    if (!fromHint.ok || fromHint.engine.engineId !== HTML_VIDEO_ENGINE_IDS.canvas2d) throw new Error('expected hint to override env')
  } finally {
    if (typeof previous === 'string') process.env[KNOWGRPH_HTML_VIDEO_ENGINE] = previous
    else delete process.env[KNOWGRPH_HTML_VIDEO_ENGINE]
  }
}

export function testHtmlVideoEngineRegistryReadsRuntimeInjectedAdaptersWithoutHardcodedFallback() {
  const globalConfig = globalThis as typeof globalThis & { knowgrphHtmlVideoEngines?: RenderEngine[] | null }
  const previous = globalConfig.knowgrphHtmlVideoEngines
  try {
    globalConfig.knowgrphHtmlVideoEngines = [mockEngine('runtime-engine')]
    const registry = createHtmlVideoEngineRegistryFromRuntimeConfig()
    const resolved = resolveHtmlVideoEngine(registry, 'runtime-engine')
    if (resolved.ok === false || resolved.engine.engineId !== 'runtime-engine') {
      throw new Error('expected runtime-injected adapter to resolve')
    }
    const missing = resolveHtmlVideoEngine(createHtmlVideoEngineRegistryFromRuntimeConfig({ adapters: [] }), 'runtime-engine')
    if (missing.ok === true || missing.engineId !== 'runtime-engine') {
      throw new Error('expected explicit empty runtime config to avoid global fallback')
    }
  } finally {
    if (typeof previous === 'undefined') delete globalConfig.knowgrphHtmlVideoEngines
    else globalConfig.knowgrphHtmlVideoEngines = previous
  }
}

export function testHtmlVideoRenderJobSemanticKeyIsDeterministicAndEngineSpecific() {
  const spec = validSpec()
  const first = buildRenderJobId(spec, HTML_VIDEO_ENGINE_IDS.headlessBrowser)
  const second = buildRenderJobId({ ...spec, data: { a: { nested: true }, b: 2 } }, HTML_VIDEO_ENGINE_IDS.headlessBrowser)
  const differentEngine = buildRenderJobId(spec, HTML_VIDEO_ENGINE_IDS.canvas2d)
  const differentSpec = buildRenderJobId({ ...spec, fps: 24 }, HTML_VIDEO_ENGINE_IDS.headlessBrowser)
  if (!first || first !== second) throw new Error('expected stable semantic key for equivalent spec')
  if (first === differentEngine) throw new Error('expected engine id to affect semantic key')
  if (first === differentSpec) throw new Error('expected spec fields to affect semantic key')
}

export async function testHtmlVideoRenderJobReturnsStructuredErrorsWithoutEngineOrThrows() {
  const node = { id: 'html-video-1', type: FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID, label: FLOW_HTML_VIDEO_RENDERER_NODE_LABEL, properties: {} }
  const missing = await runHtmlVideoRenderJob({
    spec: validSpec(),
    node,
    registry: createHtmlVideoEngineRegistry([]),
  })
  if (missing.ok === true || missing.errorCode !== 'engine_not_configured') throw new Error('expected missing engine to stay structured')

  const throwing = await runHtmlVideoRenderJob({
    spec: { ...validSpec(), engineHint: 'throwing-engine' },
    node,
    registry: createHtmlVideoEngineRegistry([{
      engineId: 'throwing-engine',
      async render() {
        throw new Error('boom')
      },
    }]),
  })
  if (throwing.ok === true || throwing.errorCode !== 'render_failed' || !String(throwing.reason || '').includes('boom')) {
    throw new Error(`expected render_failed, got ${JSON.stringify(throwing)}`)
  }

  const browserNativeWebm = await runHtmlVideoRenderJob({
    spec: { ...validSpec(), engineHint: 'browser-native-webm' },
    node,
    registry: createHtmlVideoEngineRegistry([{
      engineId: 'browser-native-webm',
      async render(spec) {
        return {
          blob: new Blob([`webm:${spec.html}`], { type: 'video/webm; codecs="vp8"' }),
          engineId: 'browser-native-webm',
          durationMs: spec.durationMs,
          fps: spec.fps,
          width: spec.width,
          height: spec.height,
        }
      },
    }]),
  })
  if (browserNativeWebm.ok === false) {
    throw new Error(`expected browser-native video/webm blobs to publish as video artifacts, got ${browserNativeWebm.reason}`)
  }
  if (browserNativeWebm.blob.type !== 'video/webm; codecs="vp8"') {
    throw new Error(`expected browser-native recorder MIME to be preserved, got ${browserNativeWebm.blob.type}`)
  }
}

export function testHtmlVideoRendererFlowRegistryAndRichMediaKind() {
  const direct = buildHtmlVideoRendererRegistryDraft()
  const canonical = buildCanonicalWidgetRegistryDraft({ nodeTypeId: FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID })
  if (!canonical) throw new Error('expected canonical HTML video registry draft')
  if (direct.nodeTypeId !== FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID || canonical.nodeTypeId !== FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID) {
    throw new Error('expected HTML video node type id')
  }
  if (direct.widgetTypeId !== FLOW_HTML_VIDEO_RENDERER_WIDGET_TYPE_ID || direct.formId !== FLOW_HTML_VIDEO_RENDERER_FORM_ID) {
    throw new Error('expected HTML video widget identity constants')
  }
  if (getWidgetRegistryEntryLabel({ nodeTypeId: FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID }) !== FLOW_HTML_VIDEO_RENDERER_NODE_LABEL) {
    throw new Error('expected HTML video widget label')
  }
  const fieldPaths = new Set(canonical.fields.map(field => field.schemaPath))
  for (const path of ['properties.html', 'properties.css', 'properties.data_json', 'properties.duration_ms', 'properties.fps', 'properties.width', 'properties.height', 'properties.engine_hint']) {
    if (!fieldPaths.has(path)) throw new Error(`expected field path ${path}`)
  }
  const outputPortPaths = new Set(canonical.ports.filter(port => port.direction === 'output').map(port => port.schemaPath))
  for (const path of ['properties.videoUrl', 'properties.outputSrcDoc', 'properties.outputPath', 'properties.renderJobId']) {
    if (!outputPortPaths.has(path)) throw new Error(`expected HTML video output port path ${path}`)
  }
  const kind = resolveRichMediaWidgetKind({ id: 'html-video-1', type: FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID, label: '', properties: {} })
  if (kind !== 'video') throw new Error(`expected rich media video kind, got ${kind}`)
  if (!isRichMediaVideoOutputTargetNode({ id: 'html-video-1', type: FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID, label: '', properties: {} })) {
    throw new Error('expected HTML video renderer to be a video output source target')
  }
  if (!isRichMediaVideoOutputTargetNode({ id: 'rich-media-panel-1', type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, label: '', properties: {} })) {
    throw new Error('expected Rich Media Panel to accept rendered video output')
  }
}

export function testHtmlVideoRendererSourceContractsAvoidParallelStorageAndAdapterImports() {
  const ssotText = readFileSync(resolve(process.cwd(), 'src', 'features', 'html-video-renderer', 'htmlVideoRendererSsot.ts'), 'utf8')
  for (const forbidden of ['headlessBrowserAdapter', 'canvas2dAdapter', 'serverSideAdapter']) {
    if (ssotText.includes(forbidden)) throw new Error(`SSOT must not import adapter module ${forbidden}`)
  }
  if (!ssotText.includes('Object.freeze({')) throw new Error('expected frozen engine id map')

  const jobText = readFileSync(resolve(process.cwd(), 'src', 'features', 'html-video-renderer', 'htmlVideoRenderJob.ts'), 'utf8')
  if (!jobText.includes("import { writeRichMediaWidgetRunOutputArtifact } from '@/features/chat/richMediaRun'")) {
    throw new Error('expected render job to reuse shared rich media artifact writer')
  }
  if (!jobText.includes("buildScopedGraphSemanticKey('html-video-render'")) {
    throw new Error('expected render job to use shared scoped semantic key helper')
  }
  if (!jobText.includes("['engineId', engineId]")) {
    throw new Error('expected render job to pass engineId into manifest metadata')
  }

  const richMediaRunText = readFileSync(resolve(process.cwd(), 'src', 'features', 'chat', 'richMediaRun.ts'), 'utf8')
  if (!richMediaRunText.includes('manifestMetadata')) {
    throw new Error('expected shared rich media writer to accept manifest metadata')
  }
  const workflowText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRunAction.ts'), 'utf8')
  if (!workflowText.includes('createHtmlVideoEngineRegistryFromRuntimeConfig()')) {
    throw new Error('expected Flow Editor runner to read runtime-injected HTML video engines')
  }
}

export async function testHtmlVideoHeadlessBrowserAdapterIsNativeFossRuntimeAdapter() {
  const adapterPath = resolve(process.cwd(), 'src', 'features', 'html-video-renderer', 'engines', 'headlessBrowserAdapter.ts')
  const adapterText = readFileSync(adapterPath, 'utf8')
  for (const required of [
    "await import('playwright')",
    "await import('node:child_process')",
    'FFmpeg exited with code',
    'KNOWGRPH_HTML_VIDEO_FFMPEG_BIN',
    'KNOWGRPH_HTML_VIDEO_FFMPEG_VIDEO_CODEC',
    'window.__knowgrphRenderFrame',
    'window.__hyperframesSeek',
    'window.__timelines',
    "DEFAULT_MP4_VIDEO_CODEC = 'mpeg4'",
  ]) {
    if (!adapterText.includes(required)) throw new Error(`expected headless browser adapter to include ${required}`)
  }
  for (const forbidden of ['@hyperframes/', 'hyperframes.com', "DEFAULT_MP4_VIDEO_CODEC = 'libx264'"]) {
    if (adapterText.includes(forbidden)) throw new Error(`headless browser adapter must not copy or force ${forbidden}`)
  }

  const { headlessBrowserAdapter, KNOWGRPH_HTML_VIDEO_MAX_FRAMES } = await import('@/features/html-video-renderer/engines/headlessBrowserAdapter')
  const previous = process.env[KNOWGRPH_HTML_VIDEO_MAX_FRAMES]
  try {
    process.env[KNOWGRPH_HTML_VIDEO_MAX_FRAMES] = '1'
    let failed = false
    try {
      await headlessBrowserAdapter.render({ ...validSpec(), durationMs: 1000, fps: 30 })
    } catch (error) {
      failed = String(error instanceof Error ? error.message : error).includes('blocks 30 requested frames')
    }
    if (!failed) throw new Error('expected max frame guard to fail before browser or FFmpeg execution')
  } finally {
    if (typeof previous === 'string') process.env[KNOWGRPH_HTML_VIDEO_MAX_FRAMES] = previous
    else delete process.env[KNOWGRPH_HTML_VIDEO_MAX_FRAMES]
  }
}

export async function testHtmlVideoCanvas2dAdapterIsBrowserNativeRecorderRuntimeAdapter() {
  const adapterPath = resolve(process.cwd(), 'src', 'features', 'html-video-renderer', 'engines', 'canvas2dAdapter.ts')
  const adapterText = readFileSync(adapterPath, 'utf8')
  const forbiddenExternalMediaToolkit = ['media', 'bunny'].join('')
  for (const required of [
    'MediaRecorder',
    'canvas.captureStream(spec.fps)',
    'requestCanvasFrame(stream)',
    'stopMediaStream(stream)',
    'CANVAS_2D_RECORDER_MIME_CANDIDATES',
    'MEDIA_VIDEO_RECORDER_MIME_TYPE_CANDIDATES',
    "await import('html2canvas')",
    'rasterizer=html2canvas',
    'recorder=MediaRecorder',
    'data-kg-html-video-frame-host',
    "document.createElement('iframe')",
    "host.setAttribute('aria-label', 'HTML video frame raster host')",
    "host.setAttribute('sandbox', 'allow-scripts allow-same-origin')",
    'host.srcdoc = buildFrameDocument(spec, timeMs)',
    'const renderRoot = frameDocument.querySelector',
    'host.remove()',
  ]) {
    if (!adapterText.includes(required)) throw new Error(`expected canvas-2d browser MP4 adapter to include ${required}`)
  }
  if (
    adapterText.includes("document.createElement('div')") ||
    adapterText.includes("document.createElement('main')") ||
    adapterText.includes('host.innerHTML =') ||
    adapterText.includes('host.append(style') ||
    adapterText.includes('style.textContent = buildFrameStyle')
  ) {
    throw new Error('expected canvas-2d adapter to isolate render CSS in a frame document instead of the top document')
  }
  for (const forbidden of [forbiddenExternalMediaToolkit, 'Mp4OutputFormat', 'CanvasSource', 'BufferTarget', 'ffmpeg', '@ffmpeg/', '@hyperframes/', 'Puppeteer']) {
    if (adapterText.includes(forbidden)) throw new Error(`canvas-2d adapter must not require ${forbidden}`)
  }

  const { canvas2dAdapter } = await import('@/features/html-video-renderer/engines/canvas2dAdapter')
  let failed = false
  try {
    await canvas2dAdapter.render(validSpec())
  } catch (error) {
    failed = String(error instanceof Error ? error.message : error).includes('requires a browser runtime')
  }
  if (!failed) throw new Error('expected canvas-2d adapter to fail closed outside a browser runtime')
}

export async function testHtmlVideoBrowserRuntimeRegistersCanvas2dWithoutFallbackEngine() {
  const globalConfig = globalThis as typeof globalThis & { knowgrphHtmlVideoEngines?: RenderEngine[] | null }
  const previous = globalConfig.knowgrphHtmlVideoEngines
  try {
    globalConfig.knowgrphHtmlVideoEngines = []
    const { installHtmlVideoBrowserRuntimeAdapters } = await import('@/features/html-video-renderer/htmlVideoBrowserRuntime')
    installHtmlVideoBrowserRuntimeAdapters()
    installHtmlVideoBrowserRuntimeAdapters()
    const registry = createHtmlVideoEngineRegistryFromRuntimeConfig()
    const canvas2d = resolveHtmlVideoEngine(registry, HTML_VIDEO_ENGINE_IDS.canvas2d)
    if (canvas2d.ok === false || canvas2d.engine.engineId !== HTML_VIDEO_ENGINE_IDS.canvas2d) {
      throw new Error('expected browser runtime to register canvas-2d adapter')
    }
    const headless = resolveHtmlVideoEngine(registry, HTML_VIDEO_ENGINE_IDS.headlessBrowser)
    if (headless.ok === true) {
      throw new Error('expected browser runtime not to register headless-browser as a fallback engine')
    }
    if ((globalConfig.knowgrphHtmlVideoEngines || []).length !== 1) {
      throw new Error('expected browser runtime registration to dedupe adapters')
    }
  } finally {
    if (typeof previous === 'undefined') delete globalConfig.knowgrphHtmlVideoEngines
    else globalConfig.knowgrphHtmlVideoEngines = previous
  }
}

export function testHtmlVideoWorkflowPublishesRenderedMp4ToRichMediaPanel() {
  const mainText = readFileSync(resolve(process.cwd(), 'src', 'main.tsx'), 'utf8')
  if (!mainText.includes('installHtmlVideoBrowserRuntimeAdapters()')) {
    throw new Error('expected browser runtime to install HTML video runtime adapters at app startup')
  }
  const workflowText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRunAction.ts'), 'utf8')
  for (const required of [
    'publishVideoRunOutputToRichMediaPanel',
    'resolveFlowEditorWorkflowDownstreamRunTargetIds',
    "richMediaActiveTab: 'video'",
    "readConnectedHtmlVideoProperty('properties.html', 'html')",
    'createHtmlVideoEngineRegistryFromRuntimeConfig()',
    'isRichMediaVideoOutputTargetNode(candidate)',
    'buildHtmlVideoPreviewSrcDocFromNode(htmlVideoNode)',
    '...(outputSrcDoc.trim() ? { outputSrcDoc } : null)',
    "richMediaActiveTab: panelArgs.patch.richMediaActiveTab || 'video'",
    'stabilizeHtmlVideoPreviewPatchForExistingProps',
    'HTML_VIDEO_PREVIEW_STABILITY_KEYS',
    'lastRunAt: currentProps.lastRunAt',
    '!areFlowEditorWorkflowRecordValuesEqual(existingPanelProps, nextPanelProps)',
  ]) {
    if (!workflowText.includes(required)) throw new Error(`expected workflow runner to include ${required}`)
  }
  const htmlVideoRunBranch = workflowText.slice(
    workflowText.indexOf("String(node.type || '').trim() === FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID"),
    workflowText.indexOf('if (readWorkflowString(node.type) === FLOW_ANNOTATION_ENGINE_NODE_TYPE_ID)'),
  )
  if (htmlVideoRunBranch.includes('setRunLoadingStateForKnownNodeIds({ loading: true')) {
    throw new Error('expected HTML video preview-capable runs to avoid blanking Rich Media Panel with a loading skeleton')
  }
  const runAllSequenceText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'runAllSequenceSsot.ts'), 'utf8')
  for (const required of [
    'FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID',
    "typeId === normalizeText(FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID)) return 'video'",
  ]) {
    if (!runAllSequenceText.includes(required)) throw new Error(`expected run-all sequence to include ${required}`)
  }
}

const readVdeoxplnDemoDocumentPath = (): string => {
  const fromEnv = String(process.env.KNOWGRPH_VDEOXPLN_DEMO_DOC_PATH || '').trim()
  if (fromEnv) return resolve(fromEnv)
  const hardcodeGuardInput = String(process.env.KG_TEST_VALIDATION_FORBID_HARDCODE_IN_REPO || '').trim()
  return hardcodeGuardInput ? resolve(hardcodeGuardInput) : ''
}

const unwrapKtvValue = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(record, 'value')) return record.value
  return value
}

const readKtvString = (record: Record<string, unknown>, key: string): string => {
  const value = unwrapKtvValue(record[key])
  return typeof value === 'string' ? value : ''
}

const readKtvNumber = (record: Record<string, unknown>, key: string): number => {
  const value = unwrapKtvValue(record[key])
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export async function testHtmlVideoRendererIngestsVdeoxplnDemoAnimatedMp4SpecWithoutHardcodedRuntimeArtifacts() {
  const demoPath = readVdeoxplnDemoDocumentPath()
  if (!demoPath) return
  if (!existsSync(demoPath)) throw new Error(`expected vdeoxpln validation doc at ${demoPath}`)
  const expectedVideoAgentTestUrl = String(process.env.KNOWGRPH_VIDEO_AGENT_TEST_URL || '').trim()
  if (!expectedVideoAgentTestUrl) {
    throw new Error('expected KNOWGRPH_VIDEO_AGENT_TEST_URL to be provided for external video-agent validation')
  }
  const markdown = readFileSync(demoPath, 'utf8')
  const staleRuntimeLiterals = [
    ['blob', 'http://'].join(':'),
    ['outputManifestPath', ''].join(':'),
    ['outputSavedName', ''].join(':'),
    ['lastRunAt', ''].join(':'),
    ['outputLoading', ''].join(':'),
    ['renderErrorCode', ''].join(':'),
    ['renderErrorReason', ''].join(':'),
    'engine returned a blob that is not video',
  ]
  for (const staleRuntimeLiteral of staleRuntimeLiterals) {
    if (markdown.includes(staleRuntimeLiteral)) {
      throw new Error(`validation input must not persist runtime artifact ${staleRuntimeLiteral}`)
    }
  }

  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(markdown))
  if (parsed.warnings.length > 0) throw new Error(`expected clean frontmatter parse, got ${parsed.warnings.join('; ')}`)
  if (parsed.meta.validation_input_forbid_hardcode_in_repo !== true || parsed.meta.copyhardcode_forbid !== true) {
    throw new Error('expected validation input to declare hardcode-forbid flags')
  }
  const videoAgentContract = parsed.meta.videoAgentRuntimeContract as Record<string, unknown> | undefined
  if (!videoAgentContract || typeof videoAgentContract !== 'object' || Array.isArray(videoAgentContract)) {
    throw new Error('expected validation input to declare a video-agent runtime contract')
  }
  if (videoAgentContract.schema !== 'knowgrph-video-agent/v1') {
    throw new Error('expected validation input to declare knowgrph-video-agent/v1')
  }
  if (videoAgentContract.testUrl !== expectedVideoAgentTestUrl) {
    throw new Error('expected validation input video-agent contract to use the supplied test URL')
  }
  const dependencyPolicy = Array.isArray(videoAgentContract.dependencyPolicy) ? videoAgentContract.dependencyPolicy.map(String) : []
  for (const requiredPolicy of ['no copied Director code', 'no VideoDB runtime dependency', 'no external API key requirement']) {
    if (!dependencyPolicy.includes(requiredPolicy)) {
      throw new Error(`expected video-agent dependency policy ${requiredPolicy}`)
    }
  }
  const contractCapabilities = Array.isArray(videoAgentContract.capabilities) ? videoAgentContract.capabilities.map(String) : []
  for (const requiredCapability of ['ingest', 'parse', 'search', 'edit', 'compile', 'generate', 'stream']) {
    if (!contractCapabilities.includes(requiredCapability)) {
      throw new Error(`expected video-agent contract capability ${requiredCapability}`)
    }
  }

  const flow = parsed.meta.flow
  if (!flow || typeof flow !== 'object' || Array.isArray(flow)) throw new Error('expected frontmatter flow graph')
  const nodes = (flow as { nodes?: unknown }).nodes
  if (!Array.isArray(nodes)) throw new Error('expected flow.nodes array')
  const rendererNode = nodes
    .filter((node): node is Record<string, unknown> => !!node && typeof node === 'object' && !Array.isArray(node))
    .find(node => readKtvString(node, 'type') === FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID)
  if (!rendererNode) throw new Error('expected HtmlVideoRenderer node from validation input')
  const panelNode = nodes
    .filter((node): node is Record<string, unknown> => !!node && typeof node === 'object' && !Array.isArray(node))
    .find(node => readKtvString(node, 'type') === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID)
  if (!panelNode) throw new Error('expected RichMediaPanel node from validation input')
  for (const runtimeKey of ['lastRunAt', 'output', 'outputSrcDoc', 'renderErrorCode', 'renderErrorReason']) {
    if (Object.prototype.hasOwnProperty.call(panelNode, runtimeKey)) {
      throw new Error(`validation input Rich Media Panel must not persist runtime field ${runtimeKey}`)
    }
  }

  const specCandidate = {
    html: readKtvString(rendererNode, 'html'),
    css: readKtvString(rendererNode, 'css'),
    data: JSON.parse(readKtvString(rendererNode, 'data_json') || '{}') as unknown,
    durationMs: readKtvNumber(rendererNode, 'duration_ms'),
    fps: readKtvNumber(rendererNode, 'fps'),
    width: readKtvNumber(rendererNode, 'width'),
    height: readKtvNumber(rendererNode, 'height'),
    engineHint: readKtvString(rendererNode, 'engine_hint'),
  }
  const validated = validateRenderSpec(specCandidate)
  if (validated.ok === false) throw new Error(`expected validation doc Render_Spec to validate: ${validated.reason}`)
  if (validated.spec.engineHint !== HTML_VIDEO_ENGINE_IDS.canvas2d) throw new Error('expected validation doc to select canvas-2d')
  if (validated.spec.durationMs <= 0 || validated.spec.fps !== 24) {
    throw new Error('expected validation doc to expose a runnable 24fps composition')
  }
  if (
    !String(validated.spec.css || '').includes('@keyframes')
    || !validated.spec.html.includes('data-duration=')
    || !validated.spec.html.includes('<main')
    || !validated.spec.html.includes('<section')
    || !validated.spec.html.includes('<article')
    || !validated.spec.html.includes('<figure')
  ) {
    throw new Error('expected validation doc Render_Spec to carry semantic runnable animation timing')
  }
  if (!validated.spec.html.includes(expectedVideoAgentTestUrl)) {
    throw new Error('expected validation doc Render_Spec HTML to display the supplied test URL')
  }
  const responsivePreviewSrcDoc = buildHtmlVideoPreviewSrcDocFromNode({
    id: 'html-video-preview-validation',
    type: FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID,
    label: FLOW_HTML_VIDEO_RENDERER_NODE_LABEL,
    properties: {
      html: specCandidate.html,
      css: specCandidate.css,
      data_json: JSON.stringify(specCandidate.data),
      duration_ms: specCandidate.durationMs,
      fps: specCandidate.fps,
      width: specCandidate.width,
      height: specCandidate.height,
      engine_hint: specCandidate.engineHint,
    },
  })
  for (const requiredPreviewFragment of [
    'data-kg-html-video-preview-frame',
    'data-kg-html-video-preview-stage',
    'aspect-ratio:1280/720',
    'ResizeObserver',
    '--kg-html-video-preview-scale',
    '--kg-html-video-preview-width',
    '--kg-html-video-preview-height',
    'var scale=frameWidth/sourceWidth;',
    'stage.style.setProperty("--kg-html-video-preview-width",sourceWidth+"px")',
    'stage.style.setProperty("--kg-html-video-preview-height",sourceHeight+"px")',
    'section[data-kg-html-video-preview-stage]{position:absolute;left:0;top:0;width:1280px;height:720px;overflow:hidden;transform-origin:0 0;transform:scale(var(--kg-html-video-preview-scale,1));}',
    'frame.style.width=frameWidth+"px"',
    'frame.style.height=frameHeight+"px"',
  ]) {
    if (!responsivePreviewSrcDoc.includes(requiredPreviewFragment)) {
      throw new Error(`expected responsive 16:9 HTML video preview fragment ${requiredPreviewFragment}`)
    }
  }
  const data = validated.spec.data as {
    agentIntent?: unknown
    agents?: unknown
    capabilities?: unknown
    composition?: { id?: unknown }
    sourceVideo?: { url?: unknown; externalDependency?: unknown }
    streaming?: { fallback?: unknown; panel?: unknown; primary?: unknown }
    timelineTracks?: unknown
    workspaceFiles?: unknown
  }
  if (typeof data.composition?.id !== 'string' || !data.composition.id.includes('video-agent')) {
    throw new Error('expected validation doc data_json to identify a video-agent composition')
  }
  if (data.sourceVideo?.url !== expectedVideoAgentTestUrl || data.sourceVideo.externalDependency !== false) {
    throw new Error('expected validation doc data_json to expose the supplied test URL as source-owned input')
  }
  const capabilities = Array.isArray(data.capabilities) ? data.capabilities.map(String) : []
  for (const requiredCapability of ['ingest', 'parse', 'search', 'edit', 'compile', 'generate', 'stream']) {
    if (!capabilities.includes(requiredCapability)) {
      throw new Error(`expected validation doc data_json capability ${requiredCapability}`)
    }
  }
  if (!Array.isArray(data.agents) || data.agents.length < capabilities.length) {
    throw new Error('expected validation doc data_json to expose one or more agent stages per video-agent capability')
  }
  if (data.streaming?.primary !== 'video/mp4' || data.streaming.fallback !== 'outputSrcDoc' || data.streaming.panel !== 'RichMediaPanel') {
    throw new Error('expected validation doc data_json to expose streamable Rich Media output boundaries')
  }
  if (!Array.isArray(data.timelineTracks) || data.timelineTracks.length < capabilities.length) {
    throw new Error('expected validation doc data_json to expose video-agent timeline tracks')
  }
  if (!Array.isArray(data.workspaceFiles) || !data.workspaceFiles.some((entry) => {
    const path = String((entry as { path?: unknown } | null)?.path || '')
    return path.startsWith('video-agent/') && path.endsWith('.json')
  })) {
    throw new Error('expected validation doc data_json to expose video-agent workspace outputs')
  }

  const renderResult = await runHtmlVideoRenderJob({
    spec: validated.spec,
    node: {
      id: readKtvString(rendererNode, 'id') || 'html-video-validation-node',
      type: FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID,
      label: readKtvString(rendererNode, 'label') || FLOW_HTML_VIDEO_RENDERER_NODE_LABEL,
      properties: {},
    },
    registry: createHtmlVideoEngineRegistry([mockEngine(validated.spec.engineHint)]),
  })
  if (renderResult.ok === false) throw new Error(`expected validation doc Render_Spec to render, got ${renderResult.reason}`)
  if (renderResult.blob.type !== 'video/mp4' || renderResult.engineId !== HTML_VIDEO_ENGINE_IDS.canvas2d) {
    throw new Error('expected validation doc render to produce a canvas-2d video/mp4 result')
  }
  const previewSrcDoc = buildHtmlVideoPreviewSrcDocFromNode({
    id: readKtvString(rendererNode, 'id') || 'html-video-validation-node',
    type: FLOW_HTML_VIDEO_RENDERER_NODE_TYPE_ID,
    label: readKtvString(rendererNode, 'label') || FLOW_HTML_VIDEO_RENDERER_NODE_LABEL,
    properties: {
      html: validated.spec.html,
      css: validated.spec.css,
      data_json: JSON.stringify(validated.spec.data || {}),
      duration_ms: validated.spec.durationMs,
      fps: validated.spec.fps,
      width: validated.spec.width,
      height: validated.spec.height,
      engine_hint: validated.spec.engineHint,
    },
  })
  if (
    !previewSrcDoc.includes('knowgrph-html-video-data')
    || !previewSrcDoc.includes('@keyframes')
    || !previewSrcDoc.includes(expectedVideoAgentTestUrl)
    || !previewSrcDoc.includes('Knowgrph video agent')
  ) {
    throw new Error('expected validation doc to produce a runnable inline HTML preview fallback')
  }

  const thisTestText = readFileSync(resolve(process.cwd(), 'src', '__tests__', 'htmlVideoRenderer.test.ts'), 'utf8')
  if (thisTestText.includes(validated.spec.html) || thisTestText.includes(validated.spec.css)) {
    throw new Error('test must ingest validation source instead of copying HTML/CSS payloads into repo fixtures')
  }
}
