import * as d3 from 'd3'

import { useGraphStore } from '@/hooks/useGraphStore'
import { requestFlowNativeDraw, setFlowNativeTransform, type FlowNativeRuntime, type FlowNativeDrawArgs } from '@/components/FlowCanvas/nativeRuntime'
import { createEdgeScrollController } from '@/lib/canvas/edge-scroll'
import { relaxFlowSceneNodePositions } from '@/components/FlowCanvas/relaxScenePositions'
import { computeFlowDragRelaxPolicy } from '@/components/FlowCanvas/relaxStepPolicy'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'
import { readZoomScaleExtent, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP } from '@/lib/graph/layoutDefaults'
import { getFlowAutoMinScale } from '@/components/FlowCanvas/flowScaleExtentOverride'
import { createInfiniteCanvasViewportController } from '@/lib/canvas/infinite-canvas-engine'
import { mergeScaleExtentWithCurrent } from '@/lib/zoom/scaleExtent'
import { clampScale } from '@/lib/canvas/viewport-transform'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { UI_SELECTORS } from '@/lib/config'
import { readCanvasLocalPoint } from '@/lib/canvas/canvas-event-coords'

import type { BindFlowCanvasNativeInteractionsArgs, FlowCanvasDrag } from '@/components/FlowCanvas/interactions/types'
import type { FlowNativeInteractionsContext } from '@/components/FlowCanvas/interactions/context'
import { createFlowNativeWheelAndGestureHandlers } from '@/components/FlowCanvas/interactions/wheelAndGesture'
import { createFlowNativePointerDownHandler } from '@/components/FlowCanvas/interactions/pointerDown'
import { createFlowNativePointerMoveHandler } from '@/components/FlowCanvas/interactions/pointerMove'
import { createFlowNativePointerUpHandler } from '@/components/FlowCanvas/interactions/pointerUp'
import { createFlowNativeContextMenuHandler } from '@/components/FlowCanvas/interactions/contextMenu'
import { bindFlowNativeInteractionListeners } from '@/components/FlowCanvas/interactions/listeners'

export function bindFlowCanvasNativeInteractions(args: BindFlowCanvasNativeInteractionsArgs) {
  const canvasEl = args.canvasEl
  const runtime = args.runtime

  const touchPointsById = new Map<number, { sx: number; sy: number }>()
  const edgeScroll = createEdgeScrollController()

  const readEffectiveSelectMode = (st: ReturnType<typeof useGraphStore.getState>, isFlowEditor: boolean): 'single' | 'multi' | 'lasso' => {
    const raw = st.schema?.behavior?.selectMode
    const base: 'single' | 'multi' | 'lasso' = raw === 'lasso' ? 'lasso' : raw === 'multi' ? 'multi' : 'single'
    if (!isFlowEditor) return base
    return base === 'lasso' ? 'lasso' : 'multi'
  }

  const getPreset = () => {
    const st = useGraphStore.getState()
    return (st.viewportControlsPreset || args.viewportControlsPreset) as any
  }

  let pendingDragRelaxRaf: number | null = null
  let lastDragRelaxMs = 0

  const scheduleDragRelax = () => {
    if (!args.collisionDuringDrag) return
    if (pendingDragRelaxRaf != null) return
    pendingDragRelaxRaf = requestAnimationFrame(() => {
      pendingDragRelaxRaf = null
      const scene = runtime.scene
      if (!scene) return

      const policy = computeFlowDragRelaxPolicy({ nodeCount: scene.nodes.length, groupCount: scene.groups?.length || 0 })
      if (!policy.enabled) return

      const now = Date.now()
      if (lastDragRelaxMs && now - lastDragRelaxMs < policy.minIntervalMs) return
      lastDragRelaxMs = now

      const schema = args.collisionSchemaRef.current
      const graphDataForZoom = args.collisionGraphDataRef.current
      const flowConfig = args.collisionFlowConfigRef.current
      const flowPresentation = args.collisionPresentationRef.current
      if (!schema || !graphDataForZoom || !flowConfig || !flowPresentation) return

      const relaxed = relaxFlowSceneNodePositions({
        graphData: graphDataForZoom,
        sceneNodes: scene.nodes,
        groups: scene.groups || [],
        schema,
        nodeSize: { widthPx: flowConfig.node.widthPx, heightPx: flowConfig.node.heightPx },
        portHandles: {
          enabled: flowPresentation.portHandles.enabled,
          sizePx: flowPresentation.portHandles.sizePx,
          offsetPx: flowPresentation.portHandles.offsetPx,
        },
        steps: policy.steps,
      })

      if (relaxed) {
        for (let i = 0; i < scene.nodes.length; i += 1) {
          const n = scene.nodes[i]
          const p = relaxed[n.id]
          if (!p) continue
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
          n.x = p.x
          n.y = p.y
        }
        runtime.dirty = true
      }
      requestFlowNativeDraw(runtime, args.buildDrawArgs())
    })
  }

  const cancelActiveDragIfStale = (drag: NonNullable<typeof args.dragRef.current>): boolean => {
    const shouldCancel = (() => {
      try {
        if (drag.type === 'pinch') {
          const a = canvasEl.hasPointerCapture(drag.pointerIdA)
          const b = canvasEl.hasPointerCapture(drag.pointerIdB)
          return !a && !b
        }
        const id = (drag as unknown as { pointerId?: unknown }).pointerId
        if (typeof id !== 'number') return true
        return canvasEl.hasPointerCapture(id) !== true
      } catch {
        return false
      }
    })()

    if (!shouldCancel) return false

    const dragPointerId = drag.type === 'pinch' ? null : drag.pointerId
    if (dragPointerId != null && args.userSelectLockPointerIdRef.current === dragPointerId) {
      args.userSelectLockPointerIdRef.current = null
      unlockGlobalUserSelect()
      try {
        if (canvasEl.hasPointerCapture(dragPointerId)) {
          canvasEl.releasePointerCapture(dragPointerId)
        }
      } catch {
        void 0
      }
    }

    args.dragRef.current = null
    edgeScroll.reset()
    args.setSelectionBox(null)
    args.requestCommit()
    return true
  }

  const computeScaleExtent = ({ schema, currentK }: { schema: any; currentK: number }) => {
    const [schemaMinScale, schemaMaxScale] = readZoomScaleExtent(schema)
    const autoMinScale = getFlowAutoMinScale(runtime)
    const maxK = schemaMaxScale
    const minBase = autoMinScale != null ? autoMinScale : schemaMinScale
    const minK = clampScale(minBase, { minK: DEFAULT_ZOOM_MIN_SCALE_HARD_CAP, maxK })
    return mergeScaleExtentWithCurrent({ schemaMinK: minK, schemaMaxK: maxK, curMinK: currentK, curMaxK: currentK })
  }

  const viewportWheelController = createInfiniteCanvasViewportController({
    active: () => args.active,
    adapter: {
      getTransform: () => runtime.transform || d3.zoomIdentity,
      setTransform: (t) => {
        setFlowNativeTransform(runtime, t)
        requestFlowNativeDraw(runtime, args.buildDrawArgs())
      },
    },
    getSchema: () => useGraphStore.getState().schema,
    computeScaleExtent: ({ schema, currentK }) => computeScaleExtent({ schema, currentK }),
    getPreset: () => getPreset(),
    getPointerMode2d: () => (useGraphStore.getState().canvasPointerMode2d === 'pan' ? 'pan' : 'select'),
    getWheelZoomCtrlMetaBoostMultiplier: () => useGraphStore.getState().wheelZoomCtrlMetaBoostMultiplier,
    getCanvasPanSpeedMultiplier: () => useGraphStore.getState().canvasPanSpeedMultiplier,
    getCanvasInteractionSpeedMultiplier: () => useGraphStore.getState().canvasInteractionSpeedMultiplier,
    getFlowWheelZoomSpeedMultiplier: () => useGraphStore.getState().flowWheelZoomSpeedMultiplier,
    getFlowWheelZoomIncrementMultiplier: () => useGraphStore.getState().flowWheelZoomIncrementMultiplier,
    getFlowWheelZoomSmoothDuration: () => ({
      minMs: useGraphStore.getState().flowWheelZoomSmoothMinDurationMs,
      maxMs: useGraphStore.getState().flowWheelZoomSmoothMaxDurationMs,
    }),
    isSpacePanHeld: () => isSpacePanHeld(),
    getWheelAnchorFallback: () => args.lastPointerInCanvasRef.current,
    setWheelAnchorFallback: (p) => {
      args.lastPointerInCanvasRef.current = p
    },
    shouldIgnorePointerTarget: (target) => {
      const el = target instanceof Element ? target : null
      if (!el) return false
      const ignoreSelector = [UI_SELECTORS.canvasWheelIgnore, UI_SELECTORS.canvasPointerIgnore].filter(Boolean).join(', ')
      if (!ignoreSelector) return false
      return el.closest(ignoreSelector) != null
    },
    shouldIgnoreWheelEvent: () => false,
    lockUserSelect: () => lockGlobalUserSelect(),
    unlockUserSelect: () => unlockGlobalUserSelect(),
    disableAutoZoomModes: () => disableAutoZoomModesForUserGesture(useGraphStore.getState()),
    onInteractionFrame: args.onInteractionFrame,
    onCommit: args.requestCommit,
    readLocalPoint: (e) => readCanvasLocalPoint({ canvasEl, event: e }),
    getBoundingRect: () => canvasEl.getBoundingClientRect(),
    pointerCapture: {
      setPointerCapture: (id) => canvasEl.setPointerCapture(id),
      releasePointerCapture: (id) => canvasEl.releasePointerCapture(id),
      hasPointerCapture: (id) => canvasEl.hasPointerCapture(id),
    },
  })

  try {
    ;(canvasEl as unknown as { __kgViewportControllerDestroy?: (() => void) | null }).__kgViewportControllerDestroy =
      viewportWheelController.destroy
  } catch {
    void 0
  }

  const ctx: FlowNativeInteractionsContext = {
    args,
    canvasEl,
    runtime,
    touchPointsById,
    edgeScroll,
    getPreset,
    readEffectiveSelectMode,
    computeScaleExtent,
    viewportWheelController,
    cancelActiveDragIfStale,
    scheduleDragRelax,
  }

  const wheelAndGesture = createFlowNativeWheelAndGestureHandlers(ctx)
  const onPointerDown = createFlowNativePointerDownHandler(ctx)
  const onPointerMove = createFlowNativePointerMoveHandler(ctx)
  const onPointerUp = createFlowNativePointerUpHandler(ctx)
  const onContextMenu = createFlowNativeContextMenuHandler(ctx)

  const cancelPendingDragRelax = () => {
    if (pendingDragRelaxRaf == null) return
    try {
      cancelAnimationFrame(pendingDragRelaxRaf)
    } catch {
      void 0
    }
    pendingDragRelaxRaf = null
  }

  const unbind = bindFlowNativeInteractionListeners({
    ctx,
    handlers: {
      ...wheelAndGesture,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onContextMenu,
    },
    cancelPendingDragRelax,
  })

  return () => {
    try {
      const any = canvasEl as unknown as { __kgViewportControllerDestroy?: (() => void) | null }
      if (any.__kgViewportControllerDestroy === viewportWheelController.destroy) any.__kgViewportControllerDestroy = null
    } catch {
      void 0
    }
    unbind()
  }
}
