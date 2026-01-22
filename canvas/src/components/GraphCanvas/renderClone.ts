import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

const cloneRecord = (value: Record<string, JSONValue> | null | undefined): Record<string, JSONValue> => {
  if (!value) return {}
  return { ...value }
}

export const cloneGraphDataForRender = (graphData: GraphData): GraphData => {
  const nodes: GraphNode[] = Array.isArray(graphData.nodes)
    ? graphData.nodes.map(n => ({
        ...n,
        properties: cloneRecord(n.properties),
        metadata: n.metadata ? cloneRecord(n.metadata) : undefined,
      }))
    : []
  const edges: GraphEdge[] = Array.isArray(graphData.edges)
    ? graphData.edges.map(e => ({
        ...e,
        properties: cloneRecord(e.properties),
        metadata: e.metadata ? cloneRecord(e.metadata) : undefined,
      }))
    : []
  return {
    ...graphData,
    nodes,
    edges,
    metadata: graphData.metadata ? (graphData.metadata as Record<string, JSONValue>) : undefined,
  }
}

