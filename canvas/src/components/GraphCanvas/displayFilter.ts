import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'

export const isDisplayNode = (n: GraphNode): boolean => {
  if (String(n.type || '') === 'MermaidSubgraph') return false
  if (String(n.type || '') === 'KeywordSource') return false
  const props = (n.properties || {}) as Record<string, unknown>
  const isHeadingSection = String(n.type || '') === 'Section' && typeof props.level === 'number'
  return !isHeadingSection
}

export const getDisplayNodes = (graphData: GraphData): GraphNode[] => {
  const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
  const preferred = nodes.filter(isDisplayNode)
  return preferred.length > 0 ? preferred : nodes
}

export const getDisplayEdges = (args: { edges: GraphEdge[]; displayNodeIdSet: Set<string> }): GraphEdge[] => {
  const edges = Array.isArray(args.edges) ? args.edges : []
  const endpointId = (v: unknown): string => {
    if (typeof v === 'string') return v
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
    if (v && typeof v === 'object') {
      const id = (v as { id?: unknown }).id
      if (typeof id === 'string') return id
      if (typeof id === 'number') return Number.isFinite(id) ? String(id) : ''
    }
    return ''
  }
  const base = edges.filter(e => {
    const s = endpointId(e.source)
    const t = endpointId(e.target)
    if (!s || !t) return false
    if (!args.displayNodeIdSet.has(s) || !args.displayNodeIdSet.has(t)) return false
    return true
  })

  const preferred = base.filter(e => {
    if (e.label === 'hasMermaidNode' || e.label === 'hasMermaidSubgraph' || e.label === 'hasMermaid') return false
    return true
  })
  return preferred.length > 0 ? preferred : base
}

export const getGraphDataForDisplay = (args: { graphData: GraphData; edges?: GraphEdge[] | null }): GraphData => {
  const graphData = args.graphData
  const displayNodes = getDisplayNodes(graphData)
  const displayNodeIdSet = new Set<string>(displayNodes.map(n => String(n.id)))
  const edgesSource = Array.isArray(args.edges) ? args.edges : (Array.isArray(graphData.edges) ? (graphData.edges as GraphEdge[]) : [])
  const edgesForDisplay = getDisplayEdges({ edges: edgesSource, displayNodeIdSet })
  return { ...graphData, nodes: displayNodes, edges: edgesForDisplay }
}
