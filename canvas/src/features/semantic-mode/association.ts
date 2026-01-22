const clampNumber = (v: number, min: number, max: number): number => {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

export const computePpmi = (args: {
  pairCounts: Map<string, number>
  entityBlockCounts: Map<string, number>
  blockCount: number
}): Map<string, number> => {
  const out = new Map<string, number>()
  const blocks = Number.isFinite(args.blockCount) ? Math.max(0, Math.floor(args.blockCount)) : 0
  if (blocks <= 0) return out
  const total = blocks
  args.pairCounts.forEach((cnt, key) => {
    const parts = key.split('|')
    const a = parts[0] || ''
    const b = parts[1] || ''
    if (!a || !b) return
    const ca = args.entityBlockCounts.get(a) || 0
    const cb = args.entityBlockCounts.get(b) || 0
    if (ca <= 0 || cb <= 0 || cnt <= 0) return
    const pAb = cnt / total
    const pA = ca / total
    const pB = cb / total
    const denom = pA * pB
    if (denom <= 0 || pAb <= 0) return
    const pmi = Math.log(pAb / denom)
    if (!(pmi > 0)) return
    out.set(key, pmi)
  })
  return out
}

export const deriveEdgeWidthFromStrength = (args: { count: number; weight: number }): number => {
  const c = Number.isFinite(args.count) ? Math.max(0, args.count) : 0
  const w = Number.isFinite(args.weight) ? Math.max(0, args.weight) : 0
  const width = 1 + Math.sqrt(c) * 0.7 + w * 0.7
  return clampNumber(width, 1, 8)
}

