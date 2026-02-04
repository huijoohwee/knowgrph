export type Point2d = { x: number; y: number }

export type Rect = { x: number; y: number; w: number; h: number }

const rectIntersectsSegment = (r: Rect, a: Point2d, b: Point2d): boolean => {
  const x0 = r.x
  const y0 = r.y
  const x1 = r.x + r.w
  const y1 = r.y + r.h

  if (a.x === b.x) {
    const x = a.x
    if (x < x0 || x > x1) return false
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    return maxY >= y0 && minY <= y1
  }
  if (a.y === b.y) {
    const y = a.y
    if (y < y0 || y > y1) return false
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    return maxX >= x0 && minX <= x1
  }

  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  if (maxX < x0 || minX > x1 || maxY < y0 || minY > y1) return false
  return true
}

const expandRect = (r: Rect, pad: number): Rect => ({ x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 })

const pathHitsAnyObstacle = (points: Point2d[], obstacles: Rect[]): boolean => {
  if (points.length < 2 || obstacles.length === 0) return false
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    for (let j = 0; j < obstacles.length; j += 1) {
      if (rectIntersectsSegment(obstacles[j], a, b)) return true
    }
  }
  return false
}

const uniquePath = (points: Point2d[]): Point2d[] => {
  const out: Point2d[] = []
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev.x - p.x) < 0.01 && Math.abs(prev.y - p.y) < 0.01) continue
    out.push(p)
  }
  if (out.length >= 3) {
    const simplified: Point2d[] = [out[0]]
    for (let i = 1; i < out.length - 1; i += 1) {
      const a = simplified[simplified.length - 1]
      const b = out[i]
      const c = out[i + 1]
      const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
      if (collinear) continue
      simplified.push(b)
    }
    simplified.push(out[out.length - 1])
    return simplified
  }
  return out
}

export function routeFlowEdgeOrtho(args: {
  rankdir: 'LR' | 'TB'
  start: Point2d
  end: Point2d
  obstacles: Rect[]
  marginPx: number
  laneStepPx: number
  maxLanes: number
}): Point2d[] {
  const margin = Math.max(0, args.marginPx)
  const step = Math.max(4, args.laneStepPx)
  const maxLanes = Math.max(1, Math.floor(args.maxLanes))
  const obstacles = args.obstacles.map(r => expandRect(r, margin))

  const s = args.start
  const t = args.end

  const midPrimary = args.rankdir === 'LR' ? s.x + (t.x - s.x) * 0.5 : s.y + (t.y - s.y) * 0.5
  const midSecondary = args.rankdir === 'LR' ? s.y + (t.y - s.y) * 0.5 : s.x + (t.x - s.x) * 0.5

  const candidatesFor = (mid: number): number[] => {
    const candidates: number[] = [mid]
    for (let i = 1; i <= maxLanes; i += 1) {
      candidates.push(mid + i * step)
      candidates.push(mid - i * step)
    }
    return candidates
  }

  const buildPrimary = (lane: number): Point2d[] => {
    if (args.rankdir === 'LR') {
      return uniquePath([
        { x: s.x, y: s.y },
        { x: lane, y: s.y },
        { x: lane, y: t.y },
        { x: t.x, y: t.y },
      ])
    }
    return uniquePath([
      { x: s.x, y: s.y },
      { x: s.x, y: lane },
      { x: t.x, y: lane },
      { x: t.x, y: t.y },
    ])
  }

  const buildSecondary = (lane: number): Point2d[] => {
    if (args.rankdir === 'LR') {
      return uniquePath([
        { x: s.x, y: s.y },
        { x: s.x, y: lane },
        { x: t.x, y: lane },
        { x: t.x, y: t.y },
      ])
    }
    return uniquePath([
      { x: s.x, y: s.y },
      { x: lane, y: s.y },
      { x: lane, y: t.y },
      { x: t.x, y: t.y },
    ])
  }

  const primaryCandidates = candidatesFor(midPrimary)
  for (let i = 0; i < primaryCandidates.length; i += 1) {
    const pts = buildPrimary(primaryCandidates[i])
    if (!pathHitsAnyObstacle(pts, obstacles)) return pts
  }

  const secondaryCandidates = candidatesFor(midSecondary)
  for (let i = 0; i < secondaryCandidates.length; i += 1) {
    const pts = buildSecondary(secondaryCandidates[i])
    if (!pathHitsAnyObstacle(pts, obstacles)) return pts
  }

  return buildPrimary(midPrimary)
}
