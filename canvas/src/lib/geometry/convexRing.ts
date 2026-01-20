export type Point2d = { x: number; y: number }

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const cross = (o: Point2d, a: Point2d, b: Point2d) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

export const computeConvexRing = (raw: Point2d[]): Point2d[] => {
  const pts: Point2d[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const p = raw[i]
    if (!p) continue
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) continue
    pts.push({ x: p.x, y: p.y })
  }
  
  if (pts.length <= 2) return pts

  pts.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))

  const unique: Point2d[] = []
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]!
    const last = unique[unique.length - 1]
    if (last && last.x === p.x && last.y === p.y) continue
    unique.push(p)
  }
  if (unique.length <= 2) return unique

  const lower: Point2d[] = []
  for (let i = 0; i < unique.length; i += 1) {
    const p = unique[i]!
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  const upper: Point2d[] = []
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const p = unique[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  lower.pop()
  upper.pop()
  const ring = [...lower, ...upper]
  return ring.length >= 3 ? ring : unique
}

export const buildClosedPathD = (ring: Point2d[]): string | null => {
  if (!ring || ring.length === 0) return null
  const first = ring[0]
  if (!first) return null
  let d = `M${first.x},${first.y}`
  for (let i = 1; i < ring.length; i += 1) {
    const p = ring[i]!
    d += `L${p.x},${p.y}`
  }
  d += 'Z'
  return d
}
