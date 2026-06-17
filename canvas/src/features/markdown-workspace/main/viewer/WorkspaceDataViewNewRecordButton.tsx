import React from 'react'
import { Plus } from 'lucide-react'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import {
  UI_RESPONSIVE_ACTION_ROW_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_ACTION_DEFAULT_CLASSNAME,
  UI_RESPONSIVE_DATA_VIEW_ICON_ACTION_DEFAULT_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

export function WorkspaceDataViewNewRecordButton(props: {
  onClick: () => void
  className?: string
  labelMode?: 'always' | 'hover' | 'icon'
  hoverRevealScope?: 'self' | 'container'
  presentation?: 'button' | 'divider'
}) {
  const labelMode = props.labelMode || 'hover'
  const hoverRevealScope = props.hoverRevealScope || 'self'
  const presentation = props.presentation || 'button'
  const dividerPresentation = presentation === 'divider'
  const iconOnly = labelMode === 'icon' || dividerPresentation
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
        dividerPresentation ? 'group' : '',
        UI_RESPONSIVE_ACTION_ROW_CLASSNAME,
        dividerPresentation
          ? 'w-full justify-center gap-2 rounded-none border-0 bg-transparent px-0 py-2'
          : iconOnly
            ? UI_RESPONSIVE_DATA_VIEW_ICON_ACTION_DEFAULT_CLASSNAME
            : UI_RESPONSIVE_DATA_VIEW_ACTION_DEFAULT_CLASSNAME,
        dividerPresentation ? 'kg-data-view-new-record-divider-action' : 'kg-data-view-new-record-action rounded border',
        iconOnly ? 'shrink-0' : '',
        iconOnly && !dividerPresentation ? UI_THEME_TOKENS.button.square : '',
        iconOnly ? 'justify-center' : '',
        labelMode === 'hover' && !dividerPresentation ? 'kg-data-view-new-record-action--hover-label' : '',
        labelMode === 'hover' && hoverRevealScope === 'container' && !dividerPresentation ? 'kg-data-view-new-record-action--container-hover-label' : '',
        dividerPresentation ? '' : UI_THEME_TOKENS.panel.border,
        dividerPresentation ? '' : UI_THEME_TOKENS.button.hoverBg,
        UI_THEME_TOKENS.focus.primarySoftRing,
        props.className || '',
      ].filter(Boolean).join(' ')}
      title={MARKDOWN_DATA_VIEW_COPY.newRecordLabel}
      aria-label={MARKDOWN_DATA_VIEW_COPY.newRecordLabel}
      onClick={props.onClick}
    >
      {dividerPresentation ? (
        <>
          <span aria-hidden="true" className="h-px flex-1 rounded-full bg-[color:var(--kg-divider)]" />
          <span
            aria-hidden="true"
            className={[
              'inline-flex shrink-0 items-center justify-center rounded-full border transition-colors group-hover:bg-[var(--kg-panel-action-bg-hover)]',
              UI_THEME_TOKENS.button.square,
              UI_THEME_TOKENS.panel.border,
              UI_THEME_TOKENS.panel.bg,
            ].join(' ')}
          >
            <Plus className={['h-4 w-4 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
          </span>
          <span aria-hidden="true" className="h-px flex-1 rounded-full bg-[color:var(--kg-divider)]" />
        </>
      ) : (
        <>
          <Plus className={['h-4 w-4 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
          {!iconOnly ? <span className={labelClassName}>{MARKDOWN_DATA_VIEW_COPY.newRecordLabel}</span> : null}
        </>
      )}
    </button>
  )
}
