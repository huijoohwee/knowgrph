import { computeDefaultWidgetFloatingPos } from '@/components/FlowEditor/widgetLayout'

export function testWidgetDefaultFloatingPosDependsOnViewport() {
  const small = computeDefaultWidgetFloatingPos({ stackIndex: 0, viewportW: 1, viewportH: 1 })
  const big = computeDefaultWidgetFloatingPos({ stackIndex: 0, viewportW: 2000, viewportH: 1200 })

  if (!(small.left === 8 && small.top === 8)) {
    throw new Error(`expected tiny viewport to clamp to 8,8 but got ${small.left},${small.top}`)
  }
  if (!(big.left > 8 && big.top > 8)) {
    throw new Error(`expected larger viewport to use non-clamped defaults but got ${big.left},${big.top}`)
  }
}

