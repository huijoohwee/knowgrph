export function getTextMeasureContext(font: string): CanvasRenderingContext2D | null {
  try {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.font = font
    return ctx
  } catch {
    return null
  }
}

export function estimateWrappedRowCountByChars(args: {
  text: string
  maxWidthPx: number
  ctx: CanvasRenderingContext2D
}): number {
  const { text, maxWidthPx, ctx } = args
  const safeMaxWidthPx = Math.max(1, maxWidthPx || 1)
  if (!text) return 1
  let rows = 1
  let rowWidth = 0
  for (const ch of text) {
    if (ch === '\r') continue
    const w = ctx.measureText(ch).width
    if (rowWidth + w > safeMaxWidthPx && rowWidth > 0) {
      rows += 1
      rowWidth = w
      continue
    }
    rowWidth += w
  }
  return Math.max(1, rows)
}

export function findLineAtVisualRow(prefixRows: number[], row1Based: number): number {
  const maxLine = Math.max(1, prefixRows.length - 1)
  const row = Math.max(1, Math.floor(row1Based))
  let lo = 1
  let hi = maxLine
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (prefixRows[mid] >= row) hi = mid
    else lo = mid + 1
  }
  return lo
}

export function computeVisibleLineRangeWrapped(args: {
  scrollTop: number
  viewportHeight: number
  lineCount: number
  lineHeight: number
  prefixRows: number[]
}): { startLine: number; endLine: number } {
  const { scrollTop, viewportHeight, lineCount, lineHeight, prefixRows } = args
  const safeLineHeight = Math.max(1, lineHeight || 16)
  const safeLineCount = Math.max(1, lineCount || 1)
  const firstVisibleRow = Math.max(1, Math.floor(Math.max(0, scrollTop) / safeLineHeight) + 1)
  const visibleRows = Math.max(1, Math.ceil(Math.max(0, viewportHeight) / safeLineHeight))
  const startRow = Math.max(1, firstVisibleRow - 32)
  const endRow = firstVisibleRow + visibleRows + 96
  const startLine = Math.max(1, Math.min(safeLineCount, findLineAtVisualRow(prefixRows, startRow)))
  const endLine = Math.max(startLine, Math.min(safeLineCount, findLineAtVisualRow(prefixRows, endRow)))
  return { startLine, endLine }
}
