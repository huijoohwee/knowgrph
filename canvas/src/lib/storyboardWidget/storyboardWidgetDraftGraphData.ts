import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { readFlowEdgePortKey } from '@/lib/graph/flowPorts'
import { readNodeProperties, unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import { parseCanonicalNodeIds, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'
import { hashRecordSignature32, hashSignatureParts } from '@/lib/hash/signature'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'

const STORYBOARD_WIDGET_PENDING_APPEND_NODE_IDS = 'storyboardWidgetPendingAppendNodeIds'
const STORYBOARD_WIDGET_PENDING_APPEND_EDGE_IDS = 'storyboardWidgetPendingAppendEdgeIds'

const readGraphEntityId = (entity: GraphNode | GraphEdge): string => splitComposedNodeId(entity?.id).full

function readPendingAppendEntityIds(graphData: GraphData, key: string): string[] {
  const metadata = graphData.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const raw = (metadata as Record<string, unknown>)[key]
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(value => splitComposedNodeId(value).full).filter(Boolean))]
}

function resolveGraphEntityByCanonicalId<T extends GraphNode | GraphEdge>(
  entities: readonly T[],
  rawId: unknown,
): T | null {
  const candidateIds = parseCanonicalNodeIds(rawId)
  if (candidateIds.length === 0) return null
  for (const candidateId of candidateIds) {
    const exact = entities.find(entity => readGraphEntityId(entity) === candidateId) || null
    if (exact) return exact
  }
  const candidateInnerIds = new Set(candidateIds.map(id => splitComposedNodeId(id).inner).filter(Boolean))
  if (candidateInnerIds.size === 0) return null
  const innerMatches = entities.filter(entity => candidateInnerIds.has(splitComposedNodeId(entity.id).inner))
  return innerMatches.length === 1 ? innerMatches[0] || null : null
}

function resolveUniqueCanonicalGraphEntityPair<T extends GraphNode | GraphEdge>(
  sourceEntities: readonly T[],
  sourceEntity: T,
  candidateEntities: readonly T[],
): T | null {
  const candidate = resolveGraphEntityByCanonicalId(candidateEntities, sourceEntity.id)
  if (!candidate) return null
  return resolveGraphEntityByCanonicalId(sourceEntities, candidate.id) === sourceEntity ? candidate : null
}

function hasCompatibleDraftNodeIdentity(currentDraft: GraphData | null, baseGraphData: GraphData | null): boolean {
  const draftNodes = Array.isArray(currentDraft?.nodes) ? currentDraft.nodes : []
  const baseNodes = Array.isArray(baseGraphData?.nodes) ? baseGraphData.nodes : []
  if (draftNodes.length === 0 || baseNodes.length === 0) return false
  const sharedCount = draftNodes.filter(node => (
    resolveUniqueCanonicalGraphEntityPair(draftNodes, node, baseNodes)
  )).length
  return sharedCount >= Math.max(1, Math.min(draftNodes.length, baseNodes.length) * 0.8)
}

function hasDraftNodeIdentitySuperset(currentDraft: GraphData | null, baseGraphData: GraphData | null): boolean {
  const draftNodes = Array.isArray(currentDraft?.nodes) ? currentDraft.nodes : []
  const baseNodes = Array.isArray(baseGraphData?.nodes) ? baseGraphData.nodes : []
  if (draftNodes.length <= baseNodes.length || baseNodes.length === 0) return false
  return baseNodes.every(node => resolveUniqueCanonicalGraphEntityPair(baseNodes, node, draftNodes))
}

export function hasStoryboardWidgetDraftGraphDataCanonicalSuperset(
  candidateGraphData: GraphData | null | undefined,
  requiredGraphData: GraphData | null | undefined,
): boolean {
  if (!candidateGraphData || !requiredGraphData) return false
  const candidateNodes = Array.isArray(candidateGraphData.nodes) ? candidateGraphData.nodes : []
  const requiredNodes = Array.isArray(requiredGraphData.nodes) ? requiredGraphData.nodes : []
  const candidateEdges = Array.isArray(candidateGraphData.edges) ? candidateGraphData.edges : []
  const requiredEdges = Array.isArray(requiredGraphData.edges) ? requiredGraphData.edges : []
  return requiredNodes.every(node => resolveUniqueCanonicalGraphEntityPair(requiredNodes, node, candidateNodes))
    && requiredEdges.every(edge => resolveUniqueCanonicalGraphEntityPair(requiredEdges, edge, candidateEdges))
}

function mergeStoryboardWidgetLiveFirstGraphEntities<T extends GraphNode | GraphEdge>(
  liveEntities: readonly T[],
  draftEntities: readonly T[],
): T[] {
  const merged = liveEntities.slice()
  for (const draftEntity of draftEntities) {
    if (!resolveUniqueCanonicalGraphEntityPair(draftEntities, draftEntity, merged)) merged.push(draftEntity)
  }
  return merged
}

function collectPendingAppendEntityIds<T extends GraphNode | GraphEdge>(args: {
  liveEntities: readonly T[]
  draftEntities: readonly T[]
  previousPendingIds: readonly string[]
}): string[] {
  const pendingIds = new Set<string>()
  for (const pendingId of args.previousPendingIds) {
    if (!resolveGraphEntityByCanonicalId(args.liveEntities, pendingId)) pendingIds.add(pendingId)
  }
  for (const draftEntity of args.draftEntities) {
    if (resolveUniqueCanonicalGraphEntityPair(args.draftEntities, draftEntity, args.liveEntities)) continue
    const id = readGraphEntityId(draftEntity)
    if (id) pendingIds.add(id)
  }
  return [...pendingIds]
}

export function mergeStoryboardWidgetDraftGraphDataWithLiveAdditions(args: {
  liveGraphData: GraphData
  draftGraphData: GraphData
}): GraphData {
  const liveNodes = args.liveGraphData.nodes || []
  const draftNodes = args.draftGraphData.nodes || []
  const liveEdges = args.liveGraphData.edges || []
  const draftEdges = args.draftGraphData.edges || []
  const pendingNodeIds = collectPendingAppendEntityIds({
    liveEntities: liveNodes,
    draftEntities: draftNodes,
    previousPendingIds: readPendingAppendEntityIds(args.draftGraphData, STORYBOARD_WIDGET_PENDING_APPEND_NODE_IDS),
  })
  const pendingEdgeIds = collectPendingAppendEntityIds({
    liveEntities: liveEdges,
    draftEntities: draftEdges,
    previousPendingIds: readPendingAppendEntityIds(args.draftGraphData, STORYBOARD_WIDGET_PENDING_APPEND_EDGE_IDS),
  })
  const metadata = {
    ...((args.draftGraphData.metadata || {}) as Record<string, unknown>),
    ...((args.liveGraphData.metadata || {}) as Record<string, unknown>),
  } as NonNullable<GraphData['metadata']>
  if (pendingNodeIds.length > 0) metadata[STORYBOARD_WIDGET_PENDING_APPEND_NODE_IDS] = pendingNodeIds
  else delete metadata[STORYBOARD_WIDGET_PENDING_APPEND_NODE_IDS]
  if (pendingEdgeIds.length > 0) metadata[STORYBOARD_WIDGET_PENDING_APPEND_EDGE_IDS] = pendingEdgeIds
  else delete metadata[STORYBOARD_WIDGET_PENDING_APPEND_EDGE_IDS]
  const mergedGraph: GraphData = {
    ...args.draftGraphData,
    ...args.liveGraphData,
    metadata,
    nodes: mergeStoryboardWidgetLiveFirstGraphEntities(liveNodes, draftNodes),
    edges: mergeStoryboardWidgetLiveFirstGraphEntities(liveEdges, draftEdges),
  }
  return bumpStoryboardWidgetDraftGraphDataRevision(mergedGraph, {
    revisionFloor: Math.max(
      readGraphDataRevision(args.liveGraphData),
      readGraphDataRevision(args.draftGraphData),
    ),
  })
}

const cleanSignatureText = (value: unknown): string => String(unwrapGraphCellValue(value) ?? '').trim()

const readGraphMetadataIdentity = (graphData: GraphData | null | undefined): string => {
  const metadata = graphData?.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return ''
  const rec = metadata as Record<string, unknown>
  return [
    cleanSignatureText(rec.kind),
    cleanSignatureText(rec.source),
    cleanSignatureText(rec.sourceLayerHash),
    cleanSignatureText(rec.sourceLayerOrderHash),
    cleanSignatureText(rec.graphSemanticKey),
  ].join(':')
}

export function buildStoryboardWidgetDraftGraphBaseSignature(graphData: GraphData | null | undefined): string {
  const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes as GraphNode[]) : []
  const edges = Array.isArray(graphData?.edges) ? (graphData!.edges as GraphEdge[]) : []
  const nodeParts = nodes
    .map(node => [
      cleanSignatureText(node?.id),
      cleanSignatureText(node?.type),
      cleanSignatureText(node?.label),
      String(hashRecordSignature32(readNodeProperties(node), { maxEntries: 120, maxDepth: 2 })),
    ].join(':'))
    .sort((left, right) => left.localeCompare(right))
  const edgeParts = edges
    .map(edge => {
      const { src, tgt } = readGraphEdgeEndpoints(edge)
      return [
        cleanSignatureText(edge?.id),
        cleanSignatureText(src),
        cleanSignatureText(tgt),
        cleanSignatureText(edge?.label),
        cleanSignatureText(readFlowEdgePortKey(edge, 'source')),
        cleanSignatureText(readFlowEdgePortKey(edge, 'target')),
        String(hashRecordSignature32(edge?.properties, { maxEntries: 120, maxDepth: 2 })),
      ].join(':')
    })
    .sort((left, right) => left.localeCompare(right))
  return hashSignatureParts([
    'storyboard-widget-draft-base',
    cleanSignatureText(graphData?.context),
    cleanSignatureText(graphData?.type),
    readGraphMetadataIdentity(graphData),
    nodes.length,
    ...nodeParts,
    edges.length,
    ...edgeParts,
  ])
}

function hasSameDraftGraphBaseSignature(currentDraft: GraphData | null, baseGraphData: GraphData | null): boolean {
  if (!currentDraft || !baseGraphData) return false
  return buildStoryboardWidgetDraftGraphBaseSignature(currentDraft) === buildStoryboardWidgetDraftGraphBaseSignature(baseGraphData)
}

const graphValueEquals = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

function mergeChangedRecord(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...current }
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  for (const key of keys) {
    if (graphValueEquals(previous[key], next[key])) continue
    if (Object.prototype.hasOwnProperty.call(next, key)) merged[key] = next[key]
    else delete merged[key]
  }
  return merged
}

function mergeChangedGraphEntity<T extends GraphNode | GraphEdge>(previous: T, current: T, next: T): T {
  const merged = mergeChangedRecord(
    previous as unknown as Record<string, unknown>,
    current as unknown as Record<string, unknown>,
    next as unknown as Record<string, unknown>,
  )
  merged.properties = mergeChangedRecord(
    (previous.properties || {}) as Record<string, unknown>,
    (current.properties || {}) as Record<string, unknown>,
    (next.properties || {}) as Record<string, unknown>,
  )
  return merged as T
}

function mergeChangedGraphEntities<T extends GraphNode | GraphEdge>(
  previousEntities: readonly T[],
  currentEntities: readonly T[],
  nextEntities: readonly T[],
): T[] {
  const merged = currentEntities
    .filter(entity => {
      const previous = resolveUniqueCanonicalGraphEntityPair(currentEntities, entity, previousEntities)
      return !previous || Boolean(resolveUniqueCanonicalGraphEntityPair(currentEntities, entity, nextEntities))
    })
    .map(current => {
      const next = resolveUniqueCanonicalGraphEntityPair(currentEntities, current, nextEntities)
      if (!next) return current
      const previous = resolveUniqueCanonicalGraphEntityPair(currentEntities, current, previousEntities)
      if (previous) return mergeChangedGraphEntity(previous, current, next)
      const merged = {
        ...current,
        ...next,
        id: current.id,
        metadata: { ...((current.metadata || {}) as Record<string, unknown>), ...((next.metadata || {}) as Record<string, unknown>) },
        properties: { ...((current.properties || {}) as Record<string, unknown>), ...((next.properties || {}) as Record<string, unknown>) },
      } as T & { source?: unknown; target?: unknown }
      if ('source' in current) merged.source = current.source
      if ('target' in current) merged.target = current.target
      return merged as T
    })
  for (const next of nextEntities) {
    if (!resolveGraphEntityByCanonicalId(merged, next.id)) merged.push(next)
  }
  return merged
}

export function reconcileStoryboardWidgetDraftGraphDataWithBaseChanges(args: {
  previousBaseGraphData: GraphData
  currentDraftGraphData: GraphData
  nextBaseGraphData: GraphData
}): GraphData {
  const mergedGraph = mergeChangedRecord(
    args.previousBaseGraphData as unknown as Record<string, unknown>,
    args.currentDraftGraphData as unknown as Record<string, unknown>,
    args.nextBaseGraphData as unknown as Record<string, unknown>,
  ) as unknown as GraphData
  mergedGraph.metadata = mergeChangedRecord(
    (args.previousBaseGraphData.metadata || {}) as Record<string, unknown>,
    (args.currentDraftGraphData.metadata || {}) as Record<string, unknown>,
    (args.nextBaseGraphData.metadata || {}) as Record<string, unknown>,
  ) as GraphData['metadata']
  mergedGraph.nodes = mergeChangedGraphEntities(
    args.previousBaseGraphData.nodes || [],
    args.currentDraftGraphData.nodes || [],
    args.nextBaseGraphData.nodes || [],
  )
  mergedGraph.edges = mergeChangedGraphEntities(
    args.previousBaseGraphData.edges || [],
    args.currentDraftGraphData.edges || [],
    args.nextBaseGraphData.edges || [],
  )
  return bumpStoryboardWidgetDraftGraphDataRevision(mergedGraph, {
    revisionFloor: Math.max(
      readGraphDataRevision(args.currentDraftGraphData),
      readGraphDataRevision(args.nextBaseGraphData),
    ),
  })
}

export function bumpStoryboardWidgetDraftGraphDataRevision(graphData: GraphData, opts?: { revisionFloor?: number | null }): GraphData {
  const metadata = (graphData.metadata || {}) as Record<string, unknown>
  const current = Math.max(
    readGraphDataRevision(graphData),
    typeof opts?.revisionFloor === 'number' && Number.isFinite(opts.revisionFloor)
      ? Math.max(0, Math.floor(opts.revisionFloor))
      : 0,
  )
  return { ...graphData, metadata: { ...metadata, graphDataRevision: current + 1 } }
}

export function resolveStoryboardWidgetDraftGraphDataForBaseReset(args: {
  activeDocumentKey: string
  previousDocumentKey: string | null
  currentDraftGraphData: GraphData | null
  nextBaseGraphData: GraphData | null
  previousBaseGraphData?: GraphData | null
  forceBaseReset?: boolean
}): GraphData | null {
  const base = args.nextBaseGraphData
  if (!base) return null
  if (args.forceBaseReset) return base
  const current = args.currentDraftGraphData
  if (!current || current === base) return base
  if (args.previousDocumentKey !== args.activeDocumentKey) return base
  const hasPendingAppendAuthority = readPendingAppendEntityIds(current, STORYBOARD_WIDGET_PENDING_APPEND_NODE_IDS).length > 0
    || readPendingAppendEntityIds(current, STORYBOARD_WIDGET_PENDING_APPEND_EDGE_IDS).length > 0
  if (hasPendingAppendAuthority) {
    if (hasStoryboardWidgetDraftGraphDataCanonicalSuperset(base, current)) return base
    return mergeStoryboardWidgetDraftGraphDataWithLiveAdditions({
      liveGraphData: base,
      draftGraphData: current,
    })
  }
  if (hasSameDraftGraphBaseSignature(current, base)) return current
  const previousBase = args.previousBaseGraphData || null
  if (
    previousBase
    && readGraphDataRevision(base) >= readGraphDataRevision(previousBase)
    && buildStoryboardWidgetDraftGraphBaseSignature(previousBase) !== buildStoryboardWidgetDraftGraphBaseSignature(base)
  ) {
    return reconcileStoryboardWidgetDraftGraphDataWithBaseChanges({
      previousBaseGraphData: previousBase,
      currentDraftGraphData: current,
      nextBaseGraphData: base,
    })
  }
  const currentRevision = readGraphDataRevision(current)
  const baseRevision = readGraphDataRevision(base)
  const previousBaseRevision = readGraphDataRevision(previousBase)
  const baseStillMatchesPrevious = previousBase
    && buildStoryboardWidgetDraftGraphBaseSignature(previousBase) === buildStoryboardWidgetDraftGraphBaseSignature(base)
  if (
    baseStillMatchesPrevious
    && currentRevision >= previousBaseRevision
    && hasDraftNodeIdentitySuperset(current, base)
  ) return current
  if (currentRevision < baseRevision) return base
  return hasCompatibleDraftNodeIdentity(current, base) ? current : base
}
