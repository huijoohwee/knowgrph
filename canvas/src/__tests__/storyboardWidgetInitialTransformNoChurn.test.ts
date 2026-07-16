import * as d3 from 'd3'

export function testStoryboardWidgetInitialTransformDoesNotReapplyAfterSameDocumentGrowth() {
  const lastKeyRef = { current: null as string | null }

  const shouldApply = (args: { zoomViewKey: string; current: d3.ZoomTransform; canvas2dRenderer: string }) => {
    const storyboardWidgetMode = args.canvas2dRenderer === 'storyboard'
    const initKey = storyboardWidgetMode ? `storyboardWidget:${args.zoomViewKey}` : args.zoomViewKey
    const already = lastKeyRef.current === initKey
    const t0 = args.current
    const hasNonIdentity = t0.k !== 1 || t0.x !== 0 || t0.y !== 0
    if (storyboardWidgetMode && already) return false
    if (!storyboardWidgetMode && already && hasNonIdentity) return false
    lastKeyRef.current = initKey
    return true
  }

  if (!shouldApply({ zoomViewKey: 'document-1', current: d3.zoomIdentity, canvas2dRenderer: 'storyboard' })) {
    throw new Error('expected first init apply to be allowed')
  }
  if (shouldApply({ zoomViewKey: 'document-1', current: d3.zoomIdentity.translate(10, 0).scale(1), canvas2dRenderer: 'storyboard' })) {
    throw new Error('expected subsequent apply to be blocked after user transform')
  }
  if (!shouldApply({ zoomViewKey: 'document-2', current: d3.zoomIdentity.translate(10, 0).scale(1), canvas2dRenderer: 'storyboard' })) {
    throw new Error('expected apply to be allowed for a new document/view key')
  }
  if (!shouldApply({ zoomViewKey: 'flow-1', current: d3.zoomIdentity, canvas2dRenderer: 'flow' })) {
    throw new Error('expected non-storyboardWidget behavior to allow first init')
  }
}
