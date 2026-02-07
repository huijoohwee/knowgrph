import {
  FLOW_NODE_QUICK_EDITOR_DRAG_KIND,
  FLOW_NODE_QUICK_EDITOR_DRAG_MIME,
  FLOW_NODE_QUICK_EDITOR_DRAG_VERSION,
} from '@/lib/config'

export type FlowNodeQuickEditorDragPayloadV1 = {
  kind: typeof FLOW_NODE_QUICK_EDITOR_DRAG_KIND
  version: typeof FLOW_NODE_QUICK_EDITOR_DRAG_VERSION
  registryEntryId: string
}

export function buildFlowNodeQuickEditorDragPayload(args: { registryEntryId: string }): FlowNodeQuickEditorDragPayloadV1 | null {
  const registryEntryId = String(args.registryEntryId || '').trim()
  if (!registryEntryId) return null
  return {
    kind: FLOW_NODE_QUICK_EDITOR_DRAG_KIND,
    version: FLOW_NODE_QUICK_EDITOR_DRAG_VERSION,
    registryEntryId,
  }
}

export function flowNodeQuickEditorDragPayloadToDataTransferText(payload: FlowNodeQuickEditorDragPayloadV1): string {
  return JSON.stringify(payload)
}

export function readFlowNodeQuickEditorDragPayloadFromDataTransfer(args: {
  getData: (mime: string) => string
}): FlowNodeQuickEditorDragPayloadV1 | null {
  const tryRead = (mime: string): string => {
    try {
      return args.getData(mime)
    } catch {
      return ''
    }
  }

  const candidates = [
    FLOW_NODE_QUICK_EDITOR_DRAG_MIME,
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
      const prefix = `${FLOW_NODE_QUICK_EDITOR_DRAG_MIME}:`
      if (!trimmed.startsWith(prefix)) continue
      const registryEntryId = trimmed.slice(prefix.length).trim()
      if (!registryEntryId) continue
      return {
        kind: FLOW_NODE_QUICK_EDITOR_DRAG_KIND,
        version: FLOW_NODE_QUICK_EDITOR_DRAG_VERSION,
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
    if (rec.kind !== FLOW_NODE_QUICK_EDITOR_DRAG_KIND) continue
    if (rec.version !== FLOW_NODE_QUICK_EDITOR_DRAG_VERSION) continue
    const registryEntryId = typeof rec.registryEntryId === 'string' ? rec.registryEntryId.trim() : ''
    if (!registryEntryId) continue
    return { kind: FLOW_NODE_QUICK_EDITOR_DRAG_KIND, version: FLOW_NODE_QUICK_EDITOR_DRAG_VERSION, registryEntryId }
  }
  return null
}

export function hasFlowNodeQuickEditorDragType(dataTransfer: DataTransfer): boolean {
  const types = (() => {
    try {
      const raw = dataTransfer.types as unknown as Iterable<string> | null | undefined
      if (!raw) return []
      return Array.from(raw)
    } catch {
      return []
    }
  })()
  if (types.includes(FLOW_NODE_QUICK_EDITOR_DRAG_MIME)) return true
  if (types.includes('application/json')) return true
  if (types.includes('text/uri-list')) return true
  if (types.includes('text/plain')) return true
  return false
}

export function setFlowNodeQuickEditorDragDataTransfer(args: {
  dataTransfer: DataTransfer
  payload: FlowNodeQuickEditorDragPayloadV1
  label?: string | null
}): void {
  const dt = args.dataTransfer
  const text = flowNodeQuickEditorDragPayloadToDataTransferText(args.payload)
  try {
    dt.effectAllowed = 'copy'
  } catch {
    void 0
  }
  try {
    dt.setData(FLOW_NODE_QUICK_EDITOR_DRAG_MIME, text)
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
    dt.setData('text/uri-list', `${FLOW_NODE_QUICK_EDITOR_DRAG_MIME}:${args.payload.registryEntryId}`)
  } catch {
    void 0
  }
  const label = String(args.label || '').trim()
  if (label) {
    try {
      dt.setData('text/x-kg-flow-node-quick-editor-label', label)
    } catch {
      void 0
    }
  }
}
