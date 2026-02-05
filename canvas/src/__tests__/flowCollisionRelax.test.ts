import { defaultSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { relaxFlowPositionsWithCollision } from '@/components/FlowCanvas/relaxPositions'

export function testFlowCollisionRelaxSeparatesOverlappingNodes() {
  const graphData: GraphData = {
    type: 'graph',
    metadata: {},
    nodes: [
      { id: 'a', type: 'Entity', label: 'a', properties: {} },
      { id: 'b', type: 'Entity', label: 'b', properties: {} },
    ],
    edges: [],
  }

  const positions = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }
  const next = relaxFlowPositionsWithCollision({
    graphData,
    positions,
    schema: defaultSchema,
    nodeSize: { widthPx: 180, heightPx: 48 },
    portHandles: { enabled: false, sizePx: 0, offsetPx: 0 },
    defaultSteps: 16,
  })
  if (!next) throw new Error('expected relaxed positions')
  const ax = next.a?.x
  const ay = next.a?.y
  const bx = next.b?.x
  const by = next.b?.y
  if (ax == null || ay == null || bx == null || by == null) throw new Error('missing relaxed positions')
  if (Math.abs(ax - bx) < 0.01 && Math.abs(ay - by) < 0.01) {
    throw new Error('expected overlapping nodes to separate')
  }
}

export function testFlowCollisionRelaxSeparatesTouchingNodes() {
  const graphData: GraphData = {
    type: 'graph',
    metadata: {},
    nodes: [
      { id: 'a', type: 'Entity', label: 'a', properties: {} },
      { id: 'b', type: 'Entity', label: 'b', properties: {} },
    ],
    edges: [],
  }

  const initialDx = 208
  const positions = { a: { x: 0, y: 0 }, b: { x: initialDx, y: 0 } }
  const next = relaxFlowPositionsWithCollision({
    graphData,
    positions,
    schema: defaultSchema,
    nodeSize: { widthPx: 180, heightPx: 48 },
    portHandles: { enabled: false, sizePx: 0, offsetPx: 0 },
    defaultSteps: 12,
  })
  if (!next) throw new Error('expected relaxed positions')
  const ax = next.a?.x
  const ay = next.a?.y
  const bx = next.b?.x
  const by = next.b?.y
  if (ax == null || ay == null || bx == null || by == null) throw new Error('missing relaxed positions')
  const dx0 = initialDx
  const dy0 = 0
  const d0 = Math.hypot(dx0, dy0)
  const d1 = Math.hypot(bx - ax, by - ay)
  if (d1 <= d0 + 0.25) {
    throw new Error('expected touching nodes to separate by a positive gap')
  }
}
