import React from 'react'
import * as d3 from 'd3'

import {
  cancelFlowZoomRequestAnim,
  collectFlowEditorOverlayBounds,
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
import { buildFlowCanvasNativeSceneKey } from '@/components/FlowCanvas/flowCanvasNativeSceneKey'
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
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import {
  buildWorkspaceVisibleViewportFitRecoveryKey,
  computeWorkspaceOverlayVisibleViewportFitTransform,
  deriveFlowOverlayCollectiveViewportState,
  FLOW_EDITOR_WORKSPACE_RECOVERY_MAX_VISUAL_SCALE,
} from '@/components/FlowCanvas/workspaceVisibleViewportRecovery'

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
  const isFiniteZoomTransform = (t: d3.ZoomTransform | null | undefined): t is d3.ZoomTransform =>
    !!t && Number.isFinite(t.k) && Number.isFinite(t.x) && Number.isFinite(t.y)
  const resolveVisibleFlowViewportWidth = React.useCallback(() => {
    if (String(canvas2dRenderer || '') !== 'flowEditor') {
      return {
        left: 0,
        top: 0,
        right: viewportW,
        bottom: viewportH,
        width: viewportW,
        height: viewportH,
        centerX: viewportW / 2,
        centerY: viewportH / 2,
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
      right: Math.max(1, Math.min(viewportW, surfaceViewport.right)),
      bottom: Math.max(1, Math.min(viewportH, surfaceViewport.bottom)),
      width: Math.max(1, Math.min(viewportW, Math.floor(surfaceViewport.width))),
      height: Math.max(1, Math.min(viewportH, Math.floor(surfaceViewport.height))),
      centerX: Math.max(0, Math.min(viewportW, surfaceViewport.centerX)),
      centerY: Math.max(0, Math.min(viewportH, surfaceViewport.centerY)),
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
  const [workspaceOverlayInteractionFrameTick, setWorkspaceOverlayInteractionFrameTick] = React.useState(0)
  const workspaceOverlayOpenPrevRef = React.useRef(false)
  const workspaceOverlayOpenedAtMsRef = React.useRef(0)
  const workspaceOverlayUserControlledRef = React.useRef(false)
  const workspaceOverlayStabilizedRef = React.useRef(false)
  const workspaceOverlayZoomViewKeyRef = React.useRef<string | null>(null)
  const workspaceVisibleViewportSignatureRef = React.useRef<string | null>(null)
  const workspaceVisibleViewportStableTicksRef = React.useRef(0)
  const workspaceDeferredDrawPendingRef = React.useRef(false)
  const workspaceVisibleViewportFitRecoveryKeyRef = React.useRef<string | null>(null)
  const workspaceViewportSettleRetryTimeoutRef = React.useRef<number | null>(null)
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
  const fitWorkspaceOverlayBoundsToVisibleViewport = React.useCallback((fitArgs: {
    runtime: FlowNativeRuntime
    overlayBounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number; ids?: string[] }
    visibleViewport: { left: number; top: number; width: number; height: number; centerX: number; centerY: number }
  }): boolean => {
    const { runtime, overlayBounds, visibleViewport } = fitArgs
    const recoveryKey = buildWorkspaceVisibleViewportFitRecoveryKey({
      zoomViewKey,
      visibleViewport,
      overlayBounds,
    })
    if (workspaceVisibleViewportFitRecoveryKeyRef.current === recoveryKey) return false
    workspaceVisibleViewportFitRecoveryKeyRef.current = recoveryKey
    const current = runtime.transform || d3.zoomIdentity
    const [schemaMinK, schemaMaxK] = schema ? readZoomScaleExtent(schema) : [0.000001, FLOW_EDITOR_WORKSPACE_RECOVERY_MAX_VISUAL_SCALE]
    const nextTransform = computeWorkspaceOverlayVisibleViewportFitTransform({
      current,
      overlayBounds,
      visibleViewport,
      scaleExtent: [schemaMinK, schemaMaxK],
      maxVisualScale: FLOW_EDITOR_WORKSPACE_RECOVERY_MAX_VISUAL_SCALE,
    })
    if (!nextTransform) return false
    const next = d3.zoomIdentity.translate(nextTransform.x, nextTransform.y).scale(nextTransform.k)
    __flowCanvasDebug.lastRecoveryReason = 'workspace-open-visible-viewport-bounds-fit'
    __flowCanvasDebug.lastExpectedFit = 'visible-viewport:overlay-bounds-fit'
    syncFlowCanvasDebugToast({ enabled: true })
    cancelFlowZoomRequestAnim(runtime)
    setFlowNativeTransform(runtime, next)
    requestFlowNativeDraw(runtime, buildDrawArgs())
    requestCommit()
    scheduleWorkspaceViewportSettleRetry()
    return true
  }, [buildDrawArgs, requestCommit, scheduleWorkspaceViewportSettleRetry, schema, zoomViewKey])

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
      workspaceVisibleViewportFitRecoveryKeyRef.current = null
      // Workspace open must preserve current transform authority. Explicit
      // fit/reset actions own viewport fitting; ordinary pan/zoom stays infinite.
      if (lastInitTransformZoomViewKeyRef.current !== zoomViewKey) lastInitTransformZoomViewKeyRef.current = null
      resetFlowCanvasDebugStatus({ dismissToast: true })
      clearWorkspaceViewportSettleRetry()
    }
    if (!open) {
      workspaceOverlayOpenedAtMsRef.current = 0
      workspaceOverlayUserControlledRef.current = false
      workspaceOverlayStabilizedRef.current = false
      workspaceVisibleViewportSignatureRef.current = null
      workspaceVisibleViewportStableTicksRef.current = 0
      workspaceDeferredDrawPendingRef.current = false
      workspaceVisibleViewportFitRecoveryKeyRef.current = null
      // Keep the initialized Flow Editor transform through close. Reopen owns the
      // fresh-fit reset; closing must not trigger a canvas-side refit.
      resetFlowCanvasDebugStatus({ dismissToast: true })
      clearWorkspaceViewportSettleRetry()
    }
    workspaceOverlayOpenPrevRef.current = open
  }, [active, canvas2dRenderer, clearWorkspaceViewportSettleRetry, workspaceEditorOverlayOpen, zoomViewKey])

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
      workspaceVisibleViewportSignatureRef.current = null
      workspaceVisibleViewportStableTicksRef.current = 0
      workspaceDeferredDrawPendingRef.current = false
      workspaceVisibleViewportFitRecoveryKeyRef.current = null
      resetFlowCanvasDebugStatus({ dismissToast: true })
      clearWorkspaceViewportSettleRetry()
    }
    workspaceOverlayZoomViewKeyRef.current = zoomViewKey
  }, [active, canvas2dRenderer, clearWorkspaceViewportSettleRetry, workspaceEditorOverlayOpen, zoomViewKey])

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
  const hasWorkspaceCanvasUserInteractionAfterOpen = React.useCallback((): boolean => {
    const pointerInteractionAfterWorkspaceOpen =
      workspaceEditorOverlayOpen === true
      && workspaceOverlayOpenedAtMsRef.current > 0
      && (lastPointerInCanvasRef.current?.ts || 0) > workspaceOverlayOpenedAtMsRef.current + 24
    const userInteractionAfterWorkspaceOpen =
      workspaceEditorOverlayOpen === true
      && workspaceOverlayOpenedAtMsRef.current > 0
      && lastUserInteractionAtMsRef.current > workspaceOverlayOpenedAtMsRef.current + 24
      && pointerInteractionAfterWorkspaceOpen
    return userInteractionAfterWorkspaceOpen
  }, [lastPointerInCanvasRef, lastUserInteractionAtMsRef, workspaceEditorOverlayOpen])
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
    if (hasWorkspaceCanvasUserInteractionAfterOpen()) workspaceOverlayUserControlledRef.current = true
    if (
      isFlowEditor
      && workspaceEditorOverlayOpen === true
      && hasNonIdentityTransform
      && (alreadyInitializedForKey || workspaceOverlayUserControlledRef.current)
    ) {
      __flowCanvasDebug.lastRuntimeTransform = `${Math.round(current.x)},${Math.round(current.y)},${Math.round(current.k * 1000) / 1000}`
      __flowCanvasDebug.lastExpectedFit = 'infinite-canvas:user-controlled-or-initialized'
      __flowCanvasDebug.lastRecoveryReason = workspaceOverlayUserControlledRef.current
        ? 'workspace-open-user-controlled-init-preserve-current'
        : 'workspace-open-initialized-init-preserve-current'
      syncFlowCanvasDebugToast({ enabled: true })
      lastInitTransformZoomViewKeyRef.current = initKey
      return
    }
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
    const isReusableFlowTransform = (t: d3.ZoomTransform | null | undefined): boolean => {
      if (!isFiniteZoomTransform(t)) return false
      if (isFlowEditor) return true
      return isFlowTransformShowingGraph(
        { k: t.k, x: t.x, y: t.y },
        {
          nodes: nodesForFit as Array<{ x?: unknown; y?: unknown }>,
          viewportW: fitW,
          viewportH: fitH,
          nodeW: flowConfigEffective.node.widthPx,
          nodeH: flowConfigEffective.node.heightPx,
        },
      )
    }
    if (isFlowEditor && alreadyInitializedForKey && workspaceEditorOverlayOpen !== true && hasNonIdentityTransform) return
    if (!isFlowEditor && alreadyInitializedForKey && hasNonIdentityTransform) return
    const preserveCurrentTransform =
      !fitToScreenMode &&
      !zoomToSelectionMode &&
      workspaceEditorOverlayOpen !== true &&
      hasNonIdentityTransform &&
      isReusableFlowTransform(current)
    const initialTransform = initial ? d3.zoomIdentity.translate(initial.x, initial.y).scale(initial.k) : null
    const initialTransformUsable = isReusableFlowTransform(initialTransform)
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
    hasWorkspaceCanvasUserInteractionAfterOpen,
    clearWorkspaceViewportSettleRetry,
    scheduleWorkspaceViewportSettleRetry,
    workspaceEditorOverlayOpen,
    workspaceOverlayInteractionFrameTick,
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
    if (!overlayOpen) return
    const visibleViewport = resolveVisibleFlowViewportWidth()
    if (!isWorkspaceVisibleViewportSettled(visibleViewport)) {
      __flowCanvasDebug.lastRecoveryReason = 'workspace-open-viewport-settle-pending'
      syncFlowCanvasDebugToast({ enabled: true })
      return
    }
    const userInteractionAfterWorkspaceOpen = hasWorkspaceCanvasUserInteractionAfterOpen()
    if (userInteractionAfterWorkspaceOpen) workspaceOverlayUserControlledRef.current = true
    if (workspaceEditorOverlayOpen && workspaceOverlayUserControlledRef.current) {
      __flowCanvasDebug.lastRecoveryReason = overlayCollectiveState?.visible === true
        ? 'workspace-open-user-controlled-preserve-current'
        : 'workspace-open-user-controlled-infinite-canvas-preserve-current'
      syncFlowCanvasDebugToast({ enabled: true })
      return
    }
    const overlayOnlyNeedsVisibleViewportFit =
      !!overlayBounds
      && (
        overlayCollectiveState?.visible !== true
        || (overlayCollectiveState.balanced !== true && overlayCollectiveState.centered !== true)
      )
    if (overlayOnlyNeedsVisibleViewportFit && overlayBounds && fitWorkspaceOverlayBoundsToVisibleViewport({ runtime, overlayBounds, visibleViewport })) return
    if (!scene || scene.nodes.length === 0) return
    if (workspaceEditorOverlayOpen && lastInitTransformZoomViewKeyRef.current !== zoomViewKey && !overlayBounds) {
      __flowCanvasDebug.lastRecoveryReason = 'workspace-open-preinit-recovery-suppressed'
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
    __flowCanvasDebug.lastRuntimeTransform = `${Math.round(current.x)},${Math.round(current.y)},${Math.round(current.k * 1000) / 1000}`
    __flowCanvasDebug.lastExpectedFit = 'infinite-canvas:preserve-current'
    if (workspaceEditorOverlayOpen && collectiveVisible && overlayCollectiveCoverageComplete && (collectiveBalanced || collectiveCentered) && workspaceOverlayStabilizedRef.current) {
      __flowCanvasDebug.lastRecoveryReason = 'workspace-open-stabilized-preserve-current'
      syncFlowCanvasDebugToast({ enabled: true })
      return
    }
    if (workspaceEditorOverlayOpen && collectiveVisible && overlayCollectiveCoverageComplete && (collectiveBalanced || collectiveCentered)) {
      // Preserve already-visible centroid-centered transforms while the workspace overlay is open.
      workspaceOverlayStabilizedRef.current = true
      __flowCanvasDebug.lastRecoveryReason = collectiveBalanced
        ? 'workspace-open-visible-balanced-preserve-current'
        : 'workspace-open-visible-centered-preserve-current'
      syncFlowCanvasDebugToast({ enabled: true })
      return
    }
    if (collectiveVisible && collectiveBalanced) {
      __flowCanvasDebug.lastRecoveryReason = 'stable-visible-balanced'
      syncFlowCanvasDebugToast({ enabled: true })
      return
    }
    const shouldFitOverlayCollectiveToVisibleViewport =
      workspaceEditorOverlayOpen
      && !!overlayBounds
      && (
        !collectiveVisible
        || (!collectiveBalanced && !collectiveCentered)
      )
    if (shouldFitOverlayCollectiveToVisibleViewport && overlayBounds && fitWorkspaceOverlayBoundsToVisibleViewport({ runtime, overlayBounds, visibleViewport })) return
    __flowCanvasDebug.lastRecoveryReason = collectiveVisible
      ? 'workspace-open-visible-infinite-canvas-preserve-current'
      : 'workspace-open-offscreen-visible-viewport-refit-pending'
    syncFlowCanvasDebugToast({ enabled: true })
    if (workspaceEditorOverlayOpen && collectiveVisible && (collectiveBalanced || collectiveCentered)) workspaceOverlayStabilizedRef.current = true
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
    frontmatterModeEnabled,
    graphDataForZoom,
    graphDataForZoomRequests,
    graphDataRevision,
    lastPointerInCanvasRef,
    lastUserInteractionAtMsRef,
    multiDimTableModeEnabled,
    runtimeRef,
    sceneGraphData,
    zoomViewKey,
    resolveVisibleFlowViewportWidth,
    isWorkspaceVisibleViewportSettled,
    remapTransformToVisibleViewport,
    isOverlayCollectiveCoverageComplete,
    hasWorkspaceCanvasUserInteractionAfterOpen,
    fitWorkspaceOverlayBoundsToVisibleViewport,
    isFlowTransformBalancedCollective,
    isFlowTransformCentroidCentered,
    workspaceOverlayInteractionFrameTick,
    workspaceEditorOverlayOpen,
    requestCommit,
    schema,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    const graphKey = buildFlowCanvasNativeSceneKey({ sceneGraphData, layoutVariant, rankdir, flowConfig: flowConfigEffective, forbidCircleNodes, sceneGroups })
    const inputHasNativeSceneContent =
      (Array.isArray(sceneGraphData?.nodes) && sceneGraphData.nodes.length > 0)
      || (Array.isArray(sceneGraphData?.edges) && sceneGraphData.edges.length > 0)
      || (Array.isArray(sceneGroups) && sceneGroups.length > 0)
    const runtimeScene = runtime.scene
    const runtimeHasNativeSceneContent =
      (Array.isArray(runtimeScene?.nodes) && runtimeScene.nodes.length > 0)
      || (Array.isArray(runtimeScene?.edges) && runtimeScene.edges.length > 0)
      || (Array.isArray(runtimeScene?.groups) && runtimeScene.groups.length > 0)
    if (graphKey === lastBuiltGraphKeyRef.current && inputHasNativeSceneContent === runtimeHasNativeSceneContent) return
    const nativeSceneContentRemoved = !inputHasNativeSceneContent && runtimeHasNativeSceneContent
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
    if (nativeSceneContentRemoved) {
      requestFlowNativeDraw(runtime, buildDrawArgs())
      return
    }
    if (shouldSuppressWorkspacePreInitDraw()) return
    if (shouldDeferWorkspaceOpenDraw()) return
    scheduleFlowDraw()
  }, [
    active,
    buildDrawArgs,
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
