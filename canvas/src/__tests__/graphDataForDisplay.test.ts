import { getGraphDataForDisplay } from '@/components/GraphCanvas/displayFilter'
import type { GraphData } from '@/lib/graph/types'

export const testGraphDataForDisplayFiltersNodesAndEdgesTogether = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'test',
    metadata: {},
    nodes: [
      { id: 'h1', type: 'Section', label: 'H1', properties: { level: 1 }, metadata: {} },
      { id: 'a', type: 'Entity', label: 'A', properties: {}, metadata: {} },
    ],
    edges: [
      { id: 'e1', source: 'h1', target: 'a', label: 'contains', properties: {}, metadata: {} },
      { id: 'e2', source: 'a', target: 'a', label: 'self', properties: {}, metadata: {} },
    ],
  }

  const display = getGraphDataForDisplay({ graphData })
  const nodeIds = new Set((display.nodes || []).map(n => String((n as { id?: unknown }).id)))
  if (nodeIds.has('h1')) throw new Error('expected Section heading node to be filtered from display nodes')
  if (!nodeIds.has('a')) throw new Error('expected Entity node to remain in display nodes')
  const edgeIds = new Set((display.edges || []).map(e => String((e as { id?: unknown }).id)))
  if (edgeIds.has('e1')) throw new Error('expected edge with filtered endpoint to be removed')
  if (!edgeIds.has('e2')) throw new Error('expected edge between display endpoints to remain')
}

