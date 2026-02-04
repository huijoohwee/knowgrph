
import type { MovableNode } from './types.js'

export function applyAabbOverlapPush(args: {
  nodes: MovableNode[]
  aMovableIdxs: number[]
  bMovableIdxs: number[]
  dx: number
  dy: number
  dz: number
  ox: number
  oy: number
  oz: number
  k: number
}): void {
  const { nodes, aMovableIdxs, bMovableIdxs, dx, dy, dz, ox, oy, oz, k } = args
  // If any overlap is <= 0, no collision (assuming 3D check passed)
  // But wait, if it's 2D, oz might be undefined or infinite?
  // The caller should handle 2D vs 3D logic.
  // If oz is not provided/relevant, pass Infinity?
  // Let's assume the caller passes valid positive overlaps for axes that matter.
  
  if (ox <= 0 || oy <= 0 || (oz !== Infinity && oz <= 0) || k <= 0) return

  const aMovable = aMovableIdxs.length
  const bMovable = bMovableIdxs.length
  if (aMovable === 0 && bMovable === 0) return

  const splitA = aMovable === 0 ? 0 : bMovable === 0 ? 1 : 0.5
  const splitB = aMovable === 0 ? 1 : bMovable === 0 ? 0 : 0.5

  // Find Minimum Translation Vector axis
  // We compare ox, oy, and oz (if finite)
  
  const minOverlap = Math.min(ox, oy, oz)
  
  if (minOverlap === ox) {
    const sx = dx < 0 ? -1 : 1
    const push = ox * sx
    if (aMovable > 0) {
      const per = (push * k * splitA) / aMovable
      for (let m = 0; m < aMovable; m += 1) {
        const n = nodes[aMovableIdxs[m]!]
        if (n) n.vx = (n.vx ?? 0) + per
      }
    }
    if (bMovable > 0) {
      const per = (-push * k * splitB) / bMovable
      for (let m = 0; m < bMovable; m += 1) {
        const n = nodes[bMovableIdxs[m]!]
        if (n) n.vx = (n.vx ?? 0) + per
      }
    }
  } else if (minOverlap === oy) {
    const sy = dy < 0 ? -1 : 1
    const push = oy * sy
    if (aMovable > 0) {
      const per = (push * k * splitA) / aMovable
      for (let m = 0; m < aMovable; m += 1) {
        const n = nodes[aMovableIdxs[m]!]
        if (n) n.vy = (n.vy ?? 0) + per
      }
    }
    if (bMovable > 0) {
      const per = (-push * k * splitB) / bMovable
      for (let m = 0; m < bMovable; m += 1) {
        const n = nodes[bMovableIdxs[m]!]
        if (n) n.vy = (n.vy ?? 0) + per
      }
    }
  } else {
    // Z axis
    const sz = dz < 0 ? -1 : 1
    const push = oz * sz
    if (aMovable > 0) {
      const per = (push * k * splitA) / aMovable
      for (let m = 0; m < aMovable; m += 1) {
        const n = nodes[aMovableIdxs[m]!]
        if (n) n.vz = (n.vz ?? 0) + per
      }
    }
    if (bMovable > 0) {
      const per = (-push * k * splitB) / bMovable
      for (let m = 0; m < bMovable; m += 1) {
        const n = nodes[bMovableIdxs[m]!]
        if (n) n.vz = (n.vz ?? 0) + per
      }
    }
  }
}
