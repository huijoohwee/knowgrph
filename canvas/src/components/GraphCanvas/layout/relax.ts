import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createBboxCollideForce } from './overlap'
import { createGroupBboxCollideForce } from './groupOverlap'
import { createGroupKeyOfNode, type GroupKeyOfNode } from './grouping'
import { readCollisionConfig, readStructuredRelaxSteps } from './collisionConfig'

export function relaxNodesWithCollision(args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  schema: GraphSchema
  defaultSteps: number
  groupKeyOf?: GroupKeyOfNode
}): void {
  const { nodes, edges, schema } = args
  if (!nodes.length) return

  const steps = readStructuredRelaxSteps(schema, args.defaultSteps)
  if (steps <= 0) return

  const collision = readCollisionConfig(schema)
  if (!collision.nodeBbox.enabled && !collision.groupBbox.enabled) return

  const nodeForce = collision.nodeBbox.enabled
    ? createBboxCollideForce({
        schema,
        padding: collision.nodeBbox.padding,
        strength: collision.nodeBbox.strength,
        iterations: collision.nodeBbox.iterations,
      })
    : null
  if (nodeForce) nodeForce.initialize(nodes, Math.random)
  const applyNodeForce = nodeForce as unknown as ((alpha: number) => void) | null

  const groupKeyOf = args.groupKeyOf || createGroupKeyOfNode({ nodes, edges })
  const groupForce = collision.groupBbox.enabled
    ? createGroupBboxCollideForce({
        schema,
        padding: collision.groupBbox.padding,
        strength: collision.groupBbox.strength,
        iterations: collision.groupBbox.iterations,
        groupKeyOf,
      })
    : null
  if (groupForce) groupForce.initialize(nodes, Math.random)
  const applyGroupForce = groupForce as unknown as ((alpha: number) => void) | null

  for (let step = 0; step < steps; step += 1) {
    const alpha = Math.max(0.05, 0.9 - step * 0.12)
    if (applyNodeForce) applyNodeForce(alpha)
    if (applyGroupForce) applyGroupForce(alpha)

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const vx = typeof n.vx === 'number' && Number.isFinite(n.vx) ? n.vx : 0
      const vy = typeof n.vy === 'number' && Number.isFinite(n.vy) ? n.vy : 0
      n.x = (typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0) + vx
      n.y = (typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0) + vy
      n.vx = vx * 0.25
      n.vy = vy * 0.25
    }
  }
}
