import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createBboxCollideForce } from '@/components/GraphCanvas/layout/overlap'
import { createGroupBboxCollideForce } from '@/components/GraphCanvas/layout/groupOverlap'
import { readCollisionConfig, readStructuredRelaxSteps } from '@/components/GraphCanvas/layout/collisionConfig'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

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

  const proxyNodes: GraphNode[] = []
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
    proxyNodes.push({
      ...n,
      x: p.x + width / 2 + jitter.dx,
      y: p.y + height / 2 + jitter.dy,
      vx: 0,
      vy: 0,
      properties: properties as unknown as GraphNode['properties'],
    })
  }

  if (proxyNodes.length === 0) return positions

  const steps = readStructuredRelaxSteps(schema, args.defaultSteps)
  if (steps <= 0) return positions

  const collision = readCollisionConfig(schema)
  if (!collision.nodeBbox.enabled && !collision.groupBbox.enabled) return positions

  const nodeForce = collision.nodeBbox.enabled
    ? createBboxCollideForce({
        schema,
        padding: collision.nodeBbox.padding,
        strength: collision.nodeBbox.strength,
        iterations: collision.nodeBbox.iterations,
      })
    : null
  if (nodeForce) nodeForce.initialize(proxyNodes, Math.random)
  const applyNodeForce = nodeForce as unknown as ((alpha: number) => void) | null

  const groupForces: Array<(alpha: number) => void> = []
  if (collision.groupBbox.enabled && groups.length > 0) {
    const byDepth = new Map<number, GraphGroup[]>()
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      const depth = typeof g?.depth === 'number' && Number.isFinite(g.depth) ? g.depth : 0
      const arr = byDepth.get(depth) || []
      arr.push(g)
      byDepth.set(depth, arr)
    }

    const depths = Array.from(byDepth.keys()).filter(d => Number.isFinite(d)).sort((a, b) => a - b)
    const maxDepth = depths.length > 0 ? Math.max(...depths) : 0
    const maxDepthPasses = 12
    const selectedDepths = (() => {
      if (depths.length <= maxDepthPasses) return depths
      const head = depths.slice(0, Math.floor(maxDepthPasses / 2))
      const tail = depths.slice(depths.length - Math.ceil(maxDepthPasses / 2))
      const uniq: number[] = []
      const seen = new Set<number>()
      for (const d of [...head, ...tail]) {
        if (seen.has(d)) continue
        seen.add(d)
        uniq.push(d)
      }
      return uniq.sort((a, b) => a - b)
    })()

    const groupPadRaw = schema.layout?.groups?.padding
    const groupPad = typeof groupPadRaw === 'number' && Number.isFinite(groupPadRaw) ? Math.max(0, groupPadRaw) : 24
    const baseExtraGapPx = Math.max(12, Math.min(96, Math.floor(groupPad * 0.75 + collision.groupBbox.padding * 0.5 + 6)))
    for (let di = 0; di < selectedDepths.length; di += 1) {
      const depth = selectedDepths[di]
      const arr = byDepth.get(depth) || []
      if (arr.length === 0) continue
      arr.sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))

      const nodeToGroupId = new Map<string, string>()
      for (let gi = 0; gi < arr.length; gi += 1) {
        const g = arr[gi]
        const gid = String(g?.id || '').trim()
        if (!gid) continue
        const members = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
        for (let mi = 0; mi < members.length; mi += 1) {
          const nid = String(members[mi] || '').trim()
          if (!nid) continue
          if (nodeToGroupId.has(nid)) continue
          nodeToGroupId.set(nid, gid)
        }
      }
      if (nodeToGroupId.size === 0) continue
      const groupKeyOf = (n: GraphNode): string | null => {
        const id = String(n.id || '').trim()
        if (!id) return null
        return nodeToGroupId.get(id) || null
      }

      const outerBoost = Math.max(0, Math.min(72, (maxDepth - depth) * 8))
      const innerBoost = Math.max(0, Math.min(64, depth * 6))
      const extraGapPx = Math.max(12, Math.min(180, baseExtraGapPx + outerBoost + innerBoost))

      const f = createGroupBboxCollideForce({
        schema,
        padding: collision.groupBbox.padding + extraGapPx,
        strength: collision.groupBbox.strength,
        iterations: collision.groupBbox.iterations,
        groupKeyOf,
      })
      f.initialize(proxyNodes, Math.random)
      groupForces.push(f as unknown as (alpha: number) => void)
    }
  }

  for (let step = 0; step < steps; step += 1) {
    const alpha = Math.max(0.05, 0.9 - step * 0.12)
    if (applyNodeForce) applyNodeForce(alpha)
    for (let i = 0; i < groupForces.length; i += 1) groupForces[i](alpha)

    for (let i = 0; i < proxyNodes.length; i += 1) {
      const n = proxyNodes[i]
      const vx = typeof n.vx === 'number' && Number.isFinite(n.vx) ? n.vx : 0
      const vy = typeof n.vy === 'number' && Number.isFinite(n.vy) ? n.vy : 0
      n.x = (typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0) + vx
      n.y = (typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0) + vy
      n.vx = vx * 0.25
      n.vy = vy * 0.25
    }
  }

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
