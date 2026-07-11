import type { GraphData, GraphNode } from '@/lib/graph/types'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphSchema } from '@/lib/graph/schema'
import { createId } from '@/lib/id'

export type FloatingPropsPanelSelectionSource = 'canvas' | 'menu' | 'toolbar' | 'editor' | 'unknown'

export type FloatingPropsPanelGraphPoint = {
  x: number
  y: number
}

function readFinitePointNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function resolveFloatingPropsPanelNodePoint(
  point: FloatingPropsPanelGraphPoint | null | undefined,
): FloatingPropsPanelGraphPoint {
  return {
    x: readFinitePointNumber(point?.x, 0),
    y: readFinitePointNumber(point?.y, 0),
  }
}

export function buildFloatingPropsPanelAddedNode(args: {
  schema?: GraphSchema | null
  id?: string | null
  type: string
  label?: string | null
  point?: FloatingPropsPanelGraphPoint | null
  properties?: Record<string, unknown> | null
  fx?: number | null
  fy?: number | null
  vx?: number | null
  vy?: number | null
  pinToPoint?: boolean | null
}): GraphNode {
  const type = String(args.type || '').trim() || 'entity'
  const template = (args.schema?.templates?.node || {})[type] || {}
  const point = resolveFloatingPropsPanelNodePoint(args.point)
  const id = String(args.id || '').trim() || createId('n')
  const properties = {
    ...(template || {}),
    ...(args.properties || {}),
  }

  return {
    id,
    label: String((args.label ?? (template as { label?: unknown }).label) || 'Node'),
    type,
    x: point.x,
    y: point.y,
    fx: Number.isFinite(args.fx) ? Number(args.fx) : (args.pinToPoint === true ? point.x : undefined),
    fy: Number.isFinite(args.fy) ? Number(args.fy) : (args.pinToPoint === true ? point.y : undefined),
    vx: Number.isFinite(args.vx) ? Number(args.vx) : undefined,
    vy: Number.isFinite(args.vy) ? Number(args.vy) : undefined,
    properties: properties as GraphNode['properties'],
  }
}

export function commitFloatingPropsPanelAddedNode(args: {
  node: GraphNode
  addNode: (node: GraphNode) => void
  selectNode?: (nodeId: string | null) => void
  setSelectionSource?: (source: FloatingPropsPanelSelectionSource) => void
  selectionSource?: FloatingPropsPanelSelectionSource
  readGraphData?: () => GraphData | null
}): string {
  const nodeId = String(args.node.id || '').trim()
  if (!nodeId) return ''
  args.addNode(args.node)
  const graphData = args.readGraphData?.() || null
  const committedId = String(resolveGraphNodeByCanonicalId(graphData, nodeId)?.id || nodeId).trim()
  args.setSelectionSource?.(args.selectionSource || 'toolbar')
  args.selectNode?.(committedId || nodeId)
  return committedId || nodeId
}
