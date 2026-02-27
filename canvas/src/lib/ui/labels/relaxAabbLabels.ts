import { integrateNodePositionWithVelocity, runRelaxSteps } from '@/lib/graph/collision/relaxRunner'

export type AabbRect = { x: number; y: number; halfW: number; halfH: number }

export type AabbLabelParticle = {
  id: string
  baseX: number
  baseY: number
  x: number
  y: number
  vx: number
  vy: number
  halfW: number
  halfH: number
  dxClamp: number
  dyClamp: number
  weight: number
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

export function relaxAabbLabels(args: {
  particles: AabbLabelParticle[]
  blockers?: AabbRect[]
  steps?: number
  maxOps?: number
}): void {
  const nodes = args.particles
  if (!nodes || nodes.length < 2) return
  const steps = typeof args.steps === 'number' && Number.isFinite(args.steps) ? Math.max(1, Math.floor(args.steps)) : 18
  const maxOps = typeof args.maxOps === 'number' && Number.isFinite(args.maxOps) ? Math.max(1000, Math.floor(args.maxOps)) : 36_000
  const blockers = args.blockers || []

  const collide = (alpha: number) => {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i]
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const ox = a.halfW + b.halfW - Math.abs(dx)
        const oy = a.halfH + b.halfH - Math.abs(dy)
        if (!(ox > 0 && oy > 0)) continue
        const wa = Math.max(0.05, a.weight)
        const wb = Math.max(0.05, b.weight)
        const total = wa + wb
        const fa = total > 0 ? wb / total : 0.5
        const fb = total > 0 ? wa / total : 0.5
        if (ox < oy) {
          const s = dx >= 0 ? 1 : -1
          const push = ox * 0.5 * alpha
          a.vx += push * s * fa
          b.vx -= push * s * fb
        } else {
          const s = dy >= 0 ? 1 : -1
          const push = oy * 0.5 * alpha
          a.vy += push * s * fa
          b.vy -= push * s * fb
        }
      }
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i]
      for (let j = 0; j < blockers.length; j += 1) {
        const b = blockers[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const ox = a.halfW + b.halfW - Math.abs(dx)
        const oy = a.halfH + b.halfH - Math.abs(dy)
        if (!(ox > 0 && oy > 0)) continue
        if (ox < oy) {
          const s = dx >= 0 ? 1 : -1
          a.vx += ox * 0.7 * alpha * s
        } else {
          const s = dy >= 0 ? 1 : -1
          a.vy += oy * 0.7 * alpha * s
        }
      }
    }
  }

  const pullToBase = (alpha: number) => {
    const strength = 0.012 * alpha
    for (let i = 0; i < nodes.length; i += 1) {
      const p = nodes[i]
      p.vx += (p.baseX - p.x) * strength
      p.vy += (p.baseY - p.y) * strength
    }
  }

  runRelaxSteps({
    nodes,
    steps,
    forces: [collide, pullToBase],
    maxOps,
    integrate: n => {
      integrateNodePositionWithVelocity(n, { damping: 0.58, z: { mode: 'never' } })
      const dx = clamp(n.x - n.baseX, -n.dxClamp, n.dxClamp)
      const dy = clamp(n.y - n.baseY, -n.dyClamp, n.dyClamp)
      n.x = n.baseX + dx
      n.y = n.baseY + dy
    },
  })
}

