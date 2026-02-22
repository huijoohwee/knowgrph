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

  const baseByNode = new WeakMap<GraphNode, { x: number; y: number }>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    baseByNode.set(n, { x, y })
  }
  const isPinned = (n: GraphNode): boolean =>
    (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
    (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))
  const maxPad = Math.max(collision.nodeBbox.paddingX, collision.nodeBbox.paddingY, collision.groupBbox.paddingX, collision.groupBbox.paddingY)
  const maxShift = Math.max(24, Math.min(220, 24 + maxPad * 1.25))

  const nodeForce = collision.nodeBbox.enabled
    ? createBboxCollideForce({
        schema,
        paddingX: collision.nodeBbox.paddingX,
        paddingY: collision.nodeBbox.paddingY,
        paddingZ: collision.nodeBbox.paddingZ,
        touchEpsilonPx: collision.nodeBbox.touchEpsilonPx,
        touchEpsilonXPx: collision.nodeBbox.touchEpsilonXPx,
        touchEpsilonYPx: collision.nodeBbox.touchEpsilonYPx,
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

  const pullToBase = (alpha: number) => {
    const strength = 0.06 * alpha
    if (strength <= 0) return
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (!n || isPinned(n)) continue
      const base = baseByNode.get(n)
      if (!base) continue
      n.vx = (n.vx || 0) + (base.x - (n.x as number)) * strength
      n.vy = (n.vy || 0) + (base.y - (n.y as number)) * strength
    }
  }

  const forces = [applyNodeForce, applyGroupForce, pullToBase].filter(Boolean) as Array<(alpha: number) => void>
  runRelaxSteps({
    nodes,
    steps,
    forces,
    maxOps: 60_000,
    integrate: (node) => {
      const fx = (node as unknown as { fx?: unknown }).fx
      const fy = (node as unknown as { fy?: unknown }).fy
      if (typeof fx === 'number' && Number.isFinite(fx)) {
        node.x = fx
        node.vx = 0
      }
      if (typeof fy === 'number' && Number.isFinite(fy)) {
        node.y = fy
        node.vy = 0
      }
      integrateNodePositionWithVelocity(node, { damping: 0.38, z: { mode: 'always' } })
      const base = baseByNode.get(node)
      if (!base) return
      const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : base.x
      const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : base.y
      const dx = Math.max(-maxShift, Math.min(maxShift, x - base.x))
      const dy = Math.max(-maxShift, Math.min(maxShift, y - base.y))
      node.x = base.x + dx
      node.y = base.y + dy
    },
  })
}
