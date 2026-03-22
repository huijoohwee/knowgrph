import { GraphNode } from '@/lib/graph/types'
import { GraphSchema, getNodeRenderRadius } from '@/lib/graph/schema'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import { pickBalancedGrid } from '@/components/GraphCanvas/layout/grid'
import type { GroupKeyOfNode } from '@/components/GraphCanvas/layout/grouping'
import { postFitNodesToViewport } from '@/components/GraphCanvas/layout/postFit'

export const applyClusterAwareHeuristicSeedLayout = (args: {
  nodes: GraphNode[]
  width: number
  height: number
  schema: GraphSchema
  groupKeyOf?: GroupKeyOfNode
}): void => {
  const { nodes, width, height, schema, groupKeyOf } = args
  if (!nodes.length) return

  let valid = 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (let i = 0; i < nodes.length; i += 1) {
    const x = nodes[i].x
    const y = nodes[i].y
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
      valid += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  const spreadX = valid > 0 ? maxX - minX : 0
  const spreadY = valid > 0 ? maxY - minY : 0
  const isClustered = spreadX < 40 && spreadY < 40

  const ratioValid = valid / Math.max(1, nodes.length)
  if (!isClustered && ratioValid >= 0.2) {
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    const cx = minX === Infinity ? w / 2 : (minX + maxX) / 2
    const cy = minY === Infinity ? h / 2 : (minY + maxY) / 2
    const dx = Math.abs(cx - w / 2)
    const dy = Math.abs(cy - h / 2)
    const offCenter = (dx > w * 0.28) || (dy > h * 0.28)
    const tooSmall = spreadX < w * 0.12 && spreadY < h * 0.12
    const tooLarge = spreadX > w * 1.8 || spreadY > h * 1.8
    if (!offCenter && !tooSmall && !tooLarge) return
  }

  const estimateRadius = (n: GraphNode): number => {
    const props = (n.properties || {}) as Record<string, unknown>
    const vw = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : 0
    const vh = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : 0
    const fromVisual = Math.max(vw, vh) > 0 ? Math.max(vw, vh) / 2 : 0
    const fromSchema = getNodeRenderRadius(n, schema) || 20
    if (fromVisual > 0) return Math.max(10, fromVisual)
    if (getNodeRenderShape2d(n, schema) !== 'circle') {
      const { width, height } = getNodeRectDimensions2d(n, schema)
      return Math.max(10, Math.max(width, height) / 2)
    }
    return Math.max(10, fromSchema)
  }

  const normalizeCommunityKey = (raw: unknown): string => {
    if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : ''
    if (typeof raw === 'string') return raw.trim()
    return ''
  }

  const clusters = new Map<string, GraphNode[]>()
  const unclustered: GraphNode[] = []

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const groupKey = groupKeyOf ? groupKeyOf(n) : null
    if (groupKey) {
      const key = `group:${groupKey}`
      const arr = clusters.get(key) || []
      arr.push(n)
      clusters.set(key, arr)
      continue
    }
    const props = (n.properties || {}) as Record<string, unknown>
    const community = normalizeCommunityKey(props['visual:community'])
    const key = community ? `community:${community}` : ''
    if (!key) {
      unclustered.push(n)
      continue
    }
    const arr = clusters.get(key) || []
    arr.push(n)
    clusters.set(key, arr)
  }

  const unclusteredByType = new Map<string, GraphNode[]>()
  for (let i = 0; i < unclustered.length; i += 1) {
    const n = unclustered[i]
    const key = String(n.type || 'unknown') || 'unknown'
    const arr = unclusteredByType.get(key) || []
    arr.push(n)
    unclusteredByType.set(key, arr)
  }

  const entries: Array<{ key: string; nodes: GraphNode[] }> = []
  clusters.forEach((value, key) => {
    entries.push({ key, nodes: value })
  })
  unclusteredByType.forEach((value, key) => {
    entries.push({ key: `type:${key}`, nodes: value })
  })
  entries.sort((a, b) => a.key.localeCompare(b.key))

  if (!entries.length) return

  let sumR = 0
  let countR = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    sumR += estimateRadius(n)
    countR += 1
  }
  const meanR = countR > 0 ? sumR / countR : 20
  const nodePadding = 16
  const nodeSpacing = Math.max(50, (meanR + nodePadding) * 2.2)

  const clusterRadius = (n: number): number => nodeSpacing * (0.5 + Math.sqrt(Math.max(1, n)))
  let maxClusterR = 0
  for (let i = 0; i < entries.length; i += 1) {
    const r = clusterRadius(entries[i].nodes.length)
    if (r > maxClusterR) maxClusterR = r
  }

  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const aspect = w / h
  const { cols, rows } = pickBalancedGrid({
    count: entries.length,
    aspect,
    minCols: entries.length >= 4 ? 2 : 1,
    minRows: entries.length >= 4 ? 2 : 1,
  })
  const cellW = maxClusterR * 2 + nodeSpacing
  const cellH = maxClusterR * 2 + nodeSpacing
  const startX = w / 2 - ((cols - 1) * cellW) / 2
  const startY = h / 2 - ((rows - 1) * cellH) / 2

  const placeCluster = (clusterNodes: GraphNode[], cx: number, cy: number) => {
    const sorted = [...clusterNodes].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    if (!sorted.length) return

    const setNode = (n: GraphNode, x: number, y: number) => {
      n.x = x
      n.y = y
      n.vx = 0
      n.vy = 0
      n.fx = null
      n.fy = null
    }

    setNode(sorted[0], cx, cy)
    if (sorted.length === 1) return

    let placed = 1
    let ring = 0
    while (placed < sorted.length) {
      ring += 1
      const ringRadius = ring * nodeSpacing * 0.75
      const slots = Math.max(6, Math.floor((2 * Math.PI * ringRadius) / nodeSpacing))
      for (let s = 0; s < slots && placed < sorted.length; s += 1) {
        const angle = (s / slots) * Math.PI * 2
        const x = cx + ringRadius * Math.cos(angle)
        const y = cy + ringRadius * Math.sin(angle)
        setNode(sorted[placed], x, y)
        placed += 1
      }
    }
  }

  for (let idx = 0; idx < entries.length; idx += 1) {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const cx = startX + col * cellW
    const cy = startY + row * cellH
    placeCluster(entries[idx].nodes, cx, cy)
  }

  if (schema.layout?.forces?.postFitForce === true) {
    postFitNodesToViewport({ nodes, width: w, height: h, paddingPx: Math.max(24, Math.floor(nodeSpacing * 0.6)) })
  }
}
