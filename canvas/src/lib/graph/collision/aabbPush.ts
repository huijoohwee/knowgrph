import type { GraphNode } from '@/lib/graph/types'

export function applyAabbOverlapPush(args: {
  nodes: GraphNode[]
  aMovableIdxs: number[]
  bMovableIdxs: number[]
  dx: number
  dy: number
  ox: number
  oy: number
  k: number
}): void {
  const { nodes, aMovableIdxs, bMovableIdxs, dx, dy, ox, oy, k } = args
  if (ox <= 0 || oy <= 0 || k <= 0) return

  const aMovable = aMovableIdxs.length
  const bMovable = bMovableIdxs.length
  if (aMovable === 0 && bMovable === 0) return

  const splitA = aMovable === 0 ? 0 : bMovable === 0 ? 1 : 0.5
  const splitB = aMovable === 0 ? 1 : bMovable === 0 ? 0 : 0.5

  if (ox < oy) {
    const sx = dx < 0 ? -1 : 1
    const push = ox * sx
    if (aMovable > 0) {
      const per = (push * k * splitA) / aMovable
      for (let m = 0; m < aMovable; m += 1) {
        const n = nodes[aMovableIdxs[m]!]!
        n.vx = (n.vx ?? 0) + per
      }
    }
    if (bMovable > 0) {
      const per = (-push * k * splitB) / bMovable
      for (let m = 0; m < bMovable; m += 1) {
        const n = nodes[bMovableIdxs[m]!]!
        n.vx = (n.vx ?? 0) + per
      }
    }
    return
  }

  const sy = dy < 0 ? -1 : 1
  const push = oy * sy
  if (aMovable > 0) {
    const per = (push * k * splitA) / aMovable
    for (let m = 0; m < aMovable; m += 1) {
      const n = nodes[aMovableIdxs[m]!]!
      n.vy = (n.vy ?? 0) + per
    }
  }
  if (bMovable > 0) {
    const per = (-push * k * splitB) / bMovable
    for (let m = 0; m < bMovable; m += 1) {
      const n = nodes[bMovableIdxs[m]!]!
      n.vy = (n.vy ?? 0) + per
    }
  }
}

