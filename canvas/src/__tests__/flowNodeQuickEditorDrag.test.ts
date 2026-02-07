import {
  FLOW_NODE_QUICK_EDITOR_DRAG_MIME,
  FLOW_NODE_QUICK_EDITOR_DRAG_KIND,
  FLOW_NODE_QUICK_EDITOR_DRAG_VERSION,
} from '@/lib/config'
import {
  buildFlowNodeQuickEditorDragPayload,
  flowNodeQuickEditorDragPayloadToDataTransferText,
  readFlowNodeQuickEditorDragPayloadFromDataTransfer,
} from '@/lib/flowEditor/nodeQuickEditorDrag'

export function testFlowNodeQuickEditorDragPayloadRoundTrip() {
  const payload = buildFlowNodeQuickEditorDragPayload({ registryEntryId: 'qer-123' })
  if (!payload) throw new Error('expected payload')
  if (payload.kind !== FLOW_NODE_QUICK_EDITOR_DRAG_KIND) throw new Error('unexpected kind')
  if (payload.version !== FLOW_NODE_QUICK_EDITOR_DRAG_VERSION) throw new Error('unexpected version')

  const text = flowNodeQuickEditorDragPayloadToDataTransferText(payload)
  const reread = readFlowNodeQuickEditorDragPayloadFromDataTransfer({
    getData: (mime) => (mime === FLOW_NODE_QUICK_EDITOR_DRAG_MIME ? text : ''),
  })
  if (!reread) throw new Error('expected reread payload')
  if (reread.registryEntryId !== 'qer-123') throw new Error('expected registryEntryId to round trip')
}

export function testFlowNodeQuickEditorDragPayloadReturnsNullWhenMissing() {
  const reread = readFlowNodeQuickEditorDragPayloadFromDataTransfer({
    getData: () => '',
  })
  if (reread) throw new Error('expected missing payload to return null')
}

export function testFlowNodeQuickEditorDragPayloadReadsFromApplicationJsonFallback() {
  const payload = buildFlowNodeQuickEditorDragPayload({ registryEntryId: 'qer-456' })
  if (!payload) throw new Error('expected payload')
  const text = flowNodeQuickEditorDragPayloadToDataTransferText(payload)
  const reread = readFlowNodeQuickEditorDragPayloadFromDataTransfer({
    getData: (mime) => (mime === 'application/json' ? text : ''),
  })
  if (!reread) throw new Error('expected reread payload from application/json')
  if (reread.registryEntryId !== 'qer-456') throw new Error('expected registryEntryId to round trip')
}

export function testFlowNodeQuickEditorDragPayloadReadsFromTextPlainFallback() {
  const payload = buildFlowNodeQuickEditorDragPayload({ registryEntryId: 'qer-789' })
  if (!payload) throw new Error('expected payload')
  const text = flowNodeQuickEditorDragPayloadToDataTransferText(payload)
  const reread = readFlowNodeQuickEditorDragPayloadFromDataTransfer({
    getData: (mime) => (mime === 'text/plain' ? text : ''),
  })
  if (!reread) throw new Error('expected reread payload from text/plain')
  if (reread.registryEntryId !== 'qer-789') throw new Error('expected registryEntryId to round trip')
}

export function testFlowNodeQuickEditorDragPayloadReadsFromUriListFallback() {
  const reread = readFlowNodeQuickEditorDragPayloadFromDataTransfer({
    getData: (mime) => (mime === 'text/uri-list' ? 'application/x-kg-flow-node-quick-editor:qer-999' : ''),
  })
  if (!reread) throw new Error('expected reread payload from text/uri-list')
  if (reread.registryEntryId !== 'qer-999') throw new Error('expected registryEntryId to match uri-list')
}
