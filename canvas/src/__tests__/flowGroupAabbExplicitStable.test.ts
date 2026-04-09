import type { FlowNativeScene } from '@/components/FlowCanvas/nativeRuntime'
import { computeFlowGroupAabb } from '@/components/FlowCanvas/nativeRuntime'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export const testFlowGroupAabbExplicitDoesNotExpandWhenMembersInside = () => {
  const nodeById = new Map<string, any>()
  nodeById.set('n1', { id: 'n1', x: 20, y: 20, width: 100, height: 40 })
  nodeById.set('n2', { id: 'n2', x: 200, y: 20, width: 100, height: 40 })
  const scene: FlowNativeScene = {
    nodes: [nodeById.get('n1')!, nodeById.get('n2')!],
    edges: [],
    nodeById,
    groups: [],
    groupIdsByNodeId: new Map(),
  } as any

  const g: GraphGroup = {
    id: 'subgraph:a',
    label: 'a',
    source: 'userSubgraph',
    depth: 0,
    memberNodeIds: ['n1', 'n2'],
    style: {},
    bounds: { x: 0, y: 0, width: 400, height: 120 },
  }
  const aabb = computeFlowGroupAabb({ scene, group: g, paddingPx: 24, labelTopExtraPx: 18 })
  if (!aabb) throw new Error('expected aabb')
  if (aabb.minX !== 0 || aabb.minY !== 0 || aabb.maxX !== 400 || aabb.maxY !== 120) {
    throw new Error('expected explicit bounds to be returned when members are inside')
  }
}

export const testFlowGroupAabbExplicitDoesNotExpandWhenMemberOutside = () => {
  const nodeById = new Map<string, any>()
  nodeById.set('n1', { id: 'n1', x: 20, y: 20, width: 100, height: 40 })
  nodeById.set('n2', { id: 'n2', x: 380, y: 20, width: 100, height: 40 })
  const scene: FlowNativeScene = {
    nodes: [nodeById.get('n1')!, nodeById.get('n2')!],
    edges: [],
    nodeById,
    groups: [],
    groupIdsByNodeId: new Map(),
  } as any

  const g: GraphGroup = {
    id: 'subgraph:a',
    label: 'a',
    source: 'userSubgraph',
    depth: 0,
    memberNodeIds: ['n1', 'n2'],
    style: {},
    bounds: { x: 0, y: 0, width: 400, height: 120 },
  }
  const aabb = computeFlowGroupAabb({ scene, group: g, paddingPx: 24, labelTopExtraPx: 18 })
  if (!aabb) throw new Error('expected aabb')
  if (aabb.minX !== 0 || aabb.minY !== 0 || aabb.maxX !== 400 || aabb.maxY !== 120) {
    throw new Error('expected explicit bounds to remain stable when member node exceeds explicit bounds')
  }
}
