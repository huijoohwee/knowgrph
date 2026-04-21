import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import type { GraphData } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export const testFlowGroupsOrderParentsBeforeChildren = () => {
  const graphData: GraphData = {
    nodes: [
      { id: 'n1', label: 'n1', type: 'Entity', properties: {} },
      { id: 'n2', label: 'n2', type: 'Entity', properties: {} },
    ],
    edges: [],
    metadata: {},
  } as GraphData

  const parent: GraphGroup = {
    id: 'subgraph:p',
    label: 'p',
    source: 'userSubgraph',
    depth: 0,
    memberNodeIds: ['n1', 'n2'],
    style: {},
  }
  const child: GraphGroup = {
    id: 'subgraph:c',
    label: 'c',
    source: 'userSubgraph',
    depth: 0,
    memberNodeIds: ['n2'],
    parentGroupId: 'subgraph:p',
    style: {},
  }

  const runtime = { rankdir: 'LR', scene: null, dirty: false } as unknown as {
    rankdir: 'TB' | 'LR'
    scene: { groups?: Array<{ id: string }> } | null
    dirty: boolean
  }

  buildAndSetFlowNativeScene({
    runtime: runtime as never,
    graphData,
    positions: { n1: { x: 0, y: 0 }, n2: { x: 200, y: 0 } },
    schema: null,
    forbidCircleNodes: false,
    flowConfig: readFlowConfig({ schema: null, rankdir: 'LR' }),
    sceneGroups: [child, parent],
    rankdir: 'LR',
    widgetRegistry: null,
  })

  const groups = runtime.scene?.groups || []
  const pIdx = groups.findIndex(g => g.id === 'subgraph:p')
  const cIdx = groups.findIndex(g => g.id === 'subgraph:c')
  if (!(pIdx >= 0 && cIdx >= 0 && pIdx < cIdx)) throw new Error('expected parent group to appear before child group')

  const siblingA: GraphGroup = { id: 'subgraph:a', label: 'a', source: 'userSubgraph', depth: 0, memberNodeIds: ['n1', 'n2', 'n1', 'n2'], style: {} }
  const siblingB: GraphGroup = { id: 'subgraph:b', label: 'b', source: 'userSubgraph', depth: 0, memberNodeIds: ['n2'], style: {} }
  const runtime2 = { rankdir: 'LR', scene: null, dirty: false } as unknown as {
    rankdir: 'TB' | 'LR'
    scene: { groups?: Array<{ id: string }> } | null
    dirty: boolean
  }
  buildAndSetFlowNativeScene({
    runtime: runtime2 as never,
    graphData,
    positions: { n1: { x: 0, y: 0 }, n2: { x: 200, y: 0 } },
    schema: null,
    forbidCircleNodes: false,
    flowConfig: readFlowConfig({ schema: null, rankdir: 'LR' }),
    sceneGroups: [siblingB, siblingA],
    rankdir: 'LR',
    widgetRegistry: null,
  })
  const groups2 = runtime2.scene?.groups || []
  const aIdx = groups2.findIndex(g => g.id === 'subgraph:a')
  const bIdx = groups2.findIndex(g => g.id === 'subgraph:b')
  if (!(aIdx >= 0 && bIdx >= 0 && aIdx < bIdx)) throw new Error('expected larger sibling group to be drawn before smaller sibling')
}
