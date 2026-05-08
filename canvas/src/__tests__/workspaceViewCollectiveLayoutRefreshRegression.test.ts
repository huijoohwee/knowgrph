import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testWorkspaceViewUpdateSchedulesFlowEditorCollectiveCollisionRefresh() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes('workspaceViewSig')) {
    throw new Error('expected Flow Editor collective collision key to avoid workspace view signature coupling')
  }
  if (text.includes('workspaceCanvasPaneOpen === true ? 1 : 0')) {
    throw new Error('expected Flow Editor collective collision refresh to avoid workspace pane open state coupling')
  }
  if (!text.includes('const workspaceOverlayOpenRef = React.useRef(false)')) {
    throw new Error('expected Flow Editor collective collision to track workspace overlay open state without key coupling')
  }
  if (!text.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow Editor collective collision to reuse the shared workspace/indexing mutation guard')
  }
  if (!text.includes('isWorkspaceGraphMutationBlocked(useGraphStore.getState())')) {
    throw new Error('expected Flow Editor collective collision to derive Workspace/Indexing mutation state via the shared guard')
  }
  if (!text.includes('if (workspaceOverlayOpenRef.current) return')) {
    throw new Error('expected workspace overlay open state to block persisted Flow Editor widget position mutation')
  }
  const mutationGuardIndex = text.indexOf('if (workspaceOverlayOpenRef.current) return')
  const writebackIndex = text.indexOf('st.setFlowWidgetPosByNodeId(next)')
  if (mutationGuardIndex < 0 || writebackIndex < 0 || mutationGuardIndex > writebackIndex) {
    throw new Error('expected workspace overlay mutation guard before Flow Editor position writeback')
  }
  if (!text.includes('const unsubOpenWidgets = useGraphStore.subscribe(')) {
    throw new Error('expected Flow Editor collective collision to subscribe to open widget ids')
  }
  if (!text.includes('s.openWidgetNodeIds')) {
    throw new Error('expected Flow Editor collective collision refresh subscription to use openWidgetNodeIds')
  }
  const editorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const editorText = readFileSync(editorPath, 'utf8')
  if (!editorText.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected direct Flow Editor widget persistence to reuse the shared workspace/indexing mutation guard')
  }
  const directScreenGuardIndex = editorText.indexOf('if (isWorkspaceGraphMutationBlocked(state)) return')
  const directScreenWritebackIndex = editorText.indexOf('state.setFlowWidgetPosByNodeId(next)')
  if (directScreenGuardIndex < 0 || directScreenWritebackIndex < 0 || directScreenGuardIndex > directScreenWritebackIndex) {
    throw new Error('expected Workspace/Indexing mutation guard before direct Flow Editor screen-position writeback')
  }
  const directWorldGuardIndex = editorText.indexOf('markdownWorkspaceIndexingInFlight?: boolean\n        flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>\n      }\n      if (isWorkspaceGraphMutationBlocked(state)) return')
  const directWorldWritebackIndex = editorText.indexOf('setFlowWidgetWorldPosByNodeId(next)')
  if (directWorldGuardIndex < 0 || directWorldWritebackIndex < 0 || directWorldGuardIndex > directWorldWritebackIndex) {
    throw new Error('expected Workspace/Indexing mutation guard before direct Flow Editor world-position writeback')
  }
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const overlayEdgesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const overlayEdgesText = readFileSync(overlayEdgesPath, 'utf8')
  const worldSeedGuardIndex = runtimeText.indexOf('if (isWorkspaceGraphMutationBlocked(st)) return')
  const worldSeedKeyWriteIndex = runtimeText.indexOf('seededPinnedWidgetWorldPosKeyRef.current = seedKey', worldSeedGuardIndex)
  const worldSeedWriteIndex = runtimeText.indexOf('st.setFlowWidgetWorldPosByNodeId(nextWorld)')
  if (worldSeedGuardIndex < 0 || worldSeedWriteIndex < 0 || worldSeedGuardIndex > worldSeedWriteIndex) {
    throw new Error('expected pinned widget auto-seed world-position persistence to be blocked while Workspace/Indexing mutation guard is active')
  }
  if (worldSeedKeyWriteIndex < 0 || worldSeedGuardIndex > worldSeedKeyWriteIndex || worldSeedKeyWriteIndex > worldSeedWriteIndex) {
    throw new Error('expected pinned widget auto-seed key to be committed only after Workspace/Indexing mutation guard')
  }
  if (runtimeText.includes('const reseedEligible = effectiveOpenIds')) {
    throw new Error('expected pinned widget auto-seed to avoid reseeding already-placed world positions on layout-signature churn')
  }
  if (!runtimeText.includes('const pending = Array.from(new Set([...pendingRaw, ...overlapEligible])).sort((a, b) => a.localeCompare(b))')) {
    throw new Error('expected pinned widget auto-seed to only seed missing or overlapping world positions')
  }

  const renderStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRenderState.ts')
  const renderStateText = readFileSync(renderStatePath, 'utf8')
  if (!renderStateText.includes('const preserveStableGraphAcrossFlowViewClose =')) {
    throw new Error('expected Flow Editor render state to name the stable graph reuse contract for workspace close explicitly')
  }
  if (!renderStateText.includes('prev.topologyLayoutSignature === nextTopologyLayoutSignature')) {
    throw new Error('expected Flow Editor render state to preserve the stable overlay graph only when semantic overlay topology still matches')
  }
  if (!renderStateText.includes('if (preserveStableGraphAcrossFlowViewClose) return stableGraph')) {
    throw new Error('expected Flow Editor render state to reuse the last stable overlay graph during workspace close when topology is unchanged')
  }
  const graphDataSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataCommitActions.ts')
  const graphDataSliceText = readFileSync(graphDataSlicePath, 'utf8')
  if (!graphDataSliceText.includes("import { buildCanonicalNodeLookup, parseCanonicalNodeIds, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'")) {
    throw new Error('expected graph commit carry-forward path to reuse shared canonical node identity helpers for workspace-prefixed graph clones')
  }
  if (!graphDataSliceText.includes('function remapNodeKeyedRecordByCanonicalNodeId<T>(')) {
    throw new Error('expected graph commit carry-forward path to centralize canonical remapping for node-keyed overlay state')
  }
  if (!graphDataSliceText.includes('readCanonicalGraphIdentity(n?.id)')) {
    throw new Error('expected same-source graph topology checks to compare canonical node ids instead of raw workspace-prefixed ids')
  }
  if (!graphDataSliceText.includes("`${readCanonicalGraphIdentity(e?.id)}|${readCanonicalGraphIdentity(e?.source)}|${readCanonicalGraphIdentity(e?.target)}`")) {
    throw new Error('expected same-source graph topology checks to compare canonical edge identities instead of raw workspace-prefixed ids')
  }
  if (!graphDataSliceText.includes('remapNodeKeyedRecordByCanonicalNodeId(nextGraphData, { ...(s.flowWidgetPosByNodeId || {}) })')) {
    throw new Error('expected graph commit carry-forward path to remap stored Flow widget screen positions onto canonical next-graph ids')
  }
  if (!graphDataSliceText.includes('remapNodeKeyedRecordByCanonicalNodeId(nextGraphData, { ...(s.flowWidgetWorldPosByNodeId || {}) })')) {
    throw new Error('expected graph commit carry-forward path to remap stored Flow widget world positions onto canonical next-graph ids')
  }
  const storePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphViewSlice.ts')
  const storeText = readFileSync(storePath, 'utf8')
  if (!storeText.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow widget store setters to reuse the shared workspace/indexing mutation guard')
  }
  const storePinnedGuardIndex = storeText.indexOf('if (isWorkspaceGraphMutationBlocked(state)) return')
  const storePinnedWriteIndex = storeText.indexOf('scheduleFlowWidgetPersistence({ pinned: { graphKey, value: nextPinnedById } })')
  if (storePinnedGuardIndex < 0 || storePinnedWriteIndex < 0 || storePinnedGuardIndex > storePinnedWriteIndex) {
    throw new Error('expected root Flow widget pinned-state setter to reject Workspace/Indexing mutation writes')
  }
  const storeScreenGuardIndex = storeText.indexOf('if (isWorkspaceGraphMutationBlocked(state)) return', storePinnedGuardIndex + 1)
  const storeScreenWriteIndex = storeText.indexOf('scheduleFlowWidgetPersistence({ pos: { graphKey, value: nextPosByNodeId } })')
  if (storeScreenGuardIndex < 0 || storeScreenWriteIndex < 0 || storeScreenGuardIndex > storeScreenWriteIndex) {
    throw new Error('expected root Flow widget screen-position setter to reject Workspace/Indexing mutation writes')
  }
  const storeWorldGuardIndex = storeText.indexOf('if (isWorkspaceGraphMutationBlocked(state)) return', storeScreenGuardIndex + 1)
  const storeWorldWriteIndex = storeText.indexOf('scheduleFlowWidgetPersistence({ world: { graphKey, value: nextWorldByNodeId } })')
  if (storeWorldGuardIndex < 0 || storeWorldWriteIndex < 0 || storeWorldGuardIndex > storeWorldWriteIndex) {
    throw new Error('expected root Flow widget world-position setter to reject Workspace/Indexing mutation writes')
  }
  if (!overlayEdgesText.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow Editor overlay edge scheduler to reuse the shared workspace/indexing mutation guard')
  }
  if (!overlayEdgesText.includes('const workspaceOverlayOpenRef = React.useRef(false)')) {
    throw new Error('expected Flow Editor overlay edge scheduler to keep workspace overlay-open state as a latest-value guard')
  }
  if (!overlayEdgesText.includes('if (workspaceOverlayOpenRef.current) scheduleOverlayEdgeUpdate()')) {
    throw new Error('expected workspace overlay open initialization to redraw stable edge geometry instead of only cancelling queued recomputation')
  }
  if (!overlayEdgesText.includes("const FLOW_EDITOR_OVERLAY_EDGE_ID_ATTR = 'data-kg-overlay-edge-id'")) {
    throw new Error('expected Flow Editor overlay edges to mark a canonical DOM edge identity for frozen-workspace reuse')
  }
  if (!overlayEdgesText.includes('const frozenOverlayEdgePathsBySurfaceId = new Map<string, FrozenOverlayEdgePathSnapshot[]>()')) {
    throw new Error('expected Flow Editor overlay edges to cache the last stable edge render by surface id')
  }
  if (!overlayEdgesText.includes('const cacheFrozenOverlayEdgePaths = React.useCallback(() => {')) {
    throw new Error('expected Flow Editor overlay edges to snapshot the last stable edge DOM before workspace-open freezes')
  }
  if (!overlayEdgesText.includes('const restoreFrozenOverlayEdgePaths = React.useCallback((svg: SVGSVGElement | null): number => {')) {
    throw new Error('expected Flow Editor overlay edges to restore frozen edge DOM while workspace-open recomputation is blocked')
  }
  if (!overlayEdgesText.includes('if (wasOpen) {') || !overlayEdgesText.includes('scheduleOverlayEdgeUpdate()')) {
    throw new Error('expected workspace overlay close transition to reschedule overlay edge recomputation')
  }
  const edgeScheduleGuardIndex = overlayEdgesText.indexOf('const workspaceOverlayOpen = workspaceOverlayOpenRef.current')
  const edgePathWriteIndex = overlayEdgesText.indexOf("if (pathEl.getAttribute('d') !== d) pathEl.setAttribute('d', d)")
  if (edgeScheduleGuardIndex < 0 || edgePathWriteIndex < 0 || edgeScheduleGuardIndex > edgePathWriteIndex) {
    throw new Error('expected Flow Editor overlay edge DOM writes to remain driven by the workspace-open guard and stable graph branch')
  }
  if (text.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected Flow Editor collective collision signature to avoid workspace layout refresh nonce coupling')
  }
}

export function testWorkspaceViewUpdatePreservesFrozenOverlayEdgesWhileIndexingToastIsVisible() {
  const overlayEdgesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const text = readFileSync(overlayEdgesPath, 'utf8')
  if (!text.includes("const FLOW_EDITOR_OVERLAY_EDGE_ID_ATTR = 'data-kg-overlay-edge-id'")) {
    throw new Error('expected overlay edge freeze preservation to use a canonical DOM edge identity')
  }
  if (!text.includes('const frozenOverlayEdgePathsBySurfaceId = new Map<string, FrozenOverlayEdgePathSnapshot[]>()')) {
    throw new Error('expected overlay edge freeze preservation to cache stable paths per surface')
  }
  if (!text.includes('const existingDomPaths = Array.from(svg.querySelectorAll(`path[${FLOW_EDITOR_OVERLAY_EDGE_ID_ATTR}]`))')) {
    throw new Error('expected overlay edge restoration to rehydrate from already-mounted DOM paths before snapshot replay')
  }
  if (!text.includes('overlayEdgePathByIdRef.current.clear()')) {
    throw new Error('expected overlay edge restoration to rebuild the in-memory edge map from canonical DOM paths')
  }
  if (!text.includes("const snapshots = surfaceId ? frozenOverlayEdgePathsBySurfaceId.get(surfaceId) || [] : []")) {
    throw new Error('expected overlay edge restoration to fall back to the last stable per-surface snapshot')
  }
  if (!text.includes("pathEl.setAttribute(FLOW_EDITOR_OVERLAY_EDGE_ID_ATTR, edgeId)")) {
    throw new Error('expected overlay edge writes to stamp canonical DOM edge ids onto live paths')
  }
  const workspaceStableGeometryIndex = text.indexOf("pushOverlayEdgeTrace('schedule-workspace-open-live-geometry', {")
  const workspaceStableGraphIndex = text.indexOf('const graph = shouldReuseStableGraph ? stableGraph : liveGraph')
  if (workspaceStableGeometryIndex < 0 || workspaceStableGraphIndex < 0 || workspaceStableGraphIndex > workspaceStableGeometryIndex) {
    throw new Error('expected workspace-open edge scheduling to reuse the last stable graph while redrawing against current live overlay geometry')
  }
  const svgAttachedRestoreIndex = text.indexOf('const restoredFrozenPathCount = workspaceOverlayOpenRef.current ? restoreFrozenOverlayEdgePaths(node) : 0')
  const svgAttachedTraceIndex = text.indexOf("pushOverlayEdgeTrace('svg-attached', {")
  if (svgAttachedRestoreIndex < 0 || svgAttachedTraceIndex < 0 || svgAttachedRestoreIndex > svgAttachedTraceIndex) {
    throw new Error('expected overlay svg attachment to restore frozen paths before reporting attachment state')
  }
}

export function testWorkspaceViewUpdateSchedulesFrontmatterMediaOverlayLayoutRefresh() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const text = readFileSync(p, 'utf8')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const commitPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowRequestCommit.ts')
  const commitText = readFileSync(commitPath, 'utf8')
  const computedPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowComputedPositions.ts')
  const computedText = readFileSync(computedPath, 'utf8')
  if (text.includes('const workspaceViewSig =')) {
    throw new Error('expected FlowCanvas media overlays to avoid deriving workspace view signature')
  }
  if (!text.includes('mediaOverlayLayoutScheduleRef.current?.()')) {
    throw new Error('expected FlowCanvas media overlays to schedule layout updates')
  }
  if (!text.includes('plannedOverlayNodeIdsKey')) {
    throw new Error('expected FlowCanvas media overlay layout scheduling to track planned overlay ids')
  }
  if (!text.includes('mediaLayoutItemIdsKey')) {
    throw new Error('expected FlowCanvas media overlay layout scheduling to track media overlay item ids')
  }
  if (!text.includes('flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas media overlay loop dependencies to include frontmatter document mode')
  }
  const flowZoomCommitGuardIndex = commitText.indexOf('if (workspaceMutationBlocked) return')
  const flowZoomCommitWriteIndex = commitText.indexOf('commitZoomTransformToStore({')
  if (flowZoomCommitGuardIndex < 0 || flowZoomCommitWriteIndex < 0 || flowZoomCommitGuardIndex > flowZoomCommitWriteIndex) {
    throw new Error('expected Flow request commit to block zoom persistence while Workspace/Indexing mutation guard is active')
  }
  if (!runtimeText.includes('const lateFlowEditorInitAfterSceneBuild =')) {
    throw new Error('expected Flow runtime to name the late Flow Editor init guard explicitly')
  }
  if (!runtimeText.includes('lastBuiltGraphKeyRef.current.length > 0')) {
    throw new Error('expected Flow runtime late init guard to detect scene builds that raced ahead of zoom-key initialization')
  }
  if (!runtimeText.includes('Continue into fit so the first visible frame does not stay frozen at identity.')) {
    throw new Error('expected Flow runtime late init guard to continue into fit instead of freezing Flow Editor at identity')
  }
  if (runtimeText.includes('const graphKey = `${graphDataRevision}:')) {
    throw new Error('expected Flow runtime scene rebuild key to avoid raw graphDataRevision churn')
  }
  if (!runtimeText.includes('const graphKey = `${buildGraphMetaKeyIgnoringPending(sceneGraphData)}:')) {
    throw new Error('expected Flow runtime scene rebuild key to reuse semantic graph identity')
  }
  if (!runtimeText.includes("import { isFlowTransformShowingGraph } from '@/components/FlowCanvas/transformGuards'")) {
    throw new Error('expected Flow runtime zoom seeding to reuse the shared flow transform visibility guard helper')
  }
  if (!runtimeText.includes('const preserveCurrentTransform =')) {
    throw new Error('expected Flow runtime zoom seeding to centralize stale offscreen transform preservation checks')
  }
  if (!runtimeText.includes('!isFlowEditor ||') || !runtimeText.includes('isFlowTransformShowingGraph(')) {
    throw new Error('expected Flow Editor zoom seeding to preserve non-identity transforms only when the current transform still shows graph content')
  }
  if (!runtimeText.includes('const initialTransformUsable = isUsableFlowTransform(initial)')) {
    throw new Error('expected Flow runtime zoom seeding to reject stale offscreen initial transforms in Flow Editor mode')
  }
  if (!runtimeText.includes('const seed = (initialTransformUsable ? initial : null)')) {
    throw new Error('expected Flow runtime zoom seeding to fallback from unusable initial transforms to fit/current guard path')
  }
  const computedPositionsPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowComputedPositions.ts')
  const computedPositionsText = readFileSync(computedPositionsPath, 'utf8')
  if (computedPositionsText.includes('const rev = typeof graphDataRevision')) {
    throw new Error('expected Flow computed positions graph key to avoid raw graphDataRevision churn')
  }
  if (!computedPositionsText.includes('const semanticGraphKey = buildGraphMetaKeyIgnoringPending(g)')) {
    throw new Error('expected Flow computed positions graph key to reuse semantic graph meta identity')
  }
  if (!computedPositionsText.includes('const graphKey = `graph:${semanticGraphKey}:')) {
    throw new Error('expected Flow computed positions graph key to be based on semantic graph identity')
  }
  const flowCommitGuardIndex = commitText.indexOf('if (workspaceMutationBlocked) return')
  const flowCommitWriteIndex = commitText.indexOf('if (changed) setLayoutPositionsForMode(cacheKey, nextPositions)')
  if (flowCommitGuardIndex < 0 || flowCommitWriteIndex < 0 || flowCommitGuardIndex > flowCommitWriteIndex) {
    throw new Error('expected Flow request commit to block layout persistence while Workspace/Indexing mutation guard is active')
  }
  const computedGuardIndex = computedText.indexOf('!isWorkspaceGraphMutationBlocked(workspaceState)')
  const computedWriteIndex = computedText.indexOf('setLayoutPositionsForMode(cacheKey, packed)')
  if (computedGuardIndex < 0 || computedWriteIndex < 0 || computedGuardIndex > computedWriteIndex) {
    throw new Error('expected Flow computed positions to block layout cache writes while Workspace/Indexing mutation guard is active')
  }
  if (!computedText.includes("cacheScope: 'flow-canvas-computed-positions-scene-graph'") || !computedText.includes('getCachedGraphLookup({')) {
    throw new Error('expected Flow computed positions to reuse the shared scene-graph lookup helper instead of rebuilding local Mermaid sizing maps')
  }
  const storePath = resolve(process.cwd(), 'src', 'hooks', 'useGraphStore.ts')
  const storeText = readFileSync(storePath, 'utf8')
  const rootLayoutGuardIndex = storeText.indexOf('if (isWorkspaceGraphMutationBlocked(get())) return')
  const rootLayoutWriteIndex = storeText.indexOf('set({ layoutPositionCacheByMode: { ...prev, [key]: positions } })')
  if (rootLayoutGuardIndex < 0 || rootLayoutWriteIndex < 0 || rootLayoutGuardIndex > rootLayoutWriteIndex) {
    throw new Error('expected root layout cache setter to reject Workspace/Indexing mutation writes')
  }
  if (!text.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected FlowCanvas media overlays to reuse the shared workspace/indexing mutation guard')
  }
  if (!text.includes('const workspaceOverlayOpenRef = React.useRef(false)')) {
    throw new Error('expected FlowCanvas media overlays to track workspace overlay open state without layout-key coupling')
  }
  if (!text.includes('const [workspaceOverlayOpenKey, setWorkspaceOverlayOpenKey] = React.useState(0)')) {
    throw new Error('expected FlowCanvas media overlays to restart passive layout only on semantic workspace overlay open/close transitions')
  }
  if (!text.includes('if (!active || mediaLayoutItems.length === 0 || workspaceOverlayOpenRef.current)')) {
    throw new Error('expected Rich Media layout loop to stay stopped while workspace overlay is open')
  }
  if (!text.includes('const cancelMediaOverlayInteractionState = React.useCallback(() => {')) {
    throw new Error('expected FlowCanvas media overlays to centralize cancellation of delayed interaction writes')
  }
  const workspaceOpenCancelIndex = text.indexOf('if (workspaceOverlayOpenRef.current) cancelMediaOverlayInteractionState()')
  const schedulerCancelIndex = text.indexOf('mediaOverlayHeaderMoveSchedulerRef.current?.cancel()')
  if (workspaceOpenCancelIndex < 0 || schedulerCancelIndex < 0) {
    throw new Error('expected workspace overlay open transition to cancel queued Rich Media overlay writes before they can flush after close')
  }
  const richMediaRuntimeGuardIndex = text.indexOf('if (!flowEditorOverlayInteractionMode || workspaceOverlayOpenRef.current) return')
  const richMediaDirtyWriteIndex = text.indexOf('positionsDirtySinceCommitRef.current = true')
  if (richMediaRuntimeGuardIndex < 0 || richMediaDirtyWriteIndex < 0 || richMediaRuntimeGuardIndex > richMediaDirtyWriteIndex) {
    throw new Error('expected Rich Media overlay runtime position writes to be blocked while workspace overlay is open')
  }
  const resizeGuardIndex = text.indexOf('if (!workspaceOverlayOpenRef.current) {')
  const resizeWriteIndex = text.indexOf("store.updateNode?.(node.id, { properties: { ...baseProps, 'visual:width': drag.lastW, 'visual:height': drag.lastH } })")
  if (resizeGuardIndex < 0 || resizeWriteIndex < 0 || resizeGuardIndex > resizeWriteIndex) {
    throw new Error('expected Rich Media resize persistence to be blocked while workspace overlay is open')
  }
  if (text.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected FlowCanvas media overlay scheduling to avoid workspace layout refresh nonce coupling')
  }
}

export function testWorkspaceViewSelectRefreshesCollectiveLayoutWithoutCloseReopen() {
  const p = resolve(process.cwd(), 'src', 'components', 'toolbar', 'EditorWorkspaceSelect.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('bumpWorkspaceViewLayoutRefreshNonce')) {
    throw new Error('expected Workspace View toolbar selection to avoid layout refresh nonce bump side-effects')
  }
}

export function testCollectiveInitializationIndexingAndWorkspaceToggleDoNotMutateBalancedLayoutContracts() {
  const flowEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const flowEditorText = readFileSync(flowEditorPath, 'utf8')
  if (!flowEditorText.includes('const canDeferUntilMeasuredCollectiveLayout =')) {
    throw new Error('expected Flow Editor collective layout to defer rebalance until the full measured collective is ready')
  }
  if (!flowEditorText.includes('overlayMeasurementWarmupStartedAtMsRef')) {
    throw new Error('expected Flow Editor collective layout to keep an explicit init-warmup guard against partial overlay measurements')
  }
  if (flowEditorText.includes('workspaceViewSig') || flowEditorText.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected Flow Editor collective layout to stay decoupled from workspace view refresh signatures')
  }
  if (!flowEditorText.includes('flowEditorSurfaceId,')) {
    throw new Error('expected Flow Editor collective layout runtime to key collision resolution off the active overlay surface identity')
  }
  if (!flowEditorText.includes('}, [editorRuntimeActive, queryActiveSurfaceOverlays])')) {
    throw new Error('expected Flow Editor collective layout subscriptions to rebind through the active overlay surface query')
  }

  const mediaLoopPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const mediaLoopText = readFileSync(mediaLoopPath, 'utf8')
  if (!mediaLoopText.includes('const canDeferUntilCollectiveCentersStabilize =')) {
    throw new Error('expected frontmatter Rich Media collective layout to defer rebalance until collective centers are ready')
  }
  if (!mediaLoopText.includes('collectiveCenterWarmupStartedAtMs')) {
    throw new Error('expected Rich Media collective layout loop to keep an explicit center warmup guard')
  }

  const flowEditorSurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const flowEditorSurfaceText = readFileSync(flowEditorSurfacePath, 'utf8')
  if (!flowEditorSurfaceText.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow Editor overlay surface initialization to reuse the shared workspace/indexing mutation guard')
  }
  if (!flowEditorSurfaceText.includes('if (isWorkspaceGraphMutationBlocked(st)) return')) {
    throw new Error('expected Flow Editor overlay surface pin seeding to skip while Workspace/Indexing overlay is open')
  }
  if (!flowEditorSurfaceText.includes('const connectedValuesGraphRevision = args.flowEditorViewActive ? args.draftGraphDataRevision : args.baseGraphDataRevision')) {
    throw new Error('expected Flow Editor overlay connected-values cache to use the active draft/render graph revision')
  }

  const flowCanvasMediaPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const flowCanvasMediaText = readFileSync(flowCanvasMediaPath, 'utf8')
  if (!flowCanvasMediaText.includes('plannedOverlayNodeIdsKey')) {
    throw new Error('expected frontmatter collective scheduling to key off planned overlay ids instead of workspace view toggles')
  }
  if (!flowCanvasMediaText.includes('mediaLayoutItemIdsKey')) {
    throw new Error('expected frontmatter collective scheduling to key off active media layout items instead of workspace view toggles')
  }
  if (flowCanvasMediaText.includes('workspaceViewSig') || flowCanvasMediaText.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected frontmatter collective scheduling to stay decoupled from workspace view refresh signatures')
  }

  const graphDataSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataCommitActions.ts')
  const graphDataSliceText = readFileSync(graphDataSlicePath, 'utf8')
  if (!graphDataSliceText.includes('preserveStableSameSourceOverlayState')) {
    throw new Error('expected graph commit path to preserve stable same-source collective overlay state during indexing recomposition')
  }
  if (!graphDataSliceText.includes('resolveCommittedFlowWidgetScreenPositions')) {
    throw new Error('expected graph commit path to centralize collective screen-position carry/cleanup decisions')
  }

  const interactionRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasInteractionRuntime.tsx')
  const interactionRuntimeText = readFileSync(interactionRuntimePath, 'utf8')
  const interactionGuardIndex = interactionRuntimeText.indexOf('if (workspaceMutationBlocked) return')
  const interactionBlockedSelectorIndex = interactionRuntimeText.indexOf('isWorkspaceGraphMutationBlocked({')
  const interactionApplyIndex = interactionRuntimeText.indexOf('applyZoomRequestNative({')
  if (
    interactionApplyIndex < 0
  ) {
    throw new Error('expected FlowCanvas interaction runtime to route zoom requests through native zoom application')
  }
  if (interactionGuardIndex >= 0 || interactionBlockedSelectorIndex >= 0) {
    throw new Error('expected FlowCanvas interaction runtime zoom handling to avoid workspace mutation-block gating so manual zoom actions always function')
  }
  if (interactionRuntimeText.includes('useGraphStore.getState().clearZoomRequest()')) {
    throw new Error('expected FlowCanvas interaction runtime to avoid discarding zoom requests before native zoom application')
  }

  const uiModeActionsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'uiSettingsSliceModeActions.ts')
  const uiModeActionsText = readFileSync(uiModeActionsPath, 'utf8')
  const flowEditorRequestGuardCount = (uiModeActionsText.match(/nextEnabled && state\.canvasRenderMode === '2d' && state\.canvas2dRenderer !== 'flowEditor'/g) || []).length
  if (flowEditorRequestGuardCount < 2) {
    throw new Error('expected workspace mode actions to avoid emitting fit-to-view zoom requests when Flow Editor is the active 2D renderer')
  }

  const anchorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorSurfaceAnchors.ts')
  const anchorText = readFileSync(anchorPath, 'utf8')
  if (!anchorText.includes("const viewportRoot = self.closest('[data-kg-canvas-viewport-root=\"1\"]')")) {
    throw new Error('expected Flow Editor surface anchors to resolve canvas window offset from the canonical canvas viewport root')
  }
  if (!anchorText.includes('const el = resolveCanvasWindowAnchorElement()')) {
    throw new Error('expected Flow Editor surface anchors to measure window offset through the shared canonical anchor resolver')
  }
  if (anchorText.includes('const left = Number.isFinite(args.containerLeft) ? args.containerLeft : 0')) {
    throw new Error('expected Flow Editor surface anchors to avoid overriding canonical window offset from transient containerLeft coordinates')
  }
  if (anchorText.includes('const top = Number.isFinite(args.containerTop) ? args.containerTop : 0')) {
    throw new Error('expected Flow Editor surface anchors to avoid overriding canonical window offset from transient containerTop coordinates')
  }
  if (anchorText.includes('const el = args.rootRef.current')) {
    throw new Error('expected Flow Editor surface anchors to avoid measuring raw rootRef coordinates directly during workspace toggles')
  }
}

export function testD3SceneBuildKeyIgnoresWorkspaceGestureOverlayToggles() {
  const helperPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'd3SceneSetupContext.ts')
  const helperText = readFileSync(helperPath, 'utf8')
  if (!helperText.includes('const buildKey = [')) {
    throw new Error('expected D3 scene setup helper to centralize the D3 scene build key')
  }
  if (helperText.includes('String(args.enableEditorGestures ? 1 : 0)')) {
    throw new Error('expected D3 scene build key to ignore workspace/panel gesture gating so layout does not rebuild on overlay toggles')
  }
  if (!helperText.includes('String(args.infiniteCanvasInteractionMode)')) {
    throw new Error('expected D3 scene build key to keep interaction-mode semantics while excluding overlay gesture toggles')
  }
  const hookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const hookText = readFileSync(hookPath, 'utf8')
  if (!hookText.includes('const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)')) {
    throw new Error('expected D3 scene hook to scope reactive dependencies to workspace view mode only')
  }
  if (hookText.includes('workspaceCanvasPaneOpen } = useGraphStore(')) {
    throw new Error('expected D3 scene hook to avoid subscribing scene rebuilds to workspaceCanvasPaneOpen toggle churn')
  }
  if (!hookText.includes('const workspaceOverlayOpenRef = useRef(false)')) {
    throw new Error('expected D3 scene hook to track workspace overlay-open state through a non-reactive ref')
  }
  if (!hookText.includes('s => s.workspaceViewMode')) {
    throw new Error('expected D3 scene hook overlay-open subscription to listen only to workspaceViewMode')
  }
  if (hookText.includes('s => [s.workspaceCanvasPaneOpen, s.workspaceViewMode] as const')) {
    throw new Error('expected D3 scene hook overlay-open subscription to avoid workspaceCanvasPaneOpen tuple churn')
  }
  if (!hookText.includes('const enableEditorGestures = workspaceViewMode === \'editor\'')) {
    throw new Error('expected D3 scene hook to keep pane-open overlay toggles outside scene rebuild keys')
  }
  const presentationHookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts')
  const presentationHookText = readFileSync(presentationHookPath, 'utf8')
  if (presentationHookText.includes('workspaceCanvasPaneOpen } = useGraphStore(')) {
    throw new Error('expected D3 presentation hook to avoid reacting to workspaceCanvasPaneOpen toggle churn')
  }
  if (!presentationHookText.includes('const workspaceOverlayOpenRef = useRef(false)')) {
    throw new Error('expected D3 presentation hook to use shared overlay-open refs instead of reactive pane-open subscriptions')
  }
  if (!presentationHookText.includes('s => s.workspaceViewMode')) {
    throw new Error('expected D3 presentation hook overlay-open subscription to listen only to workspaceViewMode')
  }
  if (presentationHookText.includes('s => [s.workspaceCanvasPaneOpen, s.workspaceViewMode] as const')) {
    throw new Error('expected D3 presentation hook overlay-open subscription to avoid workspaceCanvasPaneOpen tuple churn')
  }
  if (!presentationHookText.includes('const enableEditorGestures = workspaceViewMode === \'editor\'')) {
    throw new Error('expected D3 presentation hook to keep gesture-gating independent from workspace pane open/close toggles')
  }
}

export function testFlowEditorOverlayFitNormalizesSurfaceWindowOffset() {
  const zoomPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'applyZoomRequestNative.ts')
  const text = readFileSync(zoomPath, 'utf8')
  if (!text.includes('readCanvasOverlayNodeId,')) {
    throw new Error('expected Flow Editor fit recentering to reuse shared overlay node-id resolution when translating world positions')
  }
  if (!text.includes("const WORKSPACE_LEFT_PANE_SELECTOR = '[data-kg-workspace-left-pane=\"1\"]'")) {
    throw new Error('expected Flow Editor zoom fit to read workspace occlusion from the canonical workspace-left-pane marker')
  }
  if (!text.includes('function resolveFlowEditorVisibleViewport(args: {')) {
    throw new Error('expected Flow Editor zoom fit to centralize visible viewport resolution for workspace-occluded layouts')
  }
  if (!text.includes('const surfaceRect = surfaceRoot?.getBoundingClientRect() || null')) {
    throw new Error('expected Flow Editor overlay fit bounds to resolve the active surface root window rect')
  }
  if (!text.includes('const surfaceOffsetLeft = Number.isFinite(surfaceRect?.left) ? Number(surfaceRect?.left) : 0')) {
    throw new Error('expected Flow Editor overlay fit bounds to normalize horizontal screen coordinates by active surface offset')
  }
  if (!text.includes('const surfaceOffsetTop = Number.isFinite(surfaceRect?.top) ? Number(surfaceRect?.top) : 0')) {
    throw new Error('expected Flow Editor overlay fit bounds to normalize vertical screen coordinates by active surface offset')
  }
  if (!text.includes('left: entry.rect.left - surfaceOffsetLeft')) {
    throw new Error('expected Flow Editor overlay fit bounds to store left edge in active surface-local coordinates')
  }
  if (!text.includes('top: entry.rect.top - surfaceOffsetTop')) {
    throw new Error('expected Flow Editor overlay fit bounds to store top edge in active surface-local coordinates')
  }
  if (!text.includes('const fitW = Math.max(1, visibleViewport.width - pad * 2)')) {
    throw new Error('expected Flow Editor zoom fit to clamp collective bounds to the visible viewport width when workspace editor occludes the left pane')
  }
  if (!text.includes('const targetX = visibleViewport.centerX - (centerX - base.x) * appliedScale')) {
    throw new Error('expected Flow Editor zoom fit to center collective overlays inside the visible viewport center')
  }
  if (!text.includes('recenterOverlayWidgetPositions(deltaX, deltaY)')) {
    throw new Error('expected Flow Editor fit recentering to shift widget world positions alongside viewport transform updates')
  }
  if (!text.includes('st.setFlowWidgetWorldPosByNodeId(nextWorld)')) {
    throw new Error('expected Flow Editor fit recentering to persist translated world positions through the shared widget world-position setter')
  }
  if (!text.includes('st.setFlowWidgetPosByNodeId(nextScreen)')) {
    throw new Error('expected Flow Editor fit recentering to persist translated screen positions through the shared widget screen-position setter')
  }
  if (text.includes('left: entry.rect.left,')) {
    throw new Error('expected Flow Editor overlay fit bounds to avoid raw window-space left coordinates')
  }
}
