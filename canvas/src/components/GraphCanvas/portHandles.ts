import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'
import { getPortHandlesConfig, computeDynamicNodePortHandlePx, readNodePortHandleVisualMetrics, shouldRenderNodePortHandleAsDot, type PortHandlesConfig } from '@/components/GraphCanvas/portHandlesConfig'

export { getPortHandlesConfig, computeDynamicNodePortHandlePx, readNodePortHandleVisualMetrics, shouldRenderNodePortHandleAsDot, type PortHandlesConfig } from '@/components/GraphCanvas/portHandlesConfig'

export type PortHandleSide = 'left' | 'right' | 'top' | 'bottom'

export type PortHandleDatum = {
  nodeId: string
  side: PortHandleSide
}

function readPortRole(node: GraphNode): 'input' | 'output' | 'process' | '' {
  const props = (node.properties || {}) as Record<string, unknown>
  const raw = typeof props['visual:portRole'] === 'string' ? (props['visual:portRole'] as string).trim() : ''
  if (raw === 'input' || raw === 'output' || raw === 'process') return raw
  return ''
}

function readPortAxis(node: GraphNode): { axis: 'x' | 'y'; forward: 1 | -1 } | null {
  const props = (node.properties || {}) as Record<string, unknown>
  const axis = props['visual:portAxis']
  const forward = props['visual:portForward']
  const a = axis === 'x' || axis === 'y' ? axis : null
  const f = forward === 1 || forward === -1 ? forward : null
  if (!a || !f) return null
  return { axis: a, forward: f }
}

export function listPortHandlesForNodes(nodes: GraphNode[], edges?: GraphEdge[]): PortHandleDatum[] {
  const out: PortHandleDatum[] = []
  
  const inDeg = new Map<string, number>()
  const outDeg = new Map<string, number>()
  
  if (edges) {
    for (let i = 0; i < edges.length; i++) {
        const e = edges[i]
        const s = String(typeof e.source === 'object' ? (e.source as {id: string}).id : e.source)
        const t = String(typeof e.target === 'object' ? (e.target as {id: string}).id : e.target)
        outDeg.set(s, (outDeg.get(s) || 0) + 1)
        inDeg.set(t, (inDeg.get(t) || 0) + 1)
    }
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const nodeId = String(node.id)
    if (!nodeId) continue

    const roleFromNode = readPortRole(node)
    const axisFromNode = readPortAxis(node)
    if (roleFromNode && axisFromNode) {
      if (roleFromNode === 'input') {
        if (axisFromNode.axis === 'x') {
          out.push({ nodeId, side: axisFromNode.forward > 0 ? 'left' : 'right' })
          out.push({ nodeId, side: 'top' })
        } else {
          out.push({ nodeId, side: 'left' })
          out.push({ nodeId, side: axisFromNode.forward > 0 ? 'top' : 'bottom' })
        }
        continue
      }
      if (roleFromNode === 'output') {
        if (axisFromNode.axis === 'x') {
          out.push({ nodeId, side: axisFromNode.forward > 0 ? 'right' : 'left' })
          out.push({ nodeId, side: 'bottom' })
        } else {
          out.push({ nodeId, side: 'right' })
          out.push({ nodeId, side: axisFromNode.forward > 0 ? 'bottom' : 'top' })
        }
        continue
      }
    }

    let allowLeft = true
    let allowRight = true
    let allowTop = true
    let allowBottom = true

    if (edges) {
      const iD = inDeg.get(nodeId) || 0
      const oD = outDeg.get(nodeId) || 0
      const isInput = iD === 0 && oD > 0
      const isOutput = oD === 0 && iD > 0

      if (isInput) {
        allowRight = false
        allowBottom = false
      } else if (isOutput) {
        allowLeft = false
        allowTop = false
      }
    }

    if (allowLeft) out.push({ nodeId, side: 'left' })
    if (allowRight) out.push({ nodeId, side: 'right' })
    if (allowTop) out.push({ nodeId, side: 'top' })
    if (allowBottom) out.push({ nodeId, side: 'bottom' })
  }
  return out
}

export function getNearestCardinalSide(from: GraphNode, to: GraphNode): PortHandleSide {
  const fx = typeof from.x === 'number' && Number.isFinite(from.x) ? from.x : 0
  const fy = typeof from.y === 'number' && Number.isFinite(from.y) ? from.y : 0
  const tx = typeof to.x === 'number' && Number.isFinite(to.x) ? to.x : 0
  const ty = typeof to.y === 'number' && Number.isFinite(to.y) ? to.y : 0
  const dx = tx - fx
  const dy = ty - fy
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

export function getPortHandlePosition(args: {
  datum: PortHandleDatum
  node: GraphNode
  schema: GraphSchema
  cfg: PortHandlesConfig
}): { x: number; y: number } {
  const { datum, node, schema, cfg } = args
  const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0
  const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0
  const { halfW, halfH } = getNodeHalfExtents2d(node, schema)
  const o = cfg.offset
  if (datum.side === 'left') return { x: x - halfW - o, y }
  if (datum.side === 'right') return { x: x + halfW + o, y }
  if (datum.side === 'top') return { x, y: y - halfH - o }
  return { x, y: y + halfH + o }
}

export function getEdgeEndpointFromPorts(args: {
  from: GraphNode
  to: GraphNode
  schema: GraphSchema
}): { x: number; y: number } {
  const { from, to, schema } = args
  const cfg = getPortHandlesConfig(schema)
  const role = readPortRole(from)
  const axis = readPortAxis(from)
  const side = (() => {
    if (!axis || !role) return getNearestCardinalSide(from, to)
    if (axis.axis === 'x') {
      if (role === 'input') return axis.forward > 0 ? 'left' : 'right'
      if (role === 'output') return axis.forward > 0 ? 'right' : 'left'
      return getNearestCardinalSide(from, to)
    }
    if (role === 'input') return axis.forward > 0 ? 'top' : 'bottom'
    if (role === 'output') return axis.forward > 0 ? 'bottom' : 'top'
    return getNearestCardinalSide(from, to)
  })()
  return getPortHandlePosition({ datum: { nodeId: String(from.id), side }, node: from, schema, cfg })
}
