import type { GraphNode, GraphEdge } from '@/lib/graph/types'

export type StatsUiClasses = {
  uiPanelMonospaceTextClass: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelMicroLabelTextSizeClass: string
  uiPanelTextFontClass: string
}

export type SelectionSnapshot = {
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
}

export type TokenCount = { token: string; count: number }

export type TokensByGraphLayerRow = {
  graphLayerId: string
  label: string
  fill: string
  nodeCount: number
  nodeIds: string[]
  totalTokens: number
  topTokens: TokenCount[]
}

export type TokensForSelectedNode = {
  node: GraphNode
  totalTokens: number
  topTokens: TokenCount[]
}

export type TokensForSelectedNodes = {
  nodeCount: number
  totalTokens: number
  topTokens: TokenCount[]
}

export type StatsCommunity = {
  id: number
  count: number
  fill: string
  nodeIds: string[]
  name: string
  description: string
  topTokens: TokenCount[]
}

export type StatsEdge = GraphEdge
