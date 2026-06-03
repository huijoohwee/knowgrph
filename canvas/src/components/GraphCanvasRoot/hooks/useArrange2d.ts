import { useMemo, type MutableRefObject, type RefObject } from 'react'
import type * as d3 from 'd3'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { computeArrangeCenters, type ArrangeAction2d } from '@/lib/canvas/arrange2d'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'
import { readSnapGridConfigFromSchema, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { freezeSimulationAndPersistLayoutPositions2d } from '@/components/GraphCanvasRoot/utils/freezeAndPersistLayout2d'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'

export function useArrange2d(args: {
  active: boolean
  schema: GraphSchema
  svgRef: RefObject<SVGSVGElement | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  activeLayoutCacheKeyRef: MutableRefObject<string | null>
  selectedNodeId: string | null
  selectedNodeIds: string[] | null
}) {
  const { active, schema, svgRef, simulationRef, sceneGraphDataRef, activeLayoutCacheKeyRef, selectedNodeId, selectedNodeIds } = args

  const selectedIds = useMemo(() => {
    const set = new Set<string>()
    if (selectedNodeId) {
      const id = String(selectedNodeId || '').trim()
      if (id) set.add(id)
    }
    const ids = Array.isArray(selectedNodeIds) ? selectedNodeIds : []
    for (let i = 0; i < ids.length; i += 1) {
      const id = String(ids[i] || '').trim()
      if (id) set.add(id)
    }
    return Array.from(set)
  }, [selectedNodeId, selectedNodeIds])

  const applyArrange = useMemo(() => {
    return (action: ArrangeAction2d) => {
      if (!active) return
      if (selectedIds.length < 2) return
      const graphDataNow = sceneGraphDataRef.current
      if (!graphDataNow) return
      const nodes = Array.isArray(graphDataNow.nodes) ? (graphDataNow.nodes as GraphNode[]) : []
      if (nodes.length === 0) return
      const lookup = getCachedGraphLookup({
        cacheScope: 'graph-canvas-root-arrange-2d-scene-graph',
        graphData: graphDataNow,
        preferCurrentGraphDataRefs: true,
      })
      const byId = lookup?.nodeById || new Map<string, GraphNode>()
      const refId = (() => {
        const a = String(selectedNodeId || '').trim()
        if (a && selectedIds.includes(a)) return a
        return selectedIds[0] || ''
      })()
      const grid = readSnapGridConfigFromSchema(schema)
      const gridSize = grid.enabled ? Math.max(grid.x, grid.y) : 0
      const snapX = (v: number) => (grid.enabled ? snapScalarToGrid(v, grid, 'x') : v)
      const snapY = (v: number) => (grid.enabled ? snapScalarToGrid(v, grid, 'y') : v)

      const items = selectedIds
        .map(id => {
          const n = byId.get(id)
          if (!n) return null
          const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
          const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
          if (x == null || y == null) return null
          const half = getNodeHalfExtents2d(n, schema)
          return { id, cx: x, cy: y, w: half.halfW * 2, h: half.halfH * 2 }
        })
        .filter(Boolean) as { id: string; cx: number; cy: number; w: number; h: number }[]
      if (items.length < 2) return
      const next = computeArrangeCenters({ action, items, refId, minSpacing: gridSize || 120 })
      for (let i = 0; i < items.length; i += 1) {
        const id = items[i]!.id
        const n = byId.get(id)
        const p = next[id]
        if (!n || !p) continue
        n.x = snapX(p.cx)
        n.y = snapY(p.cy)
        n.fx = n.x
        n.fy = n.y
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
  }, [active, activeLayoutCacheKeyRef, schema, sceneGraphDataRef, selectedIds, selectedNodeId, simulationRef, svgRef])

  return { selectedIds, applyArrange }
}
