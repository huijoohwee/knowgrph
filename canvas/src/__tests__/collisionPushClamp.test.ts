import { applyAabbContainmentPush, applyAabbOverlapPush } from '@/lib/graph/collision/boxCollision'

export const testCollisionPushClampsVelocityDelta = () => {
  const nodes: Array<{ vx?: number; vy?: number; vz?: number }> = [{}, {}]
  applyAabbOverlapPush({
    nodes: nodes as any,
    aMovableIdxs: [0],
    bMovableIdxs: [1],
    dx: 10,
    dy: 0,
    dz: 0,
    ox: 10_000,
    oy: 20_000,
    oz: Infinity,
    k: 2,
  })
  const v0 = Math.abs(nodes[0].vx ?? 0)
  const v1 = Math.abs(nodes[1].vx ?? 0)
  if (!(v0 > 0 && v1 > 0)) throw new Error('expected overlap push to apply velocity')
  if (!(v0 <= 200 && v1 <= 200)) throw new Error('expected overlap push to clamp velocity deltas')

  const nodes2: Array<{ vx?: number; vy?: number; vz?: number }> = [{}, {}, {}]
  applyAabbContainmentPush({
    nodes: nodes2 as any,
    movableIdxs: [0, 1, 2],
    pushX: 1_000_000,
    pushY: -1_000_000,
    pushZ: 0,
    k: 1,
  })
  for (let i = 0; i < nodes2.length; i += 1) {
    const vx = Math.abs(nodes2[i].vx ?? 0)
    const vy = Math.abs(nodes2[i].vy ?? 0)
    if (!(vx > 0 && vy > 0)) throw new Error('expected containment push to apply velocity')
    if (!(vx <= 200 && vy <= 200)) throw new Error('expected containment push to clamp velocity deltas')
  }
}
