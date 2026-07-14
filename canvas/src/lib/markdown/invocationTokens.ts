export type InvocationTokenKind = 'slash' | 'keyword' | 'binding'

export type InvocationTokenSegment =
  | { kind: 'text'; value: string }
  | { kind: 'token'; value: string; tokenKind: InvocationTokenKind }

export const INVOCATION_TOKEN_RE = /(?:#[\p{L}\p{N}][\p{L}\p{N}._-]{0,63}|\/\p{L}[\p{L}\p{N}._-]{0,63}|@\p{L}[\p{L}\p{N}._-]{0,255})/gu
const INVOCATION_TOKEN_PREVIOUS_BOUNDARY_RE = /[\p{L}\p{N}_/-]/u
const INVOCATION_TOKEN_NEXT_BOUNDARY_RE = /[\p{L}\p{N}_-]/u
const INVOCATION_TOKEN_COMPACT_KEYWORD_PREVIOUS_RE = /[\p{L}\p{N}_.-]/u

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
    const startsCompactKeyword = tokenKind === 'keyword' && previous && INVOCATION_TOKEN_COMPACT_KEYWORD_PREVIOUS_RE.test(previous)
    const startsInsideSchemePath = tokenKind === 'slash' && previous === ':'
    if (startsInsideSchemePath || (previous && INVOCATION_TOKEN_PREVIOUS_BOUNDARY_RE.test(previous) && !startsAfterAcceptedToken && !startsCompactKeyword) || (next && INVOCATION_TOKEN_NEXT_BOUNDARY_RE.test(next))) continue
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
