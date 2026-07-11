import React from 'react'

import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_PANEL_INLINE_FIELD_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { cn } from '@/lib/utils'

export const StoryboardWidgetInlineValueEditor = React.memo(function StoryboardWidgetInlineValueEditor(props: {
  id: string
  value: string
  active: boolean
  ariaLabel?: string
  placeholder?: string
  multiline?: boolean
  editorSurface?: 'control' | 'viewer'
  rows?: number
  className?: string
  displayClassName?: string
  editorClassName?: string
  markdownCommandContextText?: string
  onCommit: (nextValue: string) => void
}) {
  const {
    id,
    value,
    active,
    ariaLabel,
    placeholder,
    multiline = false,
    editorSurface = 'control',
    rows,
    className,
    displayClassName,
    editorClassName,
    markdownCommandContextText,
    onCommit,
  } = props
  const baseDisplayClass = cn(
    'w-full min-w-0 rounded border outline-none',
    multiline
      ? 'px-2 py-1'
      : `${UI_RESPONSIVE_PANEL_INLINE_FIELD_CLASSNAME} truncate`,
    UI_THEME_TOKENS.input.bg,
    UI_THEME_TOKENS.input.border,
    UI_THEME_TOKENS.input.text,
    multiline ? null : className,
    displayClassName,
  )
  const baseEditorClass = cn(
    className,
    editorClassName,
  )

  const commonEditorProps = {
    id,
    value: String(value ?? ''),
    ariaLabel: ariaLabel || id,
    placeholder: placeholder || '',
    canEdit: true,
    editActivation: 'click' as const,
    multiline,
    markdownPreview: multiline ? 'auto' as const : undefined,
    markdownCommandContextText,
    rows,
    displayClassName: baseDisplayClass,
    editorClassName: baseEditorClass,
    emptyClassName: UI_THEME_TOKENS.text.tertiary,
    onCommit,
  }

  return editorSurface === 'control' ? (
    <CardInlineTextEditor
      {...commonEditorProps}
      editorSurface="control"
    />
  ) : (
    <CardInlineTextEditor
      {...commonEditorProps}
      editorSurface="viewer"
    />
  )
})
