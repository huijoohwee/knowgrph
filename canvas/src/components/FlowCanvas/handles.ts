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

export function buildFlowHandleId(args: { dir: FlowHandleDir; edgeId: string }): FlowHandleId {
  const edgeId = String(args.edgeId || '').trim()
  const dir = args.dir === 'in' ? 'in' : 'out'
  return `${dir}:${edgeId || 'edge'}` as FlowHandleId
}

export function computeFlowHandlesByNode(args: {
  nodes: ReadonlyArray<{ id: unknown }>
  edges: ReadonlyArray<{ id: unknown; source: unknown; target: unknown }>
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

  const incomingByNode = new Map<string, Array<{ edgeId: string; otherId: string }>>()
  const outgoingByNode = new Map<string, Array<{ edgeId: string; otherId: string }>>()

  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const edgeId = String(e?.id ?? '').trim()
    const source = String(e?.source ?? '').trim()
    const target = String(e?.target ?? '').trim()
    if (!edgeId || !source || !target) continue

    if (nodeIdSet.has(target)) {
      const list = incomingByNode.get(target) || []
      list.push({ edgeId, otherId: source })
      incomingByNode.set(target, list)
    }
    if (nodeIdSet.has(source)) {
      const list = outgoingByNode.get(source) || []
      list.push({ edgeId, otherId: target })
      outgoingByNode.set(source, list)
    }
  }

  const toHandles = (dir: 'in' | 'out', list: Array<{ edgeId: string }>): FlowPortHandle[] => {
    const n = list.length
    if (n <= 0) return []
    const out: FlowPortHandle[] = []
    for (let i = 0; i < n; i += 1) {
      const pct = ((i + 1) / (n + 1)) * 100
      out.push({ id: buildFlowHandleId({ dir, edgeId: list[i].edgeId }), topPct: pct })
    }
    return out
  }

  const out: Record<string, FlowNodeHandles> = {}
  for (let i = 0; i < nodeIds.length; i += 1) {
    const nodeId = nodeIds[i]
    const incoming = incomingByNode.get(nodeId) || []
    const outgoing = outgoingByNode.get(nodeId) || []
    incoming.sort((a, b) => (a.otherId === b.otherId ? a.edgeId.localeCompare(b.edgeId) : a.otherId.localeCompare(b.otherId)))
    outgoing.sort((a, b) => (a.otherId === b.otherId ? a.edgeId.localeCompare(b.edgeId) : a.otherId.localeCompare(b.otherId)))
    out[nodeId] = { in: toHandles('in', incoming), out: toHandles('out', outgoing) }
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
