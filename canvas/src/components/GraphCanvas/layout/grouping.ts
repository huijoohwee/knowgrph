import type { GraphEdge, GraphNode } from '@/lib/graph/types'

const EDGE_LABELS_THAT_DEFINE_PARENT = new Set(['hasSection', 'hasBlock', 'hasItem', 'embedsImage'])

export type GroupKeyOfNode = (n: GraphNode) => string | null

function coerceEndpointId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

export function createGroupKeyOfNode(args: { nodes: GraphNode[]; edges: GraphEdge[] }): GroupKeyOfNode {
  const sectionIds = new Set<string>()
  for (let i = 0; i < args.nodes.length; i += 1) {
    const n = args.nodes[i]
    if (String(n.type || '') !== 'Section') continue
    const props = (n.properties || {}) as Record<string, unknown>
    if (typeof props.level !== 'number' || !Number.isFinite(props.level)) continue
    sectionIds.add(String(n.id))
  }

  const parentOf = new Map<string, string>()
  for (let i = 0; i < args.edges.length; i += 1) {
    const e = args.edges[i]
    const lbl = String(e.label || '')
    if (!EDGE_LABELS_THAT_DEFINE_PARENT.has(lbl)) continue
    const src = coerceEndpointId(e.source)
    const tgt = coerceEndpointId(e.target)
    if (!src || !tgt) continue
    if (!parentOf.has(tgt)) parentOf.set(tgt, src)
  }

  const topSectionOf = (nodeId: string): string | null => {
    if (!sectionIds.size) return null
    const seen = new Set<string>()
    let cur: string | null = nodeId
    let section: string | null = null
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      if (sectionIds.has(cur)) section = cur
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

  const groupKeyOf: GroupKeyOfNode = (n: GraphNode): string | null => {
    const p = (n.properties || {}) as Record<string, unknown>
    const top = typeof p['visual:topParentId'] === 'string' ? (p['visual:topParentId'] as string).trim() : ''
    if (top) return top
    const parent = typeof p['visual:parentId'] === 'string' ? (p['visual:parentId'] as string).trim() : ''
    if (parent) return parent
    const nid = String(n.id)
    return nid ? topSectionOf(nid) : null
  }

  return groupKeyOf
}

export function computeGroupTargets(args: { nodes: GraphNode[]; groupKeyOf: GroupKeyOfNode }): {
  readGroupTarget: (n: GraphNode) => { x: number; y: number } | null
} {
  const groupAcc = new Map<string, { sx: number; sy: number; n: number }>()
  for (let i = 0; i < args.nodes.length; i += 1) {
    const n = args.nodes[i]
    const id = String(n.id)
    if (!id) continue
    const gid = args.groupKeyOf(n)
    if (!gid) continue
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    const prev = groupAcc.get(gid) || { sx: 0, sy: 0, n: 0 }
    groupAcc.set(gid, { sx: prev.sx + x, sy: prev.sy + y, n: prev.n + 1 })
  }

  const groupTarget = new Map<string, { x: number; y: number }>()
  groupAcc.forEach((v, gid) => {
    if (v.n <= 0) return
    groupTarget.set(gid, { x: v.sx / v.n, y: v.sy / v.n })
  })

  const readGroupTarget = (n: GraphNode): { x: number; y: number } | null => {
    const gid = args.groupKeyOf(n)
    if (!gid) return null
    return groupTarget.get(gid) || null
  }

  return { readGroupTarget }
}

