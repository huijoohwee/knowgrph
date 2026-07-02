import type { GraphData, GraphNode } from '@/lib/graph/types'

export function addStoryboardWidgetNodeIdVariants(out: Set<string>, rawId: unknown): void {
  const id = String(rawId || '').trim()
  if (!id) return
  out.add(id)
  const parts = id.split('::').map(part => part.trim()).filter(Boolean)
  const suffix = parts.length > 1 ? parts[parts.length - 1] : ''
  if (suffix) out.add(suffix)
}

export function appendPendingOverlayNodesToGraphData(
  graphData: GraphData | null,
  pendingNodesById: Record<string, GraphNode>,
): GraphData | null {
  const pendingNodes = Object.values(pendingNodesById).filter(node => String(node?.id || '').trim())
  if (pendingNodes.length <= 0) return graphData
  const base = graphData || { context: '', type: 'Graph', nodes: [], edges: [] }
  const nodes = Array.isArray(base.nodes) ? base.nodes : []
  const existingIds = new Set<string>()
  for (const node of nodes) addStoryboardWidgetNodeIdVariants(existingIds, node?.id)
  const additions = pendingNodes.filter(node => {
    const id = String(node?.id || '').trim()
    if (!id || existingIds.has(id)) return false
    addStoryboardWidgetNodeIdVariants(existingIds, id)
    return true
  })
  if (additions.length <= 0) return graphData
  return {
    ...base,
    nodes: [...nodes, ...additions],
    edges: Array.isArray(base.edges) ? base.edges : [],
  }
}

export function resolvePendingOverlayGraphDataBase(args: {
  storyboardCardsMode: boolean
  flowCanvasGraphDataOverride: GraphData | null
  renderGraphDataOverride: GraphData | null
  draftGraphData: GraphData | null
  baseGraphData: GraphData | null
}): GraphData | null {
  if (!args.storyboardCardsMode) return args.flowCanvasGraphDataOverride
  return args.flowCanvasGraphDataOverride
    || args.renderGraphDataOverride
    || args.draftGraphData
    || args.baseGraphData
    || { context: '', type: 'Graph', nodes: [], edges: [] }
}
