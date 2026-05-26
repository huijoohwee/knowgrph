import React from 'react'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type CardInlineTextEditorProps = {
  value: string
  ariaLabel: string
  placeholder: string
  canEdit?: boolean
  editRequestKey?: string | number | null
  multiline?: boolean
  displayClassName?: string
  editorClassName?: string
  emptyClassName?: string
  rows?: number
  onCommit?: (nextValue: string) => void
  onEditingChange?: (editing: boolean) => void
}

const normalizeEditorValue = (value: string): string => String(value ?? '').replace(/\r/g, '')

export const CardInlineTextEditor = React.memo(function CardInlineTextEditor(props: CardInlineTextEditorProps) {
  const {
    value,
    ariaLabel,
    placeholder,
    canEdit = false,
    editRequestKey = null,
    multiline = false,
    displayClassName,
    editorClassName,
    emptyClassName,
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

  const displayValue = readMarkdownSigilDisplayText(value)
  const showPlaceholder = !displayValue

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
      onDoubleClick={event => {
        if (!canEdit) return
        event.preventDefault()
        event.stopPropagation()
        setEditing(true)
      }}
      onMouseDown={event => {
        if (!canEdit) return
        if (event.detail < 2) return
        event.stopPropagation()
      }}
      onClick={event => {
        if (!canEdit) return
        if (editing) event.stopPropagation()
      }}
      onDragStart={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {showPlaceholder ? placeholder : renderMarkdownSigilInlineText(value)}
    </div>
  )
})
