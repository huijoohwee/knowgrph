import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'

import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

type SubgraphMembership = {
  memberNodeIds: Set<string>
  childSubgraphIds: Set<string>
}

const isEdgeMembership = (e: GraphEdge): e is GraphEdge => {
  return e.label === 'hasMermaidNode' || e.label === 'hasMermaidSubgraph'
}

const isMermaidSubgraphNode = (n: GraphNode): boolean => String(n.type || '') === 'MermaidSubgraph'

const readStringProp = (props: Record<string, unknown> | null | undefined, key: string): string | null => {
  if (!props) return null
  const v = (props as Record<string, unknown>)[key]
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

const readNumberProp = (props: Record<string, unknown> | null | undefined, key: string): number | null => {
  if (!props) return null
  const v = (props as Record<string, unknown>)[key]
  const n = typeof v === 'number' ? v : Number.NaN
  if (!Number.isFinite(n)) return null
  return n
}

export const deriveMermaidSubgraphGroups = (data: GraphData): MermaidSubgraphGroup[] => {
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []

  const subgraphById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (isMermaidSubgraphNode(n)) subgraphById.set(String(n.id), n)
  }
  if (subgraphById.size === 0) return []

  const membershipBySubgraphId = new Map<string, SubgraphMembership>()
  const parentBySubgraphId = new Map<string, string>()

  const ensureMembership = (subgraphId: string): SubgraphMembership => {
    const existing = membershipBySubgraphId.get(subgraphId)
    if (existing) return existing
    const created: SubgraphMembership = { memberNodeIds: new Set(), childSubgraphIds: new Set() }
    membershipBySubgraphId.set(subgraphId, created)
    return created
  }

  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    if (!isEdgeMembership(e)) continue
    const src = String(e.source || '')
    const tgt = String(e.target || '')
    if (!src || !tgt) continue
    if (!subgraphById.has(src)) continue
    const mem = ensureMembership(src)
    if (e.label === 'hasMermaidNode') {
      mem.memberNodeIds.add(tgt)
    } else if (e.label === 'hasMermaidSubgraph') {
      mem.childSubgraphIds.add(tgt)
      if (subgraphById.has(tgt)) parentBySubgraphId.set(tgt, src)
    }
  }

  const depthBySubgraphId = new Map<string, number>()
  const computeDepth = (id: string): number => {
    const cached = depthBySubgraphId.get(id)
    if (typeof cached === 'number') return cached
    const parent = parentBySubgraphId.get(id)
    const depth = parent ? computeDepth(parent) + 1 : 0
    depthBySubgraphId.set(id, depth)
    return depth
  }

  const descendantLeafNodesCache = new Map<string, string[]>()
  const collectLeafNodes = (subgraphId: string): string[] => {
    const cached = descendantLeafNodesCache.get(subgraphId)
    if (cached) return cached
    const mem = membershipBySubgraphId.get(subgraphId)
    if (!mem) {
      descendantLeafNodesCache.set(subgraphId, [])
      return []
    }
    const out = new Set<string>()
    mem.memberNodeIds.forEach(id => out.add(String(id)))
    mem.childSubgraphIds.forEach(childId => {
      const arr = collectLeafNodes(childId)
      for (let i = 0; i < arr.length; i += 1) out.add(arr[i])
    })
    const finalized = Array.from(out).sort((a, b) => a.localeCompare(b))
    descendantLeafNodesCache.set(subgraphId, finalized)
    return finalized
  }

  const groups: GraphGroup[] = []
  subgraphById.forEach((node, id) => {
    const label = String((node.properties || {})['label'] || node.label || id)
    const props = node.properties as unknown as Record<string, unknown>
    const style = {
      fill: readStringProp(props, 'visual:fill') ?? undefined,
      stroke: readStringProp(props, 'visual:stroke') ?? undefined,
      strokeWidth: readNumberProp(props, 'visual:strokeWidth') ?? readNumberProp(props, 'stroke-width') ?? undefined,
    }
    groups.push({
      id,
      label,
      depth: computeDepth(id),
      memberNodeIds: collectLeafNodes(id),
      style,
    })
  })

  groups.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.id.localeCompare(b.id)
  })
  return groups
}

export type MermaidSubgraphGroup = GraphGroup
