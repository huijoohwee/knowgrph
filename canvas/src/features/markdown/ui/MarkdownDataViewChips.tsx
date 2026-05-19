import React from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_TEXT_TRUNCATE_CHIP } from '@/lib/ui/textLayout'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'

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

const DATA_VIEW_CHIP_ROW_CLASSNAME = `${UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME} px-2 py-0.5 rounded border text-[10px] font-medium`

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

export const DataViewTagChip = React.memo(function DataViewTagChip(props: { value: string }) {
  const v = String(props.value || '').trim()
  if (!v) return null
  const label = readMarkdownSigilDisplayText(v)
  return (
    <span
      className={[
        DATA_VIEW_CHIP_ROW_CLASSNAME,
        resolveDataViewChipClass(v),
      ].join(' ')}
      title={label}
    >
      <span className={UI_TEXT_TRUNCATE_CHIP}>{renderMarkdownSigilInlineText(v)}</span>
    </span>
  )
})

export const DataViewStatusChip = React.memo(function DataViewStatusChip(props: { value: string; checked?: boolean; hideIcon?: boolean }) {
  const v = String(props.value || '').trim()
  if (!v) return null
  const label = readMarkdownSigilDisplayText(v)
  return (
    <span
      className={[
        DATA_VIEW_CHIP_ROW_CLASSNAME,
        props.hideIcon ? '' : 'gap-1.5',
        resolveDataViewChipClass(v),
      ].join(' ')}
      title={label}
    >
      {props.hideIcon ? null : props.checked ? (
        <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
      ) : (
        <Circle className="w-3 h-3 shrink-0" aria-hidden="true" />
      )}
      <span className={UI_TEXT_TRUNCATE_CHIP}>{renderMarkdownSigilInlineText(v)}</span>
    </span>
  )
})
