
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

  const maxAxisPush = 80
  const maxVelDelta = 140
  const clampAbs = (v: number, maxAbs: number): number => {
    if (!Number.isFinite(v)) return 0
    const a = Math.abs(v)
    if (a <= maxAbs) return v
    return v < 0 ? -maxAbs : maxAbs
  }

  const sx = dx < 0 ? -1 : 1
  const sy = dy < 0 ? -1 : 1
  const sz = dz < 0 ? -1 : 1

  const useZ = oz !== Infinity
  const minOverlap = Math.min(ox, oy, oz)
  const maxOverlap2d = Math.max(ox, oy)
  const minOverlap2d = Math.min(ox, oy)
  const useBlend2d = !useZ && maxOverlap2d > 0 && minOverlap2d / maxOverlap2d > 0.72

  const pushAxis = (axis: 'x' | 'y' | 'z', push: number) => {
    if (push === 0) return
    if (axis === 'x') {
      if (aMovable > 0) {
        const per = clampAbs((push * k * splitA) / aMovable, maxVelDelta)
        for (let m = 0; m < aMovable; m += 1) {
          const n = nodes[aMovableIdxs[m]!]
          if (n) n.vx = (n.vx ?? 0) + per
        }
      }
      if (bMovable > 0) {
        const per = clampAbs((-push * k * splitB) / bMovable, maxVelDelta)
        for (let m = 0; m < bMovable; m += 1) {
          const n = nodes[bMovableIdxs[m]!]
          if (n) n.vx = (n.vx ?? 0) + per
        }
      }
      return
    }
    if (axis === 'y') {
      if (aMovable > 0) {
        const per = clampAbs((push * k * splitA) / aMovable, maxVelDelta)
        for (let m = 0; m < aMovable; m += 1) {
          const n = nodes[aMovableIdxs[m]!]
          if (n) n.vy = (n.vy ?? 0) + per
        }
      }
      if (bMovable > 0) {
        const per = clampAbs((-push * k * splitB) / bMovable, maxVelDelta)
        for (let m = 0; m < bMovable; m += 1) {
          const n = nodes[bMovableIdxs[m]!]
          if (n) n.vy = (n.vy ?? 0) + per
        }
      }
      return
    }
    if (aMovable > 0) {
      const per = clampAbs((push * k * splitA) / aMovable, maxVelDelta)
      for (let m = 0; m < aMovable; m += 1) {
        const n = nodes[aMovableIdxs[m]!]
        if (n) n.vz = (n.vz ?? 0) + per
      }
    }
    if (bMovable > 0) {
      const per = clampAbs((-push * k * splitB) / bMovable, maxVelDelta)
      for (let m = 0; m < bMovable; m += 1) {
        const n = nodes[bMovableIdxs[m]!]
        if (n) n.vz = (n.vz ?? 0) + per
      }
    }
  }

  if (useBlend2d) {
    const scale = 0.55
    const pushX = clampAbs(ox * sx * scale, maxAxisPush)
    const pushY = clampAbs(oy * sy * scale, maxAxisPush)
    pushAxis('x', pushX)
    pushAxis('y', pushY)
    return
  }

  if (minOverlap === ox) {
    pushAxis('x', clampAbs(ox, maxAxisPush) * sx)
    return
  }
  if (minOverlap === oy) {
    pushAxis('y', clampAbs(oy, maxAxisPush) * sy)
    return
  }
  pushAxis('z', clampAbs(oz, maxAxisPush) * sz)
}
