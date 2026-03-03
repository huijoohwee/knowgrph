import type * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'
import type { DisjointComponentTargets } from '@/components/GraphCanvas/layout/disjoint'

export const createDisjointComponentsForce = (args: {
  schema: GraphSchema
  disjointLayout: DisjointComponentTargets
  paddingPx: number
  strength: number
  alphaMin?: number
  tickInterval?: number
  maxPairwiseComponents?: number
}): d3.Force<GraphNode, GraphEdge> => {
  const strength = Number.isFinite(args.strength) ? Math.max(0, Math.min(2, args.strength)) : 0.1
  const paddingPx = Number.isFinite(args.paddingPx) ? Math.max(0, args.paddingPx) : 0
  const alphaMin = typeof args.alphaMin === 'number' && Number.isFinite(args.alphaMin) ? Math.max(0, args.alphaMin) : 0.02
  const tickInterval =
    typeof args.tickInterval === 'number' && Number.isFinite(args.tickInterval) ? Math.max(1, Math.floor(args.tickInterval)) : 6
  const maxPairwiseComponents =
    typeof args.maxPairwiseComponents === 'number' && Number.isFinite(args.maxPairwiseComponents)
      ? Math.max(2, Math.floor(args.maxPairwiseComponents))
      : 90

  let nodes: GraphNode[] = []
  let tick = 0

  let nodeRadiusById: Map<string, number> | null = null
  let componentIds: number[] = []
  let componentCount = 0

  const ensureCaches = () => {
    if (nodeRadiusById) return
    nodeRadiusById = new Map<string, number>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const ext = getNodeHalfExtents2d(n, args.schema)
      const r = Math.max(2, ext.halfW, ext.halfH)
      nodeRadiusById.set(String(n.id), r)
    }
    componentIds = Array.from(args.disjointLayout.targetsByComponent.keys()).sort((a, b) => a - b)
    componentCount = componentIds.length
  }

  const force = ((alpha: number) => {
    tick += 1
    if (componentCount <= 1) return
    if (alpha < alphaMin) return
    if (tickInterval > 1 && tick % tickInterval !== 0) return

    ensureCaches()
    if (!nodeRadiusById) return

    const maxCompId = componentIds.length > 0 ? componentIds[componentIds.length - 1]! : -1
    if (maxCompId < 0) return
    const size = maxCompId + 1

    const minX = new Array<number>(size).fill(Number.POSITIVE_INFINITY)
    const minY = new Array<number>(size).fill(Number.POSITIVE_INFINITY)
    const maxX = new Array<number>(size).fill(Number.NEGATIVE_INFINITY)
    const maxY = new Array<number>(size).fill(Number.NEGATIVE_INFINITY)
    const count = new Array<number>(size).fill(0)

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n.id)
      const comp = args.disjointLayout.componentByNodeId.get(id)
      if (comp == null) continue
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
      if (x == null || y == null) continue
      const r = nodeRadiusById.get(id) || 2
      minX[comp] = Math.min(minX[comp]!, x - r)
      maxX[comp] = Math.max(maxX[comp]!, x + r)
      minY[comp] = Math.min(minY[comp]!, y - r)
      maxY[comp] = Math.max(maxY[comp]!, y + r)
      count[comp] = (count[comp] || 0) + 1
    }

    const cx = new Array<number>(size).fill(0)
    const cy = new Array<number>(size).fill(0)
    const cr = new Array<number>(size).fill(0)
    const active: number[] = []

    for (let i = 0; i < componentIds.length; i += 1) {
      const comp = componentIds[i]!
      if (!count[comp]) continue
      const x0 = minX[comp]!
      const y0 = minY[comp]!
      const x1 = maxX[comp]!
      const y1 = maxY[comp]!
      cx[comp] = (x0 + x1) / 2
      cy[comp] = (y0 + y1) / 2
      cr[comp] = Math.max(10, Math.max(x1 - x0, y1 - y0) / 2)
      active.push(comp)
    }

    const compVx = new Array<number>(size).fill(0)
    const compVy = new Array<number>(size).fill(0)

    const pairwise = active.length <= maxPairwiseComponents
    if (pairwise) {
      for (let ai = 0; ai < active.length; ai += 1) {
        const a = active[ai]!
        for (let bi = ai + 1; bi < active.length; bi += 1) {
          const b = active[bi]!
          const dx = cx[b]! - cx[a]!
          const dy = cy[b]! - cy[a]!
          const dist = Math.hypot(dx, dy)
          const minDist = cr[a]! + cr[b]! + paddingPx
          if (!(dist < minDist)) continue
          const d = dist > 1e-6 ? dist : 1e-6
          const overlap = (minDist - d) / d
          const push = overlap * strength * alpha
          const ux = dx / d
          const uy = dy / d
          compVx[a] -= ux * push
          compVy[a] -= uy * push
          compVx[b] += ux * push
          compVy[b] += uy * push
        }
      }
    }

    for (let ai = 0; ai < active.length; ai += 1) {
      const c = active[ai]!
      const tgt = args.disjointLayout.targetsByComponent.get(c)
      if (!tgt) continue
      const dx = tgt.x - cx[c]!
      const dy = tgt.y - cy[c]!
      const pull = strength * 0.4 * alpha
      compVx[c] += dx * pull * 0.001
      compVy[c] += dy * pull * 0.001
    }

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const comp = args.disjointLayout.componentByNodeId.get(String(n.id))
      if (comp == null) continue
      const denom = count[comp] || 0
      if (denom <= 0) continue
      n.vx = (n.vx || 0) + (compVx[comp]! / denom)
      n.vy = (n.vy || 0) + (compVy[comp]! / denom)
    }
  }) as unknown as d3.Force<GraphNode, GraphEdge>

  force.initialize = (ns: GraphNode[]) => {
    nodes = ns
    tick = 0
    nodeRadiusById = null
    componentIds = []
    componentCount = 0
    ensureCaches()
  }

  return force
}
