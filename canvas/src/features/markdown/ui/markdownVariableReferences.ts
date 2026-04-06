import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'

export type MarkdownVariableToken = {
  start: number
  end: number
  raw: string
  key: string
  declaredValue: string | null
  fallback: string | null
}

const VAR_KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/
const VAR_TOKEN_RE = /\{\{([^{}]+)\}\}/g

export const parseMarkdownVariableTokenExpr = (rawExpr: string): { key: string; declaredValue: string | null; fallback: string | null } | null => {
  const expr = String(rawExpr || '').trim()
  if (!expr) return null
  const declMatch = /^([A-Za-z0-9_.-]{1,64})\s*:\s*([^}]+)$/.exec(expr)
  if (declMatch) {
    const key = String(declMatch[1] || '').trim()
    const declaredValue = String(declMatch[2] || '').trim()
    if (!VAR_KEY_RE.test(key) || !declaredValue) return null
    return { key, declaredValue, fallback: null }
  }
  const fallbackMatch = /^([A-Za-z0-9_.-]{1,64})\s*\|\s*([^}]+)$/.exec(expr)
  if (fallbackMatch) {
    const key = String(fallbackMatch[1] || '').trim()
    const fallback = String(fallbackMatch[2] || '').trim()
    if (!VAR_KEY_RE.test(key) || !fallback) return null
    return { key, declaredValue: null, fallback }
  }
  if (!VAR_KEY_RE.test(expr)) return null
  return { key: expr, declaredValue: null, fallback: null }
}

export const parseMarkdownVariableTokens = (text: string): MarkdownVariableToken[] => {
  const rawText = String(text || '')
  const out: MarkdownVariableToken[] = []
  VAR_TOKEN_RE.lastIndex = 0
  for (;;) {
    const m = VAR_TOKEN_RE.exec(rawText)
    if (!m) break
    const parsed = parseMarkdownVariableTokenExpr(String(m[1] || ''))
    if (!parsed) continue
    const start = Number(m.index || 0)
    const full = String(m[0] || '')
    const end = start + full.length
    out.push({
      start,
      end,
      raw: full,
      key: parsed.key,
      declaredValue: parsed.declaredValue,
      fallback: parsed.fallback,
    })
  }
  return out
}

export const findMarkdownVariableTokenAtOffset = (args: { text: string; offset: number }): MarkdownVariableToken | null => {
  const text = String(args.text || '')
  const offset = Math.max(0, Math.min(text.length, Math.floor(args.offset)))
  const tokens = parseMarkdownVariableTokens(text)
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]
    if (offset >= t.start && offset <= t.end) return t
  }
  return null
}

const flattenFrontmatterKeys = (obj: unknown, maxDepth: number = 4, prefix: string = ''): string[] => {
  if (maxDepth < 0) return []
  const out: string[] = []
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      const key = prefix ? `${prefix}.${i}` : String(i)
      out.push(key)
      out.push(...flattenFrontmatterKeys(obj[i], maxDepth - 1, key))
    }
    return out
  }
  if (!obj || typeof obj !== 'object') return out
  const rec = obj as Record<string, unknown>
  const keys = Object.keys(rec)
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i]
    const next = prefix ? `${prefix}.${k}` : k
    out.push(next)
    out.push(...flattenFrontmatterKeys(rec[k], maxDepth - 1, next))
  }
  return out
}

export const collectMarkdownVariableSuggestions = (args: { sourceLines?: string[]; draftText: string }): string[] => {
  const out = new Set<string>()
  const addKey = (raw: string) => {
    const k = String(raw || '').trim()
    if (!k || !VAR_KEY_RE.test(k)) return
    out.add(k)
  }
  const draft = String(args.draftText || '')
  const draftTokens = parseMarkdownVariableTokens(draft)
  for (let i = 0; i < draftTokens.length; i += 1) addKey(draftTokens[i]?.key || '')
  const source = Array.isArray(args.sourceLines) ? args.sourceLines.join('\n') : ''
  if (source) {
    const sourceTokens = parseMarkdownVariableTokens(source)
    for (let i = 0; i < sourceTokens.length; i += 1) addKey(sourceTokens[i]?.key || '')
    const { meta } = parseMarkdownFrontmatter(splitMarkdownLines(source))
    const frontmatterKeys = flattenFrontmatterKeys(meta)
    for (let i = 0; i < frontmatterKeys.length; i += 1) addKey(frontmatterKeys[i] || '')
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b))
}

export const buildMarkdownVariableToken = (args: {
  mode: 'ref' | 'create' | 'update' | 'fallback'
  key: string
  value?: string
  fallback?: string
}): string => {
  const key = String(args.key || '').trim()
  if (!VAR_KEY_RE.test(key)) return ''
  if (args.mode === 'create' || args.mode === 'update') {
    const value = String(args.value || '').trim()
    if (!value) return ''
    return `{{${key}:${value}}}`
  }
  if (args.mode === 'fallback') {
    const fallback = String(args.fallback || '').trim()
    if (!fallback) return ''
    return `{{${key}|${fallback}}}`
  }
  return `{{${key}}}`
}
