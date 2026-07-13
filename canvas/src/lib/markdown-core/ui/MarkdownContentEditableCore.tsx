import React from 'react'
import {
  MARKDOWN_CONTENT_EDITABLE_PLACEHOLDER_CLASS,
  MARKDOWN_EDIT_SURFACE_INTERACTION_PARITY_CLASS,
} from '@/lib/markdown-core/ui/markdownContentEditableSurface'
import {
  isInlineTokenPointerTarget,
  preventInlineTokenSecondMouseDown,
  stopInlineTextEditorDoubleClick,
} from '@/lib/markdown-core/ui/markdownInlineTextTokenPointerEvents'
import { cn } from '@/lib/utils'

export type MarkdownContentEditableCoreProps = Omit<React.HTMLAttributes<HTMLElement>,
  'aria-label' | 'aria-multiline' | 'contentEditable' | 'spellCheck' | 'suppressContentEditableWarning'> & {
  ariaLabel: string
  ariaMultiline?: boolean
  as?: React.ElementType
  editorRef: React.RefObject<HTMLElement | null>
  placeholder?: string
  preserveAtomicTokens?: boolean
  showPlaceholder?: boolean
  spellCheck?: boolean
}

export function MarkdownContentEditableCore(props: MarkdownContentEditableCoreProps) {
  const {
    ariaLabel,
    ariaMultiline = true,
    as: SurfaceTag = 'section',
    className,
    editorRef,
    onDoubleClick,
    onMouseDown,
    placeholder = '',
    preserveAtomicTokens = true,
    showPlaceholder = false,
    spellCheck = true,
    ...surfaceProps
  } = props

  return (
    <SurfaceTag
      {...surfaceProps}
      ref={(node: HTMLElement | null) => {
        ;(editorRef as React.MutableRefObject<HTMLElement | null>).current = node
      }}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={ariaMultiline ? 'true' : 'false'}
      aria-label={ariaLabel}
      aria-placeholder={showPlaceholder ? placeholder : undefined}
      spellCheck={spellCheck}
      className={cn(
        MARKDOWN_EDIT_SURFACE_INTERACTION_PARITY_CLASS,
        showPlaceholder ? MARKDOWN_CONTENT_EDITABLE_PLACEHOLDER_CLASS : '',
        className,
      )}
      data-kg-markdown-contenteditable-core="1"
      data-kg-markdown-edit-placeholder={showPlaceholder ? '1' : undefined}
      onMouseDown={event => {
        if (preserveAtomicTokens) preventInlineTokenSecondMouseDown(event)
        if (!event.isPropagationStopped()) onMouseDown?.(event)
      }}
      onDoubleClick={event => {
        if (preserveAtomicTokens && isInlineTokenPointerTarget(event.target)) {
          stopInlineTextEditorDoubleClick(event)
          return
        }
        onDoubleClick?.(event)
        if (!event.isPropagationStopped()) event.stopPropagation()
      }}
    />
  )
}
