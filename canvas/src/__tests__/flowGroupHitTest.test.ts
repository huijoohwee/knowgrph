import { hitTestGroup, type FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'

export function testFlowHitTestGroupUsesLabelTopExtra() {
  const runtime = {
    transform: { x: 0, y: 0, k: 1 },
    presentation: { groups: { enabled: true, shape: 'rect', paddingPx: 10, labelTopExtraPx: 20, cornerRadiusPx: 0, strokeWidthPx: 1, fillOpacity: 0.1 } },
    scene: {
      nodes: [{ id: 'a', label: 'a', x: 100, y: 100, width: 50, height: 20, shape: 'rect', handles: { in: [], out: [] }, inHandleTopPctById: {}, outHandleTopPctById: {} }],
      edges: [],
      nodeById: new Map([['a', { id: 'a', label: 'a', x: 100, y: 100, width: 50, height: 20, shape: 'rect', handles: { in: [], out: [] }, inHandleTopPctById: {}, outHandleTopPctById: {} }]]),
      groups: [{ id: 'g1', label: 'G', depth: 0, memberNodeIds: ['a'], style: {} }],
    },
  } as unknown as FlowNativeRuntime

  const insideLabelArea = hitTestGroup(runtime, { sx: 95, sy: 85 })
  if (insideLabelArea !== 'g1') throw new Error('expected group hit in label top extra area')
}

