import React from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_TEXT_TRUNCATE_CHIP } from '@/lib/ui/textLayout'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { DATA_VIEW_CHIP_ROW_CLASSNAME, resolveDataViewChipClass } from './dataViewChipStyles'

export { DATA_VIEW_CHIP_ROW_CLASSNAME, resolveDataViewChipClass } from './dataViewChipStyles'

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
        <CheckCircle2 className={UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME} aria-hidden="true" />
      ) : (
        <Circle className={UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME} aria-hidden="true" />
      )}
      <span className={UI_TEXT_TRUNCATE_CHIP}>{renderMarkdownSigilInlineText(v)}</span>
    </span>
  )
})
