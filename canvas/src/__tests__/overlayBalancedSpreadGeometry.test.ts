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

export function testBalancedSpreadLayoutKeepsFinalFootprintWithinUsableViewportAndSpansCenter() {
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
  const usableLeft = margins.left
  const usableRight = viewportW - margins.right
  const usableTop = margins.top
  const usableBottom = viewportH - margins.bottom
  const usableCenterX = usableLeft + (usableRight - usableLeft) / 2
  const usableCenterY = usableTop + (usableBottom - usableTop) / 2
  const minLeft = layout.startLeft
  const maxRight = layout.startLeft + layout.gridW
  const minTop = layout.startTop
  const maxBottom = layout.startTop + layout.gridH

  if (minLeft < usableLeft || maxRight > usableRight || minTop < usableTop || maxBottom > usableBottom) {
    throw new Error(
      `expected final balanced footprint within usable viewport, got bounds ${minLeft},${minTop} → ${maxRight},${maxBottom} inside ${usableLeft},${usableTop} → ${usableRight},${usableBottom}`,
    )
  }

  if (!(minLeft < usableCenterX && maxRight > usableCenterX && minTop < usableCenterY && maxBottom > usableCenterY)) {
    throw new Error(
      `expected balanced footprint to span usable center ${usableCenterX},${usableCenterY}, got bounds ${minLeft},${minTop} → ${maxRight},${maxBottom}`,
    )
  }
}

export function testBalancedSpreadLayoutIsDeterministicForFinalBalancedOutputs() {
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
  const args = {
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
  }
  const first = computeBalancedSpreadLayout(args)
  const second = computeBalancedSpreadLayout(args)

  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error('expected final balanced layout outputs to stay deterministic for identical inputs')
  }
}

export function testBalancedSpreadLayoutKeepsDenseMixedSetWithinBoundsWithoutStripOrTowerCollapse() {
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
    count: 9,
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
  const usableLeft = margins.left
  const usableRight = viewportW - margins.right
  const usableTop = margins.top
  const usableBottom = viewportH - margins.bottom
  const minLeft = layout.startLeft
  const maxRight = layout.startLeft + layout.gridW
  const minTop = layout.startTop
  const maxBottom = layout.startTop + layout.gridH
  const uniqueRows = new Set(layout.cells.map(cell => Math.round(cell.top)))
  const uniqueCols = new Set(layout.cells.map(cell => Math.round(cell.left)))

  if (minLeft < usableLeft || maxRight > usableRight || minTop < usableTop || maxBottom > usableBottom) {
    throw new Error(
      `expected dense balanced footprint within usable viewport, got bounds ${minLeft},${minTop} → ${maxRight},${maxBottom} inside ${usableLeft},${usableTop} → ${usableRight},${usableBottom}`,
    )
  }

  if (uniqueRows.size < 2 || uniqueCols.size < 2) {
    throw new Error(
      `expected dense balanced spread to avoid strip or tower collapse, got rows=${uniqueRows.size}, cols=${uniqueCols.size}`,
    )
  }

  for (let i = 0; i < layout.cells.length; i += 1) {
    const a = layout.cells[i]!
    for (let j = i + 1; j < layout.cells.length; j += 1) {
      const b = layout.cells[j]!
      const overlapX = a.left < b.left + footprintW && b.left < a.left + footprintW
      const overlapY = a.top < b.top + footprintH && b.top < a.top + footprintH
      if (overlapX && overlapY) {
        throw new Error(`expected dense balanced spread to forbid overlap, got overlap between ${i} and ${j}`)
      }
    }
  }
}
