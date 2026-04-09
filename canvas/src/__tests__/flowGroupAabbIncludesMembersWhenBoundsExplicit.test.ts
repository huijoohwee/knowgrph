import { computeFlowGroupAabb, type FlowNativeScene } from '@/components/FlowCanvas/nativeRuntime'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export function testFlowGroupAabbPrefersExplicitBoundsWhenBoundsExist() {
  const nodeById = new Map([
    ['A', { id: 'A', x: 100, y: 100, width: 50, height: 20 }],
    ['B', { id: 'B', x: 200, y: 140, width: 80, height: 40 }],
  ])

  const scene: FlowNativeScene = {
    nodes: Array.from(nodeById.values()) as any,
    edges: [] as any,
    nodeById: nodeById as any,
    groups: [] as any,
    groupIdsByNodeId: new Map(),
  }

  const group: GraphGroup = {
    id: 'subgraph:test',
    label: 'Test',
    source: 'userSubgraph',
    depth: 0,
    memberNodeIds: ['A', 'B'],
    style: {},
    bounds: { x: 0, y: 0, width: 10, height: 10 },
  }

  const aabb = computeFlowGroupAabb({ scene, group, paddingPx: 10, labelTopExtraPx: 0 })
  if (!aabb) throw new Error('expected group aabb')

  if (aabb.minX !== 0 || aabb.minY !== 0 || aabb.maxX !== 10 || aabb.maxY !== 10) {
    throw new Error('expected explicit group bounds to remain stable and not auto-expand to member nodes')
  }
}
