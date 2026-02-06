import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createBboxCollideForce } from './overlap'
import { createGroupBboxCollideForce } from './groupOverlap'
import { createGroupBboxCollideForceByDepth } from './groupOverlapByDepth'
import { createGroupKeyOfNode, type GroupKeyOfNode } from './grouping'
import { readCollisionConfig, readStructuredRelaxSteps } from './collisionConfig'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { integrateNodePositionWithVelocity, runRelaxSteps } from '@/lib/graph/collision/relaxRunner'

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

  const forces = [applyNodeForce, applyGroupForce].filter(Boolean) as Array<(alpha: number) => void>
  runRelaxSteps({
    nodes,
    steps,
    forces,
    integrate: (node) => integrateNodePositionWithVelocity(node, { damping: 0.25, z: { mode: 'always' } }),
  })
}
