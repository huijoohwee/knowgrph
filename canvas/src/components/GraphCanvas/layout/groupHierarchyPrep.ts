import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export type PreparedGroupHierarchy = {
  groupById: Map<string, GraphGroup>
  childrenByGroupId: Map<string, string[]>
  memberSetByGroupId: Map<string, Set<string>>
  directMembersByGroupId: Map<string, string[]>
  topLevelGroupIds: string[]
}

export function prepareGroupHierarchy(args: {
  groups: GraphGroup[]
  isValidMemberNodeId: (nodeId: string) => boolean
}): PreparedGroupHierarchy {
  const groups = Array.isArray(args.groups) ? args.groups : []
  const groupById = new Map<string, GraphGroup>()
  for (let i = 0; i < groups.length; i += 1) {
    const id = String(groups[i]?.id || '').trim()
    if (id) groupById.set(id, groups[i]!)
  }

  const childrenByGroupId = new Map<string, string[]>()
  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i]!
    const groupId = String(group.id || '').trim()
    const parentGroupId = typeof group.parentGroupId === 'string' ? group.parentGroupId.trim() : ''
    if (!groupId || !parentGroupId || !groupById.has(parentGroupId)) continue
    const current = childrenByGroupId.get(parentGroupId)
    if (current) current.push(groupId)
    else childrenByGroupId.set(parentGroupId, [groupId])
  }
  childrenByGroupId.forEach((childGroupIds, groupId) => {
    childGroupIds.sort((a, b) => a.localeCompare(b))
    childrenByGroupId.set(groupId, childGroupIds)
  })

  const memberSetByGroupId = new Map<string, Set<string>>()
  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i]!
    const groupId = String(group.id || '').trim()
    if (!groupId) continue
    const memberSet = new Set<string>()
    const memberNodeIds = Array.isArray(group.memberNodeIds) ? group.memberNodeIds : []
    for (let j = 0; j < memberNodeIds.length; j += 1) {
      const nodeId = String(memberNodeIds[j] || '').trim()
      if (nodeId && args.isValidMemberNodeId(nodeId)) memberSet.add(nodeId)
    }
    memberSetByGroupId.set(groupId, memberSet)
  }

  const directMembersByGroupId = new Map<string, string[]>()
  for (let i = 0; i < groups.length; i += 1) {
    const groupId = String(groups[i]?.id || '').trim()
    if (!groupId) continue
    const directMembers = new Set(memberSetByGroupId.get(groupId) || [])
    const childGroupIds = childrenByGroupId.get(groupId) || []
    for (let c = 0; c < childGroupIds.length; c += 1) {
      const childMembers = memberSetByGroupId.get(childGroupIds[c]!)
      if (!childMembers) continue
      childMembers.forEach(nodeId => directMembers.delete(nodeId))
    }
    directMembersByGroupId.set(groupId, Array.from(directMembers).sort((a, b) => a.localeCompare(b)))
  }

  const topLevelGroupIds = groups
    .filter(group => {
      const groupId = String(group.id || '').trim()
      const parentGroupId = typeof group.parentGroupId === 'string' ? group.parentGroupId.trim() : ''
      return Boolean(groupId) && !parentGroupId
    })
    .map(group => String(group.id || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  return {
    groupById,
    childrenByGroupId,
    memberSetByGroupId,
    directMembersByGroupId,
    topLevelGroupIds,
  }
}
