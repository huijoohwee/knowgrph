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
