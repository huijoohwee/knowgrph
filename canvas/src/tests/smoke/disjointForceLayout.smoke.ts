import { createGroupKeyOfNode } from '@/components/GraphCanvas/layout/grouping'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function testEmbedsMediaIsContainmentForGrouping() {
  const nodes: GraphNode[] = [
    { id: 'sec', label: 'sec', type: 'Section', properties: { level: 1 }, x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'm1', label: 'm1', type: 'WebpageElement', properties: {}, x: 0, y: 0, vx: 0, vy: 0 },
  ]
  const edges: GraphEdge[] = [{ id: 'e1', label: 'embedsMedia', source: 'sec', target: 'm1', properties: {} }]
  const groupKeyOf = createGroupKeyOfNode({ nodes, edges })
  assert(groupKeyOf(nodes[1]!) === 'sec', 'expected embedsMedia to establish parent containment')

  for (let i = 0; i < 1000; i += 1) groupKeyOf(nodes[1]!)
}

function testNodeExtentsCacheInvalidatesOnSizeAndLabelChange() {
  const schema = defaultSchema
  const n: GraphNode = {
    id: 'n1',
    label: 'hello',
    type: 'Entity',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    properties: { 'visual:shape': 'rect', 'visual:width': 120, 'visual:height': 40 },
  }

  const e0 = getNodeAabbHalfExtentsWithLabel(n, schema)
  ;(n.properties as Record<string, unknown>)['visual:width'] = 260
  const e1 = getNodeAabbHalfExtentsWithLabel(n, schema)
  assert(e1.halfW > e0.halfW, 'expected extents to grow when visual:width increases')

  ;(n.properties as Record<string, unknown>)['visual:label'] = 'this is a much longer label than before'
  const e2 = getNodeAabbHalfExtentsWithLabel(n, schema)
  assert(e2.halfW >= e1.halfW, 'expected extents to account for label changes')
}

testEmbedsMediaIsContainmentForGrouping()
testNodeExtentsCacheInvalidatesOnSizeAndLabelChange()
