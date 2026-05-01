export const FLOW_EDITOR_QE_TRACE_LS_KEY = 'kg:debug:flowEditorWidgetTrace'
export const FLOW_EDITOR_QE_TRACE_QUERY_PARAM_KEYS = [
  'kgFlowEditorTrace',
  'kgFlowEditorWidgetTrace',
  'kgFlowEditorEdgeTrace',
  'kgFlowEditorEdgeHarness',
] as const

export type FlowEditorQeTraceEntry = Record<string, unknown>

export type FlowEditorQeTraceWindow = Window & {
  localStorage?: Storage
  __KG_FLOW_EDITOR_QE_TRACE__?: FlowEditorQeTraceEntry[]
  __KG_FLOW_EDITOR_EDGE_HARNESS__?: Record<string, unknown> | null
}

function isTruthyTraceToggle(raw: string | null | undefined): boolean {
  const value = String(raw || '').trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

export function isFlowEditorQeTraceEnabled(win: Window | null | undefined): win is FlowEditorQeTraceWindow {
  if (!win) return false
  try {
    const search = String(win.location?.search || '').trim()
    if (search) {
      const params = new URLSearchParams(search)
      for (let i = 0; i < FLOW_EDITOR_QE_TRACE_QUERY_PARAM_KEYS.length; i += 1) {
        if (isTruthyTraceToggle(params.get(FLOW_EDITOR_QE_TRACE_QUERY_PARAM_KEYS[i]))) return true
      }
    }
  } catch {
    void 0
  }
  try {
    return Boolean(win.localStorage && win.localStorage.getItem(FLOW_EDITOR_QE_TRACE_LS_KEY) === '1')
  } catch {
    return false
  }
}

export function pushFlowEditorQeTrace(
  win: Window | null | undefined,
  entry: FlowEditorQeTraceEntry,
  maxEntries = 300,
): void {
  if (!isFlowEditorQeTraceEnabled(win)) return
  const target = win as FlowEditorQeTraceWindow
  const buf = Array.isArray(target.__KG_FLOW_EDITOR_QE_TRACE__) ? target.__KG_FLOW_EDITOR_QE_TRACE__ : []
  buf.push({
    ts: typeof entry.ts === 'number' ? entry.ts : Date.now(),
    ...entry,
  })
  if (buf.length > maxEntries) buf.splice(0, buf.length - maxEntries)
  target.__KG_FLOW_EDITOR_QE_TRACE__ = buf
}
