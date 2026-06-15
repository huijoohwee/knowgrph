import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'

const chipToneClasses = [
  UI_THEME_TOKENS.status.neutral,
  UI_THEME_TOKENS.status.info,
  UI_THEME_TOKENS.status.warning,
  UI_THEME_TOKENS.status.success,
  UI_THEME_TOKENS.status.error,
  UI_THEME_TOKENS.status.lilac,
  UI_THEME_TOKENS.status.pink,
  UI_THEME_TOKENS.status.orange,
] as const

const fixedChipClasses: Record<string, string> = {
  todo: UI_THEME_TOKENS.status.neutral,
  doing: UI_THEME_TOKENS.status.info,
  done: UI_THEME_TOKENS.status.success,
  backlog: UI_THEME_TOKENS.status.neutral,
  wip: UI_THEME_TOKENS.status.info,
  blocked: UI_THEME_TOKENS.status.error,
  '1': UI_THEME_TOKENS.status.orange,
  '2': UI_THEME_TOKENS.status.lilac,
  '3': UI_THEME_TOKENS.status.pink,
}

export const DATA_VIEW_CHIP_ROW_CLASSNAME = `${UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME} px-2 py-0.5 rounded border text-[10px] font-medium`

const hashPick = (key: string): string => {
  const s = String(key || '').trim().toLowerCase()
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return chipToneClasses[h % chipToneClasses.length] || chipToneClasses[0]
}

export const resolveDataViewChipClass = (value: string): string => {
  const key = readMarkdownSigilDisplayText(value).trim().toLowerCase()
  if (!key) return chipToneClasses[0]
  return fixedChipClasses[key] || hashPick(key)
}

export const INLINE_KEYWORD_CHIP_TOKEN_RE = /#[A-Za-z][A-Za-z0-9-]{1,47}/g

export const splitInlineKeywordChipTokens = (text: string): Array<
  | { kind: 'text'; value: string }
  | { kind: 'keyword'; value: string }
> => {
  const raw = String(text ?? '')
  if (!raw) return [{ kind: 'text', value: '' }]
  const out: Array<{ kind: 'text'; value: string } | { kind: 'keyword'; value: string }> = []
  let last = 0
  for (;;) {
    const match = INLINE_KEYWORD_CHIP_TOKEN_RE.exec(raw)
    if (!match) break
    const token = String(match[0] || '')
    const start = match.index
    const end = start + token.length
    const previous = start > 0 ? raw[start - 1] || '' : ''
    const next = end < raw.length ? raw[end] || '' : ''
    if ((previous && /[A-Za-z0-9_/-]/.test(previous)) || (next && /[A-Za-z0-9_-]/.test(next))) continue
    if (start > last) out.push({ kind: 'text', value: raw.slice(last, start) })
    out.push({ kind: 'keyword', value: token })
    last = end
  }
  if (last < raw.length) out.push({ kind: 'text', value: raw.slice(last) })
  return out.length ? out : [{ kind: 'text', value: raw }]
}

export const readInlineKeywordChipToneValue = (value: string): string => {
  const raw = String(value ?? '').trim()
  return raw.startsWith('#') ? raw.slice(1) : raw
}

export const readInlineKeywordChipLabel = (value: string): string => {
  return readInlineKeywordChipToneValue(value)
}
