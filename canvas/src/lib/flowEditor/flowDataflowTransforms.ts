export type FlowDataflowTransformFn = (value: unknown) => unknown
export type FlowDataflowReducerFn = (values: ReadonlyArray<unknown>) => unknown

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function clampByte(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number.parseFloat(v) : NaN
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(255, Math.round(n)))
}

function parseRgb(v: unknown): { r: number; g: number; b: number } | null {
  if (Array.isArray(v) && v.length >= 3) {
    const r = clampByte(v[0])
    const g = clampByte(v[1])
    const b = clampByte(v[2])
    if (r == null || g == null || b == null) return null
    return { r, g, b }
  }

  if (isRecord(v)) {
    const r = clampByte(v.r ?? v.red)
    const g = clampByte(v.g ?? v.green)
    const b = clampByte(v.b ?? v.blue)
    if (r == null || g == null || b == null) return null
    return { r, g, b }
  }

  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    const rgbMatch = s.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
    if (rgbMatch) {
      const r = clampByte(rgbMatch[1])
      const g = clampByte(rgbMatch[2])
      const b = clampByte(rgbMatch[3])
      if (r == null || g == null || b == null) return null
      return { r, g, b }
    }

    const hex = s.startsWith('#') ? s.slice(1) : s
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      const r = clampByte(Number.parseInt(hex.slice(0, 2), 16))
      const g = clampByte(Number.parseInt(hex.slice(2, 4), 16))
      const b = clampByte(Number.parseInt(hex.slice(4, 6), 16))
      if (r == null || g == null || b == null) return null
      return { r, g, b }
    }
  }

  return null
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

  rgb_css: (v) => {
    const rgb = parseRgb(v)
    if (!rgb) return undefined
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
  },
  rgb_hex: (v) => {
    const rgb = parseRgb(v)
    if (!rgb) return undefined
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
  },
  contrast_text: (v) => {
    const rgb = parseRgb(v)
    if (!rgb) return undefined
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
    return brightness >= 128 ? 'black' : 'white'
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
