import type { FlowNativeRuntime, FlowNativeScene } from '@/components/FlowCanvas/nativeRuntime'
import { computeFlowDeltaClampForNodes, computeFlowNodeClamp } from '@/components/FlowCanvas/groupContainment'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

const makeRuntime = (scene: FlowNativeScene): FlowNativeRuntime => {
  return {
    viewportW: 1000,
    viewportH: 800,
    dpr: 1,
    transform: ({} as any),
    rankdir: 'TB',
    scene,
    rafTick: null,
    rafTickIntervalMs: 0,
    presentation: {
      groups: {
        enabled: true,
        paddingPx: 10,
        labelTopExtraPx: 0,
      },
    } as any,
    pendingRaf: null,
    dirty: false,
    idSetCache: {
      selectedNodeIdsRef: null,
      selectedNodeIds: new Set<string>(),
      selectedEdgeIdsRef: null,
      selectedEdgeIds: new Set<string>(),
      hideNodeIdsRef: null,
      hideNodeIds: new Set<string>(),
      hidePortHandleNodeIdsRef: null,
      hidePortHandleNodeIds: new Set<string>(),
    },
    groupAabbByIdCache: new Map(),
  } as unknown as FlowNativeRuntime
}

export const testFlowContainmentMultiGroupSelectionDoesNotClamp = () => {
  const groupA: GraphGroup = { id: 'subgraph:a', label: 'a', source: 'userSubgraph', depth: 0, memberNodeIds: ['n1'], style: {} }
  const groupB: GraphGroup = { id: 'subgraph:b', label: 'b', source: 'userSubgraph', depth: 0, memberNodeIds: ['n2'], style: {} }

  const nodeById = new Map<string, any>()
  nodeById.set('n1', { id: 'n1', x: 0, y: 0, width: 100, height: 40 })
  nodeById.set('n2', { id: 'n2', x: 400, y: 0, width: 100, height: 40 })

  const scene: FlowNativeScene = {
    nodes: [nodeById.get('n1')!, nodeById.get('n2')!],
    edges: [],
    groups: [groupA, groupB],
    nodeById,
    edgeById: new Map(),
    groupById: new Map([
      ['subgraph:a', groupA],
      ['subgraph:b', groupB],
    ]),
    groupIdsByNodeId: new Map([
      ['n1', ['subgraph:a']],
      ['n2', ['subgraph:b']],
    ]),
    nodeRenderTypeById: new Map(),
  } as any

  const rt = makeRuntime(scene)
  const startPosById = new Map([
    ['n1', { x: 0, y: 0 }],
    ['n2', { x: 400, y: 0 }],
  ])
  const clamp = computeFlowDeltaClampForNodes({ runtime: rt, nodeIds: ['n1', 'n2'], startPosById })
  if (clamp) throw new Error('expected no clamp when selection spans multiple containment groups')
}

export const testFlowContainmentSingleGroupSelectionClamps = () => {
  const groupA: GraphGroup = { id: 'subgraph:a', label: 'a', source: 'userSubgraph', depth: 0, memberNodeIds: ['n1', 'n2'], style: {} }
  const nodeById = new Map<string, any>()
  nodeById.set('n1', { id: 'n1', x: 0, y: 0, width: 100, height: 40 })
  nodeById.set('n2', { id: 'n2', x: 200, y: 0, width: 100, height: 40 })
  const scene: FlowNativeScene = {
    nodes: [nodeById.get('n1')!, nodeById.get('n2')!],
    edges: [],
    groups: [groupA],
    nodeById,
    edgeById: new Map(),
    groupById: new Map([['subgraph:a', groupA]]),
    groupIdsByNodeId: new Map([
      ['n1', ['subgraph:a']],
      ['n2', ['subgraph:a']],
    ]),
    nodeRenderTypeById: new Map(),
  } as any
  const rt = makeRuntime(scene)
  const startPosById = new Map([
    ['n1', { x: 0, y: 0 }],
    ['n2', { x: 200, y: 0 }],
  ])
  const clamp = computeFlowDeltaClampForNodes({ runtime: rt, nodeIds: ['n1', 'n2'], startPosById })
  if (!clamp) throw new Error('expected clamp when selection is in same containment group')
}

export const testFlowContainmentSingleNodeClampUsesInnerInset = () => {
  const groupA: GraphGroup = { id: 'subgraph:a', label: 'a', source: 'userSubgraph', depth: 0, memberNodeIds: ['n1', 'n2'], style: {} }
  const nodeById = new Map<string, any>()
  nodeById.set('n1', { id: 'n1', x: 20, y: 20, width: 100, height: 40 })
  nodeById.set('n2', { id: 'n2', x: 220, y: 20, width: 100, height: 40 })
  const scene: FlowNativeScene = {
    nodes: [nodeById.get('n1')!, nodeById.get('n2')!],
    edges: [],
    groups: [groupA],
    nodeById,
    edgeById: new Map(),
    groupById: new Map([['subgraph:a', groupA]]),
    groupIdsByNodeId: new Map([
      ['n1', ['subgraph:a']],
      ['n2', ['subgraph:a']],
    ]),
    nodeRenderTypeById: new Map(),
  } as any
  const rt = makeRuntime(scene)
  const clamp = computeFlowNodeClamp({ runtime: rt, nodeId: 'n1' })
  if (!clamp) throw new Error('expected clamp for single node in containment group')
  if (!(clamp.minX > 0 && clamp.minY > 0)) throw new Error('expected containment clamp to keep a non-zero inner inset')
}
