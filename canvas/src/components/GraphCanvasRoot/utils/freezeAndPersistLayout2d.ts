import type * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'

export function freezeSimulationAndPersistLayoutPositions2d(args: {
  svgRef: import('react').RefObject<SVGSVGElement | null>
  simulationRef: import('react').MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>
  nodes: GraphNode[]
  layoutCacheKey: string | null
}): void {
  const { svgRef, simulationRef, nodes, layoutCacheKey } = args

  try {
    simulationRef.current?.stop()
  } catch {
    void 0
  }
  try {
    svgRef.current?.setAttribute('data-kg-layout-frozen', '1')
  } catch {
    void 0
  }
  try {
    const tickHandler = simulationRef.current?.on('tick')
    if (typeof tickHandler === 'function') (tickHandler as unknown as () => void)()
  } catch {
    void 0
  }

  if (!layoutCacheKey) return
  const positions: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const id = String(n.id)
    const x = typeof n.x === 'number' ? n.x : null
    const y = typeof n.y === 'number' ? n.y : null
    if (!id || x == null || y == null) continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    positions[id] = { x, y }
  }
  if (Object.keys(positions).length === 0) return
  useGraphStore.getState().setLayoutPositionsForMode(layoutCacheKey, positions)
}
