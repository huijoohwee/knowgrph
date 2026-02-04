import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { readCollisionConfig, readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import { applyAabbOverlapPush } from '@/lib/graph/collision/aabbPush'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'
import { readGroupStrokeWidthPx } from '@/lib/graph/collision/strokeWidth'
import {
  DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_GROUP_BBOX_COLLIDE_PADDING,
  DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH,
  DEFAULT_GROUP_NESTED_PADDING_STEP,
  DEFAULT_GROUP_PADDING,
} from '@/lib/graph/layoutDefaults'

type GroupState = {
  id: string
  depth: number
  memberIdxs: number[]
  movableIdxs: number[]
  cx: number
  cy: number
  halfW: number
  halfH: number
  empty: boolean
}

const isPinned = (n: GraphNode): boolean =>
  (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
  (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))

export const createGroupBboxCollideForceByDepth = (args: {
  schema: GraphSchema
  groups: GraphGroup[]
  padding: number
  extraGapPx?: number
  strength: number
  iterations: number
}): d3.Force<GraphNode, GraphEdge> => {
  const { schema } = args
  let nodes: GraphNode[] = []
  const groupBboxCfg = readCollisionConfig(schema).groupBbox
  const borderGapMinPx = groupBboxCfg.borderGapPx
  const touchEpsilonPx = groupBboxCfg.touchEpsilonPx

  let padding = Number.isFinite(args.padding) ? Math.max(0, args.padding) : DEFAULT_GROUP_BBOX_COLLIDE_PADDING
  let strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH
  let iterations = Number.isFinite(args.iterations)
    ? Math.max(1, Math.floor(args.iterations))
    : DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS

  const extraGapPx = typeof args.extraGapPx === 'number' && Number.isFinite(args.extraGapPx) ? Math.max(0, args.extraGapPx) : 0

  const groups = Array.isArray(args.groups) ? args.groups : []
  const groupStates: GroupState[] = []
  const nodeIndexById = new Map<string, number>()
  let maxDepth = 0

  const rebuildGroupStates = () => {
    groupStates.length = 0
    maxDepth = 0

    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      const id = String(g?.id || '').trim()
      if (!id) continue
      const depthRaw = typeof g.depth === 'number' && Number.isFinite(g.depth) ? g.depth : 0
      const depth = Math.max(0, Math.floor(depthRaw))
      maxDepth = Math.max(maxDepth, depth)

      const memberNodeIds = Array.isArray(g.memberNodeIds) ? g.memberNodeIds : []
      const memberIdxsRaw: number[] = []
      for (let j = 0; j < memberNodeIds.length; j += 1) {
        const nid = String(memberNodeIds[j] || '').trim()
        if (!nid) continue
        const idx = nodeIndexById.get(nid)
        if (idx == null) continue
        memberIdxsRaw.push(idx)
      }

      if (memberIdxsRaw.length === 0) continue

      memberIdxsRaw.sort((a, b) => a - b)
      const memberIdxs: number[] = []
      for (let j = 0; j < memberIdxsRaw.length; j += 1) {
        const v = memberIdxsRaw[j]!
        if (j === 0 || v !== memberIdxsRaw[j - 1]) memberIdxs.push(v)
      }
      if (memberIdxs.length === 0) continue

      const state: GroupState = {
        id,
        depth,
        memberIdxs,
        movableIdxs: [],
        cx: 0,
        cy: 0,
        halfW: 1,
        halfH: 1,
        empty: false,
      }
      groupStates.push(state)
    }
  }

  const updateGroupAabbs = () => {
    const groupPad =
      typeof schema.layout?.groups?.padding === 'number' && Number.isFinite(schema.layout.groups.padding)
        ? Math.max(0, schema.layout.groups.padding)
        : DEFAULT_GROUP_PADDING
    const nestedPaddingStep =
      typeof schema.layout?.groups?.nestedPaddingStep === 'number' && Number.isFinite(schema.layout.groups.nestedPaddingStep)
        ? Math.max(0, schema.layout.groups.nestedPaddingStep)
        : DEFAULT_GROUP_NESTED_PADDING_STEP
    const topLabelExtra = readGroupLabelTopExtra(schema)

    for (let i = 0; i < groupStates.length; i += 1) {
      const g = groupStates[i]!
      const depthExtra = nestedPaddingStep > 0 ? nestedPaddingStep * Math.max(0, maxDepth - g.depth) : 0
      const strokeWidthPx = readGroupStrokeWidthPx(schema, g.depth, maxDepth)
      const borderGapPx = computeBorderGapPx(strokeWidthPx, borderGapMinPx)
      const pad = Math.max(0, padding + groupPad + depthExtra + extraGapPx + borderGapPx)

      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      let saw = false
      g.movableIdxs.length = 0

      const memberIdxs = g.memberIdxs
      for (let j = 0; j < memberIdxs.length; j += 1) {
        const n = nodes[memberIdxs[j]!]!
        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x == null || y == null) continue
        const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
        const loX = x - ext.halfW - pad
        const hiX = x + ext.halfW + pad
        const loY = y - ext.halfH - pad - topLabelExtra
        const hiY = y + ext.halfH + pad
        if (loX < minX) minX = loX
        if (hiX > maxX) maxX = hiX
        if (loY < minY) minY = loY
        if (hiY > maxY) maxY = hiY
        saw = true
        if (!isPinned(n)) g.movableIdxs.push(memberIdxs[j]!)
      }

      if (!saw) {
        g.empty = true
        continue
      }
      g.empty = false
      const w = Math.max(1, maxX - minX)
      const h = Math.max(1, maxY - minY)
      g.cx = (minX + maxX) / 2
      g.cy = (minY + maxY) / 2
      g.halfW = w / 2
      g.halfH = h / 2
    }
  }

  const groupsShareAnyMember = (a: GroupState, b: GroupState): boolean => {
    const aIdxs = a.memberIdxs
    const bIdxs = b.memberIdxs
    let i = 0
    let j = 0
    while (i < aIdxs.length && j < bIdxs.length) {
      const av = aIdxs[i]!
      const bv = bIdxs[j]!
      if (av === bv) return true
      if (av < bv) {
        i += 1
      } else {
        j += 1
      }
    }
    return false
  }

  const resolveAllPairs = (k: number) => {
    if (groupStates.length < 2) return
    const active: number[] = []
    let maxHalfW = 1
    let maxHalfH = 1
    for (let i = 0; i < groupStates.length; i += 1) {
      const g = groupStates[i]!
      if (g.empty) continue
      active.push(i)
      maxHalfW = Math.max(maxHalfW, g.halfW)
      maxHalfH = Math.max(maxHalfH, g.halfH)
    }
    if (active.length < 2) return

    const qt = d3
      .quadtree<number>()
      .x(i => groupStates[i]!.cx)
      .y(i => groupStates[i]!.cy)
      .addAll(active)

    for (let ai = 0; ai < active.length; ai += 1) {
      const aIdx = active[ai]!
      const a = groupStates[aIdx]!
      const minX = a.cx - a.halfW - maxHalfW
      const maxX = a.cx + a.halfW + maxHalfW
      const minY = a.cy - a.halfH - maxHalfH
      const maxY = a.cy + a.halfH + maxHalfH

      qt.visit((node, x0, y0, x1, y1) => {
        if (x0 > maxX || x1 < minX || y0 > maxY || y1 < minY) return true
        const leaf = node as unknown as { data?: number; next?: unknown }
        let d: { data?: number; next?: unknown } | null = leaf
        while (d) {
          const bIdx = d.data
          if (typeof bIdx === 'number' && bIdx > aIdx) {
            const b = groupStates[bIdx]
            if (b && !b.empty) {
              const dx = a.cx - b.cx
              const dy = a.cy - b.cy
              const ox = a.halfW + b.halfW - Math.abs(dx)
              const oy = a.halfH + b.halfH - Math.abs(dy)
              const oxAdj = ox + touchEpsilonPx
              const oyAdj = oy + touchEpsilonPx
              if (oxAdj > 0 && oyAdj > 0 && !groupsShareAnyMember(a, b)) {
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
          d = (d.next as { data?: number; next?: unknown } | undefined) ?? null
        }
        return false
      })
    }
  }

  const force = (alpha: number) => {
    const k = alpha * strength
    if (k <= 0 || nodes.length < 2 || groupStates.length < 2) return

    for (let iter = 0; iter < iterations; iter += 1) {
      updateGroupAabbs()
      resolveAllPairs(k)
    }
  }

  force.initialize = (ns: GraphNode[]) => {
    nodes = ns || []
    nodeIndexById.clear()
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i]?.id || '').trim()
      if (!id) continue
      nodeIndexById.set(id, i)
    }
    rebuildGroupStates()
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
