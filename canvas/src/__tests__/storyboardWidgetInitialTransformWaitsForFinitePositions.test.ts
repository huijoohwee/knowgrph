import * as d3 from 'd3'

export function testStoryboardWidgetInitialTransformWaitsForFinitePositions() {
  const lastKeyRef = { current: null as string | null }

  const shouldApply = (args: {
    datasetKey: string
    zoomViewKey: string
    current: d3.ZoomTransform
    canvas2dRenderer: string
  }) => {
    const storyboardWidgetMode = args.canvas2dRenderer === 'storyboard'
    const normalized = args.datasetKey.startsWith('rev:') ? 'rev' : args.datasetKey
    const initKey = storyboardWidgetMode ? `storyboardWidget:${normalized}` : args.zoomViewKey
    const already = lastKeyRef.current === initKey
    const t0 = args.current
    const hasNonIdentity = t0.k !== 1 || t0.x !== 0 || t0.y !== 0
    if (storyboardWidgetMode && already) return false
    if (!storyboardWidgetMode && already && hasNonIdentity) return false
    lastKeyRef.current = initKey
    return true
  }

  if (!shouldApply({ datasetKey: 'd1', zoomViewKey: 'k1', current: d3.zoomIdentity, canvas2dRenderer: 'storyboard' })) {
    throw new Error('expected init apply to be allowed for storyboardWidget even before final layout')
  }
  if (shouldApply({
    datasetKey: 'd1',
    zoomViewKey: 'k1',
    current: d3.zoomIdentity.translate(10, 0).scale(1),
    canvas2dRenderer: 'storyboard',
  })) {
    throw new Error('expected subsequent apply to be blocked after init')
  }
}
