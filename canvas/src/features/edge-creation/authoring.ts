import type { JSONValue } from '@/lib/graph/types'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

import { canAddEdge } from '@/features/schema/validation'
import { createUniqueId } from '@/lib/ids'
import { parseCanonicalNodeIds } from '@/lib/graph/canonicalNodeIds'
import {
  FLOW_EDGE_DISPLAY_LABEL_KEY,
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  buildFlowEdgeDisplayLabelFromPorts,
  listTypedFlowPortKeys,
  pickDefaultFlowPortKey,
  readFlowEdgePortKey,
} from '@/lib/graph/flowPorts'
import { resolveFlowSocketTypesForEdge } from '@/lib/graph/flowSocketTypes'

export type EdgeEndpoint = {
  nodeId: string
  portKey: string | null
}

export type EdgeAuthoringMode = 'create' | 'update-source' | 'update-target'

export type EdgeAuthoringResult =
  | { kind: 'noop' }
  | { kind: 'blocked'; reason: 'self-loop' | 'schema' | 'invalid' }
  | { kind: 'blocked'; reason: 'socket'; outType: string | null; inType: string | null }
  | { kind: 'select-existing'; edgeId: string }
  | { kind: 'create'; edge: GraphEdge }
  | { kind: 'update'; edgeId: string; patch: Partial<GraphEdge> }

function toNodeId(v: unknown): string {
  return String(v || '').trim()
}

function readNodeById(data: GraphData, id: string): GraphNode | null {
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (toNodeId(n?.id) === id) return n
  }
  return null
}

function readEdgeById(data: GraphData, id: string): GraphEdge | null {
  const edges = Array.isArray(data.edges) ? data.edges : []
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    if (toNodeId(e?.id) === id) return e
  }
  return null
}

function pickPortKey(node: GraphNode | null, explicit: string | null | undefined, dir: 'in' | 'out'): string | null {
  const pk = typeof explicit === 'string' && explicit.trim() ? explicit.trim() : null
  return pk || pickDefaultFlowPortKey(node, dir) || null
}

function listPortCandidates(node: GraphNode | null, dir: 'in' | 'out', explicit: string | null | undefined): string[] {
  const pk = typeof explicit === 'string' && explicit.trim() ? explicit.trim() : null
  if (pk) return [pk]
  const typed = listTypedFlowPortKeys(node, dir)
  if (typed.length > 0) return typed
  const fallback = pickDefaultFlowPortKey(node, dir)
  return fallback ? [fallback] : [null as unknown as string].filter(Boolean)
}

function resolveEndpointPortKeys(args: {
  graphData: GraphData
  sourceNode: GraphNode | null
  targetNode: GraphNode | null
  sourceExplicit: string | null | undefined
  targetExplicit: string | null | undefined
}): { sourcePortKey: string | null; targetPortKey: string | null } {
  const sourceCandidates = listPortCandidates(args.sourceNode, 'out', args.sourceExplicit)
  const targetCandidates = listPortCandidates(args.targetNode, 'in', args.targetExplicit)
  const sourceFallback = pickPortKey(args.sourceNode, args.sourceExplicit, 'out')
  const targetFallback = pickPortKey(args.targetNode, args.targetExplicit, 'in')

  for (let sourceIndex = 0; sourceIndex < sourceCandidates.length; sourceIndex += 1) {
    const sourcePortKey = sourceCandidates[sourceIndex] || null
    for (let targetIndex = 0; targetIndex < targetCandidates.length; targetIndex += 1) {
      const targetPortKey = targetCandidates[targetIndex] || null
      const socketRes = resolveFlowSocketTypesForEdge({
        graphData: args.graphData,
        sourceNode: args.sourceNode,
        targetNode: args.targetNode,
        sourcePortKey,
        targetPortKey,
      })
      if (socketRes.ok) return { sourcePortKey, targetPortKey }
    }
  }

  return {
    sourcePortKey: sourceFallback,
    targetPortKey: targetFallback,
  }
}

function edgesMatchEndpoints(a: GraphEdge, b: { source: string; target: string; label?: string | null; sourcePortKey: string | null; targetPortKey: string | null }): boolean {
  if (toNodeId(a.source) !== b.source) return false
  if (toNodeId(a.target) !== b.target) return false
  if (String(a.label || '') !== String(b.label || '')) return false
  const sp = readFlowEdgePortKey(a, 'source')
  const tp = readFlowEdgePortKey(a, 'target')
  return String(sp || '') === String(b.sourcePortKey || '') && String(tp || '') === String(b.targetPortKey || '')
}

export function finalizeEdgeAuthoring(args: {
  mode: EdgeAuthoringMode
  data: GraphData
  schema: GraphSchema | null | undefined
  label: string
  selectedEdgeId: string | null
  from: EdgeEndpoint
  to: EdgeEndpoint
}): EdgeAuthoringResult {
  const fromId = toNodeId(args.from.nodeId)
  const toId = toNodeId(args.to.nodeId)
  if (!fromId || !toId) return { kind: 'noop' }

  const schema = args.schema
  if (schema?.behavior?.preventSelfLoopsGlobal && fromId === toId) {
    return { kind: 'blocked', reason: 'self-loop' }
  }

  const label = String(args.label || '').trim() || 'linksTo'
  const sourceNode = readNodeById(args.data, fromId)
  const targetNode = readNodeById(args.data, toId)
  const { sourcePortKey, targetPortKey } = resolveEndpointPortKeys({
    graphData: args.data,
    sourceNode,
    targetNode,
    sourceExplicit: args.from.portKey,
    targetExplicit: args.to.portKey,
  })

  if (args.mode === 'create') {
    const socketRes = resolveFlowSocketTypesForEdge({
      graphData: args.data,
      sourceNode,
      targetNode,
      sourcePortKey,
      targetPortKey,
    })
    if (!socketRes.ok) {
      return {
        kind: 'blocked',
        reason: 'socket',
        outType: socketRes.outType || null,
        inType: socketRes.inType || null,
      }
    }
    const edgeSocketType = String(socketRes.edgeType || '').trim()

    const edges = Array.isArray(args.data.edges) ? args.data.edges : []
    const dup = edges.find(e =>
      edgesMatchEndpoints(e, {
        source: fromId,
        target: toId,
        label,
        sourcePortKey,
        targetPortKey,
      }),
    )
    if (dup) return { kind: 'select-existing', edgeId: String(dup.id || '').trim() }

    const used = new Set<string>()
    for (const edge of edges) {
      for (const id of parseCanonicalNodeIds(edge.id)) used.add(id)
    }
    const edgeId = createUniqueId('e', used)
    const next: GraphEdge = {
      id: edgeId,
      source: fromId,
      target: toId,
      label,
      ...(edgeSocketType ? { type: edgeSocketType } : {}),
      properties: {
        ...(sourcePortKey ? { [FLOW_EDGE_SOURCE_PORT_KEY]: sourcePortKey } : {}),
        ...(targetPortKey ? { [FLOW_EDGE_TARGET_PORT_KEY]: targetPortKey } : {}),
        ...(edgeSocketType ? ({ 'flow:socketType': edgeSocketType } as unknown as Record<string, JSONValue>) : {}),
      },
    }

    const displayLabel = buildFlowEdgeDisplayLabelFromPorts({
      sourceNode,
      targetNode,
      sourcePortKey,
      targetPortKey,
    })
    if (displayLabel) {
      ;(next.properties as Record<string, unknown>)[FLOW_EDGE_DISPLAY_LABEL_KEY] = displayLabel
    }

    if (schema && !canAddEdge(schema, args.data, next)) {
      return { kind: 'blocked', reason: 'schema' }
    }
    return { kind: 'create', edge: next }
  }

  const edgeId = String(args.selectedEdgeId || '').trim()
  if (!edgeId) return { kind: 'blocked', reason: 'invalid' }
  const existing = readEdgeById(args.data, edgeId)
  if (!existing) return { kind: 'blocked', reason: 'invalid' }

  const next: GraphEdge = {
    ...existing,
    source: args.mode === 'update-source' ? toId : existing.source,
    target: args.mode === 'update-target' ? toId : existing.target,
    properties: {
      ...(existing.properties && typeof existing.properties === 'object' && !Array.isArray(existing.properties) ? (existing.properties as Record<string, unknown>) : {}),
      ...(args.mode === 'update-source' && sourcePortKey ? { [FLOW_EDGE_SOURCE_PORT_KEY]: sourcePortKey } : {}),
      ...(args.mode === 'update-target' && targetPortKey ? { [FLOW_EDGE_TARGET_PORT_KEY]: targetPortKey } : {}),
    } as never,
  }
  if (schema?.behavior?.preventSelfLoopsGlobal && toNodeId(next.source) === toNodeId(next.target)) {
    return { kind: 'blocked', reason: 'self-loop' }
  }
  if (schema && !canAddEdge(schema, args.data, next)) {
    return { kind: 'blocked', reason: 'schema' }
  }

  const patch: Partial<GraphEdge> =
    args.mode === 'update-source'
      ? { source: toId, properties: next.properties }
      : args.mode === 'update-target'
        ? { target: toId, properties: next.properties }
        : {}
  return { kind: 'update', edgeId, patch }
}
