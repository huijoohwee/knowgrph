import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'

import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

type SubgraphMembership = {
  memberNodeIds: Set<string>
  childSubgraphIds: Set<string>
}

type VisualBounds = {
  x: number
  y: number
  width: number
  height: number
  labelX?: number
  labelY?: number
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

const readBoundsProp = (props: Record<string, unknown> | null | undefined, key: string): VisualBounds | null => {
  if (!props) return null
  const v = (props as Record<string, unknown>)[key]
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const x = typeof (v as any).x === 'number' ? (v as any).x : Number.NaN
  const y = typeof (v as any).y === 'number' ? (v as any).y : Number.NaN
  const width = typeof (v as any).width === 'number' ? (v as any).width : Number.NaN
  const height = typeof (v as any).height === 'number' ? (v as any).height : Number.NaN
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null
  const labelX = typeof (v as any).labelX === 'number' && Number.isFinite((v as any).labelX) ? (v as any).labelX : undefined
  const labelY = typeof (v as any).labelY === 'number' && Number.isFinite((v as any).labelY) ? (v as any).labelY : undefined
  return { x, y, width, height, ...(labelX != null ? { labelX } : {}), ...(labelY != null ? { labelY } : {}) }
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
    const xIndex = readNumberProp(props, 'visual:xIndex')
    const yIndex = readNumberProp(props, 'visual:yIndex')
    const bounds = readBoundsProp(props, 'visual:boundsOverride') ?? readBoundsProp(props, 'visual:bounds')
    const zIndex = readNumberProp(props, 'visual:zIndexOverride') ?? readNumberProp(props, 'visual:zIndex')
    groups.push({
      id,
      label,
      depth: computeDepth(id),
      xIndex: xIndex ?? undefined,
      yIndex: yIndex ?? undefined,
      memberNodeIds: collectLeafNodes(id),
      style,
      ...(zIndex != null ? { zIndex } : {}),
      ...(zIndex != null ? { zMode: 'absolute' } : {}),
      ...(bounds ? { bounds } : {}),
    })
  })

  groups.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    const ax = typeof a.xIndex === 'number' && Number.isFinite(a.xIndex) ? a.xIndex : 0
    const bx = typeof b.xIndex === 'number' && Number.isFinite(b.xIndex) ? b.xIndex : 0
    if (ax !== bx) return ax - bx
    const ay = typeof a.yIndex === 'number' && Number.isFinite(a.yIndex) ? a.yIndex : 0
    const by = typeof b.yIndex === 'number' && Number.isFinite(b.yIndex) ? b.yIndex : 0
    if (ay !== by) return ay - by
    return a.id.localeCompare(b.id)
  })
  return groups
}

export type MermaidSubgraphGroup = GraphGroup
