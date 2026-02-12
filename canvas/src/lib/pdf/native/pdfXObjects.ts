import type { ParsedIndirectObject, PdfDict, PdfRef } from './pdfObjects'
import { deref, getDictValue, isDict, isRef } from './pdfObjects'

export function collectDoXObjectNames(bytes: Buffer): string[] {
  const s = bytes.toString('latin1')
  const out: string[] = []
  const stack: unknown[] = []
  let idx = 0

  type NameToken = { kind: 'name'; name: string }
  const isNameToken = (v: unknown): v is NameToken => {
    if (!v || typeof v !== 'object') return false
    if (!('kind' in v) || (v as { kind?: unknown }).kind !== 'name') return false
    return typeof (v as { name?: unknown }).name === 'string'
  }
  const tokenDelims = '<>[]()/%'

  const readToken = (idx0: number): { tok: unknown; next: number } => {
    let i = idx0
    while (i < s.length) {
      const ch = s[i]
      if (/\s/.test(ch)) {
        i += 1
        continue
      }
      if (ch === '%') {
        const nl = s.indexOf('\n', i + 1)
        i = nl >= 0 ? nl + 1 : s.length
        continue
      }
      break
    }
    if (i >= s.length) return { tok: null, next: i }
    const ch = s[i]
    if (ch === '<' && s[i + 1] === '<') return { tok: '<<', next: i + 2 }
    if (ch === '>' && s[i + 1] === '>') return { tok: '>>', next: i + 2 }
    if (ch === '(') {
      let j = i + 1
      let depth = 1
      while (j < s.length && depth > 0) {
        const c = s[j]
        if (c === '\\') {
          j += 2
          continue
        }
        if (c === '(') depth += 1
        else if (c === ')') depth -= 1
        j += 1
      }
      return { tok: { kind: 'string' }, next: j }
    }
    if (ch === '<' && s[i + 1] !== '<') {
      const end = s.indexOf('>', i + 1)
      return { tok: { kind: 'hex' }, next: end >= 0 ? end + 1 : s.length }
    }
    if (ch === '[') {
      const end = s.indexOf(']', i + 1)
      return { tok: { kind: 'array' }, next: end >= 0 ? end + 1 : s.length }
    }
    if (ch === '/') {
      i += 1
      const start = i
      while (i < s.length && !/\s/.test(s[i]) && !tokenDelims.includes(s[i])) i += 1
      return { tok: { kind: 'name', name: s.slice(start, i) }, next: i }
    }
    if (tokenDelims.includes(ch)) return { tok: ch, next: i + 1 }
    let end = i
    while (end < s.length && !/\s/.test(s[end]) && !tokenDelims.includes(s[end])) end += 1
    return { tok: s.slice(i, end), next: end }
  }

  while (idx < s.length) {
    const t = readToken(idx)
    idx = t.next
    const tok = t.tok
    if (tok == null) break
    if (typeof tok === 'string') {
      if (tok === 'Do') {
        const n = stack.pop()
        if (isNameToken(n)) out.push(n.name)
        stack.length = 0
        continue
      }
      if (tok === 'q' || tok === 'Q' || tok === 'cm') {
        stack.length = 0
        continue
      }
      if (tok.length > 16) {
        stack.length = 0
        continue
      }
      stack.length = 0
      continue
    }
    stack.push(tok)
  }

  const uniq: string[] = []
  const seen = new Set<string>()
  for (const n of out) {
    const k = String(n || '').trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    uniq.push(k)
  }
  return uniq
}

export function resolveXObjectRef(
  objects: Map<number, ParsedIndirectObject>,
  resources: PdfDict | null,
  name: string,
): PdfRef | null {
  if (!resources) return null
  const xobjVal = getDictValue(resources, 'XObject')
  const xobjDictVal = deref(objects, xobjVal)
  const xobjDict = isDict(xobjDictVal) ? xobjDictVal : null
  if (!xobjDict) return null
  const v = Object.prototype.hasOwnProperty.call(xobjDict.map, name) ? xobjDict.map[name] : null
  return isRef(v) ? v : null
}

export function listResourceXObjectRefs(objects: Map<number, ParsedIndirectObject>, resources: PdfDict | null): PdfRef[] {
  if (!resources) return []
  const xobjVal = getDictValue(resources, 'XObject')
  const xobjDictVal = deref(objects, xobjVal)
  const xobjDict = isDict(xobjDictVal) ? xobjDictVal : null
  if (!xobjDict) return []
  const refs: PdfRef[] = []
  for (const v of Object.values(xobjDict.map)) if (isRef(v)) refs.push(v)
  return refs
}
