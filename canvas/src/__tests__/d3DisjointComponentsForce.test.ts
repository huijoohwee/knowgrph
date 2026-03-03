import { defaultSchema } from '@/lib/graph/schema'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { computeDisjointComponentTargets } from '@/components/GraphCanvas/layout/disjoint'
import { createDisjointComponentsForce } from '@/components/GraphCanvas/layout/disjointForce'

export function testD3DisjointComponentsForceSeparatesComponents() {
  const schema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      mode: 'force' as const,
      forces: {
        ...(defaultSchema.layout?.forces || {}),
        disjointComponents: true,
        disjointStrength: 0.4,
      },
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

  const disjointLayout = computeDisjointComponentTargets({ nodes, edges, width: 800, height: 600, schema, padding: 60 })
  if (!disjointLayout) throw new Error('expected disjoint layout for 2 components')

  const force = createDisjointComponentsForce({
    schema,
    disjointLayout,
    paddingPx: 60,
    strength: 0.4,
    alphaMin: 0,
    tickInterval: 1,
    maxPairwiseComponents: 10,
  })
  force.initialize?.(nodes, () => 0.42)
  force(1)

  const compA = disjointLayout.componentByNodeId.get('a1')
  const compB = disjointLayout.componentByNodeId.get('b1')
  if (compA == null || compB == null || compA === compB) throw new Error('expected different component ids')

  const sum = (comp: number) => {
    let sx = 0
    let sy = 0
    let c = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (disjointLayout.componentByNodeId.get(String(n.id)) !== comp) continue
      sx += n.vx || 0
      sy += n.vy || 0
      c += 1
    }
    return { sx, sy, c }
  }
  const a = sum(compA)
  const b = sum(compB)

  const aMag = Math.hypot(a.sx, a.sy)
  const bMag = Math.hypot(b.sx, b.sy)
  if (!(aMag > 0 && bMag > 0)) throw new Error('expected non-zero component impulses')

  const ax = a.c > 0 ? a.sx / a.c : 0
  const ay = a.c > 0 ? a.sy / a.c : 0
  const bx = b.c > 0 ? b.sx / b.c : 0
  const by = b.c > 0 ? b.sy / b.c : 0
  const dv = Math.hypot(ax - bx, ay - by)
  if (!(dv > 1e-6)) throw new Error('expected components to receive different impulses')

  const centroid = (comp: number) => {
    let sx = 0
    let sy = 0
    let c = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (disjointLayout.componentByNodeId.get(String(n.id)) !== comp) continue
      sx += n.x || 0
      sy += n.y || 0
      c += 1
    }
    return c > 0 ? { x: sx / c, y: sy / c } : { x: 0, y: 0 }
  }
  const a0 = centroid(compA)
  const b0 = centroid(compB)
  for (let i = 0; i < nodes.length; i += 1) {
    nodes[i].x = (nodes[i].x || 0) + (nodes[i].vx || 0)
    nodes[i].y = (nodes[i].y || 0) + (nodes[i].vy || 0)
  }
  const a1 = centroid(compA)
  const b1 = centroid(compB)
  const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y)
  const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y)
  if (!(d1 > d0)) throw new Error('expected components to move farther apart')
}
