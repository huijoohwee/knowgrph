import {
  computeBalancedSpreadLayout,
  computeBalancedSpreadViewportMargins,
} from '@/lib/ui/overlayBalancedSpread'

function measureCentroid(args: {
  cells: Array<{ left: number; top: number }>
  footprintW: number
  footprintH: number
}): { x: number; y: number } {
  const cells = Array.isArray(args.cells) ? args.cells : []
  const footprintW = Math.max(1, Number(args.footprintW) || 1)
  const footprintH = Math.max(1, Number(args.footprintH) || 1)
  const centroid = cells.reduce(
    (acc, cell) => ({ x: acc.x + cell.left + footprintW / 2, y: acc.y + cell.top + footprintH / 2 }),
    { x: 0, y: 0 },
  )
  return {
    x: centroid.x / Math.max(1, cells.length),
    y: centroid.y / Math.max(1, cells.length),
  }
}

export function testBalancedSpreadLayoutCentersOccupiedCentroidOn1920x1080() {
  const viewportW = 1920
  const viewportH = 1080
  const gapPx = 24
  const cellW = 300 + gapPx
  const cellH = 220 + gapPx
  const margins = computeBalancedSpreadViewportMargins({
    viewportW,
    viewportH,
    preset: 'widgetFrontmatter',
  })
  const layout = computeBalancedSpreadLayout({
    count: 5,
    viewportW,
    viewportH,
    cellW,
    cellH,
    gapPx,
    zoomK: 1,
    marginLeftPx: margins.left,
    marginRightPx: margins.right,
    marginTopPx: margins.top,
    marginBottomPx: margins.bottom,
    snapPx: 1,
  })
  const footprintW = cellW - gapPx
  const footprintH = cellH - gapPx
  const centroid = measureCentroid({ cells: layout.cells, footprintW, footprintH })
  const expectedCenterX = margins.left + (viewportW - margins.left - margins.right) / 2
  const expectedCenterY = margins.top + (viewportH - margins.top - margins.bottom) / 2

  if (Math.abs(centroid.x - expectedCenterX) > 1 || Math.abs(centroid.y - expectedCenterY) > 1) {
    throw new Error(`expected balanced occupied centroid near ${expectedCenterX},${expectedCenterY}, got ${centroid.x},${centroid.y}`)
  }
}

export function testBalancedSpreadLayoutAvoidsSingleAxisStripAndOverlapOn1920x1080() {
  const viewportW = 1920
  const viewportH = 1080
  const gapPx = 24
  const cellW = 300 + gapPx
  const cellH = 220 + gapPx
  const margins = computeBalancedSpreadViewportMargins({
    viewportW,
    viewportH,
    preset: 'widgetFrontmatter',
  })
  const layout = computeBalancedSpreadLayout({
    count: 6,
    viewportW,
    viewportH,
    cellW,
    cellH,
    gapPx,
    zoomK: 1,
    marginLeftPx: margins.left,
    marginRightPx: margins.right,
    marginTopPx: margins.top,
    marginBottomPx: margins.bottom,
    snapPx: 1,
  })
  const footprintW = cellW - gapPx
  const footprintH = cellH - gapPx
  const uniqueRows = new Set(layout.cells.map(cell => Math.round(cell.top)))
  const uniqueCols = new Set(layout.cells.map(cell => Math.round(cell.left)))

  if (uniqueRows.size < 2 || uniqueCols.size < 2) {
    throw new Error(`expected balanced 16:9 spread to avoid one-axis strip collapse, got rows=${uniqueRows.size}, cols=${uniqueCols.size}`)
  }

  for (let i = 0; i < layout.cells.length; i += 1) {
    const a = layout.cells[i]!
    for (let j = i + 1; j < layout.cells.length; j += 1) {
      const b = layout.cells[j]!
      const overlapX = a.left < b.left + footprintW && b.left < a.left + footprintW
      const overlapY = a.top < b.top + footprintH && b.top < a.top + footprintH
      if (overlapX && overlapY) {
        throw new Error(`expected balanced 16:9 spread to forbid overlap, got overlap between ${i} and ${j}`)
      }
    }
  }
}
