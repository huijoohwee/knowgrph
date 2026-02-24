import type { GraphData } from '@/lib/graph/types'
import { createSubgraph, updateSubgraph } from '@/lib/graph/subgraphs'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'

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

