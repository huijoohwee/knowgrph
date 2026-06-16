import React from 'react'
import { Plus } from 'lucide-react'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import {
  UI_RESPONSIVE_ACTION_ROW_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_ACTION_DEFAULT_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

export function WorkspaceDataViewNewRecordButton(props: {
  onClick: () => void
  className?: string
  labelMode?: 'always' | 'hover'
}) {
  const labelMode = props.labelMode || 'hover'
  const labelClassName = [
    'kg-data-view-new-record-label',
    labelMode === 'hover' ? 'kg-data-view-new-record-label--hover' : '',
    'text-xs font-medium',
    UI_TEXT_TRUNCATE,
    UI_THEME_TOKENS.text.primary,
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={[
        UI_RESPONSIVE_ACTION_ROW_CLASSNAME,
        UI_RESPONSIVE_DATA_VIEW_ACTION_DEFAULT_CLASSNAME,
        'kg-data-view-new-record-action rounded border',
        labelMode === 'hover' ? 'kg-data-view-new-record-action--hover-label' : '',
        UI_THEME_TOKENS.panel.border,
        UI_THEME_TOKENS.button.hoverBg,
        props.className || '',
      ].filter(Boolean).join(' ')}
      title={MARKDOWN_DATA_VIEW_COPY.newRecordLabel}
      aria-label={MARKDOWN_DATA_VIEW_COPY.newRecordLabel}
      onClick={props.onClick}
    >
      <Plus className={['h-4 w-4 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
      <span className={labelClassName}>{MARKDOWN_DATA_VIEW_COPY.newRecordLabel}</span>
    </button>
  )
}
