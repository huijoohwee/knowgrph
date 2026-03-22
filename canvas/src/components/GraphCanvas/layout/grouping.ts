import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { DOCUMENT_CONTAINMENT_EDGE_LABELS } from '@/lib/graph/documentContainmentEdgeLabels'

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
    if (!DOCUMENT_CONTAINMENT_EDGE_LABELS.has(lbl)) continue
    const src = coerceEndpointId(e.source)
    const tgt = coerceEndpointId(e.target)
    if (!src || !tgt) continue
    if (!parentOf.has(tgt)) parentOf.set(tgt, src)
  }

  const topSectionCache = new Map<string, string | null>()

  const topSectionOf = (nodeId: string): string | null => {
    if (!sectionIds.size) return null
    const cached = topSectionCache.get(nodeId)
    if (cached !== undefined) return cached

    const visited: string[] = []
    let cur: string | null = nodeId
    let section: string | null = null
    while (cur) {
      if (topSectionCache.has(cur)) {
        section = topSectionCache.get(cur) || null
        break
      }
      visited.push(cur)
      if (sectionIds.has(cur)) section = cur
      cur = parentOf.get(cur) || null
    }
    if (!section) {
      for (let i = 0; i < visited.length; i += 1) topSectionCache.set(visited[i]!, null)
      return null
    }
    cur = section
    while (cur) {
      const p = parentOf.get(cur)
      if (!p || !sectionIds.has(p)) break
      cur = p
    }

    const top = cur || section
    for (let i = 0; i < visited.length; i += 1) topSectionCache.set(visited[i]!, top)
    return top
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
