import type { FlowNativeScene } from '@/components/FlowCanvas/nativeRuntime'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export type FlowEditorContainmentGroupLookup = {
  groups: GraphGroup[]
  groupIdsByNodeId: Map<string, string[]>
  groupById: Map<string, GraphGroup>
  readContainmentGroupForNode: (nodeId: string) => GraphGroup | null
}

const flowEditorContainmentGroupLookupCache = new WeakMap<FlowNativeScene, FlowEditorContainmentGroupLookup>()

const isContainmentGroup = (g: { id?: unknown; source?: unknown } | null): boolean => {
  if (!g) return false
  const src = String(g.source || '').trim()
  if (src === 'userSubgraph' || src === 'mermaidSubgraph' || src === 'layer' || src === 'community') return true
  const gid = String(g.id || '')
  return gid.startsWith('subgraph:') || gid.startsWith('layer:') || gid.startsWith('community:')
}

export function getCachedFlowEditorContainmentGroupLookup(scene: FlowNativeScene | null | undefined): FlowEditorContainmentGroupLookup | null {
  if (!scene) return null
  const groups = Array.isArray(scene.groups) ? scene.groups : []
  const groupIdsByNodeId = scene.groupIdsByNodeId || null
  if (groups.length === 0 || !groupIdsByNodeId) return null

  const cached = flowEditorContainmentGroupLookupCache.get(scene)
  if (cached && cached.groups === groups && cached.groupIdsByNodeId === groupIdsByNodeId) return cached

  const groupById = new Map<string, GraphGroup>()
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]
    const gid = String(g?.id || '').trim()
    if (gid && !groupById.has(gid)) groupById.set(gid, g)
  }

  const bestContainmentGroupByNodeId = new Map<string, GraphGroup | null>()
  const readContainmentGroupForNode = (nodeId: string): GraphGroup | null => {
    const id = String(nodeId || '').trim()
    if (!id) return null
    if (bestContainmentGroupByNodeId.has(id)) return bestContainmentGroupByNodeId.get(id) || null
    const groupIds = groupIdsByNodeId.get(id) || []
    let best: GraphGroup | null = null
    let bestDepth = -Infinity
    let bestSize = Infinity
    for (let i = 0; i < groupIds.length; i += 1) {
      const gid = String(groupIds[i] || '').trim()
      if (!gid) continue
      const g = groupById.get(gid) || null
      if (!isContainmentGroup(g)) continue
      const depthRaw = (g as unknown as { depth?: unknown })?.depth
      const depth = typeof depthRaw === 'number' && Number.isFinite(depthRaw) ? Math.max(0, Math.floor(depthRaw)) : 0
      const members = Array.isArray((g as unknown as { memberNodeIds?: unknown })?.memberNodeIds)
        ? ((g as unknown as { memberNodeIds: unknown[] }).memberNodeIds as unknown[])
        : []
      const size = members.length
      if (
        best == null
        || depth > bestDepth
        || (depth === bestDepth && size < bestSize)
        || (depth === bestDepth && size === bestSize && gid.localeCompare(best.id) < 0)
      ) {
        best = g
        bestDepth = depth
        bestSize = size
      }
    }
    bestContainmentGroupByNodeId.set(id, best)
    return best
  }

  const next = { groups, groupIdsByNodeId, groupById, readContainmentGroupForNode }
  flowEditorContainmentGroupLookupCache.set(scene, next)
  return next
}
