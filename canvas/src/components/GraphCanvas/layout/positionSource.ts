import type { GraphNode } from '@/lib/graph/types'

type PositionMap = Record<string, { x: number; y: number }>

export const pickLayoutPositionsSource = (args: {
  nodes: GraphNode[]
  cached: PositionMap | null
  prev: PositionMap | null
  preferPrevMedianDeltaThreshold?: number
}): PositionMap | null => {
  const cached = args.cached
  const prev = args.prev
  if (!cached) return prev
  if (!prev) return cached
  const nodes = args.nodes
  const threshold =
    typeof args.preferPrevMedianDeltaThreshold === 'number' && Number.isFinite(args.preferPrevMedianDeltaThreshold)
      ? args.preferPrevMedianDeltaThreshold
      : 120

  const coverage = (positions: PositionMap) => {
    if (!nodes || nodes.length === 0) return 0
    let matches = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const id = String(nodes[i]?.id)
      const p = positions[id]
      if (!p) continue
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      matches += 1
    }
    return matches / Math.max(1, nodes.length)
  }

  const prevCov = coverage(prev)
  const cachedCov = coverage(cached)
  if (prevCov >= 0.95 && cachedCov < 0.95) return prev
  if (cachedCov >= 0.95 && prevCov < 0.95) return cached

  const deltas: number[] = []
  for (let i = 0; i < nodes.length && deltas.length < 64; i += 1) {
    const id = String(nodes[i]?.id)
    const a = prev[id]
    const b = cached[id]
    if (!a || !b) continue
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue
    const dx = a.x - b.x
    const dy = a.y - b.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (!Number.isFinite(d)) continue
    deltas.push(d)
  }
  if (deltas.length === 0) return cached
  deltas.sort((x, y) => x - y)
  const median = deltas[Math.floor(deltas.length / 2)] || 0
  if (prevCov >= 0.95 && cachedCov >= 0.95 && median > threshold) return prev
  return cached
}
