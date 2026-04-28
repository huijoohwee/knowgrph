import { buildEdgePathD, traceEdgePathOnCanvas } from '@/lib/graph/edgeTypes'

const readPathNumbers = (pathD: string): number[] => {
  const numbers = String(pathD || '').match(/-?\d+(?:\.\d+)?/g)
  if (!numbers) return []
  return numbers.map(Number)
}

const almostEqual = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps

export function testBezierPathUsesAxisAlignedControlsForLrAndTbDefaults() {
  const lr = readPathNumbers(buildEdgePathD({ edgeType: 'bezier', sx: 0, sy: 0, tx: 240, ty: 80, rankdir: 'LR' }))
  if (lr.length !== 8) throw new Error(`expected cubic bezier path with 8 numeric slots, got ${lr.length}`)
  const [, , c1xLr, c1yLr, c2xLr, c2yLr, txLr, tyLr] = lr
  if (!almostEqual(txLr, 240) || !almostEqual(tyLr, 80)) throw new Error('expected LR bezier endpoint to stay stable')
  if (!almostEqual(c1yLr, 0) || !almostEqual(c2yLr, 80)) {
    throw new Error('expected LR bezier default controls to stay axis-aligned with source/target Y')
  }
  if (!(c1xLr > 0 && c1xLr < 240 && c2xLr > 0 && c2xLr < 240)) {
    throw new Error('expected LR bezier default controls to stay between source and target X')
  }

  const tb = readPathNumbers(buildEdgePathD({ edgeType: 'bezier', sx: 20, sy: 10, tx: 80, ty: 230, rankdir: 'TB' }))
  if (tb.length !== 8) throw new Error(`expected cubic bezier path with 8 numeric slots, got ${tb.length}`)
  const [, , c1xTb, c1yTb, c2xTb, c2yTb, txTb, tyTb] = tb
  if (!almostEqual(txTb, 80) || !almostEqual(tyTb, 230)) throw new Error('expected TB bezier endpoint to stay stable')
  if (!almostEqual(c1xTb, 20) || !almostEqual(c2xTb, 80)) {
    throw new Error('expected TB bezier default controls to stay axis-aligned with source/target X')
  }
  if (!(c1yTb > 10 && c1yTb < 230 && c2yTb > 10 && c2yTb < 230)) {
    throw new Error('expected TB bezier default controls to stay between source and target Y')
  }
}

export function testBezierCanvasTracingReusesSharedControlPoints() {
  const pathNumbers = readPathNumbers(buildEdgePathD({ edgeType: 'bezier', sx: 10, sy: 12, tx: 180, ty: 72, rankdir: 'LR' }))
  if (pathNumbers.length !== 8) throw new Error('expected cubic bezier svg path numbers')
  const [, , c1x, c1y, c2x, c2y, tx, ty] = pathNumbers
  let captured: number[] | null = null
  const ctx = {
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: (...values: number[]) => {
      captured = values
    },
  } as unknown as CanvasRenderingContext2D
  traceEdgePathOnCanvas({
    ctx,
    edgeType: 'bezier',
    sx: 10,
    sy: 12,
    tx: 180,
    ty: 72,
    rankdir: 'LR',
  })
  if (!captured || captured.length !== 6) throw new Error('expected canvas bezier tracing to emit one cubic segment')
  if (
    !almostEqual(captured[0], c1x) ||
    !almostEqual(captured[1], c1y) ||
    !almostEqual(captured[2], c2x) ||
    !almostEqual(captured[3], c2y) ||
    !almostEqual(captured[4], tx) ||
    !almostEqual(captured[5], ty)
  ) {
    throw new Error('expected canvas bezier tracing to reuse shared bezier control points from svg path builder')
  }
}
