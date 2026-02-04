import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import type { GroupKeyOfNode } from '@/components/GraphCanvas/layout/grouping'
import { readCollisionConfig, readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import { applyAabbOverlapPush } from '@/lib/graph/collision/aabbPush'
import {
  DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_GROUP_BBOX_COLLIDE_PADDING,
  DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH,
  DEFAULT_GROUP_PADDING,
  DEFAULT_GROUP_STROKE_WIDTH,
} from '@/lib/graph/layoutDefaults'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'

export const getDefaultGroupKeyOfNode: GroupKeyOfNode = (n: GraphNode): string | null => {
  const p = (n.properties || {}) as Record<string, unknown>
  const top = typeof p['visual:topParentId'] === 'string' ? (p['visual:topParentId'] as string).trim() : ''
  if (top) return top
  const parent = typeof p['visual:parentId'] === 'string' ? (p['visual:parentId'] as string).trim() : ''
  if (parent) return parent
  return null
}

type GroupDatum = {
  id: string
  cx: number
  cy: number
  halfW: number
  halfH: number
  movableIdxs: number[]
}

export const createGroupBboxCollideForce = (args: {
  schema: GraphSchema
  padding: number
  strength: number
  iterations: number
  groupKeyOf?: GroupKeyOfNode
}): d3.Force<GraphNode, GraphEdge> => {
  const { schema } = args
  const groupKeyOf = args.groupKeyOf || getDefaultGroupKeyOfNode
  const groupBboxCfg = readCollisionConfig(schema).groupBbox
  const borderGapMinPx = groupBboxCfg.borderGapPx
  const extraGapPx = groupBboxCfg.extraGapPx
  const touchEpsilonPx = groupBboxCfg.touchEpsilonPx
  let nodes: GraphNode[] = []
  let padding = Number.isFinite(args.padding) ? Math.max(0, args.padding) : DEFAULT_GROUP_BBOX_COLLIDE_PADDING
  let strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH
  let iterations = Number.isFinite(args.iterations)
    ? Math.max(1, Math.floor(args.iterations))
    : DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS

  const isPinned = (n: GraphNode): boolean =>
    (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
    (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))

  const computeGroups = (): GroupDatum[] => {
    const groups = new Map<string, { minX: number; maxX: number; minY: number; maxY: number; movableIdxs: number[] }>()
    const groupPad =
      typeof schema.layout?.groups?.padding === 'number' && Number.isFinite(schema.layout.groups.padding)
        ? Math.max(0, schema.layout.groups.padding)
        : DEFAULT_GROUP_PADDING
    const strokeWidthRaw = schema.layout?.groups?.strokeWidth
    const strokeWidth = typeof strokeWidthRaw === 'number' && Number.isFinite(strokeWidthRaw) ? Math.max(0, strokeWidthRaw) : DEFAULT_GROUP_STROKE_WIDTH
    const borderGapPx = computeBorderGapPx(strokeWidth, borderGapMinPx)
    const topLabelExtra = readGroupLabelTopExtra(schema)
    const pad = Math.max(0, padding + groupPad + borderGapPx + extraGapPx)

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n.id)
      if (!id) continue
      const gid = groupKeyOf(n)
      if (!gid) continue
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
      if (x == null || y == null) continue
      const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
      const minX = x - ext.halfW - pad
      const maxX = x + ext.halfW + pad
      const minY = y - ext.halfH - pad - topLabelExtra
      const maxY = y + ext.halfH + pad

      const prev = groups.get(gid)
      if (!prev) {
        groups.set(gid, {
          minX,
          maxX,
          minY,
          maxY,
          movableIdxs: isPinned(n) ? [] : [i],
        })
      } else {
        if (minX < prev.minX) prev.minX = minX
        if (maxX > prev.maxX) prev.maxX = maxX
        if (minY < prev.minY) prev.minY = minY
        if (maxY > prev.maxY) prev.maxY = maxY
        if (!isPinned(n)) prev.movableIdxs.push(i)
      }
    }

    const out: GroupDatum[] = []
    groups.forEach((v, gid) => {
      const w = Math.max(1, v.maxX - v.minX)
      const h = Math.max(1, v.maxY - v.minY)
      out.push({
        id: gid,
        cx: (v.minX + v.maxX) / 2,
        cy: (v.minY + v.maxY) / 2,
        halfW: w / 2,
        halfH: h / 2,
        movableIdxs: v.movableIdxs,
      })
    })
    return out
  }

  const force = (alpha: number) => {
    const k = alpha * strength
    if (k <= 0 || nodes.length < 2) return

    for (let iter = 0; iter < iterations; iter += 1) {
      const groups = computeGroups()
      if (groups.length < 2) return

      for (let i = 0; i < groups.length; i += 1) {
        const a = groups[i]
        for (let j = i + 1; j < groups.length; j += 1) {
          const b = groups[j]
          const dx = a.cx - b.cx
          const dy = a.cy - b.cy
          const ox = a.halfW + b.halfW - Math.abs(dx)
          const oy = a.halfH + b.halfH - Math.abs(dy)
          const oxAdj = ox + touchEpsilonPx
          const oyAdj = oy + touchEpsilonPx
          if (oxAdj <= 0 || oyAdj <= 0) continue

          const aMovable = a.movableIdxs.length
          const bMovable = b.movableIdxs.length
          if (aMovable === 0 && bMovable === 0) continue
          applyAabbOverlapPush({
            nodes,
            aMovableIdxs: a.movableIdxs,
            bMovableIdxs: b.movableIdxs,
            dx,
            dy,
            ox: oxAdj,
            oy: oyAdj,
            k,
          })
        }
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
    padding = Number.isFinite(v) ? Math.max(0, v) : padding
    return force
  }

  return force as unknown as d3.Force<GraphNode, GraphEdge>
}
