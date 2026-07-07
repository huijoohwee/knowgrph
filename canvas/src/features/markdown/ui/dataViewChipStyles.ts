import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'

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

const DATA_VIEW_CHIP_BASE_CLASSNAME = `${UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME} min-w-0 max-w-full overflow-hidden px-2 py-0.5 rounded border font-medium`

export const DATA_VIEW_CHIP_ROW_CLASSNAME = `${DATA_VIEW_CHIP_BASE_CLASSNAME} text-[10px] leading-[15px]`

export const DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME = `${DATA_VIEW_CHIP_BASE_CLASSNAME} [font-size:inherit] [line-height:inherit]`

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

export const splitInlineKeywordChipTokens = (text: string): Array<
  | { kind: 'text'; value: string }
  | { kind: 'keyword'; value: string }
> => {
  return splitInvocationTokenSegments(text).map(segment => (
    segment.kind === 'text'
      ? segment
      : { kind: 'keyword' as const, value: segment.value }
  ))
}

export const readInlineKeywordChipToneValue = (value: string): string => {
  const raw = String(value ?? '').trim()
  return raw.startsWith('#') ? raw.slice(1) : raw
}

export const readInlineKeywordChipLabel = (value: string): string => {
  return readInlineKeywordChipToneValue(value)
}
