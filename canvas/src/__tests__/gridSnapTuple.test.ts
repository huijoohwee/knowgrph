import { readSnapGridConfigFromSchema, snapDeltaToGridByAnchor, snapPointToGrid, snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { defaultSchema } from '@/lib/graph/schema'

export function testSnapGridTupleReadsReactFlowStyleAxisSteps() {
  const schema = {
    ...defaultSchema,
    behavior: {
      ...defaultSchema.behavior,
      snapGrid: { enabled: true, size: [20, 50] as const },
    },
  }
  const grid = readSnapGridConfigFromSchema(schema)
  if (grid.enabled !== true) throw new Error('expected tuple snap grid to be enabled')
  if (grid.x !== 20 || grid.y !== 50) throw new Error(`expected 20x50 snap grid, got ${grid.x}x${grid.y}`)
  if (grid.size !== 20) throw new Error(`expected scalar compatibility size to use x-axis, got ${grid.size}`)
}

export function testSnapPointUsesIndependentSnapGridAxes() {
  const snapped = snapPointToGrid({ x: 31, y: 76 }, [20, 50])
  if (snapped.x !== 40 || snapped.y !== 100) throw new Error(`expected point to snap to 40,100; got ${snapped.x},${snapped.y}`)

  const sx = snapScalarToGrid(31, [20, 50], 'x')
  const sy = snapScalarToGrid(76, [20, 50], 'y')
  if (sx !== 40 || sy !== 100) throw new Error(`expected scalar axis snap to 40/100, got ${sx}/${sy}`)
}

export function testSnapDeltaUsesAnchorAndIndependentAxes() {
  const delta = snapDeltaToGridByAnchor({
    anchorStart: { x: 5, y: 10 },
    rawDelta: { dx: 12, dy: 30 },
    gridSize: [20, 50],
  })
  if (delta.dx !== 15 || delta.dy !== 40) throw new Error(`expected anchored delta 15,40; got ${delta.dx},${delta.dy}`)
}
