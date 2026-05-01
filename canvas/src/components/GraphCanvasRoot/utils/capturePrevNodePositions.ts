import type * as d3 from 'd3'

import { mergeSimulationPositionsIntoLayoutCache } from '@/components/GraphCanvasRoot/utils/mergeSimulationPositions'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'

export function capturePrevNodePositions(args: {
  nodesSelection: d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null
  simulation: d3.Simulation<GraphNode, GraphEdge> | null | undefined
}): Record<string, { x: number; y: number }> {
  const prevPositions: Record<string, { x: number; y: number }> = {}
  if (args.nodesSelection) {
    args.nodesSelection.each((node: GraphNode) => {
      if (node.id && typeof node.x === 'number' && typeof node.y === 'number' && Number.isFinite(node.x) && Number.isFinite(node.y)) {
        prevPositions[String(node.id)] = { x: node.x, y: node.y }
      }
    })
  }
  mergeSimulationPositionsIntoLayoutCache(prevPositions, args.simulation)
  return prevPositions
}
