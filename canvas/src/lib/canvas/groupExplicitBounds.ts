import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphNode } from '@/lib/graph/types'
import { readGroupBoundsOverrideSource } from '@/lib/canvas/groupBoundsOverrides'
import type { RectBounds } from '@/lib/canvas/groupContainment'

const readRectBounds = (g: GraphGroup['bounds'] | null): RectBounds | null => {
  if (!g) return null
  const x = typeof g.x === 'number' ? g.x : Number.NaN
  const y = typeof g.y === 'number' ? g.y : Number.NaN
  const width = typeof g.width === 'number' ? g.width : Number.NaN
  const height = typeof g.height === 'number' ? g.height : Number.NaN
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

export const buildGroupRectByIdFromSchemaOverrides = (args: { groups: GraphGroup[]; graphNodes: ReadonlyArray<GraphNode>; schema: GraphSchema }): Map<string, RectBounds> => {
  const out = new Map<string, RectBounds>()
  for (let i = 0; i < args.groups.length; i += 1) {
    const g = args.groups[i]
    const groupId = String(g.id || '').trim()
    if (!groupId) continue
    const override = readGroupBoundsOverrideSource({ groupId, graphNodes: args.graphNodes, schema: args.schema }).bounds
    const rect = readRectBounds(override)
    if (!rect) continue
    out.set(groupId, rect)
  }
  return out
}

export const buildGroupRectByIdFromGroups = (groups: GraphGroup[] | null | undefined): Map<string, RectBounds> => {
  const out = new Map<string, RectBounds>()
  const gs = Array.isArray(groups) ? groups : []
  for (let i = 0; i < gs.length; i += 1) {
    const g = gs[i]
    const id = String(g.id || '').trim()
    if (!id) continue
    const rect = readRectBounds(g.bounds || null)
    if (!rect) continue
    out.set(id, rect)
  }
  return out
}

export const buildDeepestGroupRectByNodeId = (args: { groups: GraphGroup[]; groupRectById: Map<string, RectBounds> }): Map<string, RectBounds> => {
  const bestDepthByNodeId = new Map<string, number>()
  const boundsByNodeId = new Map<string, RectBounds>()
  for (let i = 0; i < args.groups.length; i += 1) {
    const g = args.groups[i]
    const groupId = String(g.id || '').trim()
    if (!groupId) continue
    const rect = args.groupRectById.get(groupId) || null
    if (!rect) continue
    const depth = typeof g.depth === 'number' && Number.isFinite(g.depth) ? Math.max(0, Math.floor(g.depth)) : 0
    const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
    for (let j = 0; j < members.length; j += 1) {
      const nodeId = String(members[j] || '').trim()
      if (!nodeId) continue
      const prevDepth = bestDepthByNodeId.get(nodeId)
      if (prevDepth != null && prevDepth >= depth) continue
      bestDepthByNodeId.set(nodeId, depth)
      boundsByNodeId.set(nodeId, rect)
    }
  }
  return boundsByNodeId
}

