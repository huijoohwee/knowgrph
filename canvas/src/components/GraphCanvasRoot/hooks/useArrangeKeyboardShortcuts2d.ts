import { useEffect, type MutableRefObject, type RefObject } from 'react'
import type * as d3 from 'd3'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { isEditableTarget, readArrangeShortcut, readNudgeDelta } from '@/lib/canvas/arrangeShortcuts'
import { readSnapGridConfigFromSchema } from '@/lib/canvas/gridSnap'
import type { ArrangeAction2d } from '@/lib/canvas/arrange2d'
import { freezeSimulationAndPersistLayoutPositions2d } from '@/components/GraphCanvasRoot/utils/freezeAndPersistLayout2d'

export function useArrangeKeyboardShortcuts2d(args: {
  active: boolean
  schema: GraphSchema
  selectedIds: string[]
  applyArrange: (action: ArrangeAction2d) => void
  svgRef: RefObject<SVGSVGElement | null>
  simulationRef: MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  sceneGraphDataRef: MutableRefObject<GraphData | null>
  activeLayoutCacheKeyRef: MutableRefObject<string | null>
}): void {
  const { active, schema, selectedIds, applyArrange, svgRef, simulationRef, sceneGraphDataRef, activeLayoutCacheKeyRef } = args

  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const arrange = readArrangeShortcut(e)
      if (arrange) {
        e.preventDefault()
        applyArrange(arrange)
        return
      }
      if (selectedIds.length === 0) return
      const grid = readSnapGridConfigFromSchema(schema)
      const delta = readNudgeDelta({ e, snapGridEnabled: grid.enabled, snapGridSize: grid.x, snapGridSizeY: grid.y })
      if (!delta) return
      const graphDataNow = sceneGraphDataRef.current
      if (!graphDataNow) return
      const nodes = Array.isArray(graphDataNow.nodes) ? (graphDataNow.nodes as GraphNode[]) : []
      if (nodes.length === 0) return
      const set = new Set<string>(selectedIds)
      let changed = 0
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]!
        const id = String(n.id || '').trim()
        if (!id || !set.has(id)) continue
        const x0 = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y0 = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x0 == null || y0 == null) continue
        n.x = x0 + delta.dx
        n.y = y0 + delta.dy
        n.fx = n.x
        n.fy = n.y
        n.vx = 0
        n.vy = 0
        changed += 1
      }
      if (changed === 0) return
      e.preventDefault()
      freezeSimulationAndPersistLayoutPositions2d({
        svgRef,
        simulationRef,
        nodes,
        layoutCacheKey: activeLayoutCacheKeyRef.current,
      })
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as AddEventListenerOptions)
    }
  }, [active, activeLayoutCacheKeyRef, applyArrange, schema, sceneGraphDataRef, selectedIds, simulationRef, svgRef])
}
