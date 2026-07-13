import React from 'react'
import {
  MarkdownInlineTextEditSurface,
  readMarkdownInlineTextEditDraft,
} from '@/lib/markdown-core/ui/MarkdownInlineTextEditSurface'
import type { MarkdownContentEditablePoint } from '@/lib/markdown-core/ui/markdownContentEditableSurface'
import { readInlineCommandMenuSigilFromInsertedText, readInlineCommandMenuSigilFromKeyEvent } from '@/lib/command-menu/inlineCommandMenuTrigger'

type ChatSelectionRange = { start: number; end: number }

export function FloatingPanelChatContentEditableSurface(props: {
  ariaLabel: string
  className: string
  commandMode: unknown
  disabled: boolean
  editorRef: React.RefObject<HTMLElement | null>
  inputProxyRef: React.RefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  onModEnter: () => void
  onOpenCommandMenuForSigil: (sigil: '/' | '@' | '#', selection: ChatSelectionRange) => void
  onSelectionChange: (selection: ChatSelectionRange, value: string) => void
  placeholder: string
  value: string
}) {
  const initialSelectionPointRef = React.useRef<MarkdownContentEditablePoint | null>(null)
  return (
    <section
      className="relative h-full min-h-0 w-full"
      data-kg-chat-contenteditable-surface="1"
      aria-disabled={props.disabled ? 'true' : undefined}
      onBeforeInputCapture={event => { if (props.disabled) event.preventDefault() }}
      onKeyDownCapture={event => {
        if (props.disabled) {
          event.preventDefault()
          return
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          props.onModEnter()
        }
      }}
    >
      <MarkdownInlineTextEditSurface
        value={props.value}
        ariaLabel={props.ariaLabel}
        placeholder={props.placeholder}
        className={props.className}
        commandMode={props.commandMode}
        enableMarkdownCommandMenus
        editorRef={props.editorRef}
        inputProxyRef={props.inputProxyRef}
        initialSelectionPointRef={initialSelectionPointRef}
        inlineChipDensity="compact"
        multiline
        projectedMediaAttachments={null}
        isCommandMenuTarget={target => target instanceof Element && !!target.closest('[role="menu"],[role="menuitem"]')}
        onCancel={() => undefined}
        onCommit={() => undefined}
        onDraftChange={props.onChange}
        onFocus={() => undefined}
        onSelectionChange={selection => props.onSelectionChange(selection, readMarkdownInlineTextEditDraft(props.editorRef.current))}
        onOpenCommandMenuForSigilAtSelection={props.onOpenCommandMenuForSigil}
        readCommandSigilFromKeyEvent={readInlineCommandMenuSigilFromKeyEvent}
        readCommandSigilFromInsertedText={readInlineCommandMenuSigilFromInsertedText}
        cardInlineEditInputAttribute="data-kg-chat-input"
      />
    </section>
  )
}
