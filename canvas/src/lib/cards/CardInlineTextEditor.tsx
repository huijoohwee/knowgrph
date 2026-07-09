import React from 'react'
import { useWorkspaceDataViewFloatingDensity } from '@/features/markdown-workspace/main/viewer/workspaceDataViewFloatingStore'
import { CardMarkdownPreview } from '@/lib/cards/CardMarkdownPreview'
import { CardInlineTextCommandMenus, type CardInlineTextCommandMenuMode } from '@/lib/cards/CardInlineTextCommandMenus'
import { hasCardMarkdownPreviewSyntax } from '@/lib/cards/cardMarkdownPreviewUtils'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { readDataViewFieldLineClassName } from '@/lib/ui/dataViewDensity'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { shouldOpenMarkdownViewerInlineEditorFromReadClick } from '@/lib/markdown-core/ui/markdownInlineEditActivation'
import { PanelTextInput, PanelTextarea } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useCardInlineTextSelectedDisplayCommand } from '@/lib/cards/cardInlineTextSelectedDisplayCommand'
import type { InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'
import {
  buildCardInlineTextMediaEmbed,
  clearActiveCardInlineTextExternalCommandTarget,
  setActiveCardInlineTextExternalCommandTarget,
  setCardInlineTextExternalCommandElementTarget,
  type CardInlineTextExternalMediaCandidate,
} from '@/lib/cards/cardInlineTextExternalCommands'
import {
  focusCardInlineEditorInputSelectionSoon,
  normalizeCardInlineEditorValue,
  readCardInlineEditorInputSelection,
  replaceCardInlineEditorTextRange,
} from '@/lib/cards/cardInlineTextEditorUtils'
import { readInlineCommandMenuSigilFromInsertedText, readInlineCommandMenuSigilFromKeyEvent } from '@/lib/command-menu/inlineCommandMenuTrigger'

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
  mediaCommandMode?: 'inline' | 'external'
  openOnPointerDown?: boolean
  rows?: number
  showCommandLaunchers?: boolean
  stopActivationPropagation?: boolean
  onCommit?: (nextValue: string) => void
  onEditingChange?: (editing: boolean) => void
  onMediaCommandSelect?: (candidate: InlineMediaCommandCandidate) => void
}

const normalizeEditorValue = normalizeCardInlineEditorValue
const CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE = 'data-kg-card-inline-edit-input'
const CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE = 'data-kg-card-inline-command-root'
const CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE = 'data-kg-card-inline-command-menu'
const readInputSelection = readCardInlineEditorInputSelection
const focusInputSelectionSoon = focusCardInlineEditorInputSelectionSoon
const replaceTextRange = replaceCardInlineEditorTextRange

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

const isCardInlineTextFieldLineClassToken = (token: string): boolean =>
  /^(block|break-words|truncate|whitespace-nowrap|whitespace-pre-wrap)$/.test(token) || token.startsWith('line-clamp-')

const normalizeCardInlineTextDisplayClassName = (className: string, multiline: boolean): string =>
  multiline && !/\boverflow-auto\b/.test(className)
    ? className
        .split(/\s+/)
        .filter(token => token && !isCardInlineTextFieldLineClassToken(token))
        .join(' ')
    : className

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
    mediaCommandMode = 'inline',
    openOnPointerDown = false,
    rows,
    showCommandLaunchers = true,
    stopActivationPropagation = true,
    onCommit,
    onEditingChange,
    onMediaCommandSelect,
  } = props
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(() => normalizeEditorValue(value))
  const [commandMode, setCommandMode] = React.useState<CardInlineTextCommandMenuMode | null>(null)
  const [commandQuery, setCommandQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const commandRootRef = React.useRef<HTMLElement | null>(null)
  const displayRef = React.useRef<HTMLElement | null>(null)
  const lastEditRequestKeyRef = React.useRef<string | number | null>(null)
  const lastEditingRef = React.useRef(editing)
  const lastCommandPersistedDraftRef = React.useRef('')
  const commandSelectionRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 })
  const externalCommandStateRef = React.useRef({
    canEdit,
    draft,
    editing,
    multiline,
    onCommit,
    persistCommandDraft: (_nextValue: string) => void 0,
    value,
  })
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
    input.focus()
    if ('selectionStart' in input && typeof input.value === 'string') {
      const fallbackEnd = input.value.length
      const selection = commandMode ? commandSelectionRef.current : { start: 0, end: fallbackEnd }
      input.setSelectionRange(selection.start, selection.end)
    }
  }, [commandMode, editing])

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

  externalCommandStateRef.current = {
    canEdit,
    draft,
    editing,
    multiline,
    onCommit,
    persistCommandDraft,
    value,
  }

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
  const densityOwnedDisplayClassName = normalizeCardInlineTextDisplayClassName(displayClassName || '', multiline)
  const displayLineClassName = multiline && !densityOwnedDisplayClassName.includes('overflow-auto') ? readDataViewFieldLineClassName(editorDensity.fieldLineMode) : ''

  const openCommandMenuAtSelection = React.useCallback((mode: CardInlineTextCommandMenuMode, selection: { start: number; end: number }, seedQuery: string = '') => {
    commandSelectionRef.current = selection
    setCommandMode(mode)
    setCommandQuery(seedQuery)
  }, [])
  const openCommandMenu = React.useCallback((mode: CardInlineTextCommandMenuMode, seedQuery: string = '') => {
    openCommandMenuAtSelection(mode, readInputSelection(inputRef.current), seedQuery)
  }, [openCommandMenuAtSelection])
  const openCommandMenuForSigil = React.useCallback((sigil: '/' | '@' | '#') => {
    openCommandMenu(sigil === '/' ? 'slash' : sigil === '@' ? 'variable' : 'keyword')
  }, [openCommandMenu])
  const openCommandMenuForSigilAtSelection = React.useCallback((sigil: '/' | '@' | '#', selection: { start: number; end: number }) => {
    openCommandMenuAtSelection(sigil === '/' ? 'slash' : sigil === '@' ? 'variable' : 'keyword', selection)
  }, [openCommandMenuAtSelection])
  const openDisplayCommandMenuForSigil = React.useCallback((sigil: '/' | '@' | '#') => {
    if (!canEdit || !enableMarkdownCommandMenus) return false
    const nextDraft = normalizeEditorValue(value)
    const cursor = nextDraft.length
    setDraft(nextDraft)
    setEditing(true)
    openCommandMenuForSigilAtSelection(sigil, { start: cursor, end: cursor })
    return true
  }, [canEdit, enableMarkdownCommandMenus, openCommandMenuForSigilAtSelection, value])

  const closeCommandMenu = React.useCallback(() => {
    setCommandMode(null)
    setCommandQuery('')
    focusInputSelectionSoon(inputRef.current, commandSelectionRef.current.end)
  }, [])

  const buildExternalCommandTarget = React.useCallback(() => {
    const targetId = id || ariaLabel
    const insertText = (replacement: string) => {
      const latest = externalCommandStateRef.current
      if (!latest.canEdit || latest.multiline !== true) return false
      if (latest.editing && inputRef.current) {
        const input = inputRef.current
        const text = normalizeEditorValue(input.value ?? latest.draft)
        const selection = readInputSelection(input)
        const lineStartIdx = text.lastIndexOf('\n', Math.max(0, selection.end) - 1) + 1
        const preceding = text.slice(lineStartIdx, Math.max(lineStartIdx, Math.min(text.length, selection.end)))
        const triggerMatch = /[\/#@][A-Za-z0-9_.-]{0,96}$/.exec(preceding)
        const rangeStart = selection.start !== selection.end
          ? selection.start
          : triggerMatch
            ? selection.end - triggerMatch[0].length
            : selection.end
        const { text: next, cursor } = replaceTextRange({
          text,
          start: rangeStart,
          end: selection.start !== selection.end ? selection.end : selection.end,
          replacement,
        })
        setDraft(next)
        latest.persistCommandDraft(next)
        focusInputSelectionSoon(input, cursor)
        return true
      }
      const current = normalizeEditorValue(latest.editing ? latest.draft : latest.value)
      const separator = current ? (current.endsWith('\n') ? '' : '\n') : ''
      const next = `${current}${separator}${replacement}`
      setDraft(next)
      lastCommandPersistedDraftRef.current = next
      latest.onCommit?.(next)
      return true
    }
    return {
      id: targetId,
      insertText,
      insertMedia: (candidate: CardInlineTextExternalMediaCandidate) => {
        const replacement = buildCardInlineTextMediaEmbed(candidate)
        return insertText(replacement)
      },
    }
  }, [ariaLabel, id])

  const registerExternalCommandElementTarget = React.useCallback(() => {
    setCardInlineTextExternalCommandElementTarget(displayRef.current, buildExternalCommandTarget())
  }, [buildExternalCommandTarget])

  const activateExternalCommandTarget = React.useCallback(() => {
    const target = buildExternalCommandTarget()
    setActiveCardInlineTextExternalCommandTarget(target)
    setCardInlineTextExternalCommandElementTarget(displayRef.current, target)
  }, [buildExternalCommandTarget])

  React.useEffect(() => {
    return () => {
      setCardInlineTextExternalCommandElementTarget(displayRef.current, null)
      clearActiveCardInlineTextExternalCommandTarget(id || ariaLabel)
    }
  }, [ariaLabel, id])

  React.useEffect(() => {
    if (editing || !canEdit) return
    registerExternalCommandElementTarget()
  }, [canEdit, editing, registerExternalCommandElementTarget, value])
  useCardInlineTextSelectedDisplayCommand({ canEdit, displayRef, editing, enabled: enableMarkdownCommandMenus, onActivate: activateExternalCommandTarget, openCommandMenuForSigil: openDisplayCommandMenuForSigil, stopPropagation: stopActivationPropagation })

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
        const nextValue = event.currentTarget.value
        if (enableMarkdownCommandMenus && !commandMode) {
          const selection = readInputSelection(event.currentTarget)
          const insertedIndex = selection.end - 1
          const insertedText = nextValue.length === draft.length + 1 && insertedIndex >= 0
            ? nextValue.slice(insertedIndex, selection.end)
            : ''
          const sigil = readInlineCommandMenuSigilFromInsertedText(insertedText)
          if (sigil) {
            const nextSelection = { start: insertedIndex, end: insertedIndex }
            const cleaned = `${nextValue.slice(0, insertedIndex)}${nextValue.slice(selection.end)}`
            event.currentTarget.value = cleaned
            setDraft(cleaned)
            openCommandMenuForSigilAtSelection(sigil, nextSelection)
            focusInputSelectionSoon(event.currentTarget, nextSelection.start)
            return
          }
        }
        setDraft(event.currentTarget.value)
      },
      onBeforeInput: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!enableMarkdownCommandMenus || commandMode) return
        const nativeEvent = event.nativeEvent as InputEvent
        if (nativeEvent.inputType !== 'insertText') return
        const sigil = readInlineCommandMenuSigilFromInsertedText(nativeEvent.data)
        if (!sigil) return
        event.preventDefault()
        openCommandMenuForSigil(sigil)
      },
      onFocus: () => {
        activateExternalCommandTarget()
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
        const commandSigil = enableMarkdownCommandMenus ? readInlineCommandMenuSigilFromKeyEvent(event.nativeEvent) : null
        if (commandSigil) {
          event.preventDefault()
          openCommandMenuForSigil(commandSigil)
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
            mediaCommandMode={mediaCommandMode}
            openCommandMenu={openCommandMenu}
            showLaunchers={showCommandLaunchers}
            closeCommandMenu={closeCommandMenu}
            setCommandQuery={setCommandQuery}
            setCommandMode={setCommandMode}
            setDraft={setDraft}
            onCommandDraftChange={persistCommandDraft}
            onCommandDraftApplied={finishCommandDraft}
            onMediaCommandSelect={onMediaCommandSelect}
          />
        ) : null}
      </section>
    )
  }

  return (
    <section
      ref={displayRef}
      id={id}
      className={[
        densityOwnedDisplayClassName,
        displayLineClassName,
        canEdit ? 'cursor-text' : '',
        showPlaceholder ? emptyClassName || `${UI_THEME_TOKENS.text.tertiary} italic` : '',
      ].join(' ').trim()}
      title={showPlaceholder ? placeholder : displayValue}
      aria-label={ariaLabel}
      data-kg-card-inline-edit="1"
      data-kg-card-inline-edit-activation={editActivation}
      data-kg-card-inline-command-display={enableMarkdownCommandMenus ? '1' : undefined}
      tabIndex={canEdit && enableMarkdownCommandMenus ? 0 : undefined}
      onKeyDown={event => {
        if (!canEdit) return
        const sigil = enableMarkdownCommandMenus ? readInlineCommandMenuSigilFromKeyEvent(event.nativeEvent) : null
        if (!sigil) return
        event.preventDefault()
        if (stopActivationPropagation) event.stopPropagation()
        activateExternalCommandTarget()
        openDisplayCommandMenuForSigil(sigil)
      }}
      onDoubleClick={event => {
        if (editActivation !== 'doubleClick') return
        openEditorFromDisplayEvent(event)
      }}
      onPointerDown={event => {
        if (!canEdit) return
        activateExternalCommandTarget()
        const useMarkdownViewerActivation = showMarkdownPreview && shouldOpenMarkdownViewerInlineEditorFromReadClick({ eventDetail: event.detail })
        if (!useMarkdownViewerActivation && shouldIgnoreInlineEditTarget(event.target)) return
        if (editActivation !== 'click' && !useMarkdownViewerActivation && event.detail < 2) return
        if (openOnPointerDown && editActivation === 'click') {
          openEditorFromDisplayEvent(event)
          return
        }
        if (stopActivationPropagation) {
          event.stopPropagation()
        }
      }}
      onPointerUp={() => {
        if (!canEdit) return
        activateExternalCommandTarget()
      }}
      onMouseDown={event => {
        if (!canEdit) return
        activateExternalCommandTarget()
        const useMarkdownViewerActivation = showMarkdownPreview && shouldOpenMarkdownViewerInlineEditorFromReadClick({ eventDetail: event.detail })
        if (!useMarkdownViewerActivation && shouldIgnoreInlineEditTarget(event.target)) return
        if (editActivation !== 'click' && !useMarkdownViewerActivation && event.detail < 2) return
        if (stopActivationPropagation) {
          event.stopPropagation()
        }
      }}
      onMouseUp={() => {
        if (!canEdit) return
        activateExternalCommandTarget()
      }}
      onClick={event => {
        if (!canEdit) return
        activateExternalCommandTarget()
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
