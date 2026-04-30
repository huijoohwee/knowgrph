import {
  BALANCED_OVERLAY_SPREAD_TARGET_ASPECT,
  computeBalancedSpreadGridForTargetAspect,
} from '@/lib/ui/overlayBalancedSpread'

export type WidgetSeedBounds = { minX: number; minY: number; maxX: number; maxY: number }

function buildCenteredRowCells(args: {
  count: number
  cols: number
  rows: number
  startX: number
  startY: number
  cellW: number
  cellH: number
  snapWorld: (value: number) => number
}): Array<{ x: number; y: number }> {
  const rows = Math.max(1, Math.floor(args.rows))
  const cols = Math.max(1, Math.floor(args.cols))
  const count = Math.max(1, Math.floor(args.count))
  const rowCounts = new Array<number>(rows).fill(Math.floor(count / rows))
  let extra = count % rows
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

  const cells: Array<{ x: number; y: number }> = []
  for (let row = 0; row < rows; row += 1) {
    const countInRow = Math.max(0, Math.min(cols, rowCounts[row] || 0))
    if (countInRow <= 0) continue
    const colOffset = (cols - countInRow) / 2
    for (let idx = 0; idx < countInRow; idx += 1) {
      const col = colOffset + idx
      cells.push({
        x: args.snapWorld(args.startX + col * args.cellW),
        y: args.snapWorld(args.startY + row * args.cellH),
      })
    }
  }
  return cells
}

export function placeWidgetsCenteredInGroupBounds(args: {
  ids: string[]
  bounds: WidgetSeedBounds
  cellW: number
  cellH: number
  gapWorld: number
  snapWorld: (value: number) => number
}): Array<{ id: string; x: number; y: number }> {
  const ids = Array.isArray(args.ids) ? args.ids : []
  if (ids.length === 0) return []

  const minX = Number.isFinite(args.bounds?.minX) ? args.bounds.minX : 0
  const minY = Number.isFinite(args.bounds?.minY) ? args.bounds.minY : 0
  const maxX = Number.isFinite(args.bounds?.maxX) ? args.bounds.maxX : minX
  const maxY = Number.isFinite(args.bounds?.maxY) ? args.bounds.maxY : minY

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const boundW = Math.max(1, maxX - minX)
  const boundH = Math.max(1, maxY - minY)
  const cellW = Number.isFinite(args.cellW) ? Math.max(1, args.cellW) : 1
  const cellH = Number.isFinite(args.cellH) ? Math.max(1, args.cellH) : 1
  const gapWorld = Number.isFinite(args.gapWorld) ? Math.max(0, args.gapWorld) : 0
  const targetAspect = Math.max(
    0.5,
    Math.min(2.8, (boundW / boundH) * 0.35 + BALANCED_OVERLAY_SPREAD_TARGET_ASPECT * 0.65),
  )
  const { cols, rows } = computeBalancedSpreadGridForTargetAspect({
    count: ids.length,
    cellW,
    cellH,
    targetAspect,
    minCols: ids.length >= 4 ? 2 : 1,
  })
  const gridW = cols * cellW - gapWorld
  const gridH = rows * cellH - gapWorld
  const startX = args.snapWorld(centerX - gridW / 2)
  const startY = args.snapWorld(centerY - gridH / 2)
  const cells = buildCenteredRowCells({
    count: ids.length,
    cols,
    rows,
    startX,
    startY,
    cellW,
    cellH,
    snapWorld: args.snapWorld,
  })

  const out: Array<{ id: string; x: number; y: number }> = []
  for (let i = 0; i < ids.length; i += 1) {
    const cell = cells[i]
    if (!cell) break
    out.push({
      id: ids[i]!,
      x: cell.x,
      y: cell.y,
    })
  }
  return out
}
