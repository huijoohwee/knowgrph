import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { deriveGraphDataWithGroupCollapse, collapsedGroupNodeIdFor } from '@/components/GraphCanvas/viewDerivation'

export const testGroupCollapseDerivationCollapsesCommunityIntoGroupNode = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'A', type: 'Entity', properties: { 'visual:community': 0 } },
    { id: 'b', label: 'B', type: 'Entity', properties: { 'visual:community': 0 } },
    { id: 'c', label: 'C', type: 'Entity', properties: { 'visual:community': 1 } },
    { id: 'd', label: 'D', type: 'Entity', properties: { 'visual:community': 1 } },
  ]
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'a', target: 'c', label: 'rel', properties: { 'visual:width': 3 } },
    { id: 'e2', source: 'b', target: 'd', label: 'rel', properties: { 'visual:width': 2 } },
  ]
  const graphData: GraphData = { type: 'Graph', nodes, edges }
  const collapsed = deriveGraphDataWithGroupCollapse({
    graphData,
    collapsedGroupIds: ['community:0'],
  })
  const groupNodeId = collapsedGroupNodeIdFor('community:0')
  const outNodeIds = new Set(collapsed.nodes.map(n => n.id))
  if (!outNodeIds.has(groupNodeId)) throw new Error('should include collapsed community group node')
  if (outNodeIds.has('a') || outNodeIds.has('b')) throw new Error('should hide member nodes when collapsed')
  if (!outNodeIds.has('c') || !outNodeIds.has('d')) throw new Error('should keep non-member nodes when collapsed')

  const outEdges = collapsed.edges
  if (outEdges.length !== 2) throw new Error('should preserve two cross-community edges as aggregated edges')
  if (!outEdges.every(e => e.source === groupNodeId)) throw new Error('collapsed edges should originate from group node')
  if (!outEdges.some(e => e.target === 'c') || !outEdges.some(e => e.target === 'd')) {
    throw new Error('collapsed edges should target the original external nodes')
  }
}

