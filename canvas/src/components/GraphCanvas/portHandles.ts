import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeSelectionConfig } from '@/lib/graph/schema'
import { UI_THEME_COLORS } from '@/lib/ui/theme-tokens'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'

export type PortHandleSide = 'left' | 'right' | 'top' | 'bottom'

export type PortHandleDatum = {
  nodeId: string
  side: PortHandleSide
}

export type PortHandlesConfig = {
  enabled: boolean
  placement: 'cardinal'
  size: number
  offset: number
  strokeWidth: number
  stroke: string
  fill: string
}

export function getPortHandlesConfig(schema: GraphSchema): PortHandlesConfig {
  const raw = schema.behavior?.portHandles || {}
  const enabled = Boolean(raw.enabled)
  const placement = raw.placement === 'cardinal' ? 'cardinal' : 'cardinal'
  const size = typeof raw.size === 'number' && Number.isFinite(raw.size) && raw.size > 0 ? raw.size : 4
  const offset = typeof raw.offset === 'number' && Number.isFinite(raw.offset) && raw.offset >= 0 ? raw.offset : 2
  const strokeWidth =
    typeof raw.strokeWidth === 'number' && Number.isFinite(raw.strokeWidth) && raw.strokeWidth >= 0
      ? raw.strokeWidth
      : 1.5
  const stroke = getThreeSelectionConfig(schema).selectedEdgeColor
  const fill = UI_THEME_COLORS.light.bg
  return { enabled, placement, size, offset, strokeWidth, stroke, fill }
}

export function listPortHandlesForNodes(nodes: GraphNode[]): PortHandleDatum[] {
  const out: PortHandleDatum[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const nodeId = String(nodes[i].id)
    if (!nodeId) continue
    out.push({ nodeId, side: 'left' })
    out.push({ nodeId, side: 'right' })
    out.push({ nodeId, side: 'top' })
    out.push({ nodeId, side: 'bottom' })
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

  const side = getNearestCardinalSide(from, to)
  return getPortHandlePosition({ datum: { nodeId: String(from.id), side }, node: from, schema, cfg })
}
