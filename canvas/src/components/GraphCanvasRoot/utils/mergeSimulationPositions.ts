import type * as d3 from 'd3'

import type { GraphEdge, GraphNode } from '@/lib/graph/types'

export function mergeSimulationPositionsIntoLayoutCache(
  prevPositions: Record<string, { x: number; y: number }>,
  simulation: d3.Simulation<GraphNode, GraphEdge> | null | undefined,
): void {
  const simNodes = simulation ? (simulation.nodes() as unknown as GraphNode[]) : []
  for (let i = 0; i < simNodes.length; i += 1) {
    const node = simNodes[i]
    const id = String(node?.id || '').trim()
    if (!id || prevPositions[id]) continue
    const x = (node as unknown as { x?: unknown }).x
    const y = (node as unknown as { y?: unknown }).y
    if (typeof x !== 'number' || typeof y !== 'number') continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    prevPositions[id] = { x, y }
  }
}
