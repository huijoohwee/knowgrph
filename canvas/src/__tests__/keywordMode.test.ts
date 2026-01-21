import { deriveKeywordGraphFromText } from '@/features/semantic-mode/keywordGraph'

export const testKeywordModeDerivesEntitiesAndPredicates = () => {
  const { graph } = deriveKeywordGraphFromText({
    documentId: 'doc:test',
    documentText: 'The cat eats fish.\nA cat likes fish.',
  })
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph.edges) ? graph.edges : []
  const nodeKeys = new Set<string>()
  let hasNodeSizing = false
  for (const n of nodes) {
    const props = (n.properties || {}) as Record<string, unknown>
    const key = String(props['keyword:key'] || '')
    if (key) nodeKeys.add(key)
    const sz = props['visual:nodeSize']
    if (typeof sz === 'number' && Number.isFinite(sz) && sz > 0) hasNodeSizing = true
  }
  if (nodeKeys.has('the') || nodeKeys.has('a')) throw new Error('Keyword nodes should exclude stopwords')
  if (!nodeKeys.has('cat') || !nodeKeys.has('fish')) throw new Error('Keyword nodes missing expected entities')
  if (!hasNodeSizing) throw new Error('Keyword nodes should carry visual:nodeSize scaled by frequency')
  const labels = new Set(edges.map(e => String(e.label || '').toLowerCase()).filter(Boolean))
  if (!labels.has('eats') && !labels.has('likes')) {
    throw new Error('Keyword edges should infer relationship keywords from text')
  }
  const hasEdgeWidth = edges.some(e => {
    const props = (e.properties || {}) as Record<string, unknown>
    const w = props['visual:width']
    return typeof w === 'number' && Number.isFinite(w) && w > 0
  })
  if (!hasEdgeWidth) throw new Error('Keyword edges should carry visual:width scaled by strength')
}
