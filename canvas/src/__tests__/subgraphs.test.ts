import type { GraphData } from '@/lib/graph/types'
import { createSubgraph, updateSubgraph } from '@/lib/graph/subgraphs'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { filterGroupsByCollapsedAncestors } from '@/lib/graph/groupVisibility'

export const testDeriveGraphGroupsIncludesUserSubgraphs = () => {
  const base: GraphData = {
    type: 'Graph',
    context: '',
    nodes: [
      { id: 'a', label: 'A', type: 'entity', properties: {} },
      { id: 'b', label: 'B', type: 'entity', properties: {} },
      { id: 'c', label: 'C', type: 'entity', properties: {} },
    ],
    edges: [],
    metadata: {},
  }
  const { subgraph, graphData } = createSubgraph(base, { nodeIds: ['a', 'b'], label: 'Group 1' })
  const groups = deriveGraphGroups(graphData)
  const hit = groups.find(g => g.id === `subgraph:${subgraph.id}`)
  if (!hit) throw new Error('missing derived subgraph group')
  if (hit.label !== 'Group 1') throw new Error('subgraph label not mapped')
  if (!hit.memberNodeIds.includes('a') || !hit.memberNodeIds.includes('b')) throw new Error('subgraph members not mapped')
}

export const testDeriveGraphGroupsComputesNestedDepthFromParentId = () => {
  const base: GraphData = {
    type: 'Graph',
    context: '',
    nodes: [
      { id: 'a', label: 'A', type: 'entity', properties: {} },
      { id: 'b', label: 'B', type: 'entity', properties: {} },
      { id: 'c', label: 'C', type: 'entity', properties: {} },
    ],
    edges: [],
    metadata: {},
  }
  const created1 = createSubgraph(base, { nodeIds: ['a'], label: 'Parent' })
  const created2 = createSubgraph(created1.graphData, { nodeIds: ['b'], label: 'Child' })
  const graphData = updateSubgraph(created2.graphData, created2.subgraph.id, { parentId: created1.subgraph.id })
  const groups = deriveGraphGroups(graphData)
  const parent = groups.find(g => g.id === `subgraph:${created1.subgraph.id}`)
  const child = groups.find(g => g.id === `subgraph:${created2.subgraph.id}`)
  if (!parent || !child) throw new Error('missing parent/child groups')
  if (parent.depth !== 0) throw new Error('parent depth should be 0')
  if (child.depth !== 1) throw new Error('child depth should be 1')
}

export const testDeriveGraphGroupsNestedParentIncludesDescendantMembers = () => {
  const base: GraphData = {
    type: 'Graph',
    context: '',
    nodes: [
      { id: 'a', label: 'A', type: 'entity', properties: {} },
      { id: 'b', label: 'B', type: 'entity', properties: {} },
      { id: 'c', label: 'C', type: 'entity', properties: {} },
    ],
    edges: [],
    metadata: {},
  }
  const created1 = createSubgraph(base, { nodeIds: ['a'], label: 'Parent' })
  const created2 = createSubgraph(created1.graphData, { nodeIds: ['b'], label: 'Child' })
  const graphData = updateSubgraph(created2.graphData, created2.subgraph.id, { parentId: created1.subgraph.id })
  const groups = deriveGraphGroups(graphData)
  const parent = groups.find(g => g.id === `subgraph:${created1.subgraph.id}`)
  if (!parent) throw new Error('missing parent group')
  if (!parent.memberNodeIds.includes('a')) throw new Error('parent should include own members')
  if (!parent.memberNodeIds.includes('b')) throw new Error('parent should include descendant members')
}

export const testFilterGroupsByCollapsedAncestorsHidesDescendants = () => {
  const groups: GraphGroup[] = [
    { id: 'subgraph:parent', label: 'Parent', source: 'userSubgraph', depth: 0, memberNodeIds: ['a', 'b'], style: {} },
    { id: 'subgraph:child', label: 'Child', source: 'userSubgraph', depth: 1, memberNodeIds: ['b'], parentGroupId: 'subgraph:parent', style: {} },
    { id: 'layer:0', label: 'Layer', source: 'layer', depth: 0, memberNodeIds: ['a'], style: {} },
  ]
  const collapsedSet = new Set<string>(['subgraph:parent'])
  const filtered = filterGroupsByCollapsedAncestors({ groups, collapsedGroupIdSet: collapsedSet })
  const ids = filtered.map(g => g.id).sort((a, b) => a.localeCompare(b))
  const expected = ['layer:0', 'subgraph:parent'].sort((a, b) => a.localeCompare(b))
  if (ids.join('|') !== expected.join('|')) throw new Error(`unexpected filtered ids: ${ids.join(',')}`)
}
