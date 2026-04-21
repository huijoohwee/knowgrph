import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { fitFlowEditorPinnedWidgets } from '@/components/FlowCanvas/fitPinnedWidgets'

export function testFlowEditorFitIncludesPinnedWidgets() {
  const nodes = [
    {
      id: 'n1',
      type: 'Test',
      label: 'n1',
      x: 0,
      y: 0,
      properties: {
        'visual:width': 120,
        'visual:height': 80,
        'visual:shape': 'rect',
      },
    },
  ]
  const fitW = 420
  const fitH = 240
  const fitOpts = { pad: 24, minScale: 0.01, maxScale: 10 }

  const base = fitAllTransform(nodes as never, fitW, fitH, fitOpts as never)
  const withPinned = fitFlowEditorPinnedWidgets({
    nodes: nodes as never,
    fitW,
    viewportH: fitH,
    viewportW: fitW,
    openWidgetNodeIds: ['n1'],
    pinnedById: { n1: true },
    worldPosById: { n1: { x: 1000, y: 0 } },
    portExtraPadScreenPx: 0,
    graphData: null,
    fitOpts: fitOpts as never,
  })

  if (!(withPinned.k < base.k - 1e-6)) {
    throw new Error(`expected pinned widgets to reduce fit scale, base=${base.k} next=${withPinned.k}`)
  }
}
