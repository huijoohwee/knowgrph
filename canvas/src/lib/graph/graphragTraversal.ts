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
import { hashSignatureParts, normalizeStringArrayForSignature } from '@/lib/hash/signature'
import { getCachedGraphLookup, type CachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey, readGraphRevision } from '@/lib/graph/semanticKey'

const TRAVERSAL_RESULT_CACHE_LIMIT = 64
const traversalResultCache = new Map<string, string[]>()

export type GraphTraversalCacheContext = {
  graphRevision?: number | null
  graphSemanticKey?: string | null
}

type TraversalGraphAccess = {
  graphSemanticKey: string
  graphRevision: number
  lookup: CachedGraphLookup
}

function readCachedTraversalResult(cacheKey: string): string[] | null {
  const cached = traversalResultCache.get(cacheKey) || null
  if (!cached) return null
  traversalResultCache.delete(cacheKey)
  traversalResultCache.set(cacheKey, cached)
  return cached
}

function writeCachedTraversalResult(cacheKey: string, value: string[]): string[] {
  traversalResultCache.set(cacheKey, value)
  if (traversalResultCache.size > TRAVERSAL_RESULT_CACHE_LIMIT) {
    const oldestKey = traversalResultCache.keys().next().value
    if (typeof oldestKey === 'string') traversalResultCache.delete(oldestKey)
  }
  return value
}

function resolveTraversalGraphAccess(
  graph: GraphData | null,
  context?: GraphTraversalCacheContext | null,
): TraversalGraphAccess | null {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return null
  const graphRevision = readGraphRevision(context?.graphRevision)
  const graphSemanticKey = buildScopedGraphSemanticKey('graph-traversal', {
    graphData: graph,
    graphRevision,
    graphSemanticKey: context?.graphSemanticKey,
  })
  if (!graphSemanticKey) return null
  const lookup = getCachedGraphLookup({
    cacheScope: 'graph-traversal-lookup',
    graphData: graph,
    graphRevision,
    graphSemanticKey,
    preferCurrentGraphDataRefs: true,
  })
  if (!lookup) return null
  return {
    graphSemanticKey,
    graphRevision,
    lookup,
  }
}

function buildTraversalResultCacheKey(scope: string, graphSemanticKey: string, parts: Array<string | number>): string {
  return hashSignatureParts([scope, graphSemanticKey, ...parts])
}

function getEdgeOtherNodeId(edge: { source?: unknown; target?: unknown }, currentNodeId: string): string {
  const sourceId = String(edge.source || '').trim()
  const targetId = String(edge.target || '').trim()
  if (!sourceId && !targetId) return ''
  if (sourceId === currentNodeId) return targetId
  if (targetId === currentNodeId) return sourceId
  return sourceId || targetId
}

function findIncidentPathEdgeId(
  lookup: CachedGraphLookup,
  sourceNodeId: string,
  targetNodeId: string,
): string | null {
  const incidentEdges = lookup.incidentEdgesByNodeId.get(sourceNodeId) || []
  for (let i = 0; i < incidentEdges.length; i += 1) {
    const edge = incidentEdges[i]
    const edgeSourceId = String(edge?.source || '').trim()
    const edgeTargetId = String(edge?.target || '').trim()
    if (
      (edgeSourceId === sourceNodeId && edgeTargetId === targetNodeId)
      || (edgeSourceId === targetNodeId && edgeTargetId === sourceNodeId)
    ) {
      const edgeId = String(edge?.id || '').trim()
      if (edgeId) return edgeId
    }
  }
  return null
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

export function findGraphRagTraversalEdgeIds(
  graph: GraphData | null,
  context?: GraphTraversalCacheContext | null,
): string[] {
  const access = resolveTraversalGraphAccess(graph, context)
  if (!access) return []
  const cacheKey = buildTraversalResultCacheKey('graph-rag-traversal', access.graphSemanticKey, [
    access.graphRevision,
  ])
  const cached = readCachedTraversalResult(cacheKey)
  if (cached) return cached
  const owner = access.lookup.nodes.find(node => {
    const props = node.properties ?? {}
    const raw = (props as Record<string, JSONValue>).graphRAGPath
    if (!isGraphRagPathValue(raw)) return false
    const parsed = toParsedTraversePath(raw)
    return parsed !== null && Array.isArray(parsed.traverse) && parsed.traverse.length > 0
  })
  if (!owner) return writeCachedTraversalResult(cacheKey, [])
  const props = owner.properties ?? {}
  const raw = (props as Record<string, JSONValue>).graphRAGPath
  if (!isGraphRagPathValue(raw)) return writeCachedTraversalResult(cacheKey, [])
  const parsed = toParsedTraversePath(raw)
  if (!parsed || !Array.isArray(parsed.traverse) || parsed.traverse.length === 0) {
    return writeCachedTraversalResult(cacheKey, [])
  }
  const pathIds: AgenticRagNodeId[] = [owner.id as AgenticRagNodeId, ...parsed.traverse]
  const edgesForPath: string[] = []
  for (let i = 0; i < pathIds.length - 1; i += 1) {
    const edgeId = findIncidentPathEdgeId(access.lookup, String(pathIds[i]), String(pathIds[i + 1]))
    if (edgeId) edgesForPath.push(edgeId)
  }
  return writeCachedTraversalResult(cacheKey, edgesForPath)
}

export type TraversalQuery = {
  startNodeId: string
  maxDepth: number
  allowedEdgeLabels?: string[]
}

export function findTraversalEdgeIds(
  graph: GraphData | null,
  query: TraversalQuery | null,
  context?: GraphTraversalCacheContext | null,
): string[] {
  const access = resolveTraversalGraphAccess(graph, context)
  if (!access) return []
  if (!query) return []
  const start = String(query.startNodeId || '').trim()
  if (!start) return []
  const maxDepth = Number.isFinite(query.maxDepth) && query.maxDepth > 0 ? Math.floor(query.maxDepth) : 1
  const allowedLabels = normalizeStringArrayForSignature(query.allowedEdgeLabels, {
    unique: true,
    sort: true,
  })
  const nodeExists = access.lookup.nodeById.has(start)
  if (!nodeExists) return []
  const cacheKey = buildTraversalResultCacheKey('generic-traversal', access.graphSemanticKey, [
    access.graphRevision,
    start,
    maxDepth,
    ...allowedLabels,
  ])
  const cached = readCachedTraversalResult(cacheKey)
  if (cached) return cached
  const allowedLabelSet = allowedLabels.length > 0 ? new Set(allowedLabels) : null
  const visitedNodes = new Set<string>()
  const queued: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }]
  let queuedIndex = 0
  visitedNodes.add(start)
  const edgeIds = new Set<string>()
  while (queuedIndex < queued.length) {
    const current = queued[queuedIndex]
    queuedIndex += 1
    if (current.depth >= maxDepth) continue
    const incidentEdges = access.lookup.incidentEdgesByNodeId.get(current.id) || []
    if (incidentEdges.length === 0) continue
    for (let i = 0; i < incidentEdges.length; i += 1) {
      const edge = incidentEdges[i]
      const edgeLabel = String(edge?.label ?? '').trim()
      if (allowedLabelSet && !allowedLabelSet.has(edgeLabel)) continue
      const edgeId = String(edge?.id || '').trim()
      if (edgeId && !edgeIds.has(edgeId)) edgeIds.add(edgeId)
      const otherId = getEdgeOtherNodeId(edge, current.id)
      if (!otherId || visitedNodes.has(otherId)) continue
      visitedNodes.add(otherId)
      queued.push({ id: otherId, depth: current.depth + 1 })
    }
  }
  const result = Array.from(edgeIds)
  return writeCachedTraversalResult(cacheKey, result)
}
