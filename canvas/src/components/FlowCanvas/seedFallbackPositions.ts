export function placeFlowFallbackSeedPositions(args: {
  ids: string[]
  cellW: number
  cellH: number
}): Record<string, { x: number; y: number }> {
  const ids = Array.isArray(args.ids) ? args.ids.filter(Boolean) : []
  if (ids.length === 0) return {}

  const cellW = Number.isFinite(args.cellW) ? Math.max(1, args.cellW) : 1
  const cellH = Number.isFinite(args.cellH) ? Math.max(1, args.cellH) : 1
  const targetAspect = Math.max(0.5, Math.min(2.5, cellW / Math.max(1, cellH)))
  const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length * targetAspect)))
  const rows = Math.max(1, Math.ceil(ids.length / cols))
  const startY = -(rows * cellH) / 2
  const rowCounts = new Array<number>(rows).fill(Math.floor(ids.length / rows))
  const extra = ids.length % rows
  const rowOrder = Array.from({ length: rows }, (_, row) => row).sort((a, b) => {
    const center = (rows - 1) / 2
    const da = Math.abs(a - center)
    const db = Math.abs(b - center)
    if (da !== db) return da - db
    return a - b
  })
  for (let i = 0; i < extra; i += 1) {
    rowCounts[rowOrder[i]!] += 1
  }

  const out: Record<string, { x: number; y: number }> = {}
  let idIndex = 0
  for (let row = 0; row < rows; row += 1) {
    const countInRow = Math.max(0, Math.min(cols, rowCounts[row] || 0))
    if (countInRow <= 0) continue
    const startX = -(countInRow * cellW) / 2
    for (let col = 0; col < countInRow; col += 1) {
      const id = ids[idIndex]
      idIndex += 1
      if (!id) break
      out[id] = { x: startX + col * cellW, y: startY + row * cellH }
    }
  }
  return out
}
