import { isPlainObject } from '@/lib/graph/value'

export type ObjectPathToken = { kind: 'key'; key: string } | { kind: 'index'; index: number }

export function parseObjectPath(path: string): ObjectPathToken[] {
  const p = String(path || '').trim()
  if (!p) return []
  const parts = p.split('.').filter(Boolean)
  const out: ObjectPathToken[] = []
  for (const raw of parts) {
    const m = /^([^[]+)(.*)$/.exec(raw)
    const key = m ? m[1] : raw
    if (key) out.push({ kind: 'key', key })
    const rest = m ? m[2] : ''
    if (rest) {
      const re = /\[(\d*)\]/g
      let mm: RegExpExecArray | null
      while ((mm = re.exec(rest))) {
        const idx = Number.parseInt(mm[1], 10)
        if (!Number.isFinite(idx) || idx < 0) return []
        out.push({ kind: 'index', index: idx })
      }
    }
  }
  return out
}

export function getObjectPath(obj: unknown, path: string): unknown {
  const tokens = parseObjectPath(path)
  if (tokens.length === 0) return undefined
  let cur: unknown = obj
  for (const tok of tokens) {
    if (cur == null) return undefined
    if (tok.kind === 'key') {
      if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) return undefined
      cur = (cur as Record<string, unknown>)[tok.key]
      continue
    }
    if (!Array.isArray(cur)) return undefined
    if (tok.index < 0 || tok.index >= cur.length) return undefined
    cur = (cur as unknown[])[tok.index]
  }
  return cur
}

export function setObjectPath<T>(obj: T, path: string, value: unknown): T {
  const tokens = parseObjectPath(path)
  if (tokens.length === 0) return obj

  const setRec = (cur: unknown, idx: number): unknown => {
    const tok = tokens[idx]
    const isLast = idx === tokens.length - 1

    if (tok.kind === 'key') {
      const base: Record<string, unknown> = isPlainObject(cur) ? { ...(cur as Record<string, unknown>) } : {}
      if (isLast) {
        if (typeof value === 'undefined') {
          delete base[tok.key]
        } else {
          base[tok.key] = value
        }
        return base
      }
      base[tok.key] = setRec(base[tok.key], idx + 1)
      return base
    }

    const base = Array.isArray(cur) ? (cur as unknown[]).slice() : []
    while (base.length <= tok.index) base.push(undefined)
    if (isLast) {
      base[tok.index] = value
      return base
    }
    base[tok.index] = setRec(base[tok.index], idx + 1)
    return base
  }

  return setRec(obj, 0) as T
}
