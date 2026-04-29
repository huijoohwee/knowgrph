import React from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import { invertZoomPoint } from '@/lib/canvas/viewport-transform'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { computeOverlayDraggedPoint2d } from '@/lib/canvas/overlayInteractions2d'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import type { GraphSchema } from '@/lib/graph/schema'
import type { DesignFramePos, DesignFrameSize } from '@/hooks/store/designRendererSlice'
import type { DesignCanvasFrameRect } from '@/components/DesignCanvas/types'

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

type UseDesignCanvasShellControllersArgs = {
  interactionActive: boolean
  canvasPointerMode2d: string
  svgRef: React.RefObject<SVGSVGElement | null>
  mediaOverlayPanRef: React.RefObject<{ pointerId: number; startTransform: d3.ZoomTransform } | null>
  designMediaOverlayElsRef: React.RefObject<Map<string, HTMLElement>>
  setDesignFramePosManyRaw: (patch: Record<string, DesignFramePos>) => void
  setDesignFrameSizeManyRaw: (patch: Record<string, DesignFrameSize>) => void
  schema: GraphSchema | null
  positions: Record<string, DesignCanvasFrameRect>
}

export function useDesignCanvasShellControllers(args: UseDesignCanvasShellControllersArgs) {
  const {
    interactionActive,
    canvasPointerMode2d,
    svgRef,
    mediaOverlayPanRef,
    designMediaOverlayElsRef,
    setDesignFramePosManyRaw,
    setDesignFrameSizeManyRaw,
    schema,
    positions,
  } = args

  const frameElByIdRef = React.useRef<Map<string, SVGGElement>>(new Map())
  const frameRectElByIdRef = React.useRef<Map<string, SVGRectElement>>(new Map())
  const frameStatusElByIdRef = React.useRef<Map<string, SVGPathElement>>(new Map())
  const groupRectElByIdRef = React.useRef<Map<string, SVGRectElement>>(new Map())
  const groupHandleElByIdRef = React.useRef<Map<string, SVGGElement>>(new Map())
  const resizeOverlayElRef = React.useRef<SVGGElement | null>(null)
  const designMediaHeaderDragRef = React.useRef<MediaHeaderDragState | null>(null)

  const setDesignFramePosMany = React.useCallback(
    (patch: Record<string, DesignFramePos>) => {
      if (!interactionActive) return
      setDesignFramePosManyRaw(patch)
    },
    [interactionActive, setDesignFramePosManyRaw],
  )

  const setDesignFrameSizeMany = React.useCallback(
    (patch: Record<string, DesignFrameSize>) => {
      if (!interactionActive) return
      setDesignFrameSizeManyRaw(patch)
    },
    [interactionActive, setDesignFrameSizeManyRaw],
  )

  React.useEffect(() => {
    if (interactionActive) return
    mediaOverlayPanRef.current = null
  }, [interactionActive, mediaOverlayPanRef])

  const pointerToWorld = React.useMemo(() => {
    return (ev: React.PointerEvent, svgEl: SVGSVGElement): { x: number; y: number } | null => {
      const local = readElementLocalPoint({ el: svgEl, event: ev })
      if (!local) return null
      const transform = d3.zoomTransform(svgEl)
      return invertZoomPoint(transform, local)
    }
  }, [])

  const getZoomTransform = React.useCallback(() => {
    const element = svgRef.current
    if (!element) return null
    return d3.zoomTransform(element)
  }, [svgRef])

  const getZoomEventTarget = React.useCallback(() => svgRef.current, [svgRef])

  const registerFrameEl = React.useCallback((id: string, el: SVGGElement | null) => {
    const map = frameElByIdRef.current
    if (el) map.set(id, el)
    else map.delete(id)
  }, [])

  const registerFrameRectEl = React.useCallback((id: string, el: SVGRectElement | null) => {
    const map = frameRectElByIdRef.current
    if (el) map.set(id, el)
    else map.delete(id)
  }, [])

  const registerFrameStatusEl = React.useCallback((id: string, el: SVGPathElement | null) => {
    const map = frameStatusElByIdRef.current
    if (el) map.set(id, el)
    else map.delete(id)
  }, [])

  const registerGroupRectEl = React.useCallback((id: string, el: SVGRectElement | null) => {
    const map = groupRectElByIdRef.current
    if (el) map.set(id, el)
    else map.delete(id)
  }, [])

  const registerGroupHandleEl = React.useCallback((id: string, el: SVGGElement | null) => {
    const map = groupHandleElByIdRef.current
    if (el) map.set(id, el)
    else map.delete(id)
  }, [])

  const registerOverlayEl = React.useCallback(
    (id: string, el: HTMLElement | null) => {
      if (!el) {
        designMediaOverlayElsRef.current.delete(id)
        return
      }
      designMediaOverlayElsRef.current.set(id, el)
    },
    [designMediaOverlayElsRef],
  )

  const shouldStartHeaderDrag = React.useCallback(() => {
    if (isSpacePanHeld()) return false
    if (canvasPointerMode2d === 'pan') return false
    return true
  }, [canvasPointerMode2d])

  const onHeaderDragStart = React.useCallback(
    ({ nodeId, pointerId }: { nodeId: string; pointerId: number }) => {
      const position = positions[nodeId]
      if (!position) return
      const svgElement = svgRef.current
      if (!svgElement) return
      const transform = d3.zoomTransform(svgElement)
      const zoomK = typeof transform.k === 'number' && Number.isFinite(transform.k) && transform.k > 0 ? transform.k : 1
      const storeSchema = ((useGraphStore.getState() as unknown as { schema?: unknown }).schema || null) as GraphSchema | null
      designMediaHeaderDragRef.current = {
        id: nodeId,
        pointerId,
        startX: position.x,
        startY: position.y,
        startK: zoomK,
        lastDx: 0,
        lastDy: 0,
        schema: schema || storeSchema,
      }
    },
    [positions, schema, svgRef],
  )

  const onHeaderDrag = React.useCallback(
    ({ nodeId, dx, dy, pointerId }: { nodeId: string; dx: number; dy: number; pointerId: number }) => {
      const state = designMediaHeaderDragRef.current
      if (!state || state.id !== nodeId || state.pointerId !== pointerId) return
      state.lastDx = dx
      state.lastDy = dy
      if (!state.schema) {
        const zoomK = Number.isFinite(state.startK) && state.startK > 0 ? state.startK : 1
        setDesignFramePosMany({ [nodeId]: { x: state.startX + dx / zoomK, y: state.startY + dy / zoomK } })
        return
      }
      const point = computeOverlayDraggedPoint2d({
        baseX: state.startX,
        baseY: state.startY,
        dxClientPx: dx,
        dyClientPx: dy,
        zoomK: state.startK,
        schema: state.schema,
        snapToGrid: false,
      })
      setDesignFramePosMany({ [nodeId]: { x: point.x, y: point.y } })
    },
    [setDesignFramePosMany],
  )

  const onHeaderDragEnd = React.useCallback(
    ({ nodeId, pointerId }: { nodeId: string; pointerId: number }) => {
      const state = designMediaHeaderDragRef.current
      if (!state || state.id !== nodeId || state.pointerId !== pointerId) return
      if (state.schema) {
        try {
          const point = computeOverlayDraggedPoint2d({
            baseX: state.startX,
            baseY: state.startY,
            dxClientPx: state.lastDx,
            dyClientPx: state.lastDy,
            zoomK: state.startK,
            schema: state.schema,
            snapToGrid: true,
          })
          setDesignFramePosMany({ [nodeId]: { x: point.x, y: point.y } })
        } catch {
          void 0
        }
      }
      designMediaHeaderDragRef.current = null
    },
    [setDesignFramePosMany],
  )

  return {
    setDesignFramePosMany,
    setDesignFrameSizeMany,
    frameElByIdRef,
    frameRectElByIdRef,
    frameStatusElByIdRef,
    groupRectElByIdRef,
    groupHandleElByIdRef,
    resizeOverlayElRef,
    designMediaHeaderDragRef,
    pointerToWorld,
    getZoomTransform,
    getZoomEventTarget,
    registerFrameEl,
    registerFrameRectEl,
    registerFrameStatusEl,
    registerGroupRectEl,
    registerGroupHandleEl,
    registerOverlayEl,
    shouldStartHeaderDrag,
    onHeaderDragStart,
    onHeaderDrag,
    onHeaderDragEnd,
  }
}
