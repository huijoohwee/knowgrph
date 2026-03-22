import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { defaultSchema } from '@/lib/graph/schema'
import { buildSimulation, updateForceSimulationPresentation } from '@/components/GraphCanvas/simulation'

export const testUpdateForceSimulationPresentationDoesNotReheatOrReplaceForces = () => {
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
    { id: 'b', label: 'b', type: 'Entity', x: 50, y: 0, vx: 0, vy: 0, properties: {} },
  ]
  const edges: GraphEdge[] = [{ id: 'e1', source: 'a', target: 'b', label: 'pointsTo', properties: {} }]

  const sim = buildSimulation(nodes, edges, 800, 600, schema)
  sim.stop()
  sim.alpha(0.01)

  const beforeAlpha = sim.alpha()
  const beforeCollide = sim.force('collide')
  const beforeBbox = sim.force('bboxCollide')
  const beforeGroupBbox = sim.force('groupBboxCollide')

  updateForceSimulationPresentation({
    simulation: sim,
    nodes,
    edges,
    width: 800,
    height: 600,
    schema,
    groupsForBboxCollide: [],
  })

  if (Math.abs(sim.alpha() - beforeAlpha) > 1e-9) {
    throw new Error(`Expected first presentation update to not reheat (alpha ${beforeAlpha} -> ${sim.alpha()})`)
  }
  if (sim.force('collide') !== beforeCollide) throw new Error('Expected collide force identity to remain stable')
  if (sim.force('bboxCollide') !== beforeBbox) throw new Error('Expected bboxCollide force identity to remain stable')
  if (sim.force('groupBboxCollide') !== beforeGroupBbox) throw new Error('Expected groupBboxCollide force identity to remain stable')

  updateForceSimulationPresentation({
    simulation: sim,
    nodes,
    edges,
    width: 800,
    height: 600,
    schema,
    groupsForBboxCollide: [],
  })

  if (sim.force('collide') !== beforeCollide) throw new Error('Expected collide force identity to remain stable (2nd call)')
  if (sim.force('bboxCollide') !== beforeBbox) throw new Error('Expected bboxCollide force identity to remain stable (2nd call)')
  if (sim.force('groupBboxCollide') !== beforeGroupBbox) throw new Error('Expected groupBboxCollide force identity to remain stable (2nd call)')
}
