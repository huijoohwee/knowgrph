import React, { useCallback, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'
import { invertZoomPoint } from '@/lib/canvas/viewport-transform'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'

export function useMarqueeSelection2d(args: {
  active: boolean
  schema: GraphSchema | null
  svgRef: React.RefObject<SVGSVGElement | null>
  sceneGraphDataRef: React.MutableRefObject<GraphData | null>
}) {
  const { active, schema, svgRef, sceneGraphDataRef } = args
  const [marqueeBox, setMarqueeBox] = useState<null | { left: number; top: number; width: number; height: number }>(null)
  const marqueeRef = useRef<
    null | { start: { sx: number; sy: number }; end: { sx: number; sy: number }; mode: 'replace' | 'add' | 'remove'; pointerId: number }
  >(null)

  React.useEffect(() => {
    if (!marqueeBox) return
    const end = () => {
      marqueeRef.current = null
      setMarqueeBox(null)
    }
    const onVisibility = () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') end()
      } catch {
        void 0
      }
    }
    window.addEventListener('pointerup', end, { capture: true })
    window.addEventListener('pointercancel', end, { capture: true })
    window.addEventListener('blur', end)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    const watchdog = window.setTimeout(end, 12000) as unknown as number
    return () => {
      window.removeEventListener('pointerup', end, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('pointercancel', end, { capture: true } as AddEventListenerOptions)
      window.removeEventListener('blur', end)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
      try {
        window.clearTimeout(watchdog)
      } catch {
        void 0
      }
    }
  }, [marqueeBox])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!active) return
      if (e.button !== 0) return
      const svgEl = svgRef.current
      if (!svgEl) return
      if (e.target !== svgEl) return
      const selectMode = schema?.behavior?.selectMode || 'single'
      if (selectMode !== 'lasso') return
      const local = readElementLocalPoint({ el: svgEl, event: e })
      if (!local) return
      try {
        ;(e.currentTarget as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
      } catch {
        void 0
      }
      const mode: 'replace' | 'add' | 'remove' = e.altKey ? 'remove' : e.shiftKey || e.metaKey || e.ctrlKey ? 'add' : 'replace'
      marqueeRef.current = { start: { sx: local.sx, sy: local.sy }, end: { sx: local.sx, sy: local.sy }, mode, pointerId: e.pointerId }
      setMarqueeBox({ left: local.sx, top: local.sy, width: 1, height: 1 })
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    },
    [active, schema, svgRef],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const m = marqueeRef.current
      if (!m) return
      if (e.pointerId !== m.pointerId) return
      const svgEl = svgRef.current
      if (!svgEl) return
      const local = readElementLocalPoint({ el: svgEl, event: e })
      if (!local) return
      marqueeRef.current = { ...m, end: { sx: local.sx, sy: local.sy } }
      const left = Math.min(m.start.sx, local.sx)
      const top = Math.min(m.start.sy, local.sy)
      const right = Math.max(m.start.sx, local.sx)
      const bottom = Math.max(m.start.sy, local.sy)
      setMarqueeBox({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
    },
    [svgRef],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const m = marqueeRef.current
      marqueeRef.current = null
      setMarqueeBox(null)
      if (!active) return
      const svgEl = svgRef.current
      if (!svgEl) return
      if (!m || e.pointerId !== m.pointerId) return
      const w = Math.abs(m.end.sx - m.start.sx)
      const h = Math.abs(m.end.sy - m.start.sy)
      if (w < 6 || h < 6) return
      const t = d3.zoomTransform(svgEl)
      const a = invertZoomPoint(t, m.start)
      const b = invertZoomPoint(t, m.end)
      const minX = Math.min(a.x, b.x)
      const minY = Math.min(a.y, b.y)
      const maxX = Math.max(a.x, b.x)
      const maxY = Math.max(a.y, b.y)
      const graphDataNow = sceneGraphDataRef.current
      if (!graphDataNow) return
      const nodes = Array.isArray(graphDataNow.nodes) ? (graphDataNow.nodes as GraphNode[]) : []
      const hits: string[] = []
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]!
        const id = String(n.id || '').trim()
        if (!id) continue
        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x == null || y == null) continue
        const half = getNodeHalfExtents2d(n, schema)
        const nMinX = x - half.halfW
        const nMaxX = x + half.halfW
        const nMinY = y - half.halfH
        const nMaxY = y + half.halfH
        const intersects = nMinX <= maxX && nMaxX >= minX && nMinY <= maxY && nMaxY >= minY
        if (intersects) hits.push(id)
      }
      const st = useGraphStore.getState()
      st.setSelectionSource('canvas')
      st.selectEdge(null)
      const prevRaw = Array.isArray(st.selectedNodeIds) ? st.selectedNodeIds : []
      const prev = prevRaw.map(v => String(v || '').trim()).filter(Boolean)
      if (m.mode === 'remove') {
        const drop = new Set<string>(hits)
        const next = prev.filter(id => !drop.has(id))
        st.selectNodesExpanded({ nodeIds: next, activeNodeId: next.length > 0 ? next[next.length - 1] : null })
      } else if (m.mode === 'add') {
        const set = new Set<string>(prev)
        for (let i = 0; i < hits.length; i += 1) set.add(hits[i]!)
        const next = Array.from(set)
        st.selectNodesExpanded({ nodeIds: next, activeNodeId: next.length > 0 ? next[next.length - 1] : null })
      } else {
        st.selectNodesExpanded({ nodeIds: hits, activeNodeId: hits.length > 0 ? hits[hits.length - 1] : null })
      }
    },
    [active, schema, sceneGraphDataRef, svgRef],
  )

  return {
    marqueeBox,
    svgPointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
  }
}
