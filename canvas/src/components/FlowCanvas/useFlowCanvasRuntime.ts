import React from 'react'
import * as d3 from 'd3'

import { cancelFlowZoomRequestAnim, collectFlowEditorOverlayBounds, resolveFlowEditorVisibleViewport } from '@/components/FlowCanvas/applyZoomRequestNative'
import { bindFlowCanvasNativeInteractions, type FlowCanvasDrag } from '@/components/FlowCanvas/bindNativeInteractions'
import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { computeCollisionDuringDrag } from '@/components/FlowCanvas/collisionPolicy'
import { __flowCanvasDebug, syncFlowCanvasDebugToast } from '@/components/FlowCanvas/flowCanvasDebug'
import { setFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { fitFlowEditorPinnedWidgets } from '@/components/FlowCanvas/fitPinnedWidgets'
import { buildFlowFitOptions, readFlowEditorPortExtraPadScreenPx } from '@/components/FlowCanvas/fitRuntime'
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
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT } from '@/lib/canvas/flow-editor-overlay-proxy'
import { isHorizontalOverlayStrip, isVerticalOverlayCluster } from '@/lib/ui/overlayBalancedSpread'

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
    return kind === 'frontmatter-flow'
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
  const [workspaceOverlayInteractionFrameTick, setWorkspaceOverlayInteractionFrameTick] = React.useState(0)

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
    scheduleFlowDraw()
  }, [active, computedPositions, lastAppliedPositionsRef, runtimeRef, scheduleFlowDraw])

  React.useEffect(() => {
    if (!active) return
    const canvasEl = canvasRef.current
    if (!canvasEl || runtimeRef.current) return
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
    scheduleFlowDraw()
  }, [active, dpr, runtimeRef, scheduleFlowDraw, viewportH, viewportW])

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
    if (!runtime || !graphDataForZoom) return
    const isFlowEditor = canvas2dRenderer === 'flowEditor'
    if (documentSemanticMode === 'keyword') {
      const meta = (sceneGraphData?.metadata || null) as Record<string, unknown> | null
      if (meta?.pending === true) return
    }
    const initKey = zoomViewKey
    const alreadyInitializedForKey = lastInitTransformZoomViewKeyRef.current === initKey
    const current = runtime.transform || d3.zoomIdentity
    const hasNonIdentityTransform = current.k !== 1 || current.x !== 0 || current.y !== 0
    if (isFlowEditor && alreadyInitializedForKey && workspaceEditorOverlayOpen !== true) return
    if (!isFlowEditor && alreadyInitializedForKey && hasNonIdentityTransform) return
    if (lastUserInteractionAtMsRef.current && Date.now() - lastUserInteractionAtMsRef.current < 500) return

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
    const nodesForFit = Array.isArray(graphDataForZoomRequests?.nodes) ? graphDataForZoomRequests.nodes : []
    if (isFlowEditor && nodesForFit.length === 0) return
    const visibleViewportFit = resolveVisibleFlowViewportWidth()
    const fitW = Math.max(1, visibleViewportFit.width)
    const fitH = Math.max(1, visibleViewportFit.height)
    const useD3StyleInitFit = isFlowEditor && workspaceEditorOverlayOpen === true
    const fit = isFlowEditor
      ? (
        useD3StyleInitFit
          ? fitAllTransform(nodesForFit, fitW, fitH, { ...opts, graphData: graphDataForZoomRequests || undefined })
          : fitFlowEditorPinnedWidgets({
              nodes: nodesForFit,
              fitW,
              viewportH: fitH,
              viewportW: fitW,
              openWidgetNodeIds,
              pinnedById: flowWidgetPinnedByNodeId || {},
              worldPosById: fitWorldPosById,
              portExtraPadScreenPx: readFlowEditorPortExtraPadScreenPx(state.schema),
              graphData: graphDataForZoomRequests,
              fitOpts: opts,
            })
      )
      : fitAllTransform(nodesForFit, fitW, fitH, { ...opts, graphData: graphDataForZoomRequests || undefined })
    const fitSeed = isFlowEditor
      ? {
          k: fit.k,
          x: fit.x + (useD3StyleInitFit ? 0 : visibleViewportFit.left),
          y: fit.y + (useD3StyleInitFit ? 0 : visibleViewportFit.top),
        }
      : fit
    const isUsableFlowTransform = (t: d3.ZoomTransform | null | undefined): boolean => {
      if (!isFlowEditor || !t) return true
      const normalizedTransform = remapTransformToVisibleViewport(
        { k: t.k, x: t.x, y: t.y },
        visibleViewportFit,
      )
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
    const preserveCurrentTransform =
      !fitToScreenMode &&
      !zoomToSelectionMode &&
      workspaceEditorOverlayOpen !== true &&
      hasNonIdentityTransform &&
      isUsableFlowTransform(current)
    const initialTransformUsable = isUsableFlowTransform(initial)
    const shouldUseInitialTransform = workspaceEditorOverlayOpen !== true && initialTransformUsable
    const seed = (shouldUseInitialTransform ? initial : null) || (preserveCurrentTransform ? { k: current.k, x: current.x, y: current.y } : fitSeed)
    const next = d3.zoomIdentity.translate(seed.x, seed.y).scale(seed.k)
    lastInitTransformZoomViewKeyRef.current = initKey
    if (Math.abs(current.k - next.k) > 1e-9 || Math.abs(current.x - next.x) > 1e-6 || Math.abs(current.y - next.y) > 1e-6) {
      cancelFlowZoomRequestAnim(runtime)
      setFlowNativeTransform(runtime, next)
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
    frontmatterModeEnabled,
    graphDataForZoom,
    graphDataForZoomRequests,
    graphDataRevision,
    lastBuiltGraphKeyRef,
    lastInitTransformZoomViewKeyRef,
    lastUserInteractionAtMsRef,
    multiDimTableModeEnabled,
    openWidgetNodeIds,
    requestCommit,
    runtimeRef,
    sceneGraphData,
    viewPinned,
    viewportH,
    viewportW,
    zoomToSelectionMode,
    zoomViewKey,
    resolveVisibleFlowViewportWidth,
    workspaceEditorOverlayOpen,
  ])

  React.useEffect(() => {
    if (!active) return
    if (String(canvas2dRenderer || '') !== 'flowEditor') return
    const overlayOpen = workspaceEditorOverlayOpen === true
    const runtime = runtimeRef.current
    const scene = runtime?.scene
    if (!runtime) return

    const allowOverlayCentroidRecovery = !overlayOpen && (!scene || scene.nodes.length === 0)
    const surfaceViewport = resolveFlowEditorVisibleViewport({
      flowEditorSurfaceId: args.flowEditorSurfaceId,
      viewportW,
      viewportH,
    })
    const overlayBounds = collectFlowEditorOverlayBounds(String(args.flowEditorSurfaceId || ''))
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

    const visibleViewport = resolveVisibleFlowViewportWidth()
    const fitW = Math.max(1, visibleViewport.width)
    const fitH = Math.max(1, visibleViewport.height)
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
    const useD3StyleRecoveryFit = workspaceEditorOverlayOpen === true
    const fitOffsetX = useD3StyleRecoveryFit ? 0 : visibleViewport.left
    const fitOffsetY = useD3StyleRecoveryFit ? 0 : visibleViewport.top
    let expectedFitForRecovery: { x: number; y: number; k: number } | null = null
    const getExpectedFitForRecovery = () => {
      if (expectedFitForRecovery) return expectedFitForRecovery
      const fitOpts = buildFlowFitOptions({
        schema: schema || null,
        frontmatterModeEnabled,
        documentSemanticMode,
        multiDimTableModeEnabled,
        documentStructureBaselineLock,
        graphData: graphDataForZoomRequests || graphDataForZoom || sceneGraphData,
        isFlowEditor: true,
      })
      expectedFitForRecovery = useD3StyleRecoveryFit
        ? fitAllTransform(
            scene.nodes,
            fitW,
            fitH,
            { ...fitOpts, graphData: graphDataForZoomRequests || graphDataForZoom || sceneGraphData },
          )
        : fitFlowEditorPinnedWidgets({
            nodes: scene.nodes,
            graphData: graphDataForZoomRequests || graphDataForZoom || sceneGraphData,
            viewportW: fitW,
            viewportH: fitH,
            nodeSize: { widthPx: flowConfigEffective.node.widthPx, heightPx: flowConfigEffective.node.heightPx },
            fitOptions: fitOpts,
            openWidgetNodeIds,
            pinnedByNodeId: flowWidgetPinnedByNodeId,
            worldPosByNodeId: fitWorldPosById,
            portExtraPadScreenPx: readFlowEditorPortExtraPadScreenPx(schema || null),
            graphRevision: graphDataRevision,
            fitToScreenMode,
            zoomToSelectionMode,
            includeWidgetsForPinMode: viewPinned === true,
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
    if (graphVisible && graphBalanced && !transformDriftedFromFit) {
      __flowCanvasDebug.lastRecoveryReason = 'stable-visible-balanced'
      syncFlowCanvasDebugToast({ enabled: true })
      lastOffscreenOverlayRecoveryKeyRef.current = null
      return
    }
    const interactionRecentMs = Date.now() - lastUserInteractionAtMsRef.current
    const interactionInProgress = interactionRecentMs < 520
    const flowWidgetDraggingNodeId = String(useGraphStore.getState().flowWidgetDraggingNodeId || '').trim()
    const flowWidgetDragging = flowWidgetDraggingNodeId.length > 0
    // Do not force-fit while user is actively panning/zooming/dragging in Workspace.
    // Recovery still runs immediately after interaction settles.
    if (interactionInProgress || flowWidgetDragging) return

    const graphKey = buildGraphMetaKeyIgnoringPending(sceneGraphData)
    const sceneViewportSignature = buildSceneViewportRecoverySignature(scene)
    const currentTransformSignature = `${Math.round(current.x)}:${Math.round(current.y)}:${Math.round(current.k * 1000)}`
    const recoveryKey = `${graphKey}:${fitW}:${fitH}:${Math.round(visibleViewport.left)}:${Math.round(visibleViewport.top)}:${sceneViewportSignature}:${currentTransformSignature}`
    if (lastOffscreenOverlayRecoveryKeyRef.current === recoveryKey) return

    const fit = expectedFitForRecovery || getExpectedFitForRecovery()
    __flowCanvasDebug.lastRecoveryReason = graphVisible
      ? (graphBalanced ? 'drifted-from-fit' : 'visible-unbalanced-shape')
      : 'offscreen'
    syncFlowCanvasDebugToast({ enabled: true })
    cancelFlowZoomRequestAnim(runtime)
    setFlowNativeTransform(
      runtime,
      d3.zoomIdentity
        .translate(fit.x + fitOffsetX, fit.y + fitOffsetY)
        .scale(fit.k),
    )
    requestFlowNativeDraw(runtime, buildDrawArgs())
    requestCommit()
    lastOffscreenOverlayRecoveryKeyRef.current = recoveryKey
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
    zoomToSelectionMode,
    resolveVisibleFlowViewportWidth,
    remapTransformToVisibleViewport,
    isFlowTransformBalancedCollective,
    buildSceneViewportRecoverySignature,
    workspaceOverlayInteractionFrameTick,
    workspaceEditorOverlayOpen,
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
    widgetRegistry,
  ])

  React.useEffect(() => {
    if (!active) return
    const runtime = runtimeRef.current
    if (!runtime) return
    setFlowNativePresentation(runtime, flowPresentation)
    scheduleFlowDraw()
  }, [active, flowPresentation, runtimeRef, scheduleFlowDraw])

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
