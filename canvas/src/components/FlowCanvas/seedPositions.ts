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

export function looksUnstablePositions(args: {
  nodes: ReadonlyArray<{ id: unknown }>
  positions: Record<string, { x: number; y: number }> | null
  nodeSize?: { widthPx: number; heightPx: number }
  maxExtentPx?: number
}): boolean {
  const positions = args.positions
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  if (!positions || nodes.length === 0) return false

  const nodeW = Math.max(1, Math.floor(args.nodeSize?.widthPx ?? 180))
  const nodeH = Math.max(1, Math.floor(args.nodeSize?.heightPx ?? 48))
  const maxExtent = Math.max(5_000, Math.floor(args.maxExtentPx ?? 100_000))

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let ok = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id ?? '')
    if (!id) continue
    const p = positions[id]
    if (!p) continue
    const x = p.x
    const y = p.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    ok += 1
  }
  if (ok < 3 || minX === Infinity) return false

  const w = maxX - minX
  const h = maxY - minY

  if (!Number.isFinite(w) || !Number.isFinite(h)) return true
  if (w > maxExtent || h > maxExtent) return true

  const minClusterW = Math.max(nodeW * 2, 80)
  const minClusterH = Math.max(nodeH * 2, 80)
  if (ok >= 12 && w < minClusterW && h < minClusterH) return true

  return false
}
