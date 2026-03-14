import type { GraphNode } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

const readFiniteNumber = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

export const getGroupDepth = (g: GraphGroup): number => {
  const d = readFiniteNumber((g as unknown as { depth?: unknown }).depth, 0)
  return Math.max(0, Math.floor(d))
}

export const getGroupMemberCount = (g: GraphGroup): number => {
  const ids = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
  return Math.max(0, ids.length)
}

export const compareGroupsForZOrder = (a: GraphGroup, b: GraphGroup): number => {
  const aMode = String((a as unknown as { zMode?: unknown }).zMode || '') === 'absolute' ? 'absolute' : 'group'
  const bMode = String((b as unknown as { zMode?: unknown }).zMode || '') === 'absolute' ? 'absolute' : 'group'
  if (aMode === 'absolute' && bMode === 'absolute') {
    const ad = getGroupDepth(a)
    const bd = getGroupDepth(b)
    if (ad !== bd) return ad - bd
    const azRaw = (a as unknown as { zIndex?: unknown }).zIndex
    const bzRaw = (b as unknown as { zIndex?: unknown }).zIndex
    const az = typeof azRaw === 'number' && Number.isFinite(azRaw) ? Math.floor(azRaw) : 0
    const bz = typeof bzRaw === 'number' && Number.isFinite(bzRaw) ? Math.floor(bzRaw) : 0
    if (az !== bz) return az - bz
    return String(a.id).localeCompare(String(b.id))
  }

  const ad = getGroupDepth(a)
  const bd = getGroupDepth(b)
  if (ad !== bd) return ad - bd

  const azRaw = (a as unknown as { zIndex?: unknown }).zIndex
  const bzRaw = (b as unknown as { zIndex?: unknown }).zIndex
  const az = typeof azRaw === 'number' && Number.isFinite(azRaw) ? Math.floor(azRaw) : null
  const bz = typeof bzRaw === 'number' && Number.isFinite(bzRaw) ? Math.floor(bzRaw) : null
  if (az != null && bz != null && az !== bz) return az - bz

  const as = getGroupMemberCount(a)
  const bs = getGroupMemberCount(b)
  if (as !== bs) return bs - as

  const ay = readFiniteNumber((a as unknown as { yIndex?: unknown }).yIndex, 0)
  const by = readFiniteNumber((b as unknown as { yIndex?: unknown }).yIndex, 0)
  if (ay !== by) return ay - by

  const ax = readFiniteNumber((a as unknown as { xIndex?: unknown }).xIndex, 0)
  const bx = readFiniteNumber((b as unknown as { xIndex?: unknown }).xIndex, 0)
  if (ax !== bx) return ax - bx

  return String(a.id).localeCompare(String(b.id))
}

export type BestGroupInfo = { depth: number; size: number }

export const buildBestGroupInfoByNodeId = (groups: ReadonlyArray<GraphGroup>): Map<string, BestGroupInfo> => {
  const out = new Map<string, BestGroupInfo>()
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]
    const depth = getGroupDepth(g)
    const size = getGroupMemberCount(g)
    const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
    for (let j = 0; j < members.length; j += 1) {
      const id = String(members[j] || '').trim()
      if (!id) continue
      const prev = out.get(id)
      if (!prev) {
        out.set(id, { depth, size })
        continue
      }
      if (depth > prev.depth) {
        out.set(id, { depth, size })
        continue
      }
      if (depth === prev.depth && size < prev.size) {
        out.set(id, { depth, size })
      }
    }
  }
  return out
}

export type NodeZKey = {
  id: string
  groupDepth: number
  groupSize: number
  zIndex: number
  zMode: 'group' | 'absolute'
  yIndex: number
  xIndex: number
}

const readNodeZIndex = (n: GraphNode): number => {
  const props = (n.properties || {}) as Record<string, unknown>
  const raw = props['visual:zIndex'] ?? props['visual:depth'] ?? props['visual:layer']
  const v =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : null
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v)
  return 0
}

const readNodeIndex = (props: Record<string, unknown>, key: 'visual:xIndex' | 'visual:yIndex'): number => {
  const raw = props[key]
  const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return 0
}

export const buildNodeZKeyById = (args: { nodes: ReadonlyArray<GraphNode>; groups: ReadonlyArray<GraphGroup> }): Map<string, NodeZKey> => {
  const bestGroupByNodeId = buildBestGroupInfoByNodeId(args.groups)
  const out = new Map<string, NodeZKey>()
  for (let i = 0; i < args.nodes.length; i += 1) {
    const n = args.nodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    const props = (n.properties || {}) as Record<string, unknown>
    const best = bestGroupByNodeId.get(id) || null
    const zMode = String(props['visual:zIndexMode'] || '') === 'absolute' ? 'absolute' : 'group'
    out.set(id, {
      id,
      groupDepth: best ? best.depth : -1,
      groupSize: best ? best.size : Number.POSITIVE_INFINITY,
      zIndex: readNodeZIndex(n),
      zMode,
      yIndex: readNodeIndex(props, 'visual:yIndex'),
      xIndex: readNodeIndex(props, 'visual:xIndex'),
    })
  }
  return out
}

export const compareNodeZKey = (a: NodeZKey, b: NodeZKey): number => {
  if (a.zMode === 'absolute' && b.zMode === 'absolute') {
    if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
    if (a.yIndex !== b.yIndex) return a.yIndex - b.yIndex
    if (a.xIndex !== b.xIndex) return a.xIndex - b.xIndex
    return a.id.localeCompare(b.id)
  }
  if (a.groupDepth !== b.groupDepth) return a.groupDepth - b.groupDepth
  if (a.groupSize !== b.groupSize) return b.groupSize - a.groupSize
  if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex
  if (a.yIndex !== b.yIndex) return a.yIndex - b.yIndex
  if (a.xIndex !== b.xIndex) return a.xIndex - b.xIndex
  return a.id.localeCompare(b.id)
}
