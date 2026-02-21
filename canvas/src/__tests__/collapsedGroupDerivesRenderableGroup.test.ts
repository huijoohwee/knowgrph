import type { GraphData } from '@/lib/graph/types'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { collapsedGroupNodeIdFor, deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'

export function testDeriveGraphGroupsKeepsCollapsedGroupRenderable() {
  const groupId = 'community:1'
  const base: GraphData = {
    type: 'Graph',
    context: 't',
    metadata: { kind: 'doc', source: 't' },
    nodes: [
      { id: 'n1', type: 'Node', label: 'N1', properties: { 'visual:community': '1' } },
      { id: 'n2', type: 'Node', label: 'N2', properties: { 'visual:community': '1' } },
    ],
    edges: [],
  }

  const before = deriveGraphGroups(base)
  if (!before.some(g => String(g.id) === groupId)) throw new Error('expected base graph to derive community group')

  const collapsed = deriveGraphDataWithGroupCollapse({ graphData: base, collapsedGroupIds: [groupId] })
  const collapsedNodeId = collapsedGroupNodeIdFor(groupId)
  const hasCollapsedNode = (collapsed.nodes || []).some(n => String((n as { id?: unknown }).id) === collapsedNodeId)
  if (!hasCollapsedNode) throw new Error('expected collapsed graph to include collapsed group node')

  const after = deriveGraphGroups(collapsed)
  const group = after.find(g => String(g.id) === groupId) || null
  if (!group) throw new Error('expected collapsed graph to still derive a renderable group entry')
  const members = Array.isArray(group.memberNodeIds) ? group.memberNodeIds.map(x => String(x)) : []
  if (!members.includes(collapsedNodeId)) {
    throw new Error(`expected collapsed group members to include collapsed node id, got ${JSON.stringify({ members, collapsedNodeId })}`)
  }
}

