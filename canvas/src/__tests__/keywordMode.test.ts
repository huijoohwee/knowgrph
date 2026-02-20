import { deriveKeywordGraphFromText } from '@/features/semantic-mode/keywordGraph'
import { mergeKeywordGraphWithMediaNodes } from '@/hooks/useActiveGraphData'
import { buildGraphMetaKey } from '@/lib/graph/graphMetaKey'

export const testKeywordModeDerivesEntitiesAndPredicateEdges = () => {
  const { graph } = deriveKeywordGraphFromText({
    documentId: 'doc:test',
    documentText: 'The cat eats fish.\nA cat likes fish.\nAbout the cat.',
  })
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph.edges) ? graph.edges : []
  const nodeKeys = new Set<string>()
  let hasNodeSizing = false
  let hasLayer = false
  let hasIdeaTag = false
  for (const n of nodes) {
    const props = (n.properties || {}) as Record<string, unknown>
    const key = String(props['keyword:key'] || '')
    if (key) nodeKeys.add(key)
    const sz = props['visual:nodeSize']
    if (typeof sz === 'number' && Number.isFinite(sz) && sz > 0) hasNodeSizing = true
    const layer = props['visual:layer']
    if (typeof layer === 'number' && Number.isFinite(layer)) hasLayer = true
    const tags = props['tags']
    if (Array.isArray(tags) && tags.map(v => String(v).toLowerCase()).includes('idea')) hasIdeaTag = true
  }
  if (nodeKeys.has('the') || nodeKeys.has('a')) throw new Error('Keyword nodes should exclude stopwords')
  if (nodeKeys.has('about')) throw new Error('Keyword nodes should exclude NLTK stopwords')
  if (!nodeKeys.has('cat') || !nodeKeys.has('fish')) throw new Error('Keyword nodes missing expected entities')
  if (!hasNodeSizing) throw new Error('Keyword nodes should carry visual:nodeSize scaled by frequency')
  if (!hasLayer) throw new Error('Keyword nodes should carry visual:layer derived from communities')
  if (!hasIdeaTag) throw new Error('Keyword nodes should carry palette tags (idea)')
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

export const testKeywordModeMergesMediaNodesForOverlays = () => {
  const baseGraph = {
    type: 'Graph',
    nodes: [
      {
        id: 'media:1',
        label: 'Demo Media',
        type: 'Image',
        properties: { media_url: 'https://example.com/demo.png' },
        metadata: {},
      },
    ],
    edges: [],
  }
  const { graph: keywordGraph } = deriveKeywordGraphFromText({
    documentId: 'doc:test',
    documentText: 'Cat likes fish.',
  })
  const merged = mergeKeywordGraphWithMediaNodes({
    baseGraphData: baseGraph as unknown as typeof keywordGraph,
    keywordGraph,
    sourceId: 'doc:test',
  })
  const ids = new Set((merged.nodes || []).map(n => String(n.id)))
  if (!ids.has('media:1')) throw new Error('Keyword mode should retain media-capable nodes for overlays')
}

export const testKeywordModeCarriesSourceLayerHashForNoStaleViews = () => {
  const a = deriveKeywordGraphFromText({
    documentId: 'doc:test',
    documentText: 'Alpha causes Beta.',
  }).graph
  const b = deriveKeywordGraphFromText({
    documentId: 'doc:test',
    documentText: 'Alpha causes Beta. Gamma appears too.',
  }).graph

  const metaA = (a.metadata || {}) as Record<string, unknown>
  const metaB = (b.metadata || {}) as Record<string, unknown>
  const hA = typeof metaA.sourceLayerHash === 'string' ? metaA.sourceLayerHash.trim() : ''
  const hB = typeof metaB.sourceLayerHash === 'string' ? metaB.sourceLayerHash.trim() : ''
  if (!hA || !hB) throw new Error('expected keyword graph metadata.sourceLayerHash')
  if (hA === hB) throw new Error('expected sourceLayerHash to change when keyword source text changes')
  const keyA = buildGraphMetaKey(a)
  const keyB = buildGraphMetaKey(b)
  if (keyA === keyB) throw new Error('expected graph meta key to change when sourceLayerHash changes')
}
