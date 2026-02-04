import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { readCollisionConfig, readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'
import { readGroupStrokeWidthPx } from '@/lib/graph/collision/strokeWidth'
import { resolveGroupCollisions, CollisionGroupItem } from '@/lib/graph/collision/boxCollision'
import {
  DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_GROUP_BBOX_COLLIDE_PADDING,
  DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH,
  DEFAULT_GROUP_NESTED_PADDING_STEP,
  DEFAULT_GROUP_PADDING,
  DEFAULT_GROUP_STROKE_WIDTH,
} from '@/lib/graph/layoutDefaults'

type GroupState = CollisionGroupItem & {
  depth: number
  memberIdxs: number[]
  empty: boolean
}

const isPinned = (n: GraphNode): boolean =>
  (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
  (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))

export const createGroupBboxCollideForceByDepth = (args: {
  schema: GraphSchema
  groups: GraphGroup[]
  paddingX: number
  paddingY: number
  extraGapPx?: number
  strength: number
  iterations: number
}): d3.Force<GraphNode, GraphEdge> => {
  const { schema } = args
  let nodes: GraphNode[] = []
  const groupBboxCfg = readCollisionConfig(schema).groupBbox
  const borderGapMinPx = groupBboxCfg.borderGapPx
  const touchEpsilonPx = groupBboxCfg.touchEpsilonPx

  let paddingX = Number.isFinite(args.paddingX) ? Math.max(0, args.paddingX) : DEFAULT_GROUP_BBOX_COLLIDE_PADDING
  let paddingY = Number.isFinite(args.paddingY) ? Math.max(0, args.paddingY) : DEFAULT_GROUP_BBOX_COLLIDE_PADDING
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
        gap: 0,
        gapX: 0,
        gapY: 0,
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
    const gapPadX = Math.max(0, paddingX + extraGapPx)
    const gapPadY = Math.max(0, paddingY + extraGapPx)
    const gapPad = Math.max(gapPadX, gapPadY)

    for (let i = 0; i < groupStates.length; i += 1) {
      const g = groupStates[i]!
      const depthExtra = nestedPaddingStep > 0 ? nestedPaddingStep * Math.max(0, maxDepth - g.depth) : 0
      const strokeWidthPx = readGroupStrokeWidthPx(schema, g.depth, maxDepth)
      const borderGapPx = computeBorderGapPx(strokeWidthPx, borderGapMinPx)
      
      const visualPad = Math.max(0, groupPad + depthExtra + borderGapPx)
      g.gap = gapPad
      g.gapX = gapPadX
      g.gapY = gapPadY

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
        const loX = x - ext.halfW - visualPad
        const hiX = x + ext.halfW + visualPad
        const loY = y - ext.halfH - visualPad - topLabelExtra
        const hiY = y + ext.halfH + visualPad
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

  const groupsShareAnyMember = (a: CollisionGroupItem, b: CollisionGroupItem): boolean => {
    const aState = a as GroupState
    const bState = b as GroupState
    
    const aIdxs = aState.memberIdxs
    const bIdxs = bState.memberIdxs
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

  const force = (alpha: number) => {
    const k = alpha * strength
    if (k <= 0 || nodes.length < 2 || groupStates.length < 2) return

    for (let iter = 0; iter < iterations; iter += 1) {
      updateGroupAabbs()
      resolveGroupCollisions({
        groups: groupStates,
        nodes,
        strength: k,
        touchEpsilon: touchEpsilonPx,
        groupsShareAnyMember
      })
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
