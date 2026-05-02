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

export function testFlowEditorCanvasTextRunUsesSharedRichMediaOutputPatch() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const workflowActionsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const text = `${readFileSync(flowEditorCanvasPath, 'utf8')}\n${readFileSync(workflowActionsPath, 'utf8')}`

  if (!text.includes('buildTextWidgetOutputPatch')) {
    throw new Error('expected FlowEditorCanvas text widget run path to reuse shared text-widget rich-media output patch helper')
  }
  if (!text.includes('...clearRichMediaOutputProperties(nodeProps)')) {
    throw new Error('expected FlowEditorCanvas text widget run path to clear stale rich-media output properties before writing next output')
  }
  if (!text.includes('...buildTextWidgetOutputPatch({')) {
    throw new Error('expected FlowEditorCanvas text widget run path to write shared rich-media panel output metadata')
  }
}

export function testFlowEditorCanvasRunTargetsWritableNodeIdForComposedGraphs() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const workflowActionsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const text = `${readFileSync(flowEditorCanvasPath, 'utf8')}\n${readFileSync(workflowActionsPath, 'utf8')}`

  if (!text.includes('splitComposedNodeId')) {
    throw new Error('expected FlowEditorCanvas run path to normalize composed node ids before writeback')
  }
  if (!text.includes('const writableNodeId = pickWritableNodeId() || resolvedNodeId')) {
    throw new Error('expected FlowEditorCanvas run path to resolve a writable node id in the active draft graph')
  }
  if (!text.includes('updateRunOutputForKnownNodeIds')) {
    throw new Error('expected FlowEditorCanvas run path to write outputs via canonical id updater')
  }
  if (!text.includes('args.draftGraphDataRef.current = nextDraft')) {
    throw new Error('expected FlowEditorCanvas run path to update live draft graph ref output before renderer recompute')
  }
  if (!text.includes('args.setDraftGraphData(prev => (prev === currentDraft ? nextDraft : args.draftGraphDataRef.current))')) {
    throw new Error('expected FlowEditorCanvas run path to preserve live draft ref as SSOT while React state catches up')
  }
  if (!text.includes('function bumpDraftGraphDataRevision(graphData: GraphData): GraphData')) {
    throw new Error('expected FlowEditorCanvas run path to bump draft graph revision for output cache invalidation')
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
  const graphTableInspectorPath = resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'GraphTableInspector.tsx')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const flowDataflowText = readFileSync(flowDataflowPath, 'utf8')
  const flowCanvasStateText = readFileSync(flowCanvasStatePath, 'utf8')
  const overlays2dText = readFileSync(overlays2dPath, 'utf8')
  const previewPanelText = readFileSync(previewPanelPath, 'utf8')
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
  if (!previewPanelText.includes('graphSemanticKey,')) {
    throw new Error('expected PreviewPanelView graph media path to thread a semantic graph key into connected-value caching')
  }
  if (!graphTableInspectorText.includes('graphSemanticKey,')) {
    throw new Error('expected GraphTableInspector widget preview path to thread a semantic graph key into connected-value caching')
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
  const graphData = {
    type: 'application/json',
    nodes: [
      { id: 'group-a::node-a', type: 'TextGeneration', properties: {} },
      { id: 'node-b', type: 'ImageGeneration', properties: {} },
      { id: 'section-1', type: 'Section', properties: {} },
      { id: 'node-c', type: 'VideoGeneration', properties: {} },
    ],
    edges: [],
  } as const
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
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const workflowActionsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const text = `${readFileSync(flowEditorCanvasPath, 'utf8')}\n${readFileSync(workflowActionsPath, 'utf8')}`

  if (!text.includes('buildDataflowWidgetRegistry')) {
    throw new Error('expected FlowEditorCanvas to use shared dataflow registry merger')
  }
  if (!text.includes('documentWidgetRegistry: Array.isArray(store.documentWidgetRegistry)')) {
    throw new Error('expected FlowEditorCanvas run path to include document widget registry in merged dataflow registry')
  }
  if (!text.includes('effectiveWidgetRegistry: Array.isArray(store.effectiveWidgetRegistry)')) {
    throw new Error('expected FlowEditorCanvas run path to include effective widget registry in merged dataflow registry')
  }
  if (!text.includes('widgetRegistry: Array.isArray(store.widgetRegistry)')) {
    throw new Error('expected FlowEditorCanvas run path to include base widget registry in merged dataflow registry')
  }
}

export function testNodeOverlayEditorUsesMergedDataflowRegistry() {
  const nodeOverlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(nodeOverlayEditorPath, 'utf8')

  if (!text.includes('buildDataflowWidgetRegistry')) {
    throw new Error('expected NodeOverlayEditor to resolve widget forms from shared merged dataflow registry')
  }
  if (!text.includes('documentWidgetRegistry: (s.documentWidgetRegistry')) {
    throw new Error('expected NodeOverlayEditor to include document widget registry in merged form resolution')
  }
  if (!text.includes('effectiveWidgetRegistry: (s.effectiveWidgetRegistry')) {
    throw new Error('expected NodeOverlayEditor to include effective widget registry in merged form resolution')
  }
  if (!text.includes('widgetRegistry: baseWidgetRegistry')) {
    throw new Error('expected NodeOverlayEditor to include base widget registry in merged form resolution')
  }
}

export function testFloatingPropsPanelUsesMergedDataflowRegistry() {
  const floatingPropsPanelPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'FloatingPropsPanel.tsx')
  const floatingPropsModelPath = resolve(process.cwd(), 'src', 'lib', 'toolbar', 'useFloatingPropsPanelModel.impl.ts')
  const mediaSpecPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'graph-elements', 'mediaSpec.ts')
  const text = readFileSync(floatingPropsPanelPath, 'utf8')
  const modelText = readFileSync(floatingPropsModelPath, 'utf8')
  const mediaSpecText = readFileSync(mediaSpecPath, 'utf8')

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
  if (!mediaSpecText.includes('export function patchNodeMediaProperties')) {
    throw new Error('expected mediaSpec SSOT to expose a shared node-media property patch helper')
  }
  if (!modelText.includes('patchNodeMediaProperties({')) {
    throw new Error('expected FloatingPropsPanel model to reuse the shared node-media property patch helper for update and add-media flows')
  }
}

export function testRichMediaPanelMarkdownPreviewDisablesGlobalTokenStoreSync() {
  const richMediaPanelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const markdownPreviewPath = resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'MarkdownPreview.tsx')
  const panelText = readFileSync(richMediaPanelPath, 'utf8')
  const previewText = readFileSync(markdownPreviewPath, 'utf8')

  if (!panelText.includes('markdownTokenStoreSync={false}')) {
    throw new Error('expected RichMediaPanel markdown view to disable global markdown token store sync to avoid cross-surface token churn')
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
  if (!overlayText.includes("import { canonicalNodeIdSetHas } from '@/lib/graph/canonicalNodeIds'")) {
    throw new Error('expected FlowCanvas media overlays to reuse shared canonical node-id set membership helper')
  }
  if (!overlayText.includes('const isSelected = canonicalNodeIdSetHas(selectedOverlayNodeIdSet, node.id)')) {
    throw new Error('expected FlowCanvas media overlay selection checks to use shared canonical set membership instead of ad hoc rescans')
  }
  if (!stateText.includes("const flowEditorOverlayInteractionMode = canvas2dRenderer === 'flowEditor'")) {
    throw new Error('expected FlowCanvas overlay interactions to use renderer-level FlowEditor gate as interaction SSOT')
  }
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(flowCanvasPath, 'utf8')
  if (!text.includes('const isFlowEditorOverlayInteractionMode = React.useCallback(() => {')) {
    throw new Error('expected FlowCanvas overlay runtime handlers to share the renderer-level FlowEditor interaction gate')
  }
  if (text.includes('isFlowEditorFrontmatterInteractionMode')) {
    throw new Error('expected FlowCanvas rich-media overlay runtime to remove stale frontmatter-only interaction gate references')
  }
  if (!text.includes('resizable={flowEditorOverlayInteractionMode && isSelected}')) {
    throw new Error('expected RichMediaPanel resize affordance to remain gated by canonicalized selection under FlowEditor overlay interaction mode')
  }
}

export function testRichMediaPanelOverlayPanSkipsResizeAndScrollTargets() {
  const richMediaPanelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(richMediaPanelPath, 'utf8')

  if (!text.includes("import { isCanonicalNodeIdEqual } from '@/lib/graph/canonicalNodeIds'")) {
    throw new Error('expected RichMediaPanel root interaction gate to reuse shared canonical selection equality before enabling overlay pan')
  }
  if (!text.includes('const overlayAlreadySelected = React.useMemo(() => {')) {
    throw new Error('expected RichMediaPanel body interactions to derive whether the overlay is already selected before starting overlay pan')
  }
  if (!text.includes("const isResizeHandleTarget = !!targetEl?.closest('[data-kg-resize-handle]')")) {
    throw new Error('expected RichMediaPanel root pointer-capture path to detect resize-handle targets before overlay pan start')
  }
  if (!text.includes("const isScrollableSurfaceTarget = !!targetEl?.closest('[data-kg-media-scroll-surface=\"1\"]')")) {
    throw new Error('expected RichMediaPanel root pointer-capture path to detect scroll-surface targets before overlay pan start')
  }
  if (!text.includes('const blockOverlayPanForTarget =')) {
    throw new Error('expected RichMediaPanel root pointer-capture path to gate overlay pan for resize/scroll/interactive targets')
  }
  if (!text.includes('overlayAlreadySelected')) {
    throw new Error('expected RichMediaPanel body click to select first and only arm overlay pan after the panel is already selected')
  }
}

export function testFlowCanvasWheelProxyHonorsWheelIgnoreTargets() {
  const wheelPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'wheelAndGesture.ts')
  const text = readFileSync(wheelPath, 'utf8')
  if (!text.includes('if (ignoreWheelTarget) return')) {
    throw new Error('expected FlowCanvas overlay wheel proxy to always honor canvas wheel-ignore targets and never zoom canvas from RichMediaPanel scroll surfaces')
  }
  if (!text.includes('if (event.ctrlKey === true || event.metaKey === true) return true')) {
    throw new Error('expected explicit ctrl/cmd wheel zoom intent over rich media overlays to proxy to canvas zoom before scroll handling')
  }
}

export function testFlowEditorCanvasRunSetsSharedOutputLoadingState() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')
  if (!text.includes('const setRunLoadingStateForKnownNodeIds =') || !text.includes("kind?: 'text' | 'image' | 'video'")) {
    throw new Error('expected FlowEditorCanvas run path to centralize output loading state patching for run widgets')
  }
  if (!text.includes("setRunLoadingStateForKnownNodeIds({ loading: true, kind: richMediaKind })")) {
    throw new Error('expected RichMedia widget run path to publish loading state before generation')
  }
  if (!text.includes("setRunLoadingStateForKnownNodeIds({ loading: true, kind: 'text' })")) {
    throw new Error('expected TextGeneration run path to publish loading state before generation')
  }
  if (!text.includes("lastRunAt: loadingArgs.loading === true ? new Date().toISOString() : nodeProps.lastRunAt")) {
    throw new Error('expected run-scoped Rich Media loading state to stamp lastRunAt so initialization does not masquerade as an active run')
  }
  if (!text.includes('const publishTextRunOutput = (outputText: string, loading: boolean) => {')) {
    throw new Error('expected TextGeneration run path to centralize streamed/final output publishing in one SSOT helper')
  }
  if (!text.includes('onText: (nextText) => {')) {
    throw new Error('expected TextGeneration run path to reuse streamed text callback for progressive Rich Media output updates')
  }
  if (!text.includes('args.draftGraphDataRef.current || args.draftGraphData')) {
    throw new Error('expected run output updates to prefer latest draft graph state so loading-clear does not wipe freshly published text output')
  }
  if (!text.includes('scheduleWorkflowOutputEdgeRefresh()')) {
    throw new Error('expected run output updates to refresh overlay edges after output/loading writes without forcing layout reseed')
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
  if (!text.includes('hasText: Boolean(output.trim() || outputSrcDoc.trim() || connectedText.trim())')) {
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
  const buildArgs = () => ({
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
