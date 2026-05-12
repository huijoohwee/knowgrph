import {
  computeBalancedSpreadLayout,
} from '@/lib/ui/overlayBalancedSpread'

export type WidgetSeedBounds = { minX: number; minY: number; maxX: number; maxY: number }

export function placeWidgetsCenteredInGroupBounds(args: {
  ids: string[]
  bounds: WidgetSeedBounds
  cellW: number
  cellH: number
  gapWorld: number
  snapWorld: (value: number) => number
  preferredFirstRowCount?: number
  preferredRowGapScale?: number
}): Array<{ id: string; x: number; y: number }> {
  const ids = Array.isArray(args.ids) ? args.ids : []
  if (ids.length === 0) return []

  const minX = Number.isFinite(args.bounds?.minX) ? args.bounds.minX : 0
  const minY = Number.isFinite(args.bounds?.minY) ? args.bounds.minY : 0
  const maxX = Number.isFinite(args.bounds?.maxX) ? args.bounds.maxX : minX
  const maxY = Number.isFinite(args.bounds?.maxY) ? args.bounds.maxY : minY

  const boundW = Math.max(1, maxX - minX)
  const boundH = Math.max(1, maxY - minY)
  const cellW = Number.isFinite(args.cellW) ? Math.max(1, args.cellW) : 1
  const cellH = Number.isFinite(args.cellH) ? Math.max(1, args.cellH) : 1
  const gapWorld = Number.isFinite(args.gapWorld) ? Math.max(0, args.gapWorld) : 0
  const computeLayout = (viewportW: number, viewportH: number) =>
    computeBalancedSpreadLayout({
      count: ids.length,
      viewportW,
      viewportH,
      cellW,
      cellH,
      gapPx: gapWorld,
      zoomK: 1,
      marginLeftPx: 0,
      marginRightPx: 0,
      marginTopPx: 0,
      marginBottomPx: 0,
    })
  let layout = computeLayout(boundW, boundH)
  const preferredFirstRowCount = Number.isFinite(args.preferredFirstRowCount)
    ? Math.max(2, Math.floor(args.preferredFirstRowCount as number))
    : 0
  const preferredRowGapScale = Number.isFinite(args.preferredRowGapScale)
    ? Math.max(0.6, Math.min(1.5, Number(args.preferredRowGapScale)))
    : 1
  if (preferredFirstRowCount >= 2 && ids.length > preferredFirstRowCount) {
    const firstRowCount = layout.cells.filter(cell => cell.row === 0).length
    const targetRows = 1 + Math.ceil((ids.length - preferredFirstRowCount) / Math.max(1, preferredFirstRowCount))
    if (firstRowCount !== preferredFirstRowCount || new Set(layout.cells.map(cell => cell.row)).size !== targetRows) {
      const preferredLayout = computeBalancedSpreadLayout({
        count: ids.length,
        viewportW: boundW,
        viewportH: Math.max(boundH, cellH * targetRows),
        cellW,
        cellH,
        gapPx: gapWorld,
        zoomK: 1,
        marginLeftPx: 0,
        marginRightPx: 0,
        marginTopPx: 0,
        marginBottomPx: 0,
      })
      const preferredFirstRow = preferredLayout.cells.filter(cell => cell.row === 0).length
      if (preferredFirstRow === preferredFirstRowCount) layout = preferredLayout
    }
  }
  if (preferredFirstRowCount >= 2 && preferredRowGapScale !== 1) {
    const rowIndices = Array.from(new Set(layout.cells.map(cell => cell.row))).sort((a, b) => a - b)
    if (rowIndices.length > 1) {
      const firstRowCells = layout.cells.filter(cell => cell.row === rowIndices[0])
      const laterRowCells = layout.cells.filter(cell => cell.row > rowIndices[0])
      if (firstRowCells.length === preferredFirstRowCount && laterRowCells.length > 0) {
        const firstRowMinY = Math.min(...firstRowCells.map(cell => cell.top))
        const secondRowMinY = Math.min(...laterRowCells.map(cell => cell.top))
        const currentGap = secondRowMinY - firstRowMinY
        const targetGap = currentGap * preferredRowGapScale
        const delta = targetGap - currentGap
        if (Math.abs(delta) > 0.001) {
          layout = {
            ...layout,
            cells: layout.cells.map(cell => (cell.row > rowIndices[0] ? { ...cell, top: cell.top + delta, y: cell.y + delta } : cell)),
          }
        }
      }
    }
  }
  const seededRowCount = new Set(layout.cells.map(cell => cell.row)).size
  const shouldForceMultiRowReseed =
    ids.length >= 5
    && seededRowCount <= 1
    && boundW >= Math.max(cellW * 3, boundH * 2)
  if (shouldForceMultiRowReseed) {
    const forcedViewportH = Math.max(boundH, cellH * 2)
    const forcedLayout = computeLayout(boundW, forcedViewportH)
    const forcedRows = new Set(forcedLayout.cells.map(cell => cell.row)).size
    if (forcedRows > seededRowCount) layout = forcedLayout
  }

  const out: Array<{ id: string; x: number; y: number }> = []
  for (let i = 0; i < ids.length; i += 1) {
    const cell = layout.cells[i]
    if (!cell) break
    out.push({
      id: ids[i]!,
      x: args.snapWorld(minX + cell.left),
      y: args.snapWorld(minY + cell.top),
    })
  }
  return out
}
