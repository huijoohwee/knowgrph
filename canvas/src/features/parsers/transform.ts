import type { GraphNode, GraphEdge, GraphData, JSONValue } from '@/lib/graph/types'

export type PropsTransform = {
  pick?: string[]
  drop?: string[]
  map?: Record<string, string>
  mapAgg?: Record<string, { op: 'join' | 'sum' | 'count' | 'first' | 'last' | 'min' | 'max' | 'avg' | 'median' | 'percentile'; path: string; sep?: string; p?: number; method?: 'nearest' | 'linear' | 'tukey' | 'hazen'; type?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }>
  set?: Record<string, import('@/lib/graph/types').JSONValue>
}

export type NodeTransform = {
  typeMap?: Record<string, string>
  labelFrom?: string
  props?: PropsTransform
}

export type EdgeTransform = {
  labelMap?: Record<string, string>
  props?: PropsTransform
}

export type TransformConfig = {
  node?: NodeTransform
  edge?: EdgeTransform
}

const getPath = (obj: unknown, path: string): unknown => {
  const p = String(path || '').trim()
  if (!p) return undefined
  const parts = p.split('.').filter(Boolean)
  let cur: unknown = obj
  for (const raw of parts) {
    if (cur == null) return undefined
    const m = /^([^[]+)(.*)$/.exec(raw)
    const key = m ? m[1] : raw
    if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[key]
    const rest = m ? m[2] : ''
    if (rest) {
      const re = /\[(\d*)\]/g
      let mm: RegExpExecArray | null
      while ((mm = re.exec(rest))) {
        if (cur == null) return undefined
        const idx = parseInt(mm[1], 10)
        if (!Array.isArray(cur) || idx < 0 || idx >= cur.length) return undefined
        cur = (cur as unknown[])[idx]
      }
    }
  }
  return cur
}

const buildProps = (orig: Record<string, JSONValue>, t?: PropsTransform): Record<string, JSONValue> => {
  const src: Record<string, JSONValue> = { ...(orig || {}) }
  const out: Record<string, JSONValue> = {}
  if (!t) return src
  if (Array.isArray(t.pick) && t.pick.length > 0) {
    t.pick.forEach(k => { if (k in src) out[k] = src[k] })
  } else {
    Object.keys(src).forEach(k => { out[k] = src[k] })
  }
  if (Array.isArray(t.drop)) t.drop.forEach(k => { delete out[k] })
  if (t.map) {
    Object.entries(t.map).forEach(([newKey, fromPath]) => {
      const v = getPath({ properties: src }, String(fromPath))
      if (typeof v !== 'undefined') out[newKey] = v as JSONValue
    })
  }
  if (t.mapAgg) {
    Object.entries(t.mapAgg).forEach(([newKey, cfg]) => {
      const values = getPathList({ properties: src }, String(cfg.path))
      const op = cfg.op
      if (!values || !Array.isArray(values)) return
      if (op === 'join') {
        const sep = typeof cfg.sep === 'string' ? cfg.sep : ','
        out[newKey] = values.map(v => String(v ?? '')).join(sep)
      } else if (op === 'sum') {
        const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v))
        out[newKey] = nums.reduce((a, b) => a + b, 0)
      } else if (op === 'count') {
        out[newKey] = values.length
      } else if (op === 'first') {
        if (values.length === 0) return
        const v = values[0]
        if (typeof v === 'undefined') return
        out[newKey] = v as JSONValue
      } else if (op === 'last') {
        if (values.length === 0) return
        const v = values[values.length - 1]
        if (typeof v === 'undefined') return
        out[newKey] = v as JSONValue
      } else if (op === 'min') {
        const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v))
        if (nums.length === 0) return
        out[newKey] = nums.reduce((m, v) => (v < m ? v : m), nums[0])
      } else if (op === 'max') {
        const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v))
        if (nums.length === 0) return
        out[newKey] = nums.reduce((m, v) => (v > m ? v : m), nums[0])
      } else if (op === 'avg') {
        const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v))
        if (nums.length === 0) return
        out[newKey] = nums.reduce((a, b) => a + b, 0) / nums.length
      } else if (op === 'median') {
        const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v))
        if (nums.length === 0) return
        const s = nums.slice().sort((a, b) => a - b)
        const n = s.length
        const mid = Math.floor(n / 2)
        out[newKey] = n % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
      } else if (op === 'percentile') {
        const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v))
        const p = typeof cfg.p === 'number' ? Math.max(0, Math.min(100, cfg.p)) : undefined
        if (!nums.length || p === undefined) return
        const s = nums.slice().sort((a, b) => a - b)
        const n = s.length
        const hf = cfg.type
        if (typeof hf === 'number') {
          const v = percentileHF(s, p, hf)
          if (typeof v === 'undefined') return
          out[newKey] = v
          return
        }
        const method = cfg.method === 'nearest' || cfg.method === 'tukey' || cfg.method === 'hazen' ? cfg.method : 'linear'
        if (method === 'nearest') {
          const rank = Math.ceil((p / 100) * n)
          const idx = Math.max(1, Math.min(n, rank)) - 1
          out[newKey] = s[idx]
        } else if (method === 'linear') {
          const pos = (p / 100) * (n - 1)
          const lo = Math.floor(pos)
          const hi = Math.ceil(pos)
          if (lo === hi) out[newKey] = s[lo]
          else {
            const w = pos - lo
            out[newKey] = s[lo] + w * (s[hi] - s[lo])
          }
        } else if (method === 'hazen') {
          const h = (p / 100) * (n + 1)
          const lo1 = Math.floor(h)
          const hi1 = Math.ceil(h)
          const lo = Math.max(1, Math.min(n, lo1)) - 1
          const hi = Math.max(1, Math.min(n, hi1)) - 1
          if (lo === hi) out[newKey] = s[lo]
          else {
            const w = h - lo1
            out[newKey] = s[lo] + w * (s[hi] - s[lo])
          }
        } else if (method === 'tukey') {
          const h = (p / 100) * (n + 1 / 3) + 1 / 3
          const lo1 = Math.floor(h)
          const hi1 = Math.ceil(h)
          const lo = Math.max(1, Math.min(n, lo1)) - 1
          const hi = Math.max(1, Math.min(n, hi1)) - 1
          if (lo === hi) out[newKey] = s[lo]
          else {
            const w = h - lo1
            out[newKey] = s[lo] + w * (s[hi] - s[lo])
          }
        }
      }
    })
  }
  if (t.set) Object.entries(t.set).forEach(([k, v]) => { out[k] = v })
  return out
}

export const mapNode = (n: GraphNode, t?: NodeTransform): GraphNode => {
  if (!t) return n
  const next: GraphNode = { ...n, properties: { ...(n.properties || {}) } }
  if (t.typeMap && next.type in t.typeMap) next.type = t.typeMap[next.type]
  if (t.labelFrom) {
    const v = getPath({ id: next.id, label: next.label, type: next.type, properties: next.properties }, t.labelFrom)
    if (typeof v === 'string' && v.length > 0) next.label = v
  }
  next.properties = buildProps(next.properties, t.props)
  return next
}

export const mapEdge = (e: GraphEdge, t?: EdgeTransform): GraphEdge => {
  if (!t) return e
  const next: GraphEdge = { ...e, properties: { ...(e.properties || {}) } }
  if (t.labelMap && next.label in t.labelMap) next.label = t.labelMap[next.label]
  next.properties = buildProps(next.properties, t.props)
  return next
}

export const applyTransforms = (data: GraphData, cfg?: TransformConfig): GraphData => {
  if (!cfg) return data
  return {
    ...data,
    nodes: data.nodes.map(n => mapNode(n, cfg.node)),
    edges: data.edges.map(e => mapEdge(e, cfg.edge)),
  }
}
export const graphRagTransformDefaults = (): TransformConfig => {
  return {
    node: {
      typeMap: { Chunk: 'Chunk', Entity: 'Entity' },
      labelFrom: 'properties.name',
      props: { pick: [], drop: [], set: {} }
    },
    edge: {
      labelMap: { relatedTo: 'relatedTo' },
      props: { pick: [], drop: [], set: {} }
    }
  }
}

const getPathList = (obj: unknown, path: string): unknown[] => {
  const p = String(path || '').trim()
  if (!p) return []
  const parts = p.split('.').filter(Boolean)
  const resolve = (cur: unknown, idx: number): unknown[] => {
    if (idx >= parts.length) return [cur]
    const raw = parts[idx]
    if (cur == null) return []
    const m = /^([^[]+)(.*)$/.exec(raw)
    const key = m ? m[1] : raw
    if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) return []
    const next = (cur as Record<string, unknown>)[key]
    const rest = m ? m[2] : ''
    const results: unknown[] = []
    const consumeArrayIndices = (value: unknown, bracket: string): unknown => {
      if (!bracket) return value
      const re = /\[(\d*)\]/g
      let mm: RegExpExecArray | null
      let curVal: unknown = value
      while ((mm = re.exec(bracket))) {
        if (mm[1] === '') {
          return { __wild__: true, value: curVal }
        }
        const idxNum = parseInt(mm[1], 10)
        if (!Array.isArray(curVal) || idxNum < 0 || idxNum >= (curVal as unknown[]).length) return undefined
        curVal = (curVal as unknown[])[idxNum]
      }
      return curVal
    }
    const consumed = consumeArrayIndices(next, rest)
    if (
      consumed &&
      typeof consumed === 'object' &&
      Object.prototype.hasOwnProperty.call(consumed, '__wild__') &&
      (consumed as { __wild__?: boolean }).__wild__ === true
    ) {
      const arr = (consumed as { value?: unknown }).value
      if (!Array.isArray(arr)) return []
      for (let i = 0; i < arr.length; i++) {
        const sub = resolve(arr[i], idx + 1)
        for (const v of sub) results.push(v)
      }
      return results
    }
    return resolve(consumed, idx + 1)
  }
  return resolve(obj, 0)
}
const percentileHF = (s: number[], p: number, type: number): number | undefined => {
  const n = s.length
  if (n === 0) return undefined
  const P = p / 100
  if (type === 1) {
    const rank = Math.ceil(P * n)
    const idx = Math.max(1, Math.min(n, rank)) - 1
    return s[idx]
  }
  if (type === 2) {
    const h = P * n
    const k = Math.floor(h)
    if (k <= 0) return s[0]
    if (k >= n) return s[n - 1]
    if (Number.isInteger(h)) return (s[k - 1] + s[k]) / 2
    return s[k]
  }
  if (type === 3) {
    const h = Math.round(P * n)
    const idx = Math.max(1, Math.min(n, h)) - 1
    return s[idx]
  }
  const hfLinear = (a: number, b: number) => {
    const h = a + (n + 1 - a - b) * P
    return interpRank(s, h)
  }
  if (type === 4) return hfLinear(0, 1)
  if (type === 5) return hfLinear(0.5, 0.5)
  if (type === 6) return hfLinear(0, 0)
  if (type === 7) return hfLinear(1, 1)
  if (type === 8) return hfLinear(1 / 3, 1 / 3)
  if (type === 9) return hfLinear(3 / 8, 3 / 8)
  return undefined
}

const interpRank = (s: number[], h: number): number => {
  const n = s.length
  const lo1 = Math.floor(h)
  const hi1 = Math.ceil(h)
  const lo = Math.max(1, Math.min(n, lo1)) - 1
  const hi = Math.max(1, Math.min(n, hi1)) - 1
  if (lo === hi) return s[lo]
  const w = h - lo1
  return s[lo] + w * (s[hi] - s[lo])
}
