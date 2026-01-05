import type { GraphData } from '@/lib/graph/types'
import { buildSelectionSubgraph } from '@/lib/graph/file'

export function testBuildSelectionSubgraphFromNode() {
  const data: GraphData = {
    context: '',
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 't', properties: {} },
      { id: 'b', label: 'B', type: 't', properties: {} },
      { id: 'c', label: 'C', type: 't', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', label: 'x', properties: {} },
      { id: 'e2', source: 'b', target: 'c', label: 'x', properties: {} },
    ],
  }
  const sub = buildSelectionSubgraph(data, 'b', null)
  if (!sub) throw new Error('expected subgraph')
  if (sub.nodes.length !== 3) throw new Error('node selection should include neighbors')
  if (sub.edges.length !== 2) throw new Error('node selection should include incident edges')
}

export function testBuildSelectionSubgraphFromEdge() {
  const data: GraphData = {
    context: '',
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 't', properties: {} },
      { id: 'b', label: 'B', type: 't', properties: {} },
      { id: 'c', label: 'C', type: 't', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', label: 'x', properties: {} },
      { id: 'e2', source: 'b', target: 'c', label: 'x', properties: {} },
    ],
  }
  const sub = buildSelectionSubgraph(data, null, 'e2')
  if (!sub) throw new Error('expected subgraph')
  if (sub.nodes.length !== 2) throw new Error('edge selection should include endpoints only')
  if (sub.edges.length !== 1) throw new Error('edge selection should include only the selected edge')
}

