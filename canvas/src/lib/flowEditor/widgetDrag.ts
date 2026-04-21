import {
  FLOW_WIDGET_DRAG_KIND,
  FLOW_WIDGET_DRAG_MIME,
  FLOW_WIDGET_DRAG_VERSION,
} from '@/lib/config'

export type FlowWidgetDragPayloadV1 = {
  kind: typeof FLOW_WIDGET_DRAG_KIND
  version: typeof FLOW_WIDGET_DRAG_VERSION
  registryEntryId: string
}

export type FlowWidgetPointerDragSession = {
  registryEntryId: string
  label?: string | null
  pointerId: number
  startClientX: number
  startClientY: number
  nativeDragStarted: boolean
}

let activePointerDragSession: FlowWidgetPointerDragSession | null = null

export function buildFlowWidgetDragPayload(args: { registryEntryId: string }): FlowWidgetDragPayloadV1 | null {
  const registryEntryId = String(args.registryEntryId || '').trim()
  if (!registryEntryId) return null
  return {
    kind: FLOW_WIDGET_DRAG_KIND,
    version: FLOW_WIDGET_DRAG_VERSION,
    registryEntryId,
  }
}

export function beginFlowWidgetPointerDragSession(args: {
  registryEntryId: string
  label?: string | null
  pointerId: number
  clientX: number
  clientY: number
}): void {
  const registryEntryId = String(args.registryEntryId || '').trim()
  if (!registryEntryId) return
  if (!Number.isFinite(args.clientX) || !Number.isFinite(args.clientY)) return
  activePointerDragSession = {
    registryEntryId,
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
    return { kind: FLOW_WIDGET_DRAG_KIND, version: FLOW_WIDGET_DRAG_VERSION, registryEntryId }
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
