import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeRenderRadius } from '@/lib/graph/schema'

export type NodeRenderShape2d = 'circle' | 'rect' | 'diamond' | 'hex'

export function getNodeRenderShape2d(node: GraphNode, schema: GraphSchema): NodeRenderShape2d {
  const portHandlesEnabled = Boolean(schema.behavior?.portHandles?.enabled)
  if (String(node.type || '') === 'Image') return 'rect'
  const fromSchema = schema.nodeShapes?.[String(node.type || '')]
  if (fromSchema === 'rect') return 'rect'
  if (fromSchema === 'circle') return 'circle'
  if (fromSchema === 'diamond') return 'diamond'
  if (fromSchema === 'hex') return 'hex'
  if (fromSchema === 'image') return 'rect'
  const raw = (node.properties || {})['visual:shape']
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (v === 'rect') return 'rect'
  if (v === 'circle') return 'circle'
  if (v === 'diamond') return 'diamond'
  if (v === 'hex') return 'hex'
  const mode = schema.behavior?.nodeShapeMode
  if (mode === 'rect') return 'rect'
  if (mode === 'circle') return 'circle'
  if (mode === 'diamond') return 'diamond'
  if (mode === 'hex') return 'hex'
  return portHandlesEnabled ? 'rect' : 'circle'
}

export function getNodeRectDimensions2d(node: GraphNode, schema: GraphSchema): { width: number; height: number } {
  const props = (node.properties || {}) as Record<string, unknown>
  const visualW = props['visual:width']
  const visualH = props['visual:height']
  const w =
    typeof visualW === 'number' && Number.isFinite(visualW) && visualW > 0
      ? visualW
      : null
  const h =
    typeof visualH === 'number' && Number.isFinite(visualH) && visualH > 0
      ? visualH
      : null

  const fallback = (() => {
    const r = getNodeRenderRadius(node, schema)
    const rr = typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : 10
    const width = Math.min(400, Math.max(20, rr * 4))
    const height = Math.min(240, Math.max(20, rr * 2))
    return { width, height }
  })()

  return { width: w ?? fallback.width, height: h ?? fallback.height }
}

export function getNodeHalfExtents2d(node: GraphNode, schema: GraphSchema): { halfW: number; halfH: number } {
  const shape = getNodeRenderShape2d(node, schema)
  if (shape === 'circle') {
    const r = getNodeRenderRadius(node, schema)
    const rr = typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : 10
    return { halfW: rr, halfH: rr }
  }
  const { width, height } = getNodeRectDimensions2d(node, schema)
  return { halfW: width / 2, halfH: height / 2 }
}
