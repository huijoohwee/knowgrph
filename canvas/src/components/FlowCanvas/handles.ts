import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  buildSchemaFieldPortKey,
  readSchemaFieldSpecs,
} from '@/lib/graph/flowPorts'

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
  nodes: ReadonlyArray<{ id: unknown; properties?: unknown }>
  edges: ReadonlyArray<{ id: unknown; source: unknown; target: unknown; properties?: unknown }>
}): Record<string, FlowNodeHandles> {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const edges = Array.isArray(args.edges) ? args.edges : []

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
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i] as unknown as { id?: unknown; properties?: unknown }
    const id = String(n?.id ?? '').trim()
    if (!id) continue
    const fields = readSchemaFieldSpecs({ properties: (n as { properties?: unknown }).properties as never }).map(f => f.id).filter(Boolean)
    if (fields.length) schemaFieldsByNodeId.set(id, fields)
  }

  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const edgeId = String(e?.id ?? '').trim()
    const source = String(e?.source ?? '').trim()
    const target = String(e?.target ?? '').trim()
    if (!edgeId || !source || !target) continue

    const props = (e as unknown as { properties?: unknown }).properties
    const sourcePortKey = (() => {
      if (props && typeof props === 'object' && !Array.isArray(props)) {
        const raw = (props as Record<string, unknown>)[FLOW_EDGE_SOURCE_PORT_KEY]
        if (typeof raw === 'string' && raw.trim()) return raw.trim()
      }
      const first = schemaFieldsByNodeId.get(source)?.[0] || null
      if (first) return buildSchemaFieldPortKey(first)
      return edgeId
    })()
    const targetPortKey = (() => {
      if (props && typeof props === 'object' && !Array.isArray(props)) {
        const raw = (props as Record<string, unknown>)[FLOW_EDGE_TARGET_PORT_KEY]
        if (typeof raw === 'string' && raw.trim()) return raw.trim()
      }
      const first = schemaFieldsByNodeId.get(target)?.[0] || null
      if (first) return buildSchemaFieldPortKey(first)
      return edgeId
    })()

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

    if (!schemaHandles) {
      out[nodeId] = { in: toHandles('in', incoming), out: toHandles('out', outgoing) }
      continue
    }

    const dyn = { in: toHandles('in', incoming), out: toHandles('out', outgoing) }
    const merge = (base: FlowPortHandle[], extra: FlowPortHandle[]): FlowPortHandle[] => {
      const seen = new Set<string>(base.map(h => h.id))
      const merged = base.slice()
      for (let k = 0; k < extra.length; k += 1) {
        const h = extra[k]
        if (seen.has(h.id)) continue
        merged.push(h)
      }
      return merged
    }
    out[nodeId] = { in: merge(schemaHandles.in, dyn.in), out: merge(schemaHandles.out, dyn.out) }
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
