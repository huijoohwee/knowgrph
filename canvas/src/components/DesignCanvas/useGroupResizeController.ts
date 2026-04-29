import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { computeGroupResizeBottomRight, computeMinGroupResizeSize } from '@/lib/canvas/groupResizeMath2d'
import { commitGroupBoundsOverrideToStore } from '@/lib/canvas/groupBoundsOverridesStore'
import { readSnapGridConfigFromSchema } from '@/lib/canvas/gridSnap'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import type { GraphSchema } from '@/lib/graph/schema'

type GroupBounds = {
  x: number
  y: number
  w: number
  h: number
}

type GroupResizeState = {
  groupId: string
  pointerId: number
  startWorld: { x: number; y: number }
  startBounds: GroupBounds
  minW: number
  minH: number
}

type GroupResizePendingState = {
  groupId: string
  x: number
  y: number
  w: number
  h: number
}

type PointerToWorld = (event: React.PointerEvent, svgEl: SVGSVGElement) => { x: number; y: number } | null

type UseGroupResizeControllerArgs = {
  active: boolean
  interactionActive: boolean
  documentStructureBaselineLock: boolean
  allowGroupResize: boolean
  schema: GraphSchema | null | undefined
  svgRef: React.MutableRefObject<SVGSVGElement | null>
  pointerToWorld: PointerToWorld
  groupRectElByIdRef: React.MutableRefObject<Map<string, SVGRectElement>>
  groupHandleElByIdRef: React.MutableRefObject<Map<string, SVGGElement>>
  positions: Record<string, GroupBounds>
  designGroupBoundsById: Record<string, GroupBounds>
  minBoundsSizePx: number
}

export function useGroupResizeController(args: UseGroupResizeControllerArgs) {
  const {
    active,
    interactionActive,
    documentStructureBaselineLock,
    allowGroupResize,
    schema,
    svgRef,
    pointerToWorld,
    groupRectElByIdRef,
    groupHandleElByIdRef,
    positions,
    designGroupBoundsById,
    minBoundsSizePx,
  } = args

  const groupResizeRef = React.useRef<GroupResizeState | null>(null)
  const groupResizeRafRef = React.useRef<number | null>(null)
  const groupResizePendingRef = React.useRef<GroupResizePendingState | null>(null)

  const scheduleGroupResizeVisual = React.useMemo(() => {
    return () => {
      if (groupResizeRafRef.current != null) return
      groupResizeRafRef.current = window.requestAnimationFrame(() => {
        groupResizeRafRef.current = null
        const pending = groupResizePendingRef.current
        if (!pending) return
        const id = String(pending.groupId || '').trim()
        if (!id) return
        const rectEl = groupRectElByIdRef.current.get(id)
        if (rectEl) {
          try {
            rectEl.setAttribute('x', String(pending.x))
            rectEl.setAttribute('y', String(pending.y))
            rectEl.setAttribute('width', String(Math.max(1, pending.w)))
            rectEl.setAttribute('height', String(Math.max(1, pending.h)))
          } catch {
            void 0
          }
        }
        const handleEl = groupHandleElByIdRef.current.get(id)
        if (handleEl) {
          try {
            handleEl.setAttribute('transform', `translate(${pending.x + pending.w},${pending.y + pending.h})`)
          } catch {
            void 0
          }
        }
      })
    }
  }, [groupHandleElByIdRef, groupRectElByIdRef])

  const cancelGroupResize = React.useCallback((svgEl: SVGSVGElement | null) => {
    const resize = groupResizeRef.current
    if (!resize) return
    groupResizeRef.current = null
    const pending = {
      groupId: resize.groupId,
      x: resize.startBounds.x,
      y: resize.startBounds.y,
      w: resize.startBounds.w,
      h: resize.startBounds.h,
    }
    const id = String(pending.groupId || '').trim()
    if (id) {
      const rectEl = groupRectElByIdRef.current.get(id)
      if (rectEl) {
        try {
          rectEl.setAttribute('x', String(pending.x))
          rectEl.setAttribute('y', String(pending.y))
          rectEl.setAttribute('width', String(Math.max(1, pending.w)))
          rectEl.setAttribute('height', String(Math.max(1, pending.h)))
        } catch {
          void 0
        }
      }
      const handleEl = groupHandleElByIdRef.current.get(id)
      if (handleEl) {
        try {
          handleEl.setAttribute('transform', `translate(${pending.x + pending.w},${pending.y + pending.h})`)
        } catch {
          void 0
        }
      }
    }
    if (groupResizeRafRef.current != null) {
      try {
        window.cancelAnimationFrame(groupResizeRafRef.current)
      } catch {
        void 0
      }
      groupResizeRafRef.current = null
    }
    groupResizePendingRef.current = null
    try {
      svgEl?.releasePointerCapture?.(resize.pointerId)
    } catch {
      void 0
    }
  }, [groupHandleElByIdRef, groupRectElByIdRef])

  React.useEffect(() => {
    const svgEl = svgRef.current
    return () => {
      cancelGroupResize(svgEl)
    }
  }, [cancelGroupResize, svgRef])

  const beginGroupResize = React.useCallback((
    event: React.PointerEvent,
    args: { groupId: string; memberNodeIds: string[]; startBounds: GroupBounds },
  ) => {
    if (!interactionActive) return
    if (documentStructureBaselineLock) return
    if (!allowGroupResize) return
    if (isSpacePanHeld()) return
    event.stopPropagation()
    try {
      event.preventDefault()
    } catch {
      void 0
    }
    const svgEl = svgRef.current
    if (!svgEl) return
    const world = pointerToWorld(event, svgEl)
    if (!world) return
    try {
      ;(svgEl as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId)
    } catch {
      void 0
    }
    const groupId = String(args.groupId || '').trim()
    if (!groupId) return
    const store = useGraphStore.getState()
    store.setSelectionSource('canvas')
    store.selectGroup(groupId)
    const liveSchema = store.schema as GraphSchema | null
    const cfg = liveSchema?.layout?.groups as unknown as { padding?: unknown } | null
    const padding = typeof cfg?.padding === 'number' && Number.isFinite(cfg.padding) ? Math.max(0, cfg.padding) : 24
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let valid = 0
    for (let i = 0; i < args.memberNodeIds.length; i += 1) {
      const nodeId = String(args.memberNodeIds[i] || '').trim()
      if (!nodeId) continue
      const position = positions[nodeId]
      if (!position) continue
      const x0 = position.x
      const y0 = position.y
      const x1 = position.x + position.w
      const y1 = position.y + position.h
      if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) continue
      if (x0 < minX) minX = x0
      if (y0 < minY) minY = y0
      if (x1 > maxX) maxX = x1
      if (y1 > maxY) maxY = y1
      valid += 1
    }
    const autoW = valid && minX !== Infinity ? Math.max(1, maxX - minX + padding * 2) : 0
    const autoH = valid && minY !== Infinity ? Math.max(1, maxY - minY + padding * 2) : 0
    const autoX = valid && minX !== Infinity ? minX - padding : Number.NaN
    const autoY = valid && minY !== Infinity ? minY - padding : Number.NaN
    const start = designGroupBoundsById[groupId] || args.startBounds
    const min = computeMinGroupResizeSize({
      minBoundsSizePx,
      explicitBounds: { x: start.x, y: start.y, w: start.w, h: start.h },
      autoBounds:
        valid && Number.isFinite(autoX) && Number.isFinite(autoY) && autoW > 0 && autoH > 0
          ? { x: autoX, y: autoY, w: autoW, h: autoH }
          : null,
    })
    groupResizeRef.current = {
      groupId,
      pointerId: event.pointerId,
      startWorld: world,
      startBounds: { x: start.x, y: start.y, w: start.w, h: start.h },
      minW: min.minW,
      minH: min.minH,
    }
  }, [
    allowGroupResize,
    designGroupBoundsById,
    documentStructureBaselineLock,
    interactionActive,
    minBoundsSizePx,
    pointerToWorld,
    positions,
    svgRef,
  ])

  const handleSvgPointerMove = React.useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const resize = groupResizeRef.current
    if (!resize || event.pointerId !== resize.pointerId) return false
    if (!active) return true
    const svgEl = svgRef.current
    if (!svgEl) return true
    const world = pointerToWorld(event, svgEl)
    if (!world) return true
    const next = computeGroupResizeBottomRight({
      startBounds: resize.startBounds,
      startWorld: resize.startWorld,
      world,
      minW: resize.minW,
      minH: resize.minH,
      snapGrid: readSnapGridConfigFromSchema(schema),
      altDown: event.altKey,
    })
    groupResizePendingRef.current = { groupId: resize.groupId, x: next.x, y: next.y, w: next.w, h: next.h }
    scheduleGroupResizeVisual()
    return true
  }, [active, pointerToWorld, scheduleGroupResizeVisual, schema, svgRef])

  const handleSvgPointerUp = React.useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const resize = groupResizeRef.current
    if (!resize || event.pointerId !== resize.pointerId) return false
    groupResizeRef.current = null
    const pending = groupResizePendingRef.current
    groupResizePendingRef.current = null
    if (groupResizeRafRef.current != null) {
      try {
        window.cancelAnimationFrame(groupResizeRafRef.current)
      } catch {
        void 0
      }
      groupResizeRafRef.current = null
    }
    if (!interactionActive || !pending) return true
    const id = String(resize.groupId || '').trim()
    if (!id || pending.groupId !== id) return true
    if (!Number.isFinite(pending.x) || !Number.isFinite(pending.y) || !Number.isFinite(pending.w) || !Number.isFinite(pending.h)) return true
    commitGroupBoundsOverrideToStore(id, { x: pending.x, y: pending.y, width: pending.w, height: pending.h })
    return true
  }, [interactionActive])

  const handleSvgPointerCancel = React.useCallback(() => {
    const resize = groupResizeRef.current
    if (!resize) return false
    groupResizeRef.current = null
    groupResizePendingRef.current = {
      groupId: resize.groupId,
      x: resize.startBounds.x,
      y: resize.startBounds.y,
      w: resize.startBounds.w,
      h: resize.startBounds.h,
    }
    scheduleGroupResizeVisual()
    groupResizePendingRef.current = null
    if (groupResizeRafRef.current != null) {
      try {
        window.cancelAnimationFrame(groupResizeRafRef.current)
      } catch {
        void 0
      }
      groupResizeRafRef.current = null
    }
    return true
  }, [scheduleGroupResizeVisual])

  return {
    groupResizeRef,
    beginGroupResize,
    handleSvgPointerMove,
    handleSvgPointerUp,
    handleSvgPointerCancel,
    cancelGroupResize,
  }
}
