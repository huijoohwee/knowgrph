import { useGraphStore } from '@/hooks/useGraphStore'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { persistStoryboardCardMediaGraphSource } from '@/components/StoryboardWidgetCanvas/runtime/storyboardCardMediaGraphSource'
import type { GraphData, GraphEdge } from '@/lib/graph/types'

export function isStoryboardWidgetWorkflowOutputEdgeMaterialized(
  edges: readonly GraphEdge[] | null | undefined,
  edge: GraphEdge,
): boolean {
  const edgeId = String(edge.id || '').trim()
  return (edges || []).some(existing => {
    if (edgeId && String(existing?.id || '').trim() === edgeId) return true
    const endpoints = readGraphEdgeEndpoints(existing)
    return endpoints.src === edge.source && endpoints.tgt === edge.target
  })
}

export function materializeStoryboardWidgetWorkflowOutputEdgeInCanonicalGraph(args: {
  graphData: GraphData | null | undefined
  edge: GraphEdge
  addEdge: (edge: GraphEdge) => void
  persistGraph: (graphData: GraphData) => void
}): void {
  if (isStoryboardWidgetWorkflowOutputEdgeMaterialized(args.graphData?.edges, args.edge)) {
    args.persistGraph(args.graphData!)
    return
  }
  args.addEdge(args.edge)
}

/** Keeps the canonical graph in sync with a workflow edge written to the draft. */
export function materializeStoryboardWidgetWorkflowOutputEdge(edge: GraphEdge): void {
  const graphStore = useGraphStore.getState()
  materializeStoryboardWidgetWorkflowOutputEdgeInCanonicalGraph({
    graphData: graphStore.graphData,
    edge,
    addEdge: graphStore.addEdge,
    persistGraph: persistStoryboardCardMediaGraphSource,
  })
}
