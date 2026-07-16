import * as d3 from 'd3'
import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useContainerDims } from '@/hooks/useContainerDims'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { createInfiniteCanvasViewportController } from '@/lib/canvas/infinite-canvas-engine'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { shouldIgnoreCanvasWheelEvent } from '@/lib/canvas/wheel-target-guard'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { UI_SELECTORS } from '@/lib/config'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import {
  buildStoryboardTransform,
  buildStoryboardTransformCss,
  buildStoryboardTransformKey,
  isSameStoryboardTransform,
  readStoryboardInfiniteMetrics,
  resolveStoryboardPaintScale,
} from '@/components/StoryboardCanvas/storyboardInfiniteZoomMetrics'
import { resolveStoryboardInfiniteZoomRequestTransform } from '@/components/StoryboardCanvas/storyboardInfiniteZoomRequest'

export function useStoryboardInfiniteZoom(args: {
  active: boolean
  graphData: GraphData | null
}) {
  const boardViewportRef = React.useRef<HTMLElement | null>(null)
  const [viewportElement, setViewportElementState] = React.useState<HTMLElement | null>(null)
  const setViewportElement = React.useCallback((element: HTMLElement | null) => {
    boardViewportRef.current = element
    setViewportElementState(prev => (prev === element ? prev : element))
  }, [])
  const dims = useContainerDims(boardViewportRef)
  const contentRef = React.useRef<HTMLElement | null>(null)
  const hasUserInteractedRef = React.useRef(false)
  const lastInitialFitKeyRef = React.useRef<string | null>(null)
  const transformRef = React.useRef<d3.ZoomTransform>(buildStoryboardTransform(null))
  const transformRenderFrameRef = React.useRef<number | null>(null)
  const [transform, setTransform] = React.useState<d3.ZoomTransform>(() => transformRef.current)
  const [metrics, setMetrics] = React.useState(() => readStoryboardInfiniteMetrics(null, 1))
  const {
    canvas2dRenderer,
    canvasInteractionSpeedMultiplier,
    canvasPanSpeedMultiplier,
    canvasPointerMode2d,
    canvasRenderMode,
    clearZoomRequest,
    collapsedGroupIds,
    documentSemanticMode,
    documentStructureBaselineLock,
    flowWheelZoomIncrementMultiplier,
    flowWheelZoomSmoothMaxDurationMs,
    flowWheelZoomSmoothMinDurationMs,
    flowWheelZoomSpeedMultiplier,
    frontmatterModeEnabled,
    graphDataRevision,
    mediaPanelDensity,
    multiDimTableModeEnabled,
    renderMediaAsNodes,
    schema,
    setZoomState,
    setZoomStateForKey,
    viewPinned,
    viewportControlsPreset,
    viewportFitFillRatio,
    wheelZoomCtrlMetaBoostMultiplier,
    zoomDurationFitMs,
    zoomDurationSelectionMs,
    zoomRequest,
    zoomState,
    zoomStateByKey,
  } = useGraphStore(
    useShallow(state => ({
      canvas2dRenderer: state.canvas2dRenderer,
      canvasInteractionSpeedMultiplier: state.canvasInteractionSpeedMultiplier,
      canvasPanSpeedMultiplier: state.canvasPanSpeedMultiplier,
      canvasPointerMode2d: state.canvasPointerMode2d,
      canvasRenderMode: state.canvasRenderMode,
      clearZoomRequest: state.clearZoomRequest,
      collapsedGroupIds: state.collapsedGroupIds,
      documentSemanticMode: state.documentSemanticMode,
      documentStructureBaselineLock: state.documentStructureBaselineLock,
      flowWheelZoomIncrementMultiplier: state.flowWheelZoomIncrementMultiplier,
      flowWheelZoomSmoothMaxDurationMs: state.flowWheelZoomSmoothMaxDurationMs,
      flowWheelZoomSmoothMinDurationMs: state.flowWheelZoomSmoothMinDurationMs,
      flowWheelZoomSpeedMultiplier: state.flowWheelZoomSpeedMultiplier,
      frontmatterModeEnabled: state.frontmatterModeEnabled,
      graphDataRevision: state.graphDataRevision || 0,
      mediaPanelDensity: state.mediaPanelDensity,
      multiDimTableModeEnabled: state.multiDimTableModeEnabled,
      renderMediaAsNodes: state.renderMediaAsNodes,
      schema: state.schema,
      setZoomState: state.setZoomState,
      setZoomStateForKey: state.setZoomStateForKey,
      viewPinned: state.viewPinned === true,
      viewportControlsPreset: state.viewportControlsPreset,
      viewportFitFillRatio: state.viewportFitFillRatio,
      wheelZoomCtrlMetaBoostMultiplier: state.wheelZoomCtrlMetaBoostMultiplier,
      zoomDurationFitMs: state.zoomDurationFitMs,
      zoomDurationSelectionMs: state.zoomDurationSelectionMs,
      zoomRequest: state.zoomRequest,
      zoomState: state.zoomState,
      zoomStateByKey: state.zoomStateByKey,
    })),
  )
  const effectiveSchema = schema || defaultSchema
  const zoomViewKey = React.useMemo(
    () => buildActive2dZoomViewKey({
      canvasRenderMode,
      canvas2dRenderer,
      schema: effectiveSchema,
      graphData: args.graphData,
      documentSemanticMode,
      frontmatterModeEnabled,
      multiDimTableModeEnabled,
      documentStructureBaselineLock,
      renderMediaAsNodes,
      mediaPanelDensity,
      collapsedGroupIds,
    }),
    [
      args.graphData,
      canvas2dRenderer,
      canvasRenderMode,
      collapsedGroupIds,
      documentSemanticMode,
      documentStructureBaselineLock,
      effectiveSchema,
      frontmatterModeEnabled,
      mediaPanelDensity,
      multiDimTableModeEnabled,
      renderMediaAsNodes,
    ],
  )
  const effectiveZoomState = React.useMemo(
    () => getEffectiveZoomStateForKey({ zoomViewKey, zoomStateByKey, zoomState }),
    [zoomStateByKey, zoomState, zoomViewKey],
  )
  const commitStateRef = React.useRef({
    dims,
    graphDataRevision,
    setZoomState,
    setZoomStateForKey,
    viewPinned,
    zoomState,
    zoomStateByKey,
    zoomViewKey,
  })
  React.useEffect(() => {
    commitStateRef.current = {
      dims,
      graphDataRevision,
      setZoomState,
      setZoomStateForKey,
      viewPinned,
      zoomState,
      zoomStateByKey,
      zoomViewKey,
    }
  }, [dims, graphDataRevision, setZoomState, setZoomStateForKey, viewPinned, zoomState, zoomStateByKey, zoomViewKey])
  const interactionSnapshotRef = React.useRef({
    canvasInteractionSpeedMultiplier,
    canvasPanSpeedMultiplier,
    canvasPointerMode2d,
    effectiveSchema,
    flowWheelZoomIncrementMultiplier,
    flowWheelZoomSmoothMaxDurationMs,
    flowWheelZoomSmoothMinDurationMs,
    flowWheelZoomSpeedMultiplier,
    viewportControlsPreset,
    wheelZoomCtrlMetaBoostMultiplier,
  })
  React.useEffect(() => {
    interactionSnapshotRef.current = {
      canvasInteractionSpeedMultiplier,
      canvasPanSpeedMultiplier,
      canvasPointerMode2d,
      effectiveSchema,
      flowWheelZoomIncrementMultiplier,
      flowWheelZoomSmoothMaxDurationMs,
      flowWheelZoomSmoothMinDurationMs,
      flowWheelZoomSpeedMultiplier,
      viewportControlsPreset,
      wheelZoomCtrlMetaBoostMultiplier,
    }
  }, [
    canvasInteractionSpeedMultiplier,
    canvasPanSpeedMultiplier,
    canvasPointerMode2d,
    effectiveSchema,
    flowWheelZoomIncrementMultiplier,
    flowWheelZoomSmoothMaxDurationMs,
    flowWheelZoomSmoothMinDurationMs,
    flowWheelZoomSpeedMultiplier,
    viewportControlsPreset,
    wheelZoomCtrlMetaBoostMultiplier,
  ])
  const scheduleTransformRender = React.useCallback(() => {
    if (transformRenderFrameRef.current != null) return
    if (typeof requestAnimationFrame !== 'function') {
      const nextTransform = transformRef.current
      setTransform(prev => (isSameStoryboardTransform(prev, nextTransform) ? prev : nextTransform))
      return
    }
    transformRenderFrameRef.current = requestAnimationFrame(() => {
      transformRenderFrameRef.current = null
      const nextTransform = transformRef.current
      setTransform(prev => (isSameStoryboardTransform(prev, nextTransform) ? prev : nextTransform))
    })
  }, [])
  const applyTransform = React.useCallback((nextTransform: d3.ZoomTransform) => {
    if (isSameStoryboardTransform(transformRef.current, nextTransform)) return
    transformRef.current = nextTransform
    const element = contentRef.current
    if (element) element.style.transform = buildStoryboardTransformCss(nextTransform)
    scheduleTransformRender()
  }, [scheduleTransformRender])
  const commitTransform = React.useCallback((nextTransform: d3.ZoomTransform = transformRef.current) => {
    const commitState = commitStateRef.current
    if (!commitState.zoomViewKey) return
    commitZoomTransformToStore({
      state: {
        viewPinned: commitState.viewPinned,
        zoomState: commitState.zoomState,
        zoomStateByKey: commitState.zoomStateByKey,
        setZoomState: commitState.setZoomState,
        setZoomStateForKey: commitState.setZoomStateForKey,
      },
      zoomViewKey: commitState.zoomViewKey,
      transform: { k: nextTransform.k, x: nextTransform.x, y: nextTransform.y },
      viewportW: Math.max(1, Math.round(commitState.dims.width || 1)),
      viewportH: Math.max(1, Math.round(commitState.dims.height || 1)),
      graphDataRevision: commitState.graphDataRevision,
    })
  }, [])
  React.useEffect(() => () => {
    if (transformRenderFrameRef.current == null) return
    cancelAnimationFrame(transformRenderFrameRef.current)
    transformRenderFrameRef.current = null
  }, [])

  React.useLayoutEffect(() => {
    const nextTransform = buildStoryboardTransform(effectiveZoomState)
    applyTransform(nextTransform)
  }, [applyTransform, effectiveZoomState, zoomViewKey])

  React.useLayoutEffect(() => {
    if (!args.active) return
    const element = contentRef.current
    if (!element) return
    let frame: number | null = null
    const syncNow = () => {
      frame = null
      const nextMetrics = readStoryboardInfiniteMetrics(element, resolveStoryboardPaintScale(transformRef.current.k))
      setMetrics(prev => {
        if (prev.signature === nextMetrics.signature) return prev
        return nextMetrics
      })
    }
    const scheduleSync = () => {
      if (frame != null) return
      if (typeof requestAnimationFrame !== 'function') {
        syncNow()
        return
      }
      frame = requestAnimationFrame(syncNow)
    }
    syncNow()
    const Observer = typeof ResizeObserver !== 'undefined' ? ResizeObserver : null
    const observer = Observer ? new Observer(scheduleSync) : null
    observer?.observe(element)
    window.addEventListener('resize', scheduleSync)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', scheduleSync)
      if (frame != null) cancelAnimationFrame(frame)
    }
  }, [args.active, args.graphData])

  React.useEffect(() => {
    if (!args.active || !viewportElement) return
    let wheelAnchorFallback: { sx: number; sy: number; ts: number } | null = null
    const controller = createInfiniteCanvasViewportController({
      active: () => args.active,
      adapter: {
        getTransform: () => transformRef.current || d3.zoomIdentity,
        setTransform: applyTransform,
      },
      getSchema: () => interactionSnapshotRef.current.effectiveSchema,
      getPreset: () => interactionSnapshotRef.current.viewportControlsPreset as ViewportControlsPreset,
      getPointerMode2d: () => (interactionSnapshotRef.current.canvasPointerMode2d === 'pan' ? 'pan' : 'select'),
      getWheelZoomCtrlMetaBoostMultiplier: () => interactionSnapshotRef.current.wheelZoomCtrlMetaBoostMultiplier,
      getCanvasPanSpeedMultiplier: () => interactionSnapshotRef.current.canvasPanSpeedMultiplier,
      getCanvasInteractionSpeedMultiplier: () => interactionSnapshotRef.current.canvasInteractionSpeedMultiplier,
      getFlowWheelZoomSpeedMultiplier: () => interactionSnapshotRef.current.flowWheelZoomSpeedMultiplier,
      getFlowWheelZoomIncrementMultiplier: () => interactionSnapshotRef.current.flowWheelZoomIncrementMultiplier,
      getFlowWheelZoomSmoothDuration: () => ({
        minMs: interactionSnapshotRef.current.flowWheelZoomSmoothMinDurationMs,
        maxMs: interactionSnapshotRef.current.flowWheelZoomSmoothMaxDurationMs,
      }),
      isSpacePanHeld: () => isSpacePanHeld(),
      shouldIgnorePointerTarget: target => {
        const element = target instanceof Element ? target : null
        return element?.closest(UI_SELECTORS.canvasPointerIgnore) != null
      },
      shouldIgnoreWheelEvent: event => shouldIgnoreCanvasWheelEvent({ event, ignoreSelector: UI_SELECTORS.canvasWheelIgnore }),
      shouldBlockPanStart: event => {
        const element = event.target instanceof Element ? event.target : null
        if (!element) return false
        return element.closest('[data-kg-kanban-card-drag-region="1"], [role="button"], button, input, textarea, select, a, [contenteditable="true"]') != null
      },
      lockUserSelect: () => lockGlobalUserSelect(),
      unlockUserSelect: () => unlockGlobalUserSelect(),
      disableAutoZoomModes: () => disableAutoZoomModesForUserGesture(useGraphStore.getState()),
      onCommit: () => {
        hasUserInteractedRef.current = true
        commitTransform(transformRef.current)
      },
      readLocalPoint: event => readElementLocalPoint({ el: viewportElement, event }),
      getBoundingRect: () => viewportElement.getBoundingClientRect(),
      getWheelAnchorFallback: () => wheelAnchorFallback,
      setWheelAnchorFallback: point => {
        wheelAnchorFallback = point
      },
      pointerCapture: {
        setPointerCapture: id => viewportElement.setPointerCapture(id),
        releasePointerCapture: id => viewportElement.releasePointerCapture(id),
        hasPointerCapture: id => viewportElement.hasPointerCapture(id),
      },
    })
    const onWheel = (event: WheelEvent) => controller.handleWheel(event)
    const onPointerDown = (event: PointerEvent) => controller.handlePointerDown(event)
    const onPointerMove = (event: PointerEvent) => controller.handlePointerMove(event)
    const onPointerUp = (event: PointerEvent) => controller.handlePointerUp(event)
    const onPointerCancel = (event: PointerEvent) => controller.handlePointerCancel(event)
    const onLostPointerCapture = (event: PointerEvent) => controller.handleLostPointerCapture(event)
    const onContextMenu = (event: MouseEvent) => controller.handleContextMenu(event)
    const onMouseDown = (event: MouseEvent) => controller.handleMouseDown(event)
    viewportElement.addEventListener('wheel', onWheel, { passive: false })
    viewportElement.addEventListener('pointerdown', onPointerDown, { passive: false })
    viewportElement.addEventListener('pointermove', onPointerMove, { passive: false })
    viewportElement.addEventListener('pointerup', onPointerUp, { passive: false })
    viewportElement.addEventListener('pointercancel', onPointerCancel, { passive: false })
    viewportElement.addEventListener('lostpointercapture', onLostPointerCapture, { passive: false })
    viewportElement.addEventListener('contextmenu', onContextMenu, { passive: false })
    viewportElement.addEventListener('mousedown', onMouseDown, { passive: false })
    return () => {
      controller.destroy()
      viewportElement.removeEventListener('wheel', onWheel)
      viewportElement.removeEventListener('pointerdown', onPointerDown)
      viewportElement.removeEventListener('pointermove', onPointerMove)
      viewportElement.removeEventListener('pointerup', onPointerUp)
      viewportElement.removeEventListener('pointercancel', onPointerCancel)
      viewportElement.removeEventListener('lostpointercapture', onLostPointerCapture)
      viewportElement.removeEventListener('contextmenu', onContextMenu)
      viewportElement.removeEventListener('mousedown', onMouseDown)
    }
  }, [
    applyTransform,
    args.active,
    commitTransform,
    viewportElement,
  ])

  React.useEffect(() => {
    if (!args.active || !zoomViewKey || viewPinned || hasUserInteractedRef.current) return
    const viewportW = Math.max(1, Math.round(dims.width || 1))
    const viewportH = Math.max(1, Math.round(dims.height || 1))
    if (viewportW <= 1 || viewportH <= 1) return
    const fitKey = `${zoomViewKey}:${viewportW}x${viewportH}`
    if (lastInitialFitKeyRef.current === fitKey) return
    lastInitialFitKeyRef.current = fitKey
    if ((metrics.graphData.nodes || []).length <= 1) return
    const requestState = useGraphStore.getState()
    const resolved = resolveStoryboardInfiniteZoomRequestTransform({
      zoomRequest: { type: 'fit', intent: 'fitToView', at: 0 },
      graphData: metrics.graphData,
      schema: effectiveSchema,
      documentSemanticMode: (documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
      graphDataRevision,
      viewportW,
      viewportH,
      fitFillRatio: viewportFitFillRatio,
      viewPinned,
      durations: { fitMs: zoomDurationFitMs, selectionMs: zoomDurationSelectionMs },
      selectionState: requestState,
      currentTransform: transformRef.current || d3.zoomIdentity,
      cacheKeyBase: `storyboard:${metrics.signatureKey}`,
    })
    if (!resolved) return
    applyTransform(resolved.nextTransform)
    commitTransform(resolved.nextTransform)
  }, [
    applyTransform,
    args.active,
    commitTransform,
    dims.height,
    dims.width,
    documentSemanticMode,
    effectiveSchema,
    graphDataRevision,
    metrics.graphData,
    metrics.signatureKey,
    viewPinned,
    viewportFitFillRatio,
    zoomDurationFitMs,
    zoomDurationSelectionMs,
    zoomViewKey,
  ])

  React.useEffect(() => {
    if (!args.active || !zoomRequest || !zoomViewKey) return
    const requestState = useGraphStore.getState()
    const resolved = resolveStoryboardInfiniteZoomRequestTransform({
      zoomRequest,
      graphData: metrics.graphData,
      schema: effectiveSchema,
      documentSemanticMode: (documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
      graphDataRevision,
      viewportW: Math.max(1, Math.round(dims.width || 1)),
      viewportH: Math.max(1, Math.round(dims.height || 1)),
      fitFillRatio: viewportFitFillRatio,
      viewPinned,
      durations: { fitMs: zoomDurationFitMs, selectionMs: zoomDurationSelectionMs },
      selectionState: requestState,
      currentTransform: transformRef.current || d3.zoomIdentity,
      cacheKeyBase: `storyboard:${metrics.signatureKey}`,
    })
    if (resolved) {
      applyTransform(resolved.nextTransform)
      commitTransform(resolved.nextTransform)
    }
    clearZoomRequest()
  }, [
    applyTransform,
    args.active,
    clearZoomRequest,
    dims.height,
    dims.width,
    documentSemanticMode,
    effectiveSchema,
    graphDataRevision,
    metrics.graphData,
    metrics.signatureKey,
    viewPinned,
    viewportFitFillRatio,
    zoomDurationFitMs,
    zoomDurationSelectionMs,
    zoomRequest,
    zoomViewKey,
    commitTransform,
  ])

  const contentStyle = React.useMemo<React.CSSProperties>(() => ({
    transform: buildStoryboardTransformCss(transform),
    transformOrigin: 'top left',
  }), [transform])
  const transformKey = React.useMemo(() => buildStoryboardTransformKey(transform), [transform])

  return {
    contentRef,
    contentStyle,
    setViewportElement,
    transform,
    transformKey,
    zoomScale: transform.k,
  }
}
