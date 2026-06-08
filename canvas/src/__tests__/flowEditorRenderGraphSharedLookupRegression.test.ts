import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorRenderGraphHelperBecomesRuntimeSsot() {
  const helperPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const selectionBookkeepingPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorSelectionBookkeeping.ts')
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const overlayEdgesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const workflowActionsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const workflowRichMediaPanelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRichMediaPanel.ts')
  const workflowRunInputsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRunInputs.ts')
  const workflowWritebackPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowWriteback.ts')

  const helperText = readFileSync(helperPath, 'utf8')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  const selectionBookkeepingText = readFileSync(selectionBookkeepingPath, 'utf8')
  const collisionText = readFileSync(collisionPath, 'utf8')
  const overlayEdgesText = readFileSync(overlayEdgesPath, 'utf8')
  const workflowActionsText = readFileSync(workflowActionsPath, 'utf8')
  const workflowRichMediaPanelText = readFileSync(workflowRichMediaPanelPath, 'utf8')
  const workflowRunInputsText = readFileSync(workflowRunInputsPath, 'utf8')
  const workflowWritebackText = readFileSync(workflowWritebackPath, 'utf8')

  if (!helperText.includes('export function getCachedFlowEditorRenderGraph(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize render-graph lookup derivation in a shared helper')
  }
  if (!helperText.includes('const graphSemanticKey = buildScopedGraphSemanticKey(scope, {')) {
    throw new Error('expected FlowEditor render-graph helper to derive one semantic key per scoped graph snapshot')
  }
  if (!helperText.includes('cacheScope: scope,') || !helperText.includes('getCachedGraphLookup({')) {
    throw new Error('expected FlowEditor render-graph helper to own the shared graph lookup reuse contract')
  }
  if (!helperText.includes('incidentEdgesByNodeId: baseLookup.incidentEdgesByNodeId')) {
    throw new Error('expected FlowEditor render-graph helper to carry forward cached incident-edge summaries')
  }
  if (!helperText.includes('eligibleNodeIds: buildFlowWidgetEligibleNodeIdSet(nodes)')) {
    throw new Error('expected FlowEditor render-graph helper to own widget-eligibility summary derivation')
  }
  if (!helperText.includes('const nodeIdsByInnerId = new Map<string, string[]>()')) {
    throw new Error('expected FlowEditor render-graph helper to own canonical inner-id alias indexing')
  }
  if (!helperText.includes('export function getCachedFlowEditorOverlayEdgeGraph(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize overlay-edge filtered graph derivation in the shared helper')
  }
  if (!helperText.includes("scope: 'flow-editor-overlay-edges-base-graph'")) {
    throw new Error('expected FlowEditor overlay-edge helper to derive its filtered subset from the shared render-graph SSOT')
  }
  if (!helperText.includes('const nodeHandleSemanticKey = buildOverlayNodeHandleSignature(baseGraph.nodes)')) {
    throw new Error('expected FlowEditor overlay-edge helper to key cache invalidation from live node handle semantics')
  }
  if (!helperText.includes("const cacheKey = hashSignatureParts([\n    'overlay-graph-lookup',")) {
    throw new Error('expected FlowEditor overlay-edge helper to cache filtered node and edge subsets by semantic overlay-node signature')
  }
  if (!helperText.includes('const defaultPortKeyByNodeId = new Map<string, { in: string; out: string }>()')) {
    throw new Error('expected FlowEditor overlay-edge helper to own default port fallback derivation')
  }
  if (!helperText.includes('const rawEdgeById = new Map<string, GraphEdge>()')) {
    throw new Error('expected FlowEditor overlay-edge helper to own raw edge lookups for downstream style resolution')
  }
  if (!helperText.includes('export function getCachedFlowEditorWidgetPlacementContext(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize widget placement context derivation in the shared helper')
  }
  if (!helperText.includes("scope: 'flow-editor-widget-placement-base-graph'")) {
    throw new Error('expected FlowEditor widget placement context to derive from the shared render-graph SSOT')
  }
  if (!helperText.includes("const cacheKey = hashSignatureParts([\n    'flow-editor-widget-placement-context',")) {
    throw new Error('expected FlowEditor widget placement context to be cached by semantic graph and open-widget signatures')
  }
  if (!helperText.includes('const defaultPinnedInCanvas = resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind })')) {
    throw new Error('expected FlowEditor widget placement context to own shared default pinning decisions')
  }
  if (!helperText.includes('const frontmatterOverlayNodeIds = isFrontmatterFlow')) {
    throw new Error('expected FlowEditor widget placement context to own frontmatter overlay node derivation')
  }
  if (!helperText.includes('const effectiveOpenWidgetNodeIds = isFrontmatterFlow')) {
    throw new Error('expected FlowEditor widget placement context to own effective open-widget resolution')
  }
  if (!helperText.includes('export function getCachedFlowEditorWorkflowRunPlan(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize workflow run-all planning in the shared helper')
  }
  if (!helperText.includes("scope: 'flow-editor-workflow-actions-draft-graph'")) {
    throw new Error('expected FlowEditor workflow run-all planning to derive from the shared draft render-graph snapshot')
  }
  if (!helperText.includes("const cacheKey = hashSignatureParts([\n    'flow-editor-workflow-run-plan',")) {
    throw new Error('expected FlowEditor workflow run-all planning to cache by semantic draft graph signature')
  }
  if (!helperText.includes('const ordered = buildFlowRunAllNodeSequence({')) {
    throw new Error('expected FlowEditor workflow run-all planning to own the shared sequencing derivation')
  }
  if (!helperText.includes('export function getCachedFlowEditorWorkflowNodeResolutionContext(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize workflow single-node cross-graph lookup context in the shared helper')
  }
  if (!helperText.includes("scope: 'flow-editor-workflow-node-resolution-draft-graph'")) {
    throw new Error('expected FlowEditor workflow node-resolution context to derive from shared draft graph snapshots')
  }
  if (!helperText.includes("const cacheKey = hashSignatureParts([\n    'flow-editor-workflow-node-resolution-context',")) {
    throw new Error('expected FlowEditor workflow node-resolution context to cache by semantic multi-graph signatures')
  }
  if (!helperText.includes('export function resolveFlowEditorWorkflowRunTarget(args: {')) {
    throw new Error('expected FlowEditor runtime helper to own initial workflow run-target resolution')
  }
  if (!helperText.includes('export function resolveFlowEditorWorkflowWritableNodeId(args: {')) {
    throw new Error('expected FlowEditor runtime helper to own draft write-target resolution for composed ids')
  }
  if (!helperText.includes('export function resolveFlowEditorWorkflowNodeByIdAcrossGraphs(args: {')) {
    throw new Error('expected FlowEditor runtime helper to own cross-graph node lookup reuse for workflow writes')
  }
  if (!helperText.includes('export function listFlowEditorWorkflowNodesAcrossGraphs(args: {')) {
    throw new Error('expected FlowEditor runtime helper to own cross-graph node aggregation for rich-media panel discovery')
  }
  if (!workflowRichMediaPanelText.includes('export function resolveFlowEditorWorkflowRichMediaPanelTargetNodeId(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize rich-media panel target resolution in a shared helper')
  }
  if (!workflowRichMediaPanelText.includes('export function ensureFlowEditorWorkflowRichMediaPanelNodeId(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize rich-media panel creation fallback in a shared helper')
  }
  if (!workflowRichMediaPanelText.includes('export function applyFlowEditorWorkflowRichMediaPanelDraftPatch(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize rich-media panel draft patch writes in a shared helper')
  }
  if (!workflowRichMediaPanelText.includes('const activePanel = panels.find(n => {')) {
    throw new Error('expected shared rich-media panel helper to own active-panel preference before panel creation fallback')
  }
  if (!workflowRichMediaPanelText.includes('const nextDraft = bumpFlowEditorDraftGraphDataRevision({ ...currentDraft, nodes: nextNodes })')) {
    throw new Error('expected shared rich-media panel helper to reuse the neutral Flow Editor draft revision bump helper')
  }
  if (!workflowRunInputsText.includes('export function resolveFlowEditorWorkflowConnectedValuesInput(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize single-node connected-values input resolution in a shared helper')
  }
  if (!workflowRunInputsText.includes('if (args.context.renderGraph) candidateGraphs.push(args.context.renderGraph)')) {
    throw new Error('expected shared run-input helper to prefer render graph data before other workflow graphs')
  }
  if (!workflowRunInputsText.includes('const resolvedTargetNodeId = String(resolveGraphNodeByCanonicalId(graphData, writableNodeId)?.id || \'\').trim()')) {
    throw new Error('expected shared run-input helper to resolve canonical writable ids against each candidate graph')
  }
  if (!workflowRunInputsText.includes('const connectedValuesByNodeId = computeFlowConnectedValuesBySchemaPath({')) {
    throw new Error('expected shared run-input helper to own connected-values computation after graph selection')
  }
  if (!workflowWritebackText.includes('export function updateFlowEditorWorkflowOutputForKnownNodeIds(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize known-node output writeback in a shared helper')
  }
  if (!workflowWritebackText.includes('export function setFlowEditorWorkflowRunLoadingStateForKnownNodeIds(args: {')) {
    throw new Error('expected FlowEditor runtime to centralize run loading-state writeback in a shared helper')
  }
  if (!workflowWritebackText.includes('export function collectFlowEditorWorkflowCandidateNodeIds(nodeIds: ReadonlyArray<string>): Set<string>')) {
    throw new Error('expected FlowEditor workflow writeback helper to own canonical candidate-id expansion')
  }
  if (!workflowWritebackText.includes('export function areFlowEditorWorkflowRecordValuesEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean')) {
    throw new Error('expected FlowEditor workflow writeback helper to own semantic property equality checks')
  }
  if (!workflowWritebackText.includes("import { bumpFlowEditorDraftGraphDataRevision } from '@/lib/flowEditor/flowEditorDraftGraphData'")) {
    throw new Error('expected FlowEditor workflow writeback helper to reuse neutral draft graph revision bumps for writeback invalidation')
  }
  if (!workflowWritebackText.includes('if (updated) args.scheduleWorkflowOutputEdgeRefresh()')) {
    throw new Error('expected FlowEditor workflow writeback helper to refresh overlay edges only after actual graph-store writes')
  }

  if (!overlaySurfaceText.includes('getCachedFlowEditorRenderGraph,') || !overlaySurfaceText.includes('getCachedFlowEditorWidgetPlacementContext,')) {
    throw new Error('expected FlowEditor overlay surface to consume the shared render-graph and widget placement helpers')
  }
  if (!overlaySurfaceText.includes("scope: 'flow-editor-overlay-surface-render-graph'")) {
    throw new Error('expected FlowEditor overlay surface to request the shared render-graph snapshot under its scoped cache key')
  }
  if (overlaySurfaceText.includes('getCachedGraphLookup({')) {
    throw new Error('expected FlowEditor overlay surface to stop rebuilding local graph lookups')
  }
  if (!overlaySurfaceText.includes('const renderGraphPlacementContext = React.useMemo(() => {')) {
    throw new Error('expected FlowEditor overlay surface to memoize the shared widget placement context')
  }
  if (!overlaySurfaceText.includes('const sorted = renderGraphPlacementContext?.frontmatterOverlayNodeIds || []')) {
    throw new Error('expected FlowEditor overlay surface to reuse shared frontmatter overlay ids')
  }

  if (!selectionBookkeepingText.includes("import { getCachedFlowEditorRenderGraph } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'")) {
    throw new Error('expected FlowEditor selection bookkeeping to consume the shared render-graph helper')
  }
  if (!selectionBookkeepingText.includes("scope: 'flow-editor-selection-bookkeeping-draft-graph'")) {
    throw new Error('expected FlowEditor selection bookkeeping to request the shared render-graph snapshot under its scoped cache key')
  }
  if (selectionBookkeepingText.includes('getCachedGraphLookup({')) {
    throw new Error('expected FlowEditor selection bookkeeping to stop rebuilding local graph lookups')
  }

  if (!collisionText.includes("import { getCachedFlowEditorRenderGraph } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'")) {
    throw new Error('expected FlowEditor overlay collision to consume the shared render-graph helper')
  }
  if (!collisionText.includes("scope: 'flow-editor-overlay-collision-graph'")) {
    throw new Error('expected FlowEditor overlay collision to request the shared render-graph snapshot under its scoped cache key')
  }
  if (!collisionText.includes("nodeTypeId: String(nodeById?.get(id)?.type || '').trim()")) {
    throw new Error('expected FlowEditor overlay collision to read node-type placement hints from the shared node lookup SSOT')
  }
  if (collisionText.includes('getCachedGraphLookup({')) {
    throw new Error('expected FlowEditor overlay collision to stop rebuilding local graph lookups')
  }
  if (collisionText.includes('const nodeTypeById = new Map<string, string>()')) {
    throw new Error('expected FlowEditor overlay collision to stop rescanning raw graph nodes for node-type metadata')
  }

  if (!overlayEdgesText.includes("import {\n  getCachedFlowEditorOverlayEdgeGraph,\n  readCanonicalFlowEditorOverlayIdentity,\n} from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'")) {
    throw new Error('expected FlowEditor overlay edges to consume the shared render-graph helper exports')
  }
  if (!overlayEdgesText.includes('const graphLookup = getCachedFlowEditorOverlayEdgeGraph({')) {
    throw new Error('expected FlowEditor overlay edges to reuse the shared filtered overlay-edge graph helper')
  }
  if (!overlayEdgesText.includes('const graphSemanticKey = graphLookup?.graphSemanticKey || \'\'')) {
    throw new Error('expected FlowEditor overlay edges to reuse the shared filtered graph semantic key for downstream caches')
  }
  if (overlayEdgesText.includes('const overlayGraphLookupCacheRef = React.useRef<{')) {
    throw new Error('expected FlowEditor overlay edges to stop owning a hook-local filtered graph cache')
  }
  if (overlayEdgesText.includes('function buildOverlayNodeHandleSignature(')) {
    throw new Error('expected FlowEditor overlay edges to stop owning local node-handle signature derivation')
  }
  const workflowRunAllPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowRunAll.ts')
  const workflowRunAllText = readFileSync(workflowRunAllPath, 'utf8')
  if (!workflowRunAllText.includes('getCachedFlowEditorWorkflowRunPlan') || !workflowActionsText.includes('getCachedFlowEditorWorkflowNodeResolutionContext,')) {
    throw new Error('expected FlowEditor workflow runtime to consume the shared workflow run-plan and node-resolution helpers')
  }
  if (!workflowRunAllText.includes('const runPlan = getCachedFlowEditorWorkflowRunPlan({')) {
    throw new Error('expected FlowEditor run-all helper to reuse the shared run-all plan instead of rebuilding eligibility locally')
  }
  if (!workflowActionsText.includes('const workflowNodeResolutionContext = getCachedFlowEditorWorkflowNodeResolutionContext({')) {
    throw new Error('expected FlowEditor workflow actions to reuse the shared node-resolution context instead of rebuilding multi-graph lookup order locally')
  }
  if (!workflowActionsText.includes('const resolvedRunTarget = resolveFlowEditorWorkflowRunTarget({')) {
    throw new Error('expected FlowEditor workflow actions to reuse the shared initial run-target resolver')
  }
  if (!workflowActionsText.includes('resolveFlowEditorWorkflowNodeByIdAcrossGraphs({')) {
    throw new Error('expected FlowEditor workflow actions to reuse the shared cross-graph node resolver for output writes')
  }
  if (!workflowActionsText.includes('ensureFlowEditorWorkflowRichMediaPanelNodeId({') || !workflowActionsText.includes('applyFlowEditorWorkflowRichMediaPanelDraftPatch({')) {
    throw new Error('expected FlowEditor workflow actions to reuse the shared rich-media panel helper set instead of owning local panel targeting and patching')
  }
  if (!workflowActionsText.includes('const connectedValuesInput = resolveFlowEditorWorkflowConnectedValuesInput({')) {
    throw new Error('expected FlowEditor workflow actions to reuse the shared connected-values input helper')
  }
  if (!workflowActionsText.includes('updateFlowEditorWorkflowOutputForKnownNodeIds({')) {
    throw new Error('expected FlowEditor workflow actions to reuse the shared output writeback helper')
  }
  if (!workflowActionsText.includes('setFlowEditorWorkflowRunLoadingStateForKnownNodeIds({')) {
    throw new Error('expected FlowEditor workflow actions to reuse the shared loading-state writeback helper')
  }
  if (workflowActionsText.includes('buildFlowWidgetEligibleNodeIdSet(nodes)')) {
    throw new Error('expected FlowEditor workflow actions to stop rebuilding widget eligibility locally for run-all')
  }
  if (workflowActionsText.includes('const ordered = buildFlowRunAllNodeSequence({')) {
    throw new Error('expected FlowEditor workflow actions to stop owning local run-all sequencing')
  }
  if (workflowActionsText.includes('const resolved = [draft, args.renderGraphDataOverride as GraphData | null, args.baseGraphData]')) {
    throw new Error('expected FlowEditor workflow actions to stop rebuilding local initial graph scan order for run targets')
  }
  if (workflowActionsText.includes('const pickWritableNodeId = () => {')) {
    throw new Error('expected FlowEditor workflow actions to stop owning local writable-node resolution logic')
  }
  if (workflowActionsText.includes('const resolveNodeByIdAcrossGraphs = (candidateId: string): GraphNode | null => {\n        const cid = String(candidateId || \'\').trim()')) {
    throw new Error('expected FlowEditor workflow actions to stop owning local cross-graph node lookup loops')
  }
  if (workflowActionsText.includes('const resolveRichMediaPanelTargetNodeId = (): string | null => {')) {
    throw new Error('expected FlowEditor workflow actions to stop owning local rich-media panel target resolution')
  }
  if (workflowActionsText.includes('const ensureRichMediaPanelNodeId = (anchorNode: GraphNode): string | null => {')) {
    throw new Error('expected FlowEditor workflow actions to stop owning local rich-media panel creation fallback')
  }
  if (workflowActionsText.includes('const updatePanelInDraft = (panelId: string, patch: Record<string, unknown>) => {')) {
    throw new Error('expected FlowEditor workflow actions to stop owning local rich-media panel draft patch writeback')
  }
  if (workflowActionsText.includes('computeFlowConnectedValuesBySchemaPath({')) {
    throw new Error('expected FlowEditor workflow actions to stop owning inline connected-values graph selection for single-node runs')
  }
  if (workflowActionsText.includes('function areRecordValuesEqual')) {
    throw new Error('expected FlowEditor workflow actions to stop owning local semantic property equality helpers')
  }
  if (workflowActionsText.includes('function bumpDraftGraphDataRevision(graphData: GraphData): GraphData')) {
    throw new Error('expected FlowEditor workflow actions to stop owning local draft graph revision bump helpers')
  }
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const runtimeSceneText = readFileSync(runtimeScenePath, 'utf8')
  if (!runtimeSceneText.includes("import { getCachedFlowEditorWidgetPlacementContext } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'")) {
    throw new Error('expected FlowEditor runtime scene to consume the shared widget placement context helper')
  }
  if (!runtimeSceneText.includes('const widgetPlacementContext = getCachedFlowEditorWidgetPlacementContext({')) {
    throw new Error('expected FlowEditor runtime scene to reuse the shared widget placement context for frontmatter seeding decisions')
  }
  if (runtimeSceneText.includes("const graphMetaKind = String((((graphDataForSeeding || null)?.metadata || {}) as Record<string, unknown>).kind || '').trim()")) {
    throw new Error('expected FlowEditor runtime scene to stop decoding graphMetaKind directly from raw graph metadata')
  }
  if (runtimeSceneText.includes('deriveFrontmatterFlowOverlayNodeIds(graphDataForSeeding)')) {
    throw new Error('expected FlowEditor runtime scene to stop deriving frontmatter overlay ids locally')
  }
}
