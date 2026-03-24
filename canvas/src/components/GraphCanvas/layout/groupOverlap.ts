import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeAabbHalfExtentsWithLabel, type NodeHalfExtents } from '@/components/GraphCanvas/layout/overlap'
import type { GroupKeyOfNode } from '@/components/GraphCanvas/layout/grouping'
import { readCollisionConfig, readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import { resolveGroupCollisions, CollisionGroupItem } from '@/lib/graph/collision/boxCollision'
import {
  DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_GROUP_BBOX_COLLIDE_PADDING,
  DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH,
  DEFAULT_GROUP_PADDING,
  DEFAULT_GROUP_STROKE_WIDTH,
} from '@/lib/graph/layoutDefaults'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'
import { readExplicitZ } from '@/lib/graph/collision/readZ'

export const getDefaultGroupKeyOfNode: GroupKeyOfNode = (n: GraphNode): string | null => {
  const p = (n.properties || {}) as Record<string, unknown>
  const top = typeof p['visual:topParentId'] === 'string' ? (p['visual:topParentId'] as string).trim() : ''
  if (top) return top
  const parent = typeof p['visual:parentId'] === 'string' ? (p['visual:parentId'] as string).trim() : ''
  if (parent) return parent
  return null
}

export const createGroupBboxCollideForce = (args: {
  schema: GraphSchema
  paddingX: number
  paddingY: number
  strength: number
  iterations: number
  groupKeyOf?: GroupKeyOfNode
  halfExtentsByNodeId?: Record<string, NodeHalfExtents> | null
}): d3.Force<GraphNode, GraphEdge> => {
  const { schema } = args
  const groupKeyOf = args.groupKeyOf || getDefaultGroupKeyOfNode
  const halfExtentsByNodeId = args.halfExtentsByNodeId || null
  const groupBboxCfg = readCollisionConfig(schema).groupBbox
  const borderGapMinPx = groupBboxCfg.borderGapPx
  const extraGapPx = groupBboxCfg.extraGapPx
  const extraGapZPx = groupBboxCfg.extraGapZPx
  const touchEpsilonPx = groupBboxCfg.touchEpsilonPx
  const touchEpsilonXPx = groupBboxCfg.touchEpsilonXPx
  const touchEpsilonYPx = groupBboxCfg.touchEpsilonYPx
  const touchEpsilonZPx = groupBboxCfg.touchEpsilonZPx
  const zEnabled = groupBboxCfg.zEnabled === true
  let nodes: GraphNode[] = []
  let paddingX = Number.isFinite(args.paddingX) ? Math.max(0, args.paddingX) : DEFAULT_GROUP_BBOX_COLLIDE_PADDING
  let paddingY = Number.isFinite(args.paddingY) ? Math.max(0, args.paddingY) : DEFAULT_GROUP_BBOX_COLLIDE_PADDING
  let strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH
  let iterations = Number.isFinite(args.iterations)
    ? Math.max(1, Math.floor(args.iterations))
    : DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS

  const isPinned = (n: GraphNode): boolean =>
    (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
    (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))

  const computeGroups = (): CollisionGroupItem[] => {
    const groups = new Map<
      string,
      {
        minX: number
        maxX: number
        minY: number
        maxY: number
        minZ: number
        maxZ: number
        movableIdxs: number[]
      }
    >()
    const groupPad =
      typeof schema.layout?.groups?.padding === 'number' && Number.isFinite(schema.layout.groups.padding)
        ? Math.max(0, schema.layout.groups.padding)
        : DEFAULT_GROUP_PADDING
    const strokeWidthRaw = schema.layout?.groups?.strokeWidth
    const strokeWidth = typeof strokeWidthRaw === 'number' && Number.isFinite(strokeWidthRaw) ? Math.max(0, strokeWidthRaw) : DEFAULT_GROUP_STROKE_WIDTH
    const borderGapPx = computeBorderGapPx(strokeWidth, borderGapMinPx)
    const topLabelExtra = readGroupLabelTopExtra(schema)
    const visualPad = Math.max(0, groupPad + borderGapPx)
    const gapPadX = Math.max(0, paddingX + extraGapPx)
    const gapPadY = Math.max(0, paddingY + extraGapPx)
    const gapPadZ = zEnabled ? Math.max(0, groupBboxCfg.paddingZ + extraGapZPx) : 0
    const gapSideX = gapPadX * 0.5
    const gapSideY = gapPadY * 0.5
    const gapSideZ = gapPadZ * 0.5
    const gapSide = Math.max(gapSideX, gapSideY)

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      // If the node is being dragged (pinned), ignore it for group bbox calculation
      // to prevent the group from expanding violently and causing chaos.
      if (isPinned(n)) continue

      const id = String(n.id)
      if (!id) continue
      const gid = groupKeyOf(n)
      if (!gid) continue
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
      if (x == null || y == null) continue
      const ext = getNodeAabbHalfExtentsWithLabel(n, schema, halfExtentsByNodeId ? { halfExtentsByNodeId } : null)
      const minX = x - ext.halfW - visualPad
      const maxX = x + ext.halfW + visualPad
      const minY = y - ext.halfH - visualPad - topLabelExtra
      const maxY = y + ext.halfH + visualPad
      const zInfo = zEnabled ? readExplicitZ(n) : { z: 0, hasZ: false }

      const prev = groups.get(gid)
      if (!prev) {
        groups.set(gid, {
          minX,
          maxX,
          minY,
          maxY,
          minZ: zInfo.hasZ ? zInfo.z : Infinity,
          maxZ: zInfo.hasZ ? zInfo.z : -Infinity,
          movableIdxs: [i],
        })
      } else {
        if (minX < prev.minX) prev.minX = minX
        if (maxX > prev.maxX) prev.maxX = maxX
        if (minY < prev.minY) prev.minY = minY
        if (maxY > prev.maxY) prev.maxY = maxY
        if (zEnabled && zInfo.hasZ) {
          const z = zInfo.z
          if (z < prev.minZ) prev.minZ = z
          if (z > prev.maxZ) prev.maxZ = z
        }
        prev.movableIdxs.push(i)
      }
    }

    const out: CollisionGroupItem[] = []
    groups.forEach((v, gid) => {
      const w = Math.max(1, v.maxX - v.minX)
      const h = Math.max(1, v.maxY - v.minY)
      const hasZ = zEnabled && Number.isFinite(v.minZ) && Number.isFinite(v.maxZ) && v.maxZ >= v.minZ
      const cz = hasZ ? (v.minZ + v.maxZ) / 2 : 0
      const halfD = hasZ ? Math.max(0, (v.maxZ - v.minZ) / 2) : 0
      out.push({
        id: gid,
        cx: (v.minX + v.maxX) / 2,
        cy: (v.minY + v.maxY) / 2,
        ...(hasZ ? { cz, halfD } : {}),
        halfW: w / 2,
        halfH: h / 2,
        movableIdxs: v.movableIdxs,
        gap: Math.max(gapSide, gapSideZ),
        gapX: gapSideX,
        gapY: gapSideY,
        ...(hasZ ? { gapZ: gapSideZ } : {}),
        ...(hasZ ? { hasZ: true } : {}),
      })
    })
    return out
  }

  const force = (alpha: number) => {
    const k = alpha * strength * iterations
    if (k <= 0 || nodes.length < 2) return

    const groups = computeGroups()
    resolveGroupCollisions({
      groups,
      nodes,
      strength: k,
      touchEpsilon: touchEpsilonPx,
      touchEpsilonX: touchEpsilonXPx,
      touchEpsilonY: touchEpsilonYPx,
      ...(zEnabled ? { touchEpsilonZ: touchEpsilonZPx } : {}),
    })
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
