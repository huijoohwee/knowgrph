import type {
  AgenticGraphRagPathValue,
  AgenticGraphRagTraversePath,
  AgenticGraphRagExamplePath,
  AgenticRagNodeId,
  ParsedAgenticGraphRagTraversePath,
  ParsedAgenticGraphRagExamplePath,
  GraphData,
  JSONValue,
} from './types'

type NeighborEntry = { edgeId: string; otherId: string; label: string }
type NeighborMap = Map<string, NeighborEntry[]>

const neighborsCache = new WeakMap<GraphData, NeighborMap>()
const graphRagTraversalCache = new WeakMap<GraphData, string[]>()

type TraversalCacheKey = string
type TraversalCacheMap = Map<TraversalCacheKey, string[]>

const traversalCache = new WeakMap<GraphData, TraversalCacheMap>()

function getTraversalCache(graph: GraphData): TraversalCacheMap {
  const existing = traversalCache.get(graph)
  if (existing) return existing
  const created: TraversalCacheMap = new Map()
  traversalCache.set(graph, created)
  return created
}

function getOrBuildNeighborMap(graph: GraphData): NeighborMap {
  const cached = neighborsCache.get(graph)
  if (cached) return cached
  const neighborsByNode: NeighborMap = new Map()
  graph.edges.forEach(e => {
    const id = String(e.id)
    const s = String(e.source)
    const t = String(e.target)
    const label = String(e.label ?? '')
    const entryST = neighborsByNode.get(s) || []
    entryST.push({ edgeId: id, otherId: t, label })
    neighborsByNode.set(s, entryST)
    const entryTS = neighborsByNode.get(t) || []
    entryTS.push({ edgeId: id, otherId: s, label })
    neighborsByNode.set(t, entryTS)
  })
  neighborsCache.set(graph, neighborsByNode)
  return neighborsByNode
}

export function isGraphRagPathValue(value: JSONValue | unknown): value is AgenticGraphRagPathValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Array.isArray(record.traverse) || Array.isArray(record.multiHop)) return true
  if (Array.isArray(record.hops)) return true
  return typeof record.query === 'string' || typeof record.example === 'string'
}

function toIdList(value: JSONValue | unknown): AgenticRagNodeId[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => {
      if (typeof item === 'string' || typeof item === 'number') return String(item) as AgenticRagNodeId
      return null
    })
    .filter((id): id is AgenticRagNodeId => Boolean(id))
}

export function toParsedTraversePath(
  raw: AgenticGraphRagPathValue | null | undefined,
): ParsedAgenticGraphRagTraversePath | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as AgenticGraphRagTraversePath
  const query = typeof record.query === 'string' ? record.query : undefined
  const traverse = toIdList(record.traverse)
  const multiHopRaw = record.multiHop
  const multiHop =
    Array.isArray(multiHopRaw)
      ? multiHopRaw
          .map(item => (typeof item === 'string' || typeof item === 'number' ? String(item) : null))
          .filter((v): v is string => Boolean(v))
      : []
  if (!query && traverse.length === 0 && multiHop.length === 0) return null
  return { query, traverse, multiHop }
}

export function toParsedExamplePath(
  raw: AgenticGraphRagPathValue | null | undefined,
): ParsedAgenticGraphRagExamplePath | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as AgenticGraphRagExamplePath
  const example = typeof record.example === 'string' ? record.example : undefined
  const hopsRaw = record.hops
  const hops =
    Array.isArray(hopsRaw)
      ? hopsRaw
          .map(item => (typeof item === 'string' || typeof item === 'number' ? String(item) : null))
          .filter((v): v is string => Boolean(v))
      : []
  if (!example && hops.length === 0) return null
  return { example, hops }
}

export function findGraphRagTraversalEdgeIds(graph: GraphData | null): string[] {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return []
  const cached = graphRagTraversalCache.get(graph)
  if (cached) return cached
  const neighborsByNode = getOrBuildNeighborMap(graph)
  const owner = graph.nodes.find(node => {
    const props = node.properties ?? {}
    const raw = (props as Record<string, JSONValue>).graphRAGPath
    if (!isGraphRagPathValue(raw)) return false
    const parsed = toParsedTraversePath(raw)
    return parsed !== null && Array.isArray(parsed.traverse) && parsed.traverse.length > 0
  })
  if (!owner) return []
  const props = owner.properties ?? {}
  const raw = (props as Record<string, JSONValue>).graphRAGPath
  if (!isGraphRagPathValue(raw)) return []
  const parsed = toParsedTraversePath(raw)
  if (!parsed || !Array.isArray(parsed.traverse) || parsed.traverse.length === 0) return []
  const pathIds: AgenticRagNodeId[] = [owner.id as AgenticRagNodeId, ...parsed.traverse]
  const edgesForPath: string[] = []
  for (let i = 0; i < pathIds.length - 1; i += 1) {
    const a = pathIds[i]
    const b = pathIds[i + 1]
    const neighbors = neighborsByNode.get(String(a)) || []
    const match = neighbors.find(entry => entry.otherId === String(b))
    if (match) edgesForPath.push(match.edgeId)
  }
  graphRagTraversalCache.set(graph, edgesForPath)
  return edgesForPath
}

export type TraversalQuery = {
  startNodeId: string
  maxDepth: number
  allowedEdgeLabels?: string[]
}

export function findTraversalEdgeIds(graph: GraphData | null, query: TraversalQuery | null): string[] {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return []
  if (!query) return []
  const start = String(query.startNodeId || '').trim()
  if (!start) return []
  const maxDepth = Number.isFinite(query.maxDepth) && query.maxDepth > 0 ? Math.floor(query.maxDepth) : 1
  const allowedLabels = (query.allowedEdgeLabels || [])
    .map(label => String(label || '').trim())
    .filter(label => label.length > 0)
  const nodeExists = graph.nodes.some(n => String(n.id) === start)
  if (!nodeExists) return []
  const cacheKey: TraversalCacheKey = `${start}|${maxDepth}|${allowedLabels.join(',')}`
  const cacheForGraph = getTraversalCache(graph)
  const cached = cacheForGraph.get(cacheKey)
  if (cached) return cached
  const visitedNodes = new Set<string>()
  const queued: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }]
  visitedNodes.add(start)
  const edgeIds = new Set<string>()
  const neighborsByNode = getOrBuildNeighborMap(graph)
  while (queued.length > 0) {
    const current = queued.shift()
    if (!current) continue
    if (current.depth >= maxDepth) continue
    const neighbors = neighborsByNode.get(current.id)
    if (!neighbors || neighbors.length === 0) continue
    neighbors.forEach(item => {
      if (allowedLabels.length > 0 && !allowedLabels.includes(item.label)) return
      if (!edgeIds.has(item.edgeId)) {
        edgeIds.add(item.edgeId)
      }
      if (!visitedNodes.has(item.otherId)) {
        visitedNodes.add(item.otherId)
        queued.push({ id: item.otherId, depth: current.depth + 1 })
      }
    })
  }
  const result = Array.from(edgeIds)
  cacheForGraph.set(cacheKey, result)
  return result
}
