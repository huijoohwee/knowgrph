import * as d3 from 'd3'

export function testFlowEditorInitialTransformWaitsForFinitePositions() {
  const lastKeyRef = { current: null as string | null }

  const shouldApply = (args: {
    datasetKey: string
    zoomViewKey: string
    current: d3.ZoomTransform
    canvas2dRenderer: string
    hasAnyFinitePos: boolean
  }) => {
    const isFlowEditor = args.canvas2dRenderer === 'flowEditor'
    const normalized = args.datasetKey.startsWith('rev:') ? 'rev' : args.datasetKey
    const initKey = isFlowEditor ? `flowEditor:${normalized}` : args.zoomViewKey
    const already = lastKeyRef.current === initKey
    const t0 = args.current
    const hasNonIdentity = t0.k !== 1 || t0.x !== 0 || t0.y !== 0
    if (isFlowEditor && already) return false
    if (!isFlowEditor && already && hasNonIdentity) return false
    if (isFlowEditor && !args.hasAnyFinitePos) return false
    lastKeyRef.current = initKey
    return true
  }

  if (shouldApply({ datasetKey: 'd1', zoomViewKey: 'k1', current: d3.zoomIdentity, canvas2dRenderer: 'flowEditor', hasAnyFinitePos: false })) {
    throw new Error('expected init apply to be blocked until finite positions exist')
  }
  if (lastKeyRef.current != null) {
    throw new Error('expected init key to remain unset when no finite positions exist')
  }
  if (!shouldApply({ datasetKey: 'd1', zoomViewKey: 'k1', current: d3.zoomIdentity, canvas2dRenderer: 'flowEditor', hasAnyFinitePos: true })) {
    throw new Error('expected init apply to be allowed once finite positions exist')
  }
  if (shouldApply({
    datasetKey: 'd1',
    zoomViewKey: 'k1',
    current: d3.zoomIdentity.translate(10, 0).scale(1),
    canvas2dRenderer: 'flowEditor',
    hasAnyFinitePos: true,
  })) {
    throw new Error('expected subsequent apply to be blocked after init')
  }
}

