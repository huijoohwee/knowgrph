import {
  FLOW_WIDGET_DRAG_KIND,
  FLOW_WIDGET_DRAG_MIME,
  FLOW_WIDGET_DRAG_VERSION,
} from '@/lib/config'

export type FlowWidgetDragPayloadV1 = {
  kind: typeof FLOW_WIDGET_DRAG_KIND
  version: typeof FLOW_WIDGET_DRAG_VERSION
  registryEntryId: string
  nodeTypeId?: string
  widgetTypeId?: string
  formId?: string
}

export type FlowWidgetPointerDragSession = {
  registryEntryId: string
  nodeTypeId?: string
  widgetTypeId?: string
  formId?: string
  label?: string | null
  pointerId: number
  startClientX: number
  startClientY: number
  nativeDragStarted: boolean
}

export const FLOW_WIDGET_POINTER_DRAG_DROP_EVENT = 'kg:flow-widget-pointer-drag-drop'

export type FlowWidgetPointerDragDropDetail = FlowWidgetPointerDragSession & {
  clientX: number
  clientY: number
  __kgFlowWidgetPointerDropClaimed?: boolean
}

let activePointerDragSession: FlowWidgetPointerDragSession | null = null

function readOptionalDragShapeValue(value: unknown): string | undefined {
  const text = String(value || '').trim()
  return text || undefined
}

export function buildFlowWidgetDragPayload(args: {
  registryEntryId: string
  nodeTypeId?: string | null
  widgetTypeId?: string | null
  formId?: string | null
}): FlowWidgetDragPayloadV1 | null {
  const registryEntryId = String(args.registryEntryId || '').trim()
  if (!registryEntryId) return null
  const nodeTypeId = readOptionalDragShapeValue(args.nodeTypeId)
  const widgetTypeId = readOptionalDragShapeValue(args.widgetTypeId)
  const formId = readOptionalDragShapeValue(args.formId)
  return {
    kind: FLOW_WIDGET_DRAG_KIND,
    version: FLOW_WIDGET_DRAG_VERSION,
    registryEntryId,
    ...(nodeTypeId ? { nodeTypeId } : {}),
    ...(widgetTypeId ? { widgetTypeId } : {}),
    ...(formId ? { formId } : {}),
  }
}

export function beginFlowWidgetPointerDragSession(args: {
  registryEntryId: string
  nodeTypeId?: string | null
  widgetTypeId?: string | null
  formId?: string | null
  label?: string | null
  pointerId: number
  clientX: number
  clientY: number
}): void {
  const registryEntryId = String(args.registryEntryId || '').trim()
  if (!registryEntryId) return
  if (!Number.isFinite(args.clientX) || !Number.isFinite(args.clientY)) return
  const nodeTypeId = readOptionalDragShapeValue(args.nodeTypeId)
  const widgetTypeId = readOptionalDragShapeValue(args.widgetTypeId)
  const formId = readOptionalDragShapeValue(args.formId)
  activePointerDragSession = {
    registryEntryId,
    ...(nodeTypeId ? { nodeTypeId } : {}),
    ...(widgetTypeId ? { widgetTypeId } : {}),
    ...(formId ? { formId } : {}),
    label: args.label || null,
    pointerId: Number.isFinite(args.pointerId) ? args.pointerId : -1,
    startClientX: args.clientX,
    startClientY: args.clientY,
    nativeDragStarted: false,
  }
}

export function markFlowWidgetPointerDragNativeStart(pointerId?: number): void {
  if (!activePointerDragSession) return
  if (typeof pointerId === 'number' && Number.isFinite(pointerId) && activePointerDragSession.pointerId !== pointerId) return
  activePointerDragSession = {
    ...activePointerDragSession,
    nativeDragStarted: true,
  }
}

export function readActiveFlowWidgetPointerDragSession(): FlowWidgetPointerDragSession | null {
  return activePointerDragSession ? { ...activePointerDragSession } : null
}

export function clearActiveFlowWidgetPointerDragSession(pointerId?: number): void {
  if (!activePointerDragSession) return
  if (typeof pointerId === 'number' && Number.isFinite(pointerId) && activePointerDragSession.pointerId !== pointerId) return
  activePointerDragSession = null
}

export function claimFlowWidgetPointerDragDrop(detail: FlowWidgetPointerDragDropDetail | null | undefined): void {
  if (!detail) return
  detail.__kgFlowWidgetPointerDropClaimed = true
}

export function isFlowWidgetPointerDragDropClaimed(detail: FlowWidgetPointerDragDropDetail | null | undefined): boolean {
  return detail?.__kgFlowWidgetPointerDropClaimed === true
}

export function dispatchFlowWidgetPointerDragDropFromSession(args: {
  clientX: number
  clientY: number
}): boolean {
  if (!activePointerDragSession) return false
  if (!Number.isFinite(args.clientX) || !Number.isFinite(args.clientY)) return false
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return false
  const detail: FlowWidgetPointerDragDropDetail = {
    ...activePointerDragSession,
    clientX: args.clientX,
    clientY: args.clientY,
  }
  const event = typeof CustomEvent === 'function'
    ? new CustomEvent<FlowWidgetPointerDragDropDetail>(FLOW_WIDGET_POINTER_DRAG_DROP_EVENT, {
      detail,
      cancelable: true,
    })
    : ({
      type: FLOW_WIDGET_POINTER_DRAG_DROP_EVENT,
      detail,
      preventDefault: () => void 0,
      stopPropagation: () => void 0,
      stopImmediatePropagation: () => void 0,
    } as unknown as CustomEvent<FlowWidgetPointerDragDropDetail>)
  try {
    window.dispatchEvent(event)
  } catch {
    return false
  }
  return isFlowWidgetPointerDragDropClaimed(detail)
}

export function flowWidgetDragPayloadToDataTransferText(payload: FlowWidgetDragPayloadV1): string {
  return JSON.stringify(payload)
}

export function readFlowWidgetDragPayloadFromDataTransfer(args: {
  getData: (mime: string) => string
}): FlowWidgetDragPayloadV1 | null {
  const tryRead = (mime: string): string => {
    try {
      return args.getData(mime)
    } catch {
      return ''
    }
  }

  const candidates = [
    FLOW_WIDGET_DRAG_MIME,
    'application/json',
    'text/plain',
    'text/uri-list',
  ]
  for (const mime of candidates) {
    const raw = tryRead(mime)
    if (!raw) continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (mime === 'text/uri-list') {
      const prefix = `${FLOW_WIDGET_DRAG_MIME}:`
      if (!trimmed.startsWith(prefix)) continue
      const registryEntryId = trimmed.slice(prefix.length).trim()
      if (!registryEntryId) continue
      return {
        kind: FLOW_WIDGET_DRAG_KIND,
        version: FLOW_WIDGET_DRAG_VERSION,
        registryEntryId,
      }
    }
    if (trimmed[0] !== '{') continue
    let parsed: unknown = null
    try {
      parsed = JSON.parse(trimmed) as unknown
    } catch {
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
    const rec = parsed as Record<string, unknown>
    if (rec.kind !== FLOW_WIDGET_DRAG_KIND) continue
    if (rec.version !== FLOW_WIDGET_DRAG_VERSION) continue
    const registryEntryId = typeof rec.registryEntryId === 'string' ? rec.registryEntryId.trim() : ''
    if (!registryEntryId) continue
    const nodeTypeId = readOptionalDragShapeValue(rec.nodeTypeId)
    const widgetTypeId = readOptionalDragShapeValue(rec.widgetTypeId)
    const formId = readOptionalDragShapeValue(rec.formId)
    return {
      kind: FLOW_WIDGET_DRAG_KIND,
      version: FLOW_WIDGET_DRAG_VERSION,
      registryEntryId,
      ...(nodeTypeId ? { nodeTypeId } : {}),
      ...(widgetTypeId ? { widgetTypeId } : {}),
      ...(formId ? { formId } : {}),
    }
  }
  return null
}

export function hasFlowWidgetDragType(dataTransfer: DataTransfer): boolean {
  const types = (() => {
    try {
      const raw = dataTransfer.types as unknown as Iterable<string> | null | undefined
      if (!raw) return []
      return Array.from(raw)
    } catch {
      return []
    }
  })()
  if (types.includes(FLOW_WIDGET_DRAG_MIME)) return true
  if (types.includes('application/json')) return true
  if (types.includes('text/uri-list')) return true
  if (types.includes('text/plain')) return true
  return false
}

export function setFlowWidgetDragDataTransfer(args: {
  dataTransfer: DataTransfer
  payload: FlowWidgetDragPayloadV1
  label?: string | null
}): void {
  const dt = args.dataTransfer
  const text = flowWidgetDragPayloadToDataTransferText(args.payload)
  try {
    dt.effectAllowed = 'copy'
  } catch {
    void 0
  }
  try {
    dt.setData(FLOW_WIDGET_DRAG_MIME, text)
  } catch {
    void 0
  }
  try {
    dt.setData('application/json', text)
  } catch {
    void 0
  }
  try {
    dt.setData('text/plain', text)
  } catch {
    void 0
  }
  try {
    dt.setData('text/uri-list', `${FLOW_WIDGET_DRAG_MIME}:${args.payload.registryEntryId}`)
  } catch {
    void 0
  }
  const label = String(args.label || '').trim()
  if (label) {
    try {
      dt.setData('text/x-kg-flow-widget-label', label)
    } catch {
      void 0
    }
  }
}
