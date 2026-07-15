import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { disableAutoZoomModesForUserGesture } from '@/lib/canvas/auto-zoom-modes'
import { shouldIgnoreCanvasWheelEvent } from '@/lib/canvas/wheel-target-guard'
import { readWheelBehavior, shouldWheelZoom } from '@/lib/canvas/camera-options-2d'
import { UI_SELECTORS } from '@/lib/config'
import { cancelFlowZoomRequestAnim } from '@/components/FlowCanvas/applyZoomRequestNative'
import {
  readCanvasOverlayPinnedState,
  resolveStoryboardWidgetOverlayProxyTarget,
  type StoryboardWidgetOverlayProxyTarget,
} from '@/lib/canvas/storyboard-widget-overlay-proxy'
import {
  isStoryboardWidgetSurfaceRenderer,
  shouldUseStoryboardWidgetScreenAuthorityCollectivePan,
} from '@/lib/storyboardWidget/screenAuthorityCollectivePan'
import { createSafariGestureZoomController } from '@/lib/canvas/safari-gesture-zoom'
import { requestFlowNativeDraw, setFlowNativeTransform } from '@/components/FlowCanvas/nativeRuntime'
import { readCanvasLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { shouldKeepWidgetInnerPanelWheel } from '@/lib/canvas/widgetInnerPanelScrolling'
import { isLocalWheelOwnerEvent } from 'grph-shared/dom/wheelGuards'

import type { FlowNativeInteractionsContext } from '@/components/FlowCanvas/interactions/context'

export function createFlowNativeWheelAndGestureHandlers(ctx: FlowNativeInteractionsContext) {
  const canvasEl = ctx.canvasEl
  const runtime = ctx.runtime

  const shouldProxyWheelFromOverlay = (
    event: WheelEvent,
    resolved: StoryboardWidgetOverlayProxyTarget,
    opts?: { storyboardWidgetMode?: boolean },
  ): boolean => {
    if (resolved.kind !== 'overlay') return false
    const overlayRoot = resolved.overlayRoot
    if (isLocalWheelOwnerEvent(event, overlayRoot)) return false
    const overlayPinnedToNode = readCanvasOverlayPinnedState(overlayRoot)
    const storyboardWidgetMode = opts?.storyboardWidgetMode === true

    const dx = typeof (event as unknown as { deltaX?: unknown }).deltaX === 'number' ? (event as unknown as { deltaX: number }).deltaX : 0
    const dy = typeof (event as unknown as { deltaY?: unknown }).deltaY === 'number' ? (event as unknown as { deltaY: number }).deltaY : 0
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return false

    // Explicit zoom intent is viewport-owned; ordinary wheel remains local to inner scroll surfaces.
    if (event.ctrlKey === true || event.metaKey === true) return true

    if (shouldKeepWidgetInnerPanelWheel(event, overlayRoot)) return false

    if (storyboardWidgetMode && overlayPinnedToNode && event.altKey !== true) return true
    if (overlayPinnedToNode && resolved.isInteractive !== true && event.altKey !== true) return true
    if (isSpacePanHeld()) return true

    return true
  }

  const handleWheel = (e: WheelEvent, opts?: { skipIgnoreGuard?: boolean }) => {
    const explicitOverlayZoomIntent = opts?.skipIgnoreGuard === true && (e.ctrlKey === true || e.metaKey === true)
    if (shouldKeepWidgetInnerPanelWheel(e) && !explicitOverlayZoomIntent) return

    cancelFlowZoomRequestAnim(runtime)
    const drag = ctx.args.dragRef.current
    if (drag && drag.type !== 'pan') {
      if (ctx.cancelActiveDragIfStale(drag)) {
        return handleWheel(e, opts)
      }
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    const storeState = ctx.readViewportInteractionSnapshot()
    const storyboardWidgetMode = String(storeState.canvas2dRenderer || '') === 'storyboard'
    const preset = ctx.getPreset()
    disableAutoZoomModesForUserGesture(storeState)
    const schemaForWheel = storeState.schema
    const wheelBehavior = schemaForWheel ? readWheelBehavior(schemaForWheel) : 'preset'
    const wheelZoom = shouldWheelZoom({ event: e, preset, wheelBehavior })

    const ignoreWheelTarget = opts?.skipIgnoreGuard ? false : shouldIgnoreCanvasWheelEvent({ event: e, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })
    const allowZoomThroughIgnore = wheelZoom && (e.ctrlKey === true || e.metaKey === true)
    if (ignoreWheelTarget && !allowZoomThroughIgnore) {
      if (storyboardWidgetMode && !opts?.skipIgnoreGuard) {
        const cx = (e as unknown as { clientX?: unknown }).clientX
        const cy = (e as unknown as { clientY?: unknown }).clientY
        if (typeof cx === 'number' && Number.isFinite(cx) && typeof cy === 'number' && Number.isFinite(cy)) {
          const top = typeof document !== 'undefined' && typeof document.elementFromPoint === 'function' ? document.elementFromPoint(cx, cy) : null
          if (top && (top === canvasEl || canvasEl.contains(top))) {
            return handleWheel(e, { skipIgnoreGuard: true })
          }
        }
      }
      if (ignoreWheelTarget) return
      try {
        e.preventDefault()
      } catch {
        void 0
      }
      return
    }

    ctx.viewportWheelController.handleWheel(e)
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }

  const onWheel = (e: WheelEvent) => {
    if (!ctx.args.active) return
    handleWheel(e)
  }

  const onWindowWheelCapture = (e: WheelEvent) => {
    if (!ctx.args.active) return
    const st = ctx.readViewportInteractionSnapshot()
    const storyboardWidgetMode = isStoryboardWidgetSurfaceRenderer(st.canvas2dRenderer)
    const storyboardWidgetOverlayInteractionMode = shouldUseStoryboardWidgetScreenAuthorityCollectivePan(st)
    if (!storyboardWidgetOverlayInteractionMode) return
    const resolved = resolveStoryboardWidgetOverlayProxyTarget({
      target: (e as unknown as { target?: unknown }).target,
      canvasEl,
      storyboardWidgetSurfaceId: ctx.args.storyboardWidgetSurfaceId,
    })
    const proxyOverlayWheel = shouldProxyWheelFromOverlay(e, resolved, { storyboardWidgetMode })
    const ignoreWheelTarget = shouldIgnoreCanvasWheelEvent({ event: e, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })
    if (ignoreWheelTarget && !proxyOverlayWheel) return
    const target = e.target
    const targetEl = target instanceof Element ? target : null
    const targetInCanvas = !!targetEl && (targetEl === canvasEl || canvasEl.contains(targetEl))

    if (!targetInCanvas && storyboardWidgetMode) {
      const cx = (e as unknown as { clientX?: unknown }).clientX
      const cy = (e as unknown as { clientY?: unknown }).clientY
      if (typeof cx === 'number' && Number.isFinite(cx) && typeof cy === 'number' && Number.isFinite(cy)) {
        const top = typeof document !== 'undefined' && typeof document.elementFromPoint === 'function' ? document.elementFromPoint(cx, cy) : null
        if (top && (top === canvasEl || canvasEl.contains(top))) {
          handleWheel(e, { skipIgnoreGuard: true })
          return
        }
      }
    }

    if (!proxyOverlayWheel) return
    handleWheel(e, { skipIgnoreGuard: true })
  }

  const shouldProxyGestureToCanvas = (event: Event): boolean => {
    const st = ctx.readViewportInteractionSnapshot()
    const storyboardWidgetOverlayInteractionMode = shouldUseStoryboardWidgetScreenAuthorityCollectivePan(st)
    if (!storyboardWidgetOverlayInteractionMode) return false
    const resolved = resolveStoryboardWidgetOverlayProxyTarget({
      target: (event as unknown as { target?: unknown }).target,
      canvasEl,
      storyboardWidgetSurfaceId: ctx.args.storyboardWidgetSurfaceId,
    })
    if (resolved.kind === 'none') return false
    if (resolved.kind === 'overlay' && isLocalWheelOwnerEvent(event, resolved.overlayRoot)) return false
    return true
  }

  const gestureZoom = createSafariGestureZoomController({
    active: () => ctx.args.active,
    adapter: {
      getTransform: () => runtime.transform,
      setTransform: (t) => {
        setFlowNativeTransform(runtime, t)
        requestFlowNativeDraw(runtime, ctx.args.buildDrawArgs())
      },
    },
    getSchema: () => ctx.readViewportInteractionSnapshot().schema,
    computeScaleExtent: (x) => ctx.computeScaleExtent(x),
    disableAutoZoomModes: () => disableAutoZoomModesForUserGesture(ctx.readViewportInteractionSnapshot()),
    onInteractionFrame: ctx.args.onInteractionFrame,
    onCommit: ctx.args.requestCommit,
    onGestureStart: () => {
      ctx.viewportWheelController.destroy()
      cancelFlowZoomRequestAnim(runtime)
    },
    readLocalPoint: (e) => readCanvasLocalPoint({ canvasEl, event: e }),
    getBoundingRect: () => canvasEl.getBoundingClientRect(),
  })

  const onWindowGestureStartCapture = (event: Event) => {
    if (!ctx.args.active) return
    if (!shouldProxyGestureToCanvas(event)) return
    gestureZoom.handleGestureStart(event)
  }

  const onWindowGestureChangeCapture = (event: Event) => {
    if (!ctx.args.active) return
    if (!shouldProxyGestureToCanvas(event)) return
    gestureZoom.handleGestureChange(event)
  }

  const onWindowGestureEndCapture = (event: Event) => {
    if (!ctx.args.active) return
    if (!shouldProxyGestureToCanvas(event)) return
    gestureZoom.handleGestureEnd(event)
  }

  return { onWheel, onWindowWheelCapture, onWindowGestureStartCapture, onWindowGestureChangeCapture, onWindowGestureEndCapture }
}
