import React from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readSnapGridConfigFromSchema, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { clampDelta, computeDeltaClampForTopLeftNodes, type DeltaClamp, type RectBounds } from '@/lib/canvas/groupContainment'
import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { isSpacePanHeld } from '@/lib/canvas/space-pan'
import { invertZoomPoint } from '@/lib/canvas/viewport-transform'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { relaxNodesWithCollision } from '@/components/GraphCanvas/layout/relax'

type FrameRect = {
  x: number
  y: number
  w: number
  h: number
}

type VisibleNode = {
  id: string
  label: string
}

type DragState = {
  id: string
  startWorld: { x: number; y: number }
  startPos: { x: number; y: number }
  ids: string[]
  startPosById: Record<string, { x: number; y: number }>
  deltaClamp: DeltaClamp | null
}

type DragPendingState = {
  ids: string[]
  nextPosById: Record<string, { x: number; y: number }>
}

type UseFrameDragControllerArgs = {
  active: boolean
  canvasPointerMode2d: string
  documentStructureBaselineLock: boolean
  schema: GraphSchema | null | undefined
  positions: Record<string, FrameRect>
  visibleNodes: VisibleNode[]
  explicitGroupRectByNodeId: Map<string, RectBounds>
  frameElByIdRef: React.MutableRefObject<Map<string, SVGGElement>>
  svgRef: React.MutableRefObject<SVGSVGElement | null>
  commitDesignFramePosHistory: (args: { label: string; patch: Record<string, { x: number; y: number }> }) => void
  activeWebpageOverlayNodeCount: number
  frameDefaultWidth: number
  frameDefaultHeight: number
}

function pointerToWorld(event: React.PointerEvent, svgEl: SVGSVGElement): { x: number; y: number } | null {
  const local = readElementLocalPoint({ el: svgEl, event })
  if (!local) return null
  return invertZoomPoint(d3.zoomTransform(svgEl), local)
}

export function useFrameDragController(args: UseFrameDragControllerArgs) {
  const {
    active,
    canvasPointerMode2d,
    documentStructureBaselineLock,
    schema,
    positions,
    visibleNodes,
    explicitGroupRectByNodeId,
    frameElByIdRef,
    svgRef,
    commitDesignFramePosHistory,
    activeWebpageOverlayNodeCount,
    frameDefaultWidth,
    frameDefaultHeight,
  } = args

  const dragRef = React.useRef<DragState | null>(null)
  const dragRafRef = React.useRef<number | null>(null)
  const dragPendingRef = React.useRef<DragPendingState | null>(null)

  const scheduleDragVisual = React.useMemo(() => {
    return () => {
      if (dragRafRef.current != null) return
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null
        const pending = dragPendingRef.current
        if (!pending) return
        const ids = pending.ids || []
        for (let i = 0; i < ids.length; i += 1) {
          const id = String(ids[i] || '').trim()
          if (!id) continue
          const pos = pending.nextPosById?.[id]
          if (!pos) continue
          const el = frameElByIdRef.current.get(id)
          if (!el) continue
          try {
            el.setAttribute('transform', `translate(${pos.x},${pos.y})`)
          } catch {
            void 0
          }
        }
      })
    }
  }, [frameElByIdRef])

  React.useEffect(() => {
    return () => {
      if (dragRafRef.current != null) {
        try {
          window.cancelAnimationFrame(dragRafRef.current)
        } catch {
          void 0
        }
        dragRafRef.current = null
      }
      dragPendingRef.current = null
      dragRef.current = null
    }
  }, [])

  const handleFramePointerDown = React.useCallback(
    (id: string, rect: { x: number; y: number; w: number; h: number }, event: React.PointerEvent<SVGGElement>) => {
      if (!active) return
      if (isSpacePanHeld()) return
      if (canvasPointerMode2d === 'pan') return
      event.stopPropagation()
      const svgEl = svgRef.current
      if (!svgEl) return
      const world = pointerToWorld(event, svgEl)
      if (!world) return
      const store = useGraphStore.getState()
      store.setSelectionSource('canvas')
      const mode = store.schema?.behavior?.selectMode || 'single'
      const clickedId = String(id || '').trim()
      if (clickedId) {
        if (mode === 'multi' || mode === 'lasso') {
          if (event.shiftKey) store.selectNode(clickedId)
          else store.selectNodesExpanded({ nodeIds: [clickedId], activeNodeId: clickedId })
        } else {
          store.selectNode(clickedId)
        }
      }
      const selectedIds = (store.selectedNodeIds || []).map(value => String(value || '').trim()).filter(Boolean)
      const ids = clickedId && selectedIds.includes(clickedId) ? selectedIds : clickedId ? [clickedId] : []
      if (documentStructureBaselineLock) return
      if (activeWebpageOverlayNodeCount > 0) return
      try {
        ;(event.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId)
      } catch {
        void 0
      }
      const startPosById: Record<string, { x: number; y: number }> = {}
      for (let i = 0; i < ids.length; i += 1) {
        const nextId = ids[i]!
        const base = positions[nextId]
        if (!base) continue
        startPosById[nextId] = { x: base.x, y: base.y }
      }
      const startPosMap = new Map<string, { x: number; y: number }>()
      const sizeById = new Map<string, { w: number; h: number }>()
      for (let i = 0; i < ids.length; i += 1) {
        const nextId = ids[i]!
        const startPos = startPosById[nextId]
        if (startPos) startPosMap.set(nextId, startPos)
        const base = positions[nextId]
        if (base) sizeById.set(nextId, { w: base.w, h: base.h })
      }
      const deltaClamp =
        explicitGroupRectByNodeId.size > 0
          ? computeDeltaClampForTopLeftNodes({ nodeIds: ids, startPosById: startPosMap, sizeById, rectByNodeId: explicitGroupRectByNodeId })
          : null
      dragRef.current = { id, startWorld: world, startPos: { x: rect.x, y: rect.y }, ids, startPosById, deltaClamp }
    },
    [active, activeWebpageOverlayNodeCount, canvasPointerMode2d, documentStructureBaselineLock, explicitGroupRectByNodeId, positions, svgRef],
  )

  const handleFramePointerMove = React.useCallback(
    (event: React.PointerEvent<SVGGElement>) => {
      const drag = dragRef.current
      if (!drag || !active) return
      const svgEl = svgRef.current
      if (!svgEl) return
      const world = pointerToWorld(event, svgEl)
      if (!world) return
      const dx = world.x - drag.startWorld.x
      const dy = world.y - drag.startWorld.y
      let snappedDx = dx
      let snappedDy = dy
      const grid = readSnapGridConfigFromSchema(schema)
      if (grid.enabled && !event.altKey) {
        const snappedX = snapScalarToGrid(drag.startPos.x + dx, grid, 'x')
        const snappedY = snapScalarToGrid(drag.startPos.y + dy, grid, 'y')
        snappedDx = snappedX - drag.startPos.x
        snappedDy = snappedY - drag.startPos.y
      }
      if (drag.deltaClamp) {
        const clamped = clampDelta({ clamp: drag.deltaClamp, dx: snappedDx, dy: snappedDy })
        snappedDx = clamped.dx
        snappedDy = clamped.dy
      }
      const nextPosById: Record<string, { x: number; y: number }> = {}
      const ids = drag.ids || []
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i] || ''
        const start = drag.startPosById[id]
        if (!start) continue
        const nextX = start.x + snappedDx
        const nextY = start.y + snappedDy
        if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) continue
        nextPosById[id] = { x: nextX, y: nextY }
      }
      dragPendingRef.current = { ids: ids.slice(), nextPosById }
      scheduleDragVisual()
    },
    [active, scheduleDragVisual, schema, svgRef],
  )

  const handleFramePointerUp = React.useCallback(() => {
    if (!active) {
      dragRef.current = null
      return
    }
    const drag = dragRef.current
    dragRef.current = null
    const pending = dragPendingRef.current
    dragPendingRef.current = null
    if (dragRafRef.current != null) {
      try {
        window.cancelAnimationFrame(dragRafRef.current)
      } catch {
        void 0
      }
      dragRafRef.current = null
    }
    const updates: Record<string, { x: number; y: number }> = {}
    if (pending) {
      const ids = pending.ids || []
      for (let i = 0; i < ids.length; i += 1) {
        const id = String(ids[i] || '').trim()
        const pos = id ? pending.nextPosById?.[id] : null
        if (id && pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) updates[id] = { x: pos.x, y: pos.y }
      }
    }
    const allowRelax = activeWebpageOverlayNodeCount <= 0 && !!schema
    const workPos: Record<string, { x: number; y: number; w: number; h: number }> = {}
    for (let i = 0; i < visibleNodes.length; i += 1) {
      const node = visibleNodes[i]
      const base = positions[node.id]
      if (!base) continue
      workPos[node.id] = { x: base.x, y: base.y, w: base.w, h: base.h }
    }
    if (pending) {
      const ids = pending.ids || []
      for (let i = 0; i < ids.length; i += 1) {
        const id = String(ids[i] || '').trim()
        const next = id ? pending.nextPosById?.[id] : null
        if (id && next && workPos[id]) workPos[id] = { ...workPos[id]!, x: next.x, y: next.y }
      }
    }
    const allIds = Object.keys(workPos)
    if (allowRelax && allIds.length >= 3 && schema) {
      let cell = 0
      for (let i = 0; i < allIds.length; i += 1) {
        const p = workPos[allIds[i]!]!
        cell = Math.max(cell, Math.floor(Math.max(p.w, p.h) * 0.75))
      }
      cell = Math.max(8, cell)
      const counts = new Map<string, number>()
      for (let i = 0; i < allIds.length; i += 1) {
        const p = workPos[allIds[i]!]!
        const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`
        counts.set(key, (counts.get(key) || 0) + 1)
      }
      let collisions = 0
      for (const count of counts.values()) {
        if (count > 1) collisions += count - 1
      }
      if (collisions / Math.max(1, allIds.length) >= 0.02) {
        const nodes: GraphNode[] = []
        for (let i = 0; i < visibleNodes.length; i += 1) {
          const node = visibleNodes[i]
          const p = workPos[node.id]
          if (!p) continue
          nodes.push({
            id: node.id,
            label: node.label,
            type: 'Frame',
            properties: {
              'visual:width': p.w,
              'visual:height': p.h,
              'visual:shape': 'rect',
            },
            x: p.x + p.w / 2,
            y: p.y + p.h / 2,
            vx: 0,
            vy: 0,
          })
        }
        const pinnedId = drag && String(drag.id || '').trim()
        if (pinnedId) {
          for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i]
            if (String(node.id) !== pinnedId) continue
            ;(node as unknown as { fx?: number; fy?: number }).fx = node.x
            ;(node as unknown as { fx?: number; fy?: number }).fy = node.y
            break
          }
        }
        relaxNodesWithCollision({ nodes, edges: [], schema, defaultSteps: 12 })
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i]
          const id = String(node.id || '')
          const width =
            typeof (node.properties as Record<string, unknown>)['visual:width'] === 'number'
              ? ((node.properties as Record<string, unknown>)['visual:width'] as number)
              : frameDefaultWidth
          const height =
            typeof (node.properties as Record<string, unknown>)['visual:height'] === 'number'
              ? ((node.properties as Record<string, unknown>)['visual:height'] as number)
              : frameDefaultHeight
          const x = (typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0) - width / 2
          const y = (typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0) - height / 2
          const previous = workPos[id]
          if (!previous) continue
          if (Math.abs(previous.x - x) < 0.5 && Math.abs(previous.y - y) < 0.5) continue
          updates[id] = { x, y }
        }
      }
    }
    if (Object.keys(updates).length > 0) commitDesignFramePosHistory({ label: 'Move', patch: updates })
  }, [
    active,
    activeWebpageOverlayNodeCount,
    commitDesignFramePosHistory,
    frameDefaultHeight,
    frameDefaultWidth,
    positions,
    schema,
    visibleNodes,
  ])

  const handleFramePointerCancel = React.useCallback((id: string, rect: { x: number; y: number }) => {
    dragRef.current = null
    dragPendingRef.current = null
    if (dragRafRef.current != null) {
      try {
        window.cancelAnimationFrame(dragRafRef.current)
      } catch {
        void 0
      }
      dragRafRef.current = null
    }
    const el = frameElByIdRef.current.get(id)
    if (!el) return
    try {
      el.setAttribute('transform', `translate(${rect.x},${rect.y})`)
    } catch {
      void 0
    }
  }, [frameElByIdRef])

  return {
    dragRef,
    dragPendingRef,
    dragRafRef,
    handleFramePointerDown,
    handleFramePointerMove,
    handleFramePointerUp,
    handleFramePointerCancel,
  }
}
