import * as d3 from 'd3'
import { GraphNode, GraphEdge } from '@/lib/graph/types'
import { GraphSchema, getNodeRenderRadius } from '@/lib/graph/schema'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'
import { estimateNodeLabelAabbHalfExtents2d } from '@/components/GraphCanvas/labelLayout2d'
import { getNodeLabelFullText2d } from '@/components/GraphCanvas/labelLayout2d'
import { getPortHandlesConfig } from '@/components/GraphCanvas/portHandlesConfig'
import { readCollisionConfig } from '@/components/GraphCanvas/layout/collisionConfig'
import { applyAabbOverlapPush, PackedRTree, tieBreakOverlaps2d } from '@/lib/graph/collision/boxCollision'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'
import { readNodeStrokeWidthPx } from '@/lib/graph/collision/strokeWidth'
import { readExplicitZ } from '@/lib/graph/collision/readZ'
import { readNodeHalfD } from '@/lib/graph/collision/readNodeHalfD'
import {
  DEFAULT_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_BBOX_COLLIDE_PADDING,
  DEFAULT_BBOX_COLLIDE_STRENGTH,
} from '@/lib/graph/layoutDefaults'

export type NodeHalfExtents = { halfW: number; halfH: number }

type ExtentsCacheEntry = {
  schema: GraphSchema
  labelSig: string
  visualW: number | null
  visualH: number | null
  radius: number | null
  extents: NodeHalfExtents
}

type RadiusCacheEntry = {
  schema: GraphSchema
  labelSig: string
  visualW: number | null
  visualH: number | null
  radiusProp: number | null
  radius: number
}

const extentsCache = new WeakMap<GraphNode, ExtentsCacheEntry>()
const radiusCache = new WeakMap<GraphNode, RadiusCacheEntry>()

const readNodeSizingSig = (node: GraphNode, schema: GraphSchema): { labelSig: string; visualW: number | null; visualH: number | null; radius: number | null } => {
  const props = (node.properties || {}) as Record<string, unknown>
  const labelSig = String(getNodeLabelFullText2d(node) || '')

  const wRaw = props['visual:width']
  const hRaw = props['visual:height']
  const visualW = typeof wRaw === 'number' && Number.isFinite(wRaw) && wRaw > 0 ? wRaw : null
  const visualH = typeof hRaw === 'number' && Number.isFinite(hRaw) && hRaw > 0 ? hRaw : null

  const r = getNodeRenderRadius(node, schema)
  const radius = typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : null

  return { labelSig, visualW, visualH, radius }
}

export const getNodeAabbHalfExtentsWithLabel = (node: GraphNode, schema: GraphSchema): NodeHalfExtents => {
  const sig = readNodeSizingSig(node, schema)
  const cached = extentsCache.get(node)
  if (
    cached &&
    cached.schema === schema &&
    cached.labelSig === sig.labelSig &&
    cached.visualW === sig.visualW &&
    cached.visualH === sig.visualH &&
    cached.radius === sig.radius
  ) {
    return cached.extents
  }

  const baseExtents = getNodeHalfExtents2d(node, schema)
  const portCfg = getPortHandlesConfig(schema)
  const portExtra = portCfg.enabled ? Math.max(0, portCfg.offset + portCfg.size + portCfg.strokeWidth) : 0
  const extentsWithPorts = portExtra > 0 ? { halfW: baseExtents.halfW + portExtra, halfH: baseExtents.halfH + portExtra } : baseExtents
  const extentsWithLabel = estimateNodeLabelAabbHalfExtents2d(node, schema, extentsWithPorts)
  extentsCache.set(node, { schema, labelSig: sig.labelSig, visualW: sig.visualW, visualH: sig.visualH, radius: sig.radius, extents: extentsWithLabel })
  return extentsWithLabel
}

export const getNodeCollisionRadius = (node: GraphNode, schema: GraphSchema): number => {
  const sig = readNodeSizingSig(node, schema)
  const cached = radiusCache.get(node)
  if (
    cached &&
    cached.schema === schema &&
    cached.labelSig === sig.labelSig &&
    cached.visualW === sig.visualW &&
    cached.visualH === sig.visualH &&
    cached.radiusProp === sig.radius
  ) {
    return cached.radius
  }
  const ext = getNodeAabbHalfExtentsWithLabel(node, schema)
  const baseRadius = sig.radius ?? 20
  const base = Math.max(8, ext.halfW, ext.halfH, baseRadius)
  const r = Math.max(8, base * 1.05 + 8, baseRadius * 1.25)
  radiusCache.set(node, { schema, labelSig: sig.labelSig, visualW: sig.visualW, visualH: sig.visualH, radiusProp: sig.radius, radius: r })
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
  paddingZ?: number
  touchEpsilonPx?: number
  touchEpsilonXPx?: number
  touchEpsilonYPx?: number
  touchEpsilonZPx?: number
  strength: number
  iterations: number
}): d3.Force<GraphNode, GraphEdge> => {
  const { schema } = args
  let nodes: GraphNode[] = []
  const borderGapMinPx = readCollisionConfig(schema).nodeBbox.borderGapPx
  const touchEpsilonPx = typeof args.touchEpsilonPx === 'number' && Number.isFinite(args.touchEpsilonPx) ? Math.max(0, args.touchEpsilonPx) : 0
  const touchEpsilonXPx =
    typeof args.touchEpsilonXPx === 'number' && Number.isFinite(args.touchEpsilonXPx) ? Math.max(0, args.touchEpsilonXPx) : touchEpsilonPx
  const touchEpsilonYPx =
    typeof args.touchEpsilonYPx === 'number' && Number.isFinite(args.touchEpsilonYPx) ? Math.max(0, args.touchEpsilonYPx) : touchEpsilonPx
  const touchEpsilonZPx = typeof args.touchEpsilonZPx === 'number' && Number.isFinite(args.touchEpsilonZPx) ? Math.max(0, args.touchEpsilonZPx) : touchEpsilonPx
  let strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : DEFAULT_BBOX_COLLIDE_STRENGTH
  let iterations = Number.isFinite(args.iterations) ? Math.max(1, Math.floor(args.iterations)) : DEFAULT_BBOX_COLLIDE_ITERATIONS
  let paddingX = Number.isFinite(args.paddingX) ? Math.max(0, args.paddingX) : DEFAULT_BBOX_COLLIDE_PADDING
  let paddingY = Number.isFinite(args.paddingY) ? Math.max(0, args.paddingY) : DEFAULT_BBOX_COLLIDE_PADDING
  let paddingZ = Number.isFinite(args.paddingZ) ? Math.max(0, args.paddingZ) : 0

  const nodeBboxCfg = readCollisionConfig(schema).nodeBbox
  const zEnabled = nodeBboxCfg.zEnabled === true
  if (!zEnabled) {
    paddingZ = 0
  } else if (!Number.isFinite(args.paddingZ)) {
    paddingZ = Math.max(0, nodeBboxCfg.paddingZ)
  }

  const isPinned = (n: GraphNode): boolean =>
    (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
    (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))

  type NodeBoxItem = {
    cx: number
    cy: number
    cz: number
    hasZ: boolean
    halfW: number
    halfH: number
    halfD: number
    gapZ: number
    id: number
    pinned: boolean
  }

  const items: NodeBoxItem[] = []

  const force = (alpha: number) => {
    const k = alpha * strength
    if (k <= 0 || nodes.length < 2) return

    const kScaled = k * iterations

    items.length = 0
    let nonZCount = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
      if (x == null || y == null) continue
      const zInfo = zEnabled ? readExplicitZ(n) : { z: 0, hasZ: false }
      if (!zInfo.hasZ) nonZCount += 1
      const cz = zInfo.hasZ ? zInfo.z : 0
      const halfD = zInfo.hasZ ? readNodeHalfD(n) : 0
      const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
      const borderGapPx = computeBorderGapPx(readNodeStrokeWidthPx(schema, n), borderGapMinPx)
      const halfW = ext.halfW + paddingX + borderGapPx
      const halfH = ext.halfH + paddingY + borderGapPx
      const gapZ = zInfo.hasZ ? paddingZ : 0
      items.push({ cx: x, cy: y, cz, hasZ: zInfo.hasZ, halfW, halfH, halfD, gapZ, id: i, pinned: isPinned(n) })
    }

    if (items.length < 2) return

    const broadphaseUsesZ = zEnabled && nonZCount === 0
    const minZ = broadphaseUsesZ ? 0 : -Infinity
    const maxZ = broadphaseUsesZ ? 0 : Infinity
    const index = new PackedRTree(items)

    for (let aIdx = 0; aIdx < items.length; aIdx += 1) {
      const a = items[aIdx]!
      const aNodeIdx = a.id
      const aPinned = a.pinned

      const aMinX = a.cx - a.halfW
      const aMaxX = a.cx + a.halfW
      const aMinY = a.cy - a.halfH
      const aMaxY = a.cy + a.halfH
      const aMinZ = broadphaseUsesZ ? (a.cz - a.halfD - a.gapZ) : minZ
      const aMaxZ = broadphaseUsesZ ? (a.cz + a.halfD + a.gapZ) : maxZ

      index.query(aMinX, aMinY, aMinZ, aMaxX, aMaxY, aMaxZ, (b) => {
        if (b.id <= aNodeIdx) return
        if (aPinned && b.pinned) return

        const dx = a.cx - b.cx
        const dy = a.cy - b.cy
        const dz = a.cz - b.cz
        const ox = a.halfW + b.halfW - Math.abs(dx)
        const oy = a.halfH + b.halfH - Math.abs(dy)
        const oz = a.halfD + b.halfD + (a.gapZ + b.gapZ) - Math.abs(dz)
        const oxAdj = ox + touchEpsilonXPx
        const oyAdj = oy + touchEpsilonYPx

        const useZPair = zEnabled && a.hasZ && b.hasZ
        const ozAdj = oz + touchEpsilonZPx

        if (oxAdj > 0 && oyAdj > 0 && (!useZPair || ozAdj > 0)) {
          const { ox: oxFinal, oy: oyFinal } = tieBreakOverlaps2d({
            ox: oxAdj,
            oy: oyAdj,
            aId: aNodeIdx,
            bId: b.id,
          })
          applyAabbOverlapPush({
            nodes,
            aMovableIdxs: aPinned ? [] : [aNodeIdx],
            bMovableIdxs: b.pinned ? [] : [b.id],
            dx,
            dy,
            dz,
            ox: oxFinal,
            oy: oyFinal,
            oz: useZPair ? ozAdj : Infinity,
            k: kScaled,
          })
        }
      })
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
