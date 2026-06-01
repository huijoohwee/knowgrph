import React from 'react'

import { computeFlowGroupAabb, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import { resolveFlowEditorVisibleViewport } from '@/components/FlowCanvas/applyZoomRequestNative'
import {
  buildFlowOverlayBoundsFromRects,
  deriveFlowOverlayCollectiveViewportState,
  type VisibleFlowViewport,
} from '@/components/FlowCanvas/workspaceVisibleViewportRecovery'
import { placeWidgetsCenteredInGroupBounds } from '@/components/FlowEditor/seedGroupSpread'
import { computeCollectiveFollowPinnedScale, computeWidgetScaledSize, WIDGET_BASE_SIZE } from '@/lib/canvas/overlayWidgetZoom'
import {
  isCanonicalFrontmatterBuiltInWidgetNode,
  resolveGraphNodeIdByCanonicalId,
  shouldAutoPlaceFlowEditorWidget,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceGraphMutationBlocked, type WorkspaceGraphMutationState } from '@/features/workspace-table/workspaceTableSsot'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import {
  collectCanonicalFlowEditorOverlayRectEntries,
  emitFlowEditorInteractionFrame as emitFlowEditorInteractionFrameEvent,
  findFlowEditorOverlaySurfaceRoot,
  FLOW_EDITOR_OVERLAY_ROOT_SELECTOR,
  FLOW_EDITOR_INTERACTION_FRAME_EVENT,
  isTransientOffscreenRichMediaOverlayRoot,
  queryFlowEditorOverlayRootsForSurface,
  RICH_MEDIA_OVERLAY_ROOT_SELECTOR,
} from '@/lib/canvas/flow-editor-overlay-proxy'
import {
  computeBalancedSpreadBaseGapPx,
  computeBalancedSpreadViewportMargins,
  computeBalancedSpreadSpacingPx,
  shouldForceBalancedSpreadReseed,
} from '@/lib/ui/overlayBalancedSpread'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import type { GraphData } from '@/lib/graph/types'
import { readWidgetGridLayoutSettings, snapToGridPx } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { getCachedFlowEditorWidgetPlacementContext } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'
import {
  buildWorkspaceBlockedFlowWidgetSeedPatch, syncFlowWidgetScreenAuthorityPosition,
  type FlowWidgetSeedStoreState,
} from '@/components/FlowEditorCanvas/runtime/flowEditorRuntimeSeedPositions'
import { readFrontmatterFlowRenderSettings, resolveBalancedViewportPreset } from '@/lib/graph/frontmatterFlowSettings'
import { resolveScopedFlowWidgetNodeMap } from '@/lib/flowEditor/widgetStateScope'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { __flowCanvasDebug, syncFlowCanvasDebugWindow } from '@/components/FlowCanvas/flowCanvasDebug'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { relaxOverlayPanelsWithCollision } from '@/lib/ui/relaxOverlayPanelsWithCollision'
import {
  type FlowWidgetPinnedById,
  type FlowWidgetScreenPosById,
  type FlowWidgetWorldPosById,
  useFlowEditorWidgetStateDependencyCounts,
} from '@/components/FlowEditorCanvas/runtime/flowEditorRuntimeWidgetState'
import { getCachedFlowEditorContainmentGroupLookup } from '@/components/FlowEditorCanvas/runtime/flowEditorRuntimeGroupLookup'

const FLOW_EDITOR_RUNTIME_SCENE_TRACE_KEY = '__flowEditorRuntimeSceneDebug'

type FlowRuntimeZoomTransform = { k: number; x: number; y: number }

function readFiniteRuntimeZoomTransform(runtime: FlowNativeRuntime | null | undefined): FlowRuntimeZoomTransform | null {
  const t = runtime?.transform || null
  const k = typeof t?.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : null
  const x = typeof t?.x === 'number' && Number.isFinite(t.x) ? t.x : null
  const y = typeof t?.y === 'number' && Number.isFinite(t.y) ? t.y : null
  if (k == null || x == null || y == null) return null
  return { k, x, y }
}

function hasViewportOffset(transform: FlowRuntimeZoomTransform | null | undefined): boolean {
  if (!transform) return false
  return Math.abs(transform.k - 1) > 1e-3 || Math.abs(transform.x) > 0.5 || Math.abs(transform.y) > 0.5
}

function resolveFlowEditorCollectiveCenterShift(args: {
  preferredShift: number
  minShift: number
  maxShift: number
}): number {
  const preferred = Number.isFinite(args.preferredShift) ? args.preferredShift : 0
  const min = Number.isFinite(args.minShift) ? args.minShift : 0
  const max = Number.isFinite(args.maxShift) ? args.maxShift : 0
  if (min > max) return preferred
  return Math.max(min, Math.min(max, preferred))
}

function pushFlowEditorRuntimeSceneTrace(entry: {
  reason: string
  sceneNodeCount: number
  positionsReady: boolean
  workspaceMutationBlocked: boolean
  viewportW: number
  viewportH: number
  transform: { k: number; x: number; y: number } | null
}) {
  if (typeof window === 'undefined') return
  const w = window as Window & {
    [FLOW_EDITOR_RUNTIME_SCENE_TRACE_KEY]?: {
      last: string
      history: Array<{
        ts: number
        reason: string
        sceneNodeCount: number
        positionsReady: boolean
        workspaceMutationBlocked: boolean
        viewportW: number
        viewportH: number
        transform: { k: number; x: number; y: number } | null
      }>
    }
  }
  const sig = [
    entry.reason,
    entry.sceneNodeCount,
    entry.positionsReady ? 1 : 0,
    entry.workspaceMutationBlocked ? 1 : 0,
    `${entry.viewportW}x${entry.viewportH}`,
    entry.transform ? `${Math.round(entry.transform.x)}:${Math.round(entry.transform.y)}:${Math.round(entry.transform.k * 1000)}` : 'none',
  ].join('|')
  const current = w[FLOW_EDITOR_RUNTIME_SCENE_TRACE_KEY] || { last: '', history: [] }
  if (current.last === sig) return
  const nextHistory = current.history.concat([{
    ts: Date.now(),
    reason: entry.reason,
    sceneNodeCount: entry.sceneNodeCount,
    positionsReady: entry.positionsReady,
    workspaceMutationBlocked: entry.workspaceMutationBlocked,
    viewportW: entry.viewportW,
    viewportH: entry.viewportH,
    transform: entry.transform,
  }])
  while (nextHistory.length > 32) nextHistory.shift()
  w[FLOW_EDITOR_RUNTIME_SCENE_TRACE_KEY] = {
    last: sig,
    history: nextHistory,
  }
}

export function useFlowEditorRuntimeScene(args: {
  active: boolean
  flowEditorSurfaceId?: string
  openWidgetNodeIds: string[]
  renderGraphDataOverride: GraphData | null
  viewportW: number
  viewportH: number
  schema: unknown
  overlayTopologyLayoutSignature: string
  flowEditorLayoutRebalanceRequest?: null | { type: 'balanced-spread'; at: number }
  zoomViewKeyRef: React.MutableRefObject<string | null>
}) {
  const flowRuntimeRefRef = React.useRef<React.MutableRefObject<FlowNativeRuntime | null> | null>(null)
  const latestAutoSeedWorldPosByNodeIdRef = React.useRef<Record<string, { x: number; y: number }>>({})
  const lastUsableZoomTransformRef = React.useRef<{ k: number; x: number; y: number } | null>(null)
  const workspaceMutationBlocked = useGraphStore(s => isWorkspaceGraphMutationBlocked(s))
  const { flowWidgetPinnedCount, flowWidgetWorldPosCount } = useFlowEditorWidgetStateDependencyCounts()
  const workspaceMutationBlockedPrevRef = React.useRef<boolean>(workspaceMutationBlocked)
  const lastInteractionFrameAtMsRef = React.useRef<number>(0)
  const getVisibleViewport = React.useCallback(() => {
    return resolveFlowEditorVisibleViewport({
      flowEditorSurfaceId: args.flowEditorSurfaceId,
      viewportW: args.viewportW,
      viewportH: args.viewportH,
    })
  }, [args.flowEditorSurfaceId, args.viewportH, args.viewportW])
  const shouldPreserveWorkspaceReopenAuthorities = React.useCallback(() => {
    const lastUsable = lastUsableZoomTransformRef.current
    if (!lastUsable) return false
    const autoSeedWorldNodes = Object.values(latestAutoSeedWorldPosByNodeIdRef.current || {})
      .filter((world): world is { x: number; y: number } => (
        !!world
        && Number.isFinite(world.x)
        && Number.isFinite(world.y)
      ))
    if (autoSeedWorldNodes.length === 0) return false
    const k = typeof lastUsable.k === 'number' && Number.isFinite(lastUsable.k) && lastUsable.k > 0
      ? lastUsable.k
      : null
    const x = typeof lastUsable.x === 'number' && Number.isFinite(lastUsable.x) ? lastUsable.x : null
    const y = typeof lastUsable.y === 'number' && Number.isFinite(lastUsable.y) ? lastUsable.y : null
    if (k == null || x == null || y == null) return false
    const visibleViewport = getVisibleViewport()
    const panelW = WIDGET_BASE_SIZE.width * k
    const panelH = WIDGET_BASE_SIZE.height * k
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (let i = 0; i < autoSeedWorldNodes.length; i += 1) {
      const world = autoSeedWorldNodes[i]!
      const left = world.x * k + x
      const top = world.y * k + y
      minX = Math.min(minX, left)
      minY = Math.min(minY, top)
      maxX = Math.max(maxX, left + panelW)
      maxY = Math.max(maxY, top + panelH)
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return false
    const marginX = Math.max(24, visibleViewport.width * 0.08)
    const marginY = Math.max(24, visibleViewport.height * 0.08)
    const offscreen =
      maxX <= visibleViewport.left - marginX
      || maxY <= visibleViewport.top - marginY
      || minX >= visibleViewport.right + marginX
      || minY >= visibleViewport.bottom + marginY
    if (offscreen) return false
    return (
      maxX > visibleViewport.left
      && maxY > visibleViewport.top
      && minX < visibleViewport.right
      && minY < visibleViewport.bottom
    )
  }, [getVisibleViewport])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const markInteraction = () => {
      lastInteractionFrameAtMsRef.current = Date.now()
    }
    try {
      window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, markInteraction as EventListener)
    } catch {
      void 0
    }
    return () => {
      try {
        window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, markInteraction as EventListener)
      } catch {
        void 0
      }
    }
  }, [])

  const getLiveNodeWorldPos = React.useCallback((nodeId: string) => {
    const id = String(nodeId || '').trim()
    if (!id) return null
    const state = useGraphStore.getState() as WorkspaceGraphMutationState & {
      graphData?: GraphData | null
      flowWidgetDraggingNodeId?: string | null
    }
    const workspaceMutationBlocked = isWorkspaceGraphMutationBlocked(state)
    const autoSeed = latestAutoSeedWorldPosByNodeIdRef.current[id]
    const autoSeedX = autoSeed && Number.isFinite(autoSeed.x) ? autoSeed.x : null
    const autoSeedY = autoSeed && Number.isFinite(autoSeed.y) ? autoSeed.y : null
    const interactionInProgress = Date.now() - lastInteractionFrameAtMsRef.current < 620
    const flowWidgetDraggingNodeId = String(state.flowWidgetDraggingNodeId || '').trim()
    const flowWidgetDragging = flowWidgetDraggingNodeId.length > 0
    if (workspaceMutationBlocked && autoSeedX != null && autoSeedY != null && !interactionInProgress && !flowWidgetDragging) {
      return { x: autoSeedX, y: autoSeedY }
    }
    const runtime = flowRuntimeRefRef.current?.current
    if (!runtime || runtime.positionsReady !== true) return null
    const n = runtime.scene?.nodeById?.get(id) || null
    if (!n) return null
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) return null
    return { x, y }
  }, [])

  const getLiveZoomTransform = React.useCallback(() => {
    const runtime = flowRuntimeRefRef.current?.current
    const sceneNodes = runtime?.scene?.nodes
    const sceneNodeCount = Array.isArray(sceneNodes) ? sceneNodes.length : 0
    const workspaceMutationBlocked = isWorkspaceGraphMutationBlocked(useGraphStore.getState())
    const positionsReady = runtime?.positionsReady === true
    const liveRuntimeTransform = readFiniteRuntimeZoomTransform(runtime)
    if (Array.isArray(sceneNodes) && sceneNodes.length <= 0) {
      const st = useGraphStore.getState()
      const persisted = getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      })
      const persistedK = typeof persisted?.k === 'number' && Number.isFinite(persisted.k) ? persisted.k : null
      const persistedX = typeof persisted?.x === 'number' && Number.isFinite(persisted.x) ? persisted.x : null
      const persistedY = typeof persisted?.y === 'number' && Number.isFinite(persisted.y) ? persisted.y : null
      const persistedTransform =
        persistedK != null && persistedX != null && persistedY != null
          ? { k: persistedK, x: persistedX, y: persistedY }
          : null
      const interactionInProgress = Date.now() - lastInteractionFrameAtMsRef.current < 620
      if (liveRuntimeTransform && (interactionInProgress || hasViewportOffset(liveRuntimeTransform) || !hasViewportOffset(persistedTransform))) {
        lastUsableZoomTransformRef.current = liveRuntimeTransform
        pushFlowEditorRuntimeSceneTrace({
          reason: 'scene-empty-using-live-runtime-transform',
          sceneNodeCount,
          positionsReady,
          workspaceMutationBlocked,
          viewportW: args.viewportW,
          viewportH: args.viewportH,
          transform: liveRuntimeTransform,
        })
        return liveRuntimeTransform
      }
      const lastUsable = lastUsableZoomTransformRef.current
      if (lastUsable) {
        pushFlowEditorRuntimeSceneTrace({
          reason: 'scene-empty-using-last-usable-transform',
          sceneNodeCount,
          positionsReady,
          workspaceMutationBlocked,
          viewportW: args.viewportW,
          viewportH: args.viewportH,
          transform: lastUsable,
        })
        return lastUsable
      }
      if (persistedTransform) {
        pushFlowEditorRuntimeSceneTrace({
          reason: 'scene-empty-using-persisted-transform',
          sceneNodeCount,
          positionsReady,
          workspaceMutationBlocked,
          viewportW: args.viewportW,
          viewportH: args.viewportH,
          transform: persistedTransform,
        })
        return persistedTransform
      }
      if (workspaceMutationBlocked) {
        pushFlowEditorRuntimeSceneTrace({
          reason: 'scene-empty-workspace-blocked-awaiting-live-transform',
          sceneNodeCount,
          positionsReady,
          workspaceMutationBlocked,
          viewportW: args.viewportW,
          viewportH: args.viewportH,
          transform: null,
        })
        return null
      }
      // Overlay-only runtime can transiently report empty scene during workspace recomposition.
      // Fall back to neutral only if no prior usable transform exists.
      pushFlowEditorRuntimeSceneTrace({
        reason: 'scene-empty-neutral-transform',
        sceneNodeCount,
        positionsReady,
        workspaceMutationBlocked,
        viewportW: args.viewportW,
        viewportH: args.viewportH,
        transform: { k: 1, x: 0, y: 0 },
      })
      return { k: 1, x: 0, y: 0 }
    }
    if (!liveRuntimeTransform) {
      pushFlowEditorRuntimeSceneTrace({
        reason: 'runtime-transform-unavailable',
        sceneNodeCount,
        positionsReady,
        workspaceMutationBlocked,
        viewportW: args.viewportW,
        viewportH: args.viewportH,
        transform: null,
      })
      return null
    }
    const next = liveRuntimeTransform
    lastUsableZoomTransformRef.current = next
    pushFlowEditorRuntimeSceneTrace({
      reason: 'runtime-transform-live',
      sceneNodeCount,
      positionsReady,
      workspaceMutationBlocked,
      viewportW: args.viewportW,
      viewportH: args.viewportH,
      transform: next,
    })
    return next
  }, [args.viewportH, args.viewportW, args.zoomViewKeyRef])

  const getLiveContainmentGroupAabbForNode = React.useCallback((nodeId: string) => {
    const id = String(nodeId || '').trim()
    if (!id) return null
    const runtime = flowRuntimeRefRef.current?.current
    const scene = runtime?.scene
    if (!runtime || !scene) return null
    const best = getCachedFlowEditorContainmentGroupLookup(scene)?.readContainmentGroupForNode(id) || null
    if (!best) return null

    const st = useGraphStore.getState()
    const t =
      getLiveZoomTransform() ||
      getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      }) ||
      { k: 1, x: 0, y: 0 }
    const cfg = runtime.presentation.groups
    const aabb = computeFlowGroupAabb({
      scene,
      group: best as never,
      paddingPx: cfg.paddingPx,
      labelTopExtraPx: cfg.labelTopExtraPx,
    })
    if (!aabb) return null
    return { groupId: best.id, ...aabb }
  }, [args.zoomViewKeyRef, getLiveZoomTransform])

  const renderGraphDataOverrideRef = React.useRef<GraphData | null>(args.renderGraphDataOverride)
  React.useEffect(() => {
    renderGraphDataOverrideRef.current = args.renderGraphDataOverride
  }, [args.renderGraphDataOverride])

  const seededPinnedWidgetWorldPosKeyRef = React.useRef<string>('')
  const lastAutoSeedLayoutSignatureRef = React.useRef<string>('')
  const lastHandledLayoutRebalanceAtRef = React.useRef<number>(0)
  const domCollectiveRecoveryAttemptByScopeRef = React.useRef<Record<string, number>>({})
  React.useEffect(() => {
    const prev = workspaceMutationBlockedPrevRef.current
    workspaceMutationBlockedPrevRef.current = workspaceMutationBlocked
    if (workspaceMutationBlocked !== true || prev === true) return
    if (shouldPreserveWorkspaceReopenAuthorities()) {
      pushFlowEditorRuntimeSceneTrace({
        reason: 'workspace-reopen-preserving-current-authorities',
        sceneNodeCount: flowRuntimeRefRef.current?.current?.scene?.nodes?.length || 0,
        positionsReady: flowRuntimeRefRef.current?.current?.positionsReady === true,
        workspaceMutationBlocked,
        viewportW: args.viewportW,
        viewportH: args.viewportH,
        transform: lastUsableZoomTransformRef.current,
      })
      return
    }
    // Reset transient transform/seed authorities when Workspace overlay re-opens
    // only when the current authorities no longer keep the widget collective visible.
    lastUsableZoomTransformRef.current = null
    latestAutoSeedWorldPosByNodeIdRef.current = {}
    seededPinnedWidgetWorldPosKeyRef.current = ''
    lastAutoSeedLayoutSignatureRef.current = ''
  }, [args.viewportH, args.viewportW, shouldPreserveWorkspaceReopenAuthorities, workspaceMutationBlocked])
  useIsomorphicLayoutEffect(() => {
    if (!args.active) return
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    let cancelled = false
    let rafId: number | null = null
    let observer: MutationObserver | null = null
    let readinessAttempts = 0
    const run = (): boolean => {
      if (cancelled) return true
      const roots = queryFlowEditorOverlayRootsForSurface({
        surfaceId: args.flowEditorSurfaceId,
        selector: FLOW_EDITOR_OVERLAY_ROOT_SELECTOR,
      })
      if (roots.length <= 1) return false
      const surfaceRoot = findFlowEditorOverlaySurfaceRoot(args.flowEditorSurfaceId)
      const surfaceRect = surfaceRoot?.getBoundingClientRect() || null
      const surfaceOffsetLeft = surfaceRect && Number.isFinite(surfaceRect.left) ? Number(surfaceRect.left) : 0
      const surfaceOffsetTop = surfaceRect && Number.isFinite(surfaceRect.top) ? Number(surfaceRect.top) : 0
      const rootRectItems = roots.map(root => {
        const rect = root.getBoundingClientRect()
        return {
          id: String(root.dataset.kgWidget || '').trim(),
          left: rect.left - surfaceOffsetLeft,
          top: rect.top - surfaceOffsetTop,
          right: rect.right - surfaceOffsetLeft,
          bottom: rect.bottom - surfaceOffsetTop,
        }
      })
      const bounds = buildFlowOverlayBoundsFromRects({
        items: rootRectItems,
      })
      const boundsIds = bounds?.ids || []
      if (!bounds || boundsIds.length <= 1) return true
      const visibleViewport = getVisibleViewport()
      const visibleViewportCenterX = visibleViewport.left + visibleViewport.width / 2
      const visibleViewportCenterY = visibleViewport.top + visibleViewport.height / 2
      const viewportState = deriveFlowOverlayCollectiveViewportState({
        bounds,
        visibleViewport: {
          left: visibleViewport.left,
          top: visibleViewport.top,
          right: visibleViewport.right,
          bottom: visibleViewport.bottom,
          width: visibleViewport.width,
          height: visibleViewport.height,
          centerX: visibleViewportCenterX,
          centerY: visibleViewportCenterY,
        },
      })
      const measuredCenterX = (bounds.minX + bounds.maxX) / 2
      const measuredCenterY = (bounds.minY + bounds.maxY) / 2
      const measuredCenterShiftX = visibleViewportCenterX - measuredCenterX
      const measuredCenterShiftY = visibleViewportCenterY - measuredCenterY
      const measuredCenterToleranceX = Math.max(24, visibleViewport.width * 0.06)
      const measuredCenterToleranceY = Math.max(24, visibleViewport.height * 0.08)
      const measuredAspect = bounds.width / Math.max(1, bounds.height)
      const measuredShapeBalanced =
        viewportState?.fitsVisibleViewport === true
        && measuredAspect >= 0.18
        && measuredAspect <= 6
      const needsMeasuredCenterShift =
        measuredShapeBalanced
        && (
          Math.abs(measuredCenterShiftX) > measuredCenterToleranceX
          || Math.abs(measuredCenterShiftY) > measuredCenterToleranceY
        )
      if (viewportState?.balanced === true && !needsMeasuredCenterShift) return true
      const idsKey = boundsIds
        .map(id => String(id || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .join(',')
      const scopeKey = [
        String(args.overlayTopologyLayoutSignature || '').trim(),
        String(args.flowEditorSurfaceId || '').trim(),
        idsKey,
        `${Math.round(visibleViewport.left)}:${Math.round(visibleViewport.top)}:${Math.round(visibleViewport.width)}x${Math.round(visibleViewport.height)}`,
      ].join('|')
      const attempts = domCollectiveRecoveryAttemptByScopeRef.current[scopeKey] || 0
      if (attempts >= 2) return true
      domCollectiveRecoveryAttemptByScopeRef.current = {
        ...domCollectiveRecoveryAttemptByScopeRef.current,
        [scopeKey]: attempts + 1,
      }
      const st = useGraphStore.getState()
      const graphDataForSeeding = renderGraphDataOverrideRef.current || st.graphData || null
      const graphKey = buildGraphMetaKeyIgnoringPending(graphDataForSeeding)
      const currentWorld = resolveScopedFlowWidgetNodeMap({
        graphMetaKey: graphKey,
        keyedByGraphMetaKey: (st as unknown as { flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, FlowWidgetWorldPosById> }).flowWidgetWorldPosByNodeIdByGraphMetaKey,
        globalByNodeId: (st as unknown as { flowWidgetWorldPosByNodeId?: FlowWidgetWorldPosById }).flowWidgetWorldPosByNodeId,
      })
      const currentScreen = resolveScopedFlowWidgetNodeMap({
        graphMetaKey: graphKey,
        keyedByGraphMetaKey: (st as unknown as { flowWidgetPosByNodeIdByGraphMetaKey?: Record<string, FlowWidgetScreenPosById> }).flowWidgetPosByNodeIdByGraphMetaKey,
        globalByNodeId: (st as unknown as { flowWidgetPosByNodeId?: FlowWidgetScreenPosById }).flowWidgetPosByNodeId,
      })
      const z =
        getLiveZoomTransform()
        || getEffectiveZoomStateForKey({
          zoomViewKey: args.zoomViewKeyRef.current,
          zoomStateByKey: st.zoomStateByKey,
          zoomState: st.zoomState,
        })
        || { k: 1, x: 0, y: 0 }
      const zoomK = typeof z.k === 'number' && Number.isFinite(z.k) ? z.k : 1
      const zoomX = typeof z.x === 'number' && Number.isFinite(z.x) ? z.x : 0
      const zoomY = typeof z.y === 'number' && Number.isFinite(z.y) ? z.y : 0
      const safeZoomK = Math.max(0.001, zoomK)
      const balancedViewportPreset = resolveBalancedViewportPreset({
        graphData: graphDataForSeeding,
        fallbackPreset: 'widgetCanvas',
      })
      const spreadMargins = computeBalancedSpreadViewportMargins({
        viewportW: visibleViewport.width,
        viewportH: visibleViewport.height,
        preset: balancedViewportPreset,
      })
      const baseGapPx = computeBalancedSpreadBaseGapPx({
        viewportW: visibleViewport.width,
        viewportH: visibleViewport.height,
        preset: balancedViewportPreset,
        margins: spreadMargins,
      })
      const panelScale = computeCollectiveFollowPinnedScale({
        zoomK,
        viewportW: visibleViewport.width,
        viewportH: visibleViewport.height,
        count: Math.max(1, boundsIds.length),
        baseWidth: WIDGET_BASE_SIZE.width,
        baseHeight: WIDGET_BASE_SIZE.height,
        viewportPreset: balancedViewportPreset,
        fitToViewport: false,
      })
      const panelScreen = computeWidgetScaledSize(panelScale)
      const gapScreenPx = computeBalancedSpreadSpacingPx({
        baseGapPx,
        zoomK,
        count: Math.max(1, boundsIds.length),
        preset: balancedViewportPreset,
      })
      const placed = needsMeasuredCenterShift
        ? rootRectItems
            .map(item => ({
              id: String(item.id || '').trim(),
              x: item.left + measuredCenterShiftX,
              y: item.top + measuredCenterShiftY,
            }))
            .filter(item => item.id && Number.isFinite(item.x) && Number.isFinite(item.y))
        : placeWidgetsCenteredInGroupBounds({
            ids: boundsIds,
            bounds: {
              minX: visibleViewport.left + spreadMargins.left,
              minY: visibleViewport.top + spreadMargins.top,
              maxX: visibleViewport.right - spreadMargins.right,
              maxY: visibleViewport.bottom - spreadMargins.bottom,
            },
            cellW: panelScreen.width + gapScreenPx,
            cellH: panelScreen.height + gapScreenPx,
            gapWorld: gapScreenPx,
            snapWorld: value => value,
          })
      if (placed.length <= 0) return true
      const nextWorld = { ...currentWorld }
      const nextScreen = { ...currentScreen }
      let changedWorld = false
      let changedScreen = false
      for (let i = 0; i < placed.length; i += 1) {
        const p = placed[i]!
        const id = String(p.id || '').trim()
        if (!id) continue
        const world = {
          x: (p.x - zoomX) / safeZoomK,
          y: (p.y - zoomY) / safeZoomK,
        }
        const prevWorld = nextWorld[id]
        if (!prevWorld || Math.abs(prevWorld.x - world.x) > 0.0001 || Math.abs(prevWorld.y - world.y) > 0.0001) {
          nextWorld[id] = world
          changedWorld = true
        }
        const screen = { left: p.x, top: p.y }
        const prevScreen = nextScreen[id]
        if (!prevScreen || Math.abs(prevScreen.left - screen.left) > 0.0001 || Math.abs(prevScreen.top - screen.top) > 0.0001) {
          nextScreen[id] = screen
          changedScreen = true
        }
      }
      if (!changedWorld && !changedScreen) return true
      if (isWorkspaceGraphMutationBlocked(st)) {
        useGraphStore.setState(prev => buildWorkspaceBlockedFlowWidgetSeedPatch({
          prevState: prev as FlowWidgetSeedStoreState,
          graphDataForSeeding,
          nextWorld,
          nextScreenPos: nextScreen,
          changedScreenPos: changedScreen,
        }) as Partial<typeof prev>)
      } else {
        if (changedScreen) st.setFlowWidgetPosByNodeId(nextScreen)
        if (changedWorld) st.setFlowWidgetWorldPosByNodeId(nextWorld)
      }
      return true
    }
    const scheduleReadinessRetry = () => {
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        if (run()) return
        readinessAttempts += 1
        if (readinessAttempts < 240) scheduleReadinessRetry()
      })
    }
    if (!run()) {
      if (typeof MutationObserver !== 'undefined' && document.body) {
        observer = new MutationObserver(() => {
          if (!run()) return
          observer?.disconnect()
          observer = null
        })
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-kg-widget', 'data-kg-flow-editor-surface', 'style'],
        })
      }
      scheduleReadinessRetry()
    }
    return () => {
      cancelled = true
      observer?.disconnect()
      observer = null
      if (rafId != null) {
        try {
          window.cancelAnimationFrame(rafId)
        } catch {
          void 0
        }
      }
    }
  }, [
    args.active,
    args.flowEditorSurfaceId,
    args.overlayTopologyLayoutSignature,
    args.viewportH,
    args.viewportW,
    flowWidgetPinnedCount,
    flowWidgetWorldPosCount,
    getVisibleViewport,
  ])
  useIsomorphicLayoutEffect(() => {
    if (!args.active) return
    const st = useGraphStore.getState()
    const graphDataForSeeding = renderGraphDataOverrideRef.current || st.graphData || null
    const nodeTypeById = new Map<string, string>()
    const graphNodes = Array.isArray(graphDataForSeeding?.nodes) ? graphDataForSeeding.nodes : []
    for (let i = 0; i < graphNodes.length; i += 1) {
      const node = graphNodes[i]
      const id = String(node?.id || '').trim()
      if (!id || nodeTypeById.has(id)) continue
      nodeTypeById.set(id, String(node?.type || '').trim())
    }
    const widgetPlacementContext = getCachedFlowEditorWidgetPlacementContext({
      graphData: graphDataForSeeding,
      graphRevision: readGraphDataRevision(graphDataForSeeding),
      openWidgetNodeIds: args.openWidgetNodeIds,
      preferCurrentGraphDataRefs: true,
    })
    const graphMetaKind = widgetPlacementContext?.graphMetaKind || null
    const defaultPinnedInCanvas = widgetPlacementContext?.defaultPinnedInCanvas ?? true
    const graphKey = buildGraphMetaKeyIgnoringPending(graphDataForSeeding)
    const pinnedById = resolveScopedFlowWidgetNodeMap({
      graphMetaKey: graphKey,
      keyedByGraphMetaKey: (st as unknown as { flowWidgetPinnedByNodeIdByGraphMetaKey?: Record<string, FlowWidgetPinnedById> }).flowWidgetPinnedByNodeIdByGraphMetaKey,
      globalByNodeId: st.flowWidgetPinnedByNodeId,
    })
    const posById = resolveScopedFlowWidgetNodeMap({
      graphMetaKey: graphKey,
      keyedByGraphMetaKey: (st as unknown as { flowWidgetPosByNodeIdByGraphMetaKey?: Record<string, FlowWidgetScreenPosById> }).flowWidgetPosByNodeIdByGraphMetaKey,
      globalByNodeId: (st as unknown as { flowWidgetPosByNodeId?: FlowWidgetScreenPosById }).flowWidgetPosByNodeId,
    })
    const worldById = resolveScopedFlowWidgetNodeMap({
      graphMetaKey: graphKey,
      keyedByGraphMetaKey: (st as unknown as { flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, FlowWidgetWorldPosById> }).flowWidgetWorldPosByNodeIdByGraphMetaKey,
      globalByNodeId: (st as unknown as { flowWidgetWorldPosByNodeId?: FlowWidgetWorldPosById }).flowWidgetWorldPosByNodeId,
    })
    const effectiveOpenIds = Array.isArray(widgetPlacementContext?.effectiveOpenWidgetNodeIds)
      ? widgetPlacementContext!.effectiveOpenWidgetNodeIds
      : []
    const knownWidgetNodeIds = new Set<string>([
      ...effectiveOpenIds.map(id => String(id || '').trim()).filter(Boolean),
      ...Object.keys(worldById),
      ...Object.keys(posById),
      ...Object.keys(pinnedById),
      ...Array.from(nodeTypeById.keys()),
    ])
    const resolveActiveSurfaceOverlayWidgetId = (rawId: string): string => {
      const id = String(rawId || '').trim()
      if (!id) return ''
      if (knownWidgetNodeIds.has(id)) return id
      return resolveGraphNodeIdByCanonicalId(graphDataForSeeding, id) || id
    }
    const activeSurfaceOverlayPinnedById: FlowWidgetPinnedById = {}
    const activeSurfaceOverlayWidgetIds = (() => {
      if (typeof document === 'undefined') return []
      const seen = new Set<string>()
      const out: string[] = []
      const roots = queryFlowEditorOverlayRootsForSurface({
        surfaceId: args.flowEditorSurfaceId,
        selector: FLOW_EDITOR_OVERLAY_ROOT_SELECTOR,
      })
      for (let i = 0; i < roots.length; i += 1) {
        const root = roots[i]
        const id = resolveActiveSurfaceOverlayWidgetId(String(root?.dataset?.kgWidget || '').trim())
        if (!id || seen.has(id)) continue
        const pinnedAttr = String(root?.dataset?.kgWidgetPinned || '').trim()
        if (pinnedAttr === '0') activeSurfaceOverlayPinnedById[id] = false
        if (pinnedAttr === '1') activeSurfaceOverlayPinnedById[id] = true
        seen.add(id)
        out.push(id)
      }
      return out
    })()
    const placementPinnedById: FlowWidgetPinnedById = {
      ...pinnedById,
      ...activeSurfaceOverlayPinnedById,
    }
    const effectiveOrFallbackOpenIds = effectiveOpenIds.length > 0
      ? Array.from(new Set([
          ...effectiveOpenIds.map(id => String(id || '').trim()).filter(Boolean),
          ...activeSurfaceOverlayWidgetIds,
        ]))
      : (
          graphMetaKind === 'frontmatter-flow'
            ? Array.from(new Set([
                ...Object.keys(worldById),
                ...Object.keys(posById),
                ...activeSurfaceOverlayWidgetIds,
              ]))
              .map(id => String(id || '').trim())
              .filter(Boolean)
            : []
        )
    if (effectiveOrFallbackOpenIds.length === 0) return
    const activeSurfaceOverlayWidgetIdSet = new Set(activeSurfaceOverlayWidgetIds)
    const runtimeSceneNodeCount = (() => {
      const runtime = flowRuntimeRefRef.current?.current
      const nodes = runtime?.scene?.nodes
      return Array.isArray(nodes) ? nodes.length : 0
    })()
    const forceSceneEmptyReseed = runtimeSceneNodeCount <= 0 && graphMetaKind === 'frontmatter-flow'

    const pendingRaw = effectiveOrFallbackOpenIds
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .filter(id => {
        const v = placementPinnedById[id]
        const pinned = typeof v === 'boolean' ? v : defaultPinnedInCanvas
        if (!pinned) return false
        if (forceSceneEmptyReseed) return true
        if (!shouldAutoPlaceFlowEditorWidget({ graphMetaKind, pinnedInCanvas: pinned, worldPos: worldById[id] })) return false
        const w = worldById[id]
        return !(w && Number.isFinite(w.x) && Number.isFinite(w.y))
      })

    const liveZoom = getLiveZoomTransform()
    const persistedZoom =
      getEffectiveZoomStateForKey({
        zoomViewKey: args.zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      }) || null
    const liveLooksDefault =
      !liveZoom
      || (
        Math.abs((Number.isFinite(liveZoom.k) ? liveZoom.k : 1) - 1) <= 1e-6
        && Math.abs(Number.isFinite(liveZoom.x) ? liveZoom.x : 0) <= 0.5
        && Math.abs(Number.isFinite(liveZoom.y) ? liveZoom.y : 0) <= 0.5
      )
    const persistedHasViewportOffset =
      !!persistedZoom
      && (
        Math.abs((Number.isFinite(persistedZoom.k) ? persistedZoom.k : 1) - 1) > 1e-3
        || Math.abs(Number.isFinite(persistedZoom.x) ? persistedZoom.x : 0) > 0.5
        || Math.abs(Number.isFinite(persistedZoom.y) ? persistedZoom.y : 0) > 0.5
      )
    const isFrontmatterFlow = graphMetaKind === 'frontmatter-flow'
    const workspaceMutationBlockedForSeed = isWorkspaceGraphMutationBlocked(st)
    const layoutRebalanceRequestAt =
      args.flowEditorLayoutRebalanceRequest?.type === 'balanced-spread'
      && typeof args.flowEditorLayoutRebalanceRequest.at === 'number'
      && Number.isFinite(args.flowEditorLayoutRebalanceRequest.at)
        ? args.flowEditorLayoutRebalanceRequest.at
        : 0
    const layoutRebalanceRequested =
      layoutRebalanceRequestAt > 0
      && layoutRebalanceRequestAt !== lastHandledLayoutRebalanceAtRef.current
    const isFirstFrontmatterInitSeed = isFrontmatterFlow && seededPinnedWidgetWorldPosKeyRef.current.length === 0
    const liveHasViewportOffset = hasViewportOffset(liveZoom)
    const shouldUseNeutralSeedZoomForFrontmatterInit =
      !layoutRebalanceRequested
      && !liveHasViewportOffset
      && !persistedHasViewportOffset
      && (
        isFirstFrontmatterInitSeed
        || (isFrontmatterFlow && workspaceMutationBlockedForSeed)
      )
    const shouldUseNeutralSeedZoom =
      (runtimeSceneNodeCount <= 0 && !persistedHasViewportOffset)
      || shouldUseNeutralSeedZoomForFrontmatterInit
    const allowPersistedViewportOffsetSeed =
      !workspaceMutationBlockedForSeed
      || (
        isFrontmatterFlow
        && persistedHasViewportOffset
        && (!liveZoom || liveLooksDefault)
      )
    const z =
      (shouldUseNeutralSeedZoom ? { k: 1, x: 0, y: 0 } : null)
      || (allowPersistedViewportOffsetSeed && persistedHasViewportOffset && liveLooksDefault ? persistedZoom : null)
      || liveZoom
      || persistedZoom
      || { k: 1, x: 0, y: 0 }
    const zoomK = typeof z.k === 'number' && Number.isFinite(z.k) ? z.k : 1
    const visibleViewport = getVisibleViewport()
    const balancedViewportPreset = resolveBalancedViewportPreset({
      graphData: graphDataForSeeding,
      fallbackPreset: isFrontmatterFlow ? 'widgetFrontmatter' : 'widgetCanvas',
    })
    const spreadMargins = computeBalancedSpreadViewportMargins({
      viewportW: visibleViewport.width,
      viewportH: visibleViewport.height,
      preset: balancedViewportPreset,
    })
    const horizontalMargin = Math.max(spreadMargins.left, spreadMargins.right)
    const verticalMargin = Math.max(spreadMargins.top, spreadMargins.bottom)
    const baseGapPx = computeBalancedSpreadBaseGapPx({ viewportW: visibleViewport.width, viewportH: visibleViewport.height, preset: balancedViewportPreset, margins: spreadMargins })
    const pinnedOpenIds = (
      isFrontmatterFlow
        ? effectiveOrFallbackOpenIds
            .map(id => String(id || '').trim())
            .filter(Boolean)
        : effectiveOrFallbackOpenIds
            .map(id => String(id || '').trim())
            .filter(Boolean)
            .filter(id => {
              const v = placementPinnedById[id]
              const pinned = typeof v === 'boolean' ? v : defaultPinnedInCanvas
              return pinned || activeSurfaceOverlayWidgetIdSet.has(id)
            })
    )
      .filter((id, index, arr) => arr.indexOf(id) === index)
      .sort((a, b) => a.localeCompare(b))
    const useViewportOnlyBucket = isFrontmatterFlow || pinnedOpenIds.length >= 12
    const panelScale = computeCollectiveFollowPinnedScale({
      zoomK,
      viewportW: visibleViewport.width,
      viewportH: visibleViewport.height,
      count: Math.max(1, pinnedOpenIds.length),
      baseWidth: WIDGET_BASE_SIZE.width,
      baseHeight: WIDGET_BASE_SIZE.height,
      viewportPreset: balancedViewportPreset,
      fitToViewport: false,
    })
    const widgetGrid = readWidgetGridLayoutSettings(args.schema)
    const gapBasePx = widgetGrid.gridEnabled ? Math.max(baseGapPx, widgetGrid.gapPx) : baseGapPx
    const panelScreen = computeWidgetScaledSize(panelScale)
    const panelWorldW = panelScreen.width / Math.max(0.001, zoomK)
    const panelWorldH = panelScreen.height / Math.max(0.001, zoomK)
    const gapScreenPx = computeBalancedSpreadSpacingPx({
      baseGapPx: gapBasePx,
      zoomK,
      count: Math.max(1, pinnedOpenIds.length),
      preset: balancedViewportPreset,
    })
    const gapWorld = gapScreenPx / Math.max(0.001, zoomK)
    const cellW = (panelScreen.width + gapScreenPx) / Math.max(0.001, zoomK)
    const cellH = (panelScreen.height + gapScreenPx) / Math.max(0.001, zoomK)
    const worldStep = widgetGrid.gridEnabled && !isFrontmatterFlow ? Math.max(1, widgetGrid.stepPx) : 1
    const snapWorld = (v: number) => (worldStep > 1 ? snapToGridPx(v, worldStep) : v)
    const safeZoomK = Math.max(0.001, zoomK)
    const zoomX = typeof z.x === 'number' && Number.isFinite(z.x) ? z.x : 0
    const zoomY = typeof z.y === 'number' && Number.isFinite(z.y) ? z.y : 0
    const viewportBounds = useViewportOnlyBucket
      ? {
          minX: (visibleViewport.left - zoomX) / safeZoomK,
          minY: (visibleViewport.top - zoomY) / safeZoomK,
          maxX: (visibleViewport.right - zoomX) / safeZoomK,
          maxY: (visibleViewport.bottom - zoomY) / safeZoomK,
        }
      : {
          minX: (visibleViewport.left + horizontalMargin - zoomX) / safeZoomK,
          minY: (visibleViewport.top + verticalMargin - zoomY) / safeZoomK,
          maxX: (visibleViewport.right - horizontalMargin - zoomX) / safeZoomK,
          maxY: (visibleViewport.bottom - verticalMargin - zoomY) / safeZoomK,
        }
    const activeRichMediaWorldObstacles = (() => {
      if (typeof document === 'undefined') return []
      const surfaceRoot = findFlowEditorOverlaySurfaceRoot(args.flowEditorSurfaceId)
      const surfaceRect = surfaceRoot?.getBoundingClientRect() || null
      const surfaceOffsetLeft = surfaceRect && Number.isFinite(surfaceRect.left) ? Number(surfaceRect.left) : 0
      const surfaceOffsetTop = surfaceRect && Number.isFinite(surfaceRect.top) ? Number(surfaceRect.top) : 0
      const richMediaEls = queryFlowEditorOverlayRootsForSurface({
        surfaceId: args.flowEditorSurfaceId,
        selector: RICH_MEDIA_OVERLAY_ROOT_SELECTOR,
      })
      const entries = collectCanonicalFlowEditorOverlayRectEntries(richMediaEls)
      const obstacles: Array<{ id: string; left: number; top: number; width: number; height: number }> = []
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i]!
        const rect = entry.rect
        if (!rect || isTransientOffscreenRichMediaOverlayRoot(entry.el, rect)) continue
        const screenLeft = Number(rect.left) - surfaceOffsetLeft
        const screenTop = Number(rect.top) - surfaceOffsetTop
        const screenRight = Number(rect.right) - surfaceOffsetLeft
        const screenBottom = Number(rect.bottom) - surfaceOffsetTop
        if (!Number.isFinite(screenLeft) || !Number.isFinite(screenTop) || !Number.isFinite(screenRight) || !Number.isFinite(screenBottom)) continue
        const left = (screenLeft - zoomX) / safeZoomK
        const top = (screenTop - zoomY) / safeZoomK
        const right = (screenRight - zoomX) / safeZoomK
        const bottom = (screenBottom - zoomY) / safeZoomK
        const width = right - left
        const height = bottom - top
        if (!(width > 0) || !(height > 0)) continue
        obstacles.push({ id: `rich-media:${entry.id}`, left, top, width, height })
      }
      return obstacles
    })()
    const seedCollisionSchema = (args.schema || defaultSchema) as GraphSchema
    const overlapsSeedRect = (
      a: { left: number; top: number; width: number; height: number },
      b: { left: number; top: number; width: number; height: number },
      gap: number,
    ) => {
      const ax2 = a.left + a.width + gap
      const ay2 = a.top + a.height + gap
      const bx2 = b.left + b.width + gap
      const by2 = b.top + b.height + gap
      return a.left < bx2 && b.left < ax2 && a.top < by2 && b.top < ay2
    }
    const avoidActiveRichMediaSeedObstacles = (placed: Array<{ id: string; x: number; y: number }>) => {
      if (activeRichMediaWorldObstacles.length === 0 || placed.length === 0) return placed
      let items = placed.map(p => ({
        id: p.id,
        left: p.x,
        top: p.y,
        width: panelWorldW,
        height: panelWorldH,
        movable: true,
      }))
      const hasObstacleOverlap = () => items.some(item =>
        activeRichMediaWorldObstacles.some(obstacle => overlapsSeedRect(item, obstacle, gapWorld)),
      )
      if (!hasObstacleOverlap()) return placed
      for (let pass = 0; pass < 3 && hasObstacleOverlap(); pass += 1) {
        const relaxed = relaxOverlayPanelsWithCollision({
          schema: seedCollisionSchema,
          items,
          obstacles: activeRichMediaWorldObstacles,
          gapPx: gapWorld,
          strength: 0.85,
          iterations: 12,
          steps: 14,
          anchorStrength: 0.08,
          maxAnchorShiftPx: Math.max(
            panelWorldW + gapWorld,
            panelWorldH + gapWorld,
            Math.min(visibleViewport.width, visibleViewport.height) / safeZoomK * 0.42,
          ),
          maxSpeedPxPerStep: 180 / safeZoomK,
        })
        const relaxedById = new Map(relaxed.map(item => [item.id, item]))
        items = items.map(item => {
          const next = relaxedById.get(item.id)
          return next ? { ...item, left: next.left, top: next.top } : item
        })
      }
      const relaxedById = new Map(items.map(item => [item.id, item]))
      return placed.map(p => {
        const next = relaxedById.get(p.id)
        if (!next) return p
        return {
          id: p.id,
          x: snapWorld(next.left),
          y: snapWorld(next.top),
        }
      })
    }
    const normalizeSeedBoundsToViewport = (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const bounded = {
        minX: Number.isFinite(bounds.minX) ? bounds.minX : viewportBounds.minX,
        minY: Number.isFinite(bounds.minY) ? bounds.minY : viewportBounds.minY,
        maxX: Number.isFinite(bounds.maxX) ? bounds.maxX : viewportBounds.maxX,
        maxY: Number.isFinite(bounds.maxY) ? bounds.maxY : viewportBounds.maxY,
      }
      const intersected = {
        minX: Math.max(viewportBounds.minX, bounded.minX),
        minY: Math.max(viewportBounds.minY, bounded.minY),
        maxX: Math.min(viewportBounds.maxX, bounded.maxX),
        maxY: Math.min(viewportBounds.maxY, bounded.maxY),
      }
      if (intersected.maxX - intersected.minX >= 1 && intersected.maxY - intersected.minY >= 1) return intersected
      return viewportBounds
    }
    const frontmatterRenderSettings = isFrontmatterFlow ? readFrontmatterFlowRenderSettings(graphDataForSeeding) : null
    const balancedHeroRowCount = frontmatterRenderSettings?.balancedHeroRowCount
    const balancedHeroRowGapScale = frontmatterRenderSettings?.balancedHeroRowGapScale
    const balancedHeroRowStaggerScale = frontmatterRenderSettings?.balancedHeroRowStaggerScale
    const placeSpreadGridInBounds = (ids: string[], bounds: { minX: number; minY: number; maxX: number; maxY: number }) =>
      avoidActiveRichMediaSeedObstacles(placeWidgetsCenteredInGroupBounds({
        ids,
        bounds: normalizeSeedBoundsToViewport(bounds),
        cellW,
        cellH,
        gapWorld,
        snapWorld,
        preferredFirstRowCount: balancedHeroRowCount,
        preferredRowGapScale: balancedHeroRowGapScale,
        preferredSingleRowStaggerScale: balancedHeroRowStaggerScale,
      }))

    const viewportBucketId = '__viewport__'
    const allBoundsByBucket = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
    allBoundsByBucket.set(viewportBucketId, viewportBounds)
    for (let i = 0; i < pinnedOpenIds.length; i += 1) {
      const id = pinnedOpenIds[i]!
      if (useViewportOnlyBucket) continue
      const group = getLiveContainmentGroupAabbForNode(id)
      if (!group) continue
      allBoundsByBucket.set(
        `group:${group.groupId}`,
        normalizeSeedBoundsToViewport({ minX: group.minX, minY: group.minY, maxX: group.maxX, maxY: group.maxY }),
      )
    }

    const bucketSignature = Array.from(allBoundsByBucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketId, bounds]) => {
        if (bucketId === viewportBucketId) return `${bucketId}:visible-viewport`
        const minX = Math.round(bounds.minX * 1000) / 1000
        const minY = Math.round(bounds.minY * 1000) / 1000
        const maxX = Math.round(bounds.maxX * 1000) / 1000
        const maxY = Math.round(bounds.maxY * 1000) / 1000
        return `${bucketId}:${minX},${minY},${maxX},${maxY}`
      })
      .join('|')
    const currentLayoutSignature = `${args.overlayTopologyLayoutSignature}|${visibleViewport.left},${visibleViewport.top},${visibleViewport.width}x${visibleViewport.height}|${bucketSignature}`
    const visibleViewportState: VisibleFlowViewport = {
      left: visibleViewport.left,
      top: visibleViewport.top,
      right: visibleViewport.right,
      bottom: visibleViewport.bottom,
      width: visibleViewport.width,
      height: visibleViewport.height,
      centerX: visibleViewport.left + visibleViewport.width / 2,
      centerY: visibleViewport.top + visibleViewport.height / 2,
    }
    const currentPinnedCollectiveBounds = buildFlowOverlayBoundsFromRects({
      items: pinnedOpenIds
        .map(id => {
          const world = worldById[id]
          if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return null
          const left = world.x * safeZoomK + zoomX
          const top = world.y * safeZoomK + zoomY
          return {
            id,
            left,
            top,
            width: panelWorldW * safeZoomK,
            height: panelWorldH * safeZoomK,
          }
        })
        .filter((item): item is { id: string; left: number; top: number; width: number; height: number } => !!item),
    })
    const currentPinnedCollectiveViewportState =
      currentPinnedCollectiveBounds && currentPinnedCollectiveBounds.ids?.length === pinnedOpenIds.length
        ? deriveFlowOverlayCollectiveViewportState({
            bounds: currentPinnedCollectiveBounds,
            visibleViewport: visibleViewportState,
          })
        : null
    const currentPinnedCollectiveAlreadyBalanced =
      pinnedOpenIds.length > 1
      && currentPinnedCollectiveViewportState?.balanced === true
    const markLayoutRebalanceHandled = () => {
      if (layoutRebalanceRequested) lastHandledLayoutRebalanceAtRef.current = layoutRebalanceRequestAt
    }
    const initialCollectiveCenteringPass =
      seededPinnedWidgetWorldPosKeyRef.current.length === 0
      && lastAutoSeedLayoutSignatureRef.current.length === 0
    const collectiveCentroidOffCenter = (
      items: Array<{ left: number; top: number; width: number; height: number }>,
      bounds: { minX: number; minY: number; maxX: number; maxY: number },
    ) => {
      if (items.length <= 1) return false
      let minLeft = Number.POSITIVE_INFINITY
      let minTop = Number.POSITIVE_INFINITY
      let maxRight = Number.NEGATIVE_INFINITY
      let maxBottom = Number.NEGATIVE_INFINITY
      let centroidX = 0
      let centroidY = 0
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]!
        const width = Math.max(1, Number(item.width) || 1)
        const height = Math.max(1, Number(item.height) || 1)
        minLeft = Math.min(minLeft, item.left)
        minTop = Math.min(minTop, item.top)
        maxRight = Math.max(maxRight, item.left + width)
        maxBottom = Math.max(maxBottom, item.top + height)
        centroidX += item.left + width / 2
        centroidY += item.top + height / 2
      }
      if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) return false
      centroidX /= items.length
      centroidY /= items.length
      const targetCenterX = (bounds.minX + bounds.maxX) / 2
      const targetCenterY = (bounds.minY + bounds.maxY) / 2
      const toleranceX = Math.max(panelWorldW * 0.32, gapWorld * 1.75, (bounds.maxX - bounds.minX) * 0.045)
      const toleranceY = Math.max(panelWorldH * 0.32, gapWorld * 1.75, (bounds.maxY - bounds.minY) * 0.045)
      const outsideBounds =
        maxRight <= bounds.minX
        || maxBottom <= bounds.minY
        || minLeft >= bounds.maxX
        || minTop >= bounds.maxY
      return (
        outsideBounds
        || Math.abs(centroidX - targetCenterX) > toleranceX
        || Math.abs(centroidY - targetCenterY) > toleranceY
      )
    }

    const overlapEligible = (() => {
      const idsByBucket = new Map<string, string[]>()
      const pinnedWorldIdsByBucket = new Map<string, string[]>()
      const autoSeedWorldById = latestAutoSeedWorldPosByNodeIdRef.current || {}
      const autoSeedLayoutChanged =
        lastAutoSeedLayoutSignatureRef.current.length > 0
        && lastAutoSeedLayoutSignatureRef.current !== currentLayoutSignature
        && !currentPinnedCollectiveAlreadyBalanced
      for (let i = 0; i < pinnedOpenIds.length; i += 1) {
        const id = pinnedOpenIds[i]!
        const world = worldById[id]
        const group = useViewportOnlyBucket ? null : getLiveContainmentGroupAabbForNode(id)
        const bucketId = group ? `group:${group.groupId}` : viewportBucketId
        if (world && Number.isFinite(world.x) && Number.isFinite(world.y)) {
          const pinnedList = pinnedWorldIdsByBucket.get(bucketId) || []
          pinnedList.push(id)
          pinnedWorldIdsByBucket.set(bucketId, pinnedList)
        }
        const nodeTypeId = nodeTypeById.get(id) || ''
        const frontmatterPinnedWidget =
          graphMetaKind === 'frontmatter-flow'
          && isCanonicalFrontmatterBuiltInWidgetNode({ id, type: nodeTypeId })
        const autoPlaceCandidate =
          shouldAutoPlaceFlowEditorWidget({ graphMetaKind, pinnedInCanvas: true, worldPos: world, nodeTypeId })
          || frontmatterPinnedWidget
          || initialCollectiveCenteringPass
        if (!autoPlaceCandidate) continue
        if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
        const list = idsByBucket.get(bucketId) || []
        list.push(id)
        idsByBucket.set(bucketId, list)
      }
      const overlappingIds = new Set<string>()
      const hasOverlap = (aId: string, bId: string) => {
        const a = worldById[aId]
        const b = worldById[bId]
        if (!a || !b) return false
        const overlapX = a.x < b.x + panelWorldW && b.x < a.x + panelWorldW
        const overlapY = a.y < b.y + panelWorldH && b.y < a.y + panelWorldH
        return overlapX && overlapY
      }
      for (const [bucketId, pinnedIds] of pinnedWorldIdsByBucket.entries()) {
        for (let i = 0; i < pinnedIds.length; i += 1) {
          const id = pinnedIds[i]!
          if (!autoSeedLayoutChanged) continue
          const prevAuto = autoSeedWorldById[id]
          if (!prevAuto || !Number.isFinite(prevAuto.x) || !Number.isFinite(prevAuto.y)) continue
          if (!worldById[id] || !Number.isFinite(worldById[id]!.x) || !Number.isFinite(worldById[id]!.y)) continue
          if (Math.abs(worldById[id]!.x - prevAuto.x) > 0.01 || Math.abs(worldById[id]!.y - prevAuto.y) > 0.01) continue
          overlappingIds.add(id)
        }
      }
      for (const [bucketId, ids] of idsByBucket.entries()) {
        const bucketItems = ids
          .map(id => {
            const world = worldById[id]
            if (!world) return null
            return { id, left: world.x, top: world.y, width: panelWorldW, height: panelWorldH }
          })
          .filter((item): item is { id: string; left: number; top: number; width: number; height: number } => !!item)
        const hasResidueCluster =
          bucketItems.length >= 3
          && shouldForceBalancedSpreadReseed({ items: bucketItems, gapPx: gapWorld })
        const bucketBounds = allBoundsByBucket.get(bucketId) || viewportBounds
        const needsInitialCentroidSeed =
          initialCollectiveCenteringPass
          && collectiveCentroidOffCenter(bucketItems, bucketBounds)
        if (hasResidueCluster || needsInitialCentroidSeed) {
          for (let i = 0; i < bucketItems.length; i += 1) overlappingIds.add(bucketItems[i]!.id)
          continue
        }
        for (let i = 0; i < ids.length; i += 1) {
          const a = ids[i]!
          for (let j = i + 1; j < ids.length; j += 1) {
            const b = ids[j]!
            if (!hasOverlap(a, b)) continue
            overlappingIds.add(a)
            overlappingIds.add(b)
          }
        }
      }
      return Array.from(overlappingIds)
    })()
    const forcedLayoutRebalanceIds = layoutRebalanceRequested ? pinnedOpenIds : []
    const forcedInitialCollectiveIds =
      initialCollectiveCenteringPass && pendingRaw.length > 0 && pinnedOpenIds.length > 1
        ? pinnedOpenIds
        : []
    let pending = Array.from(new Set([
      ...pendingRaw,
      ...overlapEligible,
      ...forcedInitialCollectiveIds,
      ...forcedLayoutRebalanceIds,
    ])).sort((a, b) => a.localeCompare(b))
    const fullFrontmatterCollectiveIds = isFrontmatterFlow ? Array.from(new Set(effectiveOrFallbackOpenIds.map(id => String(id || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)) : []
    const shouldReseedWholeFrontmatterCollective =
      isFrontmatterFlow
      && fullFrontmatterCollectiveIds.length > 0
      && (
        forceSceneEmptyReseed
        || (pending.length > 0 && pending.length < fullFrontmatterCollectiveIds.length)
    )
    if (shouldReseedWholeFrontmatterCollective) pending = fullFrontmatterCollectiveIds
    if (pending.length === 0) {
      markLayoutRebalanceHandled()
      return
    }

    const idsByBucket = new Map<string, string[]>()
    const boundsByBucket = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
    boundsByBucket.set(viewportBucketId, viewportBounds)
    for (let i = 0; i < pending.length; i += 1) {
      const id = pending[i]!
      const group = useViewportOnlyBucket ? null : getLiveContainmentGroupAabbForNode(id)
      const bucketId = group ? `group:${group.groupId}` : viewportBucketId
      const list = idsByBucket.get(bucketId) || []
      list.push(id)
      idsByBucket.set(bucketId, list)
      if (group) {
        boundsByBucket.set(
          bucketId,
          normalizeSeedBoundsToViewport({ minX: group.minX, minY: group.minY, maxX: group.maxX, maxY: group.maxY }),
        )
      }
    }
    const bucketIds = Array.from(idsByBucket.keys()).sort((a, b) => a.localeCompare(b))
    const pendingSet = new Set(pending)
    const seedKey = `${pending.join(',')}|${currentLayoutSignature}|${layoutRebalanceRequested ? `rebalance:${layoutRebalanceRequestAt}` : 'auto'}`
    if (seededPinnedWidgetWorldPosKeyRef.current === seedKey && !forceSceneEmptyReseed) {
      markLayoutRebalanceHandled()
      return
    }

    const nextWorld = { ...worldById }
    const nextScreenPos = { ...posById }
    let changed = false
    let changedScreenPos = false
    const nextAutoSeedPositions: Record<string, { x: number; y: number }> = {}
    const syncScreenAuthorityPosition = (id: string, world: { x: number; y: number }) => {
      changedScreenPos = syncFlowWidgetScreenAuthorityPosition({
        id, world, nextScreenPos, pinnedById: placementPinnedById, defaultPinnedInCanvas, graphMetaKind, zoomK, zoomX, zoomY,
      }) || changedScreenPos
    }
    for (let i = 0; i < bucketIds.length; i += 1) {
      const bucketId = bucketIds[i]!
      const ids = (idsByBucket.get(bucketId) || [])
        .filter(id => pendingSet.has(id))
        .sort((a, b) => a.localeCompare(b))
      if (ids.length === 0) continue
      const bounds = boundsByBucket.get(bucketId) || viewportBounds
      const placed = placeSpreadGridInBounds(ids, bounds)
      for (let j = 0; j < placed.length; j += 1) {
        const p = placed[j]!
        const prev = worldById[p.id]
        if (!prev || Math.abs(prev.x - p.x) > 0.0001 || Math.abs(prev.y - p.y) > 0.0001) changed = true
        nextWorld[p.id] = { x: p.x, y: p.y }
        nextAutoSeedPositions[p.id] = { x: p.x, y: p.y }
        syncScreenAuthorityPosition(p.id, nextWorld[p.id]!)
      }
    }
    const autoSeedIds = Object.keys(nextAutoSeedPositions)
    if (autoSeedIds.length > 0) {
      let minLeft = Number.POSITIVE_INFINITY
      let minTop = Number.POSITIVE_INFINITY
      let maxRight = Number.NEGATIVE_INFINITY
      let maxBottom = Number.NEGATIVE_INFINITY
      let centroidX = 0
      let centroidY = 0
      for (let i = 0; i < autoSeedIds.length; i += 1) {
        const id = autoSeedIds[i]!
        const world = nextWorld[id]
        if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
        const left = world.x
        const top = world.y
        const right = world.x + panelWorldW
        const bottom = world.y + panelWorldH
        minLeft = Math.min(minLeft, left)
        minTop = Math.min(minTop, top)
        maxRight = Math.max(maxRight, right)
        maxBottom = Math.max(maxBottom, bottom)
        centroidX += left + panelWorldW / 2
        centroidY += top + panelWorldH / 2
      }
      const hasBounds =
        Number.isFinite(minLeft)
        && Number.isFinite(minTop)
        && Number.isFinite(maxRight)
        && Number.isFinite(maxBottom)
      if (hasBounds) {
        centroidX /= Math.max(1, autoSeedIds.length)
        centroidY /= Math.max(1, autoSeedIds.length)
        const targetCenterX = (viewportBounds.minX + viewportBounds.maxX) / 2
        const targetCenterY = (viewportBounds.minY + viewportBounds.maxY) / 2
        const minDx = viewportBounds.minX - minLeft
        const maxDx = viewportBounds.maxX - maxRight
        const minDy = viewportBounds.minY - minTop
        const maxDy = viewportBounds.maxY - maxBottom
        const shiftX = resolveFlowEditorCollectiveCenterShift({
          preferredShift: targetCenterX - centroidX,
          minShift: minDx,
          maxShift: maxDx,
        })
        const shiftY = resolveFlowEditorCollectiveCenterShift({
          preferredShift: targetCenterY - centroidY,
          minShift: minDy,
          maxShift: maxDy,
        })
        if (Math.abs(shiftX) > 0.0001 || Math.abs(shiftY) > 0.0001) {
          for (let i = 0; i < autoSeedIds.length; i += 1) {
            const id = autoSeedIds[i]!
            const world = nextWorld[id]
            if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
            const x = world.x + shiftX
            const y = world.y + shiftY
            nextWorld[id] = { x, y }
            nextAutoSeedPositions[id] = { x, y }
            syncScreenAuthorityPosition(id, nextWorld[id]!)
          }
          changed = true
        }
      }
      const obstacleAdjusted = avoidActiveRichMediaSeedObstacles(autoSeedIds
        .map(id => {
          const world = nextWorld[id]
          if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return null
          return { id, x: world.x, y: world.y }
        })
        .filter((item): item is { id: string; x: number; y: number } => !!item))
      for (let i = 0; i < obstacleAdjusted.length; i += 1) {
        const p = obstacleAdjusted[i]!
        const prev = nextWorld[p.id]
        if (!prev || (Math.abs(prev.x - p.x) <= 0.0001 && Math.abs(prev.y - p.y) <= 0.0001)) continue
        nextWorld[p.id] = { x: p.x, y: p.y }
        nextAutoSeedPositions[p.id] = { x: p.x, y: p.y }
        syncScreenAuthorityPosition(p.id, nextWorld[p.id]!)
        changed = true
      }
    }
    latestAutoSeedWorldPosByNodeIdRef.current = nextAutoSeedPositions
    const nextWidgetWorldRectById: Record<string, { left: number; top: number; width: number; height: number }> = {}
    for (let i = 0; i < autoSeedIds.length; i += 1) {
      const id = autoSeedIds[i]!
      const world = nextWorld[id]
      if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
      nextWidgetWorldRectById[id] = { left: world.x, top: world.y, width: panelWorldW, height: panelWorldH }
    }
    __flowCanvasDebug.widgetWorldRectById = nextWidgetWorldRectById
    syncFlowCanvasDebugWindow()
    if (!changed && !changedScreenPos) {
      seededPinnedWidgetWorldPosKeyRef.current = seedKey
      lastAutoSeedLayoutSignatureRef.current = currentLayoutSignature
      markLayoutRebalanceHandled()
      return
    }
    const hasMissingWorldSeeds = pendingRaw.length > 0
    const hasDriftReseedCandidates = overlapEligible.length > 0 || forceSceneEmptyReseed || layoutRebalanceRequested
    if (workspaceMutationBlockedForSeed && !hasMissingWorldSeeds && !hasDriftReseedCandidates && !changedScreenPos) {
      markLayoutRebalanceHandled()
      return
    }
    seededPinnedWidgetWorldPosKeyRef.current = seedKey
    lastAutoSeedLayoutSignatureRef.current = currentLayoutSignature
    markLayoutRebalanceHandled()
    if (workspaceMutationBlockedForSeed) {
      useGraphStore.setState(prev => buildWorkspaceBlockedFlowWidgetSeedPatch({
        prevState: prev as FlowWidgetSeedStoreState,
        graphDataForSeeding,
        nextWorld,
        nextScreenPos,
        changedScreenPos,
      }) as Partial<typeof prev>)
      return
    }
    if (changedScreenPos) st.setFlowWidgetPosByNodeId(nextScreenPos)
    if (changed) st.setFlowWidgetWorldPosByNodeId(nextWorld)
  }, [
    args.active,
    args.flowEditorSurfaceId,
    args.flowEditorLayoutRebalanceRequest,
    args.openWidgetNodeIds,
    args.overlayTopologyLayoutSignature,
    args.schema,
    args.viewportH,
    args.viewportW,
    args.zoomViewKeyRef,
    flowWidgetPinnedCount,
    flowWidgetWorldPosCount,
    getLiveContainmentGroupAabbForNode,
    getVisibleViewport,
    getLiveZoomTransform,
  ])

  const emitFlowEditorInteractionFrame = React.useCallback(() => {
    emitFlowEditorInteractionFrameEvent()
  }, [])

  return {
    emitFlowEditorInteractionFrame,
    flowRuntimeRefRef,
    getLiveContainmentGroupAabbForNode,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    latestAutoSeedWorldPosByNodeIdRef,
  }
}
