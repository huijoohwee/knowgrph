import { getDisplayEdges, getDisplayNodes } from '@/components/GraphCanvas/displayFilter'
import type { GraphData } from '@/lib/graph/types'

export const testD3FrontmatterMermaidSubgraphEdgesNotDropped = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'frontmatter-mermaid',
    metadata: { layoutEngine: 'mermaid' },
    nodes: [
      { id: 'sg', type: 'MermaidSubgraph', label: 'Subgraph', properties: {}, metadata: {} },
      { id: 'n1', type: 'MermaidNode', label: 'Node', properties: {}, metadata: {} },
    ],
    edges: [
      { id: 'e1', source: 'sg', target: 'n1', label: 'hasMermaidNode', properties: {}, metadata: {} },
    ],
  }

  const displayNodes = getDisplayNodes(graphData)
  const displayNodeIdSet = new Set(displayNodes.map(n => String(n.id).trim()).filter(Boolean))
  const displayEdges = getDisplayEdges({ edges: graphData.edges, displayNodeIdSet })
  if (displayEdges.length !== 1) {
    throw new Error(`Expected membership edge to remain visible, got ${displayEdges.length}`)
  }
}

