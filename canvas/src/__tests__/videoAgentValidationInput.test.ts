import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildVideoSequenceGeneratedFrameThumbnails } from '@/components/timeline/videoSequenceGeneratedFrameThumbnails'
import { importWorkspaceUrl } from '@/features/markdown-workspace/workspaceImport'
import { resetWorkspaceUrlContentCacheForTests } from '@/features/markdown-workspace/workspaceImport/urlContentCache'
import {
  VIDEO_AGENT_REFERENCE_BOUNDARY,
  VIDEO_AGENT_SCHEMA_VERSION,
  buildVideoAgentPipeline,
  normalizeVideoAgentValidationConfig,
  readVideoAgentValidationConfigFromStorage,
  serializeVideoAgentValidationUrls,
  splitVideoAgentValidationUrls,
  writeVideoAgentValidationConfigToStorage,
} from '@/features/video-agent'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { buildMermaidGanttCodeFromNeutralTimelinePayload } from '@/lib/mermaid/mermaidDiagramCode'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import {
  assertVideoAgentContractCoversValidationUrls,
  installVideoAgentValidationYouTubeTranscriptFetch,
  readVideoAgentValidationUrlsFromEnv,
} from './helpers/videoAgentValidationInput'

const sourceFileExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const readExternalValidationDocPath = (): string => {
  const explicit = String(process.env.KNOWGRPH_VDEOXPLN_DEMO_DOC_PATH || '').trim()
  if (explicit) return resolve(explicit)
  const hardcodeGuardInput = String(process.env.KG_TEST_VALIDATION_FORBID_HARDCODE_IN_REPO || '').trim()
  return hardcodeGuardInput ? resolve(hardcodeGuardInput) : ''
}

const listSourceFiles = (rootDir: string): string[] => {
  const out: string[] = []
  const stack = [rootDir]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (!dir) continue
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue
      const filePath = resolve(dir, entry)
      const stat = statSync(filePath)
      if (stat.isDirectory()) {
        stack.push(filePath)
        continue
      }
      const extension = entry.slice(entry.lastIndexOf('.'))
      if (sourceFileExtensions.has(extension)) out.push(filePath)
    }
  }
  return out
}

const assertRuntimeValidationLiteralNotInRepoSource = (literal: string, label: string) => {
  const value = literal.trim()
  if (!value) return
  const sourceRoot = resolve(process.cwd(), 'src')
  const matches = listSourceFiles(sourceRoot)
    .filter(filePath => readFileSync(filePath, 'utf8').includes(value))
    .map(filePath => filePath.slice(process.cwd().length + 1))
  if (matches.length > 0) {
    throw new Error(`expected ${label} to stay external to knowgrph source; found ${matches.join(', ')}`)
  }
}

const unwrapKtvValue = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  if ('value' in value) return (value as { value?: unknown }).value
  return value
}

const readKtvString = (value: unknown): string => {
  const unwrapped = unwrapKtvValue(value)
  return typeof unwrapped === 'string' ? unwrapped : ''
}

const stringifyKtvValue = (value: unknown): string => {
  const unwrapped = unwrapKtvValue(value)
  return typeof unwrapped === 'string' ? unwrapped : JSON.stringify(unwrapped ?? '')
}

export function testVideoAgentValidationConfigSupportsUserConfiguredImportUrls() {
  const operatorDocPath = '/operator/configured/video-agent-validation.md'
  const operatorUrls = [
    'https://video.example.test/source-a',
    'https://video.example.test/source-b',
  ]
  const normalizedUrls = splitVideoAgentValidationUrls(`${operatorUrls[0]}\n${operatorUrls[1]},${operatorUrls[0]}`)
  if (normalizedUrls.length !== 2 || normalizedUrls[0] !== operatorUrls[0] || normalizedUrls[1] !== operatorUrls[1]) {
    throw new Error(`expected validation URL normalization to dedupe operator input, got ${JSON.stringify(normalizedUrls)}`)
  }
  const storage = new MemoryStorage()
  writeVideoAgentValidationConfigToStorage({ validationDocPath: operatorDocPath, importUrls: normalizedUrls }, storage)
  const storedConfig = readVideoAgentValidationConfigFromStorage(storage)
  if (!storedConfig || storedConfig.validationDocPath !== operatorDocPath || storedConfig.importUrls.join('|') !== operatorUrls.join('|')) {
    throw new Error(`expected storage-backed video-agent validation config, got ${JSON.stringify(storedConfig)}`)
  }
  const normalizedConfig = normalizeVideoAgentValidationConfig({
    validationDocPath: `  ${operatorDocPath}  `,
    importUrls: [operatorUrls[0], operatorUrls[1], operatorUrls[0]],
  })
  if (
    normalizedConfig.validationDocPath !== operatorDocPath
    || serializeVideoAgentValidationUrls(normalizedConfig.importUrls) !== operatorUrls.join('\n')
  ) {
    throw new Error(`expected normalized operator validation config, got ${JSON.stringify(normalizedConfig)}`)
  }

  const configSource = readFileSync(resolve(process.cwd(), 'src', 'features', 'video-agent', 'videoAgentValidationConfig.ts'), 'utf8')
  const launchImportSource = readFileSync(resolve(process.cwd(), 'src', 'lib', 'toolbar', 'LaunchDropdownImportUrlItem.tsx'), 'utf8')
  if (
    !configSource.includes('VIDEO_AGENT_VALIDATION_CONFIG_STORAGE_KEY')
    || !configSource.includes('VITE_KNOWGRPH_VIDEO_AGENT_VALIDATION_DOC_PATH')
    || !configSource.includes('VITE_KNOWGRPH_VIDEO_AGENT_VALIDATION_URLS')
  ) {
    throw new Error('expected video-agent validation config to expose one storage and env owner')
  }
  for (const requiredUiToken of ['Video-agent validation import controls', 'Video-agent validation document path', 'Video-agent validation import URLs', 'Import set']) {
    if (!launchImportSource.includes(requiredUiToken)) {
      throw new Error(`expected Launch Import URL UI to expose ${requiredUiToken}`)
    }
  }
  for (const forbidden of ['video-db', 'VideoDB', '@video-db', 'Director(', 'VIDEODB_API_KEY', 'youtu.be/']) {
    if (configSource.includes(forbidden) || launchImportSource.includes(forbidden)) {
      throw new Error(`expected user-configurable validation owners to avoid hardcoded external dependency or URL token ${forbidden}`)
    }
  }
}

export async function testVideoAgentPipelineUsesExternalValidationInputsWithoutRepoHardcodes() {
  const demoPath = readExternalValidationDocPath()
  const suppliedTestUrls = readVideoAgentValidationUrlsFromEnv()
  if (!demoPath && suppliedTestUrls.length === 0) return
  if (!demoPath || !existsSync(demoPath)) throw new Error(`expected external video-agent validation doc at ${demoPath || '<unset>'}`)
  if (suppliedTestUrls.length === 0) throw new Error('expected KNOWGRPH_VIDEO_AGENT_TEST_URLS for external video-agent validation')

  assertRuntimeValidationLiteralNotInRepoSource(demoPath, 'external validation document path')
  for (const suppliedTestUrl of suppliedTestUrls) {
    assertRuntimeValidationLiteralNotInRepoSource(suppliedTestUrl, 'video-agent test URL')
  }

  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(readFileSync(demoPath, 'utf8')))
  if (parsed.warnings.length > 0) throw new Error(`expected clean external validation frontmatter, got ${parsed.warnings.join('; ')}`)
  const contract = parsed.meta.videoAgentRuntimeContract as Record<string, unknown> | undefined
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new Error('expected external validation document to expose videoAgentRuntimeContract')
  }
  if (contract.schema !== VIDEO_AGENT_SCHEMA_VERSION) throw new Error('expected external validation document to carry the video-agent schema')
  assertVideoAgentContractCoversValidationUrls({ contract, expectedUrls: suppliedTestUrls })
  const referenceBoundary = contract.referenceBoundary as Record<string, unknown> | undefined
  for (const [key, value] of Object.entries(VIDEO_AGENT_REFERENCE_BOUNDARY)) {
    if (referenceBoundary?.[key] !== value) {
      throw new Error(`expected external validation document reference boundary ${key}=${String(value)}`)
    }
  }
  const contractArtifacts = Array.isArray(contract.reasoningArtifacts) ? contract.reasoningArtifacts.map(String) : []
  for (const required of [
    'search evidence windows',
    'edit decision plan',
    'compiled timeline manifest',
    'visual annotation dataset artifact',
    'real-time zone counting timeline',
    'generation placeholder manifest',
    'instant stream manifest',
  ]) {
    if (!contractArtifacts.includes(required)) {
      throw new Error(`expected external validation document reasoning artifact ${required}`)
    }
  }
  const datasetOperations = Array.isArray(contract.datasetOperations) ? contract.datasetOperations.map(String) : []
  for (const operation of ['load', 'split', 'merge', 'save', 'count_zones']) {
    if (!datasetOperations.includes(operation)) {
      throw new Error(`expected external validation document dataset operation ${operation}`)
    }
  }
  const contractSourceTruth = Array.isArray(contract.sourceTruth) ? contract.sourceTruth.map(String) : []
  for (const owner of [
    'canvas/src/features/video-agent/videoAgentDatasetRuntime.ts',
    'canvas/src/features/visual-annotation-engine/annotationDataset.ts',
  ]) {
    if (!contractSourceTruth.includes(owner)) {
      throw new Error(`expected external validation document sourceTruth owner ${owner}`)
    }
  }
  const outputBoundary = Array.isArray(contract.outputBoundary) ? contract.outputBoundary.map(String).join('\n') : ''
  if (!outputBoundary.includes('visualDataset') || !outputBoundary.includes('zoneCounting')) {
    throw new Error('expected external validation document outputBoundary to name visualDataset and zoneCounting')
  }
  const contractFrameBoxes = Array.isArray(contract.frameBoundingBoxes) ? contract.frameBoundingBoxes : []
  if (contractFrameBoxes.length < 5) {
    throw new Error('expected external validation document to expose frame-by-frame bounding boxes')
  }
  for (const entry of contractFrameBoxes) {
    const bbox = (entry as { bbox?: unknown }).bbox
    if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some(value => typeof value !== 'number' || value < 0 || value > 1)) {
      throw new Error(`expected normalized external validation bounding box, got ${JSON.stringify(entry)}`)
    }
  }

  const flow = parsed.meta.flow as { nodes?: unknown; edges?: unknown } | undefined
  const nodes = Array.isArray(flow?.nodes) ? flow.nodes as Array<Record<string, unknown>> : []
  const primaryTestUrl = suppliedTestUrls[0] || ''
  const sourceSpecNode = nodes.find(node => readKtvString(node.id) === 'html_video_source_spec')
  const sourceSpecData = JSON.parse(readKtvString(sourceSpecNode?.data_json) || '{}') as {
    bottomPanelTimelineSync?: { lane?: unknown; source?: unknown; surface?: unknown; thumbnailMode?: unknown; trackIds?: unknown }
    frameBoundingBoxTimelineTracks?: unknown
    timelineLanes?: unknown
    timelineTracks?: unknown
  }
  const sourceTimelineTracks = Array.isArray(sourceSpecData.timelineTracks) ? sourceSpecData.timelineTracks : []
  const sourceFrameTimelineTracks = sourceTimelineTracks.filter(entry => (
    String((entry as { source?: unknown }).source || '') === 'frameBoundingBox'
    && String((entry as { timelineLane?: unknown }).timelineLane || '') === 'fbf'
  ))
  if (
    sourceFrameTimelineTracks.length < contractFrameBoxes.length
    || !Array.isArray(sourceSpecData.frameBoundingBoxTimelineTracks)
    || sourceSpecData.bottomPanelTimelineSync?.surface !== 'BottomPanel Timeline'
    || sourceSpecData.bottomPanelTimelineSync?.source !== 'frameBoundingBoxes'
    || sourceSpecData.bottomPanelTimelineSync?.lane !== 'fbf'
    || sourceSpecData.bottomPanelTimelineSync?.thumbnailMode !== 'frame-by-frame-image'
  ) {
    throw new Error('expected external validation document to sync frame boxes into BottomPanel Timeline FBF tracks')
  }
  if (!Array.isArray(sourceSpecData.timelineLanes) || !sourceSpecData.timelineLanes.some(entry => String((entry as { label?: unknown }).label || '') === 'Frame-by-frame boxes')) {
    throw new Error('expected external validation document to expose a frame-by-frame BottomPanel Timeline lane')
  }
  const externalFbfTimelineCode = buildMermaidGanttCodeFromNeutralTimelinePayload(sourceSpecData)
  if (!externalFbfTimelineCode.includes('kgthumb_')) {
    throw new Error('expected external validation BottomPanel FBF timeline to carry source-frame thumbnail metadata')
  }
  const externalFbfTimelineModel = buildMermaidGanttTimelineModel(externalFbfTimelineCode)
  const externalFbfSpan = externalFbfTimelineModel.taskSpans.find(span => /frame_box_0_fbf/.test(span.raw))
  if (!externalFbfSpan) throw new Error('expected external validation BottomPanel FBF span')
  const externalFrameThumbnails = buildVideoSequenceGeneratedFrameThumbnails({ sourceWindow: null, span: externalFbfSpan })
  if (!String(externalFrameThumbnails[0]?.dataUrl || '').startsWith('/__video_frame?')) {
    throw new Error(`expected external validation BottomPanel FBF image to use actual source frame endpoint, got ${JSON.stringify(externalFrameThumbnails)}`)
  }
  const richMediaPanels = nodes.filter(node => readKtvString(node.type) === 'RichMediaPanel')
  const frameAnalysisPanels = richMediaPanels.filter(node => {
    const panelText = [
      readKtvString(node.id),
      readKtvString(node.label),
      readKtvString(node.srcDoc),
      stringifyKtvValue(node.frameBoundingBoxes),
      stringifyKtvValue(node.handles),
      stringifyKtvValue(node['flow:portTypes']),
    ].join(' ')
    return /frameBoundingBoxes|frame-by-frame|frame-box|bounding box/i.test(panelText)
  })
  if (frameAnalysisPanels.length < 3) {
    throw new Error('expected external validation document to show frame-by-frame bounding boxes in at least three RichMediaPanel nodes')
  }
  if (!frameAnalysisPanels.some(node => readKtvString(node.srcDoc).includes('frame-box') && readKtvString(node.srcDoc).includes(primaryTestUrl))) {
    throw new Error('expected at least one RichMediaPanel to render visible frame-box overlays for the supplied validation URL')
  }
  const floatingPanel = frameAnalysisPanels.find(node => readKtvString(node.id) === 'floating_panel_media_annotation_panel')
  if (!floatingPanel) {
    throw new Error('expected FloatingPanel Media Annotation Outputs to render frame-by-frame bounding-box analysis')
  }
  const floatingPanelSrcDoc = readKtvString(floatingPanel.srcDoc)
  if (!floatingPanelSrcDoc.includes('frame-box') || !floatingPanelSrcDoc.includes(primaryTestUrl)) {
    throw new Error('expected FloatingPanel Media Annotation Outputs to show visible frame-box overlays for the supplied validation URL')
  }
  if (
    !floatingPanelSrcDoc.includes('data-kg-frame-sequence-strip="floating-panel"')
    || !/0\.0s[\s\S]*1\.4s[\s\S]*2\.8s[\s\S]*4\.2s[\s\S]*5\.6s/.test(floatingPanelSrcDoc)
  ) {
    throw new Error('expected FloatingPanel Media Annotation Outputs to expose a visible frame-by-frame sequence strip')
  }
  const frameAnalysisPanelIds = new Set(frameAnalysisPanels.map(node => readKtvString(node.id)).filter(Boolean))
  const edges = Array.isArray(flow?.edges) ? flow.edges as Array<Record<string, unknown>> : []
  if (!edges.some(edge => frameAnalysisPanelIds.has(String(edge.target || '')) && String(edge.sourceHandle || '') === 'frameBoundingBoxes')) {
    throw new Error('expected frameBoundingBoxes to route into a RichMediaPanel through explicit Flow Editor edges')
  }
  if (!edges.some(edge => String(edge.target || '') === 'floating_panel_media_annotation_panel' && String(edge.targetHandle || '') === 'frameBoundingBoxes')) {
    throw new Error('expected frameBoundingBoxes to route explicitly into FloatingPanel Media Annotation Outputs')
  }

  const importCalls: string[] = []
  const restoreFetch = installVideoAgentValidationYouTubeTranscriptFetch(importCalls)
  try {
    resetWorkspaceUrlContentCacheForTests()
    for (const suppliedTestUrl of suppliedTestUrls) {
      const fs = createMemoryWorkspaceFs()
      const imported = await importWorkspaceUrl({
        fs,
        urlRaw: suppliedTestUrl,
        documentSemanticMode: 'document',
      })
      if (imported.createdPaths.length === 0) throw new Error(`expected Import URL to create a source-owned document for ${suppliedTestUrl}`)
      if (!imported.sources.some(source => source.source.kind === 'url' && source.source.url === suppliedTestUrl)) {
        throw new Error(`expected Import URL sources to preserve ${suppliedTestUrl}`)
      }
      const sourceUnit = imported.corpusManifest?.sourceUnits?.[0] || null
      if (sourceUnit?.mediaKind !== 'video' || sourceUnit.provenance?.importMode !== 'url') {
        throw new Error(`expected Import URL to classify ${suppliedTestUrl} as a video URL source`)
      }
      const importedText = String((await fs.readFileText(imported.createdPaths[0] || '')) || '')
      if (!importedText.includes('kgYoutubeVideoId:') || !importedText.includes(suppliedTestUrl)) {
        throw new Error(`expected Import URL to materialize parsed YouTube source markdown from ${suppliedTestUrl}`)
      }

      const result = buildVideoAgentPipeline({
        sourceUrl: suppliedTestUrl,
        intent: 'Search, edit, compile, generate, and stream the externally supplied validation video.',
      })
      if (result.ok === false) throw new Error(`expected supplied validation URL to build a pipeline, got ${result.reason}`)
      if (!result.pipeline.renderSpec.html.includes(suppliedTestUrl)) {
        throw new Error('expected video-agent render spec to render the runtime-supplied validation URL')
      }
      const renderData = result.pipeline.renderSpec.data as {
        referenceBoundary?: unknown
        sourceVideo?: { externalDependency?: unknown }
      }
      if (result.pipeline.source.externalDependency !== false || renderData.sourceVideo?.externalDependency !== false) {
        throw new Error('expected runtime-supplied validation URL to remain dependency-free')
      }
      if (result.pipeline.referenceBoundary !== VIDEO_AGENT_REFERENCE_BOUNDARY || renderData.referenceBoundary !== VIDEO_AGENT_REFERENCE_BOUNDARY) {
        throw new Error('expected runtime-supplied validation URL to use the native inspiration boundary')
      }
    }
  } finally {
    restoreFetch()
    resetWorkspaceUrlContentCacheForTests()
  }
  const transcriptImports = importCalls.filter(call => call.startsWith('/__youtube_transcript?'))
  if (transcriptImports.length < suppliedTestUrls.length) {
    throw new Error(`expected Import URL to use the shared YouTube transcript endpoint for each validation URL, got ${transcriptImports.length}`)
  }
}
