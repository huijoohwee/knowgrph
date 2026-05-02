import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import { readParsedGraphRevisionOrInitial } from '@/features/source-files/sourceFileParsedGraphRevision'

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function readSourceLayerGraphMetadata(graphData: { metadata?: unknown } | null | undefined): Record<string, unknown> {
  return isRecord(graphData?.metadata) ? (graphData.metadata as Record<string, unknown>) : {}
}

const composedGraphCacheByFirstGraph = new WeakMap<GraphData, Map<string, GraphData>>()
const COMPOSED_GRAPH_CACHE_LIMIT = 24

function readComposedGraphCache(firstGraph: GraphData | null, key: string): GraphData | null {
  if (!firstGraph || !key) return null
  return composedGraphCacheByFirstGraph.get(firstGraph)?.get(key) || null
}

function writeComposedGraphCache(firstGraph: GraphData | null, key: string, graphData: GraphData): void {
  if (!firstGraph || !key) return
  let byKey = composedGraphCacheByFirstGraph.get(firstGraph)
  if (!byKey) {
    byKey = new Map<string, GraphData>()
    composedGraphCacheByFirstGraph.set(firstGraph, byKey)
  }
  if (!byKey.has(key) && byKey.size >= COMPOSED_GRAPH_CACHE_LIMIT) {
    const oldest = byKey.keys().next().value
    if (typeof oldest === 'string') byKey.delete(oldest)
  }
  byKey.set(key, graphData)
}

function mergeWidgetRegistryMetadata(layers: SourceLayerInput[]): JSONValue[] | undefined {
  const out: JSONValue[] = []
  const seen = new Set<string>()
  for (let i = 0; i < layers.length; i += 1) {
    const graph = layers[i]?.parsedGraphData
    const metadata = readSourceLayerGraphMetadata(graph)
    const raw = Array.isArray(metadata?.[FLOW_WIDGET_REGISTRY_METADATA_KEY]) ? (metadata?.[FLOW_WIDGET_REGISTRY_METADATA_KEY] as unknown[]) : []
    for (let j = 0; j < raw.length; j += 1) {
      const entry = raw[j]
      if (!isRecord(entry)) continue
      const nodeTypeId = typeof entry.nodeTypeId === 'string' ? entry.nodeTypeId.trim() : ''
      const formId = typeof entry.formId === 'string' ? entry.formId.trim() : ''
      const widgetTypeId = typeof entry.widgetTypeId === 'string' ? entry.widgetTypeId.trim() : ''
      const id = typeof entry.id === 'string' ? entry.id.trim() : ''
      const key = nodeTypeId && formId && widgetTypeId ? `${nodeTypeId}|${formId}|${widgetTypeId}` : id
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(entry as unknown as JSONValue)
    }
  }
  return out.length > 0 ? out : undefined
}

export function buildSourceLayerKeys(layers: SourceLayerInput[]): { contentKey: string; orderKey: string } {
  const normalized = (layers || []).map(l => ({
    id: String(l.id || '').trim(),
    included: Boolean(l.enabled && l.parsedGraphData),
    hash: computeTextHash(l),
    rev: readParsedGraphRevisionOrInitial(l.parsedGraphRevision),
  }))
  const contentKey = normalized
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(l => `${l.id}:${l.included ? '1' : '0'}:${l.hash}:r${l.rev}`)
    .join('|')
  const orderKey = normalized.map(l => `${l.id}:${l.included ? '1' : '0'}:${l.hash}:r${l.rev}`).join('|')
  return { contentKey, orderKey }
}

export function readSourceLayerKeysFromGraphData(graphData: GraphData | null | undefined): {
  contentKey: string
  orderKey: string
} {
  const metadata = readSourceLayerGraphMetadata(graphData)
  return {
    contentKey: typeof metadata.sourceLayerHash === 'string' ? metadata.sourceLayerHash : '',
    orderKey: typeof metadata.sourceLayerOrderHash === 'string' ? metadata.sourceLayerOrderHash : '',
  }
}

export function resolveSourceLayerKeyChange(args: {
  previousGraphData: GraphData | null | undefined
  contentKey: string
  orderKey: string
}): 'unchanged' | 'order-only' | 'content' {
  const previous = readSourceLayerKeysFromGraphData(args.previousGraphData)
  if (previous.contentKey === args.contentKey && previous.orderKey === args.orderKey) {
    return 'unchanged'
  }
  if (previous.contentKey === args.contentKey) {
    return 'order-only'
  }
  return 'content'
}

export function updateGraphDataSourceLayerKeys(args: {
  graphData: GraphData
  layers: SourceLayerInput[]
}): {
  graphData: GraphData
  contentKey: string
  orderKey: string
  changed: boolean
} {
  const { contentKey, orderKey } = buildSourceLayerKeys(args.layers)
  const prev = readSourceLayerKeysFromGraphData(args.graphData)
  if (prev.contentKey === contentKey && prev.orderKey === orderKey) {
    return {
      graphData: args.graphData,
      contentKey,
      orderKey,
      changed: false,
    }
  }
  return {
    graphData: {
      ...args.graphData,
      metadata: {
        ...readSourceLayerGraphMetadata(args.graphData),
        sourceLayerHash: contentKey as unknown as JSONValue,
        sourceLayerOrderHash: orderKey as unknown as JSONValue,
      },
    },
    contentKey,
    orderKey,
    changed: true,
  }
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
  const cacheKey = `${contentKey}\n${orderKey}\n${String(args.fallbackType || '')}`
  const cachedGraphData = readComposedGraphCache(base, cacheKey)
  if (cachedGraphData) return { graphData: cachedGraphData, contentKey, orderKey }
  const baseType = base?.type || args.fallbackType || 'Graph'
  const baseContext = typeof base?.context === 'undefined' ? 'sourceLayers' : (base?.context as JSONValue)
  const baseMetadata = readSourceLayerGraphMetadata(base) as Record<string, JSONValue>

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
  const mergedWidgetRegistry = mergeWidgetRegistryMetadata(enabledParsed)
  if (mergedWidgetRegistry) nextMetadata[FLOW_WIDGET_REGISTRY_METADATA_KEY] = mergedWidgetRegistry

  const graphData: GraphData = {
    context: baseContext,
    metadata: nextMetadata,
    type: baseType,
    nodes,
    edges,
  }
  writeComposedGraphCache(base, cacheKey, graphData)
  return {
    graphData,
    contentKey,
    orderKey,
  }
}
