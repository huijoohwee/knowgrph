import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { ensureSpacePanKeyListenerInstalled } from '@/lib/canvas/space-pan'
import { shouldIgnoreCanvasWheelEvent } from '@/lib/canvas/wheel-target-guard'
import { UI_SELECTORS } from '@/lib/config'

export function useEnsureSpacePanListener(): void {
  useEffect(() => {
    ensureSpacePanKeyListenerInstalled()
  }, [])
}

export function useCanvasWheelAndGestureGuards(args: {
  svgRef: RefObject<SVGSVGElement | null>
  activeRef: MutableRefObject<boolean>
}): void {
  const { svgRef, activeRef } = args

  useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const shouldIgnore = (target: EventTarget | null, e: WheelEvent | TouchEvent) => {
      const eventTarget = (target || null) as Element | null
      if (eventTarget && eventTarget.closest(UI_SELECTORS.canvasWheelIgnore)) return true
      const isWheel = typeof (e as WheelEvent).deltaY === 'number'
      if (isWheel) return shouldIgnoreCanvasWheelEvent({ event: e as WheelEvent, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })
      return false
    }

    const onWheel = (e: WheelEvent) => {
      if (!activeRef.current) return
      if (shouldIgnore(e.target, e)) return
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return
      if (shouldIgnore(e.target, e)) return
      if (!e.touches || e.touches.length <= 0) return
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }

    const onGesture = (e: Event) => {
      if (!activeRef.current) return
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    el.addEventListener('gesturestart', onGesture as EventListener, { passive: false, capture: true })
    el.addEventListener('gesturechange', onGesture as EventListener, { passive: false, capture: true })
    el.addEventListener('gestureend', onGesture as EventListener, { passive: false, capture: true })
    return () => {
      el.removeEventListener('wheel', onWheel, true)
      el.removeEventListener('touchmove', onTouchMove, true)
      el.removeEventListener('gesturestart', onGesture as EventListener, true)
      el.removeEventListener('gesturechange', onGesture as EventListener, true)
      el.removeEventListener('gestureend', onGesture as EventListener, true)
    }
  }, [activeRef, svgRef])
}

