import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { defaultSchema } from '@/lib/graph/schema'
import { initializeGraphLayout } from '@/components/GraphCanvas/layout/initialization'

export const testInitializeGraphLayoutHonorsProvidedLayoutPositions = () => {
  const schema: GraphSchema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      mode: 'force',
      forces: {
        ...(defaultSchema.layout?.forces || {}),
        disjointComponents: false,
      },
    },
  }

  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'Entity', x: 0, y: 0, vx: 0, vy: 0, properties: {} },
    { id: 'b', label: 'b', type: 'Entity', x: 0, y: 0, vx: 0, vy: 0, properties: {} },
    { id: 'c', label: 'c', type: 'Entity', x: 0, y: 0, vx: 0, vy: 0, properties: {} },
    { id: 'd', label: 'd', type: 'Entity', x: 0, y: 0, vx: 0, vy: 0, properties: {} },
    { id: 'e', label: 'e', type: 'Entity', x: 0, y: 0, vx: 0, vy: 0, properties: {} },
  ]
  const edges: GraphEdge[] = []

  const layoutPositions: Record<string, { x: number; y: number }> = {
    a: { x: 100000, y: -100000 },
    b: { x: 100100, y: -100100 },
    c: { x: 100200, y: -100200 },
    d: { x: 100300, y: -100300 },
  }

  initializeGraphLayout({
    nodes,
    edges,
    width: 800,
    height: 600,
    schema,
    seedCenter: null,
    groupKeyOf: () => null,
    layoutPositions,
  })

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const id = String(n.id)
    const expected = layoutPositions[id]
    if (!expected) continue
    if (n.x !== expected.x || n.y !== expected.y) {
      throw new Error(`Expected node ${id} to keep provided position (${expected.x},${expected.y}) but got (${n.x},${n.y})`)
    }
  }
}
