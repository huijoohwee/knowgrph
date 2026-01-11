import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

const serializeGraphValue = (raw: unknown): string => {
  if (raw == null) return 'null'
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return '""'
    const clipped = s.length > 120 ? `${s.slice(0, 117)}...` : s
    return JSON.stringify(clipped)
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
  if (Array.isArray(raw)) {
    const head = raw.slice(0, 3).map(v => serializeGraphValue(v)).join(', ')
    const tail = raw.length > 3 ? ', …' : ''
    return `[${head}${tail}]`
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    const keys = Object.keys(obj)
    const visible = keys.slice(0, 6)
    const suffix = keys.length > visible.length ? ', …' : ''
    return `{ ${visible.join(', ')}${suffix} }`
  }
  return JSON.stringify(String(raw))
}

export const buildBoundedGraphSystemPrompt = (
  graphData: GraphData | null,
  currentNode: GraphNode | null,
): string => {
  const nodesAll = graphData?.nodes || []
  const edgesAll = graphData?.edges || []
  const nodeCount = nodesAll.length
  const edgeCount = edgesAll.length
  const graphContext = typeof graphData?.context === 'string' ? graphData.context : ''

  if (!currentNode || !graphData) {
    return [
      'You operate on BOUNDED GRAPH CONTEXT.',
      '',
      'RULES:',
      '- Reference ONLY entities and relationships provided in this conversation.',
      '- If information is missing, say so and ask for a specific node/edge selection.',
      '- For relationship claims, cite as: "[Entity A] --[Relationship]--> [Entity B]".',
      '',
      'Graph Structure:',
      `Nodes: ${nodeCount} entities`,
      `Edges: ${edgeCount} relationships`,
      graphContext ? `Context: ${graphContext}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const byId = new Map<string, GraphNode>()
  graphData.nodes.forEach(n => byId.set(n.id, n))
  const focusId = currentNode.id
  const incidentEdges: GraphEdge[] = graphData.edges
    .filter(e => e.source === focusId || e.target === focusId)
    .slice(0, 50)
  const nodeIdSet = new Set<string>([focusId])
  incidentEdges.forEach(e => {
    nodeIdSet.add(e.source)
    nodeIdSet.add(e.target)
  })
  const subNodes = Array.from(nodeIdSet)
    .map(id => byId.get(id))
    .filter((n): n is GraphNode => Boolean(n))
    .slice(0, 25)

  const entityList = subNodes
    .map(n => {
      const label = String(n.label || n.id || '')
      const type = String(n.type || '')
      return `- ${label}${type ? ` (${type})` : ''} [id=${String(n.id)}]`
    })
    .slice(0, 30)

  const relationshipList = incidentEdges
    .map(e => {
      const src = byId.get(e.source)
      const tgt = byId.get(e.target)
      const srcLabel = String(src?.label || src?.id || e.source || '')
      const tgtLabel = String(tgt?.label || tgt?.id || e.target || '')
      const rel = String(e.label || 'rel')
      return `[${srcLabel}] --[${rel}]--> [${tgtLabel}]`
    })
    .slice(0, 30)

  const serializedNodes = subNodes.map(n => {
    const props: Record<string, JSONValue> = n.properties || {}
    const keys = Object.keys(props).slice(0, 6)
    const obj = keys.map(k => `${k}: ${serializeGraphValue(props[k])}`).join(', ')
    return `- (${String(n.id)}:${String(n.type || 'entity')} { label: ${serializeGraphValue(n.label || '')}${obj ? `, ${obj}` : ''} })`
  })

  const serializedEdges = incidentEdges.map(e => {
    const src = String(e.source)
    const tgt = String(e.target)
    const label = String(e.label || 'rel')
    const props: Record<string, JSONValue> = e.properties || {}
    const keys = Object.keys(props).slice(0, 6)
    const obj = keys.map(k => `${k}: ${serializeGraphValue(props[k])}`).join(', ')
    return `- (${src}) -[${label}${obj ? ` { ${obj} }` : ''}]-> (${tgt})`
  })

  return [
    'You operate on BOUNDED GRAPH CONTEXT.',
    '',
    'RULES:',
    '- Reference ONLY entities and relationships in the provided Subgraph Context.',
    '- State graph paths for multi-hop answers using the citation format.',
    '- Express uncertainty if a path does not exist in the provided Subgraph Context.',
    '- Citation format: "[Entity A] --[Relationship]--> [Entity B]".',
    '',
    'Graph Structure:',
    `Nodes: ${nodeCount} entities`,
    `Edges: ${edgeCount} relationships`,
    graphContext ? `Context: ${graphContext}` : '',
    '',
    'Available Entities:',
    entityList.length ? entityList.join('\n') : '- (none)',
    '',
    'Available Relationships:',
    relationshipList.length ? relationshipList.join('\n') : '- (none)',
    '',
    'Subgraph Context:',
    'Nodes:',
    serializedNodes.length ? serializedNodes.join('\n') : '- (none)',
    '',
    'Relationships:',
    serializedEdges.length ? serializedEdges.join('\n') : '- (none)',
  ]
    .filter(Boolean)
    .join('\n')
}

export const buildMarkdownNodeSnippetPrompt = (
  markdownText: string | null,
  currentNode: GraphNode | null,
  parseLine: (raw: unknown) => number | null,
): string | null => {
  if (!markdownText || typeof markdownText !== 'string' || !markdownText.trim() || !currentNode) return null
  const meta = (currentNode.metadata || {}) as { lineStart?: unknown; lineEnd?: unknown }
  const lineStart = parseLine(meta.lineStart)
  const lineEnd = parseLine(meta.lineEnd) ?? lineStart
  if (lineStart == null || lineEnd == null) return null

  const lines = markdownText.split(/\r?\n/)
  const safeStart = Math.max(1, Math.min(lines.length || 1, Math.floor(lineStart)))
  const safeEnd = Math.max(1, Math.min(lines.length || 1, Math.floor(lineEnd)))
  const start = Math.min(safeStart, safeEnd)
  const end = Math.max(safeStart, safeEnd)
  const pad = 8
  const sliceStart = Math.max(1, start - pad)
  const sliceEnd = Math.min(lines.length || end, end + pad)
  const snippet = lines.slice(sliceStart - 1, sliceEnd).join('\n')
  const trimmedSnippet = snippet.length > 2000 ? `${snippet.slice(0, 1997)}...` : snippet

  return [
    'Markdown excerpt associated with the selected node (line-range aligned).',
    `Line range: ${sliceStart}-${sliceEnd}`,
    'Snippet:',
    trimmedSnippet,
  ].join('\n')
}

