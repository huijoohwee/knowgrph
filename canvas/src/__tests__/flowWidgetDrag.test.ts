import {
  FLOW_WIDGET_DRAG_MIME,
  FLOW_WIDGET_DRAG_KIND,
  FLOW_WIDGET_DRAG_VERSION,
} from '@/lib/config'
import {
  beginFlowWidgetPointerDragSession,
  buildFlowWidgetDragPayload,
  clearActiveFlowWidgetPointerDragSession,
  flowWidgetDragPayloadToDataTransferText,
  markFlowWidgetPointerDragNativeStart,
  readActiveFlowWidgetPointerDragSession,
  readFlowWidgetDragPayloadFromDataTransfer,
} from '@/lib/flowEditor/widgetDrag'

export function testFlowWidgetDragPayloadRoundTrip() {
  const payload = buildFlowWidgetDragPayload({ registryEntryId: 'qer-123' })
  if (!payload) throw new Error('expected payload')
  if (payload.kind !== FLOW_WIDGET_DRAG_KIND) throw new Error('unexpected kind')
  if (payload.version !== FLOW_WIDGET_DRAG_VERSION) throw new Error('unexpected version')

  const text = flowWidgetDragPayloadToDataTransferText(payload)
  const reread = readFlowWidgetDragPayloadFromDataTransfer({
    getData: (mime) => (mime === FLOW_WIDGET_DRAG_MIME ? text : ''),
  })
  if (!reread) throw new Error('expected reread payload')
  if (reread.registryEntryId !== 'qer-123') throw new Error('expected registryEntryId to round trip')
}

export function testFlowWidgetDragPayloadReturnsNullWhenMissing() {
  const reread = readFlowWidgetDragPayloadFromDataTransfer({
    getData: () => '',
  })
  if (reread) throw new Error('expected missing payload to return null')
}

export function testFlowWidgetDragPayloadReadsFromApplicationJsonFallback() {
  const payload = buildFlowWidgetDragPayload({ registryEntryId: 'qer-456' })
  if (!payload) throw new Error('expected payload')
  const text = flowWidgetDragPayloadToDataTransferText(payload)
  const reread = readFlowWidgetDragPayloadFromDataTransfer({
    getData: (mime) => (mime === 'application/json' ? text : ''),
  })
  if (!reread) throw new Error('expected reread payload from application/json')
  if (reread.registryEntryId !== 'qer-456') throw new Error('expected registryEntryId to round trip')
}

export function testFlowWidgetDragPayloadReadsFromTextPlainFallback() {
  const payload = buildFlowWidgetDragPayload({ registryEntryId: 'qer-789' })
  if (!payload) throw new Error('expected payload')
  const text = flowWidgetDragPayloadToDataTransferText(payload)
  const reread = readFlowWidgetDragPayloadFromDataTransfer({
    getData: (mime) => (mime === 'text/plain' ? text : ''),
  })
  if (!reread) throw new Error('expected reread payload from text/plain')
  if (reread.registryEntryId !== 'qer-789') throw new Error('expected registryEntryId to round trip')
}

export function testFlowWidgetDragPayloadReadsFromUriListFallback() {
  const reread = readFlowWidgetDragPayloadFromDataTransfer({
    getData: (mime) => (mime === 'text/uri-list' ? 'application/x-kg-flow-widget:qer-999' : ''),
  })
  if (!reread) throw new Error('expected reread payload from text/uri-list')
  if (reread.registryEntryId !== 'qer-999') throw new Error('expected registryEntryId to match uri-list')
}

export function testFlowWidgetPointerDragSessionTracksNativeDragState() {
  clearActiveFlowWidgetPointerDragSession()
  beginFlowWidgetPointerDragSession({
    registryEntryId: 'qer-321',
    label: 'Video Widget',
    pointerId: 7,
    clientX: 10,
    clientY: 20,
  })
  const started = readActiveFlowWidgetPointerDragSession()
  if (!started) throw new Error('expected pointer drag session')
  if (started.registryEntryId !== 'qer-321') throw new Error('expected pointer drag registry entry id')
  if (started.nativeDragStarted) throw new Error('expected pointer drag session to start without native drag')
  markFlowWidgetPointerDragNativeStart(7)
  const native = readActiveFlowWidgetPointerDragSession()
  if (!native?.nativeDragStarted) throw new Error('expected pointer drag session to track native drag start')
  clearActiveFlowWidgetPointerDragSession(7)
  if (readActiveFlowWidgetPointerDragSession()) throw new Error('expected pointer drag session to clear')
}
