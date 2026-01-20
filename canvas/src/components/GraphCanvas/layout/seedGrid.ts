export const computeSeedGrid = (args: { count: number; width: number; height: number; pad: number }) => {
  const count = Math.max(1, Math.floor(args.count))
  const width = Math.max(1, args.width)
  const height = Math.max(1, args.height)
  const pad = Math.max(0, args.pad)
  const aspect = width / Math.max(1, height)
  const cols = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * aspect))))
  const rows = Math.max(1, Math.ceil(count / cols))
  const usableW = Math.max(1, width - pad * 2)
  const usableH = Math.max(1, height - pad * 2)
  const cellW = usableW / cols
  const cellH = usableH / rows
  return { cols, rows, pad, cellW, cellH }
}

export const getSeedGridCellBox = (grid: ReturnType<typeof computeSeedGrid>, index: number) => {
  const i = Math.max(0, Math.floor(index))
  const row = Math.floor(i / grid.cols)
  const col = i % grid.cols
  const x0 = grid.pad + grid.cellW * col
  const x1 = grid.pad + grid.cellW * (col + 1)
  const y0 = grid.pad + grid.cellH * row
  const y1 = grid.pad + grid.cellH * (row + 1)
  return { x0, x1, y0, y1 }
}

