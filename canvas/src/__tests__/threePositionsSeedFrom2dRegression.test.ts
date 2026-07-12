import type { GraphNode } from '@/lib/graph/types'

import { computePositions3d } from '@/lib/three/positions.impl'

export const testThreePositionsSeedFrom2dUsesStableXy = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', properties: {} },
    { id: 'b', label: 'b', type: 'T', properties: {} },
  ]
  const seed2d = {
    a: { x: 123, y: -50 },
    b: { x: -10, y: 90 },
  }

  const out = computePositions3d(nodes, null, { seed2dPositions: seed2d })
  if (!out.a || !out.b) throw new Error('expected positions for all nodes')
  if (Math.abs(out.a[0] - 123) > 1e-9 || Math.abs(out.a[1] - -50) > 1e-9) {
    throw new Error('expected node a to use seeded 2D xy')
  }
  if (Math.abs(out.b[0] - -10) > 1e-9 || Math.abs(out.b[1] - 90) > 1e-9) {
    throw new Error('expected node b to use seeded 2D xy')
  }
}
