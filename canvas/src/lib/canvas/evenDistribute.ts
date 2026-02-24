export type DistributePoint = { id: string; x: number; y: number }

export function computeEvenlyDistributedPositions(args: {
  nodes: DistributePoint[]
  axis: 'x' | 'y'
  minSpacing: number
}): Record<string, { x: number; y: number }> {
  const axis = args.axis === 'y' ? 'y' : 'x'
  const minSpacing = Number.isFinite(args.minSpacing) ? Math.max(1, args.minSpacing) : 120
  const pts = Array.isArray(args.nodes) ? args.nodes : []
  const valid = pts
    .map(n => ({ id: String(n.id || ''), x: Number(n.x), y: Number(n.y) }))
    .filter(n => n.id && Number.isFinite(n.x) && Number.isFinite(n.y))
  if (valid.length === 0) return {}
  if (valid.length === 1) return { [valid[0].id]: { x: valid[0].x, y: valid[0].y } }

  const sorted = [...valid].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y))
  const n = sorted.length
  let min = Infinity
  let max = -Infinity
  let sum = 0
  for (let i = 0; i < n; i += 1) {
    const v = axis === 'x' ? sorted[i].x : sorted[i].y
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  const centroid = sum / n
  const currentSpacing = (max - min) / Math.max(1, n - 1)
  const spacing = Math.max(minSpacing, Number.isFinite(currentSpacing) ? currentSpacing : minSpacing)
  const start = centroid - (spacing * (n - 1)) / 2

  const out: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < n; i += 1) {
    const p = sorted[i]
    const v = start + spacing * i
    out[p.id] = axis === 'x' ? { x: v, y: p.y } : { x: p.x, y: v }
  }
  return out
}

