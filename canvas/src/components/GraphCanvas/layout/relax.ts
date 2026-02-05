import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createBboxCollideForce } from './overlap'
import { createGroupBboxCollideForce } from './groupOverlap'
import { createGroupBboxCollideForceByDepth } from './groupOverlapByDepth'
import { createGroupKeyOfNode, type GroupKeyOfNode } from './grouping'
import { readCollisionConfig, readStructuredRelaxSteps } from './collisionConfig'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

export function relaxNodesWithCollision(args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  schema: GraphSchema
  defaultSteps: number
  groupKeyOf?: GroupKeyOfNode
  groups?: GraphGroup[]
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
        paddingX: collision.nodeBbox.paddingX,
        paddingY: collision.nodeBbox.paddingY,
        paddingZ: collision.nodeBbox.paddingZ,
        touchEpsilonPx: collision.nodeBbox.touchEpsilonPx,
        touchEpsilonZPx: collision.nodeBbox.touchEpsilonZPx,
        strength: collision.nodeBbox.strength,
        iterations: collision.nodeBbox.iterations,
      })
    : null
  if (nodeForce) nodeForce.initialize(nodes, Math.random)
  const applyNodeForce = nodeForce as unknown as ((alpha: number) => void) | null

  const groupKeyOf = args.groupKeyOf || createGroupKeyOfNode({ nodes, edges })
  const groupForce = collision.groupBbox.enabled
    ? (args.groups && args.groups.length > 0
        ? createGroupBboxCollideForceByDepth({
            schema,
            groups: args.groups,
            paddingX: collision.groupBbox.paddingX,
            paddingY: collision.groupBbox.paddingY,
            paddingZ: collision.groupBbox.paddingZ,
            extraGapPx: collision.groupBbox.extraGapPx,
            extraGapZPx: collision.groupBbox.extraGapZPx,
            touchEpsilonPx: collision.groupBbox.touchEpsilonPx,
            touchEpsilonXPx: collision.groupBbox.touchEpsilonXPx,
            touchEpsilonYPx: collision.groupBbox.touchEpsilonYPx,
            touchEpsilonZPx: collision.groupBbox.touchEpsilonZPx,
            nestedTouchEpsilonPx: collision.groupBbox.nestedTouchEpsilonPx,
            nestedTouchEpsilonXPx: collision.groupBbox.nestedTouchEpsilonXPx,
            nestedTouchEpsilonYPx: collision.groupBbox.nestedTouchEpsilonYPx,
            nestedTouchEpsilonZPx: collision.groupBbox.nestedTouchEpsilonZPx,
            strength: collision.groupBbox.strength,
            iterations: collision.groupBbox.iterations,
          })
        : createGroupBboxCollideForce({
            schema,
            paddingX: collision.groupBbox.paddingX,
            paddingY: collision.groupBbox.paddingY,
            strength: collision.groupBbox.strength,
            iterations: collision.groupBbox.iterations,
            groupKeyOf,
          }))
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
      const anyNode = n as unknown as { z?: unknown; vz?: unknown }
      const vz = typeof anyNode.vz === 'number' && Number.isFinite(anyNode.vz) ? anyNode.vz : 0
      n.x = (typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0) + vx
      n.y = (typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0) + vy
      anyNode.z = (typeof anyNode.z === 'number' && Number.isFinite(anyNode.z) ? (anyNode.z as number) : 0) + vz
      n.vx = vx * 0.25
      n.vy = vy * 0.25
      anyNode.vz = vz * 0.25
    }
  }
}
