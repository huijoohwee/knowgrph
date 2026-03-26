import type { MovableNode } from './types.js'

export function applyAabbContainmentPush(args: {
  nodes: MovableNode[]
  movableIdxs: number[]
  pushX: number
  pushY: number
  pushZ?: number
  k: number
}) {
  const { nodes, movableIdxs, pushX, pushY, k } = args
  if (!Number.isFinite(k) || k <= 0) return
  if (!Array.isArray(movableIdxs) || movableIdxs.length === 0) return

  const pushZRaw = args.pushZ
  const pushZ = typeof pushZRaw === 'number' && Number.isFinite(pushZRaw) ? pushZRaw : 0

  const maxVelDelta = 140
  const clampAbs = (v: number, maxAbs: number): number => {
    if (!Number.isFinite(v)) return 0
    const a = Math.abs(v)
    if (a <= maxAbs) return v
    return v < 0 ? -maxAbs : maxAbs
  }

  const count = movableIdxs.length
  const dx = clampAbs(((Number.isFinite(pushX) ? pushX : 0) * k) / count, maxVelDelta)
  const dy = clampAbs(((Number.isFinite(pushY) ? pushY : 0) * k) / count, maxVelDelta)
  const dz = clampAbs((pushZ * k) / count, maxVelDelta)
  if (dx === 0 && dy === 0 && dz === 0) return

  for (let i = 0; i < movableIdxs.length; i += 1) {
    const idx = movableIdxs[i]!
    const n = nodes[idx]
    if (!n) continue

    const vx0 = typeof n.vx === 'number' && Number.isFinite(n.vx) ? n.vx : 0
    const vy0 = typeof n.vy === 'number' && Number.isFinite(n.vy) ? n.vy : 0
    const vz0 = typeof n.vz === 'number' && Number.isFinite(n.vz) ? n.vz : 0

    n.vx = vx0 + dx
    n.vy = vy0 + dy
    n.vz = vz0 + dz
  }
}
