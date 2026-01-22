import { applyGraphRagTextAnalytics } from '@/lib/graph/graphragTextAnalytics'
import { deriveKeywordGraphFromText } from '@/features/semantic-mode/keywordGraph'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'

export const testGraphRagAnalyticsWritesNamespacedCausalityComponents = () => {
  const nodes: GraphNode[] = [
    { id: 'n1', label: 'Alpha', type: 'Entity', properties: {} },
    { id: 'n2', label: 'Beta', type: 'Entity', properties: {} },
  ]
  const edges: GraphEdge[] = [
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      label: 'causes',
      properties: { causalityStrength: 0.9, temporalStrength: 0.2, certainty: 0.7, negation: false },
    },
  ]
  const nodeKeyById = new Map<string, string>([
    ['n1', 'alpha'],
    ['n2', 'beta'],
  ])
  applyGraphRagTextAnalytics({
    text: 'Alpha causes Beta.',
    entities: [],
    triples: [],
    nodes,
    edges,
    nodeKeyById,
    centrality: { pagerank: false, hits: false, betweenness: false, closeness: false },
  })
  const props = edges[0]!.properties as Record<string, unknown>
  if (typeof props['causality:why'] !== 'number') throw new Error('should write causality:why')
  if (typeof props['causality:temporal'] !== 'number') throw new Error('should write causality:temporal')
  if (typeof props['causality:modality'] !== 'number') throw new Error('should write causality:modality')
  if (typeof props['causality:score'] !== 'number') throw new Error('should write causality:score')
}

export const testKeywordGraphWritesKeywordFrequencyAndStrengthScore = () => {
  const derived = deriveKeywordGraphFromText({
    documentId: 'doc:test',
    documentText: 'Alpha causes Beta. Alpha relates to Gamma.',
  })
  const nodes = derived.graph.nodes
  const edges = derived.graph.edges
  if (nodes.length === 0) throw new Error('expected keyword graph nodes')
  if (edges.length === 0) throw new Error('expected keyword graph edges')
  const nodeProps = nodes[0]!.properties as Record<string, unknown>
  if (typeof nodeProps['keyword:frequency'] !== 'number') throw new Error('keyword nodes should include keyword:frequency')
  const edgeProps = edges[0]!.properties as Record<string, unknown>
  if (typeof edgeProps['strength:score'] !== 'number') throw new Error('keyword edges should include strength:score')
}
