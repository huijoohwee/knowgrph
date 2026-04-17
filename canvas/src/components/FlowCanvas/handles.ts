import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  buildSchemaFieldPortKey,
  readSchemaFieldSpecs,
} from '@/lib/graph/flowPorts'
import { readEdgeEndpointId } from '@/lib/graph/edgeEndpoints'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { resolveNodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'

export type FlowHandleDir = 'in' | 'out'

export type FlowHandleId = `${FlowHandleDir}:${string}`

export type FlowPortHandle = {
  id: FlowHandleId
  topPct: number
}

export type FlowNodeHandles = {
  in: FlowPortHandle[]
  out: FlowPortHandle[]
}

export function parseFlowHandleKey(handleId: FlowHandleId): string {
  const raw = String(handleId || '')
  const idx = raw.indexOf(':')
  if (idx < 0) return ''
  return raw.slice(idx + 1)
}

export const FLOW_HANDLE_DEFAULT_EDGE_ID = '__flow_default_handle__' as const

export function buildFlowHandleId(args: { dir: FlowHandleDir; edgeId: string }): FlowHandleId {
  const edgeId = String(args.edgeId || '').trim()
  const dir = args.dir === 'in' ? 'in' : 'out'
  return `${dir}:${edgeId || 'edge'}` as FlowHandleId
}

export function ensureFlowHandlesHaveDefaults(handles: FlowNodeHandles): FlowNodeHandles {
  const hasIn = Array.isArray(handles.in) && handles.in.length > 0
  const hasOut = Array.isArray(handles.out) && handles.out.length > 0
  if (hasIn && hasOut) return handles

  const nextIn = hasIn ? handles.in : [{ id: buildFlowHandleId({ dir: 'in', edgeId: FLOW_HANDLE_DEFAULT_EDGE_ID }), topPct: 50 }]
  const nextOut = hasOut ? handles.out : [{ id: buildFlowHandleId({ dir: 'out', edgeId: FLOW_HANDLE_DEFAULT_EDGE_ID }), topPct: 50 }]
  return { in: nextIn, out: nextOut }
}

export function computeFlowHandlesByNode(args: {
  nodes: ReadonlyArray<{ id: unknown; type?: unknown; properties?: unknown }>
  edges: ReadonlyArray<{ id: unknown; source: unknown; target: unknown; properties?: unknown }>
  nodeQuickEditorRegistry?: ReadonlyArray<NodeQuickEditorRegistryEntry> | null
}): Record<string, FlowNodeHandles> {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const edges = Array.isArray(args.edges) ? args.edges : []
  const registry = Array.isArray(args.nodeQuickEditorRegistry) ? args.nodeQuickEditorRegistry : []

  const nodeIds: string[] = []
  const nodeIdSet = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id ?? '').trim()
    if (!id) continue
    if (nodeIdSet.has(id)) continue
    nodeIdSet.add(id)
    nodeIds.push(id)
  }

  const incomingByNode = new Map<string, Array<{ handleKey: string; otherId: string }>>()
  const outgoingByNode = new Map<string, Array<{ handleKey: string; otherId: string }>>()

  const schemaFieldsByNodeId = new Map<string, string[]>()
  const registryPortsByNodeId = new Map<string, Array<{ dir: FlowHandleDir; portKey: string }>>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i] as unknown as { id?: unknown; type?: unknown; properties?: unknown }
    const id = String(n?.id ?? '').trim()
    if (!id) continue
    const fields = readSchemaFieldSpecs({ properties: (n as { properties?: unknown }).properties as never }).map(f => f.id).filter(Boolean)
    if (fields.length) schemaFieldsByNodeId.set(id, fields)

    const entry = resolveNodeQuickEditorRegistryEntry({
      node: { type: String(n?.type ?? ''), properties: (n as { properties?: unknown }).properties as never },
      registry,
    })
    const ports = entry?.ports || []
    if (ports.length > 0) {
      const list: Array<{ dir: FlowHandleDir; portKey: string }> = []
      const seen = new Set<string>()
      for (let j = 0; j < ports.length; j += 1) {
        const p = ports[j]
        if ((p as { isHidden?: boolean }).isHidden === true) continue
        const portKey = String(p?.portKey || '').trim()
        if (!portKey) continue
        const dir: FlowHandleDir = p.direction === 'input' ? 'in' : 'out'
        const uniq = `${dir}:${portKey}`
        if (seen.has(uniq)) continue
        seen.add(uniq)
        list.push({ dir, portKey })
      }
      if (list.length > 0) registryPortsByNodeId.set(id, list)
    }
  }

  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const edgeId = String(e?.id ?? '').trim()
    const source = readEdgeEndpointId((e as { source?: unknown })?.source)
    const target = readEdgeEndpointId((e as { target?: unknown })?.target)
    if (!edgeId || !source || !target) continue

    const props = (e as unknown as { properties?: unknown }).properties
    const sourcePortKey = (() => {
      if (props && typeof props === 'object' && !Array.isArray(props)) {
        const raw = (props as Record<string, unknown>)[FLOW_EDGE_SOURCE_PORT_KEY]
        if (typeof raw === 'string' && raw.trim()) return raw.trim()
      }
      return ''
    })()
    const targetPortKey = (() => {
      if (props && typeof props === 'object' && !Array.isArray(props)) {
        const raw = (props as Record<string, unknown>)[FLOW_EDGE_TARGET_PORT_KEY]
        if (typeof raw === 'string' && raw.trim()) return raw.trim()
      }
      return ''
    })()
    if (!sourcePortKey || !targetPortKey) continue

    if (nodeIdSet.has(target)) {
      const list = incomingByNode.get(target) || []
      list.push({ handleKey: targetPortKey, otherId: source })
      incomingByNode.set(target, list)
    }
    if (nodeIdSet.has(source)) {
      const list = outgoingByNode.get(source) || []
      list.push({ handleKey: sourcePortKey, otherId: target })
      outgoingByNode.set(source, list)
    }
  }

  const toHandles = (dir: 'in' | 'out', list: Array<{ handleKey: string }>): FlowPortHandle[] => {
    const n = list.length
    if (n <= 0) return []
    const out: FlowPortHandle[] = []
    for (let i = 0; i < n; i += 1) {
      const pct = ((i + 1) / (n + 1)) * 100
      out.push({ id: buildFlowHandleId({ dir, edgeId: list[i].handleKey }), topPct: pct })
    }
    return out
  }

  const out: Record<string, FlowNodeHandles> = {}
  for (let i = 0; i < nodeIds.length; i += 1) {
    const nodeId = nodeIds[i]
    const incoming = incomingByNode.get(nodeId) || []
    const outgoing = outgoingByNode.get(nodeId) || []
    incoming.sort((a, b) => (a.otherId === b.otherId ? a.handleKey.localeCompare(b.handleKey) : a.otherId.localeCompare(b.otherId)))
    outgoing.sort((a, b) => (a.otherId === b.otherId ? a.handleKey.localeCompare(b.handleKey) : a.otherId.localeCompare(b.otherId)))

    const schemaFields = schemaFieldsByNodeId.get(nodeId) || []
    const schemaHandles = (() => {
      const n = schemaFields.length
      if (n <= 0) return null
      const sin: FlowPortHandle[] = []
      const sout: FlowPortHandle[] = []
      for (let j = 0; j < n; j += 1) {
        const pct = ((j + 1) / (n + 1)) * 100
        const key = buildSchemaFieldPortKey(schemaFields[j])
        sin.push({ id: buildFlowHandleId({ dir: 'in', edgeId: key }), topPct: pct })
        sout.push({ id: buildFlowHandleId({ dir: 'out', edgeId: key }), topPct: pct })
      }
      return { in: sin, out: sout } satisfies FlowNodeHandles
    })()

    const registryHandles = (() => {
      const ports = registryPortsByNodeId.get(nodeId) || []
      if (ports.length === 0) return null
      const sin: FlowPortHandle[] = []
      const sout: FlowPortHandle[] = []
      const ins = ports.filter(p => p.dir === 'in')
      const outs = ports.filter(p => p.dir === 'out')
      for (let j = 0; j < ins.length; j += 1) {
        const pct = ((j + 1) / (ins.length + 1)) * 100
        sin.push({ id: buildFlowHandleId({ dir: 'in', edgeId: ins[j].portKey }), topPct: pct })
      }
      for (let j = 0; j < outs.length; j += 1) {
        const pct = ((j + 1) / (outs.length + 1)) * 100
        sout.push({ id: buildFlowHandleId({ dir: 'out', edgeId: outs[j].portKey }), topPct: pct })
      }
      return { in: sin, out: sout } satisfies FlowNodeHandles
    })()

    const dyn = { in: toHandles('in', incoming), out: toHandles('out', outgoing) }

    const mergeByPrecedence = (lists: Array<FlowPortHandle[] | null | undefined>): FlowPortHandle[] => {
      const seen = new Set<string>()
      const merged: FlowPortHandle[] = []
      for (let l = 0; l < lists.length; l += 1) {
        const list = lists[l]
        if (!list || list.length === 0) continue
        for (let k = 0; k < list.length; k += 1) {
          const h = list[k]
          if (!h) continue
          if (seen.has(h.id)) continue
          seen.add(h.id)
          merged.push(h)
        }
      }
      return merged
    }

    out[nodeId] = {
      in: mergeByPrecedence([registryHandles?.in, schemaHandles?.in, dyn.in]),
      out: mergeByPrecedence([registryHandles?.out, schemaHandles?.out, dyn.out]),
    }
  }
  return out
}

export function computeFlowNodeHandles(args: {
  nodeId: string
  edges: ReadonlyArray<{ id: string; source: string; target: string }>
}): FlowNodeHandles {
  const nodeId = String(args.nodeId || '').trim()
  if (!nodeId) return { in: [], out: [] }
  const byNode = computeFlowHandlesByNode({ nodes: [{ id: nodeId }], edges: args.edges })
  return byNode[nodeId] || { in: [], out: [] }
}
