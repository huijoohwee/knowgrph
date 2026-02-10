import type { ParsedIndirectObject, PdfDict } from './pdfObjects'
import { deref, getDictValue, isArray, isDict, isName, isRef, readStream } from './pdfObjects'

export function parseToUnicodeCMap(bytes: Buffer): Map<string, string> {
  const s = bytes.toString('latin1')
  const map = new Map<string, string>()
  const decodeUtf16be = (b: Buffer) => {
    const u16: number[] = []
    for (let i = 0; i + 1 < b.length; i += 2) u16.push((b[i] << 8) | b[i + 1])
    return String.fromCharCode(...u16)
  }
  const parseHex = (hex: string) => Buffer.from(hex.replace(/[<>\s]/g, ''), 'hex')

  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g
  let m: RegExpExecArray | null
  while ((m = bfcharRe.exec(s)) != null) {
    const body = m[1] || ''
    const lineRe = /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g
    let lm: RegExpExecArray | null
    while ((lm = lineRe.exec(body)) != null) {
      const src = lm[1]
      const dst = lm[2]
      const dstBytes = parseHex(`<${dst}>`)
      map.set(src.toUpperCase(), decodeUtf16be(dstBytes))
    }
  }

  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g
  while ((m = bfrangeRe.exec(s)) != null) {
    const body = m[1] || ''
    const rangeRe = /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+(<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g
    let rm: RegExpExecArray | null
    while ((rm = rangeRe.exec(body)) != null) {
      const startHex = rm[1]
      const endHex = rm[2]
      const start = parseInt(startHex, 16)
      const end = parseInt(endHex, 16)
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
      if (rm[4]) {
        const baseBytes = parseHex(`<${rm[4]}>`)
        const baseStr = decodeUtf16be(baseBytes)
        const baseCode = baseStr.codePointAt(0) ?? 0
        for (let code = start; code <= end && code - start <= 2048; code += 1) {
          map.set(code.toString(16).toUpperCase().padStart(startHex.length, '0'), String.fromCodePoint(baseCode + (code - start)))
        }
      } else if (rm[5]) {
        const arrBody = rm[5]
        const items = [...arrBody.matchAll(/<([0-9A-Fa-f]+)>/g)].map(mm => mm[1])
        for (let i = 0; i < items.length && start + i <= end; i += 1) {
          const dstBytes = parseHex(`<${items[i]}>`)
          map.set((start + i).toString(16).toUpperCase().padStart(startHex.length, '0'), decodeUtf16be(dstBytes))
        }
      }
    }
  }

  return map
}

export function buildFontUnicodeMaps(objects: Map<number, ParsedIndirectObject>, resources: PdfDict | null): Record<string, Map<string, string>> {
  const out: Record<string, Map<string, string>> = {}
  if (!resources) return out
  const fontVal = getDictValue(resources, 'Font')
  const fontDict = (() => {
    const v = deref(objects, fontVal)
    return isDict(v) ? v : null
  })()
  if (!fontDict) return out
  for (const [fontKey, fontEntry] of Object.entries(fontDict.map)) {
    const ref = isRef(fontEntry) ? fontEntry : null
    if (!ref) continue
    const obj = objects.get(ref.obj)
    const dict = obj?.dict || null
    if (!dict) continue
    const toUnicodeVal = getDictValue(dict, 'ToUnicode')
    const toUnicodeRef = isRef(toUnicodeVal) ? toUnicodeVal : null
    if (!toUnicodeRef) continue
    const st = readStream(objects, toUnicodeRef)
    if (!st.bytes) continue
    try {
      out[fontKey] = parseToUnicodeCMap(st.bytes)
    } catch {
      void 0
    }
  }
  return out
}

export function decodePdfTextBytes(bytes: Buffer, cmap: Map<string, string> | null): string {
  if (!bytes || bytes.length === 0) return ''
  if (!cmap || cmap.size === 0) return bytes.toString('latin1')
  const keyLens = [...cmap.keys()].map(k => Math.max(1, Math.floor(k.length / 2))).filter(n => Number.isFinite(n))
  const preferredLen = (() => {
    const counts = new Map<number, number>()
    for (const n of keyLens) counts.set(n, (counts.get(n) || 0) + 1)
    let best = 1
    let bestCount = 0
    for (const [n, c] of counts.entries()) {
      if (c > bestCount) {
        best = n
        bestCount = c
      }
    }
    return Math.max(1, Math.min(4, best))
  })()
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const len = Math.min(preferredLen, bytes.length - i)
    let matched = false
    for (let n = len; n >= 1; n -= 1) {
      const key = bytes.slice(i, i + n).toString('hex').toUpperCase()
      const u = cmap.get(key)
      if (u != null) {
        out += u
        i += n
        matched = true
        break
      }
    }
    if (!matched) {
      out += String.fromCharCode(bytes[i])
      i += 1
    }
  }
  return out
}

export function isPdfBytesToken(tok: unknown): tok is { kind: 'bytes'; bytes: Buffer } {
  return !!tok && typeof tok === 'object' && 'kind' in (tok as any) && (tok as any).kind === 'bytes'
}

export function isPdfNameToken(tok: unknown): tok is { kind: 'name'; name: string } {
  return !!tok && typeof tok === 'object' && 'kind' in (tok as any) && (tok as any).kind === 'name'
}
