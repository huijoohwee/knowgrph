import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphNode } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { getNodeRenderRadius } from '@/lib/graph/schema'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import { DEFAULT_GROUP_PADDING } from '@/lib/graph/layoutDefaults'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { prepareGroupHierarchy } from '@/components/GraphCanvas/layout/groupHierarchyPrep'

type SizedItem = {
  id: string
  kind: 'node' | 'group'
  w: number
  h: number
  xIndex: number | null
  yIndex: number | null
  zIndex: number | null
}

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

const computeExistingSpreadQuality = (nodes: GraphNode[]): boolean => {
  if (nodes.length <= 1) return true
  let valid = 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    valid += 1
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (valid < 2 || minX === Infinity) return false
  const spanX = maxX - minX
  const spanY = maxY - minY
  if (valid >= 4 && spanX < 40 && spanY < 40) return false

  const cell = 36
  let inBuckets = 0
  let maxBucket = 0
  const buckets = new Map<string, number>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    const bx = Math.round(x / cell)
    const by = Math.round(y / cell)
    const key = `${bx}|${by}`
    const next = (buckets.get(key) || 0) + 1
    buckets.set(key, next)
    if (next > maxBucket) maxBucket = next
  }
  buckets.forEach(v => {
    if (v > 1) inBuckets += v
  })
  const dupRatio = inBuckets / Math.max(1, valid)
  if (maxBucket >= 4 || dupRatio >= 0.14) return false
  return spanX > 0.001 || spanY > 0.001
}

const setNodeCenter = (n: GraphNode, cx: number, cy: number) => {
  n.x = cx
  n.y = cy
  n.vx = 0
  n.vy = 0
  n.fx = null
  n.fy = null
}

const placeItemsInGrid = (args: {
  items: SizedItem[]
  startX: number
  startY: number
  cellW: number
  cellH: number
  zYSpacing: number
}): Map<string, { cx: number; cy: number }> => {
  const out = new Map<string, { cx: number; cy: number }>()
  const items = args.items
  if (items.length === 0) return out

  const indexed = items.filter(it => it.xIndex != null && it.yIndex != null)
  const useIndex = indexed.length >= Math.max(4, Math.floor(items.length * 0.3))

  if (useIndex) {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < indexed.length; i += 1) {
      const it = indexed[i]!
      minX = Math.min(minX, it.xIndex as number)
      maxX = Math.max(maxX, it.xIndex as number)
      minY = Math.min(minY, it.yIndex as number)
      maxY = Math.max(maxY, it.yIndex as number)
    }
    const cols = Math.max(1, Math.floor(maxX - minX + 1))
    const rows = Math.max(1, Math.floor(maxY - minY + 1))
    const taken = new Set<string>()

    const sortedIndexed = [...indexed].sort((a, b) => {
      if ((a.yIndex as number) !== (b.yIndex as number)) return (a.yIndex as number) - (b.yIndex as number)
      if ((a.xIndex as number) !== (b.xIndex as number)) return (a.xIndex as number) - (b.xIndex as number)
      return a.id.localeCompare(b.id)
    })

    for (let i = 0; i < sortedIndexed.length; i += 1) {
      const it = sortedIndexed[i]!
      const col = Math.floor((it.xIndex as number) - minX)
      const row = Math.floor((it.yIndex as number) - minY)
      const sx = args.startX + col * args.cellW
      const sy = args.startY + row * args.cellH
      const zOff = it.zIndex != null ? (it.zIndex as number) * args.zYSpacing : 0
      out.set(it.id, { cx: sx + args.cellW / 2, cy: sy + args.cellH / 2 + zOff })
      taken.add(`${col}|${row}`)
    }

    const rest = items.filter(it => !out.has(it.id)).sort((a, b) => a.id.localeCompare(b.id))
    let idx = 0
    for (let row = 0; row < rows && idx < rest.length; row += 1) {
      for (let col = 0; col < cols && idx < rest.length; col += 1) {
        const key = `${col}|${row}`
        if (taken.has(key)) continue
        const it = rest[idx++]!
        const sx = args.startX + col * args.cellW
        const sy = args.startY + row * args.cellH
        const zOff = it.zIndex != null ? (it.zIndex as number) * args.zYSpacing : 0
        out.set(it.id, { cx: sx + args.cellW / 2, cy: sy + args.cellH / 2 + zOff })
      }
    }
    while (idx < rest.length) {
      const it = rest[idx++]!
      const col = idx % cols
      const row = rows + Math.floor(idx / cols)
      const sx = args.startX + col * args.cellW
      const sy = args.startY + row * args.cellH
      const zOff = it.zIndex != null ? (it.zIndex as number) * args.zYSpacing : 0
      out.set(it.id, { cx: sx + args.cellW / 2, cy: sy + args.cellH / 2 + zOff })
    }
    return out
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)))
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id))
  for (let i = 0; i < sorted.length; i += 1) {
    const it = sorted[i]!
    const col = i % cols
    const row = Math.floor(i / cols)
    const sx = args.startX + col * args.cellW
    const sy = args.startY + row * args.cellH
    const zOff = it.zIndex != null ? (it.zIndex as number) * args.zYSpacing : 0
    out.set(it.id, { cx: sx + args.cellW / 2, cy: sy + args.cellH / 2 + zOff })
  }
  return out
}

export const applyGroupGeometrySeedLayout = (args: {
  nodes: GraphNode[]
  groups: GraphGroup[]
  width: number
  height: number
  schema: GraphSchema
}): void => {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  if (nodes.length < 2) return
  if (nodes.length > 2600) return

  if (computeExistingSpreadQuality(nodes)) return

  const groups = Array.isArray(args.groups) ? args.groups : []
  if (groups.length === 0) return

  const nodeLookup = getCachedGraphLookup({
    cacheScope: 'graph-canvas-group-geometry-seed-nodes',
    graphData: { type: 'application/json', nodes, edges: [] },
    graphSemanticKey: buildScopedGraphSemanticKey('graph-canvas-group-geometry-seed-nodes', {
      graphData: { type: 'application/json', nodes, edges: [] },
      graphSemanticKey: nodes.map(node => `${String(node?.id || '').trim()}:${String(node?.type || '').trim()}`).join('\n'),
    }),
  })
  const nodeById = nodeLookup?.nodeById || new Map<string, GraphNode>()
  const {
    groupById,
    childrenByGroupId,
    memberSetByGroupId,
    directMembersByGroupId,
    topLevelGroupIds,
  } = prepareGroupHierarchy({
    groups,
    isValidMemberNodeId: nodeId => nodeById.has(nodeId),
  })

  const groupPad =
    typeof args.schema.layout?.groups?.padding === 'number' && Number.isFinite(args.schema.layout.groups.padding)
      ? Math.max(0, args.schema.layout.groups.padding)
      : DEFAULT_GROUP_PADDING
  const internalGap = Math.max(24, Math.floor(groupPad * 0.8))
  const zYSpacing = 28

  type GroupLayout = { w: number; h: number; nodeCentersById: Map<string, { cx: number; cy: number }>; groupCentersById: Map<string, { cx: number; cy: number }> }
  const layoutCache = new Map<string, GroupLayout>()

  const buildGroupLayout = (groupId: string): GroupLayout => {
    const cached = layoutCache.get(groupId)
    if (cached) return cached
    const g = groupById.get(groupId)
    if (!g) {
      const empty: GroupLayout = { w: 1, h: 1, nodeCentersById: new Map(), groupCentersById: new Map() }
      layoutCache.set(groupId, empty)
      return empty
    }

    const childGroupIds = childrenByGroupId.get(groupId) || []
    const directNodeIds = directMembersByGroupId.get(groupId) || []

    const childLayouts: Array<{ id: string; layout: GroupLayout }> = []
    for (let i = 0; i < childGroupIds.length; i += 1) {
      const cid = childGroupIds[i]!
      childLayouts.push({ id: cid, layout: buildGroupLayout(cid) })
    }

    const items: SizedItem[] = []
    for (let i = 0; i < childLayouts.length; i += 1) {
      const row = childLayouts[i]!
      const cg = groupById.get(row.id)
      const xIndex = cg ? (typeof cg.xIndex === 'number' && Number.isFinite(cg.xIndex) ? cg.xIndex : null) : null
      const yIndex = cg ? (typeof cg.yIndex === 'number' && Number.isFinite(cg.yIndex) ? cg.yIndex : null) : null
      const zIndex = cg ? (typeof cg.zIndex === 'number' && Number.isFinite(cg.zIndex) ? cg.zIndex : null) : null
      items.push({ id: row.id, kind: 'group', w: row.layout.w, h: row.layout.h, xIndex, yIndex, zIndex })
    }
    for (let i = 0; i < directNodeIds.length; i += 1) {
      const nid = directNodeIds[i]!
      const n = nodeById.get(nid)
      if (!n) continue
      const sz = estimateNodeSizePx(n, args.schema)
      const props = (n.properties || {}) as Record<string, unknown>
      const xIndex = readIndex(props['visual:xIndex'])
      const yIndex = readIndex(props['visual:yIndex'])
      const zIndex = readIndex(props['visual:zIndex'] ?? props['visual:depth'] ?? props['visual:layer'])
      items.push({ id: nid, kind: 'node', w: sz.w, h: sz.h, xIndex, yIndex, zIndex })
    }

    let maxW = 0
    let maxH = 0
    for (let i = 0; i < items.length; i += 1) {
      if (items[i]!.w > maxW) maxW = items[i]!.w
      if (items[i]!.h > maxH) maxH = items[i]!.h
    }
    const cellW = Math.max(120, Math.floor(maxW + internalGap))
    const cellH = Math.max(90, Math.floor(maxH + internalGap))
    const positions = placeItemsInGrid({ items, startX: groupPad, startY: groupPad, cellW, cellH, zYSpacing })

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    positions.forEach((p, id) => {
      const it = items.find(x => x.id === id)
      if (!it) return
      const x0 = p.cx - it.w / 2
      const x1 = p.cx + it.w / 2
      const y0 = p.cy - it.h / 2
      const y1 = p.cy + it.h / 2
      minX = Math.min(minX, x0)
      maxX = Math.max(maxX, x1)
      minY = Math.min(minY, y0)
      maxY = Math.max(maxY, y1)
    })
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      minX = groupPad
      minY = groupPad
      maxX = groupPad + 1
      maxY = groupPad + 1
    }
    const w = Math.max(1, Math.ceil(maxX - minX + groupPad))
    const h = Math.max(1, Math.ceil(maxY - minY + groupPad))

    const nodeCentersById = new Map<string, { cx: number; cy: number }>()
    const groupCentersById = new Map<string, { cx: number; cy: number }>()

    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]!
      const p = positions.get(it.id)
      if (!p) continue
      if (it.kind === 'node') {
        nodeCentersById.set(it.id, { cx: p.cx - minX, cy: p.cy - minY })
      } else {
        groupCentersById.set(it.id, { cx: p.cx - minX, cy: p.cy - minY })
      }
    }

    const result: GroupLayout = { w, h, nodeCentersById, groupCentersById }
    layoutCache.set(groupId, result)
    return result
  }

  if (topLevelGroupIds.length === 0) return

  const assignedNodes = new Set<string>()
  for (let i = 0; i < topLevelGroupIds.length; i += 1) {
    const s = memberSetByGroupId.get(topLevelGroupIds[i]!)
    if (!s) continue
    s.forEach(id => assignedNodes.add(id))
  }
  const ungroupedNodeIds = Array.from(nodeById.keys())
    .filter(id => !assignedNodes.has(id))
    .sort((a, b) => a.localeCompare(b))

  const topItems: SizedItem[] = []
  const topLayouts = new Map<string, GroupLayout>()
  for (let i = 0; i < topLevelGroupIds.length; i += 1) {
    const gid = topLevelGroupIds[i]!
    const layout = buildGroupLayout(gid)
    topLayouts.set(gid, layout)
    const g = groupById.get(gid)!
    const xIndex = typeof g.xIndex === 'number' && Number.isFinite(g.xIndex) ? g.xIndex : null
    const yIndex = typeof g.yIndex === 'number' && Number.isFinite(g.yIndex) ? g.yIndex : null
    const zIndex = typeof g.zIndex === 'number' && Number.isFinite(g.zIndex) ? g.zIndex : null
    topItems.push({ id: gid, kind: 'group', w: layout.w, h: layout.h, xIndex, yIndex, zIndex })
  }
  for (let i = 0; i < ungroupedNodeIds.length; i += 1) {
    const nid = ungroupedNodeIds[i]!
    const n = nodeById.get(nid)!
    const sz = estimateNodeSizePx(n, args.schema)
    const props = (n.properties || {}) as Record<string, unknown>
    const xIndex = readIndex(props['visual:xIndex'])
    const yIndex = readIndex(props['visual:yIndex'])
    const zIndex = readIndex(props['visual:zIndex'] ?? props['visual:depth'] ?? props['visual:layer'])
    topItems.push({ id: nid, kind: 'node', w: sz.w, h: sz.h, xIndex, yIndex, zIndex })
  }

  let maxW = 0
  let maxH = 0
  for (let i = 0; i < topItems.length; i += 1) {
    if (topItems[i]!.w > maxW) maxW = topItems[i]!.w
    if (topItems[i]!.h > maxH) maxH = topItems[i]!.h
  }
  const cellW = Math.max(180, Math.floor(maxW + groupPad * 2))
  const cellH = Math.max(140, Math.floor(maxH + groupPad * 2))
  const frameW = Math.max(1, args.width)
  const frameH = Math.max(1, args.height)
  const cols = Math.max(1, Math.ceil(Math.sqrt(topItems.length)))
  const rows = Math.max(1, Math.ceil(topItems.length / cols))
  const startX = frameW / 2 - ((cols - 1) * cellW) / 2
  const startY = frameH / 2 - ((rows - 1) * cellH) / 2
  const topPos = placeItemsInGrid({ items: topItems, startX, startY, cellW, cellH, zYSpacing })

  const applyGroupRec = (groupId: string, origin: { cx: number; cy: number }) => {
    const layout = topLayouts.get(groupId) || buildGroupLayout(groupId)

    layout.nodeCentersById.forEach((p, nodeId) => {
      const n = nodeById.get(nodeId)
      if (!n) return
      setNodeCenter(n, origin.cx - layout.w / 2 + p.cx, origin.cy - layout.h / 2 + p.cy)
    })

    layout.groupCentersById.forEach((p, childGroupId) => {
      const childOrigin = {
        cx: origin.cx - layout.w / 2 + p.cx,
        cy: origin.cy - layout.h / 2 + p.cy,
      }
      applyGroupRec(childGroupId, childOrigin)
    })
  }

  for (let i = 0; i < topItems.length; i += 1) {
    const it = topItems[i]!
    const p = topPos.get(it.id)
    if (!p) continue
    if (it.kind === 'node') {
      const n = nodeById.get(it.id)
      if (!n) continue
      setNodeCenter(n, p.cx, p.cy)
      continue
    }
    applyGroupRec(it.id, p)
  }
}
