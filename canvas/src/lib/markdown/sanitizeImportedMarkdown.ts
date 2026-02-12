export type SanitizeMarkdownResult = { text: string; changed: boolean }

const isBase64ish = (line: string): boolean => {
  const s = String(line || '').trim()
  if (!s) return false
  if (s.length < 256) return false
  if (!/^[A-Za-z0-9+/=]+$/.test(s)) return false
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0
  if (pad > 0 && s.slice(0, -pad).includes('=')) return false
  return true
}

export function stripEmbeddedBase64ImageSrc(raw: string): SanitizeMarkdownResult {
  const s = String(raw || '')
  const needle = 'data:image/'
  const base64Needle = ';base64,'
  let i = 0
  let changed = false
  let out = ''
  while (i < s.length) {
    const start = s.indexOf(needle, i)
    if (start < 0) {
      out += s.slice(i)
      break
    }
    const base64Pos = s.indexOf(base64Needle, start)
    if (base64Pos < 0) {
      out += s.slice(i)
      break
    }
    out += s.slice(i, start)

    const afterBase64 = base64Pos + base64Needle.length
    const maxScan = Math.min(s.length, afterBase64 + 2_000_000)
    let end = afterBase64
    for (; end < maxScan; end += 1) {
      const ch = s.charCodeAt(end)
      if (ch === 41 || ch === 34 || ch === 39 || ch === 32 || ch === 10 || ch === 13 || ch === 9) break
    }
    out += 'data:,'
    changed = true
    i = end
  }
  return { text: out, changed }
}

export function stripLargeBase64Fences(raw: string): SanitizeMarkdownResult {
  const text = String(raw || '')
  const lines = text.split(/\r?\n/g)
  let inFence = false
  let fence = ''
  let changed = false
  const out: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    if (!inFence) {
      const m = trimmed.match(/^(```+|~~~+)(.*)$/)
      if (m) {
        inFence = true
        fence = m[1] || '```'
        out.push(line)
        continue
      }
      if (isBase64ish(line)) {
        out.push('<omitted>')
        changed = true
        continue
      }
      out.push(line)
      continue
    }

    if (trimmed.startsWith(fence)) {
      inFence = false
      fence = ''
      out.push(line)
      continue
    }
    if (isBase64ish(line)) {
      out.push('<omitted>')
      changed = true
      continue
    }
    out.push(line)
  }
  return { text: out.join('\n'), changed }
}

export function sanitizeImportedMarkdownText(raw: string): SanitizeMarkdownResult {
  const a = stripEmbeddedBase64ImageSrc(raw)
  const b = stripLargeBase64Fences(a.text)
  return { text: b.text, changed: a.changed || b.changed }
}

