import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

const normalizeId = (v: unknown): string => String(v || '').trim()

export const filterGroupsByCollapsedAncestors = (args: {
  groups: ReadonlyArray<GraphGroup>
  collapsedGroupIdSet: ReadonlySet<string>
}): GraphGroup[] => {
  if (args.groups.length === 0) return []
  if (!args.collapsedGroupIdSet || args.collapsedGroupIdSet.size === 0) return args.groups.slice() as GraphGroup[]

  const parentById = new Map<string, string | null>()
  for (let i = 0; i < args.groups.length; i += 1) {
    const g = args.groups[i]
    const id = normalizeId(g?.id)
    if (!id) continue
    const parentId = normalizeId((g as unknown as { parentGroupId?: unknown }).parentGroupId) || null
    parentById.set(id, parentId && parentId !== id ? parentId : null)
  }

  const memo = new Map<string, boolean>()
  const visiting = new Set<string>()
  const hasCollapsedAncestor = (id: string): boolean => {
    const cached = memo.get(id)
    if (cached != null) return cached
    if (visiting.has(id)) {
      memo.set(id, false)
      return false
    }
    visiting.add(id)
    const parentId = parentById.get(id) || null
    const result = parentId ? (args.collapsedGroupIdSet.has(parentId) ? true : hasCollapsedAncestor(parentId)) : false
    visiting.delete(id)
    memo.set(id, result)
    return result
  }

  const out: GraphGroup[] = []
  for (let i = 0; i < args.groups.length; i += 1) {
    const g = args.groups[i]
    const id = normalizeId(g?.id)
    if (!id) continue
    if (args.collapsedGroupIdSet.has(id)) {
      out.push(g)
      continue
    }
    if (hasCollapsedAncestor(id)) continue
    out.push(g)
  }
  return out
}

