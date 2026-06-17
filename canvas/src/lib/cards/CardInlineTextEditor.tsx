import React from 'react'
import { useWorkspaceDataViewFloatingDensity } from '@/features/markdown-workspace/main/viewer/workspaceDataViewFloatingStore'
import { CardMarkdownPreview } from '@/lib/cards/CardMarkdownPreview'
import {
  CardInlineTextCommandMenus,
  type CardInlineTextCommandMenuMode,
} from '@/lib/cards/CardInlineTextCommandMenus'
import { hasCardMarkdownPreviewSyntax } from '@/lib/cards/cardMarkdownPreviewUtils'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { readDataViewFieldLineClassName } from '@/lib/ui/dataViewDensity'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { shouldOpenMarkdownViewerInlineEditorFromReadClick } from '@/lib/markdown-core/ui/markdownInlineEditActivation'
import { PanelTextInput, PanelTextarea } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type CardInlineTextEditActivation = 'doubleClick' | 'click'

type CardInlineTextEditorProps = {
  id?: string
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
  markdownCommandMenus?: boolean
  markdownCommandContextText?: string
  rows?: number
  stopActivationPropagation?: boolean
  onCommit?: (nextValue: string) => void
  onEditingChange?: (editing: boolean) => void
}

const normalizeEditorValue = (value: string): string => String(value ?? '').replace(/\r/g, '')
const CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE = 'data-kg-card-inline-edit-input'
const CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE = 'data-kg-card-inline-command-root'
const CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE = 'data-kg-card-inline-command-menu'

function readInputSelection(input: HTMLInputElement | HTMLTextAreaElement | null): { start: number; end: number } {
  if (!input) return { start: 0, end: 0 }
  const length = String(input.value || '').length
  const rawStart = typeof input.selectionStart === 'number' ? input.selectionStart : length
  const rawEnd = typeof input.selectionEnd === 'number' ? input.selectionEnd : rawStart
  const start = Math.max(0, Math.min(length, rawStart))
  const end = Math.max(0, Math.min(length, rawEnd))
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

function focusInputSelectionSoon(input: HTMLInputElement | HTMLTextAreaElement | null, start: number, end: number = start) {
  if (!input) return
  window.requestAnimationFrame(() => {
    try {
      input.focus({ preventScroll: true })
      input.setSelectionRange(start, end)
    } catch {
      void 0
    }
  })
}

export function commitActiveCardInlineTextEditor(ownerDocument?: Document | null): boolean {
  const doc = ownerDocument || (typeof document !== 'undefined' ? document : null)
  const active = doc?.activeElement
  if (!active) return false
  const elementCtor = active.ownerDocument?.defaultView?.HTMLElement || (typeof HTMLElement !== 'undefined' ? HTMLElement : null)
  if (!elementCtor || !(active instanceof elementCtor)) return false
  if (!active.matches(`input[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}], textarea[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}]`)) {
    const commandRoot = active.closest(`[${CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE}]`)
    const commandInput = commandRoot?.querySelector(`input[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}], textarea[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}]`) as HTMLElement | null
    if (!commandInput) return false
    commandInput.blur()
    return true
  }
  active.blur()
  return true
}

const isElementEventTarget = (target: EventTarget | null): target is Element => {
  const elementCtor = target && 'ownerDocument' in target
    ? (target as { ownerDocument?: Document | null }).ownerDocument?.defaultView?.Element
    : typeof Element !== 'undefined'
      ? Element
      : null
  return !!elementCtor && target instanceof elementCtor
}

const shouldIgnoreInlineEditTarget = (target: EventTarget | null): boolean => {
  if (!isElementEventTarget(target)) return false
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
    id,
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
    markdownCommandMenus = true,
    markdownCommandContextText = '',
    rows,
    stopActivationPropagation = true,
    onCommit,
    onEditingChange,
  } = props
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(() => normalizeEditorValue(value))
  const [commandMode, setCommandMode] = React.useState<CardInlineTextCommandMenuMode | null>(null)
  const [commandQuery, setCommandQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const commandRootRef = React.useRef<HTMLElement | null>(null)
  const lastEditRequestKeyRef = React.useRef<string | number | null>(null)
  const lastEditingRef = React.useRef(editing)
  const lastCommandPersistedDraftRef = React.useRef('')
  const commandSelectionRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 })
  const editorDensity = useWorkspaceDataViewFloatingDensity()

  const isCommandMenuTarget = React.useCallback((target: EventTarget | null): boolean => {
    if (!isElementEventTarget(target)) return false
    return !!commandRootRef.current?.contains(target) || !!target.closest(`[${CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE}]`)
  }, [])

  React.useEffect(() => {
    if (editing) return
    setDraft(normalizeEditorValue(value))
    if (lastCommandPersistedDraftRef.current === normalizeEditorValue(value)) {
      lastCommandPersistedDraftRef.current = ''
    }
  }, [editing, value])

  React.useEffect(() => {
    if (!editing) return
    const input = inputRef.current
    if (!input) return
    const ownerWindow = input.ownerDocument?.defaultView as (Window & { HTMLElement?: { prototype?: { attachEvent?: unknown; detachEvent?: unknown } } }) | null
    const elementProto = ownerWindow?.HTMLElement?.prototype
    if (elementProto && typeof elementProto.attachEvent !== 'function') elementProto.attachEvent = () => void 0
    if (elementProto && typeof elementProto.detachEvent !== 'function') elementProto.detachEvent = () => void 0
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
    const next = normalizeEditorValue(inputRef.current?.value ?? draft)
    setEditing(false)
    setCommandMode(null)
    setCommandQuery('')
    if (next === normalizeEditorValue(value)) return
    if (next === lastCommandPersistedDraftRef.current) return
    onCommit?.(next)
  }, [draft, onCommit, value])

  React.useEffect(() => {
    if (!editing || !commandMode) return
    const ownerDocument = inputRef.current?.ownerDocument || (typeof document !== 'undefined' ? document : null)
    if (!ownerDocument) return
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (isCommandMenuTarget(event.target)) return
      commit()
    }
    ownerDocument.addEventListener('pointerdown', onDocumentPointerDown, true)
    return () => {
      ownerDocument.removeEventListener('pointerdown', onDocumentPointerDown, true)
    }
  }, [commandMode, commit, editing, isCommandMenuTarget])

  const persistCommandDraft = React.useCallback((nextValue: string) => {
    const next = normalizeEditorValue(nextValue)
    const input = inputRef.current
    if (input && input.value !== next) input.value = next
    if (next === normalizeEditorValue(value)) return
    if (next === lastCommandPersistedDraftRef.current) return
    lastCommandPersistedDraftRef.current = next
    onCommit?.(next)
  }, [onCommit, value])

  const finishCommandDraft = React.useCallback((nextValue: string) => {
    persistCommandDraft(nextValue)
    setEditing(false)
    setCommandMode(null)
    setCommandQuery('')
  }, [persistCommandDraft])

  const cancel = React.useCallback(() => {
    setDraft(normalizeEditorValue(value))
    setEditing(false)
    setCommandMode(null)
    setCommandQuery('')
  }, [value])

  const openEditorFromDisplayEvent = React.useCallback((event: React.MouseEvent<HTMLElement>, options?: { useMarkdownViewerActivation?: boolean }) => {
    if (!canEdit) return false
    if (!options?.useMarkdownViewerActivation && shouldIgnoreInlineEditTarget(event.target)) return false
    event.preventDefault()
    if (stopActivationPropagation) {
      event.stopPropagation()
    }
    setDraft(normalizeEditorValue(value))
    setEditing(true)
    return true
  }, [canEdit, stopActivationPropagation, value])

  const displayValue = readMarkdownSigilDisplayText(value)
  const showPlaceholder = !displayValue
  const showMarkdownPreview =
    !showPlaceholder
    && (markdownPreview === true || (markdownPreview === 'auto' && hasCardMarkdownPreviewSyntax(value)))
  const enableMarkdownCommandMenus = markdownCommandMenus !== false && multiline === true

  const openCommandMenu = React.useCallback((mode: CardInlineTextCommandMenuMode, seedQuery: string = '') => {
    commandSelectionRef.current = readInputSelection(inputRef.current)
    setCommandMode(mode)
    setCommandQuery(seedQuery)
  }, [])

  const closeCommandMenu = React.useCallback(() => {
    setCommandMode(null)
    setCommandQuery('')
    focusInputSelectionSoon(inputRef.current, commandSelectionRef.current.end)
  }, [])

  if (editing && canEdit) {
    const commonEditorProps = {
      id,
      value: draft,
      placeholder,
      spellCheck: true,
      'aria-label': ariaLabel,
      autoComplete: 'off',
      autoCorrect: 'off',
      autoCapitalize: 'off',
      className: editorClassName,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setDraft(event.currentTarget.value)
      },
      onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const relatedTarget = event.relatedTarget
        if (isCommandMenuTarget(relatedTarget)) return
        if (commandMode) return
        commit()
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          if (commandMode) {
            event.preventDefault()
            closeCommandMenu()
            return
          }
          event.preventDefault()
          cancel()
          return
        }
        if (enableMarkdownCommandMenus && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key === '/' || event.key === '@' || event.key === '#')) {
          event.preventDefault()
          openCommandMenu(event.key === '/' ? 'slash' : event.key === '@' ? 'variable' : 'keyword')
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
      },
      onDoubleClick: (event: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        event.stopPropagation()
      },
      [CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE]: '1',
    }
    return (
      <section
        ref={commandRootRef}
        className="relative h-full min-h-0 w-full"
        {...{ [CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE]: '1' }}
      >
        {multiline ? (
          <PanelTextarea
            {...commonEditorProps}
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            rows={rows ?? 3}
            rowHeightPreset={editorDensity.rowHeightPreset}
            fieldLineMode={editorDensity.fieldLineMode}
          />
        ) : (
          <PanelTextInput
            {...commonEditorProps}
            ref={inputRef as React.Ref<HTMLInputElement>}
            type="text"
            density={editorDensity.rowHeightPreset}
          />
        )}
        {enableMarkdownCommandMenus ? (
          <CardInlineTextCommandMenus
            commandMode={commandMode}
            commandQuery={commandQuery}
            commandSelectionRef={commandSelectionRef}
            commandContextText={markdownCommandContextText}
            draft={draft}
            inputRef={inputRef}
            openCommandMenu={openCommandMenu}
            closeCommandMenu={closeCommandMenu}
            setCommandQuery={setCommandQuery}
            setCommandMode={setCommandMode}
            setDraft={setDraft}
            onCommandDraftChange={persistCommandDraft}
            onCommandDraftApplied={finishCommandDraft}
          />
        ) : null}
      </section>
    )
  }

  return (
    <section
      id={id}
      className={[
        displayClassName || '',
        multiline ? readDataViewFieldLineClassName(editorDensity.fieldLineMode) : '',
        canEdit ? 'cursor-text' : '',
        showPlaceholder ? emptyClassName || `${UI_THEME_TOKENS.text.tertiary} italic` : '',
      ].join(' ').trim()}
      title={showPlaceholder ? placeholder : displayValue}
      aria-label={ariaLabel}
      data-kg-card-inline-edit="1"
      data-kg-card-inline-edit-activation={editActivation}
      onDoubleClick={event => {
        if (editActivation !== 'doubleClick') return
        openEditorFromDisplayEvent(event)
      }}
      onPointerDown={event => {
        if (!canEdit) return
        const useMarkdownViewerActivation = showMarkdownPreview && shouldOpenMarkdownViewerInlineEditorFromReadClick({ eventDetail: event.detail })
        if (!useMarkdownViewerActivation && shouldIgnoreInlineEditTarget(event.target)) return
        if (editActivation !== 'click' && !useMarkdownViewerActivation && event.detail < 2) return
        if (stopActivationPropagation) {
          event.stopPropagation()
        }
      }}
      onMouseDown={event => {
        if (!canEdit) return
        const useMarkdownViewerActivation = showMarkdownPreview && shouldOpenMarkdownViewerInlineEditorFromReadClick({ eventDetail: event.detail })
        if (!useMarkdownViewerActivation && shouldIgnoreInlineEditTarget(event.target)) return
        if (editActivation !== 'click' && !useMarkdownViewerActivation && event.detail < 2) return
        if (stopActivationPropagation) {
          event.stopPropagation()
        }
      }}
      onClick={event => {
        if (!canEdit) return
        const useMarkdownViewerActivation = showMarkdownPreview && shouldOpenMarkdownViewerInlineEditorFromReadClick({ eventDetail: event.detail })
        if (editActivation !== 'click') {
          if (!useMarkdownViewerActivation) return
        }
        openEditorFromDisplayEvent(event, { useMarkdownViewerActivation })
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
    </section>
  )
})
