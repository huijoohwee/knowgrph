import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'

export const isDisplayNode = (n: GraphNode): boolean => {
  if (String(n.type || '') === 'MermaidSubgraph') return false
  const props = (n.properties || {}) as Record<string, unknown>
  const isHeadingSection = String(n.type || '') === 'Section' && typeof props.level === 'number'
  return !isHeadingSection
}

export const getDisplayNodes = (graphData: GraphData): GraphNode[] => {
  const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
  return nodes.filter(isDisplayNode)
}

export const getDisplayEdges = (args: { edges: GraphEdge[]; displayNodeIdSet: Set<string> }): GraphEdge[] => {
  const edges = Array.isArray(args.edges) ? args.edges : []
  return edges.filter(e => {
    const s = String(e.source || '')
    const t = String(e.target || '')
    if (!s || !t) return false
    if (!args.displayNodeIdSet.has(s) || !args.displayNodeIdSet.has(t)) return false
    if (e.label === 'hasMermaidNode' || e.label === 'hasMermaidSubgraph' || e.label === 'hasMermaid') return false
    return true
  })
}

