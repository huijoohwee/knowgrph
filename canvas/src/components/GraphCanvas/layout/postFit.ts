import type { GraphNode } from '@/lib/graph/types'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export const postFitNodesToViewport = (args: {
  nodes: GraphNode[]
  width: number
  height: number
  paddingPx: number
  minScale?: number
  maxScale?: number
}): boolean => {
  const { nodes, width, height, paddingPx } = args
  if (!nodes.length) return false

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let sumX = 0
  let sumY = 0
  let count = 0

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const x = isFiniteNumber(n.x) ? n.x : null
    const y = isFiniteNumber(n.y) ? n.y : null
    if (x == null || y == null) continue
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    sumX += x
    sumY += y
    count += 1
  }
  if (count < 2 || minX === Infinity) return false

  const spanX = Math.max(1e-6, maxX - minX)
  const spanY = Math.max(1e-6, maxY - minY)
  const targetW = Math.max(1, width - paddingPx * 2)
  const targetH = Math.max(1, height - paddingPx * 2)
  const scale = Math.min(targetW / spanX, targetH / spanY)

  const minScale = typeof args.minScale === 'number' && Number.isFinite(args.minScale) ? args.minScale : 0.02
  const maxScale = typeof args.maxScale === 'number' && Number.isFinite(args.maxScale) ? args.maxScale : 1.8

  const desired =
    scale < 0.94 ? Math.max(minScale, Math.min(0.98, scale)) : scale > 1.25 ? Math.min(maxScale, Math.max(1.02, scale)) : 1
  if (desired === 1) return false

  const cx = sumX / count
  const cy = sumY / count
  const tx = width / 2
  const ty = height / 2

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
