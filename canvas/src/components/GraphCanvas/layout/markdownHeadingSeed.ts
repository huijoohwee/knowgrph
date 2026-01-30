import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { computeSeedGrid, getSeedGridCellBox } from '@/components/GraphCanvas/layout/seedGrid'
import { DEFAULT_FIT_PADDING, readFitPadding } from '@/lib/graph/layoutDefaults'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const hash01 = (id: string): number => {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

const isHeadingSectionNode = (n: GraphNode): boolean => {
  if (String(n.type || '') !== 'Section') return false
  const props = (n.properties || {}) as Record<string, unknown>
  return typeof props.level === 'number' && Number.isFinite(props.level)
}

export const applyMarkdownHeadingSeedLayout = (args: {
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

  const sectionIds = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (!isHeadingSectionNode(n)) continue
    sectionIds.add(String(n.id))
  }
  if (sectionIds.size < 2) return

  const parentOf = new Map<string, string>()
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const lbl = String(e.label || '')
    if (lbl !== 'hasSection' && lbl !== 'hasBlock' && lbl !== 'hasItem' && lbl !== 'embedsImage') continue
    const src = String(e.source || '')
    const tgt = String(e.target || '')
    if (!src || !tgt) continue
    if (!parentOf.has(tgt)) parentOf.set(tgt, src)
  }

  const topSectionOf = (nodeId: string): string | null => {
    const seen = new Set<string>()
    let cur: string | null = nodeId
    let section: string | null = null
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      if (sectionIds.has(cur)) {
        section = cur
      }
      cur = parentOf.get(cur) || null
    }
    if (!section) return null
    cur = section
    while (cur) {
      const p = parentOf.get(cur)
      if (!p || !sectionIds.has(p)) break
      cur = p
    }
    return cur || section
  }

  const membersByTop = new Map<string, GraphNode[]>()
  nodes.forEach(n => {
    const id = String(n.id)
    if (!id) return
    if (sectionIds.has(id)) return
    const top = topSectionOf(id)
    if (!top) return
    const arr = membersByTop.get(top) || []
    arr.push(n)
    membersByTop.set(top, arr)
  })

  const groupIds = Array.from(membersByTop.keys()).sort((a, b) => a.localeCompare(b))
  if (groupIds.length < 2) return

  const pad = Math.max(DEFAULT_FIT_PADDING, readFitPadding(schema))
  const frameW = Math.max(1, width)
  const frameH = Math.max(1, height)
  const grid = computeSeedGrid({ count: groupIds.length, width: frameW, height: frameH, pad })

  for (let gi = 0; gi < groupIds.length; gi += 1) {
    const gid = groupIds[gi]!
    const members = (membersByTop.get(gid) || []).sort((a, b) => String(a.id).localeCompare(String(b.id)))
    if (members.length === 0) continue
    const cell = getSeedGridCellBox(grid, gi)
    const inner = Math.max(24, Math.min(60, Math.min(cell.x1 - cell.x0, cell.y1 - cell.y0) * 0.12))
    const x0 = cell.x0 + inner
    const x1 = cell.x1 - inner
    const y0 = cell.y0 + inner
    const y1 = cell.y1 - inner
    const w = Math.max(1, x1 - x0)
    const h = Math.max(1, y1 - y0)
    for (let i = 0; i < members.length; i += 1) {
      const n = members[i]!
      const ux = hash01(String(n.id))
      const uy = hash01(`${String(n.id)}:y`)
      n.x = x0 + w * (0.12 + 0.76 * ux)
      n.y = y0 + h * (0.12 + 0.76 * uy)
      n.vx = 0
      n.vy = 0
      n.fx = null
      n.fy = null
    }
  }

  let sumX = 0
  let sumY = 0
  let count = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
    sumX += n.x
    sumY += n.y
    count += 1
  }
  if (count > 0) {
    const cx = sumX / count
    const cy = sumY / count
    const dx = frameW / 2 - cx
    const dy = frameH / 2 - cy
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
      n.x += dx
      n.y += dy
    }
  }
}
