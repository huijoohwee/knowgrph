import type { TextFragment } from './types'
import { parseHexString, parseLiteralString } from './pdfObjects'
import { decodePdfTextBytes, isPdfBytesToken, isPdfNameToken } from './pdfCmap'

export function parseContentStreamText(bytes: Buffer, fontMaps: Record<string, Map<string, string>>): TextFragment[] {
  const s = bytes.toString('latin1')
  const frags: TextFragment[] = []
  const stack: unknown[] = []
  let inText = false
  let fontKey = ''
  let fontSize = 12
  let leading = 0
  let x = 0
  let y = 0
  let ctmA = 1
  let ctmB = 0
  let ctmC = 0
  let ctmD = 1
  let ctmE = 0
  let ctmF = 0
  let tmA = 1
  let tmB = 0
  let tmC = 0
  let tmD = 1
  let tmE = 0
  let tmF = 0
  let tmEffectiveScale = 0

  const applyCtm = () => {
    const newX = ctmA * tmE + ctmC * tmF + ctmE
    const newY = ctmB * tmE + ctmD * tmF + ctmF
    x = newX
    y = newY
    const scaleX = Math.sqrt(ctmA * ctmA + ctmB * ctmB)
    const tmScale = Math.sqrt(tmA * tmA + tmB * tmB)
    const effectiveScale = scaleX * tmScale
    if (effectiveScale > 0.5) {
      tmEffectiveScale = effectiveScale
      fontSize = Math.max(fontSize, Math.round(effectiveScale * 10) / 10)
    }
  }

  const pop = () => stack.pop()

  type ContentArrayToken = { kind: 'array'; items: unknown[] }
  const isContentArrayToken = (v: unknown): v is ContentArrayToken => {
    if (!v || typeof v !== 'object') return false
    if (!('kind' in v) || (v as { kind?: unknown }).kind !== 'array') return false
    if (!('items' in v)) return false
    return Array.isArray((v as { items?: unknown }).items)
  }
  const tokenDelims = '<>[]()/%'

  const readToken = (idx0: number): { tok: unknown; next: number } => {
    let idx = idx0
    while (idx < s.length) {
      const ch = s[idx]
      if (/\s/.test(ch)) {
        idx += 1
        continue
      }
      if (ch === '%') {
        const nl = s.indexOf('\n', idx + 1)
        idx = nl >= 0 ? nl + 1 : s.length
        continue
      }
      break
    }
    if (idx >= s.length) return { tok: null, next: idx }
    const ch = s[idx]
    if (ch === '<' && s[idx + 1] === '<') return { tok: '<<', next: idx + 2 }
    if (ch === '>' && s[idx + 1] === '>') return { tok: '>>', next: idx + 2 }
    if (ch === '(') {
      const lit = parseLiteralString(s, idx)
      return { tok: { kind: 'bytes', bytes: lit.bytes }, next: lit.next }
    }
    if (ch === '<' && s[idx + 1] !== '<') {
      const hx = parseHexString(s, idx)
      return { tok: { kind: 'bytes', bytes: hx.bytes }, next: hx.next }
    }
    if (ch === '[') {
      idx += 1
      const items: unknown[] = []
      while (idx < s.length) {
        while (idx < s.length && /\s/.test(s[idx])) idx += 1
        if (s[idx] === ']') {
          idx += 1
          break
        }
        const t = readToken(idx)
        if (t.tok == null) break
        items.push(t.tok)
        idx = t.next
      }
      return { tok: { kind: 'array', items }, next: idx }
    }
    if (ch === '/') {
      idx += 1
      const start = idx
      while (idx < s.length && !/\s/.test(s[idx]) && !tokenDelims.includes(s[idx])) idx += 1
      return { tok: { kind: 'name', name: s.slice(start, idx) }, next: idx }
    }
    if (tokenDelims.includes(ch)) return { tok: ch, next: idx + 1 }
    let end = idx
    while (end < s.length && !/\s/.test(s[end]) && !tokenDelims.includes(s[end])) end += 1
    const raw = s.slice(idx, end)
    const num = Number(raw)
    if (Number.isFinite(num) && /^[-+0-9.]+$/.test(raw)) return { tok: num, next: end }
    return { tok: raw, next: end }
  }

  const emitText = (raw: string) => {
    const cleaned = String(raw || '').replace(/\s+/g, ' ').trim()
    if (!cleaned) return
    const pieces = cleaned.split(' ').filter(Boolean)
    if (pieces.length === 0) return
    const charW = Math.max(1, fontSize * 0.5)
    let dx = 0
    for (let i = 0; i < pieces.length; i += 1) {
      const w = pieces[i]
      frags.push({ x: x + dx, y, fontSize, fontKey, text: w })
      dx += w.length * charW
      if (i < pieces.length - 1) dx += charW
    }
    x += dx
  }

  const emitBytes = (b: Buffer) => {
    const cmap = fontKey ? fontMaps[fontKey] || null : null
    emitText(decodePdfTextBytes(b, cmap))
  }

  let idx = 0
  while (idx < s.length) {
    const t = readToken(idx)
    idx = t.next
    const tok = t.tok
    if (tok == null) break
    if (typeof tok === 'string') {
      const op = tok
      if (op === 'BT') {
        inText = true
        stack.length = 0
        tmA = 1; tmB = 0; tmC = 0; tmD = 1; tmE = 0; tmF = 0
        x = ctmE
        y = ctmF
        continue
      }
      if (op === 'ET') {
        inText = false
        stack.length = 0
        continue
      }
      if (op === 'cm') {
        const f = pop()
        const e = pop()
        const d = pop()
        const c = pop()
        const b = pop()
        const a = pop()
        if (typeof a === 'number') ctmA = a
        if (typeof b === 'number') ctmB = b
        if (typeof c === 'number') ctmC = c
        if (typeof d === 'number') ctmD = d
        if (typeof e === 'number') ctmE = e
        if (typeof f === 'number') ctmF = f
        stack.length = 0
        continue
      }
      if (op === 'q') {
        stack.length = 0
        continue
      }
      if (op === 'Q') {
        stack.length = 0
        continue
      }
      if (!inText) {
        stack.length = 0
        continue
      }
      if (op === 'Tf') {
        const size = pop()
        const name = pop()
        if (typeof size === 'number' && (tmEffectiveScale < 1 || size >= tmEffectiveScale * 0.5)) {
          fontSize = size
        }
        if (isPdfNameToken(name)) fontKey = String(name.name || '')
        stack.length = 0
        continue
      }
      if (op === 'TL') {
        const l = pop()
        if (typeof l === 'number') leading = l
        stack.length = 0
        continue
      }
      if (op === 'Td') {
        const ty = pop()
        const tx = pop()
        if (typeof tx === 'number') x += tx
        if (typeof ty === 'number') y += ty
        stack.length = 0
        continue
      }
      if (op === 'TD') {
        const ty = pop()
        const tx = pop()
        if (typeof tx === 'number') x += tx
        if (typeof ty === 'number') y += ty
        if (typeof ty === 'number') leading = -ty
        stack.length = 0
        continue
      }
      if (op === 'Tm') {
        const f = pop()
        const e = pop()
        const d = pop()
        const c = pop()
        const b = pop()
        const a = pop()
        if (typeof a === 'number') tmA = a
        if (typeof b === 'number') tmB = b
        if (typeof c === 'number') tmC = c
        if (typeof d === 'number') tmD = d
        if (typeof e === 'number') tmE = e
        if (typeof f === 'number') tmF = f
        applyCtm()
        stack.length = 0
        continue
      }
      if (op === 'T*') {
        y -= leading || fontSize * 1.2
        stack.length = 0
        continue
      }
      if (op === 'Tj') {
        const b = pop()
        if (isPdfBytesToken(b)) emitBytes(Buffer.from(b.bytes))
        stack.length = 0
        continue
      }
      if (op === 'TJ') {
        const arr = pop()
        if (isContentArrayToken(arr)) {
          const items = arr.items
          const parts: Buffer[] = []
          const textParts: string[] = []
          let sawNumber = false
          for (const it of items) {
            if (isPdfBytesToken(it)) {
              const b = Buffer.from(it.bytes)
              parts.push(b)
              const cmap = fontKey ? fontMaps[fontKey] || null : null
              textParts.push(decodePdfTextBytes(b, cmap))
              continue
            }
            if (typeof it === 'number' && Number.isFinite(it)) {
              sawNumber = true
              if (it > 120) textParts.push(' ')
            }
          }
          if (textParts.length > 0) {
            emitText(textParts.join(''))
          } else if (parts.length > 0 && !sawNumber) {
            emitBytes(Buffer.concat(parts))
          }
        }
        stack.length = 0
        continue
      }
      if (op === "'") {
        y -= leading || fontSize * 1.2
        const b = pop()
        if (isPdfBytesToken(b)) emitBytes(Buffer.from(b.bytes))
        stack.length = 0
        continue
      }
      if (op === '"') {
        pop()
        pop()
        y -= leading || fontSize * 1.2
        const b = pop()
        if (isPdfBytesToken(b)) emitBytes(Buffer.from(b.bytes))
        stack.length = 0
        continue
      }
      stack.length = 0
      continue
    }
    stack.push(tok)
  }

  return frags
}
