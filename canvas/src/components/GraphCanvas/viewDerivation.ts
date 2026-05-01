import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { hashText } from '@/features/parsers/hash'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'

const GROUP_COLLAPSE_CACHE = new WeakMap<GraphData, Map<string, GraphData>>()

const clampNumber = (v: number, min: number, max: number): number => {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

export const collapsedGroupNodeIdFor = (groupId: string): string => {
  const id = String(groupId || '').trim()
  return `kg:group:${hashText(id)}`
}

const coerceFiniteNumber = (v: unknown): number | null => {
  if (typeof v !== 'number') return null
  return Number.isFinite(v) ? v : null
}

const readNumericProp = (props: Record<string, unknown> | null | undefined, key: string): number | null => {
  if (!props) return null
  const v = props[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

const groupNodeTypeFor = (groupId: string): GraphNode['type'] => {
  const id = String(groupId || '')
  if (id.startsWith('community:')) return 'Cluster'
  if (id.startsWith('keyword-layer:')) return 'Layer'
  if (id.startsWith('md:')) return 'Subgraph'
  return 'Group'
}

export const deriveGraphDataWithGroupCollapse = (args: {
  graphData: GraphData
  collapsedGroupIds: string[]
}): GraphData => {
  const normalizedCollapsedGroupIds = Array.isArray(args.collapsedGroupIds)
    ? args.collapsedGroupIds.map(x => String(x || '').trim()).filter(Boolean)
    : []
  const collapsedKey = normalizedCollapsedGroupIds.length ? normalizedCollapsedGroupIds.join('|') : ''

  if (collapsedKey) {
    const byKey = GROUP_COLLAPSE_CACHE.get(args.graphData)
    const cached = byKey?.get(collapsedKey)
    if (cached) return cached
  }

  const collapsedSet = new Set<string>(normalizedCollapsedGroupIds)
  if (collapsedSet.size === 0) return args.graphData

  const groups = deriveGraphGroups(args.graphData)
  if (groups.length === 0) return args.graphData

  const collapsedGroups = groups.filter(g => collapsedSet.has(String(g.id)))
  if (collapsedGroups.length === 0) return args.graphData

  const collapsedGroupById = new Map<string, (typeof collapsedGroups)[number]>()
  for (let i = 0; i < collapsedGroups.length; i += 1) {
    const g = collapsedGroups[i]!
    collapsedGroupById.set(String(g.id), g)
  }

  const nodes = Array.isArray(args.graphData.nodes) ? (args.graphData.nodes as GraphNode[]) : []
  const graphLookup = getCachedGraphLookup({
    cacheScope: 'graph-canvas-view-derivation-group-collapse',
    graphData: args.graphData,
  })
  const nodeById = graphLookup?.nodeById || new Map<string, GraphNode>()

  const assignmentByNodeId = new Map<string, { groupId: string; depth: number }>()
  for (let gi = 0; gi < collapsedGroups.length; gi += 1) {
    const g = collapsedGroups[gi]!
    const groupId = String(g.id)
    const depth = typeof g.depth === 'number' && Number.isFinite(g.depth) ? g.depth : 0
    const memberNodeIds = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
    for (let mi = 0; mi < memberNodeIds.length; mi += 1) {
      const nodeId = String(memberNodeIds[mi] || '').trim()
      if (!nodeId) continue
      if (!nodeById.has(nodeId)) continue
      const prev = assignmentByNodeId.get(nodeId)
      if (!prev || depth > prev.depth || (depth === prev.depth && groupId.localeCompare(prev.groupId) < 0)) {
        assignmentByNodeId.set(nodeId, { groupId, depth })
      }
    }
  }

  const groupNodeIdByGroupId = new Map<string, string>()
  const groupNodeMemberCountByGroupId = new Map<string, number>()
  assignmentByNodeId.forEach(({ groupId }) => {
    groupNodeMemberCountByGroupId.set(groupId, (groupNodeMemberCountByGroupId.get(groupId) || 0) + 1)
  })
  collapsedGroupById.forEach((g, groupId) => {
    groupNodeIdByGroupId.set(groupId, collapsedGroupNodeIdFor(groupId))
    const count = groupNodeMemberCountByGroupId.get(groupId) || 0
    groupNodeMemberCountByGroupId.set(groupId, count)
  })

  const derivedGroupNodes: GraphNode[] = []
  groupNodeIdByGroupId.forEach((nodeId, groupId) => {
    const g = collapsedGroupById.get(groupId)
    if (!g) return
    const memberCount = groupNodeMemberCountByGroupId.get(groupId) || 0
    let xSum = 0
    let ySum = 0
    let xyCount = 0
    assignmentByNodeId.forEach((assignment, nodeId) => {
      if (assignment.groupId !== groupId) return
      const n = nodeById.get(nodeId)
      if (!n) return
      const x = coerceFiniteNumber((n as unknown as { x?: unknown }).x)
      const y = coerceFiniteNumber((n as unknown as { y?: unknown }).y)
      if (x == null || y == null) return
      xSum += x
      ySum += y
      xyCount += 1
    })
    const cx = xyCount > 0 ? xSum / xyCount : null
    const cy = xyCount > 0 ? ySum / xyCount : null

    const baseSize = 14 + Math.sqrt(Math.max(0, memberCount)) * 4
    const nodeSize = clampNumber(baseSize, 12, 60)
    const props: Record<string, JSONValue> = {
      'kg:groupId': groupId as unknown as JSONValue,
      'kg:groupDepth': (typeof g.depth === 'number' && Number.isFinite(g.depth) ? g.depth : 0) as unknown as JSONValue,
      'kg:groupMemberCount': memberCount as unknown as JSONValue,
      'kg:collapsed': true as unknown as JSONValue,
      'visual:importance': memberCount as unknown as JSONValue,
      'visual:nodeSize': nodeSize as unknown as JSONValue,
    }

    derivedGroupNodes.push({
      id: nodeId,
      label: String(g.label || groupId),
      type: groupNodeTypeFor(groupId),
      properties: props,
      x: cx == null ? undefined : cx,
      y: cy == null ? undefined : cy,
    })
  })

  const keptNodes: GraphNode[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const id = String(n.id || '')
    if (!id) continue
    if (assignmentByNodeId.has(id)) continue
    keptNodes.push(n)
  }

  const outNodes = [...keptNodes, ...derivedGroupNodes]
  const outNodeIdSet = new Set<string>(outNodes.map(n => String(n.id)))

  type Agg = {
    id: string
    source: string
    target: string
    label: string
    count: number
    widthSum: number
  }

  const aggByKey = new Map<string, Agg>()
  const edges = Array.isArray(args.graphData.edges) ? (args.graphData.edges as GraphEdge[]) : []
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]!
    const rawS = String((e.source && typeof e.source === 'object' ? (e.source as { id?: unknown }).id : e.source) || '').trim()
    const rawT = String((e.target && typeof e.target === 'object' ? (e.target as { id?: unknown }).id : e.target) || '').trim()
    if (!rawS || !rawT) continue

    const sGroupId = assignmentByNodeId.get(rawS)?.groupId || null
    const tGroupId = assignmentByNodeId.get(rawT)?.groupId || null
    const repS = sGroupId ? (groupNodeIdByGroupId.get(sGroupId) || rawS) : rawS
    const repT = tGroupId ? (groupNodeIdByGroupId.get(tGroupId) || rawT) : rawT
    if (!repS || !repT) continue
    if (!outNodeIdSet.has(repS) || !outNodeIdSet.has(repT)) continue
    if (repS === repT) continue

    const label = String(e.label || 'relatedTo')
    const key = `${repS}|${label}|${repT}`
    const width = readNumericProp((e.properties || {}) as Record<string, unknown>, 'visual:width') ?? 2

    const existing = aggByKey.get(key)
    if (existing) {
      existing.count += 1
      existing.widthSum += width
      continue
    }
    aggByKey.set(key, {
      id: `kg:edge:${hashText(key)}`,
      source: repS,
      target: repT,
      label,
      count: 1,
      widthSum: width,
    })
  }

  const outEdges: GraphEdge[] = []
  aggByKey.forEach((a) => {
    const avgWidth = a.count > 0 ? a.widthSum / a.count : 2
    const width = clampNumber(avgWidth + Math.log2(a.count + 1), 1, 12)
    outEdges.push({
      id: a.id,
      source: a.source,
      target: a.target,
      label: a.label,
      properties: {
        'kg:collapsedEdge': true,
        'kg:edgeCount': a.count,
        'visual:width': width,
      },
    })
  })
  outEdges.sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const out = {
    ...args.graphData,
    nodes: outNodes,
    edges: outEdges,
    metadata: {
      ...((args.graphData.metadata || {}) as Record<string, JSONValue>),
      'kg:view': { collapsedGroupIds: Array.from(collapsedSet).sort((a, b) => a.localeCompare(b)) } as unknown as JSONValue,
    },
  }

  if (collapsedKey) {
    const byKey = GROUP_COLLAPSE_CACHE.get(args.graphData) || new Map<string, GraphData>()
    byKey.set(collapsedKey, out)
    GROUP_COLLAPSE_CACHE.set(args.graphData, byKey)
  }
  return out
}
