export function coverageOfPositions(
  nodes: ReadonlyArray<{ id: unknown }>,
  positions: Record<string, { x: number; y: number }> | null,
): number {
  if (!positions) return 0
  if (!Array.isArray(nodes) || nodes.length === 0) return 0
  let ok = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id ?? '')
    if (!id) continue
    const p = positions[id]
    if (!p) continue
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    ok += 1
  }
  return ok / Math.max(1, nodes.length)
}

export function pickSeedFromOtherRendererCache(args: {
  nodes: ReadonlyArray<{ id: unknown }>
  cache: Record<string, Record<string, { x: number; y: number }>> | null
  baseKey: string
  expectedKey?: string
  expectedLayoutVariant?: string
}): Record<string, { x: number; y: number }> | null {
  const cache = args.cache
  if (!cache) return null
  const baseKey = String(args.baseKey || '').trim()
  if (!baseKey) return null

  const expectedKey = String(args.expectedKey || '').trim()
  if (expectedKey) {
    const expected = cache[expectedKey]
    if (expected && typeof expected === 'object') return expected
  }

  const exact = cache[baseKey]
  if (exact && typeof exact === 'object') return exact

  const prefix = `${baseKey}:`
  const keys = Object.keys(cache)
  const expectedLayoutVariant = String(args.expectedLayoutVariant || '').trim()
  let best: Record<string, { x: number; y: number }> | null = null
  let bestCoverage = 0
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i]
    if (!k.startsWith(prefix)) continue
    const entry = cache[k]
    if (!entry || typeof entry !== 'object') continue
    const coverage = coverageOfPositions(args.nodes, entry)
    if (coverage > bestCoverage) {
      bestCoverage = coverage
      best = entry
      if (bestCoverage >= 0.98) {
        if (!expectedLayoutVariant || k.includes(expectedLayoutVariant)) break
      }
      continue
    }
    if (coverage === bestCoverage && expectedLayoutVariant && k.includes(expectedLayoutVariant)) {
      best = entry
    }
  }
  return best
}

