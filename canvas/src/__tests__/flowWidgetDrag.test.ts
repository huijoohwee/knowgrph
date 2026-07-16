import {
  FLOW_WIDGET_DRAG_MIME,
  FLOW_WIDGET_DRAG_KIND,
  FLOW_WIDGET_DRAG_VERSION,
} from '@/lib/config'
import {
  FLOW_WIDGET_POINTER_DRAG_DROP_EVENT,
  beginFlowWidgetPointerDragSession,
  buildFlowWidgetDragPayload,
  claimFlowWidgetPointerDragDrop,
  clearActiveFlowWidgetPointerDragSession,
  dispatchFlowWidgetPointerDragDropFromSession,
  flowWidgetDragPayloadToDataTransferText,
  markFlowWidgetPointerDragNativeStart,
  readActiveFlowWidgetPointerDragSession,
  readFlowWidgetDragPayloadFromDataTransfer,
  type FlowWidgetPointerDragDropDetail,
} from '@/lib/storyboardWidget/widgetDrag'

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

export function testFlowWidgetDragPayloadCarriesRegistryShape() {
  const payload = buildFlowWidgetDragPayload({
    registryEntryId: 'qer-shape',
    nodeTypeId: 'ImageGeneration',
    widgetTypeId: 'default',
    formId: 'imageGeneration',
    layoutVariantId: 'widget-card-type-0',
  })
  if (!payload) throw new Error('expected payload')
  const text = flowWidgetDragPayloadToDataTransferText(payload)
  const reread = readFlowWidgetDragPayloadFromDataTransfer({
    getData: (mime) => (mime === FLOW_WIDGET_DRAG_MIME ? text : ''),
  })
  if (!reread) throw new Error('expected reread payload')
  if (reread.registryEntryId !== 'qer-shape') throw new Error('expected registryEntryId to round trip')
  if (reread.nodeTypeId !== 'ImageGeneration') throw new Error('expected nodeTypeId to round trip')
  if (reread.widgetTypeId !== 'default') throw new Error('expected widgetTypeId to round trip')
  if (reread.formId !== 'imageGeneration') throw new Error('expected formId to round trip')
  if (reread.layoutVariantId !== 'widget-card-type-0') throw new Error('expected layoutVariantId to round trip')
}

export function testFlowWidgetPointerDragSessionTracksNativeDragState() {
  clearActiveFlowWidgetPointerDragSession()
  beginFlowWidgetPointerDragSession({
    registryEntryId: 'qer-321',
    nodeTypeId: 'VideoGeneration',
    widgetTypeId: 'default',
    formId: 'videoGeneration',
    layoutVariantId: 'probe-tree-type-1',
    label: 'Video Widget',
    pointerId: 7,
    clientX: 10,
    clientY: 20,
  })
  const started = readActiveFlowWidgetPointerDragSession()
  if (!started) throw new Error('expected pointer drag session')
  if (started.registryEntryId !== 'qer-321') throw new Error('expected pointer drag registry entry id')
  if (started.nodeTypeId !== 'VideoGeneration') throw new Error('expected pointer drag nodeTypeId')
  if (started.widgetTypeId !== 'default') throw new Error('expected pointer drag widgetTypeId')
  if (started.formId !== 'videoGeneration') throw new Error('expected pointer drag formId')
  if (started.layoutVariantId !== 'probe-tree-type-1') throw new Error('expected pointer drag layoutVariantId')
  if (started.nativeDragStarted) throw new Error('expected pointer drag session to start without native drag')
  markFlowWidgetPointerDragNativeStart(7)
  const native = readActiveFlowWidgetPointerDragSession()
  if (!native?.nativeDragStarted) throw new Error('expected pointer drag session to track native drag start')
  clearActiveFlowWidgetPointerDragSession(7)
  if (readActiveFlowWidgetPointerDragSession()) throw new Error('expected pointer drag session to clear')
}

export function testFlowWidgetPointerDragDispatchesDropReleaseEvent() {
  clearActiveFlowWidgetPointerDragSession()
  const globalWithWindow = globalThis as typeof globalThis & { window?: unknown }
  const previousWindow = globalWithWindow.window
  let seenDetail: FlowWidgetPointerDragDropDetail | null = null
  const fakeWindow = {
    dispatchEvent: (event: Event) => {
      const eventType = String((event as Event & { type?: unknown }).type || '')
      if (eventType !== FLOW_WIDGET_POINTER_DRAG_DROP_EVENT) {
        throw new Error(`unexpected pointer drag event type: ${eventType}`)
      }
      const detail = (event as CustomEvent<FlowWidgetPointerDragDropDetail>).detail
      if (!detail) throw new Error('expected pointer drag drop detail')
      seenDetail = detail
      claimFlowWidgetPointerDragDrop(detail)
      return true
    },
  }

  try {
    Object.defineProperty(globalThis, 'window', {
      value: fakeWindow,
      configurable: true,
    })
    beginFlowWidgetPointerDragSession({
      registryEntryId: 'qer-release',
      nodeTypeId: 'ImageGeneration',
      widgetTypeId: 'default',
      formId: 'imageGeneration',
      layoutVariantId: 'widget-card-type-0',
      label: 'Image Widget',
      pointerId: 9,
      clientX: 12,
      clientY: 34,
    })
    markFlowWidgetPointerDragNativeStart(9)
    const claimed = dispatchFlowWidgetPointerDragDropFromSession({
      clientX: 120,
      clientY: 340,
    })
    if (!claimed) throw new Error('expected pointer drag drop release to be claimed')
    if (!seenDetail) throw new Error('expected pointer drag drop release detail')
    if (seenDetail.registryEntryId !== 'qer-release') throw new Error('expected registryEntryId in pointer drop detail')
    if (seenDetail.nodeTypeId !== 'ImageGeneration') throw new Error('expected nodeTypeId in pointer drop detail')
    if (seenDetail.widgetTypeId !== 'default') throw new Error('expected widgetTypeId in pointer drop detail')
    if (seenDetail.formId !== 'imageGeneration') throw new Error('expected formId in pointer drop detail')
    if (seenDetail.layoutVariantId !== 'widget-card-type-0') throw new Error('expected layoutVariantId in pointer drop detail')
    if (seenDetail.pointerId !== 9) throw new Error('expected pointerId in pointer drop detail')
    if (seenDetail.clientX !== 120 || seenDetail.clientY !== 340) throw new Error('expected release coordinates in pointer drop detail')
    if (!seenDetail.nativeDragStarted) throw new Error('expected native drag state in pointer drop detail')
  } finally {
    clearActiveFlowWidgetPointerDragSession()
    if (typeof previousWindow === 'undefined') {
      delete globalWithWindow.window
    } else {
      Object.defineProperty(globalThis, 'window', {
        value: previousWindow,
        configurable: true,
      })
    }
  }
}

export function testFlowWidgetPointerDragReleaseUsesTrackedPointForNativeDragEnd() {
  clearActiveFlowWidgetPointerDragSession()
  const globalWithWindow = globalThis as typeof globalThis & { window?: unknown }
  const previousWindow = globalWithWindow.window
  const listeners: Record<string, Array<(event: { clientX: number; clientY: number }) => void>> = {}
  let seenDetail: FlowWidgetPointerDragDropDetail | null = null
  const fakeWindow = {
    addEventListener: (type: string, listener: unknown) => {
      if (typeof listener !== 'function') return
      listeners[type] = listeners[type] || []
      listeners[type].push(listener as (event: { clientX: number; clientY: number }) => void)
    },
    removeEventListener: (type: string, listener: unknown) => {
      if (typeof listener !== 'function') return
      listeners[type] = (listeners[type] || []).filter(candidate => candidate !== listener)
    },
    dispatchEvent: (event: Event) => {
      const detail = (event as CustomEvent<FlowWidgetPointerDragDropDetail>).detail
      if (!detail) throw new Error('expected pointer drag drop detail')
      seenDetail = detail
      claimFlowWidgetPointerDragDrop(detail)
      return true
    },
  }

  try {
    Object.defineProperty(globalThis, 'window', {
      value: fakeWindow,
      configurable: true,
    })
    beginFlowWidgetPointerDragSession({
      registryEntryId: 'qer-tracked-release',
      nodeTypeId: 'TextGeneration',
      widgetTypeId: 'default',
      formId: 'textGeneration',
      label: 'Text Widget',
      pointerId: 12,
      clientX: 42,
      clientY: 48,
    })
    markFlowWidgetPointerDragNativeStart(12)
    for (const listener of listeners.dragover || []) {
      listener({ clientX: 444, clientY: 555 })
    }
    const claimed = dispatchFlowWidgetPointerDragDropFromSession({
      eventType: 'dragend',
      clientX: 0,
      clientY: 0,
    })
    if (!claimed) throw new Error('expected tracked pointer drag drop release to be claimed')
    if (!seenDetail) throw new Error('expected tracked pointer drag drop detail')
    if (seenDetail.clientX !== 444 || seenDetail.clientY !== 555) {
      throw new Error(`expected tracked dragover release coordinates, got ${seenDetail.clientX},${seenDetail.clientY}`)
    }
    if (seenDetail.registryEntryId !== 'qer-tracked-release') throw new Error('expected tracked release registryEntryId')
  } finally {
    clearActiveFlowWidgetPointerDragSession()
    if (typeof previousWindow === 'undefined') {
      delete globalWithWindow.window
    } else {
      Object.defineProperty(globalThis, 'window', {
        value: previousWindow,
        configurable: true,
      })
    }
  }
}
