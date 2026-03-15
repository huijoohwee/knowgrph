export type NestedGroupRow = {
  id: string
  parentId?: string | null
  memberNodeIds: string[]
}

export type NestedGroupDerivation = {
  parentIdById: Map<string, string | null>
  childrenById: Map<string, string[]>
  depthById: Map<string, number>
  descendantMemberNodeIdsById: Map<string, string[]>
}

const normalizeId = (v: unknown): string => String(v || '').trim()

const normalizeMemberIds = (ids: ReadonlyArray<unknown> | null | undefined): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  const src = Array.isArray(ids) ? ids : []
  for (let i = 0; i < src.length; i += 1) {
    const id = normalizeId(src[i])
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  out.sort((a, b) => a.localeCompare(b))
  return out
}

export const deriveNestedGroups = (rows: ReadonlyArray<NestedGroupRow>): NestedGroupDerivation => {
  const ids = new Set<string>()
  for (let i = 0; i < rows.length; i += 1) {
    const id = normalizeId(rows[i]?.id)
    if (id) ids.add(id)
  }

  const parentIdById = new Map<string, string | null>()
  const ownMembersById = new Map<string, string[]>()
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const id = normalizeId(row?.id)
    if (!id) continue
    if (parentIdById.has(id)) continue
    const parentIdRaw = row?.parentId
    const parentId = parentIdRaw == null ? null : normalizeId(parentIdRaw) || null
    parentIdById.set(id, parentId && ids.has(parentId) && parentId !== id ? parentId : null)
    ownMembersById.set(id, normalizeMemberIds(row?.memberNodeIds))
  }

  const childrenSetById = new Map<string, Set<string>>()
  parentIdById.forEach((parentId, id) => {
    if (!parentId) return
    const set = childrenSetById.get(parentId) || new Set<string>()
    set.add(id)
    childrenSetById.set(parentId, set)
  })
  const childrenById = new Map<string, string[]>()
  childrenSetById.forEach((set, id) => {
    const arr = Array.from(set)
    arr.sort((a, b) => a.localeCompare(b))
    childrenById.set(id, arr)
  })

  const depthById = new Map<string, number>()
  const depthVisiting = new Set<string>()
  const resolveDepth = (id: string): number => {
    const cached = depthById.get(id)
    if (cached != null) return cached
    if (depthVisiting.has(id)) {
      depthById.set(id, 0)
      parentIdById.set(id, null)
      return 0
    }
    depthVisiting.add(id)
    const parentId = parentIdById.get(id) || null
    const depth = parentId ? resolveDepth(parentId) + 1 : 0
    depthVisiting.delete(id)
    depthById.set(id, depth)
    return depth
  }
  parentIdById.forEach((_parent, id) => {
    resolveDepth(id)
  })

  const descendantMemberNodeIdsById = new Map<string, string[]>()
  const membersVisiting = new Set<string>()
  const resolveDescendants = (id: string): string[] => {
    const cached = descendantMemberNodeIdsById.get(id)
    if (cached) return cached
    if (membersVisiting.has(id)) return ownMembersById.get(id) || []
    membersVisiting.add(id)
    const out = new Set<string>(ownMembersById.get(id) || [])
    const children = childrenById.get(id) || []
    for (let i = 0; i < children.length; i += 1) {
      const childId = children[i]
      const childMembers = resolveDescendants(childId)
      for (let j = 0; j < childMembers.length; j += 1) out.add(childMembers[j])
    }
    membersVisiting.delete(id)
    const finalized = Array.from(out)
    finalized.sort((a, b) => a.localeCompare(b))
    descendantMemberNodeIdsById.set(id, finalized)
    return finalized
  }
  parentIdById.forEach((_parent, id) => {
    resolveDescendants(id)
  })

  return { parentIdById, childrenById, depthById, descendantMemberNodeIdsById }
}

