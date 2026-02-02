import { getDisplayEdges, getDisplayNodes } from '@/components/GraphCanvas/displayFilter'
import type { GraphData } from '@/lib/graph/types'

export const testGraphCanvasDisplayFilterFallback = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'test',
    metadata: {},
    nodes: [
      { id: 'a', type: 'MermaidSubgraph', label: 'A', properties: {}, metadata: {} },
      { id: 'b', type: 'MermaidSubgraph', label: 'B', properties: {}, metadata: {} },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', label: 'hasMermaid', properties: {}, metadata: {} },
    ],
  }

  const displayNodes = getDisplayNodes(graphData)
  if (displayNodes.length !== 2) throw new Error(`Expected 2 fallback display nodes, got ${displayNodes.length}`)

  const displayNodeIdSet = new Set(displayNodes.map(n => String(n.id)))
  const displayEdges = getDisplayEdges({ edges: graphData.edges, displayNodeIdSet })
  if (displayEdges.length !== 1) throw new Error(`Expected 1 fallback display edge, got ${displayEdges.length}`)
}
