import type { SanitizeMarkdownResult } from './sanitizeImportedMarkdown'

const parseBalanced = (
  s: string,
  openIndex: number,
  openChar: string,
  closeChar: string,
): { end: number } | null => {
  if (s[openIndex] !== openChar) return null
  let depth = 0
  for (let i = openIndex; i < s.length; i += 1) {
    const ch = s[i] || ''
    if (ch === openChar) depth += 1
    else if (ch === closeChar) {
      depth -= 1
      if (depth === 0) return { end: i }
    }
  }
  return null
}

export const dropEmptyMarkdownMedia = (text: string): SanitizeMarkdownResult => {
  const raw = String(text || '')
  if (!/!?\[[^\]]*\]\(\s*\)/.test(raw)) return { text: raw, changed: false }
  const next = raw
    .replace(/!\[[^\]]*\]\(\s*\)/g, '')
    .replace(/\[\s*\]\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
  return { text: next, changed: next !== raw }
}

export const normalizeUnsafeJavascriptLinks = (text: string): SanitizeMarkdownResult => {
  const raw = String(text || '')
  if (!/\]\(\s*javascript:/i.test(raw)) return { text: raw, changed: false }
  let out = ''
  let i = 0
  let changed = false
  while (i < raw.length) {
    const start = raw.indexOf('[', i)
    if (start < 0) {
      out += raw.slice(i)
      break
    }
    out += raw.slice(i, start)
    const labelEnd = parseBalanced(raw, start, '[', ']')
    if (!labelEnd) {
      out += raw[start]
      i = start + 1
      continue
    }
    const destOpen = labelEnd.end + 1
    if (raw[destOpen] !== '(') {
      out += raw.slice(start, labelEnd.end + 1)
      i = labelEnd.end + 1
      continue
    }
    let escaped = false
    let destEnd = -1
    for (let j = destOpen + 1; j < raw.length; j += 1) {
      const ch = raw[j] || ''
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === ')') {
        destEnd = j
        break
      }
    }
    if (destEnd < 0) {
      out += raw.slice(start, destOpen + 1)
      i = destOpen + 1
      continue
    }
    const rawDest = raw.slice(destOpen + 1, destEnd)
    const normalizedDest = rawDest.replace(/\\([()])/g, '$1').trim().toLowerCase()
    if (normalizedDest.startsWith('javascript:')) {
      out += raw.slice(start + 1, labelEnd.end).trim()
      changed = true
    } else {
      out += raw.slice(start, destEnd + 1)
    }
    i = destEnd + 1
  }
  return { text: out, changed }
}

export const sanitizeImportedMarkdownUnsafeMediaLinks = (text: string): SanitizeMarkdownResult => {
  const a = dropEmptyMarkdownMedia(text)
  const b = normalizeUnsafeJavascriptLinks(a.text)
  return { text: b.text, changed: a.changed || b.changed }
}
