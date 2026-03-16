import { computeFlowGroupAabb, type FlowNativeScene } from '@/components/FlowCanvas/nativeRuntime'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export function testFlowGroupAabbIncludesMembersWhenBoundsExplicit() {
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

  const mustContain = [
    { x: 100 - 10, y: 100 - 10 },
    { x: 100 + 50 + 10, y: 100 + 20 + 10 },
    { x: 200 - 10, y: 140 - 10 },
    { x: 200 + 80 + 10, y: 140 + 40 + 10 },
  ]
  for (let i = 0; i < mustContain.length; i += 1) {
    const p = mustContain[i]
    if (p.x < aabb.minX || p.x > aabb.maxX || p.y < aabb.minY || p.y > aabb.maxY) {
      throw new Error('expected group bounds to include all member node bounds')
    }
  }
}

