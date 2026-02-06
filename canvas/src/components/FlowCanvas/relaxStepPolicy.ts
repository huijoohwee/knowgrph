const coerceCount = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  return Math.max(0, Math.floor(n))
}

export function computeFlowDragRelaxPolicy(args: {
  nodeCount: number
  groupCount: number
}): { enabled: boolean; steps: number; minIntervalMs: number } {
  const nodeCount = coerceCount(args.nodeCount)
  const groupCount = coerceCount(args.groupCount)

  if (nodeCount > 1200) return { enabled: false, steps: 0, minIntervalMs: 0 }

  const minIntervalMs = nodeCount > 600 ? 48 : nodeCount > 300 ? 32 : 16

  let steps = groupCount > 0 ? 2 : 1
  if (nodeCount <= 150) steps = groupCount > 0 ? 3 : 2
  if (nodeCount <= 60) steps = groupCount > 0 ? 4 : 3
  steps = Math.max(0, Math.min(4, steps))

  return { enabled: steps > 0, steps, minIntervalMs }
}

export function computeFlowCommitRelaxSteps(args: { nodeCount: number; groupCount: number }): number {
  const nodeCount = coerceCount(args.nodeCount)
  const groupCount = coerceCount(args.groupCount)

  const base = groupCount > 0 ? 14 : 10
  if (nodeCount <= 300) return base
  if (nodeCount <= 600) return groupCount > 0 ? 10 : 8
  if (nodeCount <= 1200) return groupCount > 0 ? 7 : 6
  return groupCount > 0 ? 5 : 4
}

