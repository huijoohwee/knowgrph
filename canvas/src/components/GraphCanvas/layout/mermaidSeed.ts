import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { readMermaidAxisFromNodes } from '@/components/GraphCanvas/layout/mermaidDirection'
import { computeSeedGrid, getSeedGridCellBox } from '@/components/GraphCanvas/layout/seedGrid'
import { DEFAULT_FIT_PADDING, readFitPadding } from '@/lib/graph/layoutDefaults'
import { computeGraphElementCentroidShiftToViewportCenter } from '@/lib/canvas/graph-elements/centroid'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const hash01 = (id: string): number => {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

const computeRanks = (nodeIds: string[], edges: Array<{ src: string; tgt: string }>): Map<string, number> => {
  const inDeg = new Map<string, number>()
  const out = new Map<string, string[]>()
  for (let i = 0; i < nodeIds.length; i += 1) {
    const id = nodeIds[i]
    inDeg.set(id, 0)
    out.set(id, [])
  }
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    if (!inDeg.has(e.src) || !inDeg.has(e.tgt)) continue
    out.get(e.src)!.push(e.tgt)
    inDeg.set(e.tgt, (inDeg.get(e.tgt) || 0) + 1)
  }

  const q: string[] = []
  inDeg.forEach((d, id) => {
    if (d === 0) q.push(id)
  })
  q.sort((a, b) => a.localeCompare(b))

  const rank = new Map<string, number>()
  for (let i = 0; i < nodeIds.length; i += 1) rank.set(nodeIds[i], 0)

  let qi = 0
  const visited: string[] = []
  while (qi < q.length) {
    const id = q[qi++]!
    visited.push(id)
    const base = rank.get(id) || 0
    const next = out.get(id) || []
    for (let j = 0; j < next.length; j += 1) {
      const tgt = next[j]!
      const existing = rank.get(tgt) || 0
      if (base + 1 > existing) rank.set(tgt, base + 1)
      inDeg.set(tgt, (inDeg.get(tgt) || 0) - 1)
      if ((inDeg.get(tgt) || 0) === 0) q.push(tgt)
    }
  }

  if (visited.length !== nodeIds.length) {
    const remaining = nodeIds.filter(id => !visited.includes(id)).sort((a, b) => a.localeCompare(b))
    for (let i = 0; i < remaining.length; i += 1) {
      rank.set(remaining[i], 0)
    }
  }

  return rank
}

export const applyMermaidSeedLayout = (args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  schema: GraphSchema
}): void => {
  const { nodes, edges, width, height, schema } = args
  if (!nodes.length) return

  let valid = 0
  for (let i = 0; i < nodes.length; i += 1) {
    if (isFiniteNumber(nodes[i].x) && isFiniteNumber(nodes[i].y)) valid += 1
  }
  if (valid / Math.max(1, nodes.length) >= 0.2) return

  const mermaidNodes = nodes.filter(n => String(n.type || '') === 'MermaidNode')
  if (mermaidNodes.length < 4) return

  const { axis, forward } = readMermaidAxisFromNodes(nodes)
  const pad = Math.max(DEFAULT_FIT_PADDING, readFitPadding(schema))
  const frameW = Math.max(1, width)
  const frameH = Math.max(1, height)

  const idSet = new Set<string>(mermaidNodes.map(n => String(n.id)))
  const mermaidEdges = edges
    .filter(e => String(e.label || '') === 'pointsTo')
    .map(e => ({ src: String(e.source || ''), tgt: String(e.target || '') }))
    .filter(e => e.src && e.tgt && idSet.has(e.src) && idSet.has(e.tgt))

  const groupKeyOf = (n: GraphNode): string => {
    const p = (n.properties || {}) as Record<string, unknown>
    const top = typeof p['visual:topParentId'] === 'string' ? (p['visual:topParentId'] as string).trim() : ''
    if (top) return top
    const parent = typeof p['visual:parentId'] === 'string' ? (p['visual:parentId'] as string).trim() : ''
    return parent
  }

  const groupIds: string[] = []
  const groups = new Map<string, GraphNode[]>()
  const ungrouped: GraphNode[] = []
  for (let i = 0; i < mermaidNodes.length; i += 1) {
    const n = mermaidNodes[i]
    const gk = groupKeyOf(n)
    if (!gk) {
      ungrouped.push(n)
      continue
    }
    if (!groups.has(gk)) {
      groups.set(gk, [])
      groupIds.push(gk)
    }
    groups.get(gk)!.push(n)
  }

  if (groupIds.length === 0) return

  const groupOut = new Map<string, Set<string>>()
  const groupInDeg = new Map<string, number>()
  for (let i = 0; i < groupIds.length; i += 1) {
    groupOut.set(groupIds[i], new Set())
    groupInDeg.set(groupIds[i], 0)
  }

  const nodeToGroup = new Map<string, string>()
  groups.forEach((ns, gid) => {
    for (let i = 0; i < ns.length; i += 1) nodeToGroup.set(String(ns[i].id), gid)
  })

  for (let i = 0; i < mermaidEdges.length; i += 1) {
    const e = mermaidEdges[i]
    const gs = nodeToGroup.get(e.src)
    const gt = nodeToGroup.get(e.tgt)
    if (!gs || !gt || gs === gt) continue
    const set = groupOut.get(gs)
    if (!set) continue
    if (!set.has(gt)) {
      set.add(gt)
      groupInDeg.set(gt, (groupInDeg.get(gt) || 0) + 1)
    }
  }

  const q: string[] = []
  groupInDeg.forEach((d, gid) => {
    if (d === 0) q.push(gid)
  })
  q.sort((a, b) => a.localeCompare(b))

  const ordered: string[] = []
  let qi = 0
  while (qi < q.length) {
    const gid = q[qi++]!
    ordered.push(gid)
    const outs = Array.from(groupOut.get(gid) || []).sort((a, b) => a.localeCompare(b))
    for (let j = 0; j < outs.length; j += 1) {
      const tgt = outs[j]!
      groupInDeg.set(tgt, (groupInDeg.get(tgt) || 0) - 1)
      if ((groupInDeg.get(tgt) || 0) === 0) q.push(tgt)
    }
  }

  if (ordered.length !== groupIds.length) {
    const remaining = groupIds.filter(g => !ordered.includes(g)).sort((a, b) => a.localeCompare(b))
    for (let i = 0; i < remaining.length; i += 1) ordered.push(remaining[i])
  }

  if (forward < 0) ordered.reverse()

  const bandIds = ungrouped.length > 0 ? [...ordered, '__ungrouped__'] : ordered
  const bandCount = Math.max(1, bandIds.length)

  const placeNode = (n: GraphNode, x: number, y: number) => {
    n.x = x
    n.y = y
    n.vx = 0
    n.vy = 0
    n.fx = null
    n.fy = null
  }

  const items = bandIds.map(id => ({
    id,
    nodes: id === '__ungrouped__' ? ungrouped : groups.get(id) || [],
  }))

  const layoutInsideBox = (ns: GraphNode[], box: { x0: number; x1: number; y0: number; y1: number }) => {
    if (!ns.length) return
    if (ns.length === 1) {
      placeNode(ns[0]!, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2)
      return
    }
    const nodeIds = ns.map(n => String(n.id))
    const idSet = new Set(nodeIds)
    const es = mermaidEdges.filter(e => idSet.has(e.src) && idSet.has(e.tgt))
    const rank = computeRanks(nodeIds, es)
    let maxRank = 0
    rank.forEach(v => {
      if (v > maxRank) maxRank = v
    })
    const layers: Map<number, GraphNode[]> = new Map()
    for (let i = 0; i < ns.length; i += 1) {
      const n = ns[i]
      const r = rank.get(String(n.id)) || 0
      const arr = layers.get(r) || []
      arr.push(n)
      layers.set(r, arr)
    }

    const layerCount = Math.max(1, maxRank + 1)
    const innerPad = Math.max(18, Math.min(54, Math.min(box.x1 - box.x0, box.y1 - box.y0) * 0.12))
    const x0 = box.x0 + innerPad
    const x1 = box.x1 - innerPad
    const y0 = box.y0 + innerPad
    const y1 = box.y1 - innerPad
    const primary0 = axis === 'x' ? x0 : y0
    const primary1 = axis === 'x' ? x1 : y1
    const secondary0 = axis === 'x' ? y0 : x0
    const secondary1 = axis === 'x' ? y1 : x1
    const primaryLen = Math.max(1, primary1 - primary0)
    const secondaryLen = Math.max(1, secondary1 - secondary0)
    const layerGap = primaryLen / layerCount

    const layerKeys = Array.from(layers.keys()).sort((a, b) => a - b)
    for (let li = 0; li < layerKeys.length; li += 1) {
      const r = layerKeys[li]!
      const ln = (layers.get(r) || []).sort((a, b) => String(a.id).localeCompare(String(b.id)))
      const primary = primary0 + layerGap * (r + 0.5)
      const m = ln.length
      for (let ni = 0; ni < m; ni += 1) {
        const n = ln[ni]!
        const t = (ni + 1) / (m + 1)
        const jitter = (hash01(String(n.id)) - 0.5) * Math.min(10, secondaryLen * 0.02)
        const secondary = secondary0 + secondaryLen * t + jitter
        if (axis === 'x') placeNode(n, primary, secondary)
        else placeNode(n, secondary, primary)
      }
    }
  }

  const grid = computeSeedGrid({ count: bandCount, width: frameW, height: frameH, pad })

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!
    const ns = item.nodes
    if (!ns.length) continue
    const { x0, x1, y0, y1 } = getSeedGridCellBox(grid, i)
    layoutInsideBox(ns, { x0, x1, y0, y1 })
  }

  const groupCenters: Array<{ x: number; y: number }> = []
  for (let i = 0; i < items.length; i += 1) {
    const ns = items[i]!.nodes
    if (!ns.length) continue
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let valid = 0
    for (let j = 0; j < ns.length; j += 1) {
      const n = ns[j]!
      if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
      minX = Math.min(minX, n.x)
      maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y)
      maxY = Math.max(maxY, n.y)
      valid += 1
    }
    if (valid === 0 || minX === Infinity) continue
    groupCenters.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 })
  }

  const centers = groupCenters.length > 0 ? groupCenters : mermaidNodes
  const shift = computeGraphElementCentroidShiftToViewportCenter({
    elements: centers,
    viewportW: frameW,
    viewportH: frameH,
  })
  if (shift) {
    const dx = shift.dx
    const dy = shift.dy
    for (let i = 0; i < mermaidNodes.length; i += 1) {
      const n = mermaidNodes[i]
      if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
      n.x += dx
      n.y += dy
    }
  }
}
