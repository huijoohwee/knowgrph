import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { getNodeMediaSpec } from '@/components/GraphCanvas/helpers'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.flow-editor'

const coerceEndpointId = (v: unknown): string => {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (v && typeof v === 'object') {
    const id = (v as { id?: unknown }).id
    if (typeof id === 'string') return id
    if (typeof id === 'number') return Number.isFinite(id) ? String(id) : ''
  }
  return ''
}

const isFrontmatterDisplayGraph = (graphData: GraphData): boolean => {
  if (String(graphData.context || '') === 'frontmatter-flow') return true
  const meta = (graphData.metadata || {}) as Record<string, unknown>
  if (String(meta.kind || '') === 'frontmatter-flow') return true
  const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
  for (let i = 0; i < nodes.length; i += 1) {
    const props = (nodes[i]?.properties || {}) as Record<string, unknown>
    if (props.isMermaidFrontmatter === true) return true
    if (String(props.mermaidScope || '') === 'frontmatter') return true
  }
  return false
}

const isParagraphOrListNode = (n: GraphNode): boolean => {
  const t = String(n.type || '')
  return t === 'Paragraph' || t === 'List'
}

export const isDisplayNode = (n: GraphNode): boolean => {
  if (getNodeMediaSpec(n)) return true
  if (String(n.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return true
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
  const base = edges.filter(e => {
    const s = coerceEndpointId(e.source)
    const t = coerceEndpointId(e.target)
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
  const frontmatterMode = isFrontmatterDisplayGraph(graphData)

  const allNodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
  const edgesSource = Array.isArray(args.edges)
    ? args.edges
    : Array.isArray(graphData.edges)
      ? (graphData.edges as GraphEdge[])
      : []

  const preferredNodes = allNodes.filter(n => {
    if (frontmatterMode && isParagraphOrListNode(n)) return false
    return isDisplayNode(n)
  })
  const baseNodes = preferredNodes.length > 0 ? preferredNodes : allNodes
  const baseNodeIdSet = new Set<string>(baseNodes.map(n => String(n.id)))
  const edgesForBase = getDisplayEdges({ edges: edgesSource, displayNodeIdSet: baseNodeIdSet })

  if (!frontmatterMode && preferredNodes.length > 0 && edgesSource.length > 0 && edgesForBase.length === 0) {
    const required = new Set<string>(baseNodeIdSet)
    for (let i = 0; i < edgesSource.length; i += 1) {
      const e = edgesSource[i]
      const s = coerceEndpointId(e.source)
      const t = coerceEndpointId(e.target)
      if (s) required.add(s)
      if (t) required.add(t)
    }
    const connectedNodes = allNodes.filter(n => required.has(String(n.id)))
    const connectedNodeIdSet = new Set<string>(connectedNodes.map(n => String(n.id)))
    const edgesForConnected = getDisplayEdges({ edges: edgesSource, displayNodeIdSet: connectedNodeIdSet })
    return { ...graphData, nodes: connectedNodes, edges: edgesForConnected }
  }

  return { ...graphData, nodes: baseNodes, edges: edgesForBase }
}
