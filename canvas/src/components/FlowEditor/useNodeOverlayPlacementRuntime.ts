import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceGraphMutationBlocked, type WorkspaceGraphMutationState } from '@/features/workspace-table/workspaceTableSsot'
import { emitFlowEditorInteractionFrame } from '@/lib/canvas/flow-editor-overlay-proxy'
import {
  readScopedFlowWidgetNodeValue,
  resolveFlowWidgetStateGraphKey,
  resolveScopedFlowWidgetNodeMap,
} from '@/lib/flowEditor/widgetStateScope'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { screenToWorld, worldToScreen } from '@/lib/zoom/viewport'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import {
  DEFAULT_FLOW_NODE_WIDTH_PX,
  DEFAULT_ZOOM_MAX_SCALE,
  DEFAULT_ZOOM_MIN_SCALE,
  DEFAULT_ZOOM_MIN_SCALE_HARD_CAP,
  readZoomScaleExtent,
} from '@/lib/graph/layoutDefaults'
import { readPortHandleUiMetrics } from '@/components/FlowEditor/portHandleUi'
import {
  WIDGET_ACTIONS_TOOLBAR_CLEARANCE_PX,
  WIDGET_ACTIONS_TOOLBAR_SIDE_CLEARANCE_PX,
} from '@/components/FlowEditor/nodeOverlayEditorShared'
import { COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9 } from '@/lib/ui/overlayScaleLimits'
import { computeCollectiveFollowPinnedScale, computeWidgetScaleKey, computeWidgetScaledSize, WIDGET_BASE_SIZE } from '@/lib/canvas/overlayWidgetZoom'
import { computeDefaultWidgetFloatingPos } from '@/components/FlowEditor/widgetLayout'
import { isFrontmatterManagedOverlayNode, resolveFrontmatterBalancedFallbackPos } from '@/components/FlowEditor/nodeOverlayFrontmatterPlacement'
import type { GraphSchema } from '@/lib/graph/schema'

type AppliedOverlayPlacement = {
  left: number
  top: number
  scale: number
  zoomK: number
  offsetLeft: number
  offsetTop: number
}

function shouldUseFrontmatterBalancedFallbackForScreenAuthority(args: {
  frontmatterManagedNode: boolean
  floatingUsesScreenAuthority: boolean
  hasAppliedPlacement: boolean
  openWidgetNodeCount: number
  pos: { top: number; left: number } | undefined
  fallback: { top: number; left: number }
}): boolean {
  if (!args.frontmatterManagedNode) return false
  if (!args.floatingUsesScreenAuthority) return false
  if (args.hasAppliedPlacement) return false
  if (args.openWidgetNodeCount <= 1) return false
  const pos = args.pos
  if (!pos || !Number.isFinite(pos.top) || !Number.isFinite(pos.left)) return true
  const dx = Math.abs(pos.left - args.fallback.left)
  const dy = Math.abs(pos.top - args.fallback.top)
  return dx > 2 || dy > 2
}

export type ApplyOverlayPositionOptions = {
  emitInteractionFrame?: boolean
}

export function useNodeOverlayPlacementRuntime(args: {
  node: { x?: unknown; y?: unknown; properties?: unknown }
  nodeId: string
  stackIndex?: number
  active: boolean
  viewportW: number
  viewportH: number
  canvasWindowOffset?: { left: number; top: number } | null
  graphMetaKey?: string | null
  graphMetaKind?: string | null
  zoomViewKey?: string | null
  getLiveNodeWorldPos?: (nodeId: string) => { x: number; y: number } | null
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  getLiveContainmentGroupAabbForNode?: (nodeId: string) => { groupId: string; minX: number; minY: number; maxX: number; maxY: number } | null
  widgetPos: { top: number; left: number } | undefined
  schema: unknown
  openWidgetNodeCount: number
  autoStackOffset: { top: number; left: number }
  floating: boolean
  floatingUsesScreenAuthority: boolean
  setFlowWidgetWorldPosByNodeId: (pos: Record<string, { x: number; y: number }>) => void
}) {
  const {
    node,
    nodeId,
    stackIndex,
    active,
    viewportW,
    viewportH,
    canvasWindowOffset,
    graphMetaKey,
    graphMetaKind,
    zoomViewKey,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    getLiveContainmentGroupAabbForNode,
    widgetPos,
    schema,
    openWidgetNodeCount,
    autoStackOffset,
    floating,
    floatingUsesScreenAuthority,
    setFlowWidgetWorldPosByNodeId,
  } = args

  const asideRef = React.useRef<HTMLElement | null>(null)
  const nodeRef = React.useRef(node)
  const widgetWorldPosRef = React.useRef<{ x: number; y: number } | null>(null)
  const lastGoodWorldPosRef = React.useRef<{ x: number; y: number } | null>(null)
  const pinnedDragOverrideRef = React.useRef<{ left: number; top: number } | null>(null)
  const worldDragOverrideRef = React.useRef<{ x: number; y: number } | null>(null)
  const viewportRef = React.useRef<{ width: number; height: number }>({ width: viewportW, height: viewportH })
  const canvasWindowOffsetRef = React.useRef<{ left: number; top: number }>({ left: 0, top: 0 })
  const schemaRef = React.useRef<GraphSchema | null>(schema && typeof schema === 'object' && !Array.isArray(schema) ? schema as GraphSchema : null)
  const floatingRef = React.useRef(floating)
  const anchoredPosRef = React.useRef<{ top: number; left: number }>({ top: 48, left: 16 })
  const scaledSizeRef = React.useRef<{ width: number; height: number }>({ width: WIDGET_BASE_SIZE.width, height: WIDGET_BASE_SIZE.height })
  const zoomStateRef = React.useRef<{ k: number; x: number; y: number } | null>(
    getEffectiveZoomStateForKey({
      zoomViewKey,
      zoomStateByKey: useGraphStore.getState().zoomStateByKey,
      zoomState: useGraphStore.getState().zoomState,
    }),
  )
  const lastAppliedRef = React.useRef<AppliedOverlayPlacement | null>(null)
  const initialFrontmatterManagedNode = isFrontmatterManagedOverlayNode(graphMetaKind, node)
  const lastFloatingScaleKeyRef = React.useRef<string>(
    computeWidgetScaleKey(computeCollectiveFollowPinnedScale({
      zoomK: zoomStateRef.current?.k ?? 1,
      viewportW,
      viewportH,
      count: openWidgetNodeCount,
      baseWidth: WIDGET_BASE_SIZE.width,
      baseHeight: WIDGET_BASE_SIZE.height,
      viewportPreset: initialFrontmatterManagedNode ? 'widgetFrontmatter' : 'widgetCanvas',
      fitToViewport: false,
    })),
  )
  const cssInitRef = React.useRef(false)
  const livePosWarmupRafRef = React.useRef<number | null>(null)
  const frontmatterScreenAuthorityViewportAnchorRef = React.useRef<{ k: number; x: number; y: number } | null>(null)

  const readPanelScaleForZoom = React.useCallback((zoomK: number, frontmatterManagedNode = false) => {
    const extent = (() => {
      const s = schemaRef.current
      if (!s) return { minK: DEFAULT_ZOOM_MIN_SCALE, maxK: DEFAULT_ZOOM_MAX_SCALE }
      const [minK, maxK] = readZoomScaleExtent(s)
      return { minK: Math.min(minK, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP), maxK }
    })()
    return computeCollectiveFollowPinnedScale({
      zoomK,
      extent,
      viewportW,
      viewportH,
      count: openWidgetNodeCount,
      baseWidth: WIDGET_BASE_SIZE.width,
      baseHeight: WIDGET_BASE_SIZE.height,
      quantizeStep: 0.02,
      hardMinScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.widget.min,
      hardMaxScale: COLLECTIVE_OVERLAY_SCALE_LIMITS_16X9.widget.max,
      viewportPreset: frontmatterManagedNode ? 'widgetFrontmatter' : 'widgetCanvas',
      fitToViewport: false,
    })
  }, [openWidgetNodeCount, viewportH, viewportW])

  const defaultFloatingPos = React.useMemo(() => {
    const pos = computeDefaultWidgetFloatingPos({
      stackIndex,
      viewportW,
      viewportH,
    })
    if (!initialFrontmatterManagedNode) return { top: pos.top, left: pos.left }
    const zoomK = initialFrontmatterManagedNode && floatingUsesScreenAuthority
      ? 1
      : zoomStateRef.current?.k ?? 1
    const frontmatterFallback = resolveFrontmatterBalancedFallbackPos({
      enabled: true,
      openWidgetNodeCount,
      stackIndex,
      viewportW,
      viewportH,
      scaled: computeWidgetScaledSize(readPanelScaleForZoom(zoomK, true)),
      zoomK,
    })
    if (frontmatterFallback) return frontmatterFallback
    return { top: pos.top, left: pos.left }
  }, [floatingUsesScreenAuthority, initialFrontmatterManagedNode, openWidgetNodeCount, readPanelScaleForZoom, stackIndex, viewportH, viewportW])

  const resolveFloatingPos = React.useCallback(
    (pos: { top: number; left: number } | undefined, fallback: { top: number; left: number }): { top: number; left: number } => {
      const v = pos
      if (v && Number.isFinite(v.top) && Number.isFinite(v.left)) {
        const offset = canvasWindowOffsetRef.current
        const viewportWidth = viewportW
        const viewportHeight = viewportH
        const leftRaw = v.left
        const topRaw = v.top
        const looksLikeWindowCoords =
          (offset.left !== 0 || offset.top !== 0) &&
          leftRaw >= offset.left - 2 &&
          leftRaw <= offset.left + viewportWidth + 2 &&
          topRaw >= offset.top - 2 &&
          topRaw <= offset.top + viewportHeight + 2
        const coerce = looksLikeWindowCoords ? { left: leftRaw - offset.left, top: topRaw - offset.top } : v
        if (shouldUseFrontmatterBalancedFallbackForScreenAuthority({
          frontmatterManagedNode: initialFrontmatterManagedNode,
          floatingUsesScreenAuthority,
          hasAppliedPlacement: Boolean(lastAppliedRef.current),
          openWidgetNodeCount,
          pos: coerce,
          fallback,
        })) return fallback
        if (floatingUsesScreenAuthority) return coerce
        return coerce
      }
      return fallback
    },
    [floatingUsesScreenAuthority, initialFrontmatterManagedNode, openWidgetNodeCount, viewportH, viewportW],
  )

  const [pinnedTopPx, setPinnedTopPx] = React.useState<number>(() => resolveFloatingPos(widgetPos, defaultFloatingPos).top)
  const [pinnedLeftPx, setPinnedLeftPx] = React.useState<number>(() => resolveFloatingPos(widgetPos, defaultFloatingPos).left)
  const [toolbarDock, setToolbarDock] = React.useState<'above' | 'below'>('above')
  const [toolbarSideClamp, setToolbarSideClamp] = React.useState(false)

  useIsomorphicLayoutEffect(() => {
    if (
      initialFrontmatterManagedNode
      && floatingUsesScreenAuthority
      && lastAppliedRef.current
      && !pinnedDragOverrideRef.current
    ) {
      return
    }
    const pos = resolveFloatingPos(widgetPos, defaultFloatingPos)
    setPinnedTopPx(prev => (prev === pos.top ? prev : pos.top))
    setPinnedLeftPx(prev => (prev === pos.left ? prev : pos.left))
  }, [defaultFloatingPos, floatingUsesScreenAuthority, initialFrontmatterManagedNode, widgetPos, resolveFloatingPos])

  React.useEffect(() => {
    nodeRef.current = node
  }, [node])

  React.useEffect(() => {
    viewportRef.current = { width: viewportW, height: viewportH }
  }, [viewportH, viewportW])

  React.useEffect(() => {
    const next = canvasWindowOffset && Number.isFinite(canvasWindowOffset.left) && Number.isFinite(canvasWindowOffset.top)
      ? { left: canvasWindowOffset.left, top: canvasWindowOffset.top }
      : { left: 0, top: 0 }
    canvasWindowOffsetRef.current = next
  }, [canvasWindowOffset])

  React.useEffect(() => {
    schemaRef.current = schema && typeof schema === 'object' && !Array.isArray(schema) ? schema as GraphSchema : null
  }, [schema])

  useIsomorphicLayoutEffect(() => {
    floatingRef.current = floating
  }, [floating])

  const persistFloatingPos = React.useCallback(
    (pos: { top: number; left: number }) => {
      if (!nodeId) return
      const state = useGraphStore.getState()
      if (isWorkspaceGraphMutationBlocked(state)) {
        useGraphStore.setState(prev => {
          const prevState = prev as unknown as {
            graphData?: Record<string, unknown> | null
            flowWidgetPosByNodeId?: Record<string, { top: number; left: number }>
            flowWidgetPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { top: number; left: number }>>
          }
          const graphKey = resolveFlowWidgetStateGraphKey({
            graphMetaKey,
            graphData: (prev as unknown as { graphData?: unknown }).graphData,
          })
          const prevPos = resolveScopedFlowWidgetNodeMap({
            graphMetaKey: graphKey,
            keyedByGraphMetaKey: prevState.flowWidgetPosByNodeIdByGraphMetaKey,
            globalByNodeId: prevState.flowWidgetPosByNodeId,
          })
          const prevEntry = prevPos[nodeId]
          if (prevEntry && prevEntry.top === pos.top && prevEntry.left === pos.left) return {}
          const nextPos = { ...prevPos, [nodeId]: { top: pos.top, left: pos.left } }
          if (!graphKey) return { flowWidgetPosByNodeId: nextPos }
          const byKey = prevState.flowWidgetPosByNodeIdByGraphMetaKey || {}
          return {
            flowWidgetPosByNodeId: nextPos,
            flowWidgetPosByNodeIdByGraphMetaKey: { ...byKey, [graphKey]: nextPos },
          }
        })
        return
      }
      const current = state.flowWidgetPosByNodeId || {}
      const prev = current[nodeId]
      if (prev && prev.top === pos.top && prev.left === pos.left) return
      const next = { ...current, [nodeId]: { top: pos.top, left: pos.left } }
      state.setFlowWidgetPosByNodeId(next)
    },
    [graphMetaKey, nodeId],
  )

  const persistWorldPos = React.useCallback(
    (pos: { x: number; y: number }) => {
      if (!nodeId) return
      const state = useGraphStore.getState() as WorkspaceGraphMutationState & {
        flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
        flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
        zoomState?: { k: number; x: number; y: number } | null
        zoomStateByKey?: Record<string, { k: number; x: number; y: number } | null | undefined> | null
        graphData?: unknown
      }
      if (isWorkspaceGraphMutationBlocked(state)) {
        useGraphStore.setState(prev => {
          const prevState = prev as unknown as {
            graphData?: unknown
            flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
            flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
          }
          const graphKey = resolveFlowWidgetStateGraphKey({
            graphMetaKey,
            graphData: prevState.graphData,
          })
          const prevWorld = resolveScopedFlowWidgetNodeMap({
            graphMetaKey: graphKey,
            keyedByGraphMetaKey: prevState.flowWidgetWorldPosByNodeIdByGraphMetaKey,
            globalByNodeId: prevState.flowWidgetWorldPosByNodeId,
          })
          const prevEntry = prevWorld[nodeId]
          if (prevEntry && Math.abs(prevEntry.x - pos.x) <= 0.0001 && Math.abs(prevEntry.y - pos.y) <= 0.0001) return {}
          const nextWorld = { ...prevWorld, [nodeId]: { x: pos.x, y: pos.y } }
          if (!graphKey) return { flowWidgetWorldPosByNodeId: nextWorld }
          const byKey = prevState.flowWidgetWorldPosByNodeIdByGraphMetaKey || {}
          return {
            flowWidgetWorldPosByNodeId: nextWorld,
            flowWidgetWorldPosByNodeIdByGraphMetaKey: { ...byKey, [graphKey]: nextWorld },
          }
        })
        return
      }
      const current = state.flowWidgetWorldPosByNodeId || {}
      const prev = current[nodeId]
      if (prev && Math.abs(prev.x - pos.x) <= 0.0001 && Math.abs(prev.y - pos.y) <= 0.0001) return
      const next = { ...current, [nodeId]: { x: pos.x, y: pos.y } }
      setFlowWidgetWorldPosByNodeId(next)
    },
    [graphMetaKey, nodeId, setFlowWidgetWorldPosByNodeId],
  )

  const readStoredWidgetWorldPos = React.useCallback((): { x: number; y: number } | null => {
    const state = useGraphStore.getState() as {
      graphData?: unknown
      flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
      flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
    }
    const next = readScopedFlowWidgetNodeValue({
      nodeId,
      graphMetaKey,
      graphData: state.graphData,
      keyedByGraphMetaKey: state.flowWidgetWorldPosByNodeIdByGraphMetaKey,
      globalByNodeId: state.flowWidgetWorldPosByNodeId,
    }) || null
    if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) return null
    return { x: next.x, y: next.y }
  }, [graphMetaKey, nodeId])

  const shouldBypassStoreZoomFallback = React.useCallback((liveZoom: { k: number; x: number; y: number } | null): boolean => {
    if (liveZoom) return false
    if (floatingRef.current || floatingUsesScreenAuthority) return false
    if (pinnedDragOverrideRef.current || worldDragOverrideRef.current) return false
    const state = useGraphStore.getState()
    if (!isWorkspaceGraphMutationBlocked(state)) return false
    return !!readStoredWidgetWorldPos()
  }, [floatingUsesScreenAuthority, readStoredWidgetWorldPos])

  const readCurrentTransform = React.useCallback(() => {
    const liveZoom = getLiveZoomTransform ? getLiveZoomTransform() : null
    const storeZoom = getEffectiveZoomStateForKey({
      zoomViewKey,
      zoomStateByKey: useGraphStore.getState().zoomStateByKey,
      zoomState: useGraphStore.getState().zoomState,
    })
    const bypassStoreZoomFallback = shouldBypassStoreZoomFallback(liveZoom)
    let z = liveZoom || (bypassStoreZoomFallback ? null : zoomStateRef.current)
    if (!liveZoom && !bypassStoreZoomFallback && storeZoom && storeZoom !== z) {
      z = storeZoom
      zoomStateRef.current = storeZoom
    }
    return z || { k: 1, x: 0, y: 0 }
  }, [getLiveZoomTransform, shouldBypassStoreZoomFallback, zoomViewKey])

  const persistFloatingPlacement = React.useCallback((pos: { top: number; left: number }) => {
    persistFloatingPos(pos)
    const z = readCurrentTransform()
    const world = screenToWorld({
      transform: z,
      sx: pos.left,
      sy: pos.top,
    })
    persistWorldPos(world)
  }, [persistFloatingPos, persistWorldPos, readCurrentTransform])

  const applyOverlayPosition = React.useCallback((opts?: ApplyOverlayPositionOptions) => {
    const el = asideRef.current
    if (!el) return
    if (!cssInitRef.current) {
      cssInitRef.current = true
      el.style.left = '0px'
      el.style.top = '0px'
      el.style.width = `${WIDGET_BASE_SIZE.width}px`
      el.style.transformOrigin = 'top left'
      el.style.willChange = 'transform'
    }
    const liveZoom = getLiveZoomTransform ? getLiveZoomTransform() : null
    const storeZoom = getEffectiveZoomStateForKey({
      zoomViewKey,
      zoomStateByKey: useGraphStore.getState().zoomStateByKey,
      zoomState: useGraphStore.getState().zoomState,
    })
    const bypassStoreZoomFallback = shouldBypassStoreZoomFallback(liveZoom)
    let z = liveZoom || (bypassStoreZoomFallback ? null : zoomStateRef.current)
    if (!liveZoom && !bypassStoreZoomFallback && storeZoom && storeZoom !== z) {
      z = storeZoom
      zoomStateRef.current = storeZoom
    }
    const placementTransform = z || { k: 1, x: 0, y: 0 }
    const zoomK = Number.isFinite(placementTransform.k) ? placementTransform.k : 1
    const n = nodeRef.current
    const frontmatterManagedNode = isFrontmatterManagedOverlayNode(graphMetaKind, n)
    const frontmatterPanelScaleZoomK = frontmatterManagedNode && floatingUsesScreenAuthority ? 1 : zoomK
    const panelScale = readPanelScaleForZoom(frontmatterPanelScaleZoomK, frontmatterManagedNode)
    if (floatingRef.current) lastFloatingScaleKeyRef.current = computeWidgetScaleKey(panelScale)
    const scaled = computeWidgetScaledSize(panelScale)
    scaledSizeRef.current = scaled
    const frontmatterBalancedFallbackPos = resolveFrontmatterBalancedFallbackPos({
      enabled: frontmatterManagedNode,
      openWidgetNodeCount,
      stackIndex,
      viewportW,
      viewportH,
      scaled,
      zoomK: frontmatterPanelScaleZoomK,
    })

    const live = getLiveNodeWorldPos ? getLiveNodeWorldPos(nodeId) : null
    const liveX = live && Number.isFinite(live.x) ? (live.x as number) : null; const liveY = live && Number.isFinite(live.y) ? (live.y as number) : null
    const nx = typeof n.x === 'number' && Number.isFinite(n.x) ? (n.x as number) : null; const ny = typeof n.y === 'number' && Number.isFinite(n.y) ? (n.y as number) : null
    if (liveX != null && liveY != null) lastGoodWorldPosRef.current = { x: liveX, y: liveY }
    else if (nx != null && ny != null) lastGoodWorldPosRef.current = { x: nx, y: ny }
    const world = lastGoodWorldPosRef.current || { x: 0, y: 0 }
    const { sx: screenX, sy: screenY } = worldToScreen({ transform: placementTransform, x: world.x, y: world.y })
    const port = schemaRef.current?.behavior?.portHandles || null
    const portEnabled = Boolean((port as { enabled?: unknown } | null)?.enabled) || frontmatterManagedNode
    const portMetrics = readPortHandleUiMetrics(schemaRef.current || null, { zoomK }); const portExtraPadScreenPx = portEnabled ? Math.max(0, portMetrics.railWidthPx + 8) : 0
    anchoredPosRef.current = {
      top: screenY - 12,
      left: screenX + DEFAULT_FLOW_NODE_WIDTH_PX * zoomK + 16 + portExtraPadScreenPx,
    }

    const dragOverride = pinnedDragOverrideRef.current; const worldDragOverride = worldDragOverrideRef.current
    const currentStoredWorld = readStoredWidgetWorldPos()
    if (currentStoredWorld) widgetWorldPosRef.current = currentStoredWorld
    const currentStoredWorldForPlacement = frontmatterManagedNode && floatingUsesScreenAuthority
      ? null
      : currentStoredWorld
    const storedWorld = currentStoredWorldForPlacement || (floatingUsesScreenAuthority ? null : widgetWorldPosRef.current)
    const storedWorldScreen = storedWorld ? worldToScreen({ transform: placementTransform, x: storedWorld.x, y: storedWorld.y }) : null
    const frontmatterBaseFarOffscreen = frontmatterManagedNode
      && storedWorldScreen
      && (
        storedWorldScreen.sx < -scaled.width * 2
        || storedWorldScreen.sy < -scaled.height * 2
        || storedWorldScreen.sx > viewportW + scaled.width * 2
        || storedWorldScreen.sy > viewportH + scaled.height * 2
      )
    const storedWorldFarOffscreen = Boolean(frontmatterBaseFarOffscreen)
    const defaultWorld = screenToWorld({
      transform: placementTransform,
      sx: anchoredPosRef.current.left + autoStackOffset.left,
      sy: anchoredPosRef.current.top + autoStackOffset.top,
    })
    const effectiveStoredWorld = storedWorldFarOffscreen ? null : storedWorld
    const worldPinned = worldDragOverride || effectiveStoredWorld || defaultWorld
    const worldPinnedScreen = worldToScreen({ transform: placementTransform, x: worldPinned.x, y: worldPinned.y })
    const floatingWorld = worldDragOverride || effectiveStoredWorld
    const floatingWorldScreen = floatingWorld ? worldToScreen({ transform: placementTransform, x: floatingWorld.x, y: floatingWorld.y }) : null
    const useFrontmatterInitialBalancedBase = frontmatterManagedNode
      && floatingUsesScreenAuthority
      && !lastAppliedRef.current
    const basePos = dragOverride
      ? { top: dragOverride.top, left: dragOverride.left }
      : floatingRef.current
        ? (floatingWorldScreen
            ? { top: floatingWorldScreen.sy, left: floatingWorldScreen.sx }
            : floatingUsesScreenAuthority
              ? (useFrontmatterInitialBalancedBase && frontmatterBalancedFallbackPos
                  ? frontmatterBalancedFallbackPos
                  : { top: pinnedTopPx, left: pinnedLeftPx })
              : { top: worldPinnedScreen.sy, left: worldPinnedScreen.sx })
        : { top: worldPinnedScreen.sy, left: worldPinnedScreen.sx }
    const safeBasePos = { top: Number.isFinite(basePos.top) ? basePos.top : 8, left: Number.isFinite(basePos.left) ? basePos.left : 8 }
    const posBase = safeBasePos
    const posBaseForViewport = (() => {
      if (floatingRef.current) return posBase
      const aabb = getLiveContainmentGroupAabbForNode?.(nodeId)
      if (!aabb) return posBase
      const a = worldToScreen({ transform: placementTransform, x: aabb.minX, y: aabb.minY })
      const b = worldToScreen({ transform: placementTransform, x: aabb.maxX, y: aabb.maxY })
      const left0 = Math.min(a.sx, b.sx)
      const right0 = Math.max(a.sx, b.sx)
      const top0 = Math.min(a.sy, b.sy)
      const bottom0 = Math.max(a.sy, b.sy)
      if (!Number.isFinite(left0) || !Number.isFinite(right0) || !Number.isFinite(top0) || !Number.isFinite(bottom0)) return posBase
      const minLeft = left0 + 8
      const minTop = top0 + 8
      const maxLeft = Math.max(minLeft, right0 - 8 - scaled.width)
      const maxTop = Math.max(minTop, bottom0 - 8 - scaled.height)
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
      return { left: clamp(posBase.left, minLeft, maxLeft), top: clamp(posBase.top, minTop, maxTop) }
    })()
    const useFrontmatterViewportProjection = frontmatterManagedNode && floatingUsesScreenAuthority && !dragOverride
    if (useFrontmatterViewportProjection && !frontmatterScreenAuthorityViewportAnchorRef.current) {
      frontmatterScreenAuthorityViewportAnchorRef.current = {
        k: Number.isFinite(placementTransform.k) ? placementTransform.k : 1,
        x: Number.isFinite(placementTransform.x) ? placementTransform.x : 0,
        y: Number.isFinite(placementTransform.y) ? placementTransform.y : 0,
      }
    }
    if (!frontmatterManagedNode || !floatingUsesScreenAuthority) {
      frontmatterScreenAuthorityViewportAnchorRef.current = null
    }
    const frontmatterViewportAnchor = frontmatterScreenAuthorityViewportAnchorRef.current
    const frontmatterViewportAdjustedPos = (() => {
      if (!useFrontmatterViewportProjection || !frontmatterViewportAnchor) return posBaseForViewport
      const anchorWorld = screenToWorld({
        transform: frontmatterViewportAnchor,
        sx: posBaseForViewport.left,
        sy: posBaseForViewport.top,
      })
      const nextScreen = worldToScreen({
        transform: placementTransform,
        x: anchorWorld.x,
        y: anchorWorld.y,
      })
      if (!Number.isFinite(nextScreen.sx) || !Number.isFinite(nextScreen.sy)) return posBaseForViewport
      return { left: nextScreen.sx, top: nextScreen.sy }
    })()
    const frontmatterViewportScale = (() => {
      if (!useFrontmatterViewportProjection || !frontmatterViewportAnchor) return 1
      const anchorK = Number.isFinite(frontmatterViewportAnchor.k) && frontmatterViewportAnchor.k > 0 ? frontmatterViewportAnchor.k : 1
      const nextK = Number.isFinite(placementTransform.k) && placementTransform.k > 0 ? placementTransform.k : anchorK
      const scale = nextK / anchorK
      return Number.isFinite(scale) && scale > 0 ? scale : 1
    })()
    const pos = frontmatterViewportAdjustedPos
    const viewportPanelScale = panelScale * frontmatterViewportScale
    const nextToolbarDock = pos.top >= WIDGET_ACTIONS_TOOLBAR_CLEARANCE_PX ? 'above' : 'below'
    setToolbarDock(prev => (prev === nextToolbarDock ? prev : nextToolbarDock))
    setToolbarSideClamp(prev => {
      const nextToolbarSideClamp = pos.left + scaled.width * frontmatterViewportScale + WIDGET_ACTIONS_TOOLBAR_SIDE_CLEARANCE_PX > viewportW
      return prev === nextToolbarSideClamp ? prev : nextToolbarSideClamp
    })
    const offset = canvasWindowOffsetRef.current
    const offsetLeft = Number.isFinite(offset.left) ? offset.left : 0; const offsetTop = Number.isFinite(offset.top) ? offset.top : 0
    const tx = pos.left + offsetLeft; const ty = pos.top + offsetTop
    const last = lastAppliedRef.current
    if (last && last.left === pos.left && last.top === pos.top && last.offsetLeft === offsetLeft && last.offsetTop === offsetTop && Math.abs(last.scale - viewportPanelScale) < 1e-6 && Math.abs(last.zoomK - zoomK) < 1e-6) return
    lastAppliedRef.current = { left: pos.left, top: pos.top, scale: viewportPanelScale, zoomK, offsetLeft, offsetTop }
    el.style.transform = `matrix(${viewportPanelScale}, 0, 0, ${viewportPanelScale}, ${tx}, ${ty})`
    if (floatingRef.current && !floatingUsesScreenAuthority && !currentStoredWorld && !widgetWorldPosRef.current && !worldDragOverride && !dragOverride) {
      widgetWorldPosRef.current = worldPinned
      lastGoodWorldPosRef.current = worldPinned
      persistWorldPos(worldPinned)
    }
    if (opts?.emitInteractionFrame !== false) emitFlowEditorInteractionFrame()
  }, [
    autoStackOffset.left,
    autoStackOffset.top,
    floatingUsesScreenAuthority,
    getLiveContainmentGroupAabbForNode,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    graphMetaKind,
    nodeId,
    openWidgetNodeCount,
    pinnedLeftPx,
    pinnedTopPx,
    persistWorldPos,
    readPanelScaleForZoom,
    readStoredWidgetWorldPos,
    stackIndex,
    shouldBypassStoreZoomFallback,
    viewportH,
    viewportW,
    widgetPos,
    zoomViewKey,
  ])

  React.useEffect(() => {
    const pick = (s: unknown) => {
      const state = s as {
        graphData?: unknown
        flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }>
        flowWidgetWorldPosByNodeIdByGraphMetaKey?: Record<string, Record<string, { x: number; y: number }>>
      }
      return readScopedFlowWidgetNodeValue({
        nodeId,
        graphMetaKey,
        graphData: state.graphData,
        keyedByGraphMetaKey: state.flowWidgetWorldPosByNodeIdByGraphMetaKey,
        globalByNodeId: state.flowWidgetWorldPosByNodeId,
      })
    }
    const coerce = (v: unknown): { x: number; y: number } | null => {
      if (!v || typeof v !== 'object') return null
      const rec = v as { x?: unknown; y?: unknown }
      const x = typeof rec.x === 'number' && Number.isFinite(rec.x) ? rec.x : null
      const y = typeof rec.y === 'number' && Number.isFinite(rec.y) ? rec.y : null
      return x == null || y == null ? null : { x, y }
    }
    widgetWorldPosRef.current = coerce(pick(useGraphStore.getState()))
    const unsub = useGraphStore.subscribe(
      pick,
      next => {
        widgetWorldPosRef.current = coerce(next)
        applyOverlayPosition()
      },
    )
    return () => {
      try {
        unsub()
      } catch {
        void 0
      }
    }
  }, [applyOverlayPosition, graphMetaKey, nodeId])

  React.useEffect(() => {
    if (!active || !floating) return
    if (pinnedDragOverrideRef.current || worldDragOverrideRef.current) return
    if (!floatingUsesScreenAuthority && !lastAppliedRef.current) return
    const target = lastAppliedRef.current
      ? { left: lastAppliedRef.current.left, top: lastAppliedRef.current.top }
      : { left: pinnedLeftPx, top: pinnedTopPx }
    if (!Number.isFinite(target.left) || !Number.isFinite(target.top)) return
    const z = readCurrentTransform()
    const nextWorld = screenToWorld({ transform: z, sx: target.left, sy: target.top })
    const prevWorld = widgetWorldPosRef.current
    if (prevWorld && Math.abs(prevWorld.x - nextWorld.x) <= 0.0001 && Math.abs(prevWorld.y - nextWorld.y) <= 0.0001) return
    persistWorldPos(nextWorld)
  }, [active, floating, floatingUsesScreenAuthority, pinnedLeftPx, pinnedTopPx, persistWorldPos, readCurrentTransform])

  React.useEffect(() => {
    if (!active || !getLiveNodeWorldPos || floating || typeof window === 'undefined') return
    const initialLive = getLiveNodeWorldPos(nodeId)
    if (initialLive && Number.isFinite(initialLive.x) && Number.isFinite(initialLive.y)) return
    const startedAtMs = Date.now()
    let attempts = 0
    const tick = () => {
      attempts += 1
      applyOverlayPosition()
      const live = getLiveNodeWorldPos(nodeId)
      const elapsedMs = Date.now() - startedAtMs
      if ((live && Number.isFinite(live.x) && Number.isFinite(live.y)) || attempts >= 120 || elapsedMs >= 1600) {
        livePosWarmupRafRef.current = null
        return
      }
      livePosWarmupRafRef.current = window.requestAnimationFrame(tick)
    }
    livePosWarmupRafRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (livePosWarmupRafRef.current != null) {
        try {
          cancelAnimationFrame(livePosWarmupRafRef.current)
        } catch {
          void 0
        }
        livePosWarmupRafRef.current = null
      }
    }
  }, [active, applyOverlayPosition, floating, getLiveNodeWorldPos, nodeId])

  useIsomorphicLayoutEffect(() => {
    applyOverlayPosition()
  }, [applyOverlayPosition, canvasWindowOffset?.left, canvasWindowOffset?.top, pinnedLeftPx, pinnedTopPx, viewportH, viewportW, node.x, node.y])

  React.useEffect(() => {
    if (!active || floating || !nodeId || widgetWorldPosRef.current) return
    applyOverlayPosition()
    const z = (getLiveZoomTransform ? getLiveZoomTransform() : null) || zoomStateRef.current || { k: 1, x: 0, y: 0 }
    const world = screenToWorld({
      transform: z,
      sx: anchoredPosRef.current.left + autoStackOffset.left,
      sy: anchoredPosRef.current.top + autoStackOffset.top,
    })
    persistWorldPos(world)
  }, [active, applyOverlayPosition, autoStackOffset.left, autoStackOffset.top, floating, getLiveZoomTransform, nodeId, persistWorldPos])

  React.useEffect(() => {
    const unsub = useGraphStore.subscribe(
      s => getEffectiveZoomStateForKey({
        zoomViewKey,
        zoomStateByKey: s.zoomStateByKey,
        zoomState: s.zoomState,
      }),
      next => {
        const nextZoom = next || null
        if (floatingRef.current) {
          const frontmatterScreenAuthority = isFrontmatterManagedOverlayNode(graphMetaKind, nodeRef.current) && floatingUsesScreenAuthority
          const scaleKey = computeWidgetScaleKey(readPanelScaleForZoom(
            frontmatterScreenAuthority ? 1 : (nextZoom?.k ?? 1),
            isFrontmatterManagedOverlayNode(graphMetaKind, nodeRef.current),
          ))
          const sameScale = lastFloatingScaleKeyRef.current === scaleKey
          lastFloatingScaleKeyRef.current = scaleKey
          zoomStateRef.current = nextZoom
          if (!frontmatterScreenAuthority && sameScale && !widgetWorldPosRef.current && !pinnedDragOverrideRef.current) return
          applyOverlayPosition()
          return
        }
        zoomStateRef.current = nextZoom
        applyOverlayPosition()
      },
    )
    return () => {
      try {
        unsub()
      } catch {
        void 0
      }
    }
  }, [applyOverlayPosition, floatingUsesScreenAuthority, graphMetaKind, readPanelScaleForZoom, zoomViewKey])

  return {
    asideRef,
    viewportRef,
    canvasWindowOffsetRef,
    anchoredPosRef,
    scaledSizeRef,
    zoomStateRef,
    lastAppliedRef,
    pinnedDragOverrideRef,
    worldDragOverrideRef,
    widgetWorldPosRef,
    pinnedTopPx,
    pinnedLeftPx,
    setPinnedTopPx,
    setPinnedLeftPx,
    toolbarDock,
    toolbarSideClamp,
    applyOverlayPosition,
    persistWorldPos,
    persistFloatingPlacement,
  }
}
