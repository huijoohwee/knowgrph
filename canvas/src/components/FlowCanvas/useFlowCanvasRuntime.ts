import React from 'react'
import * as d3 from 'd3'

import {
  cancelFlowZoomRequestAnim,
  collectFlowEditorOverlayBounds,
  recenterVisibleFlowEditorOverlayCentroid,
  resolveFlowEditorVisibleViewport,
} from '@/components/FlowCanvas/applyZoomRequestNative'
import { bindFlowCanvasNativeInteractions, type FlowCanvasDrag } from '@/components/FlowCanvas/bindNativeInteractions'
import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { computeCollisionDuringDrag } from '@/components/FlowCanvas/collisionPolicy'
import { __flowCanvasDebug, resetFlowCanvasDebugStatus, syncFlowCanvasDebugToast } from '@/components/FlowCanvas/flowCanvasDebug'
import { setFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { fitFlowEditorPinnedWidgets } from '@/components/FlowCanvas/fitPinnedWidgets'
import { buildFlowFitOptions, readFlowEditorPortExtraPadScreenPx, resolveFitReferenceFrame } from '@/components/FlowCanvas/fitRuntime'
import { isFlowTransformShowingGraph } from '@/components/FlowCanvas/transformGuards'
import {
  createFlowNativeRuntime,
  requestFlowNativeDraw,
  setFlowNativePresentation,
  setFlowNativeTransform,
  setFlowNativeViewport,
  type FlowNativeDrawArgs,
  type FlowNativeRuntime,
} from '@/components/FlowCanvas/nativeRuntime'
import { subscribeFlowResetZoomFloorCache } from '@/components/FlowCanvas/shared'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import type { ZoomWheelGuardState } from '@/lib/canvas/zoom-wheel-guard'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
import { isFlowEditorFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'
import { isHorizontalOverlayStrip, isVerticalOverlayCluster } from '@/lib/ui/overlayBalancedSpread'
import { deriveFrontmatterFlowOverlayNodeIds } from '@/lib/flowEditor/frontmatterOverlayNodeIds'

export function useFlowCanvasRuntime(args: {
  active: boolean
  flowEditorSurfaceId?: string
  allowNodeDragOverride?: boolean
  collisionDuringDrag: boolean
  viewportControlsPreset: ViewportControlsPreset
  flowEditorSelectionOnDrag: boolean
  canvas2dRenderer: string
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>
  runtimeRef: React.MutableRefObject<FlowNativeRuntime | null>
  drawArgsRef: React.MutableRefObject<FlowNativeDrawArgs>
  buildDrawArgs: () => FlowNativeDrawArgs
  scheduleFlowDraw: () => void
  requestCommit: () => void
  requestSetSelectionBox: (next: null | { left: number; top: number; width: number; height: number }) => void
  handleInteractionFrame: () => void
  dragRef: React.MutableRefObject<FlowCanvasDrag>
  lastPointerInCanvasRef: React.MutableRefObject<null | { sx: number; sy: number; ts: number }>
  lastWheelIntentRef: React.MutableRefObject<null | { dir: 'in' | 'out'; ts: number }>
  zoomWheelGuardRef: React.MutableRefObject<ZoomWheelGuardState>
  userSelectLockPointerIdRef: React.MutableRefObject<number | null>
  positionsDirtySinceCommitRef: React.MutableRefObject<boolean>
  collisionSchemaRef: React.MutableRefObject<GraphSchema | null>
  collisionGraphDataRef: React.MutableRefObject<any>
  collisionFlowConfigRef: React.MutableRefObject<any>
  collisionPresentationRef: React.MutableRefObject<any>
  lastAppliedPositionsRef: React.MutableRefObject<Record<string, { x: number; y: number }> | null>
  lastBuiltGraphKeyRef: React.MutableRefObject<string>
  lastInitTransformZoomViewKeyRef: React.MutableRefObject<string | null>
  lastUserInteractionAtMsRef: React.MutableRefObject<number>
  dpr: number
  viewportW: number
  viewportH: number
  rankdir: 'TB' | 'LR'
  zoomViewKey: string
  graphDataRevision: number
  sceneGraphData: any
  computedPositions: Record<string, { x: number; y: number }> | null
  seededFallbackPositions: Record<string, { x: number; y: number }> | null
  layoutVariant: string
  flowConfigEffective: any
  flowPresentation: any
  sceneGroups: any[]
  widgetRegistry: WidgetRegistryEntry[]
  forbidCircleNodes: boolean
  graphDataForZoom: any
  graphDataForZoomRequests: any
  flowEditorReservedW: number
  openWidgetNodeIds: string[]
  flowWidgetPinnedByNodeId: Record<string, boolean>
  flowWidgetWorldPosByNodeId: Record<string, { x: number; y: number }>
  schema: GraphSchema | null
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  multiDimTableModeEnabled: boolean
  documentStructureBaselineLock: boolean
  fitToScreenMode: boolean
  zoomToSelectionMode: boolean
  viewPinned: boolean
}) {
  const {
    active,
    allowNodeDragOverride,
    collisionDuringDrag,
    viewportControlsPreset,
    flowEditorSelectionOnDrag,
    canvas2dRenderer,
    canvasRef,
    runtimeRef,
    buildDrawArgs,
    scheduleFlowDraw,
    requestCommit,
    requestSetSelectionBox,
    handleInteractionFrame,
    dragRef,
    lastPointerInCanvasRef,
    lastWheelIntentRef,
    zoomWheelGuardRef,
    userSelectLockPointerIdRef,
    positionsDirtySinceCommitRef,
    collisionSchemaRef,
    collisionGraphDataRef,
    collisionFlowConfigRef,
    collisionPresentationRef,
    lastAppliedPositionsRef,
    lastBuiltGraphKeyRef,
    lastInitTransformZoomViewKeyRef,
    lastUserInteractionAtMsRef,
    dpr,
    viewportW,
    viewportH,
    rankdir,
    zoomViewKey,
    graphDataRevision,
    sceneGraphData,
    computedPositions,
    seededFallbackPositions,
    layoutVariant,
    flowConfigEffective,
    flowPresentation,
    sceneGroups,
    widgetRegistry,
    forbidCircleNodes,
    graphDataForZoom,
    graphDataForZoomRequests,
    flowEditorReservedW,
    openWidgetNodeIds,
    flowWidgetPinnedByNodeId,
    flowWidgetWorldPosByNodeId,
    schema,
    frontmatterModeEnabled,
    documentSemanticMode,
    multiDimTableModeEnabled,
    documentStructureBaselineLock,
    fitToScreenMode,
    zoomToSelectionMode,
    viewPinned,
  } = args
  void flowEditorReservedW
  const frontmatterFlowInitialFitFillRatio = useGraphStore(s => s.frontmatterFlowInitialFitFillRatio)
  const frontmatterFlowOverlayFitProxyScalePhone = useGraphStore(s => s.frontmatterFlowOverlayFitProxyScalePhone)
  const frontmatterFlowOverlayFitProxyScaleTablet = useGraphStore(s => s.frontmatterFlowOverlayFitProxyScaleTablet)
  const frontmatterFlowOverlayFitProxyScaleLaptop = useGraphStore(s => s.frontmatterFlowOverlayFitProxyScaleLaptop)
  const frontmatterFlowOverlayFitProxyScaleDesktop = useGraphStore(s => s.frontmatterFlowOverlayFitProxyScaleDesktop)
  const viewportFitReferenceWidth = useGraphStore(s => s.viewportFitReferenceWidth)
  const viewportFitReferenceHeight = useGraphStore(s => s.viewportFitReferenceHeight)
  const workspaceEditorOverlayOpen = useGraphStore(s => isWorkspaceEditorOverlayOpen(s))
  const frontmatterOverlayFitProxyScales = React.useMemo(() => ({
    phone: frontmatterFlowOverlayFitProxyScalePhone,
    tablet: frontmatterFlowOverlayFitProxyScaleTablet,
    laptop: frontmatterFlowOverlayFitProxyScaleLaptop,
    desktop: frontmatterFlowOverlayFitProxyScaleDesktop,
  }), [
    frontmatterFlowOverlayFitProxyScaleDesktop,
    frontmatterFlowOverlayFitProxyScaleLaptop,
    frontmatterFlowOverlayFitProxyScalePhone,
    frontmatterFlowOverlayFitProxyScaleTablet,
  ])
  const shouldIgnorePersistedWorldPosForWorkspaceOverlay = React.useMemo(() => {
    if (workspaceEditorOverlayOpen !== true) return false
    const meta = (graphDataForZoomRequests?.metadata || null) as Record<string, unknown> | null
    const kind = String(meta?.kind || '').trim()
    if (kind !== 'frontmatter-flow') return false
    const nodes = Array.isArray(graphDataForZoomRequests?.nodes) ? graphDataForZoomRequests.nodes : []
    const hasUsableNodeCoords = nodes.some(node =>
      typeof node?.x === 'number'
      && Number.isFinite(node.x)
      && typeof node?.y === 'number'
      && Number.isFinite(node.y),
    )
    // Only ignore stored widget world positions when graph node coordinates are usable.
    // If node coords are missing, world positions are the only fit source available.
    return hasUsableNodeCoords
  }, [graphDataForZoomRequests, workspaceEditorOverlayOpen])
  const fitWorldPosById = React.useMemo(
    () => (shouldIgnorePersistedWorldPosForWorkspaceOverlay ? {} : (flowWidgetWorldPosByNodeId || {})),
    [flowWidgetWorldPosByNodeId, shouldIgnorePersistedWorldPosForWorkspaceOverlay],
  )
  const lastOffscreenOverlayRecoveryKeyRef = React.useRef<string | null>(null)
  const buildSceneViewportRecoverySignature = React.useCallback((scene: FlowNativeRuntime['scene'] | null): string => {
    if (!scene || !Array.isArray(scene.nodes) || scene.nodes.length === 0) return 'scene:none'
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let measured = 0
    for (let i = 0; i < scene.nodes.length; i += 1) {
      const node = scene.nodes[i]
      if (!node) continue
      const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : null
      const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : null
      if (x == null || y == null) continue
      measured += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    if (measured <= 0 || !Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return `scene:count=${scene.nodes.length}:unmeasured`
    }
    const q = (v: number) => Math.round(v)
    return `scene:count=${scene.nodes.length}:${q(minX)}:${q(minY)}:${q(maxX)}:${q(maxY)}`
  }, [])
  const resolveVisibleFlowViewportWidth = React.useCallback(() => {
    if (String(canvas2dRenderer || '') !== 'flowEditor') {
      return {
        left: 0,
        top: 0,
        width: viewportW,
        height: viewportH,
      }
    }
    const surfaceViewport = resolveFlowEditorVisibleViewport({
      flowEditorSurfaceId: args.flowEditorSurfaceId,
      viewportW,
      viewportH,
    })
    return {
      left: Math.max(0, Math.min(viewportW, surfaceViewport.left)),
      top: Math.max(0, Math.min(viewportH, surfaceViewport.top)),
      width: Math.max(1, Math.min(viewportW, Math.floor(surfaceViewport.width))),
      height: Math.max(1, Math.min(viewportH, Math.floor(surfaceViewport.height))),
    }
  }, [args.flowEditorSurfaceId, canvas2dRenderer, viewportH, viewportW])
  const remapTransformToVisibleViewport = React.useCallback(
    (
      t: { k: number; x: number; y: number },
      visibleViewport: { left: number; top: number },
    ): { k: number; x: number; y: number } => ({
      k: t.k,
      x: t.x - visibleViewport.left,
      y: t.y - visibleViewport.top,
    }),
    [],
  )
  const isFlowTransformBalancedCollective = React.useCallback((args: {
    t: { k: number; x: number; y: number }
    nodes: Array<{ x?: unknown; y?: unknown }>
    viewportW: number
    viewportH: number
    nodeW: number
    nodeH: number
  }): boolean => {
    const viewportW = Math.max(1, args.viewportW)
    const viewportH = Math.max(1, args.viewportH)
    const nodeW = Math.max(1, args.nodeW)
    const nodeH = Math.max(1, args.nodeH)
    const k = Number.isFinite(args.t.k) ? Math.max(0.001, args.t.k) : 1
    const tx = Number.isFinite(args.t.x) ? args.t.x : 0
    const ty = Number.isFinite(args.t.y) ? args.t.y : 0
    const items: Array<{ left: number; top: number; width: number; height: number }> = []
    for (let i = 0; i < args.nodes.length; i += 1) {
      const node = args.nodes[i]
      const x = typeof node?.x === 'number' && Number.isFinite(node.x) ? node.x : null
      const y = typeof node?.y === 'number' && Number.isFinite(node.y) ? node.y : null
      if (x == null || y == null) continue
      items.push({
        left: x * k + tx,
        top: y * k + ty,
        width: nodeW * k,
        height: nodeH * k,
      })
    }
    if (items.length < 4) return true
    const gapPx = Math.max(16, Math.round(Math.min(nodeW, nodeH) * k * 0.08))
    if (isVerticalOverlayCluster({ items, gapPx })) return false
    if (isHorizontalOverlayStrip({ items, gapPx })) return false
    let minLeft = Number.POSITIVE_INFINITY
    let minTop = Number.POSITIVE_INFINITY
    let maxRight = Number.NEGATIVE_INFINITY
    let maxBottom = Number.NEGATIVE_INFINITY
    let sumCenterX = 0
    let sumCenterY = 0
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!
      minLeft = Math.min(minLeft, item.left)
      minTop = Math.min(minTop, item.top)
      maxRight = Math.max(maxRight, item.left + item.width)
      maxBottom = Math.max(maxBottom, item.top + item.height)
      sumCenterX += item.left + item.width / 2
      sumCenterY += item.top + item.height / 2
    }
    const centroidX = sumCenterX / items.length
    const centroidY = sumCenterY / items.length
    const targetCenterX = viewportW / 2
    const targetCenterY = viewportH / 2
    if (Math.abs(centroidX - targetCenterX) > viewportW * 0.2) return false
    if (Math.abs(centroidY - targetCenterY) > viewportH * 0.24) return false
    const spanW = Math.max(1, maxRight - minLeft)
    const spanH = Math.max(1, maxBottom - minTop)
    const spanAspect = spanW / spanH
    if (items.length >= 5 && spanAspect < 0.42) return false
    return true
  }, [])
  const isFlowTransformCentroidCentered = React.useCallback((args: {
    t: { k: number; x: number; y: number }
    nodes: Array<{ x?: unknown; y?: unknown }>
    viewportW: number
    viewportH: number
    nodeW: number
    nodeH: number
  }): boolean => {
    const viewportW = Math.max(1, args.viewportW)
    const viewportH = Math.max(1, args.viewportH)
    const nodeW = Math.max(1, args.nodeW)
    const nodeH = Math.max(1, args.nodeH)
    const k = Number.isFinite(args.t.k) ? Math.max(0.001, args.t.k) : 1
    const tx = Number.isFinite(args.t.x) ? args.t.x : 0
    const ty = Number.isFinite(args.t.y) ? args.t.y : 0
    let measured = 0
    let sumCenterX = 0
    let sumCenterY = 0
    for (let i = 0; i < args.nodes.length; i += 1) {
      const node = args.nodes[i]
      const x = typeof node?.x === 'number' && Number.isFinite(node.x) ? node.x : null
      const y = typeof node?.y === 'number' && Number.isFinite(node.y) ? node.y : null
      if (x == null || y == null) continue
      measured += 1
      sumCenterX += x * k + tx + (nodeW * k) / 2
      sumCenterY += y * k + ty + (nodeH * k) / 2
    }
    if (measured <= 0) return false
    const centroidX = sumCenterX / measured
    const centroidY = sumCenterY / measured
    const targetCenterX = viewportW / 2
    const targetCenterY = viewportH / 2
    if (Math.abs(centroidX - targetCenterX) > viewportW * 0.28) return false
    if (Math.abs(centroidY - targetCenterY) > viewportH * 0.32) return false
    return true
  }, [])
  const deriveFlowOverlayCollectiveViewportState = React.useCallback((args: {
    bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } | null
    visibleViewport: { left: number; top: number; right: number; bottom: number; width: number; height: number; centerX: number; centerY: number }
  }): { visible: boolean; centered: boolean; balanced: boolean; offscreen: boolean } | null => {
    const bounds = args.bounds
    if (!bounds) return null
    const visibleViewport = args.visibleViewport
    const marginX = Math.max(24, visibleViewport.width * 0.08)
    const marginY = Math.max(24, visibleViewport.height * 0.08)
    const offscreen =
      bounds.maxX <= visibleViewport.left - marginX
      || bounds.maxY <= visibleViewport.top - marginY
      || bounds.minX >= visibleViewport.right + marginX
      || bounds.minY >= visibleViewport.bottom + marginY
    const visible =
      bounds.maxX > visibleViewport.left
      && bounds.maxY > visibleViewport.top
      && bounds.minX < visibleViewport.right
      && bounds.minY < visibleViewport.bottom
    const centroidX = (bounds.minX + bounds.maxX) / 2
    const centroidY = (bounds.minY + bounds.maxY) / 2
    const centered =
      Math.abs(centroidX - visibleViewport.centerX) <= visibleViewport.width * 0.2
      && Math.abs(centroidY - visibleViewport.centerY) <= visibleViewport.height * 0.24
    const spanW = Math.max(1, bounds.width)
    const spanH = Math.max(1, bounds.height)
    const spanAspect = spanW / spanH
    const balanced = centered && spanAspect >= 0.18 && spanAspect <= 6
    return { visible, centered, balanced, offscreen }
  }, [])
  const [workspaceOverlayInteractionFrameTick, setWorkspaceOverlayInteractionFrameTick] = React.useState(0)
  const workspaceOverlayOpenPrevRef = React.useRef(false)
  const workspaceOverlayOpenedAtMsRef = React.useRef(0)
  const workspaceOverlayUserControlledRef = React.useRef(false)
  const workspaceOverlayOffscreenSinceMsRef = React.useRef(0)
  const workspaceOverlayStabilizedRef = React.useRef(false)
  const workspaceOverlayZoomViewKeyRef = React.useRef<string | null>(null)
  const workspaceVisibleViewportSignatureRef = React.useRef<string | null>(null)
  const workspaceVisibleViewportStableTicksRef = React.useRef(0)
  const workspaceDeferredDrawPendingRef = React.useRef(false)
  const workspaceViewportSettleRetryTimeoutRef = React.useRef<number | null>(null)
  const workspaceOffscreenRecoveryRetryTimeoutRef = React.useRef<number | null>(null)
  const clearWorkspaceViewportSettleRetry = React.useCallback(() => {
    const t = workspaceViewportSettleRetryTimeoutRef.current
    if (t == null) return
    workspaceViewportSettleRetryTimeoutRef.current = null
    if (typeof window === 'undefined') return
    window.clearTimeout(t)
  }, [])
  const scheduleWorkspaceViewportSettleRetry = React.useCallback(() => {
    if (typeof window === 'undefined') return
    if (workspaceViewportSettleRetryTimeoutRef.current != null) return
    workspaceViewportSettleRetryTimeoutRef.current = window.setTimeout(() => {
      workspaceViewportSettleRetryTimeoutRef.current = null
      setWorkspaceOverlayInteractionFrameTick(prev => (prev + 1) % 1000000)
    }, 80)
  }, [])
  const clearWorkspaceOffscreenRecoveryRetry = React.useCallback(() => {
    const t = workspaceOffscreenRecoveryRetryTimeoutRef.current
    if (t == null) return
    workspaceOffscreenRecoveryRetryTimeoutRef.current = null
    if (typeof window === 'undefined') return
    window.clearTimeout(t)
  }, [])
  const scheduleWorkspaceOffscreenRecoveryRetry = React.useCallback((delayMs: number) => {
    if (typeof window === 'undefined') return
    if (workspaceOffscreenRecoveryRetryTimeoutRef.current != null) return
    const timeoutMs = Math.max(24, Math.min(1000, Math.floor(delayMs)))
    workspaceOffscreenRecoveryRetryTimeoutRef.current = window.setTimeout(() => {
      workspaceOffscreenRecoveryRetryTimeoutRef.current = null
      setWorkspaceOverlayInteractionFrameTick(prev => (prev + 1) % 1000000)
    }, timeoutMs)
  }, [])
  const deriveExpectedOverlayCollectiveIds = React.useCallback((graphData: any): string[] => {
    const frontmatterOverlayIds = deriveFrontmatterFlowOverlayNodeIds(graphData)
    if (frontmatterOverlayIds.length > 0) return frontmatterOverlayIds
    return Array.from(new Set((openWidgetNodeIds || []).map(id => String(id || '').trim()).filter(Boolean)))
      .sort((leftId, rightId) => leftId.localeCompare(rightId))
  }, [openWidgetNodeIds])
  const isOverlayCollectiveCoverageComplete = React.useCallback((args: {
    graphData: any
    overlayBounds: null | { ids?: string[] }
  }): boolean => {
    const expectedIds = deriveExpectedOverlayCollectiveIds(args.graphData)
    if (expectedIds.length === 0) return true
    const liveIds = Array.isArray(args.overlayBounds?.ids)
      ? args.overlayBounds.ids.map(id => String(id || '').trim()).filter(Boolean)
      : []
    if (liveIds.length === 0) return false
    const liveIdSet = new Set(liveIds)
    for (let i = 0; i < expectedIds.length; i += 1) {
      if (!liveIdSet.has(expectedIds[i]!)) return false
    }
    return true
  }, [deriveExpectedOverlayCollectiveIds])

  React.useEffect(() => {
    if (!active) return
    if (String(canvas2dRenderer || '') !== 'flowEditor') return
    const open = workspaceEditorOverlayOpen === true
    const prev = workspaceOverlayOpenPrevRef.current
    if (open && !prev) {
      workspaceOverlayOpenedAtMsRef.current = Date.now()
      workspaceOverlayUserControlledRef.current = false
      workspaceOverlayStabilizedRef.current = false
      workspaceVisibleViewportSignatureRef.current = null
      workspaceVisibleViewportStableTicksRef.current = 0
      workspaceDeferredDrawPendingRef.current = false
      // Force workspace reopen to re-run init-fit for current zoom view key.
      // This prevents stale offscreen transforms from prior sessions persisting across reopen.
      lastInitTransformZoomViewKeyRef.current = null
      lastOffscreenOverlayRecoveryKeyRef.current = null
      resetFlowCanvasDebugStatus({ dismissToast: true })
      clearWorkspaceViewportSettleRetry()
      clearWorkspaceOffscreenRecoveryRetry()
    }
    if (!open) {
      workspaceOverlayOpenedAtMsRef.current = 0
      workspaceOverlayUserControlledRef.current = false
      workspaceOverlayOffscreenSinceMsRef.current = 0
      workspaceOverlayStabilizedRef.current = false
      workspaceVisibleViewportSignatureRef.current = null
      workspaceVisibleViewportStableTicksRef.current = 0
      workspaceDeferredDrawPendingRef.current = false
      // Drop init/recovery memoization on close so next open starts from fresh fit authority.
      lastInitTransformZoomViewKeyRef.current = null
      lastOffscreenOverlayRecoveryKeyRef.current = null
      resetFlowCanvasDebugStatus({ dismissToast: true })
      clearWorkspaceViewportSettleRetry()
      clearWorkspaceOffscreenRecoveryRetry()
    }
    workspaceOverlayOpenPrevRef.current = open
  }, [active, canvas2dRenderer, clearWorkspaceOffscreenRecoveryRetry, clearWorkspaceViewportSettleRetry, workspaceEditorOverlayOpen])

  React.useEffect(() => {
    if (!active) return
    if (String(canvas2dRenderer || '') !== 'flowEditor') return
    if (workspaceEditorOverlayOpen !== true) return
    const prev = workspaceOverlayZoomViewKeyRef.current
    if (prev != null && prev !== zoomViewKey) {
      // New active graph/view while workspace remains open:
      // drop prior transform authority so init/recovery can re-center this graph.
      workspaceOverlayStabilizedRef.current = false
      workspaceOverlayUserControlledRef.current = false
      workspaceOverlayOffscreenSinceMsRef.current = 0
      workspaceVisibleViewportSignatureRef.current = null
      workspaceVisibleViewportStableTicksRef.current = 0
      workspaceDeferredDrawPendingRef.current = false
      resetFlowCanvasDebugStatus({ dismissToast: true })
      clearWorkspaceViewportSettleRetry()
      clearWorkspaceOffscreenRecoveryRetry()
    }
    workspaceOverlayZoomViewKeyRef.current = zoomViewKey
  }, [active, canvas2dRenderer, clearWorkspaceOffscreenRecoveryRetry, clearWorkspaceViewportSettleRetry, workspaceEditorOverlayOpen, zoomViewKey])

  const isWorkspaceVisibleViewportSettled = React.useCallback((visibleViewport: {
    left: number
    top: number
    width: number
    height: number
  }): boolean => {
    if (workspaceEditorOverlayOpen !== true) return true
    const signature = `${Math.round(visibleViewport.left)}:${Math.round(visibleViewport.top)}:${Math.round(visibleViewport.width)}:${Math.round(visibleViewport.height)}`
    if (workspaceVisibleViewportSignatureRef.current === signature) {
      workspaceVisibleViewportStableTicksRef.current += 1
    } else {
      workspaceVisibleViewportSignatureRef.current = signature
      workspaceVisibleViewportStableTicksRef.current = 0
    }
    return workspaceVisibleViewportStableTicksRef.current >= 1
  }, [workspaceEditorOverlayOpen])
  const shouldDeferWorkspaceOpenDraw = React.useCallback((): boolean => {
    if (String(canvas2dRenderer || '') !== 'flowEditor') return false
    if (workspaceEditorOverlayOpen !== true) return false
    const visibleViewport = resolveVisibleFlowViewportWidth()
    if (isWorkspaceVisibleViewportSettled(visibleViewport)) {
      if (workspaceDeferredDrawPendingRef.current && __flowCanvasDebug.lastRecoveryReason === 'workspace-open-first-draw-deferred-unsettled-viewport') {
        resetFlowCanvasDebugStatus({ dismissToast: true })
      }
      workspaceDeferredDrawPendingRef.current = false
      return false
    }
    workspaceDeferredDrawPendingRef.current = true
    __flowCanvasDebug.lastRecoveryReason = 'workspace-open-first-draw-deferred-unsettled-viewport'
    syncFlowCanvasDebugToast({ enabled: true })
    return true
  }, [
    canvas2dRenderer,
    isWorkspaceVisibleViewportSettled,
    resolveVisibleFlowViewportWidth,
    workspaceEditorOverlayOpen,
  ])
  const shouldSuppressWorkspacePreInitDraw = React.useCallback((): boolean => {
    if (String(canvas2dRenderer || '') !== 'flowEditor') return false
    if (workspaceEditorOverlayOpen !== true) return false
    if (lastInitTransformZoomViewKeyRef.current === zoomViewKey) return false
    const hasRenderableGraphNodes =
      Array.isArray(graphDataForZoomRequests?.nodes)
      && graphDataForZoomRequests.nodes.length > 0
    const frontmatterDocumentModeRequested = isFlowEditorFrontmatterDocumentModeRequested({
      canvas2dRenderer,
      frontmatterModeEnabled,
      documentSemanticMode,
    })
    // Avoid deadlocking first-frame draw in initial workspace-open source-files paths.
    // If graph nodes are already present, allow draw while init-fit is still pending.
    if (hasRenderableGraphNodes && !frontmatterDocumentModeRequested) return false
    __flowCanvasDebug.lastRecoveryReason = 'workspace-open-preinit-draw-suppressed'
    syncFlowCanvasDebugToast({ enabled: true })
    return true
  }, [
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    graphDataForZoomRequests,
    workspaceEditorOverlayOpen,
    zoomViewKey,
    lastInitTransformZoomViewKeyRef,
  ])

  React.useEffect(() => {
    if (!active) return
    if (String(canvas2dRenderer || '') !== 'flowEditor') return
    if (workspaceEditorOverlayOpen !== true) return
    if (!workspaceDeferredDrawPendingRef.current) return
    if (lastInitTransformZoomViewKeyRef.current !== zoomViewKey) return
    const visibleViewport = resolveVisibleFlowViewportWidth()
    if (!isWorkspaceVisibleViewportSettled(visibleViewport)) return
    clearWorkspaceViewportSettleRetry()
    const runtime = runtimeRef.current
    if (!runtime) return
    workspaceDeferredDrawPendingRef.current = false
    scheduleFlowDraw()
  }, [
    active,
    canvas2dRenderer,
    isWorkspaceVisibleViewportSettled,
    resolveVisibleFlowViewportWidth,
    runtimeRef,
    scheduleFlowDraw,
    clearWorkspaceViewportSettleRetry,
    workspaceEditorOverlayOpen,
    workspaceOverlayInteractionFrameTick,
    zoomViewKey,
  ])

  React.useEffect(() => {
    return () => {
      clearWorkspaceViewportSettleRetry()
    }
  }, [clearWorkspaceViewportSettleRetry])

  React.useEffect(() => {
    if (!active) return
    if (String(canvas2dRenderer || '') !== 'flowEditor') return
    if (workspaceEditorOverlayOpen !== true) return
    if (typeof window === 'undefined') return
    const onInteractionFrame = () => {
      setWorkspaceOverlayInteractionFrameTick(prev => (prev + 1) % 1000000)
    }
    window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame)
    return () => {
      window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame)
    }
  }, [active, canvas2dRenderer, workspaceEditorOverlayOpen])

  React.useEffect(() => {
    if (!active) return
    return subscribeFlowResetZoomFloorCache(() => {
      const runtime = runtimeRef.current
      if (runtime) setFlowAutoMinScale(runtime, null)
    })
  }, [active, runtimeRef])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    if (canvas2dRenderer !== 'flowEditor') {
      setFlowAutoMinScale(runtime, null)
      return
    }
    const nodes = Array.isArray(graphDataForZoomRequests?.nodes) ? graphDataForZoomRequests.nodes : []
    if (nodes.length === 0) {
      setFlowAutoMinScale(runtime, null)
      return
    }
    const opts = buildFlowFitOptions({
      schema,
      intent: 'fitToView',
      frontmatterModeEnabled,
      multiDimTableModeEnabled,
      documentSemanticMode,
      documentStructureBaselineLock,
      enableDocumentStructureBounds: true,
      frontmatterFlowInitialFitFillRatio,
    })
    const visibleViewport = resolveVisibleFlowViewportWidth()
    const fit = fitFlowEditorPinnedWidgets({
      nodes,
      fitW: Math.max(1, visibleViewport.width),
      viewportH: Math.max(1, visibleViewport.height),
      viewportW: Math.max(1, visibleViewport.width),
      openWidgetNodeIds,
      pinnedById: flowWidgetPinnedByNodeId || {},
      worldPosById: fitWorldPosById,
      portExtraPadScreenPx: readFlowEditorPortExtraPadScreenPx(schema),
      graphData: graphDataForZoomRequests,
      fitOpts: opts,
      frontmatterOverlayFitProxyScales,
    })
    setFlowAutoMinScale(runtime, typeof fit?.k === 'number' && fit.k > 0 ? fit.k : null)
  }, [
    active,
    canvas2dRenderer,
    documentSemanticMode,
    documentStructureBaselineLock,
    flowEditorReservedW,
    flowWidgetPinnedByNodeId,
    flowWidgetWorldPosByNodeId,
    fitWorldPosById,
    frontmatterModeEnabled,
    frontmatterFlowInitialFitFillRatio,
    frontmatterOverlayFitProxyScales,
    graphDataForZoomRequests,
    multiDimTableModeEnabled,
    openWidgetNodeIds,
    runtimeRef,
    resolveVisibleFlowViewportWidth,
    schema,
    viewportH,
    viewportW,
  ])

  React.useEffect(() => {
    if (!active) return
    lastAppliedPositionsRef.current = null
  }, [active, lastAppliedPositionsRef, zoomViewKey])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime || !computedPositions || lastAppliedPositionsRef.current === computedPositions) return
    lastAppliedPositionsRef.current = computedPositions
    const scene = runtime.scene
    if (!scene) return
    let applied = 0
    for (let i = 0; i < scene.nodes.length; i += 1) {
      const point = computedPositions[scene.nodes[i]!.id]
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
      scene.nodes[i]!.x = point.x
      scene.nodes[i]!.y = point.y
      applied += 1
    }
    if (applied > 0) runtime.positionsReady = true
    runtime.dirty = true
    if (shouldSuppressWorkspacePreInitDraw()) return
    if (shouldDeferWorkspaceOpenDraw()) return
    scheduleFlowDraw()
  }, [active, computedPositions, lastAppliedPositionsRef, runtimeRef, scheduleFlowDraw, shouldDeferWorkspaceOpenDraw, shouldSuppressWorkspacePreInitDraw])

  React.useEffect(() => {
    if (!active) return
    const canvasEl = canvasRef.current
    if (!canvasEl || runtimeRef.current) return
    const initialW = Math.max(1, Math.floor(viewportW * dpr))
    const initialH = Math.max(1, Math.floor(viewportH * dpr))
    if (canvasEl.width !== initialW) canvasEl.width = initialW
    if (canvasEl.height !== initialH) canvasEl.height = initialH
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    runtimeRef.current = createFlowNativeRuntime({
      canvas: canvasEl,
      ctx,
      viewportW,
      viewportH,
      dpr,
      rankdir,
      initialTransform: d3.zoomIdentity,
    })
  }, [active, canvasRef, dpr, rankdir, runtimeRef, viewportH, viewportW])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    setFlowNativeViewport(runtime, { viewportW, viewportH, dpr })
    const nextW = Math.max(1, Math.floor(viewportW * dpr))
    const nextH = Math.max(1, Math.floor(viewportH * dpr))
    const resized = runtime.canvas.width !== nextW || runtime.canvas.height !== nextH
    if (runtime.canvas.width !== nextW) runtime.canvas.width = nextW
    if (runtime.canvas.height !== nextH) runtime.canvas.height = nextH
    if (resized) runtime.dirty = true
    if (shouldSuppressWorkspacePreInitDraw()) return
    if (shouldDeferWorkspaceOpenDraw()) return
    scheduleFlowDraw()
  }, [active, dpr, runtimeRef, scheduleFlowDraw, viewportH, viewportW, shouldDeferWorkspaceOpenDraw, shouldSuppressWorkspacePreInitDraw])

  React.useEffect(() => {
    __flowCanvasDebug.lastZoomViewKey = zoomViewKey
  }, [zoomViewKey])

  React.useEffect(() => {
    const isFlowEditorActive = active && String(canvas2dRenderer || '') === 'flowEditor'
    syncFlowCanvasDebugToast({ enabled: isFlowEditorActive })
  }, [active, canvas2dRenderer])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    const graphDataForFit = graphDataForZoomRequests || graphDataForZoom || sceneGraphData || null
    if (!runtime || !graphDataForFit) return
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    if (documentSemanticMode === 'keyword') {
      const meta = (sceneGraphData?.metadata || null) as Record<string, unknown> | null
      if (meta?.pending === true) return
    }
    const initKey = zoomViewKey
    const alreadyInitializedForKey = lastInitTransformZoomViewKeyRef.current === initKey
    const current = runtime.transform || d3.zoomIdentity
    const hasNonIdentityTransform = current.k !== 1 || current.x !== 0 || current.y !== 0
    if (
      workspaceEditorOverlayOpen !== true
      && lastUserInteractionAtMsRef.current
      && Date.now() - lastUserInteractionAtMsRef.current < 500
    ) return

    const state = useGraphStore.getState()
    const zoomState = pickZoomStateForView({
      zoomViewKey,
      zoomStateByKey: state.zoomStateByKey,
      viewPinned,
      fitToScreenMode,
      zoomToSelectionMode,
    })
    const initial = pickInitialZoomTransform({
      zoomState,
      pinned: viewPinned,
      graphDataRevision,
      nextViewportW: viewportW,
      nextViewportH: viewportH,
    })
    const lateFlowEditorInitAfterSceneBuild =
      isFlowEditor &&
      !alreadyInitializedForKey &&
      !hasNonIdentityTransform &&
      initial == null &&
      lastBuiltGraphKeyRef.current.length > 0
    if (lateFlowEditorInitAfterSceneBuild) {
      // The scene can build before the Flow Editor zoom key is initialized.
      // Continue into fit so the first visible frame does not stay frozen at identity.
      void lastBuiltGraphKeyRef
    }
    const opts = buildFlowFitOptions({
      schema: state.schema,
      intent: fitToScreenMode ? 'fitToScreen' : 'initialFit',
      frontmatterModeEnabled,
      multiDimTableModeEnabled,
      documentSemanticMode,
      documentStructureBaselineLock,
      enableDocumentStructureBounds: false,
    })
    const nodesForFit = Array.isArray(graphDataForFit?.nodes) ? graphDataForFit.nodes : []
    if (isFlowEditor && nodesForFit.length === 0) return
    const visibleViewportFit = resolveVisibleFlowViewportWidth()
    if (!isWorkspaceVisibleViewportSettled(visibleViewportFit)) {
      if (workspaceEditorOverlayOpen === true) {
        __flowCanvasDebug.lastRecoveryReason = 'workspace-open-init-viewport-settle-retry-pending'
        syncFlowCanvasDebugToast({ enabled: true })
        scheduleWorkspaceViewportSettleRetry()
        const canApplyProvisionalWorkspaceInitFit =
          isFlowEditor
          && !alreadyInitializedForKey
          && !hasNonIdentityTransform
        if (canApplyProvisionalWorkspaceInitFit) {
          // Do not stall first visible frame at identity while pane viewport settles.
          // Apply one provisional fit from current viewport metrics; settled retry can refine later.
          const provisionalFitW = Math.max(1, Number(visibleViewportFit.width) > 0 ? visibleViewportFit.width : viewportW)
          const provisionalFitH = Math.max(1, Number(visibleViewportFit.height) > 0 ? visibleViewportFit.height : viewportH)
          const provisionalFitGraphMeta = ((graphDataForFit?.metadata || {}) as Record<string, unknown>)
          const provisionalFitGraphContext = String(graphDataForFit?.context || '').trim()
          const provisionalCanUseFrontmatterCollectiveInitFit =
            String(provisionalFitGraphMeta.kind || '').trim() === 'frontmatter-flow'
            || provisionalFitGraphContext === 'frontmatter-flow'
          const provisionalHasCollectiveFlowWidgets =
            Array.isArray(openWidgetNodeIds) && openWidgetNodeIds.length > 0
          const provisionalHasUsableCollectiveWidgetWorldPos =
            provisionalHasCollectiveFlowWidgets
            && openWidgetNodeIds.some(rawId => {
              const id = String(rawId || '').trim()
              if (!id) return false
              const world = fitWorldPosById[id]
              return !!world && Number.isFinite(world.x) && Number.isFinite(world.y)
            })
          const provisionalCanUseCollectiveInitFit =
            provisionalHasCollectiveFlowWidgets || provisionalCanUseFrontmatterCollectiveInitFit
          const provisionalPinnedById =
            provisionalHasCollectiveFlowWidgets
              ? openWidgetNodeIds.reduce<Record<string, boolean>>((acc, rawId) => {
                  const id = String(rawId || '').trim()
                  if (!id) return acc
                  acc[id] = true
                  return acc
                }, { ...(flowWidgetPinnedByNodeId || {}) })
              : (flowWidgetPinnedByNodeId || {})
          const provisionalUseD3StyleInitFit =
            workspaceEditorOverlayOpen === true
            && (
              !provisionalCanUseCollectiveInitFit
              || (
                !provisionalCanUseFrontmatterCollectiveInitFit
                && provisionalHasCollectiveFlowWidgets
                && !provisionalHasUsableCollectiveWidgetWorldPos
              )
            )
          const provisionalFit = provisionalUseD3StyleInitFit
            ? fitAllTransform(
                nodesForFit,
                provisionalFitW,
                provisionalFitH,
                { ...opts, graphData: graphDataForFit || undefined },
              )
            : fitFlowEditorPinnedWidgets({
                nodes: nodesForFit,
                fitW: provisionalFitW,
                viewportH: provisionalFitH,
                viewportW: provisionalFitW,
                openWidgetNodeIds,
                pinnedById: provisionalPinnedById,
                worldPosById: fitWorldPosById,
                portExtraPadScreenPx: readFlowEditorPortExtraPadScreenPx(state.schema),
                graphData: graphDataForFit,
                fitOpts: opts,
                frontmatterOverlayFitProxyScales,
              })
          const next = d3.zoomIdentity
            .translate(
              provisionalFit.x + (provisionalUseD3StyleInitFit ? 0 : visibleViewportFit.left),
              provisionalFit.y + (provisionalUseD3StyleInitFit ? 0 : visibleViewportFit.top),
            )
            .scale(provisionalFit.k)
          lastInitTransformZoomViewKeyRef.current = initKey
          if (
            Math.abs(current.k - next.k) > 1e-9
            || Math.abs(current.x - next.x) > 1e-6
            || Math.abs(current.y - next.y) > 1e-6
          ) {
            cancelFlowZoomRequestAnim(runtime)
            setFlowNativeTransform(runtime, next)
            requestFlowNativeDraw(runtime, buildDrawArgs())
          }
          requestCommit()
        }
      }
      return
    }
    clearWorkspaceViewportSettleRetry()
    const fitReferenceFrame = resolveFitReferenceFrame({
      viewportW: visibleViewportFit.width,
      viewportH: visibleViewportFit.height,
      referenceWidth: viewportFitReferenceWidth,
      referenceHeight: viewportFitReferenceHeight,
    })
    const fitW = Math.max(1, fitReferenceFrame.width)
    const fitH = Math.max(1, fitReferenceFrame.height)
    const initFitGraphMeta = ((graphDataForFit?.metadata || {}) as Record<string, unknown>)
    const initFitGraphContext = String(graphDataForFit?.context || '').trim()
    const initVisibleViewport = {
      left: visibleViewportFit.left,
      top: visibleViewportFit.top,
      right: visibleViewportFit.left + visibleViewportFit.width,
      bottom: visibleViewportFit.top + visibleViewportFit.height,
      width: visibleViewportFit.width,
      height: visibleViewportFit.height,
      centerX: visibleViewportFit.left + visibleViewportFit.width / 2,
      centerY: visibleViewportFit.top + visibleViewportFit.height / 2,
    }
    const initOverlayCollectiveState = isFlowEditor
      ? deriveFlowOverlayCollectiveViewportState({
          bounds: collectFlowEditorOverlayBounds(String(args.flowEditorSurfaceId || '')),
          visibleViewport: initVisibleViewport,
        })
      : null
    const initOverlayBounds = isFlowEditor ? collectFlowEditorOverlayBounds(String(args.flowEditorSurfaceId || '')) : null
    const initOverlayCollectiveCoverageComplete = isFlowEditor
      ? isOverlayCollectiveCoverageComplete({
          graphData: graphDataForFit,
          overlayBounds: initOverlayBounds,
        })
      : true
    const canUseFrontmatterCollectiveInitFit =
      String(initFitGraphMeta.kind || '').trim() === 'frontmatter-flow'
      || initFitGraphContext === 'frontmatter-flow'
    const collectiveOverlayFitIds = isFlowEditor ? deriveExpectedOverlayCollectiveIds(graphDataForFit) : []
    const hasCollectiveFlowWidgets = isFlowEditor && collectiveOverlayFitIds.length > 0
    const canUseCollectiveInitFit = hasCollectiveFlowWidgets || canUseFrontmatterCollectiveInitFit
    const hasUsableCollectiveWidgetWorldPos = hasCollectiveFlowWidgets && collectiveOverlayFitIds.some(rawId => {
      const id = String(rawId || '').trim()
      if (!id) return false
      const world = fitWorldPosById[id]
      return !!world && Number.isFinite(world.x) && Number.isFinite(world.y)
    })
    const effectivePinnedByIdForInitFit =
      hasCollectiveFlowWidgets && workspaceEditorOverlayOpen === true
        ? collectiveOverlayFitIds.reduce<Record<string, boolean>>((acc, rawId) => {
            const id = String(rawId || '').trim()
            if (!id) return acc
            acc[id] = true
            return acc
          }, { ...(flowWidgetPinnedByNodeId || {}) })
        : (flowWidgetPinnedByNodeId || {})
    const useD3StyleInitFit =
      isFlowEditor
      && workspaceEditorOverlayOpen === true
      && (
        !canUseCollectiveInitFit
        || (
          !canUseFrontmatterCollectiveInitFit
          && hasCollectiveFlowWidgets
          && !hasUsableCollectiveWidgetWorldPos
        )
      )
    const fit = isFlowEditor
      ? (
        useD3StyleInitFit
          ? fitAllTransform(nodesForFit, fitW, fitH, { ...opts, graphData: graphDataForFit || undefined })
          : fitFlowEditorPinnedWidgets({
              nodes: nodesForFit,
              fitW,
              viewportH: fitH,
              viewportW: fitW,
              openWidgetNodeIds,
              pinnedById: effectivePinnedByIdForInitFit,
              worldPosById: fitWorldPosById,
              portExtraPadScreenPx: readFlowEditorPortExtraPadScreenPx(state.schema),
              graphData: graphDataForFit,
              fitOpts: opts,
              frontmatterOverlayFitProxyScales,
            })
      )
      : fitAllTransform(nodesForFit, fitW, fitH, { ...opts, graphData: graphDataForFit || undefined })
    const fitSeed = isFlowEditor
      ? {
          k: fit.k,
          x: fit.x + (useD3StyleInitFit ? 0 : visibleViewportFit.left),
          y: fit.y + (useD3StyleInitFit ? 0 : visibleViewportFit.top),
        }
      : fit
    const isUsableFlowTransform = (t: d3.ZoomTransform | null | undefined): boolean => {
      if (!isFlowEditor || !t) return true
      if (
        workspaceEditorOverlayOpen === true
        && t === current
        && initOverlayCollectiveState
        && (initOverlayCollectiveState.visible !== true || initOverlayCollectiveState.offscreen === true)
      ) {
        return false
      }
      const normalizedTransform = remapTransformToVisibleViewport(
        { k: t.k, x: t.x, y: t.y },
        visibleViewportFit,
      )
      if (collectiveOverlayFitIds.length > 0) {
        const k = Number.isFinite(normalizedTransform.k) ? Math.max(0.001, normalizedTransform.k) : 1
        const tx = Number.isFinite(normalizedTransform.x) ? normalizedTransform.x : 0
        const ty = Number.isFinite(normalizedTransform.y) ? normalizedTransform.y : 0
        let measured = 0
        let minLeft = Number.POSITIVE_INFINITY
        let minTop = Number.POSITIVE_INFINITY
        let maxRight = Number.NEGATIVE_INFINITY
        let maxBottom = Number.NEGATIVE_INFINITY
        for (let i = 0; i < collectiveOverlayFitIds.length; i += 1) {
          const nodeId = String(collectiveOverlayFitIds[i] || '').trim()
          if (!nodeId) continue
          const world = fitWorldPosById[nodeId]
          if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
          measured += 1
          const left = world.x * k + tx
          const top = world.y * k + ty
          const right = left + flowConfigEffective.node.widthPx * k
          const bottom = top + flowConfigEffective.node.heightPx * k
          minLeft = Math.min(minLeft, left)
          minTop = Math.min(minTop, top)
          maxRight = Math.max(maxRight, right)
          maxBottom = Math.max(maxBottom, bottom)
        }
        if (measured > 0) {
          const inViewport =
            maxRight >= -fitW * 0.2
            && minLeft <= fitW * 1.2
            && maxBottom >= -fitH * 0.2
            && minTop <= fitH * 1.2
          if (!inViewport) return false
        }
      }
      return isFlowTransformShowingGraph(
        normalizedTransform,
        {
          nodes: nodesForFit as Array<{ x?: unknown; y?: unknown }>,
          viewportW: fitW,
          viewportH: fitH,
          nodeW: flowConfigEffective.node.widthPx,
          nodeH: flowConfigEffective.node.heightPx,
        },
      )
    }
    const currentTransformUsable = isUsableFlowTransform(current)
    if (isFlowEditor && alreadyInitializedForKey && workspaceEditorOverlayOpen !== true && currentTransformUsable) return
    if (
      isFlowEditor
      && alreadyInitializedForKey
      && workspaceEditorOverlayOpen === true
      && hasNonIdentityTransform
      && currentTransformUsable
      && initOverlayCollectiveCoverageComplete
      && (workspaceOverlayStabilizedRef.current || workspaceOverlayUserControlledRef.current)
    ) {
      // Preserve only if current transform remains usable/visible.
      // If it drifted offscreen, re-apply init fit instead of requiring manual drag-back.
      return
    }
    if (!isFlowEditor && alreadyInitializedForKey && hasNonIdentityTransform) return
    const preserveCurrentTransform =
      !fitToScreenMode &&
      !zoomToSelectionMode &&
      workspaceEditorOverlayOpen !== true &&
      hasNonIdentityTransform &&
      isUsableFlowTransform(current)
    const initialTransform = initial ? d3.zoomIdentity.translate(initial.x, initial.y).scale(initial.k) : null
    const initialTransformUsable = isUsableFlowTransform(initialTransform)
    const shouldUseInitialTransform = workspaceEditorOverlayOpen !== true && initialTransformUsable && !!initialTransform
    const seed = shouldUseInitialTransform
      ? (initialTransform as d3.ZoomTransform)
      : preserveCurrentTransform
        ? current
        : d3.zoomIdentity.translate(fitSeed.x, fitSeed.y).scale(fitSeed.k)
    const next = d3.zoomIdentity.translate(seed.x, seed.y).scale(seed.k)
    lastInitTransformZoomViewKeyRef.current = initKey
    if (Math.abs(current.k - next.k) > 1e-9 || Math.abs(current.x - next.x) > 1e-6 || Math.abs(current.y - next.y) > 1e-6) {
      cancelFlowZoomRequestAnim(runtime)
      setFlowNativeTransform(runtime, next)
      requestFlowNativeDraw(runtime, buildDrawArgs())
    }
    requestCommit()
  }, [
    active,
    canvas2dRenderer,
    documentSemanticMode,
    documentStructureBaselineLock,
    fitToScreenMode,
    flowEditorReservedW,
    flowConfigEffective.node.heightPx,
    flowConfigEffective.node.widthPx,
    flowWidgetPinnedByNodeId,
    flowWidgetWorldPosByNodeId,
    viewportFitReferenceHeight,
    viewportFitReferenceWidth,
    frontmatterModeEnabled,
    graphDataForZoom,
    graphDataForZoomRequests,
    graphDataRevision,
    lastBuiltGraphKeyRef,
    lastInitTransformZoomViewKeyRef,
    lastUserInteractionAtMsRef,
    multiDimTableModeEnabled,
    openWidgetNodeIds,
    buildDrawArgs,
    requestCommit,
    runtimeRef,
    sceneGraphData,
    viewPinned,
    viewportH,
    viewportW,
    zoomToSelectionMode,
    zoomViewKey,
    resolveVisibleFlowViewportWidth,
    isWorkspaceVisibleViewportSettled,
    clearWorkspaceViewportSettleRetry,
    scheduleWorkspaceViewportSettleRetry,
    workspaceEditorOverlayOpen,
    workspaceOverlayInteractionFrameTick,
    isOverlayCollectiveCoverageComplete,
  ])

  React.useEffect(() => {
    if (!active) return
    if (String(canvas2dRenderer || '') !== 'flowEditor') return
    const overlayOpen = workspaceEditorOverlayOpen === true
    const runtime = runtimeRef.current
    const scene = runtime?.scene
    if (!runtime) return

    const surfaceViewport = resolveFlowEditorVisibleViewport({
      flowEditorSurfaceId: args.flowEditorSurfaceId,
      viewportW,
      viewportH,
    })
    const overlayBounds = collectFlowEditorOverlayBounds(String(args.flowEditorSurfaceId || ''))
    const overlayCollectiveState = deriveFlowOverlayCollectiveViewportState({
      bounds: overlayBounds,
      visibleViewport: surfaceViewport,
    })
    const overlayCollectiveNeedsRecovery = overlayCollectiveState?.offscreen === true || (!!overlayCollectiveState && overlayCollectiveState.visible && !overlayCollectiveState.balanced && !overlayCollectiveState.centered)
    const allowOverlayCentroidRecovery = !overlayOpen && ((!scene || scene.nodes.length === 0) || overlayCollectiveNeedsRecovery)
    if (overlayBounds && allowOverlayCentroidRecovery) {
      const overlayCentroidX = (overlayBounds.minX + overlayBounds.maxX) / 2
      const overlayCentroidY = (overlayBounds.minY + overlayBounds.maxY) / 2
      const deltaX = surfaceViewport.centerX - overlayCentroidX
      const deltaY = surfaceViewport.centerY - overlayCentroidY
      if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
        if (Date.now() - lastUserInteractionAtMsRef.current < 500) return
        const overlayRecoveryKey = `overlay:${Math.round(overlayBounds.minX)}:${Math.round(overlayBounds.maxX)}:${Math.round(overlayBounds.minY)}:${Math.round(overlayBounds.maxY)}:${Math.round(surfaceViewport.width)}:${Math.round(surfaceViewport.height)}`
        if (lastOffscreenOverlayRecoveryKeyRef.current !== overlayRecoveryKey) {
          const current = runtime.transform || d3.zoomIdentity
          const next = d3.zoomIdentity.translate(current.x + deltaX, current.y + deltaY).scale(current.k)
          cancelFlowZoomRequestAnim(runtime)
          setFlowNativeTransform(runtime, next)
          requestFlowNativeDraw(runtime, buildDrawArgs())
          requestCommit()
          lastOffscreenOverlayRecoveryKeyRef.current = overlayRecoveryKey
        }
      }
    }
    if (!overlayOpen) {
      lastOffscreenOverlayRecoveryKeyRef.current = null
      return
    }
    if (!scene || scene.nodes.length === 0) return
    if (workspaceEditorOverlayOpen && lastInitTransformZoomViewKeyRef.current !== zoomViewKey) {
      __flowCanvasDebug.lastRecoveryReason = 'workspace-open-preinit-recovery-suppressed'
      syncFlowCanvasDebugToast({ enabled: true })
      return
    }

    const visibleViewport = resolveVisibleFlowViewportWidth()
    if (!isWorkspaceVisibleViewportSettled(visibleViewport)) {
      __flowCanvasDebug.lastRecoveryReason = 'workspace-open-viewport-settle-pending'
      syncFlowCanvasDebugToast({ enabled: true })
      return
    }
    const fitReferenceFrame = resolveFitReferenceFrame({
      viewportW: visibleViewport.width,
      viewportH: visibleViewport.height,
      referenceWidth: viewportFitReferenceWidth,
      referenceHeight: viewportFitReferenceHeight,
    })
    const fitW = Math.max(1, fitReferenceFrame.width)
    const fitH = Math.max(1, fitReferenceFrame.height)
    const current = runtime.transform || d3.zoomIdentity
    const normalizedCurrent = remapTransformToVisibleViewport(
      { k: current.k, x: current.x, y: current.y },
      visibleViewport,
    )
    const graphVisible = isFlowTransformShowingGraph(
      normalizedCurrent,
      {
        nodes: scene.nodes as Array<{ x?: unknown; y?: unknown }>,
        viewportW: fitW,
        viewportH: fitH,
        nodeW: flowConfigEffective.node.widthPx,
        nodeH: flowConfigEffective.node.heightPx,
      },
    )
    const graphBalanced = isFlowTransformBalancedCollective({
      t: normalizedCurrent,
      nodes: scene.nodes as Array<{ x?: unknown; y?: unknown }>,
      viewportW: fitW,
      viewportH: fitH,
      nodeW: flowConfigEffective.node.widthPx,
      nodeH: flowConfigEffective.node.heightPx,
    })
    const graphCentered = isFlowTransformCentroidCentered({
      t: normalizedCurrent,
      nodes: scene.nodes as Array<{ x?: unknown; y?: unknown }>,
      viewportW: fitW,
      viewportH: fitH,
      nodeW: flowConfigEffective.node.widthPx,
      nodeH: flowConfigEffective.node.heightPx,
    })
    const collectiveVisible = overlayCollectiveState?.visible ?? graphVisible
    const collectiveBalanced = overlayCollectiveState?.balanced ?? graphBalanced
    const collectiveCentered = overlayCollectiveState?.centered ?? graphCentered
    const recoveryGraphData = graphDataForZoomRequests || graphDataForZoom || sceneGraphData || null
    const overlayCollectiveCoverageComplete = isOverlayCollectiveCoverageComplete({
      graphData: recoveryGraphData,
      overlayBounds,
    })
    if (!overlayCollectiveCoverageComplete) {
      workspaceOverlayStabilizedRef.current = false
      lastOffscreenOverlayRecoveryKeyRef.current = null
    }
    const recoveryGraphMeta = (recoveryGraphData?.metadata || {}) as Record<string, unknown>
    const recoveryGraphContext = String(recoveryGraphData?.context || '').trim()
    const recoveryCollectiveOverlayFitIds = deriveExpectedOverlayCollectiveIds(recoveryGraphData)
    const recoveryHasCollectiveFlowWidgets = recoveryCollectiveOverlayFitIds.length > 0
    const recoveryCanUseCollectiveOverlayFit =
      recoveryHasCollectiveFlowWidgets
      || String(recoveryGraphMeta.kind || '').trim() === 'frontmatter-flow'
      || recoveryGraphContext === 'frontmatter-flow'
    const useD3StyleRecoveryFit =
      workspaceEditorOverlayOpen === true
      && !recoveryCanUseCollectiveOverlayFit
    const effectivePinnedByIdForRecoveryFit =
      workspaceEditorOverlayOpen === true && recoveryCollectiveOverlayFitIds.length > 0
        ? recoveryCollectiveOverlayFitIds.reduce<Record<string, boolean>>((acc, rawId) => {
            const id = String(rawId || '').trim()
            if (!id) return acc
            acc[id] = true
            return acc
          }, { ...(flowWidgetPinnedByNodeId || {}) })
        : (flowWidgetPinnedByNodeId || {})
    if (workspaceEditorOverlayOpen) {
      if (collectiveVisible) {
        workspaceOverlayOffscreenSinceMsRef.current = 0
        clearWorkspaceOffscreenRecoveryRetry()
      } else if (workspaceOverlayOffscreenSinceMsRef.current <= 0) {
        workspaceOverlayOffscreenSinceMsRef.current = Date.now()
      }
    } else {
      workspaceOverlayOffscreenSinceMsRef.current = 0
      clearWorkspaceOffscreenRecoveryRetry()
    }
    const fitOffsetX = useD3StyleRecoveryFit ? 0 : visibleViewport.left
    const fitOffsetY = useD3StyleRecoveryFit ? 0 : visibleViewport.top
    let expectedFitForRecovery: { x: number; y: number; k: number } | null = null
    const getExpectedFitForRecovery = () => {
      if (expectedFitForRecovery) return expectedFitForRecovery
      const fitOpts = buildFlowFitOptions({
        schema: schema || null,
        intent: fitToScreenMode ? 'fitToScreen' : 'fitToView',
        frontmatterModeEnabled,
        documentSemanticMode,
        multiDimTableModeEnabled,
        documentStructureBaselineLock,
      })
      expectedFitForRecovery = useD3StyleRecoveryFit
        ? fitAllTransform(
            scene.nodes as any,
            fitW,
            fitH,
            { ...fitOpts, graphData: recoveryGraphData || undefined },
          )
        : fitFlowEditorPinnedWidgets({
            nodes: scene.nodes as any,
            graphData: recoveryGraphData,
            viewportW: fitW,
            viewportH: fitH,
            fitW,
            fitOpts: fitOpts,
            openWidgetNodeIds,
            pinnedById: effectivePinnedByIdForRecoveryFit,
            worldPosById: fitWorldPosById,
            portExtraPadScreenPx: readFlowEditorPortExtraPadScreenPx(schema || null),
            frontmatterOverlayFitProxyScales,
          })
      return expectedFitForRecovery
    }
    const expectedFit = getExpectedFitForRecovery()
    const expectedScreenX = expectedFit.x + fitOffsetX
    const expectedScreenY = expectedFit.y + fitOffsetY
    const transformDriftedFromFit =
      Math.abs(current.x - expectedScreenX) > fitW * 0.18
      || Math.abs(current.y - expectedScreenY) > fitH * 0.22
      || Math.abs(Math.log(Math.max(0.001, current.k) / Math.max(0.001, expectedFit.k))) > 0.16
    __flowCanvasDebug.lastRuntimeTransform = `${Math.round(current.x)},${Math.round(current.y)},${Math.round(current.k * 1000) / 1000}`
    __flowCanvasDebug.lastExpectedFit = `${Math.round(expectedScreenX)},${Math.round(expectedScreenY)},${Math.round(expectedFit.k * 1000) / 1000}`
    if (workspaceEditorOverlayOpen && collectiveVisible && overlayCollectiveCoverageComplete && (collectiveBalanced || collectiveCentered) && workspaceOverlayStabilizedRef.current) {
      __flowCanvasDebug.lastRecoveryReason = 'workspace-open-stabilized-preserve-current'
      syncFlowCanvasDebugToast({ enabled: true })
      lastOffscreenOverlayRecoveryKeyRef.current = null
      return
    }
    if (workspaceEditorOverlayOpen && collectiveVisible && overlayCollectiveCoverageComplete && (collectiveBalanced || collectiveCentered)) {
      // Preserve already-visible centroid-centered transforms while the workspace overlay is open.
      workspaceOverlayStabilizedRef.current = true
      __flowCanvasDebug.lastRecoveryReason = collectiveBalanced
        ? 'workspace-open-visible-balanced-preserve-current'
        : 'workspace-open-visible-centered-preserve-current'
      syncFlowCanvasDebugToast({ enabled: true })
      lastOffscreenOverlayRecoveryKeyRef.current = null
      return
    }
    if (collectiveVisible && collectiveBalanced && !transformDriftedFromFit) {
      __flowCanvasDebug.lastRecoveryReason = 'stable-visible-balanced'
      syncFlowCanvasDebugToast({ enabled: true })
      lastOffscreenOverlayRecoveryKeyRef.current = null
      return
    }
    const interactionRecentMs = Date.now() - lastUserInteractionAtMsRef.current
    const interactionInProgress = interactionRecentMs < 520
    const pointerInteractionAfterWorkspaceOpen =
      workspaceEditorOverlayOpen
      && workspaceOverlayOpenedAtMsRef.current > 0
      && (lastPointerInCanvasRef.current?.ts || 0) > workspaceOverlayOpenedAtMsRef.current + 24
    const userInteractionAfterWorkspaceOpen =
      workspaceEditorOverlayOpen
      && workspaceOverlayOpenedAtMsRef.current > 0
      && lastUserInteractionAtMsRef.current > workspaceOverlayOpenedAtMsRef.current + 24
      && pointerInteractionAfterWorkspaceOpen
    if (userInteractionAfterWorkspaceOpen) workspaceOverlayUserControlledRef.current = true
    const flowWidgetDraggingNodeId = String(useGraphStore.getState().flowWidgetDraggingNodeId || '').trim()
    const flowWidgetDragging = flowWidgetDraggingNodeId.length > 0
    if (workspaceEditorOverlayOpen && collectiveVisible && workspaceOverlayUserControlledRef.current) {
      __flowCanvasDebug.lastRecoveryReason = 'workspace-open-user-controlled-preserve-current'
      syncFlowCanvasDebugToast({ enabled: true })
      lastOffscreenOverlayRecoveryKeyRef.current = null
      return
    }
    const shouldBypassWorkspaceOffscreenDebounce = overlayCollectiveState?.offscreen === true
    const workspaceOffscreenDebounced =
      !workspaceEditorOverlayOpen
      || collectiveVisible
      || shouldBypassWorkspaceOffscreenDebounce
      || (
        workspaceOverlayOffscreenSinceMsRef.current > 0
        && (Date.now() - workspaceOverlayOffscreenSinceMsRef.current) >= 360
      )
    if (workspaceEditorOverlayOpen && !collectiveVisible && !workspaceOffscreenDebounced) {
      const remainingMs = Math.max(24, 360 - Math.max(0, Date.now() - workspaceOverlayOffscreenSinceMsRef.current))
      scheduleWorkspaceOffscreenRecoveryRetry(remainingMs)
      __flowCanvasDebug.lastRecoveryReason = 'workspace-open-offscreen-debounce-pending'
      syncFlowCanvasDebugToast({ enabled: true })
      return
    }
    // Do not force-fit while user is actively panning/zooming/dragging in Workspace.
    // Recovery still runs immediately after interaction settles.
    if (interactionInProgress || flowWidgetDragging) return

    const graphKey = buildGraphMetaKeyIgnoringPending(sceneGraphData)
    const sceneViewportSignature = buildSceneViewportRecoverySignature(scene)
    const currentTransformSignature = `${Math.round(current.x)}:${Math.round(current.y)}:${Math.round(current.k * 1000)}`
    const recoveryKey = `${graphKey}:${fitW}:${fitH}:${Math.round(visibleViewport.left)}:${Math.round(visibleViewport.top)}:${sceneViewportSignature}:${currentTransformSignature}`
    const shouldRecenterOverlayCollective = !collectiveVisible || overlayCollectiveState?.offscreen === true || (workspaceEditorOverlayOpen && overlayCollectiveCoverageComplete && !collectiveBalanced && !collectiveCentered)
    const shouldLatchRecoveryKey = collectiveVisible && overlayCollectiveCoverageComplete && !shouldRecenterOverlayCollective
    if (shouldLatchRecoveryKey && lastOffscreenOverlayRecoveryKeyRef.current === recoveryKey) return

    const fit = expectedFitForRecovery || getExpectedFitForRecovery()
    __flowCanvasDebug.lastRecoveryReason = collectiveVisible
      ? (collectiveBalanced ? 'drifted-from-fit' : 'visible-unbalanced-shape')
      : 'offscreen'
    syncFlowCanvasDebugToast({ enabled: true })
    cancelFlowZoomRequestAnim(runtime)
    setFlowNativeTransform(
      runtime,
      d3.zoomIdentity
        .translate(fit.x + fitOffsetX, fit.y + fitOffsetY)
        .scale(fit.k),
    )
    if (shouldRecenterOverlayCollective) {
      recenterVisibleFlowEditorOverlayCentroid({
        runtime,
        viewportW,
        viewportH,
        flowEditorSurfaceId: args.flowEditorSurfaceId,
        graphData: recoveryGraphData,
        onFrame: () => {
          requestFlowNativeDraw(runtime, buildDrawArgs())
          requestCommit()
        },
      })
    }
    if (workspaceEditorOverlayOpen && collectiveVisible && (collectiveBalanced || collectiveCentered)) workspaceOverlayStabilizedRef.current = true
    requestFlowNativeDraw(runtime, buildDrawArgs())
    requestCommit()
    lastOffscreenOverlayRecoveryKeyRef.current = shouldLatchRecoveryKey ? recoveryKey : null
  }, [
    active,
    args.flowEditorSurfaceId,
    buildDrawArgs,
    canvas2dRenderer,
    documentSemanticMode,
    documentStructureBaselineLock,
    fitToScreenMode,
    flowConfigEffective.node.heightPx,
    flowConfigEffective.node.widthPx,
    flowEditorReservedW,
    flowWidgetPinnedByNodeId,
    flowWidgetWorldPosByNodeId,
    fitWorldPosById,
    frontmatterModeEnabled,
    graphDataForZoom,
    graphDataForZoomRequests,
    graphDataRevision,
    lastUserInteractionAtMsRef,
    multiDimTableModeEnabled,
    openWidgetNodeIds,
    requestCommit,
    runtimeRef,
    sceneGraphData,
    schema,
    viewPinned,
    viewportH,
    viewportW,
    zoomViewKey,
    zoomToSelectionMode,
    resolveVisibleFlowViewportWidth,
    isWorkspaceVisibleViewportSettled,
    remapTransformToVisibleViewport,
    deriveFlowOverlayCollectiveViewportState,
    isOverlayCollectiveCoverageComplete,
    isFlowTransformBalancedCollective,
    isFlowTransformCentroidCentered,
    buildSceneViewportRecoverySignature,
    workspaceOverlayInteractionFrameTick,
    workspaceEditorOverlayOpen,
    clearWorkspaceOffscreenRecoveryRetry,
    scheduleWorkspaceOffscreenRecoveryRetry,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    const graphKey = `${buildGraphMetaKeyIgnoringPending(sceneGraphData)}:${sceneGraphData?.nodes?.length || 0}:${sceneGraphData?.edges?.length || 0}:${layoutVariant}`
    if (graphKey === lastBuiltGraphKeyRef.current && (runtime.scene?.nodes.length || 0) > 0) return
    lastBuiltGraphKeyRef.current = graphKey
    __flowCanvasDebug.lastBuiltSceneKey = graphKey
    runtime.positionsReady = computedPositions != null
    const result = buildAndSetFlowNativeScene({
      runtime,
      graphData: sceneGraphData,
      positions: computedPositions || seededFallbackPositions,
      schema,
      forbidCircleNodes,
      flowConfig: flowConfigEffective,
      sceneGroups,
      rankdir,
      widgetRegistry,
    })
    __flowCanvasDebug.lastBuiltSceneNodeCount = result.nodeCount
    if (shouldSuppressWorkspacePreInitDraw()) return
    if (shouldDeferWorkspaceOpenDraw()) return
    scheduleFlowDraw()
  }, [
    active,
    computedPositions,
    flowConfigEffective,
    forbidCircleNodes,
    graphDataRevision,
    lastBuiltGraphKeyRef,
    layoutVariant,
    rankdir,
    runtimeRef,
    sceneGraphData,
    sceneGroups,
    scheduleFlowDraw,
    schema,
    seededFallbackPositions,
    shouldDeferWorkspaceOpenDraw,
    shouldSuppressWorkspacePreInitDraw,
    widgetRegistry,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    setFlowNativePresentation(runtime, flowPresentation)
    if (shouldSuppressWorkspacePreInitDraw()) return
    if (shouldDeferWorkspaceOpenDraw()) return
    scheduleFlowDraw()
  }, [active, flowPresentation, runtimeRef, scheduleFlowDraw, shouldDeferWorkspaceOpenDraw, shouldSuppressWorkspacePreInitDraw])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    const canvasEl = canvasRef.current
    if (!runtime || !canvasEl) return
    return bindFlowCanvasNativeInteractions({
      active,
      flowEditorSurfaceId: args.flowEditorSurfaceId,
      canvasEl,
      runtime,
      viewportControlsPreset,
      selectionOnDrag: canvas2dRenderer === 'flowEditor' && flowEditorSelectionOnDrag === true,
      allowNodeDragOverride,
      collisionDuringDrag: computeCollisionDuringDrag({
        collisionDuringDrag: collisionDuringDrag === true,
        canvas2dRenderer: String(canvas2dRenderer || ''),
      }),
      requestCommit,
      buildDrawArgs,
      setSelectionBox: requestSetSelectionBox,
      onInteractionFrame: handleInteractionFrame,
      dragRef,
      lastPointerInCanvasRef,
      lastWheelIntentRef,
      zoomWheelGuardRef,
      userSelectLockPointerIdRef,
      positionsDirtySinceCommitRef,
      collisionSchemaRef,
      collisionGraphDataRef,
      collisionFlowConfigRef,
      collisionPresentationRef,
    })
  }, [
    active,
    allowNodeDragOverride,
    buildDrawArgs,
    canvas2dRenderer,
    canvasRef,
    args.flowEditorSurfaceId,
    collisionDuringDrag,
    flowEditorSelectionOnDrag,
    handleInteractionFrame,
    requestCommit,
    requestSetSelectionBox,
    runtimeRef,
    viewportControlsPreset,
    collisionFlowConfigRef,
    collisionGraphDataRef,
    collisionPresentationRef,
    collisionSchemaRef,
    dragRef,
    lastPointerInCanvasRef,
    lastWheelIntentRef,
    positionsDirtySinceCommitRef,
    userSelectLockPointerIdRef,
    zoomWheelGuardRef,
  ])
}
