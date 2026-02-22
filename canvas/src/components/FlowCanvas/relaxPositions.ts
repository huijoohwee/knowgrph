import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createBboxCollideForce } from '@/components/GraphCanvas/layout/overlap'
import { createGroupBboxCollideForceByDepth } from '@/components/GraphCanvas/layout/groupOverlapByDepth'
import { readCollisionConfig, readStructuredRelaxSteps } from '@/components/GraphCanvas/layout/collisionConfig'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { readExplicitZ } from '@/lib/graph/collision/readZ'
import { integrateNodePositionWithVelocity, runRelaxSteps } from '@/lib/graph/collision/relaxRunner'

export function relaxFlowPositionsWithCollision(args: {
  graphData: GraphData
  groups?: GraphGroup[]
  positions: Record<string, { x: number; y: number }> | null
  schema: GraphSchema | null
  nodeSize: { widthPx: number; heightPx: number }
  portHandles?: { enabled: boolean; sizePx: number; offsetPx: number }
  defaultSteps: number
}): Record<string, { x: number; y: number }> | null {
  const positions = args.positions
  const schema = args.schema
  if (!positions || !schema) return positions

  const nodes = Array.isArray(args.graphData.nodes) ? args.graphData.nodes : []
  if (nodes.length === 0) return positions

  const groups = Array.isArray(args.groups) ? args.groups : []

  const handleExtra = (() => {
    const ph = args.portHandles
    if (!ph || ph.enabled !== true) return 0
    const size = Number.isFinite(ph.sizePx) ? Math.max(0, ph.sizePx) : 0
    const offset = Number.isFinite(ph.offsetPx) ? Math.max(0, ph.offsetPx) : 0
    return size + offset
  })()
  const width = Math.max(1, Math.floor(args.nodeSize.widthPx + handleExtra * 2))
  const height = Math.max(1, Math.floor(args.nodeSize.heightPx + handleExtra * 2))

  const dupCounts = new Map<string, number>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    const p = positions[id]
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    const key = `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`
    dupCounts.set(key, (dupCounts.get(key) || 0) + 1)
  }

  const jitterFor = (id: string): { dx: number; dy: number } => {
    let h = 0
    for (let i = 0; i < id.length; i += 1) {
      h = (h * 31 + id.charCodeAt(i)) >>> 0
    }
    const sx = ((h % 7) - 3) * 0.07
    const sy = (((h >>> 3) % 7) - 3) * 0.07
    return { dx: sx, dy: sy }
  }

  const proxyNodes: Array<GraphNode & { z?: number; vz?: number; hasExplicitZ?: boolean }> = []
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    const p = positions[id]
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    const key = `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`
    const needsJitter = (dupCounts.get(key) || 0) > 1
    const jitter = needsJitter ? jitterFor(id) : { dx: 0, dy: 0 }
    const baseProps = (n.properties || {}) as Record<string, unknown>
    const properties = {
      ...baseProps,
      'visual:width': width,
      'visual:height': height,
      'visual:shape': 'rect',
    }
    const zInfo = readExplicitZ(n)
    proxyNodes.push({
      ...n,
      x: p.x + width / 2 + jitter.dx,
      y: p.y + height / 2 + jitter.dy,
      ...(zInfo.hasZ ? { z: zInfo.z } : {}),
      hasExplicitZ: zInfo.hasZ,
      vx: 0,
      vy: 0,
      vz: 0,
      properties: properties as unknown as GraphNode['properties'],
    })
  }

  if (proxyNodes.length === 0) return positions

  const steps = readStructuredRelaxSteps(schema, args.defaultSteps)
  if (steps <= 0) return positions
  const maxOps = 40_000

  const collision = readCollisionConfig(schema)
  if (!collision.nodeBbox.enabled && !collision.groupBbox.enabled) return positions

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
  if (nodeForce) nodeForce.initialize(proxyNodes, Math.random)
  const applyNodeForce = nodeForce as unknown as ((alpha: number) => void) | null

  const groupForces: Array<(alpha: number) => void> = []
  if (collision.groupBbox.enabled && groups.length > 0 && proxyNodes.length <= 3000) {
    const f = createGroupBboxCollideForceByDepth({
      schema,
      groups,
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
    f.initialize(proxyNodes, Math.random)
    groupForces.push(f as unknown as (alpha: number) => void)
  }

  const baseByNode = new WeakMap<GraphNode, { x: number; y: number }>()
  for (let i = 0; i < proxyNodes.length; i += 1) {
    const n = proxyNodes[i]
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    baseByNode.set(n, { x, y })
  }
  const maxPad = Math.max(
    collision.nodeBbox.paddingX,
    collision.nodeBbox.paddingY,
    collision.groupBbox.paddingX,
    collision.groupBbox.paddingY,
  )
  const maxShift = Math.max(20, Math.min(220, 20 + Math.max(width, height) * 0.35 + maxPad * 0.85))
  const pullToBase = (alpha: number) => {
    const strength = 0.06 * alpha
    if (strength <= 0) return
    for (let i = 0; i < proxyNodes.length; i += 1) {
      const n = proxyNodes[i]
      const base = baseByNode.get(n)
      if (!base) continue
      n.vx = (n.vx || 0) + (base.x - (n.x as number)) * strength
      n.vy = (n.vy || 0) + (base.y - (n.y as number)) * strength
    }
  }

  const forces = [applyNodeForce, ...groupForces, pullToBase].filter(Boolean) as Array<(alpha: number) => void>
  runRelaxSteps({
    nodes: proxyNodes,
    steps,
    forces,
    maxOps,
    integrate: (node) => {
      integrateNodePositionWithVelocity(node, {
        damping: 0.4,
        z: { mode: 'predicate', enabled: (n) => (n as { hasExplicitZ?: unknown }).hasExplicitZ === true },
      })
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

  const next: Record<string, { x: number; y: number }> = { ...positions }
  for (let i = 0; i < proxyNodes.length; i += 1) {
    const n = proxyNodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    next[id] = { x: x - width / 2, y: y - height / 2 }
  }
  return next
}
