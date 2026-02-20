export function pickBalancedGrid(args: {
  count: number
  aspect: number
  minCols?: number
  minRows?: number
}): { cols: number; rows: number } {
  const count = Math.max(0, Math.floor(args.count))
  if (count <= 1) return { cols: 1, rows: Math.max(1, count) }

  const aspectRaw = typeof args.aspect === 'number' && Number.isFinite(args.aspect) && args.aspect > 0 ? args.aspect : 1
  const minCols = typeof args.minCols === 'number' && Number.isFinite(args.minCols) ? Math.max(1, Math.floor(args.minCols)) : 1
  const minRows = typeof args.minRows === 'number' && Number.isFinite(args.minRows) ? Math.max(1, Math.floor(args.minRows)) : 1

  let bestCols = 1
  let bestRows = count
  let bestCost = Infinity

  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.max(1, Math.ceil(count / cols))
    if (cols < minCols) continue
    if (rows < minRows) continue
    const gridAspect = cols / Math.max(1, rows)
    const aspectCost = Math.abs(Math.log(gridAspect / aspectRaw))
    const oneDimPenalty = (cols === 1 || rows === 1) && count >= 4 ? 2.5 : 0
    const squarenessPenalty = Math.abs(cols - rows) * 0.02
    const cost = aspectCost + oneDimPenalty + squarenessPenalty
    if (cost < bestCost) {
      bestCost = cost
      bestCols = cols
      bestRows = rows
    }
  }

  return { cols: bestCols, rows: bestRows }
}
