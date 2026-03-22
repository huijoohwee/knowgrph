import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { defaultSchema } from '@/lib/graph/schema'
import { initializeGraphLayout } from '@/components/GraphCanvas/layout/initialization'

export const testInitializeGraphLayoutPartialPositionsDoesNotReseedAll = () => {
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

  const nodes: GraphNode[] = []
  for (let i = 0; i < 10; i += 1) {
    nodes.push({ id: `n${i}`, label: `n${i}`, type: 'Entity', x: 0, y: 0, vx: 0, vy: 0, properties: {} })
  }
  const edges: GraphEdge[] = []

  const layoutPositions: Record<string, { x: number; y: number }> = {
    n0: { x: 1000, y: 1000 },
    n1: { x: 1100, y: 1100 },
    n2: { x: 1200, y: 1200 },
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

  for (const [id, p] of Object.entries(layoutPositions)) {
    const n = nodes.find(x => String(x.id) === id)
    if (!n) throw new Error(`Missing node ${id}`)
    if (n.x !== p.x || n.y !== p.y) {
      throw new Error(`Expected node ${id} to keep provided position (${p.x},${p.y}) but got (${n.x},${n.y})`)
    }
  }
}
