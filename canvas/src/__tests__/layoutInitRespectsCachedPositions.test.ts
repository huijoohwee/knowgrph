import { initializeGraphLayout } from '@/components/GraphCanvas/layout/initialization'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphNode } from '@/lib/graph/types'

export const testLayoutInitRespectsStableCachedPositions = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 100, y: 100, properties: {} },
    { id: 'b', label: 'b', type: 'T', x: 220, y: 140, properties: {} },
  ]
  const before = nodes.map(n => ({ id: String(n.id), x: n.x as number, y: n.y as number }))

  initializeGraphLayout({
    nodes,
    edges: [],
    width: 800,
    height: 600,
    schema: defaultSchema,
    seedCenter: { x: 400, y: 300 },
    layoutPositions: {
      a: { x: 100, y: 100 },
      b: { x: 220, y: 140 },
    },
  })

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const b = before[i]!
    if ((n.x as number) !== b.x || (n.y as number) !== b.y) {
      throw new Error(`expected cached position for ${b.id} to remain unchanged`)
    }
  }
}

export const testLayoutInitSeedsOnlyMissingPositionsWhenStable = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
    { id: 'b', label: 'b', type: 'T', properties: {} },
  ]
  initializeGraphLayout({
    nodes,
    edges: [],
    width: 800,
    height: 600,
    schema: defaultSchema,
    seedCenter: { x: 400, y: 300 },
    layoutPositions: {
      a: { x: 10, y: 20 },
    },
  })

  const a = nodes[0]!
  const b = nodes[1]!
  if ((a.x as number) !== 10 || (a.y as number) !== 20) {
    throw new Error('expected existing node position to remain unchanged')
  }
  const bx = (b as unknown as { x?: unknown }).x
  const by = (b as unknown as { y?: unknown }).y
  if (!(typeof bx === 'number' && Number.isFinite(bx) && typeof by === 'number' && Number.isFinite(by))) {
    throw new Error('expected missing node to be seeded with finite x/y')
  }
}
