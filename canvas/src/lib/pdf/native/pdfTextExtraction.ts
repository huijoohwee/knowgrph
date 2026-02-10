import type { TextFragment } from './types'
import type { ParsedIndirectObject, PdfDict, PdfRef } from './pdfObjects'
import { deref, getDictValue, isArray, isDict, isName, isRef, readStream } from './pdfObjects'
import { buildFontUnicodeMaps } from './pdfCmap'
import { parseContentStreamText } from './pdfContentText'

function collectDoXObjectNames(bytes: Buffer): string[] {
  const s = bytes.toString('latin1')
  const out: string[] = []
  const stack: unknown[] = []
  let idx = 0
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
      while (i < s.length && !/\s|[<>\[\]\(\)\/%]/.test(s[i])) i += 1
      return { tok: { kind: 'name', name: s.slice(start, i) }, next: i }
    }
    let end = i
    while (end < s.length && !/\s|[\[\]\(\)<>/%]/.test(s[end])) end += 1
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
        if (n && typeof n === 'object' && (n as any).kind === 'name') out.push(String((n as any).name || ''))
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

function resolveXObjectRef(objects: Map<number, ParsedIndirectObject>, resources: PdfDict | null, name: string): PdfRef | null {
  if (!resources) return null
  const xobjVal = getDictValue(resources, 'XObject')
  const xobjDictVal = deref(objects, xobjVal)
  const xobjDict = isDict(xobjDictVal) ? xobjDictVal : null
  if (!xobjDict) return null
  const v = Object.prototype.hasOwnProperty.call(xobjDict.map, name) ? xobjDict.map[name] : null
  return isRef(v) ? v : null
}

export function extractTextFragmentsFromPage(args: {
  objects: Map<number, ParsedIndirectObject>
  pageResources: PdfDict | null
  contentBytes: Buffer
  maxDepth?: number
}): TextFragment[] {
  const maxDepth = typeof args.maxDepth === 'number' && args.maxDepth > 0 ? Math.floor(args.maxDepth) : 4
  const visited = new Set<number>()

  const extractFromStream = (contentBytes: Buffer, resources: PdfDict | null, depth: number): TextFragment[] => {
    const fontMaps = buildFontUnicodeMaps(args.objects, resources)
    const fragments = parseContentStreamText(contentBytes, fontMaps)
    if (depth >= maxDepth) return fragments
    const names = collectDoXObjectNames(contentBytes)
    for (const name of names) {
      const ref = resolveXObjectRef(args.objects, resources, name)
      if (!ref || visited.has(ref.obj)) continue
      const obj = args.objects.get(ref.obj)
      const dict = obj?.dict || null
      if (!dict) continue
      const subtype = getDictValue(dict, 'Subtype')
      if (!isName(subtype) || subtype.name !== 'Form') continue
      visited.add(ref.obj)
      const formResources = (() => {
        const rv = getDictValue(dict, 'Resources')
        const dv = deref(args.objects, rv)
        return isDict(dv) ? dv : resources
      })()
      const st = readStream(args.objects, ref)
      if (!st.bytes) continue
      fragments.push(...extractFromStream(st.bytes, formResources, depth + 1))
    }
    return fragments
  }

  return extractFromStream(args.contentBytes, args.pageResources, 0)
}

