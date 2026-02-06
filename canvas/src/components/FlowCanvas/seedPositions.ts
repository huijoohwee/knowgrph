export function hasCacheCoverage(args: {
  nodes: ReadonlyArray<{ id: unknown }>
  positions: Record<string, { x: number; y: number }> | null
  minCoverage: number
}): boolean {
  const nodes = args.nodes
  const cached = args.positions
  if (!cached) return false
  if (!Array.isArray(nodes) || nodes.length === 0) return false
  let ok = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id ?? '')
    if (!id) continue
    const p = cached[id]
    if (!p) continue
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    ok += 1
  }
  return ok / Math.max(1, nodes.length) >= args.minCoverage
}

export function extractNodePositions(
  nodes: ReadonlyArray<{ id?: unknown; x?: unknown; y?: unknown }>,
): Record<string, { x: number; y: number }> | null {
  if (!Array.isArray(nodes) || nodes.length === 0) return null
  const out: Record<string, { x: number; y: number }> = {}
  let ok = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id ?? '').trim()
    if (!id) continue
    const x = typeof n?.x === 'number' ? n.x : NaN
    const y = typeof n?.y === 'number' ? n.y : NaN
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out[id] = { x, y }
    ok += 1
  }
  if (ok === 0) return null
  return out
}

