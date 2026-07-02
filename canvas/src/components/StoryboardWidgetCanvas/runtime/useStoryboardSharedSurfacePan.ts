import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import {
  CANVAS_OVERLAY_DRAG_HANDLE_SELECTOR,
  CANVAS_OVERLAY_PROXY_ROOT_SELECTOR,
  CANVAS_OVERLAY_RESIZE_HANDLE_SELECTOR,
  readStoryboardWidgetElementSurfaceId,
  readStoryboardWidgetOverlaySurfaceId,
  shouldUseCanvasOverlayBodyPan,
} from '@/lib/canvas/storyboard-widget-overlay-proxy'
import {
  applyStoryboardWidgetScreenAuthorityPanSnapshot,
  readStoryboardWidgetScreenAuthorityPanSnapshot,
  shouldUseStoryboardWidgetScreenAuthorityCollectivePan,
  type StoryboardWidgetScreenAuthorityPanSnapshot,
} from '@/lib/storyboardWidget/screenAuthorityCollectivePan'

export function useStoryboardSharedSurfacePan(args: {
  active: boolean
  emitInteractionFrame: () => void
  getLiveZoomTransform: () => { k: number; x: number; y: number } | null
  rootRef: React.RefObject<HTMLElement | null>
  storyboardWidgetSurfaceId: string
  zoomViewKeyRef: React.MutableRefObject<string | null>
}) {
  const screenAuthorityPanRef = React.useRef<null | {
    pointerId: number
    startClientX: number
    startClientY: number
    snapshot: StoryboardWidgetScreenAuthorityPanSnapshot
    transform: { k: number; x: number; y: number }
    started: boolean
  }>(null)

  React.useEffect(() => {
    if (!args.active || typeof window === 'undefined') return

    const isPointerEventLike = (event: PointerEvent | MouseEvent): event is PointerEvent =>
      typeof (event as PointerEvent).pointerId === 'number'

    const readInteractionPointerId = (event: PointerEvent | MouseEvent): number =>
      isPointerEventLike(event) ? event.pointerId : -1

    const readTransform = (): { k: number; x: number; y: number } => {
      const state = useGraphStore.getState()
      const resolved =
        args.getLiveZoomTransform()
        || getEffectiveZoomStateForKey({
          zoomViewKey: args.zoomViewKeyRef.current,
          zoomStateByKey: state.zoomStateByKey,
          zoomState: state.zoomState,
        })
        || state.zoomState
        || { k: 1, x: 0, y: 0 }
      return {
        k: Number.isFinite(resolved.k) ? resolved.k : 1,
        x: Number.isFinite(resolved.x) ? resolved.x : 0,
        y: Number.isFinite(resolved.y) ? resolved.y : 0,
      }
    }

    const readActiveSurfaceId = (surfaceRoot: HTMLElement) =>
      String(args.storyboardWidgetSurfaceId || '').trim() || readStoryboardWidgetElementSurfaceId(surfaceRoot)

    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      if (screenAuthorityPanRef.current) return
      if (isPointerEventLike(event) && event.pointerType === 'touch') return
      if (event.button !== 0) return
      const surfaceRoot = args.rootRef.current
      if (!surfaceRoot) return
      const state = useGraphStore.getState()
      const storyboardWidgetOverlayInteractionMode = shouldUseStoryboardWidgetScreenAuthorityCollectivePan(state)
      if (!storyboardWidgetOverlayInteractionMode) return
      const target = event.target instanceof Element ? event.target : null
      if (!target) return
      const overlayRoot = target.closest(CANVAS_OVERLAY_PROXY_ROOT_SELECTOR)
      if (!(overlayRoot instanceof HTMLElement)) return
      if (!shouldUseCanvasOverlayBodyPan({ target, overlayRoot })) return
      if (target.closest(CANVAS_OVERLAY_RESIZE_HANDLE_SELECTOR)) return
      if (target.closest(CANVAS_OVERLAY_DRAG_HANDLE_SELECTOR)) return
      const surfaceId = readActiveSurfaceId(surfaceRoot)
      if (!surfaceId || readStoryboardWidgetOverlaySurfaceId(overlayRoot) !== surfaceId) return
      const transform = readTransform()
      const snapshot = readStoryboardWidgetScreenAuthorityPanSnapshot({ storyboardWidgetSurfaceId: surfaceId, transform })
      if (!snapshot) return
      screenAuthorityPanRef.current = {
        pointerId: readInteractionPointerId(event),
        startClientX: Number.isFinite(event.clientX) ? event.clientX : 0,
        startClientY: Number.isFinite(event.clientY) ? event.clientY : 0,
        snapshot,
        transform,
        started: false,
      }
    }

    const onPointerMove = (event: PointerEvent | MouseEvent) => {
      const pending = screenAuthorityPanRef.current
      if (!pending || readInteractionPointerId(event) !== pending.pointerId) return
      if (typeof event.buttons === 'number' && event.buttons === 0) {
        screenAuthorityPanRef.current = null
        return
      }
      const clientX = Number.isFinite(event.clientX) ? event.clientX : pending.startClientX
      const clientY = Number.isFinite(event.clientY) ? event.clientY : pending.startClientY
      const dx = clientX - pending.startClientX
      const dy = clientY - pending.startClientY
      if (!pending.started && dx * dx + dy * dy < 9) return
      pending.started = true
      const changed = applyStoryboardWidgetScreenAuthorityPanSnapshot({
        snapshot: pending.snapshot,
        dx,
        dy,
        transform: pending.transform,
      })
      if (changed) args.emitInteractionFrame()
      try {
        event.preventDefault()
        event.stopPropagation()
      } catch {
        void 0
      }
    }

    const onPointerUp = (event: PointerEvent | MouseEvent) => {
      const pending = screenAuthorityPanRef.current
      if (!pending || readInteractionPointerId(event) !== pending.pointerId) return
      screenAuthorityPanRef.current = null
      if (!pending.started) return
      try {
        event.preventDefault()
        event.stopPropagation()
      } catch {
        void 0
      }
    }

    window.addEventListener('pointerdown', onPointerDown, { passive: false, capture: true })
    window.addEventListener('pointermove', onPointerMove, { passive: false, capture: true })
    window.addEventListener('pointerup', onPointerUp, { passive: false, capture: true })
    window.addEventListener('pointercancel', onPointerUp, { passive: false, capture: true })
    window.addEventListener('mousedown', onPointerDown, { passive: false, capture: true })
    window.addEventListener('mousemove', onPointerMove, { passive: false, capture: true })
    window.addEventListener('mouseup', onPointerUp, { passive: false, capture: true })
    return () => {
      screenAuthorityPanRef.current = null
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerUp, true)
      window.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('mousemove', onPointerMove, true)
      window.removeEventListener('mouseup', onPointerUp, true)
    }
  }, [
    args.active,
    args.emitInteractionFrame,
    args.getLiveZoomTransform,
    args.rootRef,
    args.storyboardWidgetSurfaceId,
    args.zoomViewKeyRef,
  ])
}
