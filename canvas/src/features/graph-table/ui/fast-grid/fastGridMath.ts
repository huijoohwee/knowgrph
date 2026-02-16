export type Range = { start: number; end: number }

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function makeOffsets(widths: number[]): number[] {
  const out = new Array<number>(widths.length + 1)
  out[0] = 0
  for (let i = 0; i < widths.length; i += 1) {
    out[i + 1] = out[i] + widths[i]
  }
  return out
}

export function binarySearchFloor(offsets: number[], x: number): number {
  let lo = 0
  let hi = offsets.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (offsets[mid] <= x) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function getVisibleRange(opts: {
  startPx: number
  viewportPx: number
  itemSizePx: number
  itemCount: number
  overscan: number
}): Range {
  const { startPx, viewportPx, itemSizePx, itemCount, overscan } = opts
  if (itemCount <= 0) return { start: 0, end: 0 }
  const start = clamp(Math.floor(startPx / itemSizePx) - overscan, 0, itemCount)
  const end = clamp(Math.ceil((startPx + viewportPx) / itemSizePx) + overscan, 0, itemCount)
  return { start, end }
}

export function getVisibleColumnsRange(opts: {
  offsets: number[]
  startPx: number
  viewportPx: number
  overscan: number
}): Range {
  const { offsets, startPx, viewportPx, overscan } = opts
  const colCount = Math.max(0, offsets.length - 1)
  if (colCount <= 0) return { start: 0, end: 0 }
  const startIdx = clamp(binarySearchFloor(offsets, startPx) - overscan, 0, colCount)
  const endIdx = clamp(binarySearchFloor(offsets, startPx + viewportPx) + 1 + overscan, 0, colCount)
  return { start: startIdx, end: endIdx }
}

