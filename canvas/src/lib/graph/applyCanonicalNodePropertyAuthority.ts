import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData, GraphNode } from '@/lib/graph/types'

export function applyCanonicalNodePropertyAuthority(args: {
  graphData: GraphData | null | undefined
  propertyAuthorityGraphData: GraphData | null | undefined
}): GraphData | null {
  const graphData = args.graphData || null
  if (!graphData || !args.propertyAuthorityGraphData) return graphData
  let changed = false
  const nodes = (graphData.nodes || []).map(node => {
    const authorityNode = resolveGraphNodeByCanonicalId(args.propertyAuthorityGraphData, node.id)
    if (!authorityNode || authorityNode.properties === node.properties) return node
    changed = true
    return { ...node, properties: authorityNode.properties } as GraphNode
  })
  return changed ? { ...graphData, nodes } : graphData
}
