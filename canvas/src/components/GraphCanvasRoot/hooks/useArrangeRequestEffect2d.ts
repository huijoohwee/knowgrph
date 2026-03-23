import { useEffect, type MutableRefObject, type RefObject } from 'react'
import * as d3 from 'd3'
import type * as d3Types from 'd3'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { computeCenteredTransformToWorldPoint } from '@/lib/canvas/centerTransform'
import { computeEvenlyDistributedPositions } from '@/lib/canvas/evenDistribute'
import { freezeSimulationAndPersistLayoutPositions2d } from '@/components/GraphCanvasRoot/utils/freezeAndPersistLayout2d'

export function useArrangeRequestEffect2d(args: {
  active: boolean
  graphCanvasArrangeRequest: unknown
  clearGraphCanvasArrangeRequest: () => void
  svgRef: RefObject<SVGSVGElement | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  selectedNodeIdRef: MutableRefObject<string | null>
  selectedNodeIdsRef: MutableRefObject<string[] | undefined>
  sceneWidth: number
  sceneHeight: number
  simulationRef: MutableRefObject<d3Types.Simulation<GraphNode, GraphEdge> | null>
  activeLayoutCacheKeyRef: MutableRefObject<string | null>
}): void {
  const {
    active,
    graphCanvasArrangeRequest,
    clearGraphCanvasArrangeRequest,
    svgRef,
    sceneGraphDataRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    sceneWidth,
    sceneHeight,
    simulationRef,
    activeLayoutCacheKeyRef,
  } = args

  useEffect(() => {
    const req = graphCanvasArrangeRequest as
      | null
      | undefined
      | { type: 'center'; scope: 'all' | 'selection' }
      | { type: 'distribute'; axis: 'x' | 'y' }

    if (!active) return
    if (!req) return
    try {
      clearGraphCanvasArrangeRequest()
    } catch {
      void 0
    }

    const svgEl = svgRef.current
    if (!svgEl) return
    const graphDataNow = sceneGraphDataRef.current
    if (!graphDataNow) return
    const nodes = Array.isArray(graphDataNow.nodes) ? (graphDataNow.nodes as GraphNode[]) : []
    if (nodes.length === 0) return

    const selectionIds = (() => {
      const multi = Array.isArray(selectedNodeIdsRef.current) ? (selectedNodeIdsRef.current as unknown[]) : []
      if (multi.length > 0) return multi
      const single = selectedNodeIdRef.current
      return single ? [single] : []
    })().map(v => String(v))

    if (req.type === 'center') {
      const scopeNodes = req.scope === 'all' ? nodes : nodes.filter(n => selectionIds.includes(String(n.id)))
      if (scopeNodes.length === 0) return
      let cx = 0
      let cy = 0
      let count = 0
      for (let i = 0; i < scopeNodes.length; i += 1) {
        const n = scopeNodes[i]
        const x = typeof n.x === 'number' ? n.x : null
        const y = typeof n.y === 'number' ? n.y : null
        if (x == null || y == null) continue
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        cx += x
        cy += y
        count += 1
      }
      if (count <= 0) return
      cx /= count
      cy /= count
      const w = Math.max(1, Math.floor(sceneWidth))
      const h = Math.max(1, Math.floor(sceneHeight))
      const t = d3.zoomTransform(svgEl)
      const next = computeCenteredTransformToWorldPoint({ transform: { k: t.k, x: t.x, y: t.y }, viewportW: w, viewportH: h, worldX: cx, worldY: cy })
      useGraphStore.getState().requestZoomTransform(next)
      return
    }

    if (req.type === 'distribute') {
      const selectedNodes = nodes.filter(n => selectionIds.includes(String(n.id)))
      if (selectedNodes.length < 3) return
      const update = computeEvenlyDistributedPositions({
        nodes: selectedNodes.map(n => ({
          id: String(n.id),
          x: typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0,
          y: typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0,
        })),
        axis: req.axis,
        minSpacing: 120,
      })
      const byId = new Map<string, { x: number; y: number }>(Object.entries(update))
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n.id)
        const p = byId.get(id)
        if (!p) continue
        n.x = p.x
        n.y = p.y
        n.fx = p.x
        n.fy = p.y
        n.vx = 0
        n.vy = 0
      }
      freezeSimulationAndPersistLayoutPositions2d({
        svgRef,
        simulationRef,
        nodes,
        layoutCacheKey: activeLayoutCacheKeyRef.current,
      })
    }
  }, [active, activeLayoutCacheKeyRef, clearGraphCanvasArrangeRequest, graphCanvasArrangeRequest, sceneHeight, sceneWidth, sceneGraphDataRef, selectedNodeIdRef, selectedNodeIdsRef, simulationRef, svgRef])
}
