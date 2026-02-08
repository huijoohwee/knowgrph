export type FlowDataflowTransformFn = (value: unknown) => unknown
export type FlowDataflowReducerFn = (values: ReadonlyArray<unknown>) => unknown

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

function tryJsonParse(v: unknown): unknown {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  if (!s) return undefined
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}

export const FLOW_DATAFLOW_TRANSFORMS: Record<string, FlowDataflowTransformFn> = {
  identity: v => v,
  trim: v => (typeof v === 'string' ? v.trim() : v),
  lower: v => (typeof v === 'string' ? v.toLowerCase() : v),
  upper: v => (typeof v === 'string' ? v.toUpperCase() : v),
  to_number: (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim()) {
      const n = Number.parseFloat(v)
      return Number.isFinite(n) ? n : undefined
    }
    return undefined
  },
  to_boolean: (v) => {
    if (typeof v === 'boolean') return v
    if (typeof v === 'number' && Number.isFinite(v)) return v !== 0
    if (typeof v !== 'string') return Boolean(v)
    const s = v.trim().toLowerCase()
    if (!s) return false
    if (s === 'true' || s === 'yes' || s === 'y' || s === '1') return true
    if (s === 'false' || s === 'no' || s === 'n' || s === '0') return false
    return true
  },
  stringify_json: (v) => {
    if (typeof v === 'string') return v
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  },
  json_parse: v => tryJsonParse(v),
  first: (v) => (Array.isArray(v) ? v[0] : v),
  last: (v) => (Array.isArray(v) ? v[v.length - 1] : v),
  length: (v) => (Array.isArray(v) ? v.length : typeof v === 'string' ? v.length : 0),
  join_lines: (v) => {
    if (!Array.isArray(v)) return v
    const parts = v.map(cleanString).filter(Boolean)
    return parts.length > 0 ? parts.join('\n') : ''
  },
  join_comma: (v) => {
    if (!Array.isArray(v)) return v
    const parts = v.map(cleanString).filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : ''
  },
}

export const FLOW_DATAFLOW_REDUCERS: Record<string, FlowDataflowReducerFn> = {
  first: (values) => values[0],
  last: (values) => values[values.length - 1],
  concat_array: (values) => values.flatMap(v => (Array.isArray(v) ? v : [v])),
  join_lines: (values) => {
    const parts = values.map(cleanString).filter(Boolean)
    return parts.length > 0 ? parts.join('\n') : ''
  },
  join_comma: (values) => {
    const parts = values.map(cleanString).filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : ''
  },
}

export function applyFlowDataflowTransform(args: { transformId?: string; value: unknown }): unknown {
  const id = String(args.transformId || '').trim()
  if (!id) return args.value
  const fn = FLOW_DATAFLOW_TRANSFORMS[id]
  if (!fn) return args.value
  return fn(args.value)
}

export function applyFlowDataflowReducer(args: { reduceId?: string; values: ReadonlyArray<unknown> }): unknown {
  const id = String(args.reduceId || '').trim()
  if (!id) return args.values
  const fn = FLOW_DATAFLOW_REDUCERS[id]
  if (!fn) return args.values
  return fn(args.values)
}

