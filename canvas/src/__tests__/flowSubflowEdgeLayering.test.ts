import { buildAndSetFlowNativeScene } from '@/components/FlowCanvas/buildNativeScene'
import { readFlowConfig } from '@/components/FlowCanvas/config'
import type { GraphData } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export const testFlowSubflowLikeEdgesDrawAboveNodes = () => {
  const graphData: GraphData = {
    nodes: [
      { id: 'nA', label: 'A', type: 'Entity', properties: {} },
      { id: 'nB', label: 'B', type: 'Entity', properties: {} },
      { id: 'nC', label: 'C', type: 'Entity', properties: {} },
    ],
    edges: [
      { id: 'e-base', source: 'nA', target: 'nC', label: '', properties: {} },
      { id: 'e-child', source: 'nB', target: 'nC', label: '', properties: {} },
    ],
    metadata: {},
  } as GraphData

  const sceneGroups: GraphGroup[] = [
    {
      id: 'subgraph:1',
      label: 'G',
      source: 'userSubgraph',
      depth: 1,
      memberNodeIds: ['nB'],
      style: {},
    },
  ]

  const runtime = { rankdir: 'LR', scene: null, dirty: false } as unknown as {
    rankdir: 'TB' | 'LR'
    scene: {
      edges: Array<{ id: string; drawAboveNodes?: boolean }>
    } | null
    dirty: boolean
  }

  buildAndSetFlowNativeScene({
    runtime: runtime as never,
    graphData,
    positions: { nA: { x: 0, y: 0 }, nB: { x: 0, y: 80 }, nC: { x: 300, y: 40 } },
    schema: null,
    forbidCircleNodes: false,
    flowConfig: readFlowConfig({ schema: null, rankdir: 'LR' }),
    sceneGroups,
    rankdir: 'LR',
    widgetRegistry: null,
  })

  const edges = runtime.scene?.edges || []
  const childEdge = edges.find(e => e.id === 'e-child') || null
  const baseEdge = edges.find(e => e.id === 'e-base') || null
  if (!childEdge || !baseEdge) throw new Error('expected both edges in built scene')
  if (childEdge.drawAboveNodes !== true) throw new Error('expected child-connected edge to draw above nodes')
  if (baseEdge.drawAboveNodes === true) throw new Error('expected non-child edge to remain below nodes')
  const baseIndex = edges.findIndex(e => e.id === 'e-base')
  const childIndex = edges.findIndex(e => e.id === 'e-child')
  if (!(baseIndex >= 0 && childIndex >= 0 && childIndex > baseIndex)) {
    throw new Error('expected child-connected edge to be sorted after regular edges')
  }
}
