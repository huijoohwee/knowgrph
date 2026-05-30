import fs from 'node:fs'
import path from 'node:path'
import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import {
  buildStrybldrStoryboardDocument,
  buildStrybldrVideoHandoffFromGraphData,
  buildStrybldrVideoHandoffMarkdown,
  mergeStrybldrElementsIntoGraphData,
  serializeStrybldrStoryboardMarkdown,
} from '@/features/strybldr/strybldrStoryboard'
import { getCanvas2dSurfaceId, isStoryboardCanvas2dRenderer, resolveCanvas2dRendererId, supportsToolbarRunAll } from '@/lib/config.render'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const readSource = (...parts: string[]): string => fs.readFileSync(path.resolve(process.cwd(), 'src', ...parts), 'utf8')

export async function testStrybldrStoryboardMarkdownParsesToStoryboardGraph() {
  const doc = buildStrybldrStoryboardDocument({
    createdAtMs: 1,
    mediaUrlBySourceUnitId: {
      'corpus-source-demo': 'blob:strybldr-demo',
    },
    sourceUnits: [
      {
        id: 'corpus-source-demo',
        workspacePath: '/demo.png.source.md',
        relativePath: 'demo.png',
        originalName: 'demo.png',
        mediaKind: 'image',
        mimeHint: 'image/png',
        byteSize: 128,
        textHash: 'abc123',
        status: 'unsupported',
        provenance: { importMode: 'file', importedAtMs: 1 },
      },
    ],
  })
  const text = serializeStrybldrStoryboardMarkdown(doc)
  const parsed = await loadGraphDataFromTextViaParser('demo.strybldr.md', text, { applyToStore: false })
  assert(parsed?.parserId === 'strybldr-storyboard', `expected strybldr parser, got ${parsed?.parserId}`)
  assert(parsed.graphData?.metadata && String((parsed.graphData.metadata as Record<string, unknown>).kgCanvas2dRenderer || '') === 'strybldr', 'expected Strybldr renderer metadata')
  assert(String((parsed.graphData.metadata as Record<string, unknown>).graphSemanticKey || '').length > 0, 'expected shared graph semantic key metadata')
  assert((parsed.graphData.nodes || []).some(node => String(node.type || '') === 'StoryboardElement'), 'expected storyboard element nodes')
  assert((parsed.graphData.nodes || []).some(node => String(node.properties?.strybldrSourceUnitId || '') === 'corpus-source-demo'), 'expected provenance source-unit id on cards')
  assert((parsed.graphData.nodes || []).some(node => String(node.properties?.mediaKind || '') === 'image' && String(node.properties?.mimeHint || '') === 'image/png'), 'expected image media metadata for Viewer and Canvas rendering')

  const board = buildStoryboardBoardModel({ graphData: parsed.graphData, graphRevision: 1 })
  assert(board.totalCards >= 2, `expected Storyboard canvas cards from Strybldr graph, got ${board.totalCards}`)
  assert(board.lanes.some(lane => lane.id === 'Elements'), 'expected element lane in Strybldr board')
}

export function testStrybldrRendererModeUsesSharedSurfaceRegistry() {
  const renderConfigText = readSource('lib', 'config.render.ts')
  const retiredRendererId = ['story', 'bldr'].join('')
  assert(resolveCanvas2dRendererId('strybldr') === 'strybldr', 'expected canonical strybldr renderer id')
  assert(resolveCanvas2dRendererId(retiredRendererId) === undefined, 'expected no retired renderer remap')
  assert(/strybldr:\s*\{[\s\S]*?aliases:\s*\[\]/.test(renderConfigText), 'expected no Strybldr renderer aliases')
  assert(getCanvas2dSurfaceId('strybldr') === 'storyboard', 'expected Strybldr mode to reuse the Storyboard surface')
  assert(isStoryboardCanvas2dRenderer('strybldr'), 'expected shared Storyboard renderer helper to include Strybldr mode')
  assert(supportsToolbarRunAll('strybldr'), 'expected Strybldr to reuse Toolbar Run All dispatch')
  assert(supportsToolbarRunAll('flowEditor'), 'expected Flow Editor to keep Toolbar Run All dispatch')
}

export function testStrybldrImportImageAndFloatingPanelOwnersAreWired() {
  const launchText = readSource('lib', 'toolbar', 'LaunchDropdown.impl.tsx')
  const bridgeText = readSource('features', 'markdown-explorer', 'workspaceActionBridge.ts')
  const actionsText = readSource('features', 'markdown-workspace', 'useWorkspaceFileActions', 'importActions.ts')
  const floatingPanelText = readSource('lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const fallbackText = readSource('features', 'toolbar', 'launchDropdownFallbacks.ts')
  const imageBridgeText = readSource('lib', 'toolbar', 'launchImageImportBridge.ts')

  assert(launchText.includes('Import Image'), 'expected Launch dropdown to expose Import Image')
  assert(launchText.includes('importLocalImages'), 'expected Launch dropdown to use the workspace image import bridge')
  assert(launchText.includes('importLocalImagesWithWorkspaceBridgeRetry'), 'expected Launch dropdown to reuse the image-import bridge retry helper')
  assert(imageBridgeText.includes("setWorkspaceViewMode('editor')"), 'expected Launch image import to mount Workspace before retrying the workspace bridge')
  assert(imageBridgeText.includes('launch:import:localImages:bridge'), 'expected Launch image import to surface a bridge retry warning only after workspace-open retry fails')
  assert(bridgeText.includes('importLocalImages'), 'expected workspace action bridge to expose image import')
  assert(actionsText.includes('buildStrybldrStoryboardDocument'), 'expected image import to generate Strybldr storyboard document through the feature owner')
  assert(actionsText.includes("setCanvas2dRenderer('strybldr')"), 'expected image import to switch to Strybldr mode')
  assert(actionsText.includes('storyPath || createdPath'), 'expected image import focus to land on the generated Strybldr artifact, not a raw image source file')
  assert(!fallbackText.includes(`importLocalImages${'Fallback'}`), 'expected no duplicate image import fallback outside workspace owner')
  assert(floatingPanelText.includes('StrybldrFloatingPanelView'), 'expected Floating Panel to render the Strybldr owner view')
  assert(floatingPanelText.includes("view: 'strybldr'"), 'expected Floating Panel view registry to include Strybldr')
  assert(actionsText.includes('registerStrybldrImageFiles'), 'expected image import to register selected image Files for same-session local analysis')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('availableSourceUnitIds'), 'expected local analysis to address every registered imported image')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('Save card update'), 'expected Strybldr panel to expose the user update gate before generation')
  assert(readSource('components', 'Toolbar.tsx').includes('supportsToolbarRunAll'), 'expected toolbar Run All support to use the shared renderer helper')
  assert(readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx').includes('WORKFLOW_RUN_ALL_EVENT'), 'expected Strybldr panel to consume the shared Run All event')
}

export async function testStrybldrVideoHandoffReusesBytePlusOwnerWithFallbackArtifact() {
  const doc = buildStrybldrStoryboardDocument({
    createdAtMs: 1,
    sourceUnits: [
      {
        id: 'corpus-source-video',
        workspacePath: '/reference.png.source.md',
        relativePath: 'reference.png',
        originalName: 'reference.png',
        mediaKind: 'image',
        mimeHint: 'image/png',
        byteSize: 256,
        textHash: 'def456',
        status: 'unsupported',
        provenance: { importMode: 'file', importedAtMs: 1 },
      },
    ],
    elements: [
      {
        id: 'approved-card',
        sourceUnitId: 'corpus-source-video',
        label: 'Hero product',
        confidence: 0.9,
        sourceBox: { xmin: 0.2, ymin: 0.2, xmax: 0.8, ymax: 0.8, unit: 'percentage' },
        evidenceKind: 'user-edit',
        provider: 'fallback',
        order: 2,
        summary: 'Approved edited product card.',
        action: 'Pan in slowly.',
        prompt: 'Create a premium product reveal.',
      },
    ],
  })
  const parsed = await loadGraphDataFromTextViaParser('reference.strybldr.md', serializeStrybldrStoryboardMarkdown(doc), { applyToStore: false })
  const handoff = buildStrybldrVideoHandoffFromGraphData(parsed?.graphData)
  const markdown = buildStrybldrVideoHandoffMarkdown({
    handoff,
    status: 'fallback',
    provider: 'byteplus-modelark',
    errorReason: 'test fallback',
    elapsedMs: 42,
    paidCallCount: 0,
  })
  const panelText = readSource('features', 'strybldr', 'StrybldrFloatingPanelView.tsx')
  assert(handoff.prompt.includes('Approved edited product card.'), 'expected handoff prompt to read updated graph card text')
  assert(handoff.cards.some(card => card.sourceUnitId === 'corpus-source-video'), 'expected handoff cards to preserve source-unit provenance')
  assert(markdown.includes('kgStrybldrVideoHandoff: true'), 'expected fallback artifact frontmatter')
  assert(markdown.includes('paidCallCount: 0'), 'expected handoff cost evidence')
  assert(panelText.includes('generateRunVideoWithBytePlus'), 'expected Strybldr panel to reuse the BytePlus video owner')
  assert(panelText.includes('buildStrybldrVideoHandoffMarkdown'), 'expected Strybldr panel to write structured fallback artifacts')

  const twoSourceDoc = buildStrybldrStoryboardDocument({
    createdAtMs: 1,
    sourceUnits: [
      {
        id: 'corpus-source-merge-a',
        workspacePath: '/merge-a.png.source.md',
        relativePath: 'merge-a.png',
        originalName: 'merge-a.png',
        mediaKind: 'image',
        mimeHint: 'image/png',
        byteSize: 128,
        textHash: 'merge-a',
        status: 'unsupported',
        provenance: { importMode: 'file', importedAtMs: 1 },
      },
      {
        id: 'corpus-source-merge-b',
        workspacePath: '/merge-b.png.source.md',
        relativePath: 'merge-b.png',
        originalName: 'merge-b.png',
        mediaKind: 'image',
        mimeHint: 'image/png',
        byteSize: 128,
        textHash: 'merge-b',
        status: 'unsupported',
        provenance: { importMode: 'file', importedAtMs: 1 },
      },
    ],
  })
  const twoSourceParsed = await loadGraphDataFromTextViaParser('merge.strybldr.md', serializeStrybldrStoryboardMarkdown(twoSourceDoc), { applyToStore: false })
  assert(twoSourceParsed?.graphData, 'expected two-source Strybldr graph for merge regression')
  const merged = mergeStrybldrElementsIntoGraphData({
    graphData: twoSourceParsed.graphData,
    elements: [
      {
        id: 'merge-detected-a',
        sourceUnitId: 'corpus-source-merge-a',
        label: 'Detected cart',
        confidence: 0.8,
        sourceBox: { xmin: 0.1, ymin: 0.2, xmax: 0.5, ymax: 0.6, unit: 'percentage' },
        evidenceKind: 'local-object-detection',
        provider: 'transformers-detr',
        order: 2,
        summary: 'Detected cart from local analysis.',
        action: 'Animate the cart.',
        prompt: 'Move the cart through the frame.',
      },
    ],
  })
  const mergedElementNodes = (merged.nodes || []).filter(node => String(node.type || '') === 'StoryboardElement')
  assert(mergedElementNodes.some(node => String(node.properties?.strybldrSourceUnitId || '') === 'corpus-source-merge-a' && String(node.properties?.evidenceKind || '') === 'local-object-detection'), 'expected analyzed source to receive local detection cards')
  assert(mergedElementNodes.some(node => String(node.properties?.strybldrSourceUnitId || '') === 'corpus-source-merge-b' && String(node.properties?.evidenceKind || '') === 'source-metadata'), 'expected local analysis merge to preserve fallback cards for un-analyzed sources')
}

export function testStrybldrVisionHarnessUsesRequiredProvidersWithPrivacyGuard() {
  const localVisionText = readSource('features', 'strybldr', 'strybldrLocalVision.ts')
  assert(localVisionText.includes("@huggingface/transformers"), 'expected transformers.js package import')
  assert(localVisionText.includes("Xenova/detr-resnet-50"), 'expected DETR object detection model')
  assert(localVisionText.includes("@vladmandic/human"), 'expected @vladmandic/human package import')
  assert(localVisionText.includes('description: { enabled: false }'), 'expected Human face descriptor disabled')
  assert(localVisionText.includes('emotion: { enabled: false }'), 'expected Human emotion inference disabled')
  assert(localVisionText.includes("evidenceKind: 'local-object-detection'"), 'expected local object detection evidence tags')
  assert(localVisionText.includes("evidenceKind: 'local-human-geometry'"), 'expected privacy-safe human geometry evidence tags')
}
