import * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { readCollisionConfig } from '@/components/GraphCanvas/layout/collisionConfig'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'
import { readNodeStrokeWidthPx } from '@/lib/graph/collision/strokeWidth'
import { resolveGroupCollisions, CollisionGroupItem } from '@/lib/graph/collision/boxCollision'
import {
  DEFAULT_COMPONENT_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_COMPONENT_BBOX_COLLIDE_PADDING,
  DEFAULT_COMPONENT_BBOX_COLLIDE_STRENGTH,
} from '@/lib/graph/layoutDefaults'

const coerceEndpointId = (value: GraphEdge['source'] | GraphEdge['target']): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') return (value as { id: string }).id
  return null
}

const isPinned = (n: GraphNode): boolean =>
  (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
  (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))

type ComponentState = CollisionGroupItem & {
  memberIdxs: number[]
  empty: boolean
}

const unionFind = (n: number) => {
  const parent = new Int32Array(n)
  const rank = new Int8Array(n)
  for (let i = 0; i < n; i += 1) parent[i] = i
  const find = (x: number): number => {
    let p = parent[x]!
    if (p === x) return x
    p = find(p)
    parent[x] = p
    return p
  }
  const union = (a: number, b: number) => {
    let ra = find(a)
    let rb = find(b)
    if (ra === rb) return
    const rka = rank[ra]!
    const rkb = rank[rb]!
    if (rka < rkb) {
      parent[ra] = rb
      return
    }
    if (rkb < rka) {
      parent[rb] = ra
      return
    }
    parent[rb] = ra
    rank[ra] = (rka + 1) as number
  }
  return { parent, find, union }
}

export const createComponentBboxCollideForce = (args: {
  schema: GraphSchema
  edges: GraphEdge[]
  paddingX: number
  paddingY: number
  touchEpsilonPx?: number
  touchEpsilonXPx?: number
  touchEpsilonYPx?: number
  strength: number
  iterations: number
}): d3.Force<GraphNode, GraphEdge> => {
  const { schema } = args
  const edges = Array.isArray(args.edges) ? args.edges : []
  let nodes: GraphNode[] = []

  const touchEpsilonPx = typeof args.touchEpsilonPx === 'number' && Number.isFinite(args.touchEpsilonPx) ? Math.max(0, args.touchEpsilonPx) : 0
  const touchEpsilonXPx =
    typeof args.touchEpsilonXPx === 'number' && Number.isFinite(args.touchEpsilonXPx) ? Math.max(0, args.touchEpsilonXPx) : touchEpsilonPx
  const touchEpsilonYPx =
    typeof args.touchEpsilonYPx === 'number' && Number.isFinite(args.touchEpsilonYPx) ? Math.max(0, args.touchEpsilonYPx) : touchEpsilonPx
  let strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : DEFAULT_COMPONENT_BBOX_COLLIDE_STRENGTH
  let iterations = Number.isFinite(args.iterations) ? Math.max(1, Math.floor(args.iterations)) : DEFAULT_COMPONENT_BBOX_COLLIDE_ITERATIONS
  let paddingX = Number.isFinite(args.paddingX) ? Math.max(0, args.paddingX) : DEFAULT_COMPONENT_BBOX_COLLIDE_PADDING
  let paddingY = Number.isFinite(args.paddingY) ? Math.max(0, args.paddingY) : DEFAULT_COMPONENT_BBOX_COLLIDE_PADDING

  const nodeBboxCfg = readCollisionConfig(schema).nodeBbox
  const nodeBorderGapMinPx = nodeBboxCfg.borderGapPx

  const componentStates: ComponentState[] = []
  const activeStates: ComponentState[] = []

  const rebuildComponents = (ns: GraphNode[]) => {
    componentStates.length = 0
    if (!ns.length) return

    const nodeIndexById = new Map<string, number>()
    const nodeIds: string[] = []
    for (let i = 0; i < ns.length; i += 1) {
      const id = String(ns[i]?.id || '').trim()
      nodeIds.push(id)
      if (id) nodeIndexById.set(id, i)
    }

    const uf = unionFind(ns.length)
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i]
      const s = coerceEndpointId(e.source)
      const t = coerceEndpointId(e.target)
      if (!s || !t) continue
      const si = nodeIndexById.get(s)
      const ti = nodeIndexById.get(t)
      if (si == null || ti == null) continue
      uf.union(si, ti)
    }

    const membersByRoot = new Map<number, number[]>()
    for (let i = 0; i < ns.length; i += 1) {
      const root = uf.find(i)
      const list = membersByRoot.get(root)
      if (list) list.push(i)
      else membersByRoot.set(root, [i])
    }

    membersByRoot.forEach((memberIdxs) => {
      memberIdxs.sort((a, b) => a - b)
      let minId = ''
      for (let i = 0; i < memberIdxs.length; i += 1) {
        const id = nodeIds[memberIdxs[i]!] || ''
        if (!id) continue
        if (!minId || id < minId) minId = id
      }
      const id = minId ? `component:${minId}` : `component:${componentStates.length}`
      componentStates.push({
        id,
        memberIdxs,
        movableIdxs: [],
        cx: 0,
        cy: 0,
        cz: undefined,
        halfW: 1,
        halfH: 1,
        halfD: undefined,
        gap: 0,
        gapX: 0,
        gapY: 0,
        gapZ: undefined,
        empty: false,
      })
    })
  }

  const updateComponentAabbs = () => {
    if (componentStates.length === 0) return
    const gapSideX = paddingX * 0.5
    const gapSideY = paddingY * 0.5
    const gapSide = Math.max(gapSideX, gapSideY)
    activeStates.length = 0

    for (let i = 0; i < componentStates.length; i += 1) {
      const c = componentStates[i]!
      c.gap = gapSide
      c.gapX = gapSideX
      c.gapY = gapSideY
      c.gapZ = undefined
      c.movableIdxs.length = 0

      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      let saw = false

      const memberIdxs = c.memberIdxs
      for (let j = 0; j < memberIdxs.length; j += 1) {
        const idx = memberIdxs[j]!
        const n = nodes[idx]!
        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x == null || y == null) continue

        const ext = getNodeAabbHalfExtentsWithLabel(n, schema)
        const borderGapPx = computeBorderGapPx(readNodeStrokeWidthPx(schema, n), nodeBorderGapMinPx)
        const halfW = ext.halfW + nodeBboxCfg.paddingX + borderGapPx
        const halfH = ext.halfH + nodeBboxCfg.paddingY + borderGapPx
        const loX = x - halfW
        const hiX = x + halfW
        const loY = y - halfH
        const hiY = y + halfH

        if (loX < minX) minX = loX
        if (hiX > maxX) maxX = hiX
        if (loY < minY) minY = loY
        if (hiY > maxY) maxY = hiY
        saw = true

        if (!isPinned(n)) c.movableIdxs.push(idx)
      }

      if (!saw) {
        c.empty = true
        continue
      }
      c.empty = false
      const w = Math.max(1, maxX - minX)
      const h = Math.max(1, maxY - minY)
      c.cx = (minX + maxX) / 2
      c.cy = (minY + maxY) / 2
      c.halfW = w / 2
      c.halfH = h / 2
      activeStates.push(c)
    }
  }

  const force = (alpha: number) => {
    const k = alpha * strength * iterations
    if (k <= 0 || nodes.length < 2 || componentStates.length < 2) return
    if (componentStates.length > 220) return

    updateComponentAabbs()
    if (activeStates.length < 2) return

    resolveGroupCollisions({
      groups: activeStates,
      nodes,
      strength: k,
      touchEpsilon: touchEpsilonPx,
      touchEpsilonX: touchEpsilonXPx,
      touchEpsilonY: touchEpsilonYPx,
      skipSameGroup: true,
    })
  }

  force.initialize = (ns: GraphNode[]) => {
    nodes = ns || []
    rebuildComponents(nodes)
  }

  ;(force as unknown as { strength: (v: number) => unknown }).strength = (v: number) => {
    strength = Number.isFinite(v) ? Math.max(0, v) : strength
    return force
  }
  ;(force as unknown as { iterations: (v: number) => unknown }).iterations = (v: number) => {
    iterations = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : iterations
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
