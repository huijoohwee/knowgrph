import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testFlowEditorOverlayCollisionRebalancesStoredVerticalClusters = () => {
  const spreadPath = path.resolve(process.cwd(), 'src', 'lib', 'ui', 'overlayBalancedSpread.ts')
  const spreadText = readUtf8(spreadPath)
  if (!spreadText.includes('isVerticalOverlayCluster')) {
    throw new Error('expected shared overlay spread helper to detect vertical overlay clusters')
  }

  const hookPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const hookText = readUtf8(hookPath)
  if (!hookText.includes('const posSig = buildPosSignature(overlayNodeIds, st.flowWidgetPosByNodeId)')) {
    throw new Error('expected overlay collision key to include shared stored-position signatures')
  }
  if (!hookText.includes('const panelScaleKey = computeWidgetScaleKey(panelScale)')) {
    throw new Error('expected overlay collision key to bucket relayouts by stable floating scale')
  }
  if (!hookText.includes('const OVERLAY_POSITION_QUANTUM_PX = 1')) {
    throw new Error('expected overlay collision path to quantize persisted floating positions')
  }
  if (!hookText.includes('const pinSig = overlayNodeIds')) {
    throw new Error('expected overlay collision key to include pinned signature')
  }
  if (!hookText.includes('movable: true')) {
    throw new Error('expected floating overlays with stored positions to remain auto-rebalanceable')
  }
  if (!hookText.includes('shouldRebalanceCluster')) {
    throw new Error('expected overlay collision path to rebalance vertical clusters')
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
  if (!hookText.includes('const allowNodeObstacleCollision = !args.overlayOnlyModeEnabled')) {
    throw new Error('expected overlay collision runtime to disable hidden node-obstacle feedback in overlay-only mode')
  }
  if (!hookText.includes('if (overlayNodeIdSet.has(id)) continue')) {
    throw new Error('expected overlay collision runtime to avoid treating overlay-owned nodes as collision obstacles')
  }
  if (!hookText.includes('compareNodeZKey')) {
    throw new Error('expected overlay collision runtime to reuse shared node z-order comparison helper')
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
  if (!overlayText.includes('if (floatingRef.current && !pinnedDragOverrideRef.current) return')) {
    throw new Error('expected floating overlay interaction-frame refreshes to stay idle when the panel is not actively dragging')
  }
  if (!overlayText.includes('if (lastFloatingScaleKeyRef.current === scaleKey)')) {
    throw new Error('expected floating overlay zoom subscription to ignore pan-only zoom-state churn')
  }
  if (!overlayText.includes('const allowPassiveClampPersist =')) {
    throw new Error('expected floating overlay clamp persistence to be gated so passive viewport/layout updates do not rewrite store positions continuously')
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
}
