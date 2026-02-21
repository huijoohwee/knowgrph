import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { readCollisionConfig, readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'
import { readGroupStrokeWidthPx, readNodeStrokeWidthPx } from '@/lib/graph/collision/strokeWidth'
import {
  resolveGroupCollisions,
  CollisionGroupItem,
  PackedRTree,
  applyAabbOverlapPush,
  applyAabbContainmentPush,
  computeBoxIndices,
} from '@/lib/graph/collision/boxCollision'
import { readExplicitZ } from '@/lib/graph/collision/readZ'
import { readNodeHalfD } from '@/lib/graph/collision/readNodeHalfD'
import {
  DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_GROUP_BBOX_COLLIDE_PADDING,
  DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH,
  DEFAULT_GROUP_NESTED_PADDING_STEP,
  DEFAULT_GROUP_PADDING,
} from '@/lib/graph/layoutDefaults'

type GroupState = CollisionGroupItem & {
  depth: number
  memberIdxs: number[]
  empty: boolean
  hasZ: boolean
}

type NodeBoxItem = {
  cx: number
  cy: number
  cz: number
  hasZ: boolean
  halfW: number
  halfH: number
  halfD: number
  id: number
  pinned: boolean
}

const containsSorted = (sorted: number[], value: number): boolean => {
  let lo = 0
  let hi = sorted.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const v = sorted[mid]!
    if (v === value) return true
    if (v < value) lo = mid + 1
    else hi = mid - 1
  }
  return false
}

const isSortedSubset = (subsetSorted: number[], supersetSorted: number[]): boolean => {
  if (subsetSorted.length === 0) return true
  if (supersetSorted.length === 0) return false
  let i = 0
  let j = 0
  while (i < subsetSorted.length && j < supersetSorted.length) {
    const sv = subsetSorted[i]!
    const pv = supersetSorted[j]!
    if (sv === pv) {
      i += 1
      j += 1
      continue
    }
    if (pv < sv) {
      j += 1
      continue
    }
    return false
  }
  return i === subsetSorted.length
}

const isPinned = (n: GraphNode): boolean =>
  (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
  (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))

export const createGroupBboxCollideForceByDepth = (args: {
  schema: GraphSchema
  groups: GraphGroup[]
  paddingX: number
  paddingY: number
  paddingZ?: number
  extraGapPx?: number
  extraGapZPx?: number
  touchEpsilonPx?: number
  touchEpsilonXPx?: number
  touchEpsilonYPx?: number
  touchEpsilonZPx?: number
  nestedTouchEpsilonPx?: number
  nestedTouchEpsilonXPx?: number
  nestedTouchEpsilonYPx?: number
  nestedTouchEpsilonZPx?: number
  strength: number
  iterations: number
}): d3.Force<GraphNode, GraphEdge> => {
  const { schema } = args
  let nodes: GraphNode[] = []
  const groupBboxCfg = readCollisionConfig(schema).groupBbox
  const borderGapMinPx = groupBboxCfg.borderGapPx
  const touchEpsilonPx =
    typeof args.touchEpsilonPx === 'number' && Number.isFinite(args.touchEpsilonPx)
      ? Math.max(0, args.touchEpsilonPx)
      : groupBboxCfg.touchEpsilonPx
  const touchEpsilonXPx =
    typeof args.touchEpsilonXPx === 'number' && Number.isFinite(args.touchEpsilonXPx)
      ? Math.max(0, args.touchEpsilonXPx)
      : groupBboxCfg.touchEpsilonXPx
  const touchEpsilonYPx =
    typeof args.touchEpsilonYPx === 'number' && Number.isFinite(args.touchEpsilonYPx)
      ? Math.max(0, args.touchEpsilonYPx)
      : groupBboxCfg.touchEpsilonYPx
  const touchEpsilonZPx =
    typeof args.touchEpsilonZPx === 'number' && Number.isFinite(args.touchEpsilonZPx)
      ? Math.max(0, args.touchEpsilonZPx)
      : groupBboxCfg.touchEpsilonZPx
  const nestedTouchEpsilonXPx =
    typeof args.nestedTouchEpsilonXPx === 'number' && Number.isFinite(args.nestedTouchEpsilonXPx)
      ? Math.max(0, args.nestedTouchEpsilonXPx)
      : groupBboxCfg.nestedTouchEpsilonXPx
  const nestedTouchEpsilonYPx =
    typeof args.nestedTouchEpsilonYPx === 'number' && Number.isFinite(args.nestedTouchEpsilonYPx)
      ? Math.max(0, args.nestedTouchEpsilonYPx)
      : groupBboxCfg.nestedTouchEpsilonYPx
  const nestedTouchEpsilonZPx =
    typeof args.nestedTouchEpsilonZPx === 'number' && Number.isFinite(args.nestedTouchEpsilonZPx)
      ? Math.max(0, args.nestedTouchEpsilonZPx)
      : groupBboxCfg.nestedTouchEpsilonZPx
  const zEnabled = groupBboxCfg.zEnabled === true

  const nodeBboxCfg = readCollisionConfig(schema).nodeBbox
  const nodeBorderGapMinPx = nodeBboxCfg.borderGapPx

  let paddingX = Number.isFinite(args.paddingX) ? Math.max(0, args.paddingX) : DEFAULT_GROUP_BBOX_COLLIDE_PADDING
  let paddingY = Number.isFinite(args.paddingY) ? Math.max(0, args.paddingY) : DEFAULT_GROUP_BBOX_COLLIDE_PADDING
  let paddingZ = Number.isFinite(args.paddingZ)
    ? Math.max(0, args.paddingZ)
    : Math.max(
        0,
        typeof groupBboxCfg.paddingZ === 'number' && Number.isFinite(groupBboxCfg.paddingZ) ? groupBboxCfg.paddingZ : 0,
      )
  let strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH
  let iterations = Number.isFinite(args.iterations)
    ? Math.max(1, Math.floor(args.iterations))
    : DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS

  const extraGapPx = typeof args.extraGapPx === 'number' && Number.isFinite(args.extraGapPx) ? Math.max(0, args.extraGapPx) : 0
  const extraGapZPx = typeof args.extraGapZPx === 'number' && Number.isFinite(args.extraGapZPx)
    ? Math.max(0, args.extraGapZPx)
    : Math.max(
        0,
        typeof groupBboxCfg.extraGapZPx === 'number' && Number.isFinite(groupBboxCfg.extraGapZPx) ? groupBboxCfg.extraGapZPx : 0,
      )

  if (!zEnabled) {
    paddingZ = 0
  }

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
        hasZ: false,
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
    const gapPadZ = zEnabled ? Math.max(0, paddingZ + extraGapZPx) : 0
    const gapSideX = gapPadX * 0.5
    const gapSideY = gapPadY * 0.5
    const gapSideZ = gapPadZ * 0.5
    const gapSide = Math.max(gapSideX, gapSideY)

    for (let i = 0; i < groupStates.length; i += 1) {
      const g = groupStates[i]!
      const depthExtra = nestedPaddingStep > 0 ? nestedPaddingStep * Math.max(0, maxDepth - g.depth) : 0
      const strokeWidthPx = readGroupStrokeWidthPx(schema, g.depth, maxDepth)
      const borderGapPx = computeBorderGapPx(strokeWidthPx, borderGapMinPx)
      
      const visualPad = Math.max(0, groupPad + depthExtra + borderGapPx)
      g.gap = gapSide
      g.gapX = gapSideX
      g.gapY = gapSideY
      g.gapZ = undefined

      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      let minZ = Infinity
      let maxZ = -Infinity
      let sawZ = false
      let saw = false
      g.movableIdxs.length = 0

      const memberIdxs = g.memberIdxs
      for (let j = 0; j < memberIdxs.length; j += 1) {
        const n = nodes[memberIdxs[j]!]!
        // If pinned (dragged), skip contribution to group bbox to avoid chaos
        if (isPinned(n)) continue

        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x == null || y == null) continue
        const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
        const loX = x - ext.halfW - visualPad
        const hiX = x + ext.halfW + visualPad
        const loY = y - ext.halfH - visualPad - topLabelExtra
        const hiY = y + ext.halfH + visualPad
        const zInfo = zEnabled ? readExplicitZ(n) : { z: 0, hasZ: false }
        if (loX < minX) minX = loX
        if (hiX > maxX) maxX = hiX
        if (loY < minY) minY = loY
        if (hiY > maxY) maxY = hiY
        if (zEnabled && zInfo.hasZ) {
          const z = zInfo.z
          if (z < minZ) minZ = z
          if (z > maxZ) maxZ = z
          sawZ = true
        }
        saw = true
        g.movableIdxs.push(memberIdxs[j]!)
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

      if (zEnabled && sawZ) {
        const cz = (minZ + maxZ) / 2
        const halfD = Math.max(0, (maxZ - minZ) / 2)
        g.hasZ = true
        g.cz = cz
        g.halfD = halfD
        g.gap = Math.max(g.gap, gapSideZ)
        g.gapZ = gapSideZ
      } else {
        g.hasZ = false
        g.cz = undefined
        g.halfD = undefined
        g.gapZ = undefined
      }
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
    const k = alpha * strength * iterations
    if (k <= 0 || nodes.length < 2 || groupStates.length < 1) return

    updateGroupAabbs()

    const nodeItems: NodeBoxItem[] = []
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
      const borderGapPx = computeBorderGapPx(readNodeStrokeWidthPx(schema, n), nodeBorderGapMinPx)
      const halfW = ext.halfW + nodeBboxCfg.paddingX + borderGapPx
      const halfH = ext.halfH + nodeBboxCfg.paddingY + borderGapPx
      nodeItems.push({ cx: x, cy: y, cz, hasZ: zInfo.hasZ, halfW, halfH, halfD, id: i, pinned: isPinned(n) })
    }
    const nodeIndex = nodeItems.length > 0 ? new PackedRTree(nodeItems) : null
    const broadphaseUsesZ = zEnabled && nonZCount === 0 && groupStates.every(g => g.hasZ)

    resolveGroupCollisions({
      groups: groupStates.filter(g => !g.empty),
      nodes,
      strength: k,
      touchEpsilon: touchEpsilonPx,
      touchEpsilonX: touchEpsilonXPx,
      touchEpsilonY: touchEpsilonYPx,
      ...(zEnabled ? { touchEpsilonZ: touchEpsilonZPx } : {}),
      groupsShareAnyMember,
    })

    if (nestedTouchEpsilonXPx > 0 || nestedTouchEpsilonYPx > 0 || (zEnabled && nestedTouchEpsilonZPx > 0)) {
      for (let i = 0; i < groupStates.length; i += 1) {
        const child = groupStates[i]!
        if (child.empty) continue
        if (child.movableIdxs.length === 0) continue

        let bestParent: GroupState | null = null
        let bestArea = Infinity
        for (let j = 0; j < groupStates.length; j += 1) {
          if (i === j) continue
          const candidate = groupStates[j]!
          if (candidate.empty) continue
          if (candidate.depth >= child.depth) continue
          if (!isSortedSubset(child.memberIdxs, candidate.memberIdxs)) continue

          if (!bestParent || candidate.depth > bestParent.depth) {
            bestParent = candidate
            bestArea = candidate.halfW * candidate.halfH
            continue
          }
          if (bestParent && candidate.depth === bestParent.depth) {
            const area = candidate.halfW * candidate.halfH
            if (area < bestArea) {
              bestParent = candidate
              bestArea = area
            }
          }
        }

        if (!bestParent) continue

        const parentIndices = computeBoxIndices(
          bestParent.cx,
          bestParent.cy,
          bestParent.cz ?? 0,
          bestParent.halfW,
          bestParent.halfH,
          bestParent.halfD ?? 0,
          bestParent.gap,
          bestParent.gapX,
          bestParent.gapY,
          bestParent.gapZ,
        )

        const childIndices = computeBoxIndices(
          child.cx,
          child.cy,
          child.cz ?? 0,
          child.halfW,
          child.halfH,
          child.halfD ?? 0,
          child.gap,
          child.gapX,
          child.gapY,
          child.gapZ,
        )

        const vLeftX = parentIndices.x2 + nestedTouchEpsilonXPx - childIndices.x2
        const vRightX = childIndices.x4 - (parentIndices.x4 - nestedTouchEpsilonXPx)
        const vBottomY = parentIndices.y2 + nestedTouchEpsilonYPx - childIndices.y2
        const vTopY = childIndices.y4 - (parentIndices.y4 - nestedTouchEpsilonYPx)

        let pushX = (vLeftX > 0 ? vLeftX : 0) - (vRightX > 0 ? vRightX : 0)
        let pushY = (vBottomY > 0 ? vBottomY : 0) - (vTopY > 0 ? vTopY : 0)

        const useZ = zEnabled && bestParent.hasZ && child.hasZ
        let pushZ = 0
        if (useZ) {
          const vNearZ = parentIndices.z2 + nestedTouchEpsilonZPx - childIndices.z2
          const vFarZ = childIndices.z4 - (parentIndices.z4 - nestedTouchEpsilonZPx)
          pushZ = (vNearZ > 0 ? vNearZ : 0) - (vFarZ > 0 ? vFarZ : 0)
        }

        const ax = Math.abs(pushX)
        const ay = Math.abs(pushY)
        const az = Math.abs(pushZ)
        if (ax === 0 && ay === 0 && az === 0) continue

        if (ax >= ay && ax >= az) {
          pushY = 0
          pushZ = 0
        } else if (ay >= ax && ay >= az) {
          pushX = 0
          pushZ = 0
        } else {
          pushX = 0
          pushY = 0
        }

        applyAabbContainmentPush({
          nodes,
          movableIdxs: child.movableIdxs,
          pushX,
          pushY,
          ...(useZ ? { pushZ } : {}),
          k,
        })
      }
    }

    if (!nodeIndex) return

    const nodeTouchEpsilonX = Math.max(0, nodeBboxCfg.touchEpsilonXPx)
    const nodeTouchEpsilonY = Math.max(0, nodeBboxCfg.touchEpsilonYPx)
    const nodeTouchEpsilonZ = Math.max(0, nodeBboxCfg.touchEpsilonZPx)
    const touchX = Math.max(0, touchEpsilonXPx, nodeTouchEpsilonX)
    const touchY = Math.max(0, touchEpsilonYPx, nodeTouchEpsilonY)
    const touchZ = Math.max(0, touchEpsilonZPx, nodeTouchEpsilonZ)

    for (let i = 0; i < groupStates.length; i += 1) {
      const g = groupStates[i]!
      if (g.empty) continue

      const gapX = typeof g.gapX === 'number' && Number.isFinite(g.gapX) ? Math.max(0, g.gapX) : Math.max(0, g.gap)
      const gapY = typeof g.gapY === 'number' && Number.isFinite(g.gapY) ? Math.max(0, g.gapY) : Math.max(0, g.gap)
      const gapZ = typeof g.gapZ === 'number' && Number.isFinite(g.gapZ) ? Math.max(0, g.gapZ) : 0

      const minX = g.cx - g.halfW - gapX
      const maxX = g.cx + g.halfW + gapX
      const minY = g.cy - g.halfH - gapY
      const maxY = g.cy + g.halfH + gapY
      const minZ = broadphaseUsesZ ? (g.cz ?? 0) - (g.halfD ?? 0) - gapZ : -Infinity
      const maxZ = broadphaseUsesZ ? (g.cz ?? 0) + (g.halfD ?? 0) + gapZ : Infinity

      nodeIndex.query(minX, minY, minZ, maxX, maxY, maxZ, (nItem) => {
        const nodeIdx = nItem.id
        if (containsSorted(g.memberIdxs, nodeIdx)) return

        const nodePinned = nItem.pinned
        const nodeMovableIdxs = nodePinned ? [] : [nodeIdx]
        const groupMovableIdxs = nodePinned ? g.movableIdxs : []
        if (nodeMovableIdxs.length === 0 && groupMovableIdxs.length === 0) return

        const dx = g.cx - nItem.cx
        const dy = g.cy - nItem.cy
        const dz = (g.cz ?? 0) - nItem.cz

        const ox = g.halfW + nItem.halfW + gapX - Math.abs(dx)
        const oy = g.halfH + nItem.halfH + gapY - Math.abs(dy)
        const oz = (g.halfD ?? 0) + nItem.halfD + gapZ - Math.abs(dz)

        const oxAdj = ox + touchX
        const oyAdj = oy + touchY
        const useZ = zEnabled && g.hasZ && nItem.hasZ
        const ozAdj = oz + touchZ

        if (oxAdj > 0 && oyAdj > 0 && (!useZ || ozAdj > 0)) {
          applyAabbOverlapPush({
            nodes,
            aMovableIdxs: groupMovableIdxs,
            bMovableIdxs: nodeMovableIdxs,
            dx,
            dy,
            dz,
            ox: oxAdj,
            oy: oyAdj,
            oz: useZ ? ozAdj : Infinity,
            k,
          })
        }
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
