import React from 'react'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { CardMarkdownPreview } from '@/lib/cards/CardMarkdownPreview'
import { hasCardMarkdownPreviewSyntax } from '@/lib/cards/cardMarkdownPreviewUtils'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type CardInlineTextEditActivation = 'doubleClick' | 'click'

type CardInlineTextEditorProps = {
  value: string
  ariaLabel: string
  placeholder: string
  canEdit?: boolean
  editActivation?: CardInlineTextEditActivation
  editRequestKey?: string | number | null
  multiline?: boolean
  displayClassName?: string
  editorClassName?: string
  emptyClassName?: string
  markdownPreview?: boolean | 'auto'
  rows?: number
  onCommit?: (nextValue: string) => void
  onEditingChange?: (editing: boolean) => void
}

const normalizeEditorValue = (value: string): string => String(value ?? '').replace(/\r/g, '')

const shouldIgnoreInlineEditTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  return !!target.closest([
    'button',
    'select',
    'input',
    'textarea',
    'a',
    '[role="menu"]',
    '[role="menuitem"]',
    '[contenteditable="true"]',
    '[data-kg-card-media-interactive="1"]',
  ].join(','))
}

export const CardInlineTextEditor = React.memo(function CardInlineTextEditor(props: CardInlineTextEditorProps) {
  const {
    value,
    ariaLabel,
    placeholder,
    canEdit = false,
    editActivation = 'doubleClick',
    editRequestKey = null,
    multiline = false,
    displayClassName,
    editorClassName,
    emptyClassName,
    markdownPreview = false,
    rows,
    onCommit,
    onEditingChange,
  } = props
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(() => normalizeEditorValue(value))
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const lastEditRequestKeyRef = React.useRef<string | number | null>(null)
  const lastEditingRef = React.useRef(editing)

  React.useEffect(() => {
    if (editing) return
    setDraft(normalizeEditorValue(value))
  }, [editing, value])

  React.useEffect(() => {
    if (!editing) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    if ('selectionStart' in input && typeof input.value === 'string') {
      const end = input.value.length
      input.setSelectionRange(0, end)
    }
  }, [editing])

  React.useEffect(() => {
    if (editRequestKey == null) {
      lastEditRequestKeyRef.current = null
      return
    }
    if (!canEdit) return
    if (Object.is(lastEditRequestKeyRef.current, editRequestKey)) return
    lastEditRequestKeyRef.current = editRequestKey
    setDraft(normalizeEditorValue(value))
    setEditing(true)
  }, [canEdit, editRequestKey, value])

  React.useEffect(() => {
    if (lastEditingRef.current === editing) return
    lastEditingRef.current = editing
    onEditingChange?.(editing)
  }, [editing, onEditingChange])

  const commit = React.useCallback(() => {
    const next = normalizeEditorValue(draft)
    setEditing(false)
    if (next === normalizeEditorValue(value)) return
    onCommit?.(next)
  }, [draft, onCommit, value])

  const cancel = React.useCallback(() => {
    setDraft(normalizeEditorValue(value))
    setEditing(false)
  }, [value])

  const openEditorFromDisplayEvent = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit) return false
    if (shouldIgnoreInlineEditTarget(event.target)) return false
    event.preventDefault()
    event.stopPropagation()
    setDraft(normalizeEditorValue(value))
    setEditing(true)
    return true
  }, [canEdit, value])

  const displayValue = readMarkdownSigilDisplayText(value)
  const showPlaceholder = !displayValue
  const showMarkdownPreview =
    !showPlaceholder
    && (markdownPreview === true || (markdownPreview === 'auto' && hasCardMarkdownPreviewSyntax(value)))

  if (editing && canEdit) {
    return (
      <PlainTextInputEditor
        ref={inputRef}
        value={draft}
        onChange={setDraft}
        onBlur={() => {
          commit()
        }}
        onKeyDown={event => {
          event.stopPropagation()
          if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
            return
          }
          if (!multiline && event.key === 'Enter') {
            event.preventDefault()
            commit()
            return
          }
          if (multiline && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            commit()
          }
        }}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        multiline={multiline}
        rows={rows ?? (multiline ? 3 : undefined)}
        spellCheck
        className={editorClassName}
        onDoubleClick={event => {
          event.stopPropagation()
        }}
      />
    )
  }

  return (
    <div
      className={[
        displayClassName || '',
        canEdit ? 'cursor-text' : '',
        showPlaceholder ? emptyClassName || `${UI_THEME_TOKENS.text.tertiary} italic` : '',
      ].join(' ').trim()}
      title={showPlaceholder ? placeholder : displayValue}
      data-kg-card-inline-edit="1"
      data-kg-card-inline-edit-activation={editActivation}
      onDoubleClick={event => {
        if (editActivation !== 'doubleClick') return
        openEditorFromDisplayEvent(event)
      }}
      onMouseDown={event => {
        if (!canEdit) return
        if (shouldIgnoreInlineEditTarget(event.target)) return
        if (editActivation !== 'click' && event.detail < 2) return
        event.stopPropagation()
      }}
      onClick={event => {
        if (!canEdit) return
        if (editActivation !== 'click') return
        openEditorFromDisplayEvent(event)
      }}
      onDragStart={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {showPlaceholder ? placeholder : showMarkdownPreview ? (
        <CardMarkdownPreview
          markdownText={value}
          activeDocumentPath="/__card_inline_text_editor/preview.md"
          className="min-w-0"
          uiPanelTextFontClass="font-sans"
          uiPanelMonospaceTextClass="font-mono text-xs"
        />
      ) : renderMarkdownSigilInlineText(value)}
    </div>
  )
})
