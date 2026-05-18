import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { hashSignatureParts } from '@/lib/hash/signature'

export const GRAPH_TOPOLOGY_VERSION = 1
export const STRUCTURAL_GRAPH_EDGE_LABELS = new Set(['hasSection', 'hasBlock', 'hasItem', 'contains', 'next'])

const GRAPH_TOPOLOGY_CACHE_LIMIT = 16
const DEFAULT_ANNOTATED_ITEM_LIMIT = 8000

export type GraphTopologyCount = {
  value: string
  count: number
}

export type GraphTopologySummary = {
  version: number
  nodeCount: number
  edgeCount: number
  connectedNodeCount: number
  isolatedNodeCount: number
  unresolvedEdgeCount: number
  selfLoopEdgeCount: number
  structuralEdgeCount: number
  mediaNodeCount: number
  keywordNodeCount: number
  maxDegree: number
  topNodeTypes: GraphTopologyCount[]
  topEdgeLabels: GraphTopologyCount[]
  signature: string
}

type NodeTopology = {
  inDegree: number
  outDegree: number
  degree: number
  structuralDegree: number
}

type TopologyAnalysis = {
  summary: GraphTopologySummary
  nodeTopologyById: Map<string, NodeTopology>
  structuralEdgeIndexSet: Set<number>
  resolvedEdgeIndexSet: Set<number>
}

const enrichedGraphCache = new WeakMap<object, Map<string, GraphData>>()

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const readRecord = (value: unknown): Record<string, unknown> => {
  return isRecord(value) ? value : {}
}

const readFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const isSameJsonValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return Number.isFinite(a) && Number.isFinite(b) && a === b
  return false
}

const writeJsonProp = (record: Record<string, unknown>, key: string, value: JSONValue): boolean => {
  if (isSameJsonValue(record[key], value)) return false
  record[key] = value
  return true
}

const bumpCount = (counts: Map<string, number>, raw: unknown, fallback: string) => {
  const value = String(raw || '').trim() || fallback
  counts.set(value, (counts.get(value) || 0) + 1)
}

const topCounts = (counts: Map<string, number>, limit = 12): GraphTopologyCount[] => {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit)
}

export const isStructuralGraphEdge = (edge: GraphEdge | null | undefined): boolean => {
  return STRUCTURAL_GRAPH_EDGE_LABELS.has(String((edge as { label?: unknown } | null | undefined)?.label || '').trim())
}

const hasMediaSignal = (node: GraphNode): boolean => {
  const props = readRecord((node as { properties?: unknown }).properties)
  const type = String((node as { type?: unknown }).type || '').toLowerCase()
  if (/\b(image|video|audio|media|iframe|model|html)\b/.test(type)) return true
  for (const key of ['media_url', 'mediaUrl', 'src', 'url', 'image', 'video', 'iframe', 'assetUrl']) {
    const value = props[key]
    if (typeof value === 'string' && value.trim()) return true
  }
  return false
}

const hasKeywordSignal = (node: GraphNode): boolean => {
  const props = readRecord((node as { properties?: unknown }).properties)
  if (typeof props['keyword:key'] === 'string' && props['keyword:key'].trim()) return true
  if (String((node as { type?: unknown }).type || '').toLowerCase().includes('keyword')) return true
  return String(props['keyword:extractor'] || '').trim().length > 0
}

const graphTopologySignature = (summary: Omit<GraphTopologySummary, 'signature'>): string => {
  return hashSignatureParts([
    `graph-topology:v${GRAPH_TOPOLOGY_VERSION}`,
    summary.nodeCount,
    summary.edgeCount,
    summary.connectedNodeCount,
    summary.isolatedNodeCount,
    summary.unresolvedEdgeCount,
    summary.selfLoopEdgeCount,
    summary.structuralEdgeCount,
    summary.mediaNodeCount,
    summary.keywordNodeCount,
    summary.maxDegree,
    ...summary.topNodeTypes.map(item => `n:${item.value}:${item.count}`),
    ...summary.topEdgeLabels.map(item => `e:${item.value}:${item.count}`),
  ])
}

const analyzeGraphTopology = (graphData: GraphData): TopologyAnalysis => {
  const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
  const edges = Array.isArray(graphData.edges) ? (graphData.edges as GraphEdge[]) : []
  const nodeIdSet = new Set<string>()
  const nodeTopologyById = new Map<string, NodeTopology>()
  const nodeTypeCounts = new Map<string, number>()
  const edgeLabelCounts = new Map<string, number>()
  const structuralEdgeIndexSet = new Set<number>()
  const resolvedEdgeIndexSet = new Set<number>()
  let mediaNodeCount = 0
  let keywordNodeCount = 0

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (id) {
      nodeIdSet.add(id)
      nodeTopologyById.set(id, { inDegree: 0, outDegree: 0, degree: 0, structuralDegree: 0 })
    }
    bumpCount(nodeTypeCounts, (node as { type?: unknown } | null)?.type, 'Node')
    if (hasMediaSignal(node)) mediaNodeCount += 1
    if (hasKeywordSignal(node)) keywordNodeCount += 1
  }

  let unresolvedEdgeCount = 0
  let selfLoopEdgeCount = 0
  let structuralEdgeCount = 0

  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    const { src, tgt } = readGraphEdgeEndpoints(edge)
    const hasSource = !!src && nodeIdSet.has(src)
    const hasTarget = !!tgt && nodeIdSet.has(tgt)
    const structural = isStructuralGraphEdge(edge)
    bumpCount(edgeLabelCounts, (edge as { label?: unknown } | null)?.label, 'link')
    if (structural) {
      structuralEdgeCount += 1
      structuralEdgeIndexSet.add(i)
    }
    if (!src || !tgt || !hasSource || !hasTarget) {
      unresolvedEdgeCount += 1
      continue
    }
    resolvedEdgeIndexSet.add(i)
    if (src === tgt) selfLoopEdgeCount += 1
    const sourceTopology = nodeTopologyById.get(src)
    if (sourceTopology) {
      sourceTopology.outDegree += 1
      sourceTopology.degree += 1
      if (structural) sourceTopology.structuralDegree += 1
    }
    if (tgt !== src) {
      const targetTopology = nodeTopologyById.get(tgt)
      if (targetTopology) {
        targetTopology.inDegree += 1
        targetTopology.degree += 1
        if (structural) targetTopology.structuralDegree += 1
      }
    }
  }

  let connectedNodeCount = 0
  let maxDegree = 0
  nodeTopologyById.forEach(topology => {
    if (topology.degree > 0) connectedNodeCount += 1
    if (topology.degree > maxDegree) maxDegree = topology.degree
  })
  const baseSummary = {
    version: GRAPH_TOPOLOGY_VERSION,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    connectedNodeCount,
    isolatedNodeCount: Math.max(0, nodes.length - connectedNodeCount),
    unresolvedEdgeCount,
    selfLoopEdgeCount,
    structuralEdgeCount,
    mediaNodeCount,
    keywordNodeCount,
    maxDegree,
    topNodeTypes: topCounts(nodeTypeCounts),
    topEdgeLabels: topCounts(edgeLabelCounts),
  }
  return {
    summary: { ...baseSummary, signature: graphTopologySignature(baseSummary) },
    nodeTopologyById,
    structuralEdgeIndexSet,
    resolvedEdgeIndexSet,
  }
}

export const readGraphTopologySummary = (
  graphData: { metadata?: unknown } | null | undefined,
): GraphTopologySummary | null => {
  const meta = readRecord(graphData?.metadata)
  const raw = meta.graphTopology
  if (!isRecord(raw)) return null
  const nodeCount = readFiniteNumber(raw.nodeCount)
  const edgeCount = readFiniteNumber(raw.edgeCount)
  if (nodeCount == null || edgeCount == null) return null
  return raw as unknown as GraphTopologySummary
}

const readCachedEnrichedGraph = (graphData: GraphData, cacheKey: string): GraphData | null => {
  const perGraph = enrichedGraphCache.get(graphData as unknown as object)
  if (!perGraph) return null
  const cached = perGraph.get(cacheKey) || null
  if (!cached) return null
  perGraph.delete(cacheKey)
  perGraph.set(cacheKey, cached)
  return cached
}

const writeCachedEnrichedGraph = (graphData: GraphData, cacheKey: string, value: GraphData): GraphData => {
  let perGraph = enrichedGraphCache.get(graphData as unknown as object)
  if (!perGraph) {
    perGraph = new Map<string, GraphData>()
    enrichedGraphCache.set(graphData as unknown as object, perGraph)
  }
  perGraph.set(cacheKey, value)
  if (perGraph.size > GRAPH_TOPOLOGY_CACHE_LIMIT) {
    const oldestKey = perGraph.keys().next().value
    if (typeof oldestKey === 'string') perGraph.delete(oldestKey)
  }
  return value
}

export function withGraphTopologyMetadata(args: {
  graphData: GraphData | null | undefined
  graphRevision?: number | null
  graphSemanticKey?: string | null
  stage?: string | null
  annotate?: boolean
  maxAnnotatedItems?: number
}): GraphData | null {
  const graphData = args.graphData || null
  if (!graphData) return null
  const stage = String(args.stage || 'graph').trim() || 'graph'
  const annotate = args.annotate !== false
  const maxAnnotatedItems = Math.max(0, Math.floor(args.maxAnnotatedItems ?? DEFAULT_ANNOTATED_ITEM_LIMIT))
  const cacheKey = buildScopedGraphSemanticKey('graph-topology', {
    graphData,
    graphRevision: args.graphRevision,
    graphSemanticKey: [
      args.graphSemanticKey || '',
      `stage:${stage}`,
      `annotate:${annotate ? '1' : '0'}`,
      `limit:${maxAnnotatedItems}`,
      `v:${GRAPH_TOPOLOGY_VERSION}`,
    ].join('|'),
  })
  if (cacheKey) {
    const cached = readCachedEnrichedGraph(graphData, cacheKey)
    if (cached) return cached
  }

  const analysis = analyzeGraphTopology(graphData)
  const summary = analysis.summary
  const meta = readRecord(graphData.metadata)
  const nextMetadata: Record<string, JSONValue> = {
    ...(meta as Record<string, JSONValue>),
    graphTopologyVersion: GRAPH_TOPOLOGY_VERSION as unknown as JSONValue,
    graphTopologyStage: stage as unknown as JSONValue,
    graphTopologySignature: summary.signature as unknown as JSONValue,
    graphTopology: summary as unknown as JSONValue,
  }

  const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
  const edges = Array.isArray(graphData.edges) ? (graphData.edges as GraphEdge[]) : []
  const shouldAnnotate = annotate && nodes.length + edges.length <= maxAnnotatedItems

  if (!shouldAnnotate) {
    const metadataOnly = { ...graphData, metadata: nextMetadata }
    return cacheKey ? writeCachedEnrichedGraph(graphData, cacheKey, metadataOnly) : metadataOnly
  }

  const nextNodes = nodes.map(node => {
    const id = String(node?.id || '').trim()
    const topology = id ? analysis.nodeTopologyById.get(id) : null
    if (!topology) return node
    const props = { ...readRecord((node as { properties?: unknown }).properties) }
    let changed = false
    changed = writeJsonProp(props, 'graph:degree', topology.degree as unknown as JSONValue) || changed
    changed = writeJsonProp(props, 'graph:inDegree', topology.inDegree as unknown as JSONValue) || changed
    changed = writeJsonProp(props, 'graph:outDegree', topology.outDegree as unknown as JSONValue) || changed
    changed = writeJsonProp(props, 'graph:structuralDegree', topology.structuralDegree as unknown as JSONValue) || changed
    if (readFiniteNumber(props['visual:importance']) == null && topology.degree > 0) {
      changed = writeJsonProp(props, 'visual:importance', Math.min(240, 12 + topology.degree * 4 + topology.structuralDegree * 8) as unknown as JSONValue) || changed
    }
    if (readFiniteNumber(props['visual:nodeSize']) == null && topology.degree > 0) {
      changed = writeJsonProp(props, 'visual:nodeSize', Math.min(48, 10 + Math.sqrt(topology.degree) * 4) as unknown as JSONValue) || changed
    }
    return changed ? { ...node, properties: props as GraphNode['properties'] } : node
  })

  const nextEdges = edges.map((edge, index) => {
    const structural = analysis.structuralEdgeIndexSet.has(index)
    const resolved = analysis.resolvedEdgeIndexSet.has(index)
    if (!structural && resolved) return edge
    const props = { ...readRecord((edge as { properties?: unknown }).properties) }
    let changed = false
    if (structural) {
      changed = writeJsonProp(props, 'graph:structural', true as unknown as JSONValue) || changed
      if (readFiniteNumber(props['visual:width']) == null) {
        changed = writeJsonProp(props, 'visual:width', 1.5 as unknown as JSONValue) || changed
      }
    }
    if (!resolved) changed = writeJsonProp(props, 'graph:endpointState', 'unresolved' as unknown as JSONValue) || changed
    return changed ? { ...edge, properties: props as GraphEdge['properties'] } : edge
  })

  const enriched: GraphData = {
    ...graphData,
    nodes: nextNodes,
    edges: nextEdges,
    metadata: nextMetadata,
  }
  return cacheKey ? writeCachedEnrichedGraph(graphData, cacheKey, enriched) : enriched
}
