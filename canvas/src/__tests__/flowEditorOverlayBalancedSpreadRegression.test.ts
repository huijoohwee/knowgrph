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
  const hookText = readUtf8(hookPath)
  if (!hookText.includes('const posSig = buildPosSignature(overlayNodeIds, st.flowWidgetPosByNodeId)')) {
    throw new Error('expected overlay collision key to include shared stored-position signatures')
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
  if (!hookText.includes('const pinSig = overlayNodeIds')) {
    throw new Error('expected overlay collision key to include pinned signature')
  }
  if (!hookText.includes('querySelectorAll<HTMLElement>(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR)')) {
    throw new Error('expected overlay collision runtime to resolve widget roots through the shared renderer-scoped selector')
  }
  if (!hookText.includes('const unresolvedRectIdSet = new Set<string>()')) {
    throw new Error('expected overlay collision runtime to track unresolved collective panel measurements during init warmup')
  }
  if (!hookText.includes('const canDeferUntilMeasuredCollectiveLayout =')) {
    throw new Error('expected overlay collision runtime to defer collective relayout until measured overlay sizes are ready')
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
  if (!hookText.includes('compareNodeZKey')) {
    throw new Error('expected overlay collision runtime to reuse shared node z-order comparison helper')
  }
  if (!hookText.includes('const graphDataForOverlayRuntime =') || !hookText.includes('draftGraphDataRef.current || renderGraphDataOverride || null')) {
    throw new Error('expected overlay collision runtime to resolve a single upstream graph source before deriving node types and obstacles')
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
}
