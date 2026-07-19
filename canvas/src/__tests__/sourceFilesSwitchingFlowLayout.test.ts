import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveActiveMarkdownBaseGraph } from '@/hooks/active-graph-data/useActiveGraphData.impl'
import {
  buildCanvasAppliedMarkdownDocumentIdentityKey,
  buildCanvasAppliedMarkdownDocumentSemanticKey,
  shouldRefreshCanvasAppliedMarkdownDocument,
  type CanvasAppliedMarkdownDocument,
} from '@/features/canvas/useCanvasAppliedMarkdownDocument'
import { resolveActivePathFromWorkspaceFileSelection } from '@/lib/markdown-workspace-runtime/markdownWorkspaceSelectionSync'
import {
  isWorkspace2dRendererPresetStaleForDocument,
  isWorkspaceGraphSourceStaleForDocument,
  isWorkspaceDocumentSwitchApplySettled,
  shouldApplyStableWorkspaceSelectionToCanvas,
} from '@/lib/markdown-workspace-runtime/useMarkdownWorkspaceSelection'
import { readWorkspaceActiveDocumentResolvedText } from '@/features/source-files/sourceFilesRuntimeActive'
import { shouldProactivelyReapplyActiveWorkspaceMarkdownDocument } from '@/features/source-files/sourceFilesRuntimeMaterialization'

export function testSourceFilesSwitchingAppliesFileContentAndFlowLayoutIgnoresInteractionPositions() {
  const ingestText = readFileSync(resolve(process.cwd(), 'src/features/source-files/sourceFilesIngestIntegration.ts'), 'utf8')
  const loaderText = readFileSync(resolve(process.cwd(), 'src/features/markdown-workspace/useMarkdownLoader.ts'), 'utf8')
  const selectionText = readFileSync(resolve(process.cwd(), 'src/lib/markdown-workspace-runtime/useMarkdownWorkspaceSelection.ts'), 'utf8')
  const switchApplyText = readFileSync(resolve(process.cwd(), 'src/lib/markdown-workspace-runtime/markdownWorkspaceDocumentSwitchApply.ts'), 'utf8')
  const documentActionsText = readFileSync(resolve(process.cwd(), 'src/hooks/store/graph-data-slice/graphDataDocumentActions.ts'), 'utf8')
  const viewShellText = readFileSync(resolve(process.cwd(), 'src/lib/markdown-workspace-runtime/useMarkdownWorkspaceViewShell.tsx'), 'utf8')
  const flowPositionsText = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/useFlowComputedPositions.ts'), 'utf8')
  const topologyText = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/flowLayoutTopologyKey.ts'), 'utf8')
  const activeGraphDataText = readFileSync(resolve(process.cwd(), 'src/hooks/active-graph-data/useActiveGraphData.impl.ts'), 'utf8')
  const runtimeMaterializationText = readFileSync(resolve(process.cwd(), 'src/features/source-files/sourceFilesRuntimeMaterialization.ts'), 'utf8')

  if (!ingestText.includes('autoEnableFrontmatter: false') || !ingestText.includes('applyViewPreset: opts?.applyToGraph === true')) {
    throw new Error('expected Source Files import activation to apply YAML/frontmatter presets only when graph apply is explicit')
  }
  if (ingestText.includes('forceApplyToGraph: true')) {
    throw new Error('expected Source Files import activation to avoid unconditional graph apply')
  }
  if (!loaderText.includes('autoEnableFrontmatter: false') || !loaderText.includes('applyViewPreset: false')) {
    throw new Error('expected markdown workspace editor text sync to avoid replaying YAML/frontmatter presets on every edit')
  }
  if (!switchApplyText.includes('autoEnableFrontmatter: true') || !switchApplyText.includes('applyViewPreset: true') || !switchApplyText.includes('applyToGraph: true')) {
    throw new Error('expected Source Files selection to render selected file content and apply YAML/frontmatter canvas presets')
  }
  if (!selectionText.includes('if (nextPath && prevPath && prevPath !== nextPath) {') || !selectionText.includes('if (switched.next !== args.activePath) return')) {
    throw new Error('expected Source Files switching to preserve the pending switch until the matching active-document apply consumes it')
  }
  if (!selectionText.includes('readCachedWorkspaceSelectionResolvedTextForActivePath({') || !selectionText.includes('args.patchWorkspaceEntryInlineText(nextPath, nextText)')) {
    throw new Error('expected Source Files switching to hydrate metadata-only workspace entries through the shared active-document resolver before Canvas apply')
  }
  if (!switchApplyText.includes('const applySelectedWorkspaceDocumentToCanvas = React.useCallback') || !selectionText.includes('await applySelectedWorkspaceDocumentToCanvas({')) {
    throw new Error('expected Source Files selection to reuse one shared Canvas apply path for file switches and stable hydration')
  }
  if (!selectionText.includes('resolveActivePathFromWorkspaceFileSelection({') || !selectionText.includes('setActivePathSafe(nextActivePath)')) {
    throw new Error('expected Source Files file selection to promote restored file selection paths back to the active Canvas document path')
  }
  if (!selectionText.includes('shouldHydrateStableWorkspaceSelectionText({') || !selectionText.includes('sourceUrl: activeDocumentSourceUrl')) {
    throw new Error('expected stable Source Files hydration to apply selected file content/frontmatter to Canvas, not only editor text')
  }
  if (
    !selectionText.includes('shouldApplyStableWorkspaceSelectionToCanvas({') ||
    !selectionText.includes('markdownDocumentName: args.markdownDocumentName') ||
    !selectionText.includes('graphDataSource: args.graphDataSource') ||
    !selectionText.includes('canvas2dRenderer: args.canvas2dRenderer')
  ) {
    throw new Error('expected already-hydrated Source Files selection to replay Canvas/frontmatter apply when active markdown document is stale')
  }
  if (
    !selectionText.includes('resolvePreferredMarkdownWorkspaceSelectionSyncText({') ||
    !selectionText.includes('selectionText: nextText')
  ) {
    throw new Error('expected Source Files stable selection hydration to prefer canonical active markdown document text over stale entry text before replaying Canvas apply')
  }
  if (
    !activeGraphDataText.includes('resolveActiveMarkdownBaseGraph({') ||
    !activeGraphDataText.includes('source === `markdown:${markdownName}`') ||
    !activeGraphDataText.includes('buildPendingActiveMarkdownGraph({ markdownName })') ||
    !activeGraphDataText.includes('WORKSPACE_STRUCTURED_PARSE_DEBOUNCE_MS,\n    markdownName') ||
    activeGraphDataText.includes("if (!source.startsWith('markdown:')) return base")
  ) {
    throw new Error('expected active graph render data to neutralize stale or unowned graphData when Source Files switches to another file')
  }
  if (
    !switchApplyText.includes('const applied = await applyActiveMarkdownDocumentPayload({') ||
    !switchApplyText.includes("if (applied === true) {\n        lastDocumentSwitchApplySigRef.current = nextSig\n        return 'applied'") ||
    switchApplyText.includes('documentSwitchApplyInFlightSigRef.current = nextSig\n    lastDocumentSwitchApplySigRef.current = nextSig')
  ) {
    throw new Error('expected Source Files switching to mark Canvas document-switch signatures completed only after graph/frontmatter apply succeeds')
  }
  if (
    !switchApplyText.includes('graphDataSource: applyArgs.graphDataSource') ||
    !selectionText.includes('graphDataSource: args.graphDataSource') ||
    !switchApplyText.includes('canvas2dRenderer: applyArgs.canvas2dRenderer') ||
    !switchApplyText.includes('graphSourceStaleForDocument') ||
    !switchApplyText.includes('shouldReplayCompletedApplyForMarkdownConflict') ||
    !switchApplyText.includes("if (!shouldReplayCompletedApplyForMarkdownConflict && lastDocumentSwitchApplySigRef.current === nextSig) return 'settled'")
  ) {
    throw new Error('expected Source Files switching apply signature to include graphData source so stale Canvas graphs replay selected-file frontmatter')
  }
  if (
    !selectionText.includes('activeEntry,\n    activeEntryKind,\n    args.canvas2dRenderer,\n    args.graphDataSource,\n    args.getFs') ||
    !selectionText.includes('args.activeTextRef,\n    args.canvas2dRenderer,\n    args.graphDataSource,\n    args.getFs')
  ) {
    throw new Error('expected Source Files switching effects to subscribe to graphDataSource and canvas2dRenderer so stale Canvas state replays selected-file content/frontmatter')
  }
  if (
    !selectionText.includes('const applied = await applySelectedWorkspaceDocumentToCanvas({') ||
    !selectionText.includes("applied === 'applied' || applied === 'settled'") ||
    !selectionText.includes("applied === 'deferred' && switchedActivePathRef.current?.next === switched.next")
  ) {
    throw new Error('expected Source Files switching to clear settled file-switch ownership and keep deferred ownership for retries')
  }
  if (!selectionText.includes('scheduleDocumentSwitchApplyRetry') || !selectionText.includes('documentSwitchApplyRetryTick') || !switchApplyText.includes('documentSwitchApplyRetryTick')) {
    throw new Error('expected Source Files switching to retry the same selected file after an in-flight Canvas graph/frontmatter apply defers the first attempt')
  }
  if (!switchApplyText.includes('if (documentSwitchApplyRetryTimerRef.current == null) return') || !switchApplyText.includes('window.clearTimeout(documentSwitchApplyRetryTimerRef.current)')) {
    throw new Error('expected Source Files switching retry to clear stale timers and avoid duplicate retry churn')
  }
  if (
    !switchApplyText.includes('isWorkspaceDocumentSwitchApplySettled({') ||
    !switchApplyText.includes("return 'settled'") ||
    !selectionText.includes('clearDocumentSwitchApplyRetry()')
  ) {
    throw new Error('expected Source Files switching to treat already-converged active documents as settled instead of retrying')
  }
  if (
    !runtimeMaterializationText.includes('export async function reapplyActiveWorkspaceMarkdownDocument') ||
    runtimeMaterializationText.includes('isWorkspaceEditorOverlayOpen({') ||
    runtimeMaterializationText.includes('workspaceCanvasPaneOpen') ||
    runtimeMaterializationText.includes('workspaceViewMode: store.workspaceViewMode')
  ) {
    throw new Error('expected Source Files active-path materialization to apply the selected document/frontmatter to Canvas while the Editor Workspace is open')
  }
  if (
    !documentActionsText.includes('function buildPendingMarkdownDocumentGraph(') ||
    !documentActionsText.includes("context === 'frontmatter-flow'") ||
    !documentActionsText.includes('canvasWorkspacePreset: buildCanvasWorkspacePresetMetadata(preset)') ||
    documentActionsText.includes('canvasWorkspacePreset: preset')
  ) {
    throw new Error('expected Source Files Canvas switching to clear stale graph data with a selected-document pending graph keyed by the active file and parsed YAML/frontmatter preset when present')
  }
  if (
    !documentActionsText.includes('if (applyViewPresetForSwitch) {\n        get().setGraphData(buildPendingMarkdownDocumentGraph({') ||
    documentActionsText.includes('if (strictStoryboardPreset)') ||
    documentActionsText.includes('applyViewPresetForSwitch && parsedTextPreset')
  ) {
    throw new Error('expected Source Files switches to prime Canvas from the selected file before parser output, without YAML/frontmatter-only gating')
  }
  if (
    !documentActionsText.includes('const graphApplied = await get().applyMarkdownDocumentToGraph(') ||
    !documentActionsText.includes('if (graphApplied) {\n          requestActiveDocumentFit()\n          return true\n        }') ||
    !documentActionsText.includes('applyViewPresetForSwitch &&\n          !isMarkdownLikeFileName(name) &&\n          active.markdownDocumentName === name')
  ) {
    throw new Error('expected Markdown graph switches to require a committed graph while retaining the non-Markdown view-preset fallback')
  }
  if (viewShellText.includes("React.startTransition(() => {\n        setSelectionSource('editor')")) {
    throw new Error('expected Source Files row selection to update the active file synchronously under renderer load')
  }
  if (!topologyText.includes("buildScopedGraphSemanticKey('flow-layout-topology'")) {
    throw new Error('expected Flow layout topology identity to reuse the shared semantic-key helper')
  }
  if (flowPositionsText.includes('sourceSeedHash') || topologyText.includes('sourceSeedHash')) {
    throw new Error('expected Flow layout computation identity to ignore x/y seed churn from drag, pan, and zoom interactions')
  }
}

export async function testSourceFilesSwitchingPrimesCanvasForSelectedFileWithoutFrontmatterGraph() {
  const state = useGraphStore.getState()
  state.resetAll()
  state.setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    metadata: {
      kind: 'frontmatter-flow',
      source: 'markdown:stale-frontmatter.md',
    },
    nodes: [
      { id: 'stale-node', label: 'Stale node', type: 'Stale' },
    ],
    edges: [],
  } as never)

  const text = 'Plain selected file body without YAML frontmatter or graph syntax.'
  const ok = await useGraphStore.getState().setActiveMarkdownDocument({
    name: 'notes/plain-selected-file.txt',
    text,
    autoEnableFrontmatter: false,
    applyViewPreset: true,
    applyToGraph: true,
    forceApplyToGraph: true,
  })

  const after = useGraphStore.getState()
  const meta = ((after.graphData?.metadata || null) as Record<string, unknown> | null) || {}
  if (ok !== true) {
    throw new Error('expected selected plain file switch to complete after applying the active document to Canvas')
  }
  if (after.markdownDocumentName !== 'notes/plain-selected-file.txt' || after.markdownDocumentText !== text) {
    throw new Error('expected active markdown document to reflect the selected Source Files content')
  }
  if (String(meta.source || '') !== 'markdown:notes/plain-selected-file.txt' || meta.pending !== true) {
    throw new Error(`expected Canvas to hold a selected-document pending graph instead of stale frontmatter graph, got ${JSON.stringify(meta)}`)
  }
  if ((after.graphData?.nodes || []).some(node => String(node.id || '') === 'stale-node')) {
    throw new Error('expected selected plain file switch to remove stale graph nodes immediately')
  }
}

function buildAppliedMarkdownDocument(name: string, text: string): CanvasAppliedMarkdownDocument {
  return {
    name,
    sourceUrl: null,
    text,
    semanticKey: buildCanvasAppliedMarkdownDocumentSemanticKey({ name, text }),
  }
}

export function testSourceFilesSwitchingRefreshesCanvasAppliedDocumentIdentityWithoutEditChurn() {
  const first = buildAppliedMarkdownDocument('docs/knowgrph-video-demo.md', 'video document')
  const editedFirst = buildAppliedMarkdownDocument('docs/knowgrph-video-demo.md', 'video document edited in editor')
  const switched = buildAppliedMarkdownDocument('docs/knowgrph-design-demo.md', 'design document')

  if (shouldRefreshCanvasAppliedMarkdownDocument({ latest: first, next: editedFirst, applyViewPreset: false })) {
    throw new Error('expected same-document editor text sync to preserve the last canvas-applied markdown document')
  }
  if (!shouldRefreshCanvasAppliedMarkdownDocument({ latest: first, next: switched, applyViewPreset: false })) {
    throw new Error('expected Source Files document switching to refresh canvas-applied markdown identity even without a view-preset replay')
  }
  const firstIdentityKey = buildCanvasAppliedMarkdownDocumentIdentityKey(first)
  const editedFirstIdentityKey = buildCanvasAppliedMarkdownDocumentIdentityKey(editedFirst)
  const switchedIdentityKey = buildCanvasAppliedMarkdownDocumentIdentityKey(switched)
  const switchedSourceIdentityKey = buildCanvasAppliedMarkdownDocumentIdentityKey({
    ...first,
    sourceUrl: 'workspace:/docs/alternate-video-demo.md',
  })
  if (firstIdentityKey !== editedFirstIdentityKey) {
    throw new Error('expected same-document text mutation to preserve Storyboard draft document identity')
  }
  if (firstIdentityKey === switchedIdentityKey || firstIdentityKey === switchedSourceIdentityKey) {
    throw new Error('expected a different applied document name or source URL to advance Storyboard draft document identity')
  }
}

export function testSourceFilesFileSelectionPromotesActiveCanvasPath() {
  const next = resolveActivePathFromWorkspaceFileSelection({
    selectionPath: '/docs/knowgrph-design-demo.md',
    activePath: '/docs/knowgrph-video-demo.md',
    selectionEntryKind: 'file',
  })
  if (next !== '/docs/knowgrph-design-demo.md') {
    throw new Error(`expected file selection to promote active Canvas path, got ${String(next)}`)
  }
  const folderSelection = resolveActivePathFromWorkspaceFileSelection({
    selectionPath: '/docs',
    activePath: '/docs/knowgrph-video-demo.md',
    selectionEntryKind: 'folder',
  })
  if (folderSelection !== null) {
    throw new Error('expected folder selection to preserve folder contract active path handling')
  }
}

export function testSourceFilesStableHydratedSelectionStillAppliesStaleCanvasDocument() {
  const shouldApply = shouldApplyStableWorkspaceSelectionToCanvas({
    activePath: '/docs/knowgrph-design-demo.md',
    activeEntryKind: 'file',
    activeDocumentKey: 'docs/knowgrph-design-demo.md',
    nextText: '---\nkgCanvas2dRenderer: "design"\n---\n# Design',
    markdownDocumentName: 'docs/knowgrph-design-demo.md',
    markdownDocumentText: '---\nkgCanvas2dRenderer: "design"\n---\n# Design',
    graphDataSource: 'markdown:docs/knowgrph-video-demo.md',
  })
  if (!shouldApply) {
    throw new Error('expected already-hydrated selected file text to still apply when Canvas has a stale active markdown document')
  }
  const emptySourceShouldApply = shouldApplyStableWorkspaceSelectionToCanvas({
    activePath: '/docs/knowgrph-design-demo.md',
    activeEntryKind: 'file',
    activeDocumentKey: 'docs/knowgrph-design-demo.md',
    nextText: '---\nkgCanvas2dRenderer: "design"\n---\n# Design',
    markdownDocumentName: 'docs/knowgrph-design-demo.md',
    markdownDocumentText: '---\nkgCanvas2dRenderer: "design"\n---\n# Design',
    graphDataSource: '',
  })
  if (!emptySourceShouldApply) {
    throw new Error('expected already-hydrated selected file text to apply when Canvas graph source is unowned or missing')
  }
  if (!isWorkspaceGraphSourceStaleForDocument({
    activeDocumentKey: 'docs/knowgrph-design-demo.md',
    graphDataSource: 'source-file:docs/knowgrph-video-demo.md',
  })) {
    throw new Error('expected non-markdown graph source ownership to be stale for the selected Source Files document')
  }
  const sameDocument = shouldApplyStableWorkspaceSelectionToCanvas({
    activePath: '/docs/knowgrph-design-demo.md',
    activeEntryKind: 'file',
    activeDocumentKey: 'docs/knowgrph-design-demo.md',
    nextText: '# Design',
    markdownDocumentName: 'docs/knowgrph-design-demo.md',
    markdownDocumentText: '# Design',
    graphDataSource: 'markdown:docs/knowgrph-design-demo.md',
  })
  if (sameDocument) {
    throw new Error('expected stable selected file apply guard to avoid duplicate same-document Canvas apply churn')
  }
}

export function testSourceFilesDocumentSwitchSettlementStopsRetryChurn() {
  const settled = isWorkspaceDocumentSwitchApplySettled({
    activeDocumentKey: 'docs/knowgrph-storyboard-widget-demo.md',
    text: '# Storyboard Widget',
    markdownDocumentName: 'docs/knowgrph-storyboard-widget-demo.md',
    markdownDocumentText: '# Storyboard Widget',
    graphDataSource: 'markdown:docs/knowgrph-storyboard-widget-demo.md',
    canvas2dRenderer: 'storyboard',
  })
  if (!settled) {
    throw new Error('expected matching active markdown document and Canvas graph source to settle Source Files switch retries')
  }

  const staleGraph = isWorkspaceDocumentSwitchApplySettled({
    activeDocumentKey: 'docs/knowgrph-storyboard-widget-demo.md',
    text: '# Storyboard Widget',
    markdownDocumentName: 'docs/knowgrph-storyboard-widget-demo.md',
    markdownDocumentText: '# Storyboard Widget',
    graphDataSource: 'markdown:docs/another-file.md',
    canvas2dRenderer: 'storyboard',
  })
  if (staleGraph) {
    throw new Error('expected stale Canvas graph source to keep Source Files switch apply work pending')
  }

  const staleText = isWorkspaceDocumentSwitchApplySettled({
    activeDocumentKey: 'docs/knowgrph-storyboard-widget-demo.md',
    text: '# Storyboard Widget',
    markdownDocumentName: 'docs/knowgrph-storyboard-widget-demo.md',
    markdownDocumentText: '# Older text',
    graphDataSource: 'markdown:docs/knowgrph-storyboard-widget-demo.md',
    canvas2dRenderer: 'storyboard',
  })
  if (staleText) {
    throw new Error('expected stale active markdown text to keep Source Files switch apply work pending')
  }

  const staleRendererText = '---\nkgCanvas2dRenderer: "storyboard"\n---\n# Storyboard'
  const staleRenderer = isWorkspaceDocumentSwitchApplySettled({
    activeDocumentKey: 'docs/knowgrph-storyboard-widget-demo.md',
    text: staleRendererText,
    markdownDocumentName: 'docs/knowgrph-storyboard-widget-demo.md',
    markdownDocumentText: staleRendererText,
    graphDataSource: 'markdown:docs/knowgrph-storyboard-widget-demo.md',
    canvas2dRenderer: 'design',
  })
  if (!staleRenderer) {
    throw new Error('expected selected-file renderer differences to settle once document text and graph source are current')
  }
  if (!isWorkspace2dRendererPresetStaleForDocument({ text: staleRendererText, canvas2dRenderer: 'd3' })) {
    throw new Error('expected selected-file frontmatter renderer helper to continue detecting preset differences for initial/import apply paths')
  }
  const staleRendererShouldApply = shouldApplyStableWorkspaceSelectionToCanvas({
    activePath: '/docs/knowgrph-storyboard-widget-demo.md',
    activeEntryKind: 'file',
    activeDocumentKey: 'docs/knowgrph-storyboard-widget-demo.md',
    nextText: staleRendererText,
    markdownDocumentName: 'docs/knowgrph-storyboard-widget-demo.md',
    markdownDocumentText: staleRendererText,
    graphDataSource: 'markdown:docs/knowgrph-storyboard-widget-demo.md',
    canvas2dRenderer: 'design',
  })
  if (staleRendererShouldApply) {
    throw new Error('expected stable selected file apply guard to preserve user-selected 2D renderer choices')
  }
}

export function testSourceFilesActiveGraphRejectsUnownedCanvasGraphForSelectedFile() {
  const staleGraph = {
    type: 'Graph',
    context: 'frontmatter-flow',
    metadata: {
      kind: 'frontmatter-flow',
      source: '',
    },
    nodes: [
      { id: 'stale', label: 'Stale graph' },
    ],
    edges: [],
  } as never
  const active = resolveActiveMarkdownBaseGraph({
    baseGraphDataRaw: staleGraph,
    markdownName: 'docs/knowgrph-design-demo.md',
    markdownText: '---\nkgCanvas2dRenderer: "storyboard"\n---\n# Design',
  })
  const meta = ((active?.metadata || null) as Record<string, unknown> | null) || {}
  if (String(meta.source || '') !== 'markdown:docs/knowgrph-design-demo.md' || meta.pending !== true) {
    throw new Error(`expected active graph derivation to replace unowned stale graph with selected-document pending graph, got ${JSON.stringify(meta)}`)
  }
  if ((active?.nodes || []).some(node => String(node.id || '') === 'stale')) {
    throw new Error('expected active graph derivation to suppress stale unowned Canvas nodes after Source Files switch')
  }
}

export function testSourceFilesActiveWorkspaceReapplyAllowsEditorWorkspaceCanvasPane() {
  const shouldApply = shouldProactivelyReapplyActiveWorkspaceMarkdownDocument({
    activePath: '/docs/knowgrph-design-demo.md',
    markdownDocumentName: 'docs/model-asset-source.md',
    markdownDocumentText: '---\nkgCanvasSurfaceMode: "xr"\n---\n# XR',
    markdownDocumentApplyViewPreset: true,
  })
  if (!shouldApply) {
    throw new Error('expected Source Files active path switching to reapply the selected Markdown document/frontmatter with the Editor Workspace open')
  }
}

export async function testSourceFilesModelAssetSwitchUsesFileTypeFallbackCanvasPreset() {
  const modelAssetPath = '/docs/model-asset-source.glb'
  const modelAssetName = 'docs/model-asset-source.glb'
  const resolvedText = await readWorkspaceActiveDocumentResolvedText({
    activePath: modelAssetPath,
    currentText: 'glTF\u0002\u0000\u0000\u0000',
    fs: {
      readFileText: async () => '',
    } as never,
  })
  if (!resolvedText.includes('kgAssetFormat: "glb"') || !resolvedText.includes('kgCanvasSurfaceMode: "xr"')) {
    throw new Error(`expected empty GLB Source Files selection to synthesize XR model-asset frontmatter, got ${resolvedText}`)
  }

  useGraphStore.getState().resetAll()
  useGraphStore.getState().setCanvasRenderMode('2d')
  useGraphStore.getState().setCanvas2dRenderer('d3')
  const applied = await useGraphStore.getState().setActiveMarkdownDocument({
    name: modelAssetName,
    text: resolvedText,
    autoEnableFrontmatter: true,
    applyViewPreset: true,
    applyToGraph: true,
    forceApplyToGraph: true,
    normalizeMermaidMmd: false,
  })
  const state = useGraphStore.getState()
  if (applied !== true) {
    throw new Error('expected GLB Source Files switch to complete from synthesized model-asset document')
  }
  if (state.canvasRenderMode !== '3d' || state.canvas3dMode !== 'xr') {
    throw new Error(`expected GLB Source Files switch to apply XR Canvas preset, got ${state.canvasRenderMode}/${state.canvas3dMode}`)
  }
  if (state.markdownDocumentName !== modelAssetName || state.markdownDocumentText !== resolvedText) {
    throw new Error('expected active markdown document to reflect selected GLB fallback manifest')
  }
}
