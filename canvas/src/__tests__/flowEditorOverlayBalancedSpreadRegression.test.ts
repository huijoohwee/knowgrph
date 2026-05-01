import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testFlowEditorOverlayCollisionRebalancesStoredVerticalClusters = () => {
  const spreadPath = path.resolve(process.cwd(), 'src', 'lib', 'ui', 'overlayBalancedSpread.ts')
  const spreadText = readUtf8(spreadPath)
  if (!spreadText.includes('isVerticalOverlayCluster')) {
    throw new Error('expected shared overlay spread helper to detect vertical overlay clusters')
  }
  if (!spreadText.includes('isHorizontalOverlayStrip')) {
    throw new Error('expected shared overlay spread helper to detect horizontal strip residue clusters')
  }
  if (!spreadText.includes('computeBalancedSpreadGridForTargetAspect')) {
    throw new Error('expected shared overlay spread helper to expose a reusable balanced grid planner for non-viewport collective reseed paths')
  }
  if (!spreadText.includes('clampBalancedCollectiveScaleToViewport')) {
    throw new Error('expected shared overlay spread helper to expose viewport-fit scaling for balanced collective overlays')
  }
  if (!spreadText.includes('computeBalancedSpreadLayout')) {
    throw new Error('expected shared overlay spread helper to expose centered balanced multi-column seed layout planning')
  }
  if (!spreadText.includes('computeBalancedSpreadViewportMargins')) {
    throw new Error('expected shared overlay spread helper to centralize 16:9 collective viewport margins')
  }

  const hookPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const runtimePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const scenePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const surfacePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const presentationPath = path.resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts')
  const hookText = readUtf8(hookPath)
  const runtimeText = readUtf8(runtimePath)
  const sceneText = readUtf8(scenePath)
  const surfaceText = readUtf8(surfacePath)
  const presentationText = readUtf8(presentationPath)
  if (!hookText.includes('const posSig = buildPosSignature(overlayNodeIds, st.flowWidgetPosByNodeId)')) {
    throw new Error('expected overlay collision key to include shared stored-position signatures')
  }
  if (!hookText.includes("import { hashScopedStringArraySignature, hashSignatureParts, normalizeStringArrayForSignature } from '@/lib/hash/signature'")) {
    throw new Error('expected overlay collision runtime to reuse shared semantic-key helpers instead of local join-based key assembly')
  }
  if (!hookText.includes("cacheScope: 'flow-editor-overlay-collision-graph'") || !hookText.includes('getCachedGraphLookup({')) {
    throw new Error('expected overlay collision runtime to reuse the shared graph lookup helper instead of rebuilding local node maps inside the settle loop')
  }
  if (!hookText.includes('const panelScaleKey = computeWidgetScaleKey(panelScale)')) {
    throw new Error('expected overlay collision key to bucket relayouts by stable floating scale')
  }
  if (!hookText.includes('computeCollectiveFollowPinnedScale')) {
    throw new Error('expected overlay collision path to reuse the shared follow-pinned scale helper')
  }
  if (!hookText.includes('computeBalancedSpreadLayout')) {
    throw new Error('expected overlay collision path to reuse shared centered balanced spread layout planning')
  }
  if (!hookText.includes('computeBalancedSpreadViewportMargins')) {
    throw new Error('expected overlay collision path to reuse shared 16:9 viewport margins instead of local hardcodes')
  }
  if (!hookText.includes('const OVERLAY_POSITION_QUANTUM_PX = 1')) {
    throw new Error('expected overlay collision path to quantize persisted floating positions')
  }
  if (!hookText.includes("const overlayNodeIdsKey = hashScopedStringArraySignature('overlay-collision-node-ids', overlayNodeIds)")) {
    throw new Error('expected overlay collision key to derive a semantic overlay-node-set signature through the shared helper')
  }
  if (!hookText.includes("const pinSig = hashSignatureParts([")) {
    throw new Error('expected overlay collision key to include a semantic pinned signature instead of raw string concatenation')
  }
  if (!hookText.includes('queryActiveSurfaceOverlays(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR)')) {
    throw new Error('expected overlay collision runtime to resolve widget roots through the shared active-surface selector')
  }
  if (!hookText.includes('FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR')) {
    throw new Error('expected overlay collision runtime to bound overlay queries to the active Flow Editor surface root')
  }
  if (!hookText.includes('const unresolvedRectIdSet = new Set<string>()')) {
    throw new Error('expected overlay collision runtime to track unresolved collective panel measurements during init warmup')
  }
  if (!hookText.includes('const canDeferUntilMeasuredCollectiveLayout =')) {
    throw new Error('expected overlay collision runtime to defer collective relayout until measured overlay sizes are ready')
  }
  if (!hookText.includes('&& (isFrontmatterFlow || items.length >= 2)')) {
    throw new Error('expected overlay collision runtime to defer first collective/frontmatter layout seeding while measurements are unresolved')
  }
  if (!hookText.includes('items.every(item => item.width == null || item.height == null || (item.width > 0 && item.height > 0))')) {
    throw new Error('expected overlay collision runtime warmup to wait on unresolved measurement geometry instead of requiring stored positions')
  }
  if (!hookText.includes('scheduleOverlayCollisionResolveRef.current()')) {
    throw new Error('expected overlay collision warmup guard to reschedule once collective measurements are ready')
  }
  if (!hookText.includes('movable: true')) {
    throw new Error('expected floating overlays with stored positions to remain auto-rebalanceable')
  }
  if (!hookText.includes('const nodeTypeById = new Map<string, string>()')) {
    throw new Error('expected overlay collision path to derive node types for shared auto-placement authority decisions')
  }
  if (!hookText.includes('shouldRebalanceCluster')) {
    throw new Error('expected overlay collision path to rebalance vertical clusters')
  }
  if (!hookText.includes('isHorizontalOverlayStrip')) {
    throw new Error('expected overlay collision path to rebalance horizontal strip residue clusters')
  }
  if (!hookText.includes('const storedCollectiveIsResidue =')) {
    throw new Error('expected overlay collision path to detect stale stored collective residue before accepting stored positions')
  }
  if (!hookText.includes('const base = !hasStored || storedCollectiveIsResidue')) {
    throw new Error('expected overlay collision path to reseed stale horizontal/vertical stored residue from balanced cells')
  }
  if (!hookText.includes('nodeTypeId: nodeTypeById.get(id) || \'\'')) {
    throw new Error('expected overlay collision path to keep canonical frontmatter built-ins auto-rebalanceable after stored strip positions')
  }
  if (!hookText.includes('if (stillOverlaps && changed)')) {
    throw new Error('expected overlay collision settle loop to stop rescheduling when no effective movement remains')
  }
  if (!hookText.includes('const unresolvedPairCount = (() => {')) {
    throw new Error('expected overlay collision settle loop to measure unresolved overlap progress before rescheduling')
  }
  if (!hookText.includes('const allowReschedule =')) {
    throw new Error('expected overlay collision settle loop to gate retries on convergence instead of unconditional churn')
  }
  if (hookText.includes('}, [args])')) {
    throw new Error('expected overlay collision resolver to avoid whole-args callback churn')
  }
  if (hookText.includes('const zKey = String(Math.round(zoomK * 1000) / 1000)')) {
    throw new Error('expected overlay collision path to avoid raw zoom-key churn')
  }
  if (!hookText.includes('useGraphStore.subscribe(s => s.flowWidgetPosByNodeId')) {
    throw new Error('expected overlay collision path to reschedule on floating position updates')
  }
  if (!hookText.includes('const allowNodeObstacleCollision = !overlayOnlyModeEnabled')) {
    throw new Error('expected overlay collision runtime to disable hidden node-obstacle feedback in overlay-only mode')
  }
  if (!hookText.includes('if (overlayNodeIdSet.has(id)) continue')) {
    throw new Error('expected overlay collision runtime to avoid treating overlay-owned nodes as collision obstacles')
  }
  if (!hookText.includes('const cancelOverlayCollisionResolve = React.useCallback')) {
    throw new Error('expected overlay collision runtime to cancel scheduled measurement state when Workspace/Indexing overlays open')
  }
  if (!hookText.includes('if (workspaceOverlayOpenRef.current) return')) {
    throw new Error('expected overlay collision scheduling and store subscriptions to stay idle while Workspace/Indexing overlays are open')
  }
  if (!hookText.includes('if (wasOpen) scheduleOverlayCollisionResolve()')) {
    throw new Error('expected overlay collision runtime to recover once Workspace/Indexing overlays close')
  }
  if (!hookText.includes('compareNodeZKey')) {
    throw new Error('expected overlay collision runtime to reuse shared node z-order comparison helper')
  }
  if (!hookText.includes('const graphDataForOverlayRuntime =') || !hookText.includes('draftGraphDataRef.current || renderGraphDataOverride || null')) {
    throw new Error('expected overlay collision runtime to resolve a single upstream graph source before deriving node types and obstacles')
  }
  if (!hookText.includes('const overlayTopologyLayoutSignature = React.useMemo(() => {')) {
    throw new Error('expected overlay collision relayout effects to use semantic topology/layout signatures instead of raw graph revisions')
  }
  if (!hookText.includes("import { buildOverlayTopologyLayoutSignature } from '@/lib/flowEditor/overlayTopologyLayoutSignature'")) {
    throw new Error('expected overlay collision topology/layout signature to reuse the shared Flow Editor semantic-key helper')
  }
  if (!hookText.includes("return buildOverlayTopologyLayoutSignature(graphDataForOverlayRuntime)")) {
    throw new Error('expected overlay collision topology/layout signature to be derived from the resolved graph source')
  }
  if (!hookText.includes('overlayTopologyLayoutSignature,') || hookText.includes('graphContentRevision,\n    overlayOnlyModeEnabled')) {
    throw new Error('expected run-output graph content revisions to avoid resetting Balanced overlay collision layout')
  }
  if (!runtimeText.includes('const overlayTopologyLayoutSignature = React.useMemo(() => {')) {
    throw new Error('expected Flow Editor runtime to derive one shared semantic topology/layout signature')
  }
  if (!runtimeText.includes('overlayTopologyLayoutSignature,\n    zoomViewKeyRef')) {
    throw new Error('expected Flow Editor runtime scene seeding to receive semantic topology/layout signature instead of raw graph revision')
  }
  if (!surfaceText.includes("'frontmatter-overlay-auto-pins'") || !surfaceText.includes('overlayEditorNodeIdsKey') || !surfaceText.includes("hashScopedStringArraySignature('missing-frontmatter-pins', missingIds)")) {
    throw new Error('expected Flow Editor overlay pin seeding to ignore output-only graph revisions')
  }
  if (!sceneText.includes('args.overlayTopologyLayoutSignature') || sceneText.includes('args.baseGraphDataRevision')) {
    throw new Error('expected Flow Editor world-position seeding to ignore output-only graph revisions')
  }
  if (!sceneText.includes('const graphDataForSeeding = renderGraphDataOverrideRef.current || st.graphData || null')) {
    throw new Error('expected Flow Editor world-position seeding to read latest graph from ref without raw graph-object dependency churn')
  }
  if (sceneText.includes('args.overlayTopologyLayoutSignature, args.renderGraphDataOverride')) {
    throw new Error('expected Flow Editor world-position seeding deps to avoid raw graph-object identity churn')
  }
  if (!surfaceText.includes('const graphData = renderGraphDataOverrideRef.current')) {
    throw new Error('expected Flow Editor pin seeding to read latest graph from ref without raw graph-object dependency churn')
  }
  if (surfaceText.includes('args.overlayTopologyLayoutSignature, args.renderGraphDataOverride')) {
    throw new Error('expected Flow Editor pin seeding deps to avoid raw graph-object identity churn')
  }

  const seedSpreadPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'seedGroupSpread.ts')
  const seedSpreadText = readUtf8(seedSpreadPath)
  if (!seedSpreadText.includes('computeBalancedSpreadGridForTargetAspect')) {
    throw new Error('expected pinned widget reseed path to reuse the shared balanced spread grid planner')
  }

  const overlayEdgesPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const overlayEdgesText = readUtf8(overlayEdgesPath)
  if (!overlayEdgesText.includes('readFlowEdgePortKey')) {
    throw new Error('expected Flow Editor overlay edge rendering to resolve endpoint keys through shared flow port helpers')
  }
  if (!overlayEdgesText.includes('pickDefaultFlowPortKey')) {
    throw new Error('expected Flow Editor overlay edge rendering to reuse shared semantic default port-key helper')
  }
  if (!overlayEdgesText.includes('FLOW_HANDLE_DEFAULT_EDGE_ID')) {
    throw new Error('expected Flow Editor overlay edge rendering to keep default handle fallback aligned with handle SSOT')
  }
  if (overlayEdgesText.includes('firstSchemaPortKeyByNodeId')) {
    throw new Error('expected Flow Editor overlay edge rendering to avoid local first-schema-port fallback aliases')
  }

  const workflowPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const workflowText = readUtf8(workflowPath)
  if (!workflowText.includes('function areRecordValuesEqual')) {
    throw new Error('expected Run all output writes to compare semantic property values before replacing node objects')
  }
  if (!workflowText.includes('if (areRecordValuesEqual(currentProps, nextProps)) return existing')) {
    throw new Error('expected Run all draft output writes to skip unchanged output/loading patches')
  }
  if (!workflowText.includes('if (updated) scheduleWorkflowOutputEdgeRefresh()')) {
    throw new Error('expected Run all to refresh overlay edges only after an actual output write')
  }
  if (!workflowText.includes('const allowCreateRichMediaPanel = runOptions?.allowCreateRichMediaPanel !== false')) {
    throw new Error('expected workflow node runs to expose an explicit topology creation gate for Rich Media Panel mirroring')
  }
  if (!workflowText.includes('if (!allowCreateRichMediaPanel) return null')) {
    throw new Error('expected Rich Media Panel mirroring to skip node creation when Run all is output-only')
  }
  if (!workflowText.includes('await runWorkflowNode(ids[i]!, { allowCreateRichMediaPanel: false })')) {
    throw new Error('expected Toolbar Run all to write outputs into existing nodes only without appending Rich Media Panel nodes')
  }
  if (!workflowText.includes('const readLiveDraftGraphData = () => (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null')) {
    throw new Error('expected Run all to use the live draft graph ref as the mutation SSOT between sequential node runs')
  }
  if (!workflowText.includes('args.setDraftGraphData(prev => (prev === currentDraft ? nextDraft : args.draftGraphDataRef.current))')) {
    throw new Error('expected Run all output writes to update the draft ref synchronously before React state catches up')
  }
  if (!workflowText.includes('function bumpDraftGraphDataRevision(graphData: GraphData): GraphData')) {
    throw new Error('expected Run all output writes to bump the live draft graph revision for connected-value cache invalidation')
  }
  if (!workflowText.includes('const nextDraft = bumpDraftGraphDataRevision({ ...currentDraft, nodes: nextNodes })')) {
    throw new Error('expected Run all output writes to bump revision at the same SSOT draft mutation point')
  }
  if (workflowText.includes("await runWorkflowNode(ids[i]!, { allowCreateRichMediaPanel: false })\n        scheduleWorkflowOutputEdgeRefresh()")) {
    throw new Error('expected Run all to avoid unconditional overlay edge refresh churn between nodes')
  }
  if (!workflowText.includes('const existingPanelProps = (updatedPanel?.properties || {}) as Record<string, unknown>')) {
    throw new Error('expected Rich Media Panel output writes to preserve existing layout and sizing properties')
  }
  if (!workflowText.includes('args.updateNode(panelNodeId, { properties: { ...existingPanelProps, ...patch } as never })')) {
    throw new Error('expected Rich Media Panel graph-store write to merge output into existing panel properties instead of replacing layout')
  }
}

export const testFlowEditorOverlayReseedKeepsBalancedColumnCount = () => {
  const hookPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const hookText = readUtf8(hookPath)
  if (!hookText.includes('const cols = Math.max(1, dockCols)')) {
    throw new Error('expected overlay reseed to preserve balanced dock column count')
  }
  if (hookText.includes('Math.floor(Math.max(1, dockWidth) / Math.max(1, cellSize.width))')) {
    throw new Error('expected overlay reseed to avoid shrinking columns from dock width gap subtraction')
  }
  if (!hookText.includes('computeBalancedSpreadSpacingPx')) {
    throw new Error('expected overlay reseed path to apply adaptive balanced spacing')
  }
}

export const testFlowEditorNodeOverlayUsesPinnedStateForFloatingMode = () => {
  const overlayPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const overlayText = readUtf8(overlayPath)
  if (!overlayText.includes('const floating = pinnedInCanvas !== true')) {
    throw new Error('expected node overlay floating mode to follow pinned state')
  }
  if (overlayText.includes('const floating = false')) {
    throw new Error('expected node overlay to avoid hardcoded non-floating mode')
  }
  if (!overlayText.includes("applyOverlayPosition({ persistClamp: false })")) {
    throw new Error('expected node overlay zoom and interaction refreshes to avoid persisting floating clamp churn')
  }
  if (!overlayText.includes('if (floatingRef.current && !pinnedDragOverrideRef.current && !widgetWorldPosRef.current) return')) {
    throw new Error('expected floating overlay interaction-frame refreshes to stay idle when the panel is not actively dragging')
  }
  if (!overlayText.includes('const sameScale = lastFloatingScaleKeyRef.current === scaleKey')) {
    throw new Error('expected floating overlay zoom subscription to ignore pan-only zoom-state churn')
  }
  if (!overlayText.includes('const allowPassiveClampPersist =')) {
    throw new Error('expected floating overlay clamp persistence to be gated so passive viewport/layout updates do not rewrite store positions continuously')
  }
  if (!overlayText.includes('const floatingUsesScreenAuthority = shouldUseFlowEditorWidgetFloatingScreenAuthority({')) {
    throw new Error('expected frontmatter floating overlays to reuse the shared screen-authority helper')
  }
  if (!overlayText.includes('const storedWorld = floatingUsesScreenAuthority ? null : widgetWorldPosRef.current')) {
    throw new Error('expected frontmatter floating overlays to ignore stored world positions as a placement authority')
  }
  if (!overlayText.includes('persistWorldPos(nextWorld)')) {
    throw new Error('expected floating overlays to keep derived world positions in sync for edge connectivity')
  }
}

export const testFlowEditorPinnedContainmentBoundsIgnoreOverlayFeedback = () => {
  const runtimeScenePath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const text = readUtf8(runtimeScenePath)
  if (text.includes('overlayAabbByNodeId')) {
    throw new Error('expected pinned widget containment bucket bounds to ignore overlay AABBs and avoid self-expanding reseed loops')
  }
  if (!text.includes('const aabb = computeFlowGroupAabb({')) {
    throw new Error('expected pinned widget containment path to keep using shared computeFlowGroupAabb helper')
  }
}

export const testFlowCanvasMediaOverlayPlanningAvoidsDuplicateStateFeedback = () => {
  const flowCanvasPath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const flowCanvasText = readUtf8(flowCanvasPath)
  const presentationPath = path.resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts')
  const presentationText = readUtf8(presentationPath)
  if (!flowCanvasText.includes('const plannedOverlayNodeIdsKeyRef = React.useRef')) {
    throw new Error('expected FlowCanvas to keep a stable planned-overlay signature ref')
  }
  if (!flowCanvasText.includes('if (plannedOverlayNodeIdsKeyRef.current === nextKey) return')) {
    throw new Error('expected FlowCanvas planned-overlay updates to ignore unchanged overlay id signatures')
  }
  if (!flowCanvasText.includes('onPlannedOverlayNodeIdsChange={handlePlannedOverlayNodeIdsChange}')) {
    throw new Error('expected FlowCanvas to route media overlay planning through a guarded callback')
  }

  const overlayPath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const overlayText = readUtf8(overlayPath)
  if (!overlayText.includes('const lastPlannedOverlayNodeIdsKeyRef = React.useRef<string>(\'\')')) {
    throw new Error('expected FlowCanvas media overlays to track the last emitted planned-overlay signature')
  }
  if (!overlayText.includes('if (lastPlannedOverlayNodeIdsKeyRef.current === plannedOverlayNodeIdsKey) return')) {
    throw new Error('expected FlowCanvas media overlays to suppress duplicate planned-overlay callbacks')
  }
  if (!overlayText.includes('const mediaLayoutItems = React.useMemo(') || !overlayText.includes('[mediaLayoutItemIdsKey]')) {
    throw new Error('expected Rich Media layout items to be keyed by semantic overlay id signature, not raw mediaNodes array identity')
  }
  if (!overlayText.includes('const mediaLayoutPropsSignature = React.useMemo(')) {
    throw new Error('expected Rich Media layout scheduling to derive a semantic active-node props signature instead of waiting for incidental interaction churn')
  }
  if (!overlayText.includes("readMediaLayoutNodePropsSignature(mediaLayoutItemIds, sceneGraphData)")) {
    throw new Error('expected Rich Media layout scheduling to key off the active overlay ids plus the current scene graph node props SSOT')
  }
  if (!overlayText.includes('const mediaOverlayPanelLastKnownWorldSizeRef = React.useRef<Map<string, { w: number; h: number }>>(new Map())')) {
    throw new Error('expected Rich Media overlay sizing to retain the last stable panel world size across transient graph prop gaps')
  }
  if (!overlayText.includes('if (options?.clearLastKnownWorldSize === true) mediaOverlayPanelLastKnownWorldSizeRef.current.clear()')) {
    throw new Error('expected Rich Media overlay interaction reset to preserve stable panel world sizes except on full teardown')
  }
  if (!overlayText.includes('const stableSize = readStablePanelWorldSize(record)')) {
    throw new Error('expected Rich Media overlay sizing to refresh its last-known size cache from semantic scene node props')
  }
  if (!overlayText.includes('for (const id of Array.from(lastKnownSizes.keys())) {')) {
    throw new Error('expected Rich Media overlay size cache to prune removed nodes without dropping active-node stable sizes during workspace churn')
  }
  if (!overlayText.includes('readStablePanelWorldSize(props) || mediaOverlayPanelLastKnownWorldSizeRef.current.get(id) || null')) {
    throw new Error('expected Rich Media layout sizing to reuse the last stable panel size when visual width/height are transiently missing')
  }
  if (!presentationText.includes('const lastStableOverlayHalfExtentsByNodeIdRef = useRef<Map<string, NodeHalfExtents>>(new Map())')) {
    throw new Error('expected D3 presentation to retain last stable overlay half-extents across transient missing visual size props')
  }
  if (!presentationText.includes('const stableOverlayHalfExtentsByNodeId = mergeStableOverlayHalfExtents({')) {
    throw new Error('expected D3 presentation to merge computed overlay extents with the last stable overlay half-extents cache')
  }
  if (!presentationText.includes('lastStableByNodeId: lastStableOverlayHalfExtentsByNodeIdRef.current')) {
    throw new Error('expected D3 presentation to update overlay half-extents from a shared ref-backed SSOT cache')
  }
  if (!overlayText.includes('workspaceOverlayOpenRef.current') || !overlayText.includes('workspaceOverlayOpenKey')) {
    throw new Error('expected Rich Media layout scheduling to track Workspace overlay open/close without raw workspace deps in hot layout state')
  }
  if (!overlayText.includes('if (!active || mediaLayoutItems.length === 0 || workspaceOverlayOpenRef.current)')) {
    throw new Error('expected Rich Media layout loop to stay stopped while Workspace/Indexing overlay is open')
  }
  if (!overlayText.includes('if (workspaceOverlayOpenRef.current) return')) {
    throw new Error('expected passive Rich Media layout scheduling to skip while Workspace/Indexing overlay is open')
  }
  if (!overlayText.includes('mediaLayoutPropsSignature,')) {
    throw new Error('expected passive Rich Media layout scheduling to resync on semantic panel output and sizing changes')
  }
  if (!overlayText.includes('const sceneGraphDataRevision = React.useMemo(() => readGraphDataRevision(sceneGraphData), [sceneGraphData])')) {
    throw new Error('expected Rich Media overlay maintenance effects to use graph revisions instead of raw scene graph identity churn')
  }
  const richMediaPanelPath = path.resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const richMediaPanelText = readUtf8(richMediaPanelPath)
  if (!richMediaPanelText.includes('data-kg-flow-editor-mode={flowEditorInteractionMode ? \'1\' : undefined}')) {
    throw new Error('expected rich media overlay roots to explicitly expose Flow Editor mode for renderer-scoped isolation')
  }

  const sizingPath = path.resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlaySizing.ts')
  const sizingText = readUtf8(sizingPath)
  if (!sizingText.includes('clampBalancedCollectiveScaleToViewport')) {
    throw new Error('expected rich media overlay sizing to reuse shared viewport-fit scaling for balanced collective panel initialization')
  }
  const mediaLayoutPath = path.resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const mediaLayoutText = readUtf8(mediaLayoutPath)
  if (!mediaLayoutText.includes('computeBalancedSpreadLayout')) {
    throw new Error('expected rich media overlay collision layout to reuse shared balanced multi-column seed layout planning')
  }
  if (!mediaLayoutText.includes('computeBalancedSpreadViewportMargins')) {
    throw new Error('expected rich media overlay collision layout to reuse shared 16:9 viewport margins')
  }
  if (!mediaLayoutText.includes('isVerticalOverlayCluster')) {
    throw new Error('expected rich media overlay collision layout to reuse shared vertical-cluster detection before reseeding')
  }
  if (!mediaLayoutText.includes('isHorizontalOverlayStrip')) {
    throw new Error('expected rich media overlay collision layout to reuse shared horizontal-strip detection before reseeding')
  }
  if (!mediaLayoutText.includes('const missingCenterIds: string[] = []')) {
    throw new Error('expected rich media overlay layout loop to track missing collective centers during init warmup')
  }
  if (!mediaLayoutText.includes('const canDeferUntilCollectiveCentersStabilize =')) {
    throw new Error('expected rich media overlay layout loop to defer balanced collective planning until centers are ready')
  }
  if (!mediaLayoutText.includes('scheduleCollectiveLayoutUpdate()')) {
    throw new Error('expected rich media overlay layout warmup guard to reschedule until the full collective is ready')
  }

  const proxyPath = path.resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts')
  const proxyText = readUtf8(proxyPath)
  if (!proxyText.includes('export const FLOW_EDITOR_OVERLAY_MODE_SELECTOR = \'[data-kg-flow-editor-mode="1"]\'')) {
    throw new Error('expected shared overlay proxy contract to centralize explicit Flow Editor mode scoping')
  }
  if (!proxyText.includes('export const FLOW_EDITOR_OVERLAY_ROOT_SELECTOR = `[data-kg-widget]${FLOW_EDITOR_OVERLAY_MODE_SELECTOR}`')) {
    throw new Error('expected Flow Editor widget selector to exclude non-Flow-Editor renderer overlays')
  }
  if (!proxyText.includes('export const RICH_MEDIA_OVERLAY_ROOT_SELECTOR = `[data-kg-rich-media-overlay="1"]${FLOW_EDITOR_OVERLAY_MODE_SELECTOR}`')) {
    throw new Error('expected Rich Media overlay selector to exclude non-Flow-Editor renderer overlays')
  }
  if (!proxyText.includes('export function isTransientOffscreenRichMediaOverlayRoot')) {
    throw new Error('expected shared overlay proxy contract to centralize transient offscreen Rich Media bootstrap filtering')
  }
  if (!proxyText.includes('export function shouldReplaceFlowEditorOverlayRectCandidate')) {
    throw new Error('expected shared overlay proxy contract to centralize duplicate overlay root geometry selection')
  }
  if (!proxyText.includes('export function collectCanonicalFlowEditorOverlayRectEntries')) {
    throw new Error('expected shared overlay proxy contract to centralize canonical visible overlay rect collection')
  }

  const overlayCollisionPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const overlayCollisionText = readUtf8(overlayCollisionPath)
  if (!overlayCollisionText.includes('isTransientOffscreenRichMediaOverlayRoot(entry.el, rect)')) {
    throw new Error('expected Balanced overlay collision to ignore offscreen Rich Media bootstrap roots before obstacle planning')
  }
  if (!overlayCollisionText.includes('shouldReplaceFlowEditorOverlayRectCandidate(selectedRawRectByNodeId.get(id), nextRaw)')) {
    throw new Error('expected Balanced overlay collision to choose one canonical visible widget root before layout geometry use')
  }
  if (!overlayCollisionText.includes('collectCanonicalFlowEditorOverlayRectEntries(richMediaEls)')) {
    throw new Error('expected Balanced overlay collision to reuse the shared canonical overlay rect collector for Rich Media obstacles')
  }
}
