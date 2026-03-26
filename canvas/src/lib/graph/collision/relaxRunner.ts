export type RelaxForce = (alpha: number) => void

const DEFAULT_ALPHA_FOR_STEP = (step: number): number => Math.max(0.05, 0.9 - step * 0.12)

const readFiniteNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function runRelaxSteps<T>(args: {
  nodes: T[]
  steps: number
  forces: RelaxForce[]
  alphaForStep?: (step: number) => number
  maxOps?: number
  integrate: (node: T) => void
}): void {
  const { nodes, steps, forces, integrate } = args
  if (!Array.isArray(nodes) || nodes.length === 0) return
  if (!Number.isFinite(steps) || steps <= 0) return

  const alphaForStep = args.alphaForStep || DEFAULT_ALPHA_FOR_STEP
  const maxOps = typeof args.maxOps === 'number' && Number.isFinite(args.maxOps) ? Math.max(0, Math.floor(args.maxOps)) : 40_000
  const safeSteps = maxOps > 0 ? Math.min(Math.floor(steps), Math.max(0, Math.floor(maxOps / Math.max(1, nodes.length)))) : Math.floor(steps)
  if (safeSteps <= 0) return

  for (let step = 0; step < safeSteps; step += 1) {
    const alpha = alphaForStep(step)
    for (let i = 0; i < forces.length; i += 1) forces[i](alpha)
    for (let i = 0; i < nodes.length; i += 1) integrate(nodes[i])
  }
}

export function integrateNodePositionWithVelocity<T extends { x?: unknown; y?: unknown; vx?: unknown; vy?: unknown }>(
  node: T,
  args: {
    damping: number
    maxStep?: {
      x?: number
      y?: number
      z?: number
    }
    z?:
      | {
          mode: 'always'
        }
      | {
          mode: 'predicate'
          enabled: (node: T) => boolean
        }
      | {
          mode: 'never'
        }
  },
): void {
  const clampAbs = (v: number, maxAbs: number | null): number => {
    if (!Number.isFinite(v)) return 0
    if (maxAbs == null || !Number.isFinite(maxAbs) || maxAbs <= 0) return v
    const a = Math.abs(v)
    if (a <= maxAbs) return v
    return v < 0 ? -maxAbs : maxAbs
  }

  const vx = clampAbs(readFiniteNumber(node.vx, 0), typeof args.maxStep?.x === 'number' ? args.maxStep.x : null)
  const vy = clampAbs(readFiniteNumber(node.vy, 0), typeof args.maxStep?.y === 'number' ? args.maxStep.y : null)
  const x = readFiniteNumber(node.x, 0)
  const y = readFiniteNumber(node.y, 0)

  ;(node as unknown as { x: number }).x = x + vx
  ;(node as unknown as { y: number }).y = y + vy
  ;(node as unknown as { vx: number }).vx = vx * args.damping
  ;(node as unknown as { vy: number }).vy = vy * args.damping

  const zConfig = args.z
  if (!zConfig || zConfig.mode === 'never') return
  if (zConfig.mode === 'predicate' && zConfig.enabled(node) !== true) {
    const anyNode = node as unknown as { vz?: unknown }
    const vz = clampAbs(readFiniteNumber(anyNode.vz, 0), typeof args.maxStep?.z === 'number' ? args.maxStep.z : null)
    anyNode.vz = vz * args.damping
    return
  }

  const anyNode = node as unknown as { z?: unknown; vz?: unknown }
  const vz = clampAbs(readFiniteNumber(anyNode.vz, 0), typeof args.maxStep?.z === 'number' ? args.maxStep.z : null)
  const z = readFiniteNumber(anyNode.z, 0)
  anyNode.z = z + vz
  anyNode.vz = vz * args.damping

}
