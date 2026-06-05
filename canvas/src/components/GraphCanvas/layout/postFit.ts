import type { GraphNode } from '@/lib/graph/types'
import { measureGraphElementCenterSet } from '@/lib/canvas/graph-elements/centroid'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export const postFitNodesToViewport = (args: {
  nodes: GraphNode[]
  width: number
  height: number
  paddingPx: number
  minScale?: number
  maxScale?: number
  viewportCenter?: { x: number; y: number }
}): boolean => {
  const { nodes, width, height, paddingPx } = args
  if (!nodes.length) return false

  const metrics = measureGraphElementCenterSet(nodes, { fallbackToFixedPosition: false })
  if (!metrics || metrics.count < 2) return false

  const spanX = Math.max(1e-6, metrics.maxX - metrics.minX)
  const spanY = Math.max(1e-6, metrics.maxY - metrics.minY)
  const targetW = Math.max(1, width - paddingPx * 2)
  const targetH = Math.max(1, height - paddingPx * 2)
  const scale = Math.min(targetW / spanX, targetH / spanY)

  const minScale = typeof args.minScale === 'number' && Number.isFinite(args.minScale) ? args.minScale : 0.02
  const maxScale = typeof args.maxScale === 'number' && Number.isFinite(args.maxScale) ? args.maxScale : 1.8

  const desired =
    scale < 0.94 ? Math.max(minScale, Math.min(0.98, scale)) : scale > 1.25 ? Math.min(maxScale, Math.max(1.02, scale)) : 1
  if (desired === 1) return false

  const cx = metrics.centroidX
  const cy = metrics.centroidY
  const tx = args.viewportCenter ? args.viewportCenter.x : width / 2
  const ty = args.viewportCenter ? args.viewportCenter.y : height / 2

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const x = isFiniteNumber(n.x) ? n.x : null
    const y = isFiniteNumber(n.y) ? n.y : null
    if (x == null || y == null) continue
    n.x = tx + (x - cx) * desired
    n.y = ty + (y - cy) * desired
    n.vx = 0
    n.vy = 0
  }

  return true
}
