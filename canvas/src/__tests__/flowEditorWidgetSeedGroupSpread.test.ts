import { placeWidgetsCenteredInGroupBounds } from '@/components/FlowEditor/seedGroupSpread'

export function testFlowEditorWidgetSeedGroupSpreadAvoidsStackingInTinyBounds() {
  const ids = ['n1', 'n2', 'n3', 'n4']
  const cellW = 384
  const cellH = 544
  const gapWorld = 24
  const placed = placeWidgetsCenteredInGroupBounds({
    ids,
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 80 },
    cellW,
    cellH,
    gapWorld,
    snapWorld: v => v,
  })

  if (placed.length !== ids.length) throw new Error('expected one seeded position per widget')

  const byId = new Map(placed.map(p => [p.id, p]))
  for (const id of ids) {
    if (!byId.has(id)) throw new Error(`missing seeded position for ${id}`)
  }

  for (let i = 0; i < placed.length; i += 1) {
    const a = placed[i]!
    for (let j = i + 1; j < placed.length; j += 1) {
      const b = placed[j]!
      const overlapX = a.x < b.x + cellW && b.x < a.x + cellW
      const overlapY = a.y < b.y + cellH && b.y < a.y + cellH
      if (overlapX && overlapY) {
        throw new Error(`expected non-overlapping seeded panels, got overlap for ${a.id} and ${b.id}`)
      }
    }
  }
}

export function testFlowEditorWidgetSeedGroupSpreadDeterministicLayout() {
  const ids = ['b', 'a', 'd', 'c']
  const run = () =>
    placeWidgetsCenteredInGroupBounds({
      ids: [...ids].sort((x, y) => x.localeCompare(y)),
      bounds: { minX: -20, minY: -10, maxX: 120, maxY: 90 },
      cellW: 384,
      cellH: 544,
      gapWorld: 24,
      snapWorld: v => Math.round(v),
    })

  const first = run()
  const second = run()
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error('expected deterministic seed layout across repeated runs')
  }
}

export function testFlowEditorWidgetSeedGroupSpreadStaysCenteredOnTinyGroupBounds() {
  const ids = ['a', 'b', 'c', 'd']
  const cellW = 384
  const cellH = 544
  const gapWorld = 24
  const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 80 }
  const placed = placeWidgetsCenteredInGroupBounds({
    ids,
    bounds,
    cellW,
    cellH,
    gapWorld,
    snapWorld: v => v,
  })

  const panelW = cellW - gapWorld
  const panelH = cellH - gapWorld
  const centroid = placed.reduce(
    (acc, entry) => ({ x: acc.x + entry.x + panelW / 2, y: acc.y + entry.y + panelH / 2 }),
    { x: 0, y: 0 },
  )
  centroid.x /= placed.length
  centroid.y /= placed.length

  const expectedCenterX = (bounds.minX + bounds.maxX) / 2
  const expectedCenterY = (bounds.minY + bounds.maxY) / 2
  if (Math.abs(centroid.x - expectedCenterX) > 0.0001 || Math.abs(centroid.y - expectedCenterY) > 0.0001) {
    throw new Error(`expected seeded centroid at bounds center, got ${centroid.x},${centroid.y}`)
  }
}

export function testFlowEditorWidgetSeedGroupSpreadAvoidsSingleRowWideStripAfterReseed() {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const cellW = 384
  const cellH = 544
  const gapWorld = 24
  const placed = placeWidgetsCenteredInGroupBounds({
    ids,
    bounds: { minX: 0, minY: 0, maxX: 2400, maxY: 180 },
    cellW,
    cellH,
    gapWorld,
    snapWorld: v => v,
  })

  const uniqueRows = new Set(placed.map(entry => Math.round(entry.y)))
  if (uniqueRows.size < 2) {
    throw new Error(`expected wide-bounds reseed to avoid a single-row strip, got rows=${JSON.stringify(placed.map(entry => entry.y))}`)
  }
}

export function testFlowEditorWidgetSeedGroupSpreadSupportsPreferredFrontmatterHeroFirstRow() {
  const ids = ['S01', 'S02', 'S03', 'S04', 'S05']
  const placed = placeWidgetsCenteredInGroupBounds({
    ids,
    bounds: { minX: 0, minY: 0, maxX: 1920, maxY: 1080 },
    cellW: 384,
    cellH: 544,
    gapWorld: 24,
    snapWorld: v => v,
    preferredFirstRowCount: 3,
  })

  const firstRowY = placed[0]?.y
  const firstRow = placed.filter(entry => entry.y === firstRowY)
  const secondRow = placed.filter(entry => entry.y !== firstRowY)
  if (firstRow.length !== 3) {
    throw new Error(`expected preferred hero first row to contain 3 widgets, got ${firstRow.length}`)
  }
  if (secondRow.length !== 2) {
    throw new Error(`expected CTA second row to contain remaining 2 widgets, got ${secondRow.length}`)
  }
  if (!(placed[0]!.x < placed[1]!.x && placed[1]!.x < placed[2]!.x)) {
    throw new Error('expected preferred hero first row to preserve left-to-right ordering')
  }
}

export function testFlowEditorWidgetSeedGroupSpreadKeepsPreferredFrontmatterHeroRowsNonOverlapping() {
  const ids = ['S01', 'S02', 'S03', 'S04', 'S05']
  const cellW = 384
  const cellH = 544
  const gapWorld = 24
  const regular = placeWidgetsCenteredInGroupBounds({
    ids,
    bounds: { minX: 0, minY: 0, maxX: 1920, maxY: 1080 },
    cellW,
    cellH,
    gapWorld,
    snapWorld: v => v,
    preferredFirstRowCount: 3,
  })
  const tightened = placeWidgetsCenteredInGroupBounds({
    ids,
    bounds: { minX: 0, minY: 0, maxX: 1920, maxY: 1080 },
    cellW,
    cellH,
    gapWorld,
    snapWorld: v => v,
    preferredFirstRowCount: 3,
    preferredRowGapScale: 0.76,
  })

  const regularFirstRowY = regular[0]!.y
  const regularSecondRowY = regular.find(entry => entry.y !== regularFirstRowY)!.y
  const tightenedFirstRowY = tightened[0]!.y
  const tightenedSecondRowY = tightened.find(entry => entry.y !== tightenedFirstRowY)!.y
  const regularGap = regularSecondRowY - regularFirstRowY
  const tightenedGap = tightenedSecondRowY - tightenedFirstRowY

  if (tightenedGap < cellH) {
    throw new Error(`expected preferred hero row gap scale to preserve non-overlapping top-to-top spacing, got gap=${tightenedGap} cellH=${cellH}`)
  }
  if (tightenedGap < regularGap) {
    throw new Error(`expected preferred hero row gap scale to avoid shrinking balanced row spacing below the planner contract, regular=${regularGap} tightened=${tightenedGap}`)
  }
}

export function testFlowEditorWidgetSeedGroupSpreadSupportsPreferredSingleRowFrontmatterStagger() {
  const ids = ['w-img-scene', 'w-text-script', 'w-video-scene']
  const regular = placeWidgetsCenteredInGroupBounds({
    ids,
    bounds: { minX: 0, minY: 0, maxX: 1920, maxY: 1080 },
    cellW: 384,
    cellH: 544,
    gapWorld: 24,
    snapWorld: v => v,
  })
  const staggered = placeWidgetsCenteredInGroupBounds({
    ids,
    bounds: { minX: 0, minY: 0, maxX: 1920, maxY: 1080 },
    cellW: 384,
    cellH: 544,
    gapWorld: 24,
    snapWorld: v => v,
    preferredSingleRowStaggerScale: 0.12,
  })

  const regularSpan = Math.max(...regular.map(entry => entry.y)) - Math.min(...regular.map(entry => entry.y))
  const staggeredByX = [...staggered].sort((a, b) => a.x - b.x)
  const staggeredSpan = staggeredByX[2]!.y - staggeredByX[0]!.y

  if (!(staggeredSpan > regularSpan + 40)) {
    throw new Error(`expected preferred single-row stagger to increase trio vertical separation, regular=${regularSpan} staggered=${staggeredSpan}`)
  }
  if (!(staggeredByX[0]!.y < staggeredByX[1]!.y && staggeredByX[1]!.y < staggeredByX[2]!.y)) {
    throw new Error(`expected preferred single-row stagger to keep a readable left-to-right vertical cascade, got ${JSON.stringify(staggeredByX.map(entry => ({ id: entry.id, x: entry.x, y: entry.y })))}`)
  }
}
