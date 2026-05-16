export const BALANCED_OVERLAY_SPREAD_TARGET_ASPECT = 16 / 9
export type BalancedSpreadViewportPreset = 'widgetCanvas' | 'widgetFrontmatter' | 'richMedia'

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

function buildBalancedSpreadRowCounts(args: {
  count: number
  rows: number
  cols?: number
}): number[] {
  const count = Math.max(1, Math.floor(args.count))
  const rows = Math.max(1, Math.floor(args.rows))
  const cols = Math.max(1, Math.floor(Number(args.cols) || count))
  const rowCounts = new Array<number>(rows).fill(Math.floor(count / rows))
  const extra = count % rows
  const rowOrder = Array.from({ length: rows }, (_, row) => row).sort((a, b) => {
    const center = (rows - 1) / 2
    const da = Math.abs(a - center)
    const db = Math.abs(b - center)
    if (da !== db) return da - db
    return a - b
  })
  for (let i = 0; i < extra; i += 1) rowCounts[rowOrder[i]!] += 1
  return rowCounts.map(value => Math.max(0, Math.min(cols, value)))
}

export function computeBalancedSpreadGridForTargetAspect(args: {
  count: number
  cellW: number
  cellH: number
  targetAspect: number
  minCols?: number
  maxCols?: number
  maxRows?: number
}): { cols: number; rows: number } {
  const n = Math.max(1, Math.floor(args.count))
  const cellW = Math.max(1, Number(args.cellW) || 1)
  const cellH = Math.max(1, Number(args.cellH) || 1)
  const targetAspect = clamp(Number(args.targetAspect) || BALANCED_OVERLAY_SPREAD_TARGET_ASPECT, 0.5, 2.8)
  const maxCols = Math.max(1, Math.min(n, Math.floor(Number(args.maxCols) || n)))
  const maxRows = Math.max(1, Math.min(n, Math.floor(Number(args.maxRows) || n)))
  const minCols = Math.max(1, Math.min(maxCols, Math.floor(Number(args.minCols) || 1)))
  const softRowsCap = Math.max(3, Math.min(maxRows, Math.ceil(Math.sqrt(n) * 1.8)))
  const multiRowPreferred = n >= 4 && maxRows >= 2
  const multiColPreferred = n >= 4 && maxCols >= 2
  const scoreGrid = (cols: number, rows: number, options?: { allowOverflow?: boolean }): number => {
    const safeCols = Math.max(1, Math.floor(cols))
    const safeRows = Math.max(1, Math.floor(rows))
    const rowCounts = buildBalancedSpreadRowCounts({ count: n, rows: safeRows, cols: safeCols })
    const occupiedCols = Math.max(1, ...rowCounts)
    const occupiedRows = Math.max(1, rowCounts.filter(value => value > 0).length)
    const gridAspect = (occupiedCols * cellW) / Math.max(1, occupiedRows * cellH)
    const aspectScore = Math.abs(Math.log(Math.max(0.2, gridAspect) / Math.max(0.2, targetAspect)))
    const emptySlots = safeCols * safeRows - n
    const emptyPenalty = (emptySlots / Math.max(1, n)) * 0.24
    const verticalPenalty = safeRows > safeCols ? (safeRows - safeCols) * 0.16 : 0
    const widePenalty = safeCols > safeRows + 2 ? (safeCols - safeRows - 2) * 0.05 : 0
    const tallPenalty = safeRows > softRowsCap ? (safeRows - softRowsCap) * 0.2 : 0
    const singleRowPenalty = safeRows === 1 && multiRowPreferred ? 2.4 : safeRows === 1 && n >= 5 ? 0.24 : 0
    const singleColPenalty = safeCols === 1 && multiColPreferred ? 2.6 : safeCols === 1 && n >= 3 ? 0.35 : 0
    const stripPenalty =
      occupiedRows <= 2 && occupiedCols >= Math.max(4, occupiedRows + 2) && n >= 6
        ? 0.65 + Math.max(0, occupiedCols - occupiedRows - 2) * 0.08
        : 0
    const towerPenalty =
      occupiedCols <= 2 && occupiedRows >= Math.max(4, occupiedCols + 2) && n >= 6
        ? 0.7 + Math.max(0, occupiedRows - occupiedCols - 2) * 0.08
        : 0
    const overflowPenalty = options?.allowOverflow === true
      ? Math.max(0, safeRows - maxRows) * 0.22 + Math.max(0, safeCols - maxCols) * 0.3
      : 0
    return (
      aspectScore
      + emptyPenalty
      + verticalPenalty
      + widePenalty
      + tallPenalty
      + singleRowPenalty
      + singleColPenalty
      + stripPenalty
      + towerPenalty
      + overflowPenalty
    )
  }
  let best: { cols: number; rows: number; score: number } | null = null
  for (let cols = minCols; cols <= maxCols; cols += 1) {
    const rows = Math.max(1, Math.ceil(n / Math.max(1, cols)))
    if (rows > maxRows) continue
    const score = scoreGrid(cols, rows)
    if (!best || score < best.score - 1e-9 || (Math.abs(score - best.score) <= 1e-9 && cols > best.cols)) {
      best = { cols, rows, score }
    }
  }
  if (best) return { cols: best.cols, rows: best.rows }

  let overflowBest: { cols: number; rows: number; score: number } | null = null
  for (let cols = minCols; cols <= maxCols; cols += 1) {
    const rows = Math.max(1, Math.ceil(n / Math.max(1, cols)))
    const score = scoreGrid(cols, rows, { allowOverflow: true })
    if (
      !overflowBest
      || score < overflowBest.score - 1e-9
      || (Math.abs(score - overflowBest.score) <= 1e-9 && cols > overflowBest.cols)
    ) {
      overflowBest = { cols, rows, score }
    }
  }
  return overflowBest
    ? { cols: overflowBest.cols, rows: overflowBest.rows }
    : { cols: minCols, rows: Math.max(1, Math.ceil(n / Math.max(1, minCols))) }
}

export function computeBalancedSpreadGrid(args: {
  count: number
  viewportW: number
  viewportH: number
  cellW: number
  cellH: number
  zoomK: number
}): { cols: number; rows: number } {
  const n = Math.max(1, Math.floor(args.count))
  const viewportW = Math.max(1, Number(args.viewportW) || 1)
  const viewportH = Math.max(1, Number(args.viewportH) || 1)
  const cellW = Math.max(1, Number(args.cellW) || 1)
  const cellH = Math.max(1, Number(args.cellH) || 1)
  const zoomKRaw = Number.isFinite(args.zoomK) ? Math.max(0.1, Number(args.zoomK)) : 1
  const zoomK = Math.max(0.5, Math.min(2, zoomKRaw))

  const rowsCap = Math.max(1, Math.floor(viewportH / cellH))
  const colsCap = Math.max(1, Math.floor(viewportW / cellW))
  const minCols = colsCap >= 2 && n >= 4 ? 2 : 1
  const viewportAspect = viewportW / Math.max(1, viewportH)
  const weightedAspect = Math.max(
    0.5,
    Math.min(
      2.8,
      (viewportAspect * 0.55 + BALANCED_OVERLAY_SPREAD_TARGET_ASPECT * 0.45) * Math.sqrt(zoomK),
    ),
  )
  return computeBalancedSpreadGridForTargetAspect({
    count: n,
    cellW,
    cellH,
    targetAspect: weightedAspect,
    minCols,
    maxCols: colsCap,
    maxRows: rowsCap,
  })
}

export function computeBalancedSpreadViewportMargins(args: {
  viewportW: number
  viewportH: number
  preset?: BalancedSpreadViewportPreset
  minLeftPx?: number
  minRightPx?: number
  minTopPx?: number
  minBottomPx?: number
}): { left: number; right: number; top: number; bottom: number } {
  const viewportW = Math.max(1, Number(args.viewportW) || 1)
  const viewportH = Math.max(1, Number(args.viewportH) || 1)
  const preset = args.preset || 'widgetCanvas'
  const viewportAspect = viewportW / Math.max(1, viewportH)
  const aspectBias = clamp(Math.sqrt(viewportAspect / BALANCED_OVERLAY_SPREAD_TARGET_ASPECT), 0.92, 1.12)
  const profile =
    preset === 'widgetFrontmatter'
      ? { leftRatio: 0.1, rightRatio: 0.1, topRatio: 0.1, bottomRatio: 0.085, minLeft: 20, minRight: 20, minTop: 64, minBottom: 24 }
      : preset === 'richMedia'
        ? { leftRatio: 0.072, rightRatio: 0.072, topRatio: 0.085, bottomRatio: 0.07, minLeft: 24, minRight: 24, minTop: 24, minBottom: 24 }
        : { leftRatio: 0.06, rightRatio: 0.06, topRatio: 0.09, bottomRatio: 0.06, minLeft: 20, minRight: 20, minTop: 96, minBottom: 24 }
  const left = Math.max(profile.minLeft, Math.floor(viewportW * profile.leftRatio * aspectBias), Math.max(0, Math.floor(Number(args.minLeftPx) || 0)))
  const right = Math.max(profile.minRight, Math.floor(viewportW * profile.rightRatio * aspectBias), Math.max(0, Math.floor(Number(args.minRightPx) || 0)))
  const verticalBias = clamp(1 / aspectBias, 0.92, 1.08)
  const top = Math.max(profile.minTop, Math.floor(viewportH * profile.topRatio * verticalBias), Math.max(0, Math.floor(Number(args.minTopPx) || 0)))
  const bottom = Math.max(profile.minBottom, Math.floor(viewportH * profile.bottomRatio * verticalBias), Math.max(0, Math.floor(Number(args.minBottomPx) || 0)))
  return { left, right, top, bottom }
}

export function isVerticalOverlayCluster(args: {
  items: Array<{ left: number; top: number; width: number; height: number }>
  gapPx: number
}): boolean {
  const items = Array.isArray(args.items) ? args.items : []
  if (items.length < 4) return false
  let minLeft = Number.POSITIVE_INFINITY
  let maxLeft = Number.NEGATIVE_INFINITY
  let sumW = 0
  let sumH = 0
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]!
    minLeft = Math.min(minLeft, it.left)
    maxLeft = Math.max(maxLeft, it.left)
    sumW += Math.max(1, it.width)
    sumH += Math.max(1, it.height)
  }
  const avgW = Math.max(1, sumW / items.length)
  const avgH = Math.max(1, sumH / items.length)
  const gapPx = Math.max(0, Number(args.gapPx) || 0)
  const spanX = Math.max(0, maxLeft - minLeft)
  const columnThreshold = Math.max(24, avgW * 0.72, gapPx * 1.5)
  if (spanX > columnThreshold) return false

  let minTop = Number.POSITIVE_INFINITY
  let maxTop = Number.NEGATIVE_INFINITY
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]!
    minTop = Math.min(minTop, it.top)
    maxTop = Math.max(maxTop, it.top)
  }
  const spanY = Math.max(0, maxTop - minTop)
  return spanY >= Math.max(avgH * 2.2, gapPx * 3)
}

function countOverlayRows(args: {
  items: Array<{ top: number; height: number }>
  gapPx: number
}): number {
  const items = Array.isArray(args.items) ? args.items : []
  if (items.length === 0) return 0
  let sumH = 0
  for (let i = 0; i < items.length; i += 1) {
    sumH += Math.max(1, items[i]?.height || 1)
  }
  const avgH = Math.max(1, sumH / items.length)
  const gapPx = Math.max(0, Number(args.gapPx) || 0)
  const rowThreshold = Math.max(24, avgH * 0.62, gapPx * 1.25)
  const tops = items
    .map(it => Number(it?.top) || 0)
    .sort((a, b) => a - b)
  const rowAnchors: number[] = []
  for (let i = 0; i < tops.length; i += 1) {
    const top = tops[i]!
    const rowIdx = rowAnchors.findIndex(anchor => Math.abs(anchor - top) <= rowThreshold)
    if (rowIdx < 0) {
      rowAnchors.push(top)
      continue
    }
    rowAnchors[rowIdx] = Math.round((rowAnchors[rowIdx]! + top) / 2)
  }
  return rowAnchors.length
}

export function isHorizontalOverlayStrip(args: {
  items: Array<{ left: number; top: number; width: number; height: number }>
  gapPx: number
}): boolean {
  const items = Array.isArray(args.items) ? args.items : []
  if (items.length < 4) return false
  let minLeft = Number.POSITIVE_INFINITY
  let maxLeft = Number.NEGATIVE_INFINITY
  let minTop = Number.POSITIVE_INFINITY
  let maxTop = Number.NEGATIVE_INFINITY
  let sumW = 0
  let sumH = 0
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]!
    const width = Math.max(1, it.width)
    const height = Math.max(1, it.height)
    minLeft = Math.min(minLeft, it.left)
    maxLeft = Math.max(maxLeft, it.left)
    minTop = Math.min(minTop, it.top)
    maxTop = Math.max(maxTop, it.top)
    sumW += width
    sumH += height
  }
  const avgW = Math.max(1, sumW / items.length)
  const avgH = Math.max(1, sumH / items.length)
  const gapPx = Math.max(0, Number(args.gapPx) || 0)
  const rowCount = countOverlayRows({
    items: items.map(it => ({ top: it.top, height: it.height })),
    gapPx,
  })
  if (rowCount > 2) return false
  const spanX = Math.max(0, maxLeft - minLeft)
  const spanY = Math.max(0, maxTop - minTop)
  const layoutAspect = (spanX + avgW) / Math.max(1, spanY + avgH)
  const singleRow = rowCount <= 1 && items.length >= 4 && spanX >= Math.max(avgW * 2.4, gapPx * 3)
  const shallowDoubleRow = rowCount === 2 && items.length >= 5 && spanY <= avgH * 1.75 && spanX >= Math.max(avgW * 2.9, gapPx * 4)
  const overWide = rowCount <= 2 && items.length >= 4 && layoutAspect >= BALANCED_OVERLAY_SPREAD_TARGET_ASPECT * 1.75
  return singleRow || shallowDoubleRow || overWide
}

export function shouldForceBalancedSpreadReseed(args: {
  items: Array<{ left: number; top: number; width: number; height: number }>
  gapPx: number
}): boolean {
  const items = Array.isArray(args.items) ? args.items : []
  if (items.length <= 1) return false
  return isVerticalOverlayCluster({ items, gapPx: args.gapPx }) || isHorizontalOverlayStrip({ items, gapPx: args.gapPx })
}

export function computeBalancedSpreadSpacingPx(args: {
  baseGapPx: number
  zoomK: number
  count: number
  preset?: BalancedSpreadViewportPreset
}): number {
  const baseGap = clamp(Math.floor(Number(args.baseGapPx) || 0), 8, 96)
  const zoomK = clamp(Number(args.zoomK) || 1, 0.5, 2.5)
  const count = Math.max(1, Math.floor(Number(args.count) || 1))
  const preset = args.preset || 'widgetCanvas'
  const presetSpacingBoost =
    preset === 'widgetFrontmatter'
      ? 1.18
      : preset === 'richMedia'
        ? 1.04
        : 1
  const densityFactor = (1 + Math.min(0.35, count / 18)) * presetSpacingBoost
  const zoomOutFactor = clamp(1 / Math.sqrt(zoomK), 0.9, 1.2)
  return Math.max(baseGap, Math.round(baseGap * densityFactor * zoomOutFactor))
}

function buildCenteredSpreadCells(args: {
  count: number
  cols: number
  rows: number
  startLeft: number
  startTop: number
  cellW: number
  cellH: number
  snapPx: number
}): Array<{ left: number; top: number; row: number; col: number }> {
  const rows = Math.max(1, Math.floor(args.rows))
  const cols = Math.max(1, Math.floor(args.cols))
  const count = Math.max(1, Math.floor(args.count))
  const snapPx = Number.isFinite(args.snapPx) && args.snapPx > 0 ? args.snapPx : 1
  const snap = (v: number) => Math.round(v / snapPx) * snapPx
  const rowCounts = buildBalancedSpreadRowCounts({ count, rows, cols })

  const cells: Array<{ left: number; top: number; row: number; col: number }> = []
  for (let row = 0; row < rows; row += 1) {
    const countInRow = Math.max(0, Math.min(cols, rowCounts[row] || 0))
    if (countInRow <= 0) continue
    const colOffset = (cols - countInRow) / 2
    for (let idx = 0; idx < countInRow; idx += 1) {
      const col = colOffset + idx
      cells.push({
        left: snap(args.startLeft + col * args.cellW),
        top: snap(args.startTop + row * args.cellH),
        row,
        col: Math.round(col * 1000) / 1000,
      })
    }
  }
  return cells
}

function recenterBalancedSpreadCells(args: {
  cells: Array<{ left: number; top: number; row: number; col: number }>
  viewportW: number
  viewportH: number
  marginLeftPx: number
  marginRightPx: number
  marginTopPx: number
  marginBottomPx: number
  footprintW: number
  footprintH: number
  snapPx: number
}): {
  cells: Array<{ left: number; top: number; row: number; col: number }>
  bbox: { minLeft: number; minTop: number; maxRight: number; maxBottom: number }
} {
  const cells = Array.isArray(args.cells) ? args.cells : []
  if (cells.length === 0) {
    return {
      cells: [],
      bbox: { minLeft: 0, minTop: 0, maxRight: 0, maxBottom: 0 },
    }
  }
  const snapPx = Number.isFinite(args.snapPx) && args.snapPx > 0 ? args.snapPx : 1
  const snap = (v: number) => Math.round(v / snapPx) * snapPx
  const footprintW = Math.max(1, args.footprintW)
  const footprintH = Math.max(1, args.footprintH)
  let minLeft = Number.POSITIVE_INFINITY
  let minTop = Number.POSITIVE_INFINITY
  let maxRight = Number.NEGATIVE_INFINITY
  let maxBottom = Number.NEGATIVE_INFINITY
  let sumCenterX = 0
  let sumCenterY = 0
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i]!
    minLeft = Math.min(minLeft, cell.left)
    minTop = Math.min(minTop, cell.top)
    maxRight = Math.max(maxRight, cell.left + footprintW)
    maxBottom = Math.max(maxBottom, cell.top + footprintH)
    sumCenterX += cell.left + footprintW / 2
    sumCenterY += cell.top + footprintH / 2
  }
  const usableCenterX = args.marginLeftPx + Math.max(1, args.viewportW - args.marginLeftPx - args.marginRightPx) / 2
  const usableCenterY = args.marginTopPx + Math.max(1, args.viewportH - args.marginTopPx - args.marginBottomPx) / 2
  const currentCenterX = sumCenterX / cells.length
  const currentCenterY = sumCenterY / cells.length
  const minDx = args.marginLeftPx - minLeft
  const maxDx = args.viewportW - args.marginRightPx - maxRight
  const minDy = args.marginTopPx - minTop
  const maxDy = args.viewportH - args.marginBottomPx - maxBottom
  const shiftX = snap(clamp(usableCenterX - currentCenterX, minDx, maxDx))
  const shiftY = snap(clamp(usableCenterY - currentCenterY, minDy, maxDy))
  const shiftedCells = cells.map(cell => ({
    ...cell,
    left: snap(cell.left + shiftX),
    top: snap(cell.top + shiftY),
  }))
  return {
    cells: shiftedCells,
    bbox: {
      minLeft: snap(minLeft + shiftX),
      minTop: snap(minTop + shiftY),
      maxRight: snap(maxRight + shiftX),
      maxBottom: snap(maxBottom + shiftY),
    },
  }
}

export function computeBalancedSpreadLayout(args: {
  count: number
  viewportW: number
  viewportH: number
  cellW: number
  cellH: number
  gapPx: number
  zoomK: number
  marginLeftPx?: number
  marginRightPx?: number
  marginTopPx?: number
  marginBottomPx?: number
  snapPx?: number
}): {
  cols: number
  rows: number
  gridW: number
  gridH: number
  startLeft: number
  startTop: number
  cells: Array<{ left: number; top: number; row: number; col: number }>
} {
  const count = Math.max(1, Math.floor(Number(args.count) || 1))
  const viewportW = Math.max(1, Number(args.viewportW) || 1)
  const viewportH = Math.max(1, Number(args.viewportH) || 1)
  const gapPx = Math.max(0, Number(args.gapPx) || 0)
  const cellW = Math.max(1, Number(args.cellW) || 1)
  const cellH = Math.max(1, Number(args.cellH) || 1)
  const marginLeftPx = Math.max(0, Number(args.marginLeftPx) || 0)
  const marginRightPx = Math.max(0, Number(args.marginRightPx) || 0)
  const marginTopPx = Math.max(0, Number(args.marginTopPx) || 0)
  const marginBottomPx = Math.max(0, Number(args.marginBottomPx) || 0)
  const snapPx = args.snapPx ?? 1
  const usableW = Math.max(1, viewportW - marginLeftPx - marginRightPx)
  const usableH = Math.max(1, viewportH - marginTopPx - marginBottomPx)
  const { cols, rows } = computeBalancedSpreadGrid({
    count,
    viewportW: usableW,
    viewportH: usableH,
    cellW,
    cellH,
    zoomK: args.zoomK,
  })
  const gridW = Math.max(1, cols * cellW - gapPx)
  const gridH = Math.max(1, rows * cellH - gapPx)
  const startLeft = marginLeftPx + Math.max(0, Math.floor((usableW - gridW) / 2))
  const startTop = marginTopPx + Math.max(0, Math.floor((usableH - gridH) / 2))
  const centeredCells = buildCenteredSpreadCells({
    count,
    cols,
    rows,
    startLeft,
    startTop,
    cellW,
    cellH,
    snapPx,
  })
  const recentered = recenterBalancedSpreadCells({
    cells: centeredCells,
    viewportW,
    viewportH,
    marginLeftPx,
    marginRightPx,
    marginTopPx,
    marginBottomPx,
    footprintW: Math.max(1, cellW - gapPx),
    footprintH: Math.max(1, cellH - gapPx),
    snapPx,
  })
  return {
    cols,
    rows,
    gridW: Math.max(1, recentered.bbox.maxRight - recentered.bbox.minLeft),
    gridH: Math.max(1, recentered.bbox.maxBottom - recentered.bbox.minTop),
    startLeft: recentered.bbox.minLeft,
    startTop: recentered.bbox.minTop,
    cells: recentered.cells,
  }
}

export function clampBalancedCollectiveScaleToViewport(args: {
  scale: number
  viewportW: number
  viewportH: number
  count: number
  baseWidth: number
  baseHeight: number
  quantizeStep?: number
  hardMinScale?: number
  hardMaxScale?: number
  viewportPreset?: BalancedSpreadViewportPreset
}): number {
  const scale = Number.isFinite(args.scale) ? Number(args.scale) : 1
  const viewportW = Math.max(1, Number(args.viewportW) || 1)
  const viewportH = Math.max(1, Number(args.viewportH) || 1)
  const count = Math.max(1, Math.floor(Number(args.count) || 1))
  const baseWidth = Math.max(1, Number(args.baseWidth) || 1)
  const baseHeight = Math.max(1, Number(args.baseHeight) || 1)
  const quantizeStep = Number.isFinite(args.quantizeStep) && Number(args.quantizeStep) > 0 ? Number(args.quantizeStep) : 0.02
  const requestedHardMin = Number.isFinite(args.hardMinScale) ? Number(args.hardMinScale) : 0.68
  const requestedHardMax = Number.isFinite(args.hardMaxScale) ? Number(args.hardMaxScale) : 1.06
  const minScaleBound = Math.max(0.001, Math.min(requestedHardMin, requestedHardMax))
  const maxScaleBound = Math.max(minScaleBound, Math.max(requestedHardMin, requestedHardMax))
  const quantize = (v: number) => Math.round(v / quantizeStep) * quantizeStep
  const clampToBounds = (v: number) => clamp(v, minScaleBound, maxScaleBound)
  const boundedScale = clampToBounds(scale)
  if (count <= 1) return clampToBounds(quantize(boundedScale))

  const margins = computeBalancedSpreadViewportMargins({
    viewportW,
    viewportH,
    preset: args.viewportPreset || 'widgetCanvas',
  })
  const usableW = Math.max(1, viewportW - margins.left - margins.right)
  const usableH = Math.max(1, viewportH - margins.top - margins.bottom)
  const baseGapPx = Math.max(12, Math.min(40, Math.round(usableW * 0.012)))
  const gapPx = computeBalancedSpreadSpacingPx({
    baseGapPx,
    zoomK: 1,
    count,
    preset: args.viewportPreset || 'widgetCanvas',
  })
  const fitsViewportAtScale = (candidateScale: number): boolean => {
    const scale = clampToBounds(candidateScale)
    const panelW = Math.max(1, baseWidth * scale)
    const panelH = Math.max(1, baseHeight * scale)
    const cellW = panelW + gapPx
    const cellH = panelH + gapPx
    const colsCap = Math.max(1, Math.floor((usableW + gapPx) / Math.max(1, cellW)))
    const rowsCap = Math.max(1, Math.floor((usableH + gapPx) / Math.max(1, cellH)))
    if (colsCap * rowsCap < count) return false
    const grid = computeBalancedSpreadGridForTargetAspect({
      count,
      cellW,
      cellH,
      targetAspect: BALANCED_OVERLAY_SPREAD_TARGET_ASPECT,
      minCols: count >= 4 && colsCap >= 2 ? 2 : 1,
      maxCols: colsCap,
      maxRows: rowsCap,
    })
    const footprintW = Math.max(1, grid.cols * cellW - gapPx)
    const footprintH = Math.max(1, grid.rows * cellH - gapPx)
    return footprintW <= usableW + 0.5 && footprintH <= usableH + 0.5
  }
  if (fitsViewportAtScale(boundedScale)) return clampToBounds(quantize(boundedScale))
  if (fitsViewportAtScale(maxScaleBound)) return clampToBounds(quantize(maxScaleBound))
  if (!fitsViewportAtScale(minScaleBound)) return clampToBounds(quantize(minScaleBound))

  let lo = minScaleBound
  let hi = maxScaleBound
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2
    if (fitsViewportAtScale(mid)) lo = mid
    else hi = mid
  }
  return clampToBounds(quantize(lo))
}
