import { defaultSchema } from '@/lib/graph/schema'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { createComponentBboxCollideForce } from '@/components/GraphCanvas/layout/componentOverlap'

export function testComponentBboxCollideForceSeparatesComponents() {
  const schema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      mode: 'force' as const,
    },
  }

  const nodes: GraphNode[] = [
    { id: 'a1', label: 'a1', type: 'Entity', x: 0, y: 0, properties: {} },
    { id: 'a2', label: 'a2', type: 'Entity', x: 0, y: 0, properties: {} },
    { id: 'b1', label: 'b1', type: 'Entity', x: 0, y: 0, properties: {} },
    { id: 'b2', label: 'b2', type: 'Entity', x: 0, y: 0, properties: {} },
  ]
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'a1', target: 'a2', label: 'rel', properties: {} },
    { id: 'e2', source: 'b1', target: 'b2', label: 'rel', properties: {} },
  ]

  const force = createComponentBboxCollideForce({
    schema,
    edges,
    paddingX: 60,
    paddingY: 60,
    touchEpsilonPx: 2,
    strength: 0.8,
    iterations: 1,
  })
  force.initialize?.(nodes, () => 0.42)
  force(1)

  const meanV = (prefix: string): { x: number; y: number } => {
    let sx = 0
    let sy = 0
    let c = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (!String(n.id).startsWith(prefix)) continue
      sx += n.vx || 0
      sy += n.vy || 0
      c += 1
    }
    return c > 0 ? { x: sx / c, y: sy / c } : { x: 0, y: 0 }
  }

  const aV = meanV('a')
  const bV = meanV('b')
  const dv = Math.hypot(aV.x - bV.x, aV.y - bV.y)
  if (!(dv > 1e-6)) throw new Error('expected components to receive different impulses')

  const centroid = (prefix: string): { x: number; y: number } => {
    let sx = 0
    let sy = 0
    let c = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (!String(n.id).startsWith(prefix)) continue
      sx += n.x || 0
      sy += n.y || 0
      c += 1
    }
    return c > 0 ? { x: sx / c, y: sy / c } : { x: 0, y: 0 }
  }

  const a0 = centroid('a')
  const b0 = centroid('b')
  const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y)
  for (let i = 0; i < nodes.length; i += 1) {
    nodes[i].x = (nodes[i].x || 0) + (nodes[i].vx || 0)
    nodes[i].y = (nodes[i].y || 0) + (nodes[i].vy || 0)
  }
  const a1 = centroid('a')
  const b1 = centroid('b')
  const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y)
  if (!(d1 > d0)) throw new Error('expected components to move farther apart')
}
