import { placeQuickEditorsCenteredInGroupBounds } from '@/components/FlowEditor/seedGroupSpread'

export function testFlowEditorQuickEditorSeedGroupSpreadAvoidsStackingInTinyBounds() {
  const ids = ['n1', 'n2', 'n3', 'n4']
  const cellW = 384
  const cellH = 544
  const gapWorld = 24
  const placed = placeQuickEditorsCenteredInGroupBounds({
    ids,
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 80 },
    cellW,
    cellH,
    gapWorld,
    snapWorld: v => v,
  })

  if (placed.length !== ids.length) throw new Error('expected one seeded position per quick editor')

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

export function testFlowEditorQuickEditorSeedGroupSpreadDeterministicLayout() {
  const ids = ['b', 'a', 'd', 'c']
  const run = () =>
    placeQuickEditorsCenteredInGroupBounds({
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

export function testFlowEditorQuickEditorSeedGroupSpreadStaysCenteredOnTinyGroupBounds() {
  const ids = ['a', 'b', 'c', 'd']
  const cellW = 384
  const cellH = 544
  const gapWorld = 24
  const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 80 }
  const placed = placeQuickEditorsCenteredInGroupBounds({
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
