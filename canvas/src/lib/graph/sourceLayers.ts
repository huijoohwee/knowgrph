import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'

export type SourceLayerInput = {
  id: string
  name: string
  enabled: boolean
  source?: { kind: 'url' | 'local'; url?: string; path?: string }
  text?: string
  parsedTextHash?: string
  parsedGraphRevision?: number
  parsedGraphData?: GraphData
}

function inferSourceLayerFormat(name: string): string {
  const trimmed = String(name || '').trim().toLowerCase()
  const dot = trimmed.lastIndexOf('.')
  const ext = dot >= 0 ? trimmed.slice(dot) : ''
  if (ext === '.markdown') return 'markdown'
  if (ext === '.md') return 'markdown'
  if (ext === '.txt') return 'text'
  if (ext === '.geojson') return 'geojson'
  if (ext === '.json') return 'json'
  if (ext === '.jsonld') return 'jsonld'
  if (ext === '.csv') return 'csv'
  if (ext === '.html' || ext === '.htm') return 'html'
  if (ext === '.yaml' || ext === '.yml') return 'yaml'
  if (ext === '.pdf') return 'pdf'
  if (!ext) return 'auto'
  return ext.replace(/^\./, '') || 'auto'
}

function computeTextHash(layer: SourceLayerInput): string {
  const existing = typeof layer.parsedTextHash === 'string' ? layer.parsedTextHash.trim() : ''
  if (existing) return existing
  const text = typeof layer.text === 'string' ? layer.text : ''
  return hashStringToHexCached(`source-layer:${String(layer.id || '').trim() || 'unknown'}`, text)
}

export function buildSourceLayerKeys(layers: SourceLayerInput[]): { contentKey: string; orderKey: string } {
  const normalized = (layers || []).map(l => ({
    id: String(l.id || '').trim(),
    included: Boolean(l.enabled && l.parsedGraphData),
    hash: computeTextHash(l),
    rev: typeof l.parsedGraphRevision === 'number' ? l.parsedGraphRevision : 0,
  }))
  const contentKey = normalized
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(l => `${l.id}:${l.included ? '1' : '0'}:${l.hash}:r${l.rev}`)
    .join('|')
  const orderKey = normalized.map(l => `${l.id}:${l.included ? '1' : '0'}:${l.hash}:r${l.rev}`).join('|')
  return { contentKey, orderKey }
}

export function composeGraphFromSourceLayers(args: {
  layers: SourceLayerInput[]
  fallbackType?: string
  precomputedKeys?: { contentKey: string; orderKey: string }
}): { graphData: GraphData; contentKey: string; orderKey: string } {
  const layers = args.layers || []
  const { contentKey, orderKey } = args.precomputedKeys || buildSourceLayerKeys(layers)
  const enabledParsed = layers.filter(l => l.enabled && l.parsedGraphData)

  const base = enabledParsed[0]?.parsedGraphData || null
  const baseType = base?.type || args.fallbackType || 'Graph'
  const baseContext = typeof base?.context === 'undefined' ? 'sourceLayers' : (base?.context as JSONValue)
  const baseMetadata = base?.metadata && typeof base.metadata === 'object' ? (base.metadata as Record<string, JSONValue>) : {}

  const sourceLayersMeta = layers.map(l => {
    const sourceUrl = l.source?.kind === 'url' ? String(l.source?.url || '').trim() : ''
    const sourcePath = l.source?.kind === 'local' ? String(l.source?.path || '').trim() : ''
    const format = inferSourceLayerFormat(l.name)
    return {
      id: l.id,
      label: l.name,
      enabled: Boolean(l.enabled),
      source: l.source?.kind ? { kind: l.source.kind, url: sourceUrl || undefined, path: sourcePath || undefined } : undefined,
      format,
      hash: computeTextHash(l),
    }
  })

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (const layer of enabledParsed) {
    const graph = layer.parsedGraphData
    if (!graph) continue
    const prefix = `${layer.id}::`
    const label = String(layer.name || '').trim() || layer.id
    const sourceUrl = layer.source?.kind === 'url' ? String(layer.source?.url || '').trim() : ''
    const documentPath = label

    for (const node of graph.nodes || []) {
      const nextId = `${prefix}${String(node.id)}`
      const nextMeta = { ...(node.metadata || {}) } as Record<string, JSONValue>
      nextMeta.sourceLayerId = layer.id as unknown as JSONValue
      nextMeta.sourceLayerLabel = label as unknown as JSONValue
      if (!nextMeta.documentPath) nextMeta.documentPath = documentPath as unknown as JSONValue
      if (sourceUrl && !nextMeta.documentUrl) nextMeta.documentUrl = sourceUrl as unknown as JSONValue
      nodes.push({ ...node, id: nextId, metadata: nextMeta })
    }

    for (const edge of graph.edges || []) {
      const nextId = `${prefix}${String(edge.id)}`
      const nextMeta = { ...(edge.metadata || {}) } as Record<string, JSONValue>
      nextMeta.sourceLayerId = layer.id as unknown as JSONValue
      nextMeta.sourceLayerLabel = label as unknown as JSONValue
      if (!nextMeta.documentPath) nextMeta.documentPath = documentPath as unknown as JSONValue
      if (sourceUrl && !nextMeta.documentUrl) nextMeta.documentUrl = sourceUrl as unknown as JSONValue
      edges.push({
        ...edge,
        id: nextId,
        source: `${prefix}${String(edge.source)}`,
        target: `${prefix}${String(edge.target)}`,
        metadata: nextMeta,
      })
    }
  }

  const nextMetadata: Record<string, JSONValue> = {
    ...baseMetadata,
    sourceLayers: sourceLayersMeta as unknown as JSONValue,
    sourceLayerComposition: 'compose' as unknown as JSONValue,
    sourceLayerHash: contentKey as unknown as JSONValue,
    sourceLayerOrderHash: orderKey as unknown as JSONValue,
  }

  return {
    graphData: {
      context: baseContext,
      metadata: nextMetadata,
      type: baseType,
      nodes,
      edges,
    },
    contentKey,
    orderKey,
  }
}
