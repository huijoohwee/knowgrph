export type RelaxForce = (alpha: number) => void

const DEFAULT_ALPHA_FOR_STEP = (step: number): number => Math.max(0.05, 0.9 - step * 0.12)

const readFiniteNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function runRelaxSteps<T>(args: {
  nodes: T[]
  steps: number
  forces: RelaxForce[]
  alphaForStep?: (step: number) => number
  integrate: (node: T) => void
}): void {
  const { nodes, steps, forces, integrate } = args
  if (!Array.isArray(nodes) || nodes.length === 0) return
  if (!Number.isFinite(steps) || steps <= 0) return

  const alphaForStep = args.alphaForStep || DEFAULT_ALPHA_FOR_STEP

  for (let step = 0; step < steps; step += 1) {
    const alpha = alphaForStep(step)
    for (let i = 0; i < forces.length; i += 1) forces[i](alpha)
    for (let i = 0; i < nodes.length; i += 1) integrate(nodes[i])
  }
}

export function integrateNodePositionWithVelocity<T extends { x?: unknown; y?: unknown; vx?: unknown; vy?: unknown }>(
  node: T,
  args: {
    damping: number
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
  const vx = readFiniteNumber(node.vx, 0)
  const vy = readFiniteNumber(node.vy, 0)
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
    const vz = readFiniteNumber(anyNode.vz, 0)
    anyNode.vz = vz * args.damping
    return
  }

  const anyNode = node as unknown as { z?: unknown; vz?: unknown }
  const vz = readFiniteNumber(anyNode.vz, 0)
  const z = readFiniteNumber(anyNode.z, 0)
  anyNode.z = z + vz
  anyNode.vz = vz * args.damping

}
