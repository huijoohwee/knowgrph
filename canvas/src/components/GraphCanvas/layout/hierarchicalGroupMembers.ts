export function buildHierarchyDepthResolver(
  parentById: ReadonlyMap<string, string | null | undefined>,
): (id: string) => number {
  const depthById = new Map<string, number>()
  const visiting = new Set<string>()

  const computeDepth = (id: string): number => {
    const key = String(id || '').trim()
    if (!key) return 0
    const cached = depthById.get(key)
    if (typeof cached === 'number') return cached
    if (visiting.has(key)) return 0
    visiting.add(key)
    const parentId = String(parentById.get(key) || '').trim()
    const depth = parentId ? computeDepth(parentId) + 1 : 0
    visiting.delete(key)
    depthById.set(key, depth)
    return depth
  }

  return computeDepth
}

export function buildHierarchicalLeafMemberCollector(args: {
  getChildIds: (id: string) => ReadonlyArray<string> | ReadonlySet<string> | null | undefined
  getDirectMemberIds: (id: string) => ReadonlyArray<string> | ReadonlySet<string> | null | undefined
}): (id: string) => string[] {
  const leafCache = new Map<string, string[]>()

  const collectLeafMembers = (id: string, stack: Set<string>): string[] => {
    const key = String(id || '').trim()
    if (!key) return []
    const cached = leafCache.get(key)
    if (cached) return cached
    if (stack.has(key)) return []
    stack.add(key)

    const out = new Set<string>()
    const directMemberIds = args.getDirectMemberIds(key)
    if (directMemberIds) {
      for (const directMemberId of directMemberIds) {
        const memberId = String(directMemberId || '').trim()
        if (memberId) out.add(memberId)
      }
    }

    const childIds = args.getChildIds(key)
    if (childIds) {
      for (const childId of childIds) {
        const childKey = String(childId || '').trim()
        if (!childKey) continue
        const childLeaves = collectLeafMembers(childKey, stack)
        for (let i = 0; i < childLeaves.length; i += 1) out.add(childLeaves[i]!)
      }
    }

    stack.delete(key)
    const finalized = Array.from(out).sort((a, b) => a.localeCompare(b))
    leafCache.set(key, finalized)
    return finalized
  }

  return (id: string) => collectLeafMembers(id, new Set())
}
