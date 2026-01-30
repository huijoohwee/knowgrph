import * as d3 from 'd3'
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema, getNodeRenderRadius } from '@/lib/graph/schema'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'
import { estimateNodeLabelAabbHalfExtents2d } from '@/components/GraphCanvas/labelLayout2d'
import { getPortHandlesConfig } from '@/components/GraphCanvas/portHandlesConfig'
import { readCollisionConfig } from '@/components/GraphCanvas/layout/collisionConfig'
import {
  DEFAULT_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_BBOX_COLLIDE_PADDING,
  DEFAULT_BBOX_COLLIDE_STRENGTH,
} from '@/lib/graph/layoutDefaults'

export type NodeHalfExtents = { halfW: number; halfH: number }

const extentsCache = new WeakMap<GraphNode, { schema: GraphSchema; extents: NodeHalfExtents }>()
const radiusCache = new WeakMap<GraphNode, { schema: GraphSchema; radius: number }>()

export const getNodeAabbHalfExtentsWithLabel = (node: GraphNode, schema: GraphSchema): NodeHalfExtents => {
  const cached = extentsCache.get(node)
  if (cached && cached.schema === schema) return cached.extents

  const baseExtents = getNodeHalfExtents2d(node, schema)
  const portCfg = getPortHandlesConfig(schema)
  const portExtra = portCfg.enabled ? Math.max(0, portCfg.offset + portCfg.size + portCfg.strokeWidth) : 0
  const extentsWithPorts = portExtra > 0 ? { halfW: baseExtents.halfW + portExtra, halfH: baseExtents.halfH + portExtra } : baseExtents
  const extentsWithLabel = estimateNodeLabelAabbHalfExtents2d(node, schema, extentsWithPorts)
  extentsCache.set(node, { schema, extents: extentsWithLabel })
  return extentsWithLabel
}

export const getNodeCollisionRadius = (node: GraphNode, schema: GraphSchema): number => {
  const cached = radiusCache.get(node)
  if (cached && cached.schema === schema) return cached.radius
  const ext = getNodeAabbHalfExtentsWithLabel(node, schema)
  const baseRadius = getNodeRenderRadius(node, schema) || 20
  const base = Math.max(8, ext.halfW, ext.halfH, baseRadius)
  const r = Math.max(8, base * 1.05 + 8, baseRadius * 1.25)
  radiusCache.set(node, { schema, radius: r })
  return r
}

export function readBboxCollideConfig(schema: GraphSchema): {
  enabled: boolean
  padding: number
  strength: number
  iterations: number
} {
  return readCollisionConfig(schema).nodeBbox
}

export const createBboxCollideForce = (args: {
  schema: GraphSchema
  padding: number
  strength: number
  iterations: number
}): d3.Force<GraphNode, GraphEdge> => {
  const { schema } = args
  let nodes: GraphNode[] = []
  let strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : DEFAULT_BBOX_COLLIDE_STRENGTH
  let iterations = Number.isFinite(args.iterations) ? Math.max(1, Math.floor(args.iterations)) : DEFAULT_BBOX_COLLIDE_ITERATIONS
  let padding = Number.isFinite(args.padding) ? Math.max(0, args.padding) : DEFAULT_BBOX_COLLIDE_PADDING
  let maxHalf = 64

  const isPinned = (n: GraphNode): boolean =>
    (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
    (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))

  const computeMaxHalf = () => {
    let m = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
      m = Math.max(m, ext.halfW + padding, ext.halfH + padding)
    }
    maxHalf = Math.max(16, m)
  }

  const force = (alpha: number) => {
    const k = alpha * strength
    if (k <= 0 || nodes.length < 2) return
    for (let iter = 0; iter < iterations; iter += 1) {
      const qt = d3.quadtree(nodes as GraphNode[], d => (typeof d.x === 'number' ? d.x : 0), d => (typeof d.y === 'number' ? d.y : 0))
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i]
        const ax = typeof a.x === 'number' && Number.isFinite(a.x) ? a.x : null
        const ay = typeof a.y === 'number' && Number.isFinite(a.y) ? a.y : null
        if (ax == null || ay == null) continue
        const aExt = getNodeAabbHalfExtentsWithLabel(a, schema)
        const aHalfW = aExt.halfW + padding
        const aHalfH = aExt.halfH + padding
        const aPinned = isPinned(a)

        qt.visit((quad, x0, y0, x1, y1) => {
          if (x0 > ax + aHalfW + maxHalf) return true
          if (x1 < ax - aHalfW - maxHalf) return true
          if (y0 > ay + aHalfH + maxHalf) return true
          if (y1 < ay - aHalfH - maxHalf) return true
          if (!('data' in quad)) return false
          const leaf = quad as d3.QuadtreeLeaf<GraphNode>
          let cur: d3.QuadtreeLeaf<GraphNode> | undefined = leaf
          while (cur) {
            const b = cur.data
            if (b && b !== a) {
              const bx = typeof b.x === 'number' && Number.isFinite(b.x) ? b.x : null
              const by = typeof b.y === 'number' && Number.isFinite(b.y) ? b.y : null
              if (bx != null && by != null) {
                const bExt = getNodeAabbHalfExtentsWithLabel(b, schema)
                const bHalfW = bExt.halfW + padding
                const bHalfH = bExt.halfH + padding

                const dx = ax - bx
                const dy = ay - by
                const ox = aHalfW + bHalfW - Math.abs(dx)
                const oy = aHalfH + bHalfH - Math.abs(dy)
                if (ox > 0 && oy > 0) {
                  const bPinned = isPinned(b)
                  const splitA = aPinned ? 0 : bPinned ? 1 : 0.5
                  const splitB = aPinned ? 1 : bPinned ? 0 : 0.5
                  if (ox < oy) {
                    const sx = dx < 0 ? -1 : 1
                    const push = ox * sx
                    if (!aPinned) a.vx = (a.vx ?? 0) + push * k * splitA
                    if (!bPinned) b.vx = (b.vx ?? 0) - push * k * splitB
                  } else {
                    const sy = dy < 0 ? -1 : 1
                    const push = oy * sy
                    if (!aPinned) a.vy = (a.vy ?? 0) + push * k * splitA
                    if (!bPinned) b.vy = (b.vy ?? 0) - push * k * splitB
                  }
                }
              }
            }
            cur = (cur as unknown as { next?: d3.QuadtreeLeaf<GraphNode> }).next
          }
          return false
        })
      }
    }
  }

  force.initialize = (ns: GraphNode[]) => {
    nodes = ns || []
    computeMaxHalf()
  }

  ;(force as unknown as { strength: (v: number) => unknown }).strength = (v: number) => {
    strength = Number.isFinite(v) ? Math.max(0, v) : strength
    return force
  }
  ;(force as unknown as { iterations: (v: number) => unknown }).iterations = (v: number) => {
    iterations = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : iterations
    return force
  }
  ;(force as unknown as { padding: (v: number) => unknown }).padding = (v: number) => {
    padding = Number.isFinite(v) ? Math.max(0, v) : padding
    computeMaxHalf()
    return force
  }

  return force as unknown as d3.Force<GraphNode, GraphEdge>
}
