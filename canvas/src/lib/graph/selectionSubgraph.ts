import { GraphData, type SelectionAnchorIds } from './types';
import { getCachedGraphLookup } from './lookupCache'
import { buildScopedGraphSemanticKey } from './semanticKey'
import { hashScopedStringArraySignature, hashSignatureParts } from '@/lib/hash/signature'

const SELECTION_SUBGRAPH_CACHE_LIMIT = 24
const selectionSubgraphCache = new Map<string, GraphData | null>()
const selectionSubgraphMembershipCache = new Map<string, SelectionSubgraphMembership | null>()

export type SelectionSubgraphMembership = {
  subgraph: GraphData
  nodeIdSet: Set<string>
  edgeIdSet: Set<string>
}

function readCachedSelectionSubgraph(cacheKey: string): GraphData | null | undefined {
  if (!cacheKey) return undefined
  const cached = selectionSubgraphCache.get(cacheKey)
  if (cached === undefined) return undefined
  selectionSubgraphCache.delete(cacheKey)
  selectionSubgraphCache.set(cacheKey, cached)
  return cached
}

function writeCachedSelectionSubgraph(cacheKey: string, graphData: GraphData | null): GraphData | null {
  if (!cacheKey) return graphData
  selectionSubgraphCache.set(cacheKey, graphData)
  if (selectionSubgraphCache.size > SELECTION_SUBGRAPH_CACHE_LIMIT) {
    const oldestKey = selectionSubgraphCache.keys().next().value
    if (typeof oldestKey === 'string') selectionSubgraphCache.delete(oldestKey)
  }
  return graphData
}

function readCachedSelectionSubgraphMembership(
  cacheKey: string,
): SelectionSubgraphMembership | null | undefined {
  if (!cacheKey) return undefined
  const cached = selectionSubgraphMembershipCache.get(cacheKey)
  if (cached === undefined) return undefined
  selectionSubgraphMembershipCache.delete(cacheKey)
  selectionSubgraphMembershipCache.set(cacheKey, cached)
  return cached
}

function writeCachedSelectionSubgraphMembership(
  cacheKey: string,
  membership: SelectionSubgraphMembership | null,
): SelectionSubgraphMembership | null {
  if (!cacheKey) return membership
  selectionSubgraphMembershipCache.set(cacheKey, membership)
  if (selectionSubgraphMembershipCache.size > SELECTION_SUBGRAPH_CACHE_LIMIT) {
    const oldestKey = selectionSubgraphMembershipCache.keys().next().value
    if (typeof oldestKey === 'string') selectionSubgraphMembershipCache.delete(oldestKey)
  }
  return membership
}

function buildSelectionSubgraphCacheKey(
  data: GraphData,
  selectedNodeIds: readonly string[],
  selectedEdgeIds: readonly string[],
): string {
  const graphSemanticKey = buildScopedGraphSemanticKey('graph-file-selection-subgraph', { graphData: data })
  const graphNodeIds = Array.isArray(data.nodes) ? data.nodes.map(node => String(node.id || '').trim()) : []
  const graphEdgeIds = Array.isArray(data.edges)
    ? data.edges.map(edge => [edge.id, edge.source, edge.target].map(value => String(value || '').trim()).join('>'))
    : []
  return hashSignatureParts([
    'graph-file-selection-subgraph',
    graphSemanticKey,
    hashScopedStringArraySignature('graph-node-ids', graphNodeIds),
    hashScopedStringArraySignature('graph-edge-ids', graphEdgeIds),
    hashScopedStringArraySignature('selected-node-ids', selectedNodeIds),
    hashScopedStringArraySignature('selected-edge-ids', selectedEdgeIds),
  ])
}

export function buildSelectionSubgraph(data: GraphData, selectedNodeId: string | null, selectedEdgeId: string | null): GraphData | null {
  if (selectedNodeId) return buildSelectionSubgraphForIds(data, [selectedNodeId], [])
  if (selectedEdgeId) return buildSelectionSubgraphForIds(data, [], [selectedEdgeId])
  return null
}

export function buildSelectionSubgraphForIds(
  data: GraphData,
  selectedNodeIds: readonly string[],
  selectedEdgeIds: readonly string[],
): GraphData | null {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
  const normalizedSelectedNodeIds = Array.from(new Set((selectedNodeIds || []).map(id => String(id || '').trim()).filter(Boolean)))
  const normalizedSelectedEdgeIds = Array.from(new Set((selectedEdgeIds || []).map(id => String(id || '').trim()).filter(Boolean)))
  const cacheKey = buildSelectionSubgraphCacheKey(data, normalizedSelectedNodeIds, normalizedSelectedEdgeIds)
  const cached = readCachedSelectionSubgraph(cacheKey)
  if (cached !== undefined) return cached
  const graphSemanticKey = buildScopedGraphSemanticKey('graph-file-selection-subgraph-lookup', { graphData: data })
  const graphLookup = getCachedGraphLookup({
    cacheScope: 'graph-file-selection-subgraph-lookup',
    graphData: data,
    graphSemanticKey,
    preferCurrentGraphDataRefs: true,
  })
  const nodeById = graphLookup?.nodeById || new Map(data.nodes.map(n => [String(n.id), n]))
  const edgeById = graphLookup?.edgeById || new Map(data.edges.map(e => [String(e.id), e]))
  const incidentEdgesByNodeId = graphLookup?.incidentEdgesByNodeId || null
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  for (const id of normalizedSelectedEdgeIds) {
    if (!id) continue;
    if (edgeById.has(id)) edgeIds.add(id);
  }
  for (const id of normalizedSelectedNodeIds) {
    if (!id) continue;
    if (!nodeById.has(id)) continue
    nodeIds.add(id)
    if (!incidentEdgesByNodeId) continue
    const incidentEdges = incidentEdgesByNodeId.get(id) || []
    for (let i = 0; i < incidentEdges.length; i += 1) {
      const edgeId = String(incidentEdges[i]?.id || '').trim()
      if (edgeId) edgeIds.add(edgeId)
    }
  }
  const nextEdges = (graphLookup?.edges || data.edges).filter(e => edgeIds.has(String(e.id)))
  for (const edge of nextEdges) {
    nodeIds.add(String(edge.source));
    nodeIds.add(String(edge.target));
  }
  if (nodeIds.size === 0 && nextEdges.length === 0) return null;
  const nodes = (graphLookup?.nodes || data.nodes).filter(n => nodeIds.has(String(n.id)));
  if (nodes.length === 0) return writeCachedSelectionSubgraph(cacheKey, null);
  return writeCachedSelectionSubgraph(cacheKey, {
    ...data,
    nodes,
    edges: nextEdges,
  });
}

export function buildSelectionSubgraphForAnchorIds(
  data: GraphData,
  selectionAnchorIds: SelectionAnchorIds,
): GraphData | null {
  const { selectionNodeIds, selectionEdgeIds } = selectionAnchorIds;
  return buildSelectionSubgraphForIds(data, selectionNodeIds, selectionEdgeIds);
}

export function readSelectionSubgraphMembershipForIds(
  data: GraphData,
  selectedNodeIds: readonly string[],
  selectedEdgeIds: readonly string[],
): SelectionSubgraphMembership | null {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null
  const normalizedSelectedNodeIds = Array.from(
    new Set((selectedNodeIds || []).map(id => String(id || '').trim()).filter(Boolean)),
  )
  const normalizedSelectedEdgeIds = Array.from(
    new Set((selectedEdgeIds || []).map(id => String(id || '').trim()).filter(Boolean)),
  )
  const cacheKey = buildSelectionSubgraphCacheKey(
    data,
    normalizedSelectedNodeIds,
    normalizedSelectedEdgeIds,
  )
  const cached = readCachedSelectionSubgraphMembership(cacheKey)
  if (cached !== undefined) return cached
  const subgraph = buildSelectionSubgraphForIds(data, normalizedSelectedNodeIds, normalizedSelectedEdgeIds)
  if (!subgraph) return writeCachedSelectionSubgraphMembership(cacheKey, null)
  return writeCachedSelectionSubgraphMembership(cacheKey, {
    subgraph,
    nodeIdSet: new Set(subgraph.nodes.map(node => String(node.id))),
    edgeIdSet: new Set(subgraph.edges.map(edge => String(edge.id))),
  })
}

export function readSelectionSubgraphMembershipForAnchorIds(
  data: GraphData,
  selectionAnchorIds: SelectionAnchorIds,
): SelectionSubgraphMembership | null {
  const { selectionNodeIds, selectionEdgeIds } = selectionAnchorIds
  return readSelectionSubgraphMembershipForIds(data, selectionNodeIds, selectionEdgeIds)
}
