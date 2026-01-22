export type ChevronDirection = 'down' | 'right'

export const buildChevronPathD = (args: { cx: number; cy: number; size: number; direction: ChevronDirection }): string => {
  const cx = Number.isFinite(args.cx) ? args.cx : 0
  const cy = Number.isFinite(args.cy) ? args.cy : 0
  const size = Number.isFinite(args.size) ? Math.max(2, args.size) : 8
  const half = size / 2
  if (args.direction === 'right') {
    const x0 = cx - half * 0.35
    const y0 = cy - half
    const x1 = cx + half * 0.65
    const y1 = cy
    const x2 = cx - half * 0.35
    const y2 = cy + half
    return `M${x0},${y0}L${x1},${y1}L${x2},${y2}`
  }
  const x0 = cx - half
  const y0 = cy - half * 0.35
  const x1 = cx
  const y1 = cy + half * 0.65
  const x2 = cx + half
  const y2 = cy - half * 0.35
  return `M${x0},${y0}L${x1},${y1}L${x2},${y2}`
}

