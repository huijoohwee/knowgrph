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
  const renderGraphHelperPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts')
  const overlayNodeOrderPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlayNodeOrder.ts')
  const topologySignaturePath = path.resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'overlayTopologyLayoutSignature.ts')
  const overlayProxyPath = path.resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts')
  const presentationPath = path.resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts')
  const hookText = readUtf8(hookPath)
  const runtimeText = readUtf8(runtimePath)
  const sceneText = readUtf8(scenePath)
  const surfaceText = readUtf8(surfacePath)
  const surfaceElementsText = readUtf8(path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx'))
  const renderGraphHelperText = readUtf8(renderGraphHelperPath)
  const overlayNodeOrderText = readUtf8(overlayNodeOrderPath)
  const topologySignatureText = readUtf8(topologySignaturePath)
  const overlayProxyText = readUtf8(overlayProxyPath)
  const presentationText = readUtf8(presentationPath)
  if (!hookText.includes('const posSig = buildPosSignature(overlayNodeIds, {')) {
    throw new Error('expected overlay collision key to include shared scoped position signatures')
  }
  if (!hookText.includes('resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected overlay collision runtime to resolve widget pin/screen/world state through the shared graph-scoped helper')
  }
  if (!hookText.includes('const graphKey = buildGraphMetaKeyIgnoringPending(graphDataForOverlayRuntime)')) {
    throw new Error('expected overlay collision runtime to derive one active render-graph key before reading scoped widget state')
  }
  if (!hookText.includes("import { hashScopedStringArraySignature, hashSignatureParts, normalizeStringArrayForSignature } from '@/lib/hash/signature'")) {
    throw new Error('expected overlay collision runtime to reuse shared semantic-key helpers instead of local join-based key assembly')
  }
  if (
    !renderGraphHelperText.includes("cacheScope: scope,")
    || !renderGraphHelperText.includes('getCachedGraphLookup({')
    || !hookText.includes("scope: 'flow-editor-overlay-collision-graph'")
    || !hookText.includes('getCachedFlowEditorRenderGraph({')
  ) {
    throw new Error('expected overlay collision runtime to reuse the shared render-graph helper instead of rebuilding local node maps inside the settle loop')
  }
  if (!overlayNodeOrderText.includes('export function orderFlowEditorOverlayNodeIdsByRenderGraph')
    || !overlayNodeOrderText.includes("import { splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'")
    || !overlayNodeOrderText.includes('function buildOverlayOrderKey(id: string): string')
    || !hookText.includes('orderFlowEditorOverlayNodeIdsByRenderGraph({')
    || !surfaceElementsText.includes('orderFlowEditorOverlayNodeIdsByRenderGraph({')) {
    throw new Error('expected Flow Editor overlay surface and collision runtime to share one canonical semantic ordering helper')
  }
  if (overlayNodeOrderText.includes('buildNodeZKeyById') || overlayNodeOrderText.includes('compareNodeZKey')) {
    throw new Error('expected Flow Editor overlay ordering to avoid Flow Canvas visual z-order authority')
  }
  if (hookText.includes('panelScaleKey')) {
    throw new Error('expected overlay collision settle keys to avoid zoom-scale buckets that relayout instead of resizing the collective')
  }
  if (!hookText.includes('computeCollectiveFollowPinnedScale')) {
    throw new Error('expected overlay collision path to reuse the shared follow-pinned scale helper')
  }
  if (!hookText.includes('computeBalancedSpreadLayout')) {
    throw new Error('expected overlay collision path to reuse shared centered balanced spread layout planning')
  }
  if (!hookText.includes("import { resolveFlowEditorVisibleViewport } from '@/components/FlowCanvas/applyZoomRequestNative'")) {
    throw new Error('expected overlay collision path to reuse the shared visible viewport helper before planning balanced frontmatter reseeds')
  }
  if (!hookText.includes('computeBalancedSpreadViewportMargins')) {
    throw new Error('expected overlay collision path to reuse shared 16:9 viewport margins instead of local hardcodes')
  }
  if (!hookText.includes('height: Math.max(1, snapScreen(balancedLayoutSize.height + gapPx))')) {
    throw new Error('expected overlay collision grid cells to reserve full measured overlay height plus gap so dense frontmatter collectives cannot overlap by construction')
  }
  if (!hookText.includes('width: Math.max(120, floatingScaled.width, maxW)') || !hookText.includes('height: Math.max(160, floatingScaled.height, maxH)')) {
    throw new Error('expected overlay collision planner to reserve seeded cells from the largest live measured overlay footprint instead of capping back down to the default floating size')
  }
  if (!hookText.includes('const OVERLAY_POSITION_QUANTUM_PX = 1')) {
    throw new Error('expected overlay collision path to quantize persisted floating positions')
  }
  if (!hookText.includes("const overlayNodeIdsKey = hashScopedStringArraySignature('overlay-collision-node-ids', overlayNodeIds)")) {
    throw new Error('expected overlay collision key to derive a semantic overlay-node-set signature through the shared helper')
  }
  if (hookText.includes('pinSig')) {
    throw new Error('expected overlay collision settle keys to avoid pin-state buckets that mutate the collective layout on pin/unpin')
  }
  if (!hookText.includes('queryActiveSurfaceOverlays(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR)')) {
    throw new Error('expected overlay collision runtime to resolve widget roots through the shared active-surface selector')
  }
  if (!overlayProxyText.includes('FLOW_EDITOR_OVERLAY_SURFACE_ROOT_ATTR')
    || !overlayProxyText.includes('readFlowEditorOverlaySurfaceId(el) === surfaceId')
    || !hookText.includes('queryFlowEditorOverlayRootsForSurface({')) {
    throw new Error('expected overlay collision runtime to delegate active Flow Editor surface scoping to the shared overlay proxy helper')
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
  if (!hookText.includes('const frontmatterScreenAuthorityOwnedByPlacementRuntime =')
    || !hookText.includes('if (frontmatterScreenAuthorityOwnedByPlacementRuntime)')
    || !hookText.includes('resetOverlayCollisionTransientState(true)')) {
    throw new Error('expected frontmatter screen-authority overlays to stop collision writes at the collision/placement ownership boundary')
  }
  if (!hookText.includes('movable: true')) {
    throw new Error('expected floating overlays with stored positions to remain auto-rebalanceable')
  }
  if (!hookText.includes('const nodeById = overlayGraphLookup?.nodeById || null')) {
    throw new Error('expected overlay collision path to read node types from the shared render-graph node lookup')
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
  if (!hookText.includes("nodeTypeId: String(nodeById?.get(id)?.type || '').trim()")) {
    throw new Error('expected overlay collision path to keep canonical frontmatter built-ins auto-rebalanceable through the shared node lookup')
  }
  if (!hookText.includes('if (stillOverlaps && (changedPos || changedWorld))')) {
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
    throw new Error('expected overlay collision path to reschedule on global floating position updates')
  }
  if (!hookText.includes('flowWidgetPosByNodeIdByGraphMetaKey')) {
    throw new Error('expected overlay collision path to reschedule on graph-keyed floating position updates too')
  }
  if (!hookText.includes('flowWidgetWorldPosByNodeIdByGraphMetaKey')) {
    throw new Error('expected overlay collision path to resolve graph-keyed world positions without subscribing them as layout triggers')
  }
  if (!hookText.includes('flowWidgetPinnedByNodeIdByGraphMetaKey')) {
    throw new Error('expected overlay collision path to resolve graph-keyed pinned state without subscribing it as a layout trigger')
  }
  if (hookText.includes('const unsubWorld = useGraphStore.subscribe') || hookText.includes('const unsubWorldByKey = useGraphStore.subscribe')) {
    throw new Error('expected overlay collision path to avoid world-position subscriptions so zoom resizes instead of relayouting')
  }
  if (hookText.includes('const unsubPinned = useGraphStore.subscribe') || hookText.includes('const unsubPinnedByKey = useGraphStore.subscribe')) {
    throw new Error('expected overlay collision path to avoid pin-state subscriptions so pin/unpin does not relayout the collective')
  }
  if (!hookText.includes('const allowNodeObstacleCollision = !overlayOnlyModeEnabled')) {
    throw new Error('expected overlay collision runtime to disable hidden node-obstacle feedback in overlay-only mode')
  }
  if (!hookText.includes('const visibleViewport = resolveFlowEditorVisibleViewport({')) {
    throw new Error('expected overlay collision runtime to derive a pane-aware visible viewport before sizing the balanced collective')
  }
  if (!hookText.includes('viewportW: visibleViewportWidth,') || !hookText.includes('viewportH: visibleViewportHeight,')) {
    throw new Error('expected overlay collision runtime to size frontmatter balanced reseeds against the visible viewport dimensions')
  }
  if (!hookText.includes('const activeViewport = isFrontmatterFlow')) {
    throw new Error('expected overlay collision runtime to derive one active viewport for balanced-state scoring and bounded anchor-shift inputs')
  }
  if (!hookText.includes('const resolveInfiniteCanvasCollisionPosition = (pos: { left: number; top: number }, _size: { width: number; height: number }) => {')) {
    throw new Error('expected overlay collision runtime to resolve collision positions without viewport clamp in infinite-canvas mode')
  }
  if (hookText.includes('clampToCollisionViewport') || hookText.includes('const okX = left >= activeViewport.left')) {
    throw new Error('expected overlay collision runtime to forbid viewport clamp/reject logic for stored infinite-canvas positions')
  }
  if (!hookText.includes('const storedCollectiveViewportState = deriveCollectiveViewportState(storedCollectiveItems)')) {
    throw new Error('expected overlay collision runtime to score stored frontmatter floating collectives before preserving them')
  }
  if (!hookText.includes("from '@/components/FlowCanvas/workspaceVisibleViewportRecovery'")) {
    throw new Error('expected overlay collision runtime to reuse the shared visible-viewport collective scorer')
  }
  if (!hookText.includes('buildFlowOverlayBoundsFromRects({ items })')
    || !hookText.includes('deriveFlowOverlayCollectiveViewportState({')
    || hookText.includes('return { centered: true, balanced }')) {
    throw new Error('expected overlay collision stored-collective scoring to use real shared bounds/centroid state instead of a local centered alias')
  }
  if (!hookText.includes('&& !storedCollectiveViewportState?.balanced')) {
    throw new Error('expected overlay collision runtime to reject only unbalanced stored frontmatter collective residue before reuse')
  }
  if (!hookText.includes('if (isFrontmatterFlow && overlayOnlyModeEnabled) return \'\'')) {
    throw new Error('expected frontmatter overlay-only balanced reseeds to avoid anchoring the whole collective to one arbitrary survivor widget')
  }
  if (!hookText.includes('x: visibleViewportLeft + visibleViewportWidth / 2,') || !hookText.includes('y: visibleViewportTop + visibleViewportHeight / 2,')) {
    throw new Error('expected frontmatter overlay-only balanced reseeds to fall back to the visible viewport centroid when no explicit fixed widget is selected')
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
  if (!hookText.includes('orderFlowEditorOverlayNodeIdsByRenderGraph({')) {
    throw new Error('expected overlay collision runtime to reuse shared graph-owned overlay ordering helper')
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
  if (!topologySignatureText.includes("import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'")) {
    throw new Error('expected shared overlay topology/layout signature to reuse graph edge endpoint normalization')
  }
  if (!topologySignatureText.includes("import { splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'")) {
    throw new Error('expected shared overlay topology/layout signature to canonicalize composed workspace node identities through the shared helper')
  }
  if (!topologySignatureText.includes("import { readFlowEdgePortKey } from '@/lib/graph/flowPorts'")) {
    throw new Error('expected shared overlay topology/layout signature to reuse shared flow edge port readers')
  }
  if (!topologySignatureText.includes("return splitComposedNodeId(id).inner || id")) {
    throw new Error('expected shared overlay topology/layout signature to normalize workspace-prefixed overlay ids to their canonical inner identity')
  }
  if (!topologySignatureText.includes('const { src, tgt } = readGraphEdgeEndpoints(edge)')) {
    throw new Error('expected shared overlay topology/layout signature to normalize edge endpoints through the shared pair helper')
  }
  if (!topologySignatureText.includes("const sourcePortKey = readFlowEdgePortKey(edge, 'source') || ''")) {
    throw new Error('expected shared overlay topology/layout signature to derive source port keys through the shared flow-port helper')
  }
  if (!topologySignatureText.includes("const targetPortKey = readFlowEdgePortKey(edge, 'target') || ''")) {
    throw new Error('expected shared overlay topology/layout signature to derive target port keys through the shared flow-port helper')
  }
  if (topologySignatureText.includes("String(edge.source || '').trim()") || topologySignatureText.includes("String(props.sourcePort || props['flow:sourcePort'] || '').trim()")) {
    throw new Error('expected shared overlay topology/layout signature to avoid raw endpoint and legacy port alias reads')
  }
  if (!hookText.includes('overlayTopologyLayoutSignature,') || hookText.includes('graphContentRevision,\n    overlayOnlyModeEnabled')) {
    throw new Error('expected run-output graph content revisions to avoid resetting Balanced overlay collision layout')
  }
  if (!runtimeText.includes('const overlayTopologyLayoutSignature = React.useMemo(() => {')) {
    throw new Error('expected Flow Editor runtime to derive one shared semantic topology/layout signature')
  }
  const runtimeSceneCallIndex = runtimeText.indexOf('useFlowEditorRuntimeScene({')
  const runtimeSceneCall = runtimeSceneCallIndex >= 0 ? runtimeText.slice(runtimeSceneCallIndex, runtimeSceneCallIndex + 420) : ''
  if (!runtimeSceneCall.includes('overlayTopologyLayoutSignature,') || runtimeSceneCall.includes('graphContentRevision,')) {
    throw new Error('expected Flow Editor runtime scene seeding to receive semantic topology/layout signature instead of raw graph revision')
  }
  if (!surfaceText.includes("'frontmatter-overlay-auto-pins'") || !surfaceText.includes('overlayEditorNodeIdsKey') || !surfaceText.includes("hashScopedStringArraySignature('missing-frontmatter-pins', missingIds)")) {
    throw new Error('expected Flow Editor overlay pin seeding to ignore output-only graph revisions')
  }
  if (!sceneText.includes('args.overlayTopologyLayoutSignature') || sceneText.includes('args.baseGraphDataRevision')) {
    throw new Error('expected Flow Editor world-position seeding to ignore output-only graph revisions')
  }
  if (!sceneText.includes('const graphDataForSeeding = resolveFlowEditorGraphDataForNodeAuthority({') || !sceneText.includes('preferredGraphData: renderGraphDataOverrideRef.current') || !sceneText.includes('authorityGraphData: (st.graphData || null) as GraphData | null')) {
    throw new Error('expected Flow Editor world-position seeding to resolve latest graph authority from refs without raw graph-object dependency churn')
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

  const flowCanvasLayoutStatePath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasLayoutState.ts')
  const flowCanvasLayoutStateText = readUtf8(flowCanvasLayoutStatePath)
  if (!flowCanvasLayoutStateText.includes('const cellH = WIDGET_BASE_SIZE.height + gapPx')) {
    throw new Error('expected Flow Canvas dock reservation to reserve full widget height plus gap for dense unpinned collectives')
  }

  const seedSpreadPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'seedGroupSpread.ts')
  const seedSpreadText = readUtf8(seedSpreadPath)
  if (!seedSpreadText.includes('computeBalancedSpreadGridForTargetAspect')) {
    throw new Error('expected pinned widget reseed path to reuse the shared balanced spread grid planner')
  }
  if (!seedSpreadText.includes('preferredFirstRowCount')) {
    throw new Error('expected pinned widget reseed path to support upstream preferred first-row composition for frontmatter hero layouts')
  }
  const handlesPath = path.resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'handles.ts')
  const handlesText = readUtf8(handlesPath)
  if (!handlesText.includes('rebalanceRichMediaPanelHandles')) {
    throw new Error('expected shared flow handle planner to own rich media panel handle rebalancing')
  }
  if (!handlesText.includes("activeTab === 'text'")) {
    throw new Error('expected shared flow handle planner to rebalance panel handles by active rich media tab')
  }
  if (!handlesText.includes('FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID')) {
    throw new Error('expected shared flow handle planner to scope panel rebalancing to rich media panel node types only')
  }

  const frontmatterCorePath = path.resolve(process.cwd(), 'src', 'features', 'parsers', 'markdownFrontmatterFlowGraph.core.ts')
  const frontmatterCoreText = readUtf8(frontmatterCorePath)
  if (!frontmatterCoreText.includes('balancedPanelOffsetScale')) {
    throw new Error('expected frontmatter-flow director-brief derivation to consume shared balanced panel offset scale')
  }
  if (!frontmatterCoreText.includes('buildDirectorBriefShotLayoutConfig')) {
    throw new Error('expected frontmatter-flow director-brief derivation to centralize layout math in a shared helper')
  }
  if (!frontmatterCoreText.includes('readDirectorBriefShotPlacement')) {
    throw new Error('expected frontmatter-flow director-brief derivation to reuse a shared placement reader per shot')
  }

  const overlayEdgesPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const overlayEdgeRenderGraphHelperPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts')
  const overlayEdgesText = readUtf8(overlayEdgesPath)
  const overlayEdgeRenderGraphHelperText = readUtf8(overlayEdgeRenderGraphHelperPath)
  if (!overlayEdgeRenderGraphHelperText.includes("import { pickDefaultFlowPortKey, readFlowEdgePortKey } from '@/lib/graph/flowPorts'")) {
    throw new Error('expected Flow Editor overlay edge graph helper to own shared flow port helper reuse')
  }
  if (!overlayEdgeRenderGraphHelperText.includes("const sourcePortKey =\n      readFlowEdgePortKey(edgeWithProps, 'source')")) {
    throw new Error('expected Flow Editor overlay edge graph helper to resolve source endpoint keys through shared flow port helpers')
  }
  if (!overlayEdgeRenderGraphHelperText.includes("const targetPortKey =\n      readFlowEdgePortKey(edgeWithProps, 'target')")) {
    throw new Error('expected Flow Editor overlay edge graph helper to resolve target endpoint keys through shared flow port helpers')
  }
  if (!overlayEdgeRenderGraphHelperText.includes("const outPortKey = pickDefaultFlowPortKey({ properties: node?.properties as never }, 'out') || FLOW_HANDLE_DEFAULT_EDGE_ID")) {
    throw new Error('expected Flow Editor overlay edge graph helper to reuse shared semantic default out-port fallback')
  }
  if (!overlayEdgeRenderGraphHelperText.includes("const inPortKey = pickDefaultFlowPortKey({ properties: node?.properties as never }, 'in') || FLOW_HANDLE_DEFAULT_EDGE_ID")) {
    throw new Error('expected Flow Editor overlay edge graph helper to reuse shared semantic default in-port fallback')
  }
  if (!overlayEdgesText.includes('const graphLookup = getCachedFlowEditorOverlayEdgeGraph({')) {
    throw new Error('expected Flow Editor overlay edge rendering to consume the shared overlay edge graph helper')
  }
  if (!overlayEdgesText.includes('const defaultPortKeyByNodeId = graphLookup?.defaultPortKeyByNodeId || new Map<string, { in: string; out: string }>()')) {
    throw new Error('expected Flow Editor overlay edge rendering to consume shared default port fallbacks from the overlay edge graph helper')
  }
  if (!overlayEdgeRenderGraphHelperText.includes('edgeCurveById')) {
    throw new Error('expected Flow Editor overlay edge graph helper to precompute shared edge-curve hints for frontmatter shot routing')
  }
  if (!overlayEdgesText.includes('const edgeCurveById = graphLookup?.edgeCurveById || new Map')) {
    throw new Error('expected Flow Editor overlay edge rendering to consume shared edge-curve hints from the overlay edge graph helper')
  }
  if (!overlayEdgesText.includes('e.sourcePortKey || FLOW_HANDLE_DEFAULT_EDGE_ID')) {
    throw new Error('expected Flow Editor overlay edge rendering to keep default handle fallback aligned with the shared overlay edge graph output')
  }
  if (!overlayEdgesText.includes('frontmatterShotEdgeCrowdingLift')) {
    throw new Error('expected Flow Editor overlay edge rendering to apply a shared frontmatter shot crowding lift for hero/CTA routing')
  }
  if (overlayEdgesText.includes('firstSchemaPortKeyByNodeId')) {
    throw new Error('expected Flow Editor overlay edge rendering to avoid local first-schema-port fallback aliases')
  }

  const workflowPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const workflowRunAllPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowRunAll.ts')
  const workflowWritebackPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowWriteback.ts')
  const workflowRichMediaPanelPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorWorkflowRichMediaPanel.ts')
  const workflowText = readUtf8(workflowPath)
  const workflowRunAllText = readUtf8(workflowRunAllPath)
  const workflowWritebackText = readUtf8(workflowWritebackPath)
  const workflowRichMediaPanelText = readUtf8(workflowRichMediaPanelPath)
  if (!workflowWritebackText.includes('export function areFlowEditorWorkflowRecordValuesEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean')) {
    throw new Error('expected shared workflow writeback helper to compare semantic property values before replacing node objects')
  }
  if (!workflowWritebackText.includes('if (areFlowEditorWorkflowRecordValuesEqual(currentProps, nextProps)) return existing')) {
    throw new Error('expected shared workflow writeback helper to skip unchanged draft output/loading patches')
  }
  if (!workflowWritebackText.includes('if (updated) args.scheduleWorkflowOutputEdgeRefresh()')) {
    throw new Error('expected shared workflow writeback helper to refresh overlay edges only after an actual output write')
  }
  if (!workflowText.includes('const allowCreateRichMediaPanel = runOptions?.allowCreateRichMediaPanel !== false')) {
    throw new Error('expected workflow node runs to expose an explicit topology creation gate for Rich Media Panel mirroring')
  }
  if (!workflowRichMediaPanelText.includes('if (!args.allowCreateRichMediaPanel) return null')) {
    throw new Error('expected shared Rich Media Panel helper to skip node creation when Run all is output-only')
  }
  if (!workflowRunAllText.includes('await args.runWorkflowNode(ids[index]!, { allowCreateRichMediaPanel: false })')) {
    throw new Error('expected Toolbar Run all to write outputs into existing nodes only without appending Rich Media Panel nodes')
  }
  if (!workflowText.includes('const readLiveDraftGraphData = () => (args.draftGraphDataRef.current || args.draftGraphData) as GraphData | null')) {
    throw new Error('expected Run all to use the live draft graph ref as the mutation SSOT between sequential node runs')
  }
  if (!workflowText.includes('args.setDraftGraphData(prev => (prev === currentDraft ? nextDraft : args.draftGraphDataRef.current))')) {
    throw new Error('expected Run all output writes to update the draft ref synchronously before React state catches up')
  }
  if (!workflowWritebackText.includes("import { bumpFlowEditorDraftGraphDataRevision } from '@/lib/flowEditor/flowEditorDraftGraphData'")) {
    throw new Error('expected shared workflow writeback helper to reuse neutral Flow Editor draft revision bumping')
  }
  if (!workflowWritebackText.includes('const nextDraft = bumpFlowEditorDraftGraphDataRevision({ ...currentDraft, nodes: nextNodes })')) {
    throw new Error('expected shared workflow writeback helper to bump revision at the same SSOT draft mutation point')
  }
  if (workflowRunAllText.includes("await args.runWorkflowNode(ids[index]!, { allowCreateRichMediaPanel: false })\n        scheduleWorkflowOutputEdgeRefresh()")) {
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
  const overlayPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const placementPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const overlayText = readUtf8(overlayPath)
  const placementText = readUtf8(placementPath)
  if (!overlayText.includes('const floating = pinnedInCanvas !== true')) {
    throw new Error('expected node overlay floating mode to follow pinned state')
  }
  if (overlayText.includes('const floating = false')) {
    throw new Error('expected node overlay to avoid hardcoded non-floating mode')
  }
  if (!overlayText.includes("placement.applyOverlayPosition({ persistClamp: false, emitInteractionFrame: false })")) {
    throw new Error('expected node overlay zoom and interaction refreshes to avoid persisting floating clamp churn')
  }
  if (overlayText.includes('let raf: number | null = null') || overlayText.includes('requestAnimationFrame(() => {\n        raf = null\n        placement.applyOverlayPosition')) {
    throw new Error('expected interaction-frame overlay refresh to apply in the current event frame instead of adding a trailing RAF')
  }
  if (overlayText.includes('if (floating && !placement.pinnedDragOverrideRef.current && !placement.worldDragOverrideRef.current) return')) {
    throw new Error('expected floating overlays to refresh from live interaction frames instead of lagging behind pinned overlays')
  }
  if (!placementText.includes('const sameScale = lastFloatingScaleKeyRef.current === scaleKey')) {
    throw new Error('expected floating overlay zoom subscription to ignore pan-only zoom-state churn')
  }
  if (!overlayText.includes("placement.applyOverlayPosition({ persistClamp: false, emitInteractionFrame: false })")) {
    throw new Error('expected passive interaction-frame refreshes to avoid persisted clamp/store churn')
  }
  if (!overlayText.includes('const floatingUsesScreenAuthority = shouldUseFlowEditorWidgetFloatingScreenAuthority({')) {
    throw new Error('expected frontmatter floating overlays to reuse the shared screen-authority helper')
  }
  if (!placementText.includes('const currentStoredWorldForPlacement = frontmatterManagedNode && floatingUsesScreenAuthority')
    || !placementText.includes('const storedWorld = currentStoredWorldForPlacement || (floatingUsesScreenAuthority ? null : widgetWorldPosRef.current)')) {
    throw new Error('expected frontmatter floating overlays to keep stored world positions out of screen-authority placement')
  }
  if (!placementText.includes('persistWorldPos(nextWorld)')) {
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
  if (!overlayText.includes('const stableSize = readStableRichMediaPanelSize(record)')) {
    throw new Error('expected Rich Media overlay sizing to refresh its last-known size cache from semantic scene node props')
  }
  if (!overlayText.includes('for (const id of Array.from(lastKnownSizes.keys())) {')) {
    throw new Error('expected Rich Media overlay size cache to prune removed nodes without dropping active-node stable sizes during workspace churn')
  }
  if (!overlayText.includes('readStableRichMediaPanelSize(props) || mediaOverlayPanelLastKnownWorldSizeRef.current.get(id) || null')) {
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
  if (!overlayText.includes('const stopPassiveLayoutWhileWorkspaceOverlayOpen =\n      workspaceOverlayOpenRef.current && !flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected Rich Media layout scheduling to derive a frontmatter-aware passive layout exception while Workspace/Indexing overlay is open')
  }
  if (!overlayText.includes('if (!active || mediaLayoutItems.length === 0 || stopPassiveLayoutWhileWorkspaceOverlayOpen)')) {
    throw new Error('expected Rich Media layout loop shutdown to exempt frontmatter document mode from workspace-open passive-layout parking')
  }
  if (!overlayText.includes('if (stopPassiveLayoutWhileWorkspaceOverlayOpen) return')) {
    throw new Error('expected passive Rich Media layout scheduling to skip only when workspace-open mutation blocking applies outside frontmatter document mode')
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
