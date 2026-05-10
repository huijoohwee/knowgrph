import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { defaultSchema } from '@/lib/graph/schema'
import { buildSimulation, updateForceSimulationPresentation } from '@/components/GraphCanvas/simulation'

const makeNode = (args: { id: string; xIndex: number; yIndex: number; zIndex: number }): GraphNode => {
  return {
    id: args.id,
    label: args.id,
    type: 'Entity',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    properties: {
      'visual:xIndex': args.xIndex,
      'visual:yIndex': args.yIndex,
      'visual:zIndex': args.zIndex,
    },
  }
}

export const testIndexAnchorForceSeparatesIndexedNodes = () => {
  const schema: GraphSchema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      mode: 'block',
      forces: {
        ...(defaultSchema.layout?.forces || {}),
        disjointComponents: false,
      },
    },
  }

  const nodes: GraphNode[] = [
    makeNode({ id: 'a', xIndex: 0, yIndex: 0, zIndex: 0 }),
    makeNode({ id: 'b', xIndex: 1, yIndex: 0, zIndex: 0 }),
    makeNode({ id: 'c', xIndex: 0, yIndex: 1, zIndex: 0 }),
    makeNode({ id: 'd', xIndex: 1, yIndex: 1, zIndex: 0 }),
    makeNode({ id: 'e', xIndex: 0, yIndex: 0, zIndex: 1 }),
    makeNode({ id: 'f', xIndex: 0, yIndex: 0, zIndex: 2 }),
  ]
  const edges: GraphEdge[] = []

  const sim = buildSimulation(nodes, edges, 1000, 800, schema, { skipInitialLayout: true })
  sim.stop()
  sim.alpha(1)
  sim.tick(240)

  const byId = new Map(nodes.map(n => [String(n.id), n]))
  const a = byId.get('a')!
  const b = byId.get('b')!
  const c = byId.get('c')!
  const d = byId.get('d')!

  if (!((b.x as number) > (a.x as number))) throw new Error('expected xIndex=1 node to be right of xIndex=0 node')
  if (!((d.x as number) > (c.x as number))) throw new Error('expected xIndex=1 node to be right on second row')
  if (!((c.y as number) > (a.y as number))) throw new Error('expected yIndex=1 node to be below yIndex=0 node')
  if (!((d.y as number) > (b.y as number))) throw new Error('expected yIndex=1 node to be below on second column')

  const e = byId.get('e')!
  const f = byId.get('f')!
  if (!(Math.abs((f.y as number) - (e.y as number)) > 20)) throw new Error('expected zIndex to contribute to y separation when present on many nodes')
}

export const testUpdateForceSimulationPresentationKeepsIndexForcesStable = () => {
  const schema: GraphSchema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      mode: 'block',
      forces: {
        ...(defaultSchema.layout?.forces || {}),
        disjointComponents: false,
      },
    },
  }
  const nodes: GraphNode[] = [makeNode({ id: 'a', xIndex: 0, yIndex: 0, zIndex: 0 }), makeNode({ id: 'b', xIndex: 1, yIndex: 0, zIndex: 0 })]
  const edges: GraphEdge[] = []

  const sim = buildSimulation(nodes, edges, 800, 600, schema, { skipInitialLayout: true })
  sim.stop()
  sim.alpha(0.01)

  updateForceSimulationPresentation({ simulation: sim, nodes, edges, width: 800, height: 600, schema, groupsForBboxCollide: [] })
  const beforeXIndex = sim.force('xIndex')
  const beforeYIndex = sim.force('yIndex')

  updateForceSimulationPresentation({ simulation: sim, nodes, edges, width: 800, height: 600, schema, groupsForBboxCollide: [] })
  if (sim.force('xIndex') !== beforeXIndex) throw new Error('expected xIndex force identity to remain stable')
  if (sim.force('yIndex') !== beforeYIndex) throw new Error('expected yIndex force identity to remain stable')
}
