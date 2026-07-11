import type { GraphData } from '@/lib/graph/types'

export function deriveLiveCanvasHeroCommandRouteGraph(graphData: GraphData): GraphData | null {
  const commandNodeIdSet = new Set((graphData.nodes || [])
    .filter(node => String(node.properties?.command || '').trim().startsWith('/'))
    .map(node => String(node.id || '').trim())
    .filter(Boolean))
  const edges = (graphData.edges || []).filter(edge => (
    commandNodeIdSet.has(String(edge.source || '').trim())
    && commandNodeIdSet.has(String(edge.target || '').trim())
  ))
  const connectedNodeIdSet = new Set(edges.flatMap(edge => [String(edge.source || '').trim(), String(edge.target || '').trim()]))
  const nodes = (graphData.nodes || []).filter(node => connectedNodeIdSet.has(String(node.id || '').trim()))
  if (nodes.length < 2 || edges.length === 0) {
    const sourceNodeIds = new Set((graphData.nodes || []).map(node => String(node.id || '').trim()).filter(Boolean))
    const firstEdge = (graphData.edges || []).find(edge => (
      sourceNodeIds.has(String(edge.source || '').trim())
      && sourceNodeIds.has(String(edge.target || '').trim())
    ))
    if (!firstEdge) return null
    const routeEdges = [firstEdge]
    const firstTargetId = String(firstEdge.target || '').trim()
    const continuationEdge = (graphData.edges || []).find(edge => (
      String(edge.source || '').trim() === firstTargetId
      && sourceNodeIds.has(String(edge.target || '').trim())
    ))
    if (continuationEdge) routeEdges.push(continuationEdge)
    const routeNodeIds = new Set(routeEdges.flatMap(edge => [String(edge.source || '').trim(), String(edge.target || '').trim()]))
    const routeNodes = (graphData.nodes || []).filter(node => routeNodeIds.has(String(node.id || '').trim()))
    return {
      ...graphData,
      nodes: routeNodes,
      edges: routeEdges,
      metadata: {
        ...graphData.metadata,
        liveCanvasHeroProjection: {
          kind: 'source-connected-route',
          sourceNodeCount: graphData.nodes.length,
          sourceEdgeCount: graphData.edges.length,
        },
      },
    }
  }
  return {
    ...graphData,
    nodes,
    edges,
    metadata: {
      ...graphData.metadata,
      liveCanvasHeroProjection: {
        kind: 'source-command-route',
        sourceNodeCount: graphData.nodes.length,
        sourceEdgeCount: graphData.edges.length,
      },
    },
  }
}
