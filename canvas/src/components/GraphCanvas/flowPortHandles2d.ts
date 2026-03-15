import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

import { computeFlowHandlesByNode, ensureFlowHandlesHaveDefaults, parseFlowHandleKey, type FlowHandleDir, type FlowHandleId } from '@/components/FlowCanvas/handles'
import { shouldInjectDefaultFlowHandles } from '@/lib/graph/portHandlesBehavior'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'
import { getPortHandlesConfig } from '@/components/GraphCanvas/portHandlesConfig'

export type FlowPortHandleDatum2d = {
  nodeId: string
  dir: FlowHandleDir
  handleId: FlowHandleId
  portKey: string
  topPct: number
}

export function listFlowPortHandleDatums2d(args: {
  schema: GraphSchema
  nodes: ReadonlyArray<Pick<GraphNode, 'id' | 'type' | 'properties'>>
  edges: ReadonlyArray<Pick<GraphEdge, 'id' | 'source' | 'target' | 'properties'>>
}): FlowPortHandleDatum2d[] {
  const byNode = computeFlowHandlesByNode({ nodes: args.nodes, edges: args.edges })
  const out: FlowPortHandleDatum2d[] = []
  for (const [nodeId, handles] of Object.entries(byNode)) {
    const id = String(nodeId || '').trim()
    if (!id) continue
    const normalized = shouldInjectDefaultFlowHandles(args.schema) ? ensureFlowHandlesHaveDefaults(handles) : handles
    const ins = Array.isArray(normalized.in) ? normalized.in : []
    const outs = Array.isArray(normalized.out) ? normalized.out : []
    for (let i = 0; i < ins.length; i += 1) {
      const h = ins[i]
      if (!h?.id) continue
      out.push({ nodeId: id, dir: 'in', handleId: h.id, portKey: parseFlowHandleKey(h.id), topPct: h.topPct })
    }
    for (let i = 0; i < outs.length; i += 1) {
      const h = outs[i]
      if (!h?.id) continue
      out.push({ nodeId: id, dir: 'out', handleId: h.id, portKey: parseFlowHandleKey(h.id), topPct: h.topPct })
    }
  }
  return out
}

export function getFlowPortHandlePosition2d(args: {
  node: GraphNode
  schema: GraphSchema
  datum: FlowPortHandleDatum2d
}): { x: number; y: number } {
  const node = args.node
  const schema = args.schema
  const d = args.datum
  const cfg = getPortHandlesConfig(schema)
  const x0 = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0
  const y0 = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0
  const { halfW, halfH } = getNodeHalfExtents2d(node, schema)
  const clampedPct = Math.max(0, Math.min(100, Number.isFinite(d.topPct) ? d.topPct : 50))
  const y = y0 - halfH + (clampedPct / 100) * (2 * halfH)
  const sideX = d.dir === 'in' ? x0 - halfW - cfg.offset : x0 + halfW + cfg.offset
  return { x: sideX, y }
}
