import type { GraphData } from '@/lib/graph/types'

const hasGraphNodes = (graphData: GraphData | null | undefined): graphData is GraphData =>
  Array.isArray(graphData?.nodes) && graphData.nodes.length > 0

export function resolveStoryboardCanvasGraphDataAuthority(args: {
  baseGraphData: GraphData | null
  draftGraphData: GraphData | null
  renderGraphData: GraphData | null
}): GraphData {
  if (hasGraphNodes(args.draftGraphData)) return args.draftGraphData
  if (hasGraphNodes(args.renderGraphData)) return args.renderGraphData
  if (hasGraphNodes(args.baseGraphData)) return args.baseGraphData
  return args.draftGraphData || args.renderGraphData || args.baseGraphData || { context: '', type: 'Graph', nodes: [], edges: [] }
}
