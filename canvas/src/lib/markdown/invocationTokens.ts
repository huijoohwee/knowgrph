export type InvocationTokenKind = 'slash' | 'keyword' | 'binding'

export type InvocationTokenSegment =
  | { kind: 'text'; value: string }
  | { kind: 'token'; value: string; tokenKind: InvocationTokenKind }

export const INVOCATION_TOKEN_RE = /(?:#[A-Za-z0-9][A-Za-z0-9._-]{0,63}|[@/][A-Za-z][A-Za-z0-9._-]{0,63})/g

export const readInvocationTokenKind = (value: string): InvocationTokenKind | null => {
  const token = String(value || '').trim()
  if (token.startsWith('/')) return 'slash'
  if (token.startsWith('#')) return 'keyword'
  if (token.startsWith('@')) return 'binding'
  return null
}

export const splitInvocationTokenSegments = (text: string): InvocationTokenSegment[] => {
  const raw = String(text ?? '')
  if (!raw) return [{ kind: 'text', value: '' }]
  const out: InvocationTokenSegment[] = []
  let last = 0
  INVOCATION_TOKEN_RE.lastIndex = 0
  for (;;) {
    const match = INVOCATION_TOKEN_RE.exec(raw)
    if (!match) break
    const token = String(match[0] || '')
    const tokenKind = readInvocationTokenKind(token)
    if (!tokenKind) continue
    const start = match.index
    const end = start + token.length
    const previous = start > 0 ? raw[start - 1] || '' : ''
    const next = end < raw.length ? raw[end] || '' : ''
    if ((previous && /[A-Za-z0-9_/-]/.test(previous)) || (next && /[A-Za-z0-9_-]/.test(next))) continue
    if (start > last) out.push({ kind: 'text', value: raw.slice(last, start) })
    out.push({ kind: 'token', value: token, tokenKind })
    last = end
  }
  if (last < raw.length) out.push({ kind: 'text', value: raw.slice(last) })
  return out.length ? out : [{ kind: 'text', value: raw }]
}
