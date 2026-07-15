import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData } from '@/lib/graph/types'

const hasExactGraphNodeId = (graphData: GraphData | null, cardId: string): boolean => (
  !!graphData?.nodes?.some(node => String(node.id || '').trim() === cardId)
)

/**
 * A media drop must mutate the graph snapshot that owns the selected card.
 * The store can briefly retain a different graph while the Storyboard overlay
 * has already projected a newer source-backed snapshot.
 */
export function resolveStoryboardCardMediaDropGraphData(args: {
  cardId: string
  preferredGraphData: GraphData | null
  fallbackGraphData: GraphData | null
}): GraphData | null {
  const { cardId, fallbackGraphData, preferredGraphData } = args
  if (hasExactGraphNodeId(preferredGraphData, cardId)) return preferredGraphData
  if (hasExactGraphNodeId(fallbackGraphData, cardId)) return fallbackGraphData
  if (resolveGraphNodeByCanonicalId(preferredGraphData, cardId)) return preferredGraphData
  if (resolveGraphNodeByCanonicalId(fallbackGraphData, cardId)) return fallbackGraphData
  return preferredGraphData || fallbackGraphData
}
