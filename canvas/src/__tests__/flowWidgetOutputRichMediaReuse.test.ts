import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { deriveOpenWidgetOverlayNodeIds } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { buildTextWidgetOutputPatch } from '@/features/chat/richMediaRun'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { resolveRichMediaConnectedRenderSchemaPath } from '@/lib/flowEditor/widgetAutoRender'

export function testTextWidgetOutputPatchBuildsRichMediaIframeSpec() {
  const patch = buildTextWidgetOutputPatch({
    output: '## Hello\\n\\nWidget output',
    title: 'BytePlus Text Widget',
    model: 'seed-1-6-thinking',
  })
  const node = {
    id: 'text-widget-output',
    type: 'TextGeneration',
    label: 'BytePlus Text Widget',
    properties: patch,
  } as Parameters<typeof getNodeMediaSpec>[0]

  const spec = getNodeMediaSpec(node)
  if (spec) throw new Error('expected text widget output patch to stay off the direct media overlay path and render through Rich Media Panel instead')
}

export function testRichMediaRunDispatchSupportsDeerFlowAdapters() {
  const richMediaRunPath = resolve(process.cwd(), 'src', 'features', 'chat', 'richMediaRun.ts')
  const text = readFileSync(richMediaRunPath, 'utf8')
  if (!text.includes('generateRunImageWithDeerFlow')) {
    throw new Error('expected rich media run dispatcher to import DeerFlow image adapter helper')
  }
  if (!text.includes('generateRunVideoWithDeerFlow')) {
    throw new Error('expected rich media run dispatcher to import DeerFlow video adapter helper')
  }
  if (!text.includes('if (normalizedProvider === CHAT_PROVIDER_DEERFLOW)')) {
    throw new Error('expected rich media run dispatcher to branch DeerFlow image/video execution by normalized provider')
  }
}

export function testFlowEditorCanvasTextRunUsesSharedRichMediaOutputPatch() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const workflowActionsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const workflowRunActionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRunAction.ts')
  const workflowRichMediaPanelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRichMediaPanel.ts')
  const text = [
    readFileSync(flowEditorCanvasPath, 'utf8'),
    readFileSync(workflowActionsPath, 'utf8'),
    readFileSync(workflowRunActionPath, 'utf8'),
  ].join('\n')
  const workflowRichMediaPanelText = readFileSync(workflowRichMediaPanelPath, 'utf8')

  if (!text.includes('buildTextWidgetOutputPatch')) {
    throw new Error('expected FlowEditorCanvas text widget run path to reuse shared text-widget rich-media output patch helper')
  }
  if (!text.includes('...clearRichMediaOutputProperties(nodeProps)')) {
    throw new Error('expected FlowEditorCanvas text widget run path to clear stale rich-media output properties before writing next output')
  }
  if (!text.includes('...buildTextWidgetOutputPatch({')) {
    throw new Error('expected FlowEditorCanvas text widget run path to write shared rich-media panel output metadata')
  }
  if (!workflowRichMediaPanelText.includes('export function ensureFlowEditorWorkflowRichMediaPanelNodeId(args: {')) {
    throw new Error('expected FlowEditor runtime helper to centralize rich-media panel creation fallback')
  }
  if (!text.includes('const panelNodeId = ensureFlowEditorWorkflowRichMediaPanelNodeId({')) {
    throw new Error('expected FlowEditorCanvas text widget run path to reuse the shared rich-media panel target helper')
  }
  if (!text.includes('const updatedPanelInDraft = applyFlowEditorWorkflowRichMediaPanelDraftPatch({')) {
    throw new Error('expected FlowEditorCanvas text widget run path to reuse the shared rich-media panel draft patch helper')
  }
}

export function testFlowEditorCanvasRunTargetsWritableNodeIdForComposedGraphs() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const workflowActionsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const workflowRunActionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRunAction.ts')
  const renderGraphHelperPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts')
  const workflowWritebackPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowWriteback.ts')
  const text = [
    readFileSync(flowEditorCanvasPath, 'utf8'),
    readFileSync(workflowActionsPath, 'utf8'),
    readFileSync(workflowRunActionPath, 'utf8'),
  ].join('\n')
  const renderGraphHelperText = readFileSync(renderGraphHelperPath, 'utf8')
  const workflowWritebackText = readFileSync(workflowWritebackPath, 'utf8')

  if (!renderGraphHelperText.includes('export function resolveFlowEditorWorkflowWritableNodeId(args: {')) {
    throw new Error('expected FlowEditor runtime helper to centralize composed-id draft write-target resolution')
  }
  if (!renderGraphHelperText.includes('const exactRequested = requested.full ? args.context.draftNodeById.get(requested.full) || null : null')) {
    throw new Error('expected shared workflow node-resolution helper to prefer exact draft node matches before canonical fallback')
  }
  if (!renderGraphHelperText.includes('const innerMatches = args.context.draftNodes.filter(node => targetInners.has(splitComposedNodeId(node?.id).inner))')) {
    throw new Error('expected shared workflow node-resolution helper to reuse canonical inner-id fallback when draft ids are composed')
  }
  if (!text.includes('const writableNodeId = String(resolvedRunTarget?.writableNodeId || resolvedNodeId).trim() || resolvedNodeId')) {
    throw new Error('expected FlowEditorCanvas run path to consume the shared writable node id from the upstream run-target resolver')
  }
  if (!workflowWritebackText.includes('export function updateFlowEditorWorkflowOutputForKnownNodeIds(args: {')) {
    throw new Error('expected FlowEditor runtime helper to centralize output writes via canonical id updater')
  }
  if (!text.includes('args.draftGraphDataRef.current = nextDraft')) {
    throw new Error('expected FlowEditorCanvas run path to update live draft graph ref output before renderer recompute')
  }
  if (!text.includes('args.setDraftGraphData(prev => (prev === currentDraft ? nextDraft : args.draftGraphDataRef.current))')) {
    throw new Error('expected FlowEditorCanvas run path to preserve live draft ref as SSOT while React state catches up')
  }
  if (!workflowWritebackText.includes("import { bumpFlowEditorDraftGraphDataRevision } from '@/lib/flowEditor/flowEditorDraftGraphData'")) {
    throw new Error('expected FlowEditor runtime helper to reuse neutral draft graph revision bumping for output cache invalidation')
  }
}

export function testFlowEditorCanvasUsesDraftRevisionForActiveRenderGraph() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const surfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'FlowEditorCanvasSurface.tsx')
  const renderStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRenderState.ts')
  const text = `${readFileSync(flowEditorCanvasPath, 'utf8')}\n${readFileSync(runtimePath, 'utf8')}\n${readFileSync(surfacePath, 'utf8')}\n${readFileSync(renderStatePath, 'utf8')}`

  if (!text.includes('const draftGraphDataRevision = React.useMemo(() => {')) {
    throw new Error('expected FlowEditorCanvas to derive a render revision from the live draft graph')
  }
  if (!text.includes("const raw = (meta as Record<string, unknown>).graphDataRevision")) {
    throw new Error('expected FlowEditorCanvas to read the draft graph revision from graph metadata')
  }
  if (!text.includes('graphDataRevisionOverride={props.flowEditorViewActive ? props.draftGraphDataRevision : props.baseGraphDataRevision}')) {
    throw new Error('expected FlowCanvas to render against the live draft revision while Flow Editor is active')
  }
}

export function testRichMediaRenderPathsReuseSemanticGraphKeysForConnectedValueCaching() {
  const flowDataflowPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'flowDataflow.ts')
  const flowCanvasStatePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts')
  const overlays2dPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts')
  const previewPanelPath = resolve(process.cwd(), 'src', 'lib', 'panels', 'views', 'PreviewPanelView.impl.tsx')
  const commandMenuRichMediaInventoryPath = resolve(process.cwd(), 'src', 'lib', 'command-menu', 'commandMenuRichMediaInventory.ts')
  const graphTableInspectorPath = resolve(process.cwd(), 'src', 'features', 'graph-inspector', 'ui', 'GraphRecordInspector.tsx')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const flowDataflowText = readFileSync(flowDataflowPath, 'utf8')
  const flowCanvasStateText = readFileSync(flowCanvasStatePath, 'utf8')
  const overlays2dText = readFileSync(overlays2dPath, 'utf8')
  const previewPanelText = readFileSync(previewPanelPath, 'utf8')
  const commandMenuRichMediaInventoryText = readFileSync(commandMenuRichMediaInventoryPath, 'utf8')
  const graphTableInspectorText = readFileSync(graphTableInspectorPath, 'utf8')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')

  if (!flowDataflowText.includes('graphSemanticKey?: string')) {
    throw new Error('expected flow dataflow cache SSOT to accept an explicit semantic graph key')
  }
  if (!flowDataflowText.includes("buildScopedGraphSemanticKey('flow-connected-values-graph'")) {
    throw new Error('expected flow dataflow cache SSOT to derive cache keys from the shared semantic graph key helper')
  }
  if (!flowCanvasStateText.includes('graphSemanticKey: sceneGraphSemanticKey,')) {
    throw new Error('expected FlowCanvas rich media connected-value path to reuse the scene graph semantic key')
  }
  if (!flowCanvasStateText.includes('const dataflowWidgetRegistry = React.useMemo(() => {')) {
    throw new Error('expected FlowCanvas rich media connected-value path to derive one upstream merged dataflow registry memo')
  }
  if (!flowCanvasStateText.includes('registry: dataflowWidgetRegistry,')) {
    throw new Error('expected FlowCanvas rich media connected-value path to reuse the upstream merged dataflow registry memo')
  }
  if (!overlays2dText.includes('graphSemanticKey: sceneGraphSemanticKey,')) {
    throw new Error('expected D3 rich media overlay path to reuse the scene graph semantic key for connected-value caching')
  }
  if (!overlays2dText.includes('readWidgetRegistryMetadataEntries<WidgetRegistryEntry>(metadata)')) {
    throw new Error('expected D3 rich media overlay path to reuse the shared widget-registry metadata reader before connected-value caching')
  }
  if (overlays2dText.includes('const registryRaw = metadata[FLOW_WIDGET_REGISTRY_METADATA_KEY]')) {
    throw new Error('expected D3 rich media overlay path to stop parsing widget registry metadata inline')
  }
  if (!previewPanelText.includes('useCommandMenuRichMediaInventory()') || !commandMenuRichMediaInventoryText.includes('graphSemanticKey,')) {
    throw new Error('expected PreviewPanelView graph media path to thread semantic graph key caching through the shared Command Menu rich-media inventory')
  }
  if (!graphTableInspectorText.includes('graphSemanticKey,')) {
    throw new Error('expected GraphRecordInspector widget preview path to thread a semantic graph key into connected-value caching')
  }
  if (!overlaySurfaceText.includes('frontmatterVisibleSceneDisplayRef.current.key !== frontmatterVisibleGraphSemanticKey')) {
    throw new Error('expected FlowEditor overlay surface to invalidate frontmatter scene derivation on semantic graph keys instead of raw graph identity')
  }
}

export function testFlowEditorCanvasResolvesCanonicalSelectionIdsAcrossDraftAndOverlayGraphs() {
  const selectionBookkeepingPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorSelectionBookkeeping.ts')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const sharedPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'flowEditorCanvasShared.tsx')
  const text = `${readFileSync(selectionBookkeepingPath, 'utf8')}\n${readFileSync(overlaySurfacePath, 'utf8')}\n${readFileSync(sharedPath, 'utf8')}`

  if (!text.includes("import { parseCanonicalNodeIds, resolveGraphNodeByCanonicalId, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'")) {
    throw new Error('expected FlowEditorCanvas to reuse the shared canonical node-id resolver SSOT for selection and overlay paths')
  }
  if (!text.includes('return resolveDraftGraphNode(selectedNodeId) || resolveGraphNodeByCanonicalId(draftGraphData, selectedNodeId)')) {
    throw new Error('expected FlowEditorCanvas selected draft node lookup to resolve composed ids against the draft graph')
  }
  if (!text.includes('deriveOpenWidgetOverlayNodeIds({')) {
    throw new Error('expected FlowEditorCanvas overlay-open widget ids to resolve through the shared overlay node-id helper')
  }
  if (!text.includes('const resolvedId = resolveGraphNodeIdByCanonicalId(args.graphData, rawId)')) {
    throw new Error('expected shared FlowEditor overlay node-id helper to normalize composed ids against the active render graph')
  }
}

export function testDeriveOpenWidgetOverlayNodeIdsNormalizesCanonicalIdsAndFiltersExcludedNodes() {
  const graphData: import('@/lib/graph/types').GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'group-a::node-a', label: 'Node A', type: 'TextGeneration', properties: {} },
      { id: 'node-b', label: 'Node B', type: 'ImageGeneration', properties: {} },
      { id: 'section-1', label: 'Section 1', type: 'Section', properties: {} },
      { id: 'node-c', label: 'Node C', type: 'VideoGeneration', properties: {} },
    ],
    edges: [],
    metadata: {},
  }
  const nodeById = new Map(graphData.nodes.map(node => [String(node.id || '').trim(), node]))
  const ids = deriveOpenWidgetOverlayNodeIds({
    graphData,
    openWidgetNodeIds: ['node-a', 'group-a::node-a', 'section-1', 'node-c'],
    eligibleNodeIds: new Set(['group-a::node-a', 'node-b']),
    nodeById,
    selectedNodeId: 'node-b',
  })

  if (ids.length !== 2) {
    throw new Error(`expected two canonical overlay ids after dedupe/filtering, got ${ids.length}`)
  }
  if (ids[0] !== 'group-a::node-a') {
    throw new Error(`expected canonical graph node id for composed widget overlay, got ${String(ids[0] || '<none>')}`)
  }
  if (ids[1] !== 'node-b') {
    throw new Error(`expected selected draft node id to append when eligible and not excluded, got ${String(ids[1] || '<none>')}`)
  }
}

export function testFlowEditorCanvasDataflowRegistryPrefersNonEmptyDocumentThenEffectiveThenBase() {
  const flowEditorCanvasRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const workflowActionsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const workflowRunActionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRunAction.ts')
  const workflowRunInputsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRunInputs.ts')
  const runtimeText = readFileSync(flowEditorCanvasRuntimePath, 'utf8')
  const workflowActionsText = `${readFileSync(workflowActionsPath, 'utf8')}\n${readFileSync(workflowRunActionPath, 'utf8')}`
  const workflowRunInputsText = readFileSync(workflowRunInputsPath, 'utf8')

  if (!runtimeText.includes('buildDataflowWidgetRegistry')) {
    throw new Error('expected FlowEditorCanvas runtime to derive one upstream merged dataflow widget registry')
  }
  if (!runtimeText.includes('() => buildDataflowWidgetRegistry({ documentWidgetRegistry, effectiveWidgetRegistry, widgetRegistry: baseWidgetRegistry })')) {
    throw new Error('expected FlowEditorCanvas runtime to merge document, effective, and base widget registries through the shared dataflow registry SSOT')
  }
  if (!runtimeText.includes('widgetRegistry,')) {
    throw new Error('expected FlowEditorCanvas runtime to pass the upstream merged widget registry into workflow actions')
  }
  if (!workflowActionsText.includes('widgetRegistry: WidgetRegistryEntry[]')) {
    throw new Error('expected FlowEditor workflow actions to accept the upstream merged widget registry instead of rebuilding it locally')
  }
  if (!workflowRunInputsText.includes('registry: args.registry,')) {
    throw new Error('expected FlowEditor workflow run-input helper to reuse the upstream merged widget registry for connected-value resolution')
  }
  if (!workflowRunInputsText.includes('if (args.context.renderGraph) candidateGraphs.push(args.context.renderGraph)')) {
    throw new Error('expected FlowEditor workflow run-input helper to prefer render graph data for connected-value resolution')
  }
  if (!workflowActionsText.includes('const connectedValuesInput = resolveFlowEditorWorkflowConnectedValuesInput({')) {
    throw new Error('expected FlowEditor workflow rich-media runs to reuse the shared run-input helper instead of choosing a graph locally')
  }
  if (!workflowActionsText.includes('connectedValuesBySchemaPath: connectedValuesInput?.connectedValuesByNodeId.get(connectedValuesInput.targetNodeId)')) {
    throw new Error('expected rich-media runs to read connected values through the helper-resolved target node id')
  }
  if (!workflowActionsText.includes('resolveWidgetRegistryEntry({ node, registry: args.widgetRegistry, graphMetaKind: args.baseGraphKind })')) {
    throw new Error('expected FlowEditor workflow text runs to reuse the upstream merged widget registry for registry resolution')
  }
  if (!workflowActionsText.includes('registryEntries: args.widgetRegistry,')) {
    throw new Error('expected FlowEditor workflow bundle export path to reuse the upstream merged widget registry for full-bundle export')
  }
  if (workflowActionsText.includes('buildDataflowWidgetRegistry({')) {
    throw new Error('expected FlowEditor workflow actions to stop rebuilding a local merged dataflow widget registry')
  }
  if (workflowActionsText.includes('Array.isArray(store.widgetRegistry)')) {
    throw new Error('expected FlowEditor workflow actions to stop reading base widget registry directly from store state')
  }
  if (workflowActionsText.includes('computeFlowConnectedValuesBySchemaPath({')) {
    throw new Error('expected FlowEditor workflow actions to stop owning inline connected-values graph selection')
  }
}

export function testNodeOverlayEditorUsesMergedDataflowRegistry() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const runtimeStoreStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeStoreState.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const runtimeStoreStateText = readFileSync(runtimeStoreStatePath, 'utf8')

  if (!runtimeText.includes('buildDataflowWidgetRegistry')) {
    throw new Error('expected Flow Editor runtime to resolve widget forms from shared merged dataflow registry')
  }
  if (!runtimeStoreStateText.includes('documentWidgetRegistry: Array.isArray(s.documentWidgetRegistry)')) {
    throw new Error('expected Flow Editor runtime state to include document widget registry in merged form resolution')
  }
  if (!runtimeStoreStateText.includes('effectiveWidgetRegistry: Array.isArray(s.effectiveWidgetRegistry)')) {
    throw new Error('expected Flow Editor runtime state to include effective widget registry in merged form resolution')
  }
  if (!runtimeText.includes('widgetRegistry: baseWidgetRegistry')) {
    throw new Error('expected Flow Editor runtime to include base widget registry in merged form resolution')
  }
}

export function testFloatingPropsPanelUsesMergedDataflowRegistry() {
  const floatingPropsPanelPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'FloatingPropsPanel.tsx')
  const floatingPropsModelPath = resolve(process.cwd(), 'src', 'lib', 'toolbar', 'useFloatingPropsPanelModel.impl.ts')
  const mediaSpecPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'graph-elements', 'mediaSpec.ts')
  const mediaPropertiesPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'graph-elements', 'mediaProperties.ts')
  const text = readFileSync(floatingPropsPanelPath, 'utf8')
  const modelText = readFileSync(floatingPropsModelPath, 'utf8')
  const mediaSpecText = readFileSync(mediaSpecPath, 'utf8')
  const mediaPropertiesText = readFileSync(mediaPropertiesPath, 'utf8')

  if (!text.includes('effectiveWidgetRegistry')) {
    throw new Error('expected FloatingPropsPanel widget palette to reuse the store effective widget registry SSOT')
  }
  if (text.includes('buildDataflowWidgetRegistry')) {
    throw new Error('expected FloatingPropsPanel to avoid rebuilding a duplicate merged widget registry locally')
  }
  if (!text.includes('.filter(e => e && e.isEnabled)')) {
    throw new Error('expected FloatingPropsPanel widget palette to filter enabled entries from the effective widget registry')
  }
  if (!text.includes('NODE_MEDIA_KINDS')) {
    throw new Error('expected FloatingPropsPanel media kind options to reuse the shared canonical node media kind list')
  }
  if (!modelText.includes('DEFAULT_NODE_MEDIA_KIND')) {
    throw new Error('expected FloatingPropsPanel model to reuse the shared default node media kind')
  }
  if (!modelText.includes("buildScopedGraphSemanticKey('floating-props-panel-graph'")) {
    throw new Error('expected FloatingPropsPanel model to key lookup reuse from the shared semantic graph signature helper')
  }
  if (!modelText.includes('preferCurrentGraphDataRefs: true')) {
    throw new Error('expected FloatingPropsPanel model to preserve current graph references when the semantic lookup cache refreshes')
  }
  if (!mediaSpecText.includes('patchNodeMediaProperties') || !mediaPropertiesText.includes('export function patchNodeMediaProperties')) {
    throw new Error('expected mediaSpec SSOT to expose a shared node-media property patch helper')
  }
  if (!modelText.includes("from '@/lib/canvas/graph-elements/mediaSpec'")) {
    throw new Error('expected FloatingPropsPanel model to import node-media helpers from the mediaSpec SSOT')
  }
  if (!modelText.includes('patchNodeMediaProperties({')) {
    throw new Error('expected FloatingPropsPanel model to reuse the shared node-media property patch helper for update and add-media flows')
  }
}

export function testRichMediaPanelMarkdownPreviewDisablesGlobalTokenStoreSync() {
  const richMediaPanelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const markdownPreviewPath = resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'MarkdownPreview.tsx')
  const cardMarkdownPreviewPath = resolve(process.cwd(), 'src', 'lib', 'cards', 'CardMarkdownPreview.tsx')
  const panelText = readFileSync(richMediaPanelPath, 'utf8')
  const previewText = readFileSync(markdownPreviewPath, 'utf8')
  const cardMarkdownPreviewText = readFileSync(cardMarkdownPreviewPath, 'utf8')

  if (!panelText.includes('<CardMarkdownPreview') || !cardMarkdownPreviewText.includes('markdownTokenStoreSync={false}')) {
    throw new Error('expected RichMediaPanel markdown view to reuse CardMarkdownPreview with global markdown token store sync disabled')
  }
  if (!previewText.includes('markdownTokenStoreSync?: boolean')) {
    throw new Error('expected MarkdownPreview to expose an explicit markdown token store sync gate')
  }
  if (!previewText.includes('markdownTokenStoreSync = true')) {
    throw new Error('expected MarkdownPreview to preserve existing token-store sync behavior by default')
  }
  if (!panelText.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })')) {
    throw new Error('expected RichMediaPanel to use canonical workspace overlay-open state instead of workspace editor mode alone')
  }
  if (!panelText.includes('const allowPanelContentPointerEvents = !workspaceEditorOverlayOpen || flowEditorInteractionMode === true || isFlowEditorRenderer === true')) {
    throw new Error('expected RichMediaPanel to keep content pointer interactions enabled in FlowEditor interaction mode for in-panel scrolling')
  }
  if (!panelText.includes('data-kg-media-scroll-surface="1"')) {
    throw new Error('expected RichMediaPanel markdown preview container to self-declare scroll-surface marker for overlay-pan gating')
  }
  if (!panelText.includes('data-kg-canvas-wheel-ignore="true"')) {
    throw new Error('expected RichMediaPanel markdown preview container to opt into the shared canvas wheel-ignore contract like MainPanel scroll surfaces')
  }
  if (!panelText.includes("overflowY: 'auto'")) {
    throw new Error('expected RichMediaPanel markdown preview container to use vertical auto overflow like MainPanel settings bodies')
  }
  if (!panelText.includes("overflowX: 'hidden'")) {
    throw new Error('expected RichMediaPanel markdown preview container to keep horizontal overflow hidden like MainPanel settings bodies')
  }
  if (!panelText.includes('const flowEditorInteractionMode = flowEditorOverlayProxyMode || flowEditorFrontmatterDocumentMode')) {
    throw new Error('expected RichMediaPanel selection/scroll interactivity gate to accept Flow Editor interaction and frontmatter document overlay semantics')
  }
  if (!panelText.includes("import { useShallow } from 'zustand/react/shallow'")) {
    throw new Error('expected RichMediaPanel to reuse zustand shallow selectors for hot-path store subscriptions')
  }
  if (!panelText.includes('} = useGraphStore(\n    useShallow(s => ({')) {
    throw new Error('expected RichMediaPanel to consolidate hot-path store reads behind one shallow store selector')
  }
  if (panelText.includes('const richMediaPanelMode = useGraphStore(s => s.richMediaPanelMode)')) {
    throw new Error('expected RichMediaPanel to remove per-field store subscriptions after the shared shallow selector was introduced')
  }
  if (panelText.includes('const selectedNodeId = useGraphStore(s => s.selectedNodeId)')) {
    throw new Error('expected RichMediaPanel selection state to come from the shared shallow selector instead of a separate subscription')
  }
  if (panelText.includes('selectedNodeIds: s.selectedNodeIds ?? EMPTY_STRING_ARRAY')) {
    throw new Error('expected RichMediaPanel shared shallow selector to avoid stale selected-node fallback subscriptions')
  }
}

export function testFlowCanvasRichMediaResizeUsesCanonicalSelectionMatch() {
  const flowCanvasStatePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts')
  const flowCanvasOverlayPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const stateText = readFileSync(flowCanvasStatePath, 'utf8')
  const overlayText = readFileSync(flowCanvasOverlayPath, 'utf8')

  if (!stateText.includes("buildCanonicalNodeIdSet")) {
    throw new Error('expected FlowCanvas graph state to reuse shared canonical node-id set helpers for overlay selection')
  }
  if (!stateText.includes('const selectedOverlayNodeIds = React.useMemo(() => {')) {
    throw new Error('expected FlowCanvas to derive canonical overlay selection ids from store-selected node id and selected node-id set')
  }
  if (!stateText.includes('return buildCanonicalNodeIdSet(selectedOverlayNodeIds)')) {
    throw new Error('expected FlowCanvas graph state to memoize a canonical selected-overlay id set instead of rescanning media nodes')
  }
  if (!overlayText.includes("from '@/lib/graph/canonicalNodeIds'") || !overlayText.includes('canonicalNodeIdSetHas')) {
    throw new Error('expected FlowCanvas media overlays to reuse shared canonical node-id set membership helper')
  }
  if (!overlayText.includes('const isSelected = canonicalNodeIdSetHas(selectedOverlayNodeIdSet, node.id)')) {
    throw new Error('expected FlowCanvas media overlay selection checks to use shared canonical set membership instead of ad hoc rescans')
  }
  if (!stateText.includes("const flowEditorOverlayInteractionMode = canvas2dRenderer === 'flowEditor'")) {
    throw new Error('expected FlowCanvas overlay interactions to use renderer-level FlowEditor gate as interaction SSOT')
  }
  if (!overlayText.includes("const mediaOverlayDragInteractionMode = canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'flowCanvas'")) {
    throw new Error('expected FlowCanvas media overlay pan/drag handlers to use the renderer-level Flow Editor/Flow Canvas interaction gate')
  }
  if (overlayText.includes('isFlowEditorFrontmatterInteractionMode')) {
    throw new Error('expected FlowCanvas rich-media overlay runtime to remove stale frontmatter-only interaction gate references')
  }
  if (!overlayText.includes("const resizeHandleVisible = resizeInteractionActive && (isSelected || canvas2dRenderer === 'flowCanvas')")) {
    throw new Error('expected RichMediaPanel resize affordance to use canonicalized selection while allowing Flow Canvas rich-media panels to expose the shared handle')
  }
  if (!overlayText.includes('resizable={resizeHandleVisible}')) {
    throw new Error('expected RichMediaPanel resize affordance to be wired through the shared resizeHandleVisible gate')
  }
}

export function testRichMediaPanelOverlayPanSkipsResizeAndScrollTargets() {
  const richMediaPanelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(richMediaPanelPath, 'utf8')

  if (!text.includes("pointerEvents: shouldHideSurfaceUntilReady ? 'none' : (headerPassthrough ? 'none' : (workspaceEditorOverlayOpen || canvasOverlayProxyEnabled ? 'auto'")) {
    throw new Error('expected RichMediaPanel root pointer events to stay enabled for shared overlay pan/drag handlers')
  }
  if (!text.includes("from 'grph-shared/dom/overlayPointerGuards'")
    || !text.includes('readOverlayPointerTargetState')
    || !text.includes('shouldBlockOverlayPanTarget(pointerTarget, { scrollSurfaceCanForwardPointer })')) {
    throw new Error('expected RichMediaPanel root pointer-capture path to reuse shared overlay pointer guards for resize/scroll/media/header targets')
  }
  if (text.includes('overlayAlreadySelected')) {
    throw new Error('expected RichMediaPanel body pan to avoid stale selected-first gating so static renderer previews can pan immediately')
  }
}

export function testRichMediaPanelHeaderDragStaysAvailableInPanMode() {
  const checkedSources = [
    {
      label: 'D3 overlay interaction hook',
      path: resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts'),
    },
    {
      label: 'D3 rich media overlay layer',
      path: resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx'),
    },
    {
      label: 'Design markdown overlay',
      path: resolve(process.cwd(), 'src', 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx'),
    },
    {
      label: 'Design media shell controller',
      path: resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useDesignCanvasShellControllers.ts'),
    },
    {
      label: 'Flow Canvas media overlay',
      path: resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx'),
    },
  ]

  for (const source of checkedSources) {
    const text = readFileSync(source.path, 'utf8')
    if (text.includes("canvasPointerMode2d === 'pan'")) {
      throw new Error(`expected ${source.label} to keep Rich Media Panel header drag available in pan mode`)
    }
  }

  const d3HookText = readFileSync(checkedSources[0]!.path, 'utf8')
  const d3LayerText = readFileSync(checkedSources[1]!.path, 'utf8')
  const designOverlayText = readFileSync(checkedSources[2]!.path, 'utf8')
  const designShellText = readFileSync(checkedSources[3]!.path, 'utf8')
  const flowCanvasOverlayText = readFileSync(checkedSources[4]!.path, 'utf8')
  const richMediaPanelText = readFileSync(resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx'), 'utf8')

  const spacePanGuards = [
    ['D3 overlay interaction hook', d3HookText],
    ['D3 rich media overlay layer', d3LayerText],
    ['Design markdown overlay', designOverlayText],
    ['Design media shell controller', designShellText],
  ] as const
  for (const [label, text] of spacePanGuards) {
    if (!text.includes('if (isSpacePanHeld()) return false')) {
      throw new Error(`expected ${label} to preserve the explicit space-pan header drag guard`)
    }
  }
  if (!flowCanvasOverlayText.includes("const mediaOverlayDragInteractionMode = canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'flowCanvas'")) {
    throw new Error('expected Flow Canvas media overlay drag ownership to stay renderer-scoped instead of pointer-mode scoped')
  }
  if (!richMediaPanelText.includes("const isHeaderTarget = !!targetEl?.closest('[data-kg-rich-media-flow-editor-header=\"1\"]')")) {
    throw new Error('expected RichMediaPanel header drag to stay scoped to the reusable Flow Editor card header')
  }
  if (!designOverlayText.includes("const explicitAnchorId = String(anchorByBlockIdRef.current?.[b.id] || '').trim()")) {
    throw new Error('expected Markdown Design rich-media header drag to distinguish explicit graph anchors from local markdown block ids')
  }
  if (
    !designOverlayText.includes('const delegateHeaderDrag = Boolean(')
    || !designOverlayText.includes('explicitAnchorId !== blockId')
    || !designOverlayText.includes('&& (props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd)')
  ) {
    throw new Error('expected Markdown Design rich-media header drag to delegate only when an explicit graph anchor exists')
  }
  if (designOverlayText.includes('const allowDrag = !props.layoutOverride') || designOverlayText.includes('if (!allowDrag) return')) {
    throw new Error('expected Markdown Design rich-media panels to keep local header drag available for unanchored layout-override panels')
  }
  if (
    designOverlayText.includes('onHeaderDragStart={args0 => {\n                if (allowEmbeddedContentInteraction) return')
    || designOverlayText.includes('onHeaderDrag={args0 => {\n                if (allowEmbeddedContentInteraction) return')
    || designOverlayText.includes('onHeaderDragEnd={() => {\n                if (allowEmbeddedContentInteraction) return')
  ) {
    throw new Error('expected Markdown Design rich-media panel header drag to stay available while embedded media content is interactive')
  }
  if (!designOverlayText.includes('blocksRef.current = next') || !designOverlayText.includes('overlayLayoutScheduleRef.current?.()')) {
    throw new Error('expected Markdown Design rich-media local header drag to schedule the shared overlay positioning loop')
  }
  if (
    designOverlayText.includes('const c = getCenter ? getCenter(anchorId) : null')
    || !designOverlayText.includes('const c = explicitAnchorId && explicitAnchorId !== blockId && getCenter ? getCenter(anchorId) : null')
  ) {
    throw new Error('expected Markdown Design rich-media positioning to use graph-node centers only for external anchors')
  }
}

export function testFlowCanvasWheelProxyHonorsWheelIgnoreTargets() {
  const wheelPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'wheelAndGesture.ts')
  const text = readFileSync(wheelPath, 'utf8')
  if (!text.includes('if (ignoreWheelTarget) return')) {
    throw new Error('expected FlowCanvas overlay wheel proxy to always honor canvas wheel-ignore targets and never zoom canvas from RichMediaPanel scroll surfaces')
  }
  if (!text.includes('shouldKeepWidgetInnerPanelWheel(event, overlayRoot)')) {
    throw new Error('expected FlowCanvas overlay wheel proxy to reuse the shared widget inner-panel scroll guard before canvas zoom')
  }
  const iScrollGuard = text.indexOf('shouldKeepWidgetInnerPanelWheel(event, overlayRoot)')
  const iExplicitZoomIntent = text.indexOf('if (event.ctrlKey === true || event.metaKey === true) return true')
  if (iScrollGuard < 0 || iExplicitZoomIntent < 0 || !(iExplicitZoomIntent < iScrollGuard)) {
    throw new Error('expected explicit ctrl/cmd wheel canvas zoom to override RichMediaPanel/widget scroll surfaces')
  }
  const iNativeHandler = text.indexOf('const handleWheel =')
  const iNativeScrollGuard = text.indexOf('shouldKeepWidgetInnerPanelWheel(e)', iNativeHandler)
  const iNativeWheel = text.indexOf('ctx.viewportWheelController.handleWheel(e)', iNativeHandler)
  if (iNativeHandler < 0 || iNativeScrollGuard < 0 || iNativeWheel < 0 || !(iNativeScrollGuard < iNativeWheel)) {
    throw new Error('expected native canvas wheel handling to reuse the shared widget inner-panel scroll guard before canvas zoom')
  }

  const widgetInnerPanelScrollPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'widgetInnerPanelScrolling.ts')
  const widgetInnerPanelScrollText = readFileSync(widgetInnerPanelScrollPath, 'utf8')
  if (
    !widgetInnerPanelScrollText.includes('WIDGET_INNER_PANEL_SCROLL_SURFACE_SELECTOR')
    || !widgetInnerPanelScrollText.includes('isWidgetInnerPanelWheelTarget')
    || !widgetInnerPanelScrollText.includes('shouldKeepWidgetInnerPanelWheel')
    || !widgetInnerPanelScrollText.includes('findWidgetInnerPanelSurfaceAtWheelPoint')
    || !widgetInnerPanelScrollText.includes('document.elementFromPoint')
    || !widgetInnerPanelScrollText.includes('document.querySelectorAll(WIDGET_INNER_PANEL_SCROLL_SURFACE_SELECTOR)')
    || !widgetInnerPanelScrollText.includes("return true")
    || !widgetInnerPanelScrollText.includes('allowModifierZoom: false')
  ) {
    throw new Error('expected shared widget inner-panel scrolling utility to consume wheel over RichMediaPanel scroll chrome before canvas zoom')
  }
}

export function testFlowEditorCanvasRunSetsSharedOutputLoadingState() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const workflowRunActionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRunAction.ts')
  const renderGraphHelperPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts')
  const workflowWritebackPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowWriteback.ts')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')
  const workflowRunActionText = readFileSync(workflowRunActionPath, 'utf8')
  const renderGraphHelperText = readFileSync(renderGraphHelperPath, 'utf8')
  const workflowWritebackText = readFileSync(workflowWritebackPath, 'utf8')
  if (!workflowWritebackText.includes('export function setFlowEditorWorkflowRunLoadingStateForKnownNodeIds(args: {') || !workflowWritebackText.includes("kind?: FlowEditorWorkflowOutputLoadingKind")) {
    throw new Error('expected FlowEditor runtime helper to centralize output loading state patching for run widgets')
  }
  if (!workflowRunActionText.includes("setRunLoadingStateForKnownNodeIds({ loading: true, kind: richMediaKind })")) {
    throw new Error('expected RichMedia widget run path to publish loading state before generation')
  }
  if (!workflowRunActionText.includes("setRunLoadingStateForKnownNodeIds({ loading: true, kind: 'text' })")) {
    throw new Error('expected TextGeneration run path to publish loading state before generation')
  }
  if (!workflowWritebackText.includes("lastRunAt: args.loading === true ? new Date().toISOString() : nodeProps.lastRunAt")) {
    throw new Error('expected shared workflow loading-state helper to stamp lastRunAt so initialization does not masquerade as an active run')
  }
  if (!workflowRunActionText.includes('const publishTextRunOutput = (outputText: string, loading: boolean, outputPath?: string | null) => {')) {
    throw new Error('expected TextGeneration run path to centralize streamed/final output publishing in one SSOT helper')
  }
  if (!workflowRunActionText.includes('const runProvider = normalizedProvider || store.chatProvider')) {
    throw new Error('expected rich-media run dispatch to derive provider from normalized active provider/store value instead of hard-forcing one provider')
  }
  if (!workflowRunActionText.includes("const runEndpointUrl = String(store.chatEndpointUrl || '').trim() || getChatDefaultEndpointUrlForProvider(runProvider)")) {
    throw new Error('expected rich-media run dispatch to resolve endpoint from active store endpoint with provider-scoped fallback')
  }
  if (workflowRunActionText.includes('const runProvider = CHAT_PROVIDER_BYTEPLUS')) {
    throw new Error('expected rich-media run dispatch to remove hardcoded BytePlus provider pinning')
  }
  if (workflowRunActionText.includes('getChatDefaultEndpointUrlForProvider(CHAT_PROVIDER_BYTEPLUS)')) {
    throw new Error('expected rich-media run dispatch to remove BytePlus-only endpoint fallback pinning')
  }
  if (!workflowRunActionText.includes('onText: (nextText) => {')) {
    throw new Error('expected TextGeneration run path to reuse streamed text callback for progressive Rich Media output updates')
  }
  if (!text.includes('args.draftGraphDataRef.current || args.draftGraphData') || !workflowRunActionText.includes('args.readDraftGraphData()')) {
    throw new Error('expected run output updates to prefer latest draft graph state so loading-clear does not wipe freshly published text output')
  }
  if (!workflowWritebackText.includes('if (updated) args.scheduleWorkflowOutputEdgeRefresh()')) {
    throw new Error('expected shared workflow output writes to refresh overlay edges after output/loading writes without forcing layout reseed')
  }
  if (!renderGraphHelperText.includes('export function getCachedFlowEditorWorkflowRunPlan(args: {')) {
    throw new Error('expected FlowEditor runtime helper to centralize run-all workflow plan derivation')
  }
  const workflowRunAllText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowRunAll.ts'), 'utf8')
  if (!workflowRunAllText.includes('const runPlan = getCachedFlowEditorWorkflowRunPlan({')) {
    throw new Error('expected FlowEditor run-all helper to reuse the shared workflow plan')
  }
  if (!workflowRunAllText.includes("import type { UiToastInput } from '@/hooks/store/types'")) {
    throw new Error('expected FlowEditor Run All progress to reuse the shared toast input contract')
  }
  for (const snippet of [
    "const toastId = 'flow-editor-run-all'",
    'const upsertRunAllToast = (toast: Omit<UiToastInput,',
    'ttlMs: null',
    'dismissible: false',
    'busy: true',
    '`Run All starting: 0/${ids.length} nodes. ${phaseSummary}`',
    '`Run All running ${index + 1}/${ids.length}: ${label}`',
    '`Run All completed ${index + 1}/${ids.length}: ${label}`',
    "`Run All complete: ran ${ids.length} node${ids.length === 1 ? '' : 's'}.`",
  ]) {
    if (!workflowRunAllText.includes(snippet)) {
      throw new Error(`expected FlowEditor Run All progress toast contract snippet: ${snippet}`)
    }
  }
  if (workflowRunAllText.includes("args.upsertUiToast({ id: 'flow-editor-run-all-done'")) {
    throw new Error('expected FlowEditor Run All completion to resolve the shared progress toast instead of spawning a separate done toast')
  }
}

export function testRichMediaOverlayPoolIncludesLoadingStateFromNodeAndConnectedSources() {
  const helperPath = resolve(process.cwd(), 'src', 'lib', 'render', 'richMediaPanelState.ts')
  const overlayPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayPool.ts')
  const text = readFileSync(helperPath, 'utf8')
  const overlayText = readFileSync(overlayPath, 'utf8')
  if (!text.includes('type RichMediaPanelOverlayState = {') && !text.includes('export type RichMediaPanelOverlayState = {')) {
    throw new Error('expected shared rich media panel state helper to define RichMediaPanel overlay state type')
  }
  if (!text.includes('isLoading: boolean')) {
    throw new Error('expected RichMediaPanel overlay state to include shared loading boolean')
  }
  if (!text.includes('loadingLabel: string')) {
    throw new Error('expected RichMediaPanel overlay state to include shared loading label')
  }
  if (!text.includes('readLoadingStateFromNode')) {
    throw new Error('expected shared rich media panel state helper to reuse node loading state helper for panel loading SSOT')
  }
  if (!text.includes("const runSignal = typeof props.lastRunAt === 'string' ? props.lastRunAt.trim() : ''")) {
    throw new Error('expected Rich Media loading SSOT to require a run-scoped lastRunAt signal before showing animated loading state')
  }
  if (!overlayText.includes('buildRichMediaPanelOverlayState({')) {
    throw new Error('expected media overlay pool to reuse the shared Rich Media panel state builder')
  }
}

export function testRichMediaAutoRenderMapsTextConnectionsToOutputSsot() {
  const mapped = resolveRichMediaConnectedRenderSchemaPath({
    schemaPath: 'properties.text',
    connectedValue: {
      value: 'Hello rich media output',
      sources: [{ edgeId: 'e1', nodeId: 'text-widget', portKey: 'output' }],
    },
  })
  if (mapped !== 'properties.output') {
    throw new Error(`expected text connections to map to properties.output SSOT, got ${mapped}`)
  }
}

export function testRichMediaPanelFreezeModeFallsBackToConnectedTextWhenLocalEmpty() {
  const richMediaPanelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(richMediaPanelPath, 'utf8')
  if (!text.includes('if (panelFreezeConnectedOutput) return panelDraftText || panel.text || panel.connectedText || \'\'')) {
    throw new Error('expected RichMediaPanel freeze text mode to fall back to connected text when local output is empty')
  }
}

export function testRichMediaOverlayPoolTreatsConnectedOutputAsTextPresence() {
  const helperPath = resolve(process.cwd(), 'src', 'lib', 'render', 'richMediaPanelState.ts')
  const text = readFileSync(helperPath, 'utf8')
  if (!text.includes("const connectedText = normalizeConnectedTextValue(connectedValuesBySchemaPath?.['properties.output']?.value)")) {
    throw new Error('expected shared rich media panel state helper to normalize connected output values into text for Rich Media panel state')
  }
  if (!text.includes('hasText: Boolean(text.trim() || outputSrcDoc.trim() || connectedText.trim())')) {
    throw new Error('expected Rich Media panel hasText state to include connected output text presence')
  }
}

export function testBuildDataflowWidgetRegistryMergesPartialDocumentWithFallback() {
  const merged = buildDataflowWidgetRegistry({
    documentWidgetRegistry: [
      { id: 'doc-panel', isEnabled: true, nodeTypeId: 'RichMediaPanel', widgetTypeId: 'default', formId: 'richMediaPanel', fields: [], ports: [], updatedAt: '2026-04-23T00:00:00.000Z' },
    ],
    effectiveWidgetRegistry: [
      { id: 'eff-openai', isEnabled: true, nodeTypeId: 'TextGeneration', widgetTypeId: 'default', formId: 'textGeneration.openai', fields: [], ports: [], updatedAt: '2026-04-23T00:00:00.000Z' },
    ],
    widgetRegistry: [
      { id: 'base-openai', isEnabled: true, nodeTypeId: 'TextGeneration', widgetTypeId: 'default', formId: 'textGeneration.openai', fields: [], ports: [], updatedAt: '2026-04-23T00:00:00.000Z' },
    ],
  })
  const ids = new Set(merged.map(entry => String(entry.id || '').trim()))
  if (!ids.has('doc-panel')) throw new Error('expected merged registry to keep document-scoped entries')
  if (!ids.has('eff-openai')) throw new Error('expected merged registry to include effective fallback entries when document registry is partial')
}

export function testBuildDataflowWidgetRegistryPrefersRicherEntryForSameShapeAcrossSources() {
  const merged = buildDataflowWidgetRegistry({
    documentWidgetRegistry: [
      {
        id: 'doc-openai-incomplete',
        isEnabled: true,
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration.openai',
        fields: [],
        ports: [],
        schemaMappings: [],
        updatedAt: '2026-04-24T10:00:00.000Z',
      },
    ],
    effectiveWidgetRegistry: [
      {
        id: 'eff-openai-rich',
        isEnabled: true,
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration.openai',
        fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
        ports: [{ portKey: 'text_out', direction: 'output', schemaPath: 'properties.output' }],
        schemaMappings: [],
        updatedAt: '2026-04-24T09:00:00.000Z',
      },
    ],
    widgetRegistry: [],
  })
  const textOpenAi = merged.filter(entry =>
    String(entry.nodeTypeId || '') === 'TextGeneration'
    && String(entry.widgetTypeId || '') === 'default'
    && String(entry.formId || '') === 'textGeneration.openai',
  )
  if (textOpenAi.length !== 1) throw new Error(`expected one canonical TextGeneration openai entry, got ${textOpenAi.length}`)
  if (String(textOpenAi[0]?.id || '') !== 'eff-openai-rich') {
    throw new Error('expected richer same-shape entry to replace incomplete duplicate across registry sources')
  }
}

export function testBuildDataflowWidgetRegistryReusesSemanticCacheForEquivalentInputs() {
  const buildArgs = (): Parameters<typeof buildDataflowWidgetRegistry>[0] => ({
    documentWidgetRegistry: [
      {
        id: 'doc-openai',
        isEnabled: true,
        nodeTypeId: 'TextGeneration',
        widgetTypeId: 'default',
        formId: 'textGeneration.openai',
        fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
        ports: [{ portKey: 'text_out', direction: 'output', schemaPath: 'properties.output' }],
        schemaMappings: [],
        updatedAt: '2026-04-24T10:00:00.000Z',
      },
    ],
    effectiveWidgetRegistry: [
      {
        id: 'eff-image',
        isEnabled: true,
        nodeTypeId: 'ImageGeneration',
        widgetTypeId: 'default',
        formId: 'imageGeneration.default',
        fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
        ports: [],
        schemaMappings: [],
        updatedAt: '2026-04-24T09:00:00.000Z',
      },
    ],
    widgetRegistry: [],
  })

  const mergedA = buildDataflowWidgetRegistry(buildArgs())
  const mergedB = buildDataflowWidgetRegistry(buildArgs())
  if (mergedA !== mergedB) {
    throw new Error('expected buildDataflowWidgetRegistry to reuse semantic cache for equivalent registry content')
  }
}
