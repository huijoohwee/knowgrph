import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GroupKeyOfNode } from '@/components/GraphCanvas/layout/grouping'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'

type GroupKind = 'mermaid' | 'markdown' | 'keywordLayer' | 'community' | 'other'

const classifyGroupId = (id: string): GroupKind => {
  if (!id) return 'other'
  if (id.startsWith('md:')) return 'markdown'
  if (id.startsWith('keyword-layer:')) return 'keywordLayer'
  if (id.startsWith('community:')) return 'community'
  return 'mermaid'
}

export function createLayoutGroupKeyOfNode(args: { graphData: GraphData; schema: GraphSchema }): GroupKeyOfNode {
  const { graphData, schema } = args
  const groupsEnabled = schema.layout?.groups?.enabled !== false
  if (!groupsEnabled) return () => null

  const groups = deriveGraphGroups(graphData)
  if (!groups.length) return () => null

  const priority: GroupKind[] = ['mermaid', 'markdown', 'keywordLayer', 'community', 'other']
  const nodeIdSet = new Set<string>()
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id || '').trim()
    if (!id) continue
    nodeIdSet.add(id)
  }

  const byKind = new Map<GroupKind, typeof groups>()
  for (const g of groups) {
    const kind = classifyGroupId(String(g.id || ''))
    const arr = byKind.get(kind) || []
    arr.push(g)
    byKind.set(kind, arr)
  }

  const nodeToGroupId = new Map<string, string>()

  for (const kind of priority) {
    const arr = byKind.get(kind)
    if (!arr || arr.length === 0) continue

    for (let i = 0; i < arr.length; i += 1) {
      const g = arr[i]
      if ((kind === 'mermaid' || kind === 'markdown' || kind === 'community') && g.depth !== 0) continue
      const gid = String(g.id || '').trim()
      if (!gid) continue
      const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
      for (let j = 0; j < members.length; j += 1) {
        const nid = String(members[j] || '').trim()
        if (!nid || !nodeIdSet.has(nid)) continue
        if (nodeToGroupId.has(nid)) continue
        nodeToGroupId.set(nid, gid)
      }
    }

    if (nodeToGroupId.size > 0) break
  }

  const groupKeyOf: GroupKeyOfNode = (n: GraphNode): string | null => {
    const id = String(n.id || '').trim()
    if (!id) return null
    return nodeToGroupId.get(id) || null
  }

  return groupKeyOf
}
