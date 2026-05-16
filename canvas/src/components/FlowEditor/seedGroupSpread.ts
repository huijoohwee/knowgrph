import {
  computeBalancedSpreadGridForTargetAspect,
  computeBalancedSpreadLayout,
} from '@/lib/ui/overlayBalancedSpread'

export type WidgetSeedBounds = { minX: number; minY: number; maxX: number; maxY: number }
export type BalancedSpreadSeedCell = { left: number; top: number; row: number; col: number }

export function applyPreferredSeedLayoutCells(args: {
  cells: BalancedSpreadSeedCell[]
  cellH: number
  gapPx: number
  preferredFirstRowCount?: number
  preferredRowGapScale?: number
  preferredSingleRowStaggerScale?: number
}): BalancedSpreadSeedCell[] {
  const inputCells = Array.isArray(args.cells) ? args.cells : []
  if (inputCells.length <= 0) return []
  let cells = inputCells.map(cell => ({ ...cell }))
  const preferredFirstRowCount = Number.isFinite(args.preferredFirstRowCount)
    ? Math.max(2, Math.floor(args.preferredFirstRowCount as number))
    : 0
  const preferredRowGapScale = Number.isFinite(args.preferredRowGapScale)
    ? Math.max(0.6, Math.min(1.5, Number(args.preferredRowGapScale)))
    : 1
  const preferredSingleRowStaggerScale = Number.isFinite(args.preferredSingleRowStaggerScale)
    ? Math.max(0.05, Math.min(0.35, Number(args.preferredSingleRowStaggerScale)))
    : 0

  if (preferredFirstRowCount >= 2 && preferredRowGapScale !== 1) {
    const rowIndices = Array.from(new Set(cells.map(cell => cell.row))).sort((a, b) => a - b)
    if (rowIndices.length > 1) {
      const firstRowCells = cells.filter(cell => cell.row === rowIndices[0])
      const laterRowCells = cells.filter(cell => cell.row > rowIndices[0])
      if (firstRowCells.length === preferredFirstRowCount && laterRowCells.length > 0) {
        const firstRowMinY = Math.min(...firstRowCells.map(cell => cell.top))
        const secondRowMinY = Math.min(...laterRowCells.map(cell => cell.top))
        const currentGap = secondRowMinY - firstRowMinY
        const minNonOverlappingGap = Math.max(1, Number(args.cellH) || 1)
        const targetGap = Math.max(minNonOverlappingGap, currentGap * preferredRowGapScale)
        const delta = targetGap - currentGap
        if (Math.abs(delta) > 0.001) {
          cells = cells.map(cell => (cell.row > rowIndices[0] ? { ...cell, top: cell.top + delta } : cell))
        }
      }
    }
  }

  if (preferredSingleRowStaggerScale > 0) {
    const rowIndices = Array.from(new Set(cells.map(cell => cell.row))).sort((a, b) => a - b)
    if (rowIndices.length === 1 && cells.length === 3) {
      const sorted = [...cells].sort((a, b) => (a.col !== b.col ? a.col - b.col : a.left - b.left))
      const averageTop = sorted.reduce((sum, cell) => sum + cell.top, 0) / sorted.length
      const panelHeight = Math.max(1, Number(args.cellH) - Math.max(0, Number(args.gapPx) || 0))
      const staggerStep = Math.max(18, Math.min(panelHeight * 0.24, panelHeight * preferredSingleRowStaggerScale))
      const centerIndex = (sorted.length - 1) / 2
      const topBySignature = new Map<string, number>()
      for (let i = 0; i < sorted.length; i += 1) {
        const cell = sorted[i]!
        const offset = (i - centerIndex) * staggerStep
        topBySignature.set(`${cell.row}:${cell.col}:${cell.left}:${cell.top}`, averageTop + offset)
      }
      cells = cells.map(cell => {
        const nextTop = topBySignature.get(`${cell.row}:${cell.col}:${cell.left}:${cell.top}`)
        return nextTop == null ? cell : { ...cell, top: nextTop }
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
  preferredFirstRowCount?: number
  preferredRowGapScale?: number
  preferredSingleRowStaggerScale?: number
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
  layout = {
    ...layout,
    cells: applyPreferredSeedLayoutCells({
      cells: layout.cells,
      cellH,
      gapPx: gapWorld,
      preferredFirstRowCount: args.preferredFirstRowCount,
      preferredRowGapScale: args.preferredRowGapScale,
      preferredSingleRowStaggerScale: args.preferredSingleRowStaggerScale,
    }),
  }
  const seededRowCount = new Set(layout.cells.map(cell => cell.row)).size
  const shouldForceMultiRowReseed =
    ids.length >= 5
    && seededRowCount <= 1
    && boundW >= Math.max(cellW * 3, boundH * 2)
  if (shouldForceMultiRowReseed) {
    const forcedGrid = computeBalancedSpreadGridForTargetAspect({
      count: ids.length,
      cellW,
      cellH,
      targetAspect: Math.max(0.5, Math.min(2.8, boundW / Math.max(1, boundH))),
      minCols: 2,
      maxCols: Math.max(2, ids.length),
      maxRows: ids.length,
    })
    const forcedViewportW = Math.max(boundW, forcedGrid.cols * cellW)
    const forcedViewportH = Math.max(boundH, forcedGrid.rows * cellH)
    const forcedLayout = computeLayout(forcedViewportW, forcedViewportH)
    const forcedRows = new Set(forcedLayout.cells.map(cell => cell.row)).size
    if (forcedRows > seededRowCount) {
      layout = {
        ...forcedLayout,
        cells: applyPreferredSeedLayoutCells({
          cells: forcedLayout.cells,
          cellH,
          gapPx: gapWorld,
          preferredFirstRowCount: args.preferredFirstRowCount,
          preferredRowGapScale: args.preferredRowGapScale,
          preferredSingleRowStaggerScale: args.preferredSingleRowStaggerScale,
        }),
      }
    }
  }
  const panelW = Math.max(1, cellW - gapWorld)
  const panelH = Math.max(1, cellH - gapWorld)
  if (layout.cells.length > 0) {
    const currentCenter = layout.cells.reduce(
      (acc, cell) => ({
        x: acc.x + cell.left + panelW / 2,
        y: acc.y + cell.top + panelH / 2,
      }),
      { x: 0, y: 0 },
    )
    currentCenter.x /= layout.cells.length
    currentCenter.y /= layout.cells.length
    const targetCenter = {
      x: boundW / 2,
      y: boundH / 2,
    }
    let minLeft = Number.POSITIVE_INFINITY
    let minTop = Number.POSITIVE_INFINITY
    let maxRight = Number.NEGATIVE_INFINITY
    let maxBottom = Number.NEGATIVE_INFINITY
    for (let i = 0; i < layout.cells.length; i += 1) {
      const cell = layout.cells[i]!
      minLeft = Math.min(minLeft, cell.left)
      minTop = Math.min(minTop, cell.top)
      maxRight = Math.max(maxRight, cell.left + panelW)
      maxBottom = Math.max(maxBottom, cell.top + panelH)
    }
    const preferredShiftX = targetCenter.x - currentCenter.x
    const preferredShiftY = targetCenter.y - currentCenter.y
    const minDx = Number.isFinite(minLeft) ? -minLeft : 0
    const maxDx = Number.isFinite(maxRight) ? boundW - maxRight : 0
    const minDy = Number.isFinite(minTop) ? -minTop : 0
    const maxDy = Number.isFinite(maxBottom) ? boundH - maxBottom : 0
    const shiftX = Math.max(minDx, Math.min(maxDx, preferredShiftX))
    const shiftY = Math.max(minDy, Math.min(maxDy, preferredShiftY))
    if (Math.abs(shiftX) > 0.001 || Math.abs(shiftY) > 0.001) {
      layout = {
        ...layout,
        cells: layout.cells.map(cell => ({
          ...cell,
          left: cell.left + shiftX,
          top: cell.top + shiftY,
        })),
      }
    }
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
