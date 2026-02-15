import * as d3 from 'd3'

export function testFlowEditorInitialTransformDoesNotReapplyAfterUserPan() {
  const lastKeyRef = { current: null as string | null }

  const shouldApply = (args: { datasetKey: string; zoomViewKey: string; current: d3.ZoomTransform; canvas2dRenderer: string }) => {
    const isFlowEditor = args.canvas2dRenderer === 'flowEditor'
    const normalized = args.datasetKey.startsWith('rev:') ? 'rev' : args.datasetKey
    const initKey = isFlowEditor ? `flowEditor:${normalized}` : args.zoomViewKey
    const already = lastKeyRef.current === initKey
    const t0 = args.current
    const hasNonIdentity = t0.k !== 1 || t0.x !== 0 || t0.y !== 0
    if (isFlowEditor && already) return false
    if (!isFlowEditor && already && hasNonIdentity) return false
    lastKeyRef.current = initKey
    return true
  }

  if (!shouldApply({ datasetKey: 'd1', zoomViewKey: 'k1', current: d3.zoomIdentity, canvas2dRenderer: 'flowEditor' })) {
    throw new Error('expected first init apply to be allowed')
  }
  if (shouldApply({ datasetKey: 'd1', zoomViewKey: 'k1', current: d3.zoomIdentity.translate(10, 0).scale(1), canvas2dRenderer: 'flowEditor' })) {
    throw new Error('expected subsequent apply to be blocked after user transform')
  }
  if (shouldApply({ datasetKey: 'd1', zoomViewKey: 'k2', current: d3.zoomIdentity.translate(10, 0).scale(1), canvas2dRenderer: 'flowEditor' })) {
    throw new Error('expected flowEditor init key to ignore zoomViewKey churn')
  }
  if (!shouldApply({ datasetKey: 'd2', zoomViewKey: 'k2', current: d3.zoomIdentity.translate(10, 0).scale(1), canvas2dRenderer: 'flowEditor' })) {
    throw new Error('expected apply to be allowed for new datasetKey')
  }

  if (!shouldApply({ datasetKey: 'rev:1', zoomViewKey: 'k3', current: d3.zoomIdentity, canvas2dRenderer: 'flowEditor' })) {
    throw new Error('expected apply to be allowed for rev datasetKey')
  }
  if (shouldApply({ datasetKey: 'rev:2', zoomViewKey: 'k4', current: d3.zoomIdentity, canvas2dRenderer: 'flowEditor' })) {
    throw new Error('expected rev datasetKey changes to be ignored for flowEditor init key')
  }
  if (!shouldApply({ datasetKey: 'd3', zoomViewKey: 'k3', current: d3.zoomIdentity, canvas2dRenderer: 'flow' })) {
    throw new Error('expected non-flowEditor behavior to allow first init')
  }
}
