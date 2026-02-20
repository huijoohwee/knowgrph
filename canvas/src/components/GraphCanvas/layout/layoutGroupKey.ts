import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GroupKeyOfNode } from '@/components/GraphCanvas/layout/grouping'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

type GroupKind = 'mermaid' | 'markdown' | 'keywordLayer' | 'community' | 'other'

const classifyGroupId = (id: string): GroupKind => {
  if (!id) return 'other'
  if (id.startsWith('md:')) return 'markdown'
  if (id.startsWith('keyword-layer:')) return 'keywordLayer'
  if (id.startsWith('keyword-ner:')) return 'keywordLayer'
  if (id.startsWith('community:')) return 'community'
  return 'mermaid'
}

export function selectLayoutGroups(args: { graphData: GraphData; schema: GraphSchema; groups?: GraphGroup[] }): GraphGroup[] {
  const { graphData, schema } = args
  const groupsEnabled = schema.layout?.groups?.enabled !== false
  if (!groupsEnabled) return []

  const allGroups = args.groups ?? deriveGraphGroups(graphData)
  if (!allGroups.length) return []

  const byKind = new Map<GroupKind, GraphGroup[]>()
  for (const g of allGroups) {
    const kind = classifyGroupId(String(g.id || ''))
    const arr = byKind.get(kind) || []
    arr.push(g)
    byKind.set(kind, arr)
  }

  const meta = (graphData.metadata || {}) as Record<string, unknown>
  const isKeyword = typeof meta.kind === 'string' && meta.kind.trim().toLowerCase() === 'keyword'
  const priority: GroupKind[] = isKeyword
    ? ['community', 'keywordLayer', 'other', 'mermaid', 'markdown']
    : ['mermaid', 'markdown', 'keywordLayer', 'community', 'other']
  for (const kind of priority) {
    const arr = byKind.get(kind)
    if (arr && arr.length > 0) return arr
  }
  return []
}

export function createLayoutGroupKeyOfNode(args: { graphData: GraphData; schema: GraphSchema; groups?: GraphGroup[] }): GroupKeyOfNode {
  const { graphData, schema } = args
  const groupsEnabled = schema.layout?.groups?.enabled !== false
  if (!groupsEnabled) return () => null

  const groups = selectLayoutGroups(args)
  if (!groups.length) return () => null

  const nodeIdSet = new Set<string>()
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id || '').trim()
    if (!id) continue
    nodeIdSet.add(id)
  }

  const nodeToGroupId = new Map<string, string>()
  const nodeToGroupDepth = new Map<string, number>()

  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i]
    const gid = String(g.id || '').trim()
    if (!gid) continue
    const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
    for (let j = 0; j < members.length; j += 1) {
      const nid = String(members[j] || '').trim()
      if (!nid || !nodeIdSet.has(nid)) continue
      const depth = typeof g.depth === 'number' && Number.isFinite(g.depth) ? Math.max(0, Math.floor(g.depth)) : 0
      const prevDepth = nodeToGroupDepth.get(nid)
      if (prevDepth != null && prevDepth > depth) continue
      nodeToGroupId.set(nid, gid)
      nodeToGroupDepth.set(nid, depth)
    }
  }

  const groupKeyOf: GroupKeyOfNode = (n: GraphNode): string | null => {
    const id = String(n.id || '').trim()
    if (!id) return null
    return nodeToGroupId.get(id) || null
  }

  return groupKeyOf
}
