export const BALANCED_OVERLAY_SPREAD_TARGET_ASPECT = 16 / 9

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
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

  let cols = Math.max(minCols, Math.min(colsCap, Math.ceil(Math.sqrt(n * weightedAspect))))
  let rows = Math.max(1, Math.ceil(n / Math.max(1, cols)))
  if (rows > rowsCap) {
    cols = Math.max(minCols, Math.min(colsCap, Math.ceil(n / rowsCap)))
    rows = Math.max(1, Math.ceil(n / Math.max(1, cols)))
  }
  const softRowsCap = Math.max(3, Math.min(rowsCap, Math.ceil(Math.sqrt(n) * 1.8)))
  if (rows > softRowsCap && cols < colsCap) {
    cols = Math.max(minCols, Math.min(colsCap, Math.ceil(n / softRowsCap)))
    rows = Math.max(1, Math.ceil(n / Math.max(1, cols)))
  }
  return { cols, rows }
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

export function computeBalancedSpreadSpacingPx(args: {
  baseGapPx: number
  zoomK: number
  count: number
}): number {
  const baseGap = clamp(Math.floor(Number(args.baseGapPx) || 0), 8, 96)
  const zoomK = clamp(Number(args.zoomK) || 1, 0.5, 2.5)
  const count = Math.max(1, Math.floor(Number(args.count) || 1))
  const densityFactor = 1 + Math.min(0.35, count / 18)
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
  const rowCounts = new Array<number>(rows).fill(Math.floor(count / rows))
  let extra = count % rows
  const rowOrder = Array.from({ length: rows }, (_, row) => row).sort((a, b) => {
    const center = (rows - 1) / 2
    const da = Math.abs(a - center)
    const db = Math.abs(b - center)
    if (da !== db) return da - db
    return a - b
  })
  for (let i = 0; i < extra; i += 1) rowCounts[rowOrder[i]!] += 1

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
  return {
    cols,
    rows,
    gridW,
    gridH,
    startLeft,
    startTop,
    cells: buildCenteredSpreadCells({
      count,
      cols,
      rows,
      startLeft,
      startTop,
      cellW,
      cellH,
      snapPx: args.snapPx ?? 1,
    }),
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
}): number {
  const scale = Number.isFinite(args.scale) ? Number(args.scale) : 1
  const viewportW = Math.max(1, Number(args.viewportW) || 1)
  const viewportH = Math.max(1, Number(args.viewportH) || 1)
  const count = Math.max(1, Math.floor(Number(args.count) || 1))
  const baseWidth = Math.max(1, Number(args.baseWidth) || 1)
  const baseHeight = Math.max(1, Number(args.baseHeight) || 1)
  const quantizeStep = Number.isFinite(args.quantizeStep) && Number(args.quantizeStep) > 0 ? Number(args.quantizeStep) : 0.02
  const hardMinScale = Number.isFinite(args.hardMinScale) ? Number(args.hardMinScale) : 0.68
  const hardMaxScale = Number.isFinite(args.hardMaxScale) ? Number(args.hardMaxScale) : 1.06
  const quantize = (v: number) => Math.round(v / quantizeStep) * quantizeStep
  if (count <= 1) return clamp(quantize(clamp(scale, hardMinScale, hardMaxScale)), hardMinScale, hardMaxScale)

  const density = Math.max(0, count - 1)
  const targetAspect = BALANCED_OVERLAY_SPREAD_TARGET_ASPECT
  const viewportAspect = viewportW / Math.max(1, viewportH)
  const aspectBias = clamp(Math.sqrt(viewportAspect / Math.max(0.5, targetAspect)), 0.9, 1.1)
  const denseCountBias = clamp(Math.sqrt(4 / Math.max(4, count)), 0.76, 1)
  const minWidthRatio = clamp((0.11 - Math.min(0.035, density * 0.0045)) * denseCountBias * aspectBias, 0.075, 0.12)
  const maxWidthRatio = clamp((0.225 - Math.min(0.115, density * 0.011)) * denseCountBias * aspectBias, 0.12, 0.24)
  const minHeightRatio = clamp((0.17 - Math.min(0.055, density * 0.0055)) * denseCountBias, 0.11, 0.18)
  const maxHeightRatio = clamp((0.39 - Math.min(0.18, density * 0.016)) * denseCountBias, 0.22, 0.42)

  const viewportMinScale = Math.max(
    hardMinScale,
    (viewportW * minWidthRatio) / baseWidth,
    (viewportH * minHeightRatio) / baseHeight,
  )
  const viewportMaxScale = Math.min(
    hardMaxScale,
    (viewportW * maxWidthRatio) / baseWidth,
    (viewportH * maxHeightRatio) / baseHeight,
  )
  const minScale = clamp(viewportMinScale, hardMinScale, hardMaxScale)
  const maxScale = clamp(Math.max(minScale, viewportMaxScale), minScale, hardMaxScale)
  return clamp(quantize(clamp(scale, minScale, maxScale)), minScale, maxScale)
}
