import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeRenderRadius } from '@/lib/graph/schema'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'

const readIndex = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

const estimateNodeSizePx = (n: GraphNode, schema: GraphSchema): { w: number; h: number } => {
  const props = (n.properties || {}) as Record<string, unknown>
  const vw = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : 0
  const vh = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : 0
  if (vw > 0 && vh > 0) return { w: Math.max(20, vw), h: Math.max(20, vh) }
  if (getNodeRenderShape2d(n, schema) !== 'circle') {
    const { width, height } = getNodeRectDimensions2d(n, schema)
    return { w: Math.max(20, width), h: Math.max(20, height) }
  }
  const r = getNodeRenderRadius(n, schema) || 20
  const d = Math.max(20, r * 2)
  return { w: d, h: d }
}

export const applyIndexGridSeedLayout = (args: {
  nodes: GraphNode[]
  width: number
  height: number
  schema: GraphSchema
}): void => {
  const { nodes, width, height, schema } = args
  if (!Array.isArray(nodes) || nodes.length === 0) return

  let indexed = 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < nodes.length; i += 1) {
    const props = (nodes[i]?.properties || {}) as Record<string, unknown>
    const ix = readIndex(props['visual:xIndex'])
    const iy = readIndex(props['visual:yIndex'])
    if (ix == null || iy == null) continue
    indexed += 1
    if (ix < minX) minX = ix
    if (ix > maxX) maxX = ix
    if (iy < minY) minY = iy
    if (iy > maxY) maxY = iy
  }

  if (indexed < Math.max(6, Math.floor(nodes.length * 0.3))) return
  if (!(minX <= maxX && minY <= maxY)) return

  let valid = 0
  let posMinX = Infinity
  let posMaxX = -Infinity
  let posMinY = Infinity
  let posMaxY = -Infinity
  for (let i = 0; i < nodes.length; i += 1) {
    const x = nodes[i]?.x
    const y = nodes[i]?.y
    if (!(typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y))) continue
    valid += 1
    if (x < posMinX) posMinX = x
    if (x > posMaxX) posMaxX = x
    if (y < posMinY) posMinY = y
    if (y > posMaxY) posMaxY = y
  }

  const spreadX = valid > 0 ? posMaxX - posMinX : 0
  const spreadY = valid > 0 ? posMaxY - posMinY : 0
  const isClustered = spreadX < 40 && spreadY < 40
  const ratioValid = valid / Math.max(1, nodes.length)
  if (!isClustered && ratioValid >= 0.25) return

  let maxW = 0
  let maxH = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const { w, h } = estimateNodeSizePx(nodes[i]!, schema)
    if (w > maxW) maxW = w
    if (h > maxH) maxH = h
  }

  const cellW = Math.max(120, Math.floor(maxW + 80))
  const cellH = Math.max(90, Math.floor(maxH + 70))
  const cols = Math.max(1, Math.floor(maxX - minX + 1))
  const rows = Math.max(1, Math.floor(maxY - minY + 1))
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const startX = w / 2 - ((cols - 1) * cellW) / 2
  const startY = h / 2 - ((rows - 1) * cellH) / 2

  const byCell = new Map<string, GraphNode[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const props = (n.properties || {}) as Record<string, unknown>
    const ix = readIndex(props['visual:xIndex'])
    const iy = readIndex(props['visual:yIndex'])
    if (ix == null || iy == null) continue
    const key = `${ix}|${iy}`
    const arr = byCell.get(key) || []
    arr.push(n)
    byCell.set(key, arr)
  }

  const setNode = (n: GraphNode, x: number, y: number) => {
    n.x = x
    n.y = y
    n.vx = 0
    n.vy = 0
    n.fx = null
    n.fy = null
  }

  byCell.forEach((cellNodes, key) => {
    const [sx, sy] = key.split('|')
    const ix = Number(sx)
    const iy = Number(sy)
    if (!Number.isFinite(ix) || !Number.isFinite(iy)) return
    const cx = startX + (ix - minX) * cellW
    const cy = startY + (iy - minY) * cellH

    const sorted = [...cellNodes].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    if (sorted.length === 1) {
      setNode(sorted[0]!, cx, cy)
      return
    }

    const spacing = Math.max(18, Math.floor(Math.min(cellW, cellH) * 0.18))
    setNode(sorted[0]!, cx, cy)
    let placed = 1
    let ring = 0
    while (placed < sorted.length) {
      ring += 1
      const ringRadius = ring * spacing
      const slots = Math.max(6, Math.floor((2 * Math.PI * ringRadius) / spacing))
      for (let s = 0; s < slots && placed < sorted.length; s += 1) {
        const angle = (s / slots) * Math.PI * 2
        setNode(sorted[placed]!, cx + ringRadius * Math.cos(angle), cy + ringRadius * Math.sin(angle))
        placed += 1
      }
    }
  })
}

