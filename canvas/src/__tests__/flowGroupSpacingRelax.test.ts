import { defaultSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { relaxFlowPositionsWithCollision } from '@/components/FlowCanvas/relaxPositions'

export function testFlowGroupRelaxAddsGapBetweenSingleNodeGroups() {
  const schema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      forces: {
        ...(defaultSchema.layout?.forces || {}),
        bboxCollide: false,
        groupBboxCollide: true,
      },
    },
  }

  const graphData: GraphData = {
    type: 'graph',
    metadata: {},
    nodes: [
      { id: 'a', type: 'Entity', label: 'a', properties: {} },
      { id: 'b', type: 'Entity', label: 'b', properties: {} },
    ],
    edges: [],
  }

  const groups = [
    { id: 'g1', label: 'g1', depth: 1, memberNodeIds: ['a'], style: {} },
    { id: 'g2', label: 'g2', depth: 1, memberNodeIds: ['b'], style: {} },
  ]

  const positions = { a: { x: 0, y: 0 }, b: { x: 180, y: 0 } }
  const next = relaxFlowPositionsWithCollision({
    graphData,
    groups,
    positions,
    schema: schema as unknown as typeof defaultSchema,
    nodeSize: { widthPx: 180, heightPx: 48 },
    portHandles: { enabled: false, sizePx: 0, offsetPx: 0 },
    defaultSteps: 16,
  })
  if (!next) throw new Error('expected relaxed positions')
  const ax = next.a?.x
  const bx = next.b?.x
  if (ax == null || bx == null) throw new Error('missing relaxed x positions')
  if (Math.abs(bx - ax) <= 220) throw new Error('expected group relax to add noticeable gap between groups')
}
