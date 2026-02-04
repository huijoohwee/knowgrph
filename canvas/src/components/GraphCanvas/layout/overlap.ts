import * as d3 from 'd3'
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema, getNodeRenderRadius } from '@/lib/graph/schema'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'
import { estimateNodeLabelAabbHalfExtents2d } from '@/components/GraphCanvas/labelLayout2d'
import { getPortHandlesConfig } from '@/components/GraphCanvas/portHandlesConfig'
import { readCollisionConfig } from '@/components/GraphCanvas/layout/collisionConfig'
import { applyAabbOverlapPush, PackedRTree } from '@/lib/graph/collision/boxCollision'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'
import { readNodeStrokeWidthPx } from '@/lib/graph/collision/strokeWidth'
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
  paddingX: number
  paddingY: number
  touchEpsilonPx?: number
  strength: number
  iterations: number
}): d3.Force<GraphNode, GraphEdge> => {
  const { schema } = args
  let nodes: GraphNode[] = []
  const borderGapMinPx = readCollisionConfig(schema).nodeBbox.borderGapPx
  const touchEpsilonPx = typeof args.touchEpsilonPx === 'number' && Number.isFinite(args.touchEpsilonPx) ? Math.max(0, args.touchEpsilonPx) : 0
  let strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : DEFAULT_BBOX_COLLIDE_STRENGTH
  let iterations = Number.isFinite(args.iterations) ? Math.max(1, Math.floor(args.iterations)) : DEFAULT_BBOX_COLLIDE_ITERATIONS
  let paddingX = Number.isFinite(args.paddingX) ? Math.max(0, args.paddingX) : DEFAULT_BBOX_COLLIDE_PADDING
  let paddingY = Number.isFinite(args.paddingY) ? Math.max(0, args.paddingY) : DEFAULT_BBOX_COLLIDE_PADDING

  const isPinned = (n: GraphNode): boolean =>
    (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
    (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))

  type NodeBoxItem = {
    cx: number
    cy: number
    halfW: number
    halfH: number
    id: number
    pinned: boolean
  }

  const force = (alpha: number) => {
    const k = alpha * strength
    if (k <= 0 || nodes.length < 2) return
    for (let iter = 0; iter < iterations; iter += 1) {
      const items: NodeBoxItem[] = []
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x == null || y == null) continue
        const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
        const borderGapPx = computeBorderGapPx(readNodeStrokeWidthPx(schema, n), borderGapMinPx)
        const halfW = ext.halfW + paddingX + borderGapPx
        const halfH = ext.halfH + paddingY + borderGapPx
        items.push({ cx: x, cy: y, halfW, halfH, id: i, pinned: isPinned(n) })
      }

      if (items.length < 2) continue

      const index = new PackedRTree(items)

      for (let aIdx = 0; aIdx < items.length; aIdx += 1) {
        const a = items[aIdx]!
        const aNodeIdx = a.id
        const aPinned = a.pinned

        const minX = a.cx - a.halfW
        const maxX = a.cx + a.halfW
        const minY = a.cy - a.halfH
        const maxY = a.cy + a.halfH

        index.query(minX, minY, -Infinity, maxX, maxY, Infinity, (b) => {
          if (b.id <= aNodeIdx) return
          if (aPinned && b.pinned) return

          const dx = a.cx - b.cx
          const dy = a.cy - b.cy
          const ox = a.halfW + b.halfW - Math.abs(dx)
          const oy = a.halfH + b.halfH - Math.abs(dy)
          const oxAdj = ox + touchEpsilonPx
          const oyAdj = oy + touchEpsilonPx
          if (oxAdj > 0 && oyAdj > 0) {
            applyAabbOverlapPush({
              nodes,
              aMovableIdxs: aPinned ? [] : [aNodeIdx],
              bMovableIdxs: b.pinned ? [] : [b.id],
              dx,
              dy,
              dz: 0,
              ox: oxAdj,
              oy: oyAdj,
              oz: Infinity,
              k,
            })
          }
        })
      }
    }
  }

  force.initialize = (ns: GraphNode[]) => {
    nodes = ns || []
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
    const next = Number.isFinite(v) ? Math.max(0, v) : null
    if (next != null) {
      paddingX = next
      paddingY = next
    }
    return force
  }

  ;(force as unknown as { paddingX: (v: number) => unknown }).paddingX = (v: number) => {
    paddingX = Number.isFinite(v) ? Math.max(0, v) : paddingX
    return force
  }

  ;(force as unknown as { paddingY: (v: number) => unknown }).paddingY = (v: number) => {
    paddingY = Number.isFinite(v) ? Math.max(0, v) : paddingY
    return force
  }

  return force as unknown as d3.Force<GraphNode, GraphEdge>
}
