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
  let lastAcceptedTokenEnd = -1
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
    const startsAfterAcceptedToken = start === lastAcceptedTokenEnd
    const startsCompactKeyword = tokenKind === 'keyword' && previous && /[A-Za-z0-9_.-]/.test(previous)
    if ((previous && /[A-Za-z0-9_/-]/.test(previous) && !startsAfterAcceptedToken && !startsCompactKeyword) || (next && /[A-Za-z0-9_-]/.test(next))) continue
    if (start > last) out.push({ kind: 'text', value: raw.slice(last, start) })
    out.push({ kind: 'token', value: token, tokenKind })
    last = end
    lastAcceptedTokenEnd = end
  }
  if (last < raw.length) out.push({ kind: 'text', value: raw.slice(last) })
  return out.length ? out : [{ kind: 'text', value: raw }]
}

export const normalizeInvocationTokenSpacing = (text: string): string => {
  const raw = String(text ?? '')
  if (!raw) return ''
  const segments = splitInvocationTokenSegments(raw)
  if (!segments.some(segment => segment.kind === 'token')) return raw
  let out = ''
  segments.forEach((segment, index) => {
    const previous = segments[index - 1]
    const next = segments[index + 1]
    if (segment.kind === 'token') {
      if (out && !/[ \n]$/.test(out) && !/[([{<]$/.test(out)) out += ' '
      out += segment.value
      return
    }
    if (previous?.kind === 'token' && next?.kind === 'token' && /^[ \t]*$/.test(segment.value)) {
      out += ' '
      return
    }
    out += segment.value
  })
  return out
}
