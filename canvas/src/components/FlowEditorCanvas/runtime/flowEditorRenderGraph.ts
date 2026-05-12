import { canonicalNodeIdSetHas, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'
import { buildOverlayTopologyLayoutSignature } from '@/lib/flowEditor/overlayTopologyLayoutSignature'
import { FLOW_HANDLE_DEFAULT_EDGE_ID } from '@/components/FlowCanvas/handles'
import { pickDefaultFlowPortKey, readFlowEdgePortKey } from '@/lib/graph/flowPorts'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { hashRecordSignature32, hashScopedStringArraySignature, hashSignatureParts } from '@/lib/hash/signature'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  deriveFrontmatterFlowOverlayNodeIds,
  resolveDefaultFlowWidgetPinnedInCanvas,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import {
  buildFlowRunAllNodeSequence,
  type FlowRunAllPhaseId,
} from '@/lib/flowEditor/runAllSequenceSsot'

export type FlowEditorRenderGraphLookup = {
  graph: GraphData | null
  revision: number
  graphSemanticKey: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  nodeById: ReadonlyMap<string, GraphNode>
  incidentEdgesByNodeId: ReadonlyMap<string, GraphEdge[]> | null
  eligibleNodeIds: ReadonlySet<string>
  graphMetaKind: string | null
  nodeIdsByInnerId: ReadonlyMap<string, string[]>
}

export type FlowEditorOverlayEdgeGraphLookup = {
  graphSemanticKey: string
  graphMetaKind: string | null
  nodes: Array<{ id: unknown; type?: unknown; properties?: unknown }>
  nodeIds: Set<string>
  defaultPortKeyByNodeId: Map<string, { in: string; out: string }>
  edgeCurveById: Map<string, { bend: number; orbitShift: number; orbital: boolean; phase: -1 | 1 } | null>
  rawEdgeById: Map<string, GraphEdge>
  edges: Array<{
    id: string
    source: string
    target: string
    sourcePortKey: string
    targetPortKey: string
    edgeType: string
  }>
}

const FLOW_EDITOR_OVERLAY_EDGE_GRAPH_CACHE_LIMIT = 24
const flowEditorOverlayEdgeGraphCache = new Map<string, FlowEditorOverlayEdgeGraphLookup>()
const FLOW_EDITOR_WIDGET_PLACEMENT_CONTEXT_CACHE_LIMIT = 24
const flowEditorWidgetPlacementContextCache = new Map<string, FlowEditorWidgetPlacementContext>()
const FLOW_EDITOR_WORKFLOW_RUN_PLAN_CACHE_LIMIT = 24
const flowEditorWorkflowRunPlanCache = new Map<string, FlowEditorWorkflowRunPlan>()
const FLOW_EDITOR_WORKFLOW_NODE_RESOLUTION_CONTEXT_CACHE_LIMIT = 24
const flowEditorWorkflowNodeResolutionContextCache = new Map<string, FlowEditorWorkflowNodeResolutionContext>()

export type FlowEditorWidgetPlacementContext = {
  graphSemanticKey: string
  graphMetaKind: string | null
  isFrontmatterFlow: boolean
  defaultPinnedInCanvas: boolean
  frontmatterOverlayNodeIds: string[]
  effectiveOpenWidgetNodeIds: string[]
}

export type FlowEditorWorkflowRunPlan = {
  graphSemanticKey: string
  eligibleNodeIds: ReadonlySet<string>
  orderedNodeIds: string[]
  phaseCounts: Record<FlowRunAllPhaseId, number>
}

export type FlowEditorWorkflowNodeResolutionContext = {
  graphSemanticKey: string
  draftGraph: GraphData | null
  renderGraph: GraphData | null
  baseGraph: GraphData | null
  storeGraph: GraphData | null
  draftNodes: GraphNode[]
  renderNodes: GraphNode[]
  baseNodes: GraphNode[]
  storeNodes: GraphNode[]
  draftNodeById: ReadonlyMap<string, GraphNode>
  renderNodeById: ReadonlyMap<string, GraphNode>
  baseNodeById: ReadonlyMap<string, GraphNode>
  storeNodeById: ReadonlyMap<string, GraphNode>
}

export type FlowEditorWorkflowResolvedRunTarget = {
  graphForRun: GraphData
  node: GraphNode
  resolvedNodeId: string
  writableNodeId: string
}

export function readCanonicalFlowEditorOverlayIdentity(rawId: unknown): string {
  const id = String(rawId || '').trim()
  if (!id) return ''
  return splitComposedNodeId(id).inner || id
}

function readPropString(props: unknown, key: string): string {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return ''
  const raw = (props as Record<string, unknown>)[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

function buildOverlayNodeHandleSignature(
  nodes: ReadonlyArray<{ id?: unknown; type?: unknown; properties?: unknown }>,
): string {
  if (!Array.isArray(nodes) || nodes.length === 0) return ''
  const parts = nodes
    .map(node => {
      const id = readCanonicalFlowEditorOverlayIdentity(node?.id)
      if (!id) return ''
      return [
        id,
        String(node?.type || '').trim(),
        hashRecordSignature32(node?.properties || {}, { maxEntries: 24, maxDepth: 3 }),
      ].join(':')
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
  return hashSignatureParts(['overlay-node-handle-signature', ...parts])
}

function readCachedFlowEditorOverlayEdgeGraph(
  cacheKey: string,
): FlowEditorOverlayEdgeGraphLookup | null {
  const cached = flowEditorOverlayEdgeGraphCache.get(cacheKey) || null
  if (!cached) return null
  flowEditorOverlayEdgeGraphCache.delete(cacheKey)
  flowEditorOverlayEdgeGraphCache.set(cacheKey, cached)
  return cached
}

function writeCachedFlowEditorOverlayEdgeGraph(
  cacheKey: string,
  value: FlowEditorOverlayEdgeGraphLookup,
): FlowEditorOverlayEdgeGraphLookup {
  flowEditorOverlayEdgeGraphCache.delete(cacheKey)
  flowEditorOverlayEdgeGraphCache.set(cacheKey, value)
  while (flowEditorOverlayEdgeGraphCache.size > FLOW_EDITOR_OVERLAY_EDGE_GRAPH_CACHE_LIMIT) {
    const oldestKey = flowEditorOverlayEdgeGraphCache.keys().next().value
    if (!oldestKey) break
    flowEditorOverlayEdgeGraphCache.delete(oldestKey)
  }
  return value
}

function readCachedFlowEditorWidgetPlacementContext(
  cacheKey: string,
): FlowEditorWidgetPlacementContext | null {
  const cached = flowEditorWidgetPlacementContextCache.get(cacheKey) || null
  if (!cached) return null
  flowEditorWidgetPlacementContextCache.delete(cacheKey)
  flowEditorWidgetPlacementContextCache.set(cacheKey, cached)
  return cached
}

function writeCachedFlowEditorWidgetPlacementContext(
  cacheKey: string,
  value: FlowEditorWidgetPlacementContext,
): FlowEditorWidgetPlacementContext {
  flowEditorWidgetPlacementContextCache.delete(cacheKey)
  flowEditorWidgetPlacementContextCache.set(cacheKey, value)
  while (flowEditorWidgetPlacementContextCache.size > FLOW_EDITOR_WIDGET_PLACEMENT_CONTEXT_CACHE_LIMIT) {
    const oldestKey = flowEditorWidgetPlacementContextCache.keys().next().value
    if (!oldestKey) break
    flowEditorWidgetPlacementContextCache.delete(oldestKey)
  }
  return value
}

function readCachedFlowEditorWorkflowRunPlan(
  cacheKey: string,
): FlowEditorWorkflowRunPlan | null {
  const cached = flowEditorWorkflowRunPlanCache.get(cacheKey) || null
  if (!cached) return null
  flowEditorWorkflowRunPlanCache.delete(cacheKey)
  flowEditorWorkflowRunPlanCache.set(cacheKey, cached)
  return cached
}

function writeCachedFlowEditorWorkflowRunPlan(
  cacheKey: string,
  value: FlowEditorWorkflowRunPlan,
): FlowEditorWorkflowRunPlan {
  flowEditorWorkflowRunPlanCache.delete(cacheKey)
  flowEditorWorkflowRunPlanCache.set(cacheKey, value)
  while (flowEditorWorkflowRunPlanCache.size > FLOW_EDITOR_WORKFLOW_RUN_PLAN_CACHE_LIMIT) {
    const oldestKey = flowEditorWorkflowRunPlanCache.keys().next().value
    if (!oldestKey) break
    flowEditorWorkflowRunPlanCache.delete(oldestKey)
  }
  return value
}

function readCachedFlowEditorWorkflowNodeResolutionContext(
  cacheKey: string,
): FlowEditorWorkflowNodeResolutionContext | null {
  const cached = flowEditorWorkflowNodeResolutionContextCache.get(cacheKey) || null
  if (!cached) return null
  flowEditorWorkflowNodeResolutionContextCache.delete(cacheKey)
  flowEditorWorkflowNodeResolutionContextCache.set(cacheKey, cached)
  return cached
}

function writeCachedFlowEditorWorkflowNodeResolutionContext(
  cacheKey: string,
  value: FlowEditorWorkflowNodeResolutionContext,
): FlowEditorWorkflowNodeResolutionContext {
  flowEditorWorkflowNodeResolutionContextCache.delete(cacheKey)
  flowEditorWorkflowNodeResolutionContextCache.set(cacheKey, value)
  while (flowEditorWorkflowNodeResolutionContextCache.size > FLOW_EDITOR_WORKFLOW_NODE_RESOLUTION_CONTEXT_CACHE_LIMIT) {
    const oldestKey = flowEditorWorkflowNodeResolutionContextCache.keys().next().value
    if (!oldestKey) break
    flowEditorWorkflowNodeResolutionContextCache.delete(oldestKey)
  }
  return value
}

export function getCachedFlowEditorRenderGraph(args: {
  scope: string
  graphData: GraphData | null
  graphRevision: number
  preferCurrentGraphDataRefs?: boolean
}): FlowEditorRenderGraphLookup | null {
  const scope = String(args.scope || '').trim()
  if (!scope) return null
  const graph = args.graphData
  const graphRevision = Number.isFinite(args.graphRevision) ? Math.max(0, Math.floor(args.graphRevision)) : 0
  const graphSemanticKey = buildScopedGraphSemanticKey(scope, {
    graphData: graph,
    graphRevision,
  })
  const baseLookup = getCachedGraphLookup({
    cacheScope: scope,
    graphData: graph,
    graphRevision,
    graphSemanticKey,
    preferCurrentGraphDataRefs: args.preferCurrentGraphDataRefs,
  })
  if (!baseLookup) return null

  const nodes = baseLookup.nodes
  const nodeIdsByInnerId = new Map<string, string[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (!id) continue
    const innerId = splitComposedNodeId(id).inner
    if (!innerId) continue
    const existing = nodeIdsByInnerId.get(innerId)
    if (existing) existing.push(id)
    else nodeIdsByInnerId.set(innerId, [id])
  }

  return {
    graph,
    revision: graphRevision,
    graphSemanticKey,
    nodes,
    edges: baseLookup.edges,
    nodeById: baseLookup.nodeById,
    incidentEdgesByNodeId: baseLookup.incidentEdgesByNodeId,
    eligibleNodeIds: buildFlowWidgetEligibleNodeIdSet(nodes),
    graphMetaKind: String(((graph?.metadata || {}) as Record<string, unknown>).kind || '').trim() || null,
    nodeIdsByInnerId,
  }
}

export function getCachedFlowEditorOverlayEdgeGraph(args: {
  graphData: GraphData | null
  graphRevision: number
  overlayNodeIds: ReadonlyArray<string>
  preferCurrentGraphDataRefs?: boolean
}): FlowEditorOverlayEdgeGraphLookup | null {
  const graph = args.graphData
  const graphRevision = Number.isFinite(args.graphRevision) ? Math.max(0, Math.floor(args.graphRevision)) : 0
  const baseGraph = getCachedFlowEditorRenderGraph({
    scope: 'flow-editor-overlay-edges-base-graph',
    graphData: graph,
    graphRevision,
    preferCurrentGraphDataRefs: args.preferCurrentGraphDataRefs,
  })
  if (!baseGraph) return null

  const overlayNodeIds = Array.from(new Set((args.overlayNodeIds || []).map(id => String(id || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
  const overlayNodeIdsKey = hashScopedStringArraySignature('overlay-node-ids', overlayNodeIds, {
    unique: true,
    sort: true,
  })
  const nodeHandleSemanticKey = buildOverlayNodeHandleSignature(baseGraph.nodes)
  const graphSemanticKey = graphRevision > 0
    ? `rev:${graphRevision}`
    : hashSignatureParts([
        'overlay-graph-semantic',
        buildOverlayTopologyLayoutSignature(graph),
        nodeHandleSemanticKey,
      ])
  const cacheKey = hashSignatureParts([
    'overlay-graph-lookup',
    graphSemanticKey,
    overlayNodeIdsKey,
  ])
  const cached = readCachedFlowEditorOverlayEdgeGraph(cacheKey)
  if (cached) return cached

  const overlayNodeIdSet = new Set<string>(overlayNodeIds)
  const nodes: Array<{ id: unknown; type?: unknown; properties?: unknown }> = []
  const nodeIds = new Set<string>()
  for (let i = 0; i < baseGraph.nodes.length; i += 1) {
    const node = baseGraph.nodes[i]
    const id = readCanonicalFlowEditorOverlayIdentity(node?.id)
    if (!id || !canonicalNodeIdSetHas(overlayNodeIdSet, node?.id)) continue
    nodeIds.add(id)
    nodes.push({ id, type: node?.type, properties: node?.properties })
  }

  const defaultPortKeyByNodeId = new Map<string, { in: string; out: string }>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (!id) continue
    const outPortKey = pickDefaultFlowPortKey({ properties: node?.properties as never }, 'out') || FLOW_HANDLE_DEFAULT_EDGE_ID
    const inPortKey = pickDefaultFlowPortKey({ properties: node?.properties as never }, 'in') || FLOW_HANDLE_DEFAULT_EDGE_ID
    defaultPortKeyByNodeId.set(id, { out: outPortKey, in: inPortKey })
  }

  const rawEdgeById = new Map<string, GraphEdge>()
  const edgeCurveById = new Map<string, { bend: number; orbitShift: number; orbital: boolean; phase: -1 | 1 } | null>()
  const edges: Array<{
    id: string
    source: string
    target: string
    sourcePortKey: string
    targetPortKey: string
    edgeType: string
  }> = []
  for (let i = 0; i < baseGraph.edges.length; i += 1) {
    const edge = baseGraph.edges[i]
    const id = String(edge?.id || '').trim()
    const { src: sourceRaw, tgt: targetRaw } = readGraphEdgeEndpoints(edge)
    const source = readCanonicalFlowEditorOverlayIdentity(sourceRaw)
    const target = readCanonicalFlowEditorOverlayIdentity(targetRaw)
    if (!id || !source || !target) continue
    if (!canonicalNodeIdSetHas(overlayNodeIdSet, sourceRaw) || !canonicalNodeIdSetHas(overlayNodeIdSet, targetRaw)) continue
    const props = edge?.properties
    const edgeWithProps = { properties: props as GraphEdge['properties'] } as Pick<GraphEdge, 'properties'>
    const sourcePortKey =
      readFlowEdgePortKey(edgeWithProps, 'source')
      || defaultPortKeyByNodeId.get(source)?.out
      || FLOW_HANDLE_DEFAULT_EDGE_ID
    const targetPortKey =
      readFlowEdgePortKey(edgeWithProps, 'target')
      || defaultPortKeyByNodeId.get(target)?.in
      || FLOW_HANDLE_DEFAULT_EDGE_ID
    rawEdgeById.set(id, edge)
    const propsRecord = props && typeof props === 'object' && !Array.isArray(props) ? (props as Record<string, unknown>) : null
    const isFrontmatterFlow = String(baseGraph.graphMetaKind || '').trim() === 'frontmatter-flow'
    const heroRowCurve = isFrontmatterFlow && source !== target && /^db-shot-S0[1-5]-/.test(source) && /^db-shot-S0[1-5]-/.test(target)
      ? {
          bend: propsRecord?.['visual:curveBend'] == null ? 0.16 : Number(propsRecord['visual:curveBend']),
          orbitShift: propsRecord?.['visual:orbitShift'] == null ? 0.1 : Number(propsRecord['visual:orbitShift']),
          orbital: propsRecord?.['visual:curveInterpolator'] == null ? true : String(propsRecord['visual:curveInterpolator']).trim().toLowerCase() === 'orbital',
          phase: source.localeCompare(target) <= 0 ? 1 : -1,
        }
      : null
    edgeCurveById.set(id, heroRowCurve)
    edges.push({
      id,
      source,
      target,
      sourcePortKey,
      targetPortKey,
      edgeType: String(edge?.type || '').trim() || readPropString(props, 'flow:socketType'),
    })
  }

  return writeCachedFlowEditorOverlayEdgeGraph(cacheKey, {
    graphSemanticKey,
    graphMetaKind: baseGraph.graphMetaKind,
    nodes,
    nodeIds,
    defaultPortKeyByNodeId,
    edgeCurveById,
    rawEdgeById,
    edges,
  })
}

export function getCachedFlowEditorWidgetPlacementContext(args: {
  graphData: GraphData | null
  graphRevision: number
  openWidgetNodeIds?: ReadonlyArray<string>
  preferCurrentGraphDataRefs?: boolean
}): FlowEditorWidgetPlacementContext | null {
  const baseGraph = getCachedFlowEditorRenderGraph({
    scope: 'flow-editor-widget-placement-base-graph',
    graphData: args.graphData,
    graphRevision: args.graphRevision,
    preferCurrentGraphDataRefs: args.preferCurrentGraphDataRefs,
  })
  if (!baseGraph) return null

  const openWidgetNodeIds = Array.from(
    new Set((args.openWidgetNodeIds || []).map(id => String(id || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))
  const openWidgetNodeIdsKey = hashScopedStringArraySignature('flow-editor-open-widget-node-ids', openWidgetNodeIds, {
    unique: true,
    sort: true,
  })
  const cacheKey = hashSignatureParts([
    'flow-editor-widget-placement-context',
    baseGraph.graphSemanticKey,
    openWidgetNodeIdsKey,
  ])
  const cached = readCachedFlowEditorWidgetPlacementContext(cacheKey)
  if (cached) return cached

  const graphMetaKind = baseGraph.graphMetaKind
  const isFrontmatterFlow = graphMetaKind === 'frontmatter-flow'
  const defaultPinnedInCanvas = resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind })
  const frontmatterOverlayNodeIds = isFrontmatterFlow
    ? deriveFrontmatterFlowOverlayNodeIds(baseGraph.graph)
    : []
  const effectiveOpenWidgetNodeIds = isFrontmatterFlow
    ? frontmatterOverlayNodeIds
    : openWidgetNodeIds

  return writeCachedFlowEditorWidgetPlacementContext(cacheKey, {
    graphSemanticKey: baseGraph.graphSemanticKey,
    graphMetaKind,
    isFrontmatterFlow,
    defaultPinnedInCanvas,
    frontmatterOverlayNodeIds,
    effectiveOpenWidgetNodeIds,
  })
}

export function getCachedFlowEditorWorkflowRunPlan(args: {
  graphData: GraphData | null
  graphRevision: number
  preferCurrentGraphDataRefs?: boolean
}): FlowEditorWorkflowRunPlan | null {
  const baseGraph = getCachedFlowEditorRenderGraph({
    scope: 'flow-editor-workflow-actions-draft-graph',
    graphData: args.graphData,
    graphRevision: args.graphRevision,
    preferCurrentGraphDataRefs: args.preferCurrentGraphDataRefs,
  })
  if (!baseGraph || !baseGraph.graph) return null

  const cacheKey = hashSignatureParts([
    'flow-editor-workflow-run-plan',
    baseGraph.graphSemanticKey,
  ])
  const cached = readCachedFlowEditorWorkflowRunPlan(cacheKey)
  if (cached) return cached

  const eligibleNodeIds = baseGraph.eligibleNodeIds
  const ordered = buildFlowRunAllNodeSequence({
    graphData: baseGraph.graph,
    eligibleNodeIds,
  })
  return writeCachedFlowEditorWorkflowRunPlan(cacheKey, {
    graphSemanticKey: baseGraph.graphSemanticKey,
    eligibleNodeIds,
    orderedNodeIds: ordered.orderedNodeIds,
    phaseCounts: ordered.phaseCounts,
  })
}

export function getCachedFlowEditorWorkflowNodeResolutionContext(args: {
  draftGraph: GraphData | null
  draftGraphRevision: number
  renderGraph: GraphData | null
  renderGraphRevision: number
  baseGraph: GraphData | null
  baseGraphRevision: number
  storeGraph: GraphData | null
  storeGraphRevision: number
  preferCurrentGraphDataRefs?: boolean
}): FlowEditorWorkflowNodeResolutionContext {
  const draftLookup = getCachedFlowEditorRenderGraph({
    scope: 'flow-editor-workflow-node-resolution-draft-graph',
    graphData: args.draftGraph,
    graphRevision: args.draftGraphRevision,
    preferCurrentGraphDataRefs: args.preferCurrentGraphDataRefs,
  })
  const renderLookup = getCachedFlowEditorRenderGraph({
    scope: 'flow-editor-workflow-node-resolution-render-graph',
    graphData: args.renderGraph,
    graphRevision: args.renderGraphRevision,
    preferCurrentGraphDataRefs: args.preferCurrentGraphDataRefs,
  })
  const baseLookup = getCachedFlowEditorRenderGraph({
    scope: 'flow-editor-workflow-node-resolution-base-graph',
    graphData: args.baseGraph,
    graphRevision: args.baseGraphRevision,
    preferCurrentGraphDataRefs: args.preferCurrentGraphDataRefs,
  })
  const storeLookup = getCachedFlowEditorRenderGraph({
    scope: 'flow-editor-workflow-node-resolution-store-graph',
    graphData: args.storeGraph,
    graphRevision: args.storeGraphRevision,
    preferCurrentGraphDataRefs: args.preferCurrentGraphDataRefs,
  })
  const cacheKey = hashSignatureParts([
    'flow-editor-workflow-node-resolution-context',
    draftLookup?.graphSemanticKey || '',
    renderLookup?.graphSemanticKey || '',
    baseLookup?.graphSemanticKey || '',
    storeLookup?.graphSemanticKey || '',
  ])
  const cached = readCachedFlowEditorWorkflowNodeResolutionContext(cacheKey)
  if (cached) return cached
  return writeCachedFlowEditorWorkflowNodeResolutionContext(cacheKey, {
    graphSemanticKey: cacheKey,
    draftGraph: draftLookup?.graph || args.draftGraph || null,
    renderGraph: renderLookup?.graph || args.renderGraph || null,
    baseGraph: baseLookup?.graph || args.baseGraph || null,
    storeGraph: storeLookup?.graph || args.storeGraph || null,
    draftNodes: draftLookup?.nodes || [],
    renderNodes: renderLookup?.nodes || [],
    baseNodes: baseLookup?.nodes || [],
    storeNodes: storeLookup?.nodes || [],
    draftNodeById: draftLookup?.nodeById || new Map<string, GraphNode>(),
    renderNodeById: renderLookup?.nodeById || new Map<string, GraphNode>(),
    baseNodeById: baseLookup?.nodeById || new Map<string, GraphNode>(),
    storeNodeById: storeLookup?.nodeById || new Map<string, GraphNode>(),
  })
}

export function resolveFlowEditorWorkflowWritableNodeId(args: {
  context: FlowEditorWorkflowNodeResolutionContext
  requestedNodeId: string
  resolvedNodeId: string
}): string {
  const requested = splitComposedNodeId(args.requestedNodeId)
  const resolved = splitComposedNodeId(args.resolvedNodeId)
  const exactRequested = requested.full ? args.context.draftNodeById.get(requested.full) || null : null
  if (exactRequested) return String(exactRequested.id || '').trim()
  const exactResolved = resolved.full ? args.context.draftNodeById.get(resolved.full) || null : null
  if (exactResolved) return String(exactResolved.id || '').trim()
  const targetInners = new Set([requested.inner, resolved.inner].filter(Boolean))
  if (targetInners.size === 0) return String(args.resolvedNodeId || '').trim()
  const innerMatches = args.context.draftNodes.filter(node => targetInners.has(splitComposedNodeId(node?.id).inner))
  if (innerMatches.length === 1) return String(innerMatches[0]?.id || '').trim()
  return String(args.resolvedNodeId || '').trim()
}

export function resolveFlowEditorWorkflowRunTarget(args: {
  context: FlowEditorWorkflowNodeResolutionContext
  requestedNodeId: string
}): FlowEditorWorkflowResolvedRunTarget | null {
  const requestedNodeId = String(args.requestedNodeId || '').trim()
  if (!requestedNodeId) return null
  const resolved =
    (args.context.draftGraph && args.context.draftNodeById.get(requestedNodeId)
      ? { graph: args.context.draftGraph, node: args.context.draftNodeById.get(requestedNodeId)! }
      : null)
    || (args.context.renderGraph && args.context.renderNodeById.get(requestedNodeId)
      ? { graph: args.context.renderGraph, node: args.context.renderNodeById.get(requestedNodeId)! }
      : null)
    || (args.context.baseGraph && args.context.baseNodeById.get(requestedNodeId)
      ? { graph: args.context.baseGraph, node: args.context.baseNodeById.get(requestedNodeId)! }
      : null)
  if (!resolved) return null
  const resolvedNodeId = String(resolved.node.id || requestedNodeId).trim()
  const writableNodeId = resolveFlowEditorWorkflowWritableNodeId({
    context: args.context,
    requestedNodeId,
    resolvedNodeId,
  }) || resolvedNodeId
  return {
    graphForRun: resolved.graph,
    node: resolved.node,
    resolvedNodeId,
    writableNodeId,
  }
}

export function resolveFlowEditorWorkflowNodeByIdAcrossGraphs(args: {
  context: FlowEditorWorkflowNodeResolutionContext
  candidateNodeId: string
  graphForRun: GraphData | null
}): GraphNode | null {
  const candidateNodeId = String(args.candidateNodeId || '').trim()
  if (!candidateNodeId) return null
  const draftHit = args.context.draftNodeById.get(candidateNodeId) || null
  if (draftHit) return draftHit
  const renderHit = args.context.renderNodeById.get(candidateNodeId) || null
  if (renderHit) return renderHit
  const storeHit = args.context.storeNodeById.get(candidateNodeId) || null
  if (storeHit) return storeHit
  if (args.graphForRun && args.graphForRun === args.context.baseGraph) {
    return args.context.baseNodeById.get(candidateNodeId) || null
  }
  return null
}

export function listFlowEditorWorkflowNodesAcrossGraphs(args: {
  context: FlowEditorWorkflowNodeResolutionContext
  graphForRun: GraphData | null
}): GraphNode[] {
  const out: GraphNode[] = []
  for (let i = 0; i < args.context.draftNodes.length; i += 1) out.push(args.context.draftNodes[i]!)
  for (let i = 0; i < args.context.renderNodes.length; i += 1) out.push(args.context.renderNodes[i]!)
  if (args.graphForRun && args.graphForRun === args.context.baseGraph) {
    for (let i = 0; i < args.context.baseNodes.length; i += 1) out.push(args.context.baseNodes[i]!)
  }
  for (let i = 0; i < args.context.storeNodes.length; i += 1) out.push(args.context.storeNodes[i]!)
  return out
}
