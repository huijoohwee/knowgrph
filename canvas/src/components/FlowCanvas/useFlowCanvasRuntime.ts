import React from 'react'
import * as d3 from 'd3'

import { bindFlowCanvasNativeInteractions, type FlowCanvasDrag } from '@/components/FlowCanvas/bindNativeInteractions'
import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { computeCollisionDuringDrag } from '@/components/FlowCanvas/collisionPolicy'
import { __flowCanvasDebug } from '@/components/FlowCanvas/flowCanvasDebug'
import { setFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { fitFlowEditorPinnedWidgets } from '@/components/FlowCanvas/fitPinnedWidgets'
import { buildFlowFitOptions, readFlowEditorPortExtraPadScreenPx } from '@/components/FlowCanvas/fitRuntime'
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
    })
    const fit = fitFlowEditorPinnedWidgets({
      nodes,
      fitW: Math.max(1, viewportW - flowEditorReservedW),
      viewportH,
      viewportW,
      openWidgetNodeIds,
      pinnedById: flowWidgetPinnedByNodeId || {},
      worldPosById: flowWidgetWorldPosByNodeId || {},
      portExtraPadScreenPx: readFlowEditorPortExtraPadScreenPx(schema),
      graphData: graphDataForZoomRequests,
      fitOpts: opts,
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
    frontmatterModeEnabled,
    graphDataForZoomRequests,
    multiDimTableModeEnabled,
    openWidgetNodeIds,
    runtimeRef,
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
    const runtime = runtimeRef.current
    const transform = runtime?.transform || null
    __flowCanvasDebug.lastRuntimeTransform =
      transform && Number.isFinite(transform.k) && Number.isFinite(transform.x) && Number.isFinite(transform.y)
        ? { k: transform.k, x: transform.x, y: transform.y }
        : null
    const trackedSceneWorldById: Record<string, { x: number; y: number }> = {}
    const trackedStoredWorldById: Record<string, { x: number; y: number }> = {}
    const sceneNodeById = runtime?.scene?.nodeById || null
    const openIds = Array.isArray(openWidgetNodeIds) ? openWidgetNodeIds : []
    for (let i = 0; i < openIds.length; i += 1) {
      const id = String(openIds[i] || '').trim()
      if (!id) continue
      const sceneNode = sceneNodeById?.get(id) || null
      if (sceneNode && Number.isFinite(sceneNode.x) && Number.isFinite(sceneNode.y)) {
        trackedSceneWorldById[id] = { x: sceneNode.x, y: sceneNode.y }
      }
      const stored = flowWidgetWorldPosByNodeId?.[id]
      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
        trackedStoredWorldById[id] = { x: stored.x, y: stored.y }
      }
    }
    __flowCanvasDebug.trackedOpenWidgetSceneWorldById = trackedSceneWorldById
    __flowCanvasDebug.trackedOpenWidgetStoredWorldById = trackedStoredWorldById
  }, [flowWidgetWorldPosByNodeId, openWidgetNodeIds, runtimeRef, viewportH, viewportW, zoomViewKey])

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
    if (isFlowEditor && alreadyInitializedForKey) return
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
      lastInitTransformZoomViewKeyRef.current = initKey
      return
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
    const fitW = Math.max(1, viewportW - (isFlowEditor ? flowEditorReservedW : 0))
    const fit = isFlowEditor
      ? fitFlowEditorPinnedWidgets({
          nodes: nodesForFit,
          fitW,
          viewportH,
          viewportW,
          openWidgetNodeIds,
          pinnedById: flowWidgetPinnedByNodeId || {},
          worldPosById: flowWidgetWorldPosByNodeId || {},
          portExtraPadScreenPx: readFlowEditorPortExtraPadScreenPx(state.schema),
          graphData: graphDataForZoomRequests,
          fitOpts: opts,
        })
      : fitAllTransform(nodesForFit, fitW, viewportH, { ...opts, graphData: graphDataForZoomRequests || undefined })
    const seed = initial || (!fitToScreenMode && !zoomToSelectionMode && hasNonIdentityTransform ? { k: current.k, x: current.x, y: current.y } : fit)
    const next = d3.zoomIdentity.translate(seed.x, seed.y).scale(seed.k)
    lastInitTransformZoomViewKeyRef.current = initKey
    if (Math.abs(current.k - next.k) > 1e-9 || Math.abs(current.x - next.x) > 1e-6 || Math.abs(current.y - next.y) > 1e-6) {
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
