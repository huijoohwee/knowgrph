import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { subscribeGlobalCancelIntervalWatchdog } from '@/lib/browser/globalCancelEvents'

type FrameDragState = {
  ids: string[]
  startPosById: Record<string, { x: number; y: number }>
}

type ResizeState = {
  pointerId: number
}

type MarqueeState = {
  pointerId: number
}

type MediaHeaderDragState = {
  id: string
  pointerId: number
  startX: number
  startY: number
  startK: number
  lastDx: number
  lastDy: number
  schema: GraphSchema | null
}

type UseGlobalInteractionCleanupArgs = {
  interactionActive: boolean
  svgRef: React.MutableRefObject<SVGSVGElement | null>
  frameElByIdRef: React.MutableRefObject<Map<string, SVGGElement>>
  frameDragRef: React.MutableRefObject<FrameDragState | null>
  frameDragPendingRef: React.MutableRefObject<{ ids: string[]; nextPosById: Record<string, { x: number; y: number }> } | null>
  frameDragRafRef: React.MutableRefObject<number | null>
  resizeRef: React.MutableRefObject<ResizeState | null>
  marqueeRef: React.MutableRefObject<MarqueeState | null>
  cancelResizeAndMarquee: (svgEl: SVGSVGElement | null) => void
  groupResizeRef: React.MutableRefObject<{ pointerId: number } | null>
  cancelGroupResize: (svgEl: SVGSVGElement | null) => void
  designMediaHeaderDragRef: React.MutableRefObject<MediaHeaderDragState | null>
}

export function useGlobalInteractionCleanup(args: UseGlobalInteractionCleanupArgs) {
  const {
    interactionActive,
    svgRef,
    frameElByIdRef,
    frameDragRef,
    frameDragPendingRef,
    frameDragRafRef,
    resizeRef,
    marqueeRef,
    cancelResizeAndMarquee,
    groupResizeRef,
    cancelGroupResize,
    designMediaHeaderDragRef,
  } = args

  const cancelFrameDrag = React.useCallback(() => {
    const drag = frameDragRef.current
    if (!drag) return
    frameDragRef.current = null
    frameDragPendingRef.current = null
    if (frameDragRafRef.current != null) {
      try {
        window.cancelAnimationFrame(frameDragRafRef.current)
      } catch {
        void 0
      }
      frameDragRafRef.current = null
    }
    const ids = drag.ids || []
    for (let i = 0; i < ids.length; i += 1) {
      const id = String(ids[i] || '').trim()
      if (!id) continue
      const pos = drag.startPosById?.[id]
      if (!pos) continue
      const el = frameElByIdRef.current.get(id)
      if (!el) continue
      try {
        el.setAttribute('transform', `translate(${pos.x},${pos.y})`)
      } catch {
        void 0
      }
    }
  }, [frameDragPendingRef, frameDragRafRef, frameDragRef, frameElByIdRef])

  const cancelAll = React.useCallback(() => {
    const svgEl = svgRef.current
    cancelResizeAndMarquee(svgEl)
    cancelGroupResize(svgEl)
    cancelFrameDrag()
    if (designMediaHeaderDragRef.current) designMediaHeaderDragRef.current = null
  }, [cancelFrameDrag, cancelGroupResize, cancelResizeAndMarquee, designMediaHeaderDragRef, svgRef])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const onAnyEnd = () => {
      if (
        !frameDragRef.current &&
        !resizeRef.current &&
        !groupResizeRef.current &&
        !marqueeRef.current &&
        !designMediaHeaderDragRef.current
      ) {
        return
      }
      cancelAll()
    }

    const unsubscribeGlobalCleanup = subscribeGlobalCancelIntervalWatchdog({
      listener: onAnyEnd,
      capture: true,
      includePointerDown: true,
      includeLostPointerCapture: true,
      visibilityBehavior: 'hidden-only',
      intervalMs: 12000,
    })

    return () => {
      unsubscribeGlobalCleanup()
      cancelAll()
    }
  }, [cancelAll, designMediaHeaderDragRef, frameDragRef, groupResizeRef, marqueeRef, resizeRef])

  React.useEffect(() => {
    if (interactionActive) return
    cancelAll()
  }, [cancelAll, interactionActive])
}
