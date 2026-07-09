import React from 'react'
import { useWorkspaceDataViewFloatingDensity } from '@/features/markdown-workspace/main/viewer/workspaceDataViewFloatingStore'
import { CardInlineTextEditingSurface } from '@/lib/cards/CardInlineTextEditingSurface'
import { CardInlineTextDisplaySurface } from '@/lib/cards/CardInlineTextDisplaySurface'
import {
  CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE,
  CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE,
  CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE,
  EDITOR_PROJECTED_MEDIA_ATTACHMENTS,
  isElementEventTarget,
  normalizeCardInlineTextDisplayClassName,
  normalizeCommittedCardInlineEditorValue,
  readCardInlineTextMediaCandidateKey,
  shouldIgnoreInlineEditTarget,
  type CardInlineTextCommandExternalState,
  type CardInlineTextEditorProps,
} from '@/lib/cards/CardInlineTextEditorSupport'
import { CardInlineTextCommandMenus, type CardInlineTextCommandMenuMode } from '@/lib/cards/CardInlineTextCommandMenus'
import { hasCardMarkdownPreviewSyntax } from '@/lib/cards/cardMarkdownPreviewUtils'
import { CardInlineTextProjectedMediaChip } from '@/lib/cards/CardInlineTextProjectedMediaChip'
import { focusCardInlineTextViewerSelectionSoon } from '@/lib/cards/CardInlineTextViewerEditSurface'
import { readMarkdownSigilDisplayText } from '@/lib/markdown/markdownSigil'
import { readDataViewFieldLineClassName, readDataViewMultiLineControlClassName } from '@/lib/ui/dataViewDensity'
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
import {
  buildFloatingPanelChatComposerDisplayText,
  buildFloatingPanelChatComposerOverlayParts,
  collectTextareaInvocationMediaAttachmentCandidateChips,
  isFloatingPanelChatComposerProjectedCaretInsideChip,
  mapFloatingPanelChatComposerDisplayIndexToRawIndex,
  mapFloatingPanelChatComposerRawIndexToDisplayIndex,
  readTextareaInvocationMediaReferenceKey,
  readTextareaInvocationProjectionTextClassName,
  resolveFloatingPanelChatComposerRawText,
  type TextareaInvocationProjectedMediaChip,
} from '@/lib/ui/textareaInvocationProjection'
import { cn } from '@/lib/utils'
const normalizeEditorValue = normalizeCardInlineEditorValue
const normalizeCommittedEditorValue = normalizeCommittedCardInlineEditorValue
const readInputSelection = readCardInlineEditorInputSelection
const focusInputSelectionSoon = focusCardInlineEditorInputSelectionSoon
const replaceTextRange = replaceCardInlineEditorTextRange
export function commitActiveCardInlineTextEditor(ownerDocument?: Document | null): boolean {
  const doc = ownerDocument || (typeof document !== 'undefined' ? document : null)
  const active = doc?.activeElement
  if (!active) return false
  const elementCtor = active.ownerDocument?.defaultView?.HTMLElement || (typeof HTMLElement !== 'undefined' ? HTMLElement : null)
  if (!elementCtor || !(active instanceof elementCtor)) return false
  if (!active.matches(`input[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}], textarea[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}], [contenteditable="true"][${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}]`)) {
    const commandRoot = active.closest(`[${CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE}]`)
    const commandInput = commandRoot?.querySelector(`input[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}], textarea[${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}], [contenteditable="true"][${CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}]`) as HTMLElement | null
    if (!commandInput) return false
    commandInput.blur()
    return true
  }
  active.blur()
  return true
}
export const CardInlineTextEditor = React.memo(function CardInlineTextEditor(props: CardInlineTextEditorProps) {
  const {
    id,
    value,
    displayValue: displayValueProp,
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
    editorSurface = 'control',
    openOnPointerDown = false,
    projectedMediaAttachments = null,
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
  const [projectedSelectionRange, setProjectedSelectionRange] = React.useState({ start: 0, end: 0 })
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const viewerEditorRef = React.useRef<HTMLElement | null>(null)
  const commandRootRef = React.useRef<HTMLElement | null>(null)
  const displayRef = React.useRef<HTMLElement | null>(null)
  const lastEditRequestKeyRef = React.useRef<string | number | null>(null)
  const lastEditingRef = React.useRef(editing)
  const lastCommandPersistedDraftRef = React.useRef('')
  const commandSelectionRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 })
  const externalCommandStateRef = React.useRef<CardInlineTextCommandExternalState>({ canEdit, draft, editing, multiline, onCommit, persistCommandDraft: (_nextValue: string) => void 0, value })
  const editorDensity = useWorkspaceDataViewFloatingDensity()
  const useViewerEditSurface = multiline && editorSurface === 'viewer'
  const displaySourceValue = displayValueProp == null ? value : displayValueProp

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
    if (useViewerEditSurface) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    if ('selectionStart' in input && typeof input.value === 'string') {
      const fallbackEnd = input.value.length
      const selection = commandMode ? commandSelectionRef.current : { start: 0, end: fallbackEnd }
      input.setSelectionRange(selection.start, selection.end)
    }
  }, [commandMode, editing, useViewerEditSurface])

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

  const projectedEditorOverlay = React.useMemo(
    () => multiline
      ? buildFloatingPanelChatComposerOverlayParts(draft, {
        mediaAttachments: EDITOR_PROJECTED_MEDIA_ATTACHMENTS,
        projectInvocationTokens: false,
      })
      : { hasMedia: false, hasOverlay: false, parts: [] },
    [draft, multiline],
  )
  const hasProjectedInvocationOverlay = multiline && projectedEditorOverlay.hasOverlay
  const projectedEditorDisplayValue = React.useMemo(
    () => hasProjectedInvocationOverlay
      ? buildFloatingPanelChatComposerDisplayText(draft, { mediaAttachments: EDITOR_PROJECTED_MEDIA_ATTACHMENTS })
      : draft,
    [draft, hasProjectedInvocationOverlay],
  )
  const readProjectedEditorRawValue = React.useCallback((displayText: string): string => (
    hasProjectedInvocationOverlay
      ? resolveFloatingPanelChatComposerRawText(displayText, draft, { mediaAttachments: EDITOR_PROJECTED_MEDIA_ATTACHMENTS })
      : displayText
  ), [draft, hasProjectedInvocationOverlay])
  const normalizeCommittedValueForSurface = React.useCallback((nextValue: string): string => useViewerEditSurface ? normalizeEditorValue(nextValue) : normalizeCommittedEditorValue(nextValue), [useViewerEditSurface])
  const commit = React.useCallback((forcedValue?: string) => {
    const inputValue = typeof forcedValue === 'string' ? forcedValue : inputRef.current?.value
    const rawNext = normalizeEditorValue(inputValue == null ? draft : readProjectedEditorRawValue(inputValue))
    setEditing(false)
    setCommandMode(null)
    setCommandQuery('')
    if (rawNext === normalizeEditorValue(value)) return
    const next = normalizeCommittedValueForSurface(rawNext)
    if (next === lastCommandPersistedDraftRef.current) return
    onCommit?.(next)
  }, [draft, normalizeCommittedValueForSurface, onCommit, readProjectedEditorRawValue, value])

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
    const next = normalizeCommittedValueForSurface(nextValue)
    const input = inputRef.current
    const displayNext = hasProjectedInvocationOverlay
      ? buildFloatingPanelChatComposerDisplayText(next, { mediaAttachments: EDITOR_PROJECTED_MEDIA_ATTACHMENTS })
      : next
    if (input && input.value !== displayNext) input.value = displayNext
    if (next === normalizeEditorValue(value)) return
    if (next === lastCommandPersistedDraftRef.current) return
    lastCommandPersistedDraftRef.current = next
    onCommit?.(next)
  }, [hasProjectedInvocationOverlay, normalizeCommittedValueForSurface, onCommit, value])

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

  const displayMediaCandidateByKey = React.useMemo(() => {
    if (!multiline || !projectedMediaAttachments?.length) return new Map<string, TextareaInvocationProjectedMediaChip>()
    const candidates = collectTextareaInvocationMediaAttachmentCandidateChips(projectedMediaAttachments)
    return new Map(candidates.map(chip => [readCardInlineTextMediaCandidateKey(chip), chip]))
  }, [multiline, projectedMediaAttachments])
  const renderInlineMediaCandidateChip = React.useCallback(({ value }: { value: string; label: string; className: string }) => {
    const key = readTextareaInvocationMediaReferenceKey(value)
    const chip = key ? displayMediaCandidateByKey.get(key) : null
    if (!chip) return null
    return <CardInlineTextProjectedMediaChip chip={chip} index={0} />
  }, [displayMediaCandidateByKey])
  const displayText = readMarkdownSigilDisplayText(displaySourceValue)
  const showPlaceholder = !displayText
  const displayTitle = showPlaceholder
    ? placeholder
    : displayText
  const showMarkdownPreview =
    !showPlaceholder
    && (markdownPreview === true || (markdownPreview === 'auto' && hasCardMarkdownPreviewSyntax(displaySourceValue)))
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
    const cursor = buildFloatingPanelChatComposerDisplayText(nextDraft, { mediaAttachments: EDITOR_PROJECTED_MEDIA_ATTACHMENTS }).length
    setDraft(nextDraft)
    setEditing(true)
    openCommandMenuForSigilAtSelection(sigil, { start: cursor, end: cursor })
    return true
  }, [canEdit, enableMarkdownCommandMenus, openCommandMenuForSigilAtSelection, value])

  const closeCommandMenu = React.useCallback(() => {
    setCommandMode(null)
    setCommandQuery('')
    if (useViewerEditSurface) {
      focusCardInlineTextViewerSelectionSoon(viewerEditorRef, commandSelectionRef.current.end)
      return
    }
    focusInputSelectionSoon(inputRef.current, commandSelectionRef.current.end)
  }, [useViewerEditSurface])
  const projectedTextareaOverlayTextClassName = React.useMemo(
    () => readTextareaInvocationProjectionTextClassName(cn(
      readDataViewMultiLineControlClassName({
        rowHeightPreset: editorDensity.rowHeightPreset,
        fieldLineMode: editorDensity.fieldLineMode,
      }),
      editorClassName || '',
    )),
    [editorClassName, editorDensity.fieldLineMode, editorDensity.rowHeightPreset],
  )
  const projectedTextareaShellClassName = React.useMemo(
    () => cn('relative min-h-0 w-full', /\bh-full\b/.test(editorClassName || '') ? 'h-full' : ''),
    [editorClassName],
  )
  const hideProjectedCaret = hasProjectedInvocationOverlay && isFloatingPanelChatComposerProjectedCaretInsideChip(
    draft,
    projectedSelectionRange.start,
    projectedSelectionRange.end,
    { mediaAttachments: EDITOR_PROJECTED_MEDIA_ATTACHMENTS, projectInvocationTokens: false },
  )
  const updateProjectedSelectionRange = React.useCallback((input: HTMLInputElement | HTMLTextAreaElement | null, fallbackLength = 0) => {
    setProjectedSelectionRange({
      start: input?.selectionStart ?? fallbackLength,
      end: input?.selectionEnd ?? fallbackLength,
    })
  }, [])
  const setProjectedCommandDraft = React.useCallback((nextValue: string) => {
    setDraft(readProjectedEditorRawValue(nextValue))
  }, [readProjectedEditorRawValue])
  const persistProjectedCommandDraft = React.useCallback((nextValue: string) => {
    persistCommandDraft(readProjectedEditorRawValue(nextValue))
  }, [persistCommandDraft, readProjectedEditorRawValue])
  const finishProjectedCommandDraft = React.useCallback((nextValue: string) => {
    finishCommandDraft(readProjectedEditorRawValue(nextValue))
  }, [finishCommandDraft, readProjectedEditorRawValue])
  const focusViewerCommandSelection = React.useCallback((start: number, end: number = start) => {
    focusCardInlineTextViewerSelectionSoon(viewerEditorRef, start, end)
  }, [])

  const buildExternalCommandTarget = React.useCallback(() => {
    const targetId = id || ariaLabel
    const insertText = (replacement: string) => {
      const latest = externalCommandStateRef.current
      if (!latest.canEdit || latest.multiline !== true) return false
      if (latest.editing && inputRef.current) {
        const input = inputRef.current
        const text = normalizeEditorValue(latest.draft)
        const displaySelection = readInputSelection(input)
        const selection = hasProjectedInvocationOverlay
          ? {
            start: mapFloatingPanelChatComposerDisplayIndexToRawIndex(text, displaySelection.start, { mediaAttachments: EDITOR_PROJECTED_MEDIA_ATTACHMENTS }),
            end: mapFloatingPanelChatComposerDisplayIndexToRawIndex(text, displaySelection.end, { mediaAttachments: EDITOR_PROJECTED_MEDIA_ATTACHMENTS }),
          }
          : displaySelection
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
        focusInputSelectionSoon(input, hasProjectedInvocationOverlay ? mapFloatingPanelChatComposerRawIndexToDisplayIndex(next, cursor, { mediaAttachments: EDITOR_PROJECTED_MEDIA_ATTACHMENTS }) : cursor)
        return true
      }
      const current = normalizeEditorValue(latest.editing ? latest.draft : latest.value)
      const separator = current ? (current.endsWith('\n') ? '' : '\n') : ''
      const next = normalizeCommittedEditorValue(`${current}${separator}${replacement}`)
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
  }, [ariaLabel, hasProjectedInvocationOverlay, id])

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
      value: projectedEditorDisplayValue,
      placeholder,
      spellCheck: true,
      'aria-label': ariaLabel,
      autoComplete: 'off',
      autoCorrect: 'off',
      autoCapitalize: 'off',
      className: editorClassName,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const nextDisplayValue = event.currentTarget.value
        const nextValue = readProjectedEditorRawValue(nextDisplayValue)
        if (enableMarkdownCommandMenus && !commandMode) {
          const selection = readInputSelection(event.currentTarget)
          const insertedIndex = selection.end - 1
          const insertedText = nextDisplayValue.length === projectedEditorDisplayValue.length + 1 && insertedIndex >= 0
            ? nextDisplayValue.slice(insertedIndex, selection.end)
            : ''
          const sigil = readInlineCommandMenuSigilFromInsertedText(insertedText)
          if (sigil) {
            const nextSelection = { start: insertedIndex, end: insertedIndex }
            const cleanedDisplay = `${nextDisplayValue.slice(0, insertedIndex)}${nextDisplayValue.slice(selection.end)}`
            const cleanedRaw = readProjectedEditorRawValue(cleanedDisplay)
            event.currentTarget.value = cleanedDisplay
            setDraft(cleanedRaw)
            openCommandMenuForSigilAtSelection(sigil, nextSelection)
            focusInputSelectionSoon(event.currentTarget, nextSelection.start)
            return
          }
        }
        setDraft(nextValue)
        updateProjectedSelectionRange(event.currentTarget, nextDisplayValue.length)
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
        updateProjectedSelectionRange(inputRef.current, String(inputRef.current?.value || '').length)
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
      onSelect: (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        updateProjectedSelectionRange(event.currentTarget, event.currentTarget.value.length)
      },
      onDoubleClick: (event: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        event.stopPropagation()
      },
      [CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE]: '1',
    }
    return (
      <CardInlineTextEditingSurface
        ariaLabel={ariaLabel}
        cardInlineEditInputAttribute={CARD_INLINE_TEXT_EDITOR_INPUT_ATTRIBUTE}
        closeCommandMenu={closeCommandMenu}
        commandContextText={markdownCommandContextText}
        commandMode={commandMode}
        commandQuery={commandQuery}
        commandRootAttribute={CARD_INLINE_TEXT_COMMAND_ROOT_ATTRIBUTE}
        commandRootRef={commandRootRef}
        commandSelectionRef={commandSelectionRef}
        commonEditorProps={commonEditorProps}
        draft={draft}
        editorClassName={editorClassName}
        editorDensity={editorDensity}
        enableMarkdownCommandMenus={enableMarkdownCommandMenus}
        finishProjectedCommandDraft={finishProjectedCommandDraft}
        finishCommandDraft={finishCommandDraft}
        focusViewerCommandSelection={focusViewerCommandSelection}
        hasProjectedInvocationOverlay={hasProjectedInvocationOverlay}
        hideProjectedCaret={hideProjectedCaret}
        inputRef={inputRef}
        isCommandMenuTarget={isCommandMenuTarget}
        mediaCommandMode={mediaCommandMode}
        multiline={multiline}
        onCancel={cancel}
        onCommit={commit}
        onCommandDraftChange={persistCommandDraft}
        onMediaCommandSelect={onMediaCommandSelect}
        openCommandMenu={openCommandMenu}
        openCommandMenuForSigilAtSelection={openCommandMenuForSigilAtSelection}
        placeholder={placeholder}
        projectedEditorDisplayValue={projectedEditorDisplayValue}
        projectedEditorOverlay={projectedEditorOverlay}
        projectedMediaAttachments={projectedMediaAttachments}
        projectedSelectionRange={projectedSelectionRange}
        projectedTextareaOverlayTextClassName={projectedTextareaOverlayTextClassName}
        projectedTextareaShellClassName={projectedTextareaShellClassName}
        rows={rows}
        setCommandMode={setCommandMode}
        setCommandQuery={setCommandQuery}
        setDraft={setDraft}
        setProjectedCommandDraft={setProjectedCommandDraft}
        showCommandLaunchers={showCommandLaunchers}
        useViewerEditSurface={useViewerEditSurface}
        viewerEditorRef={viewerEditorRef}
        persistProjectedCommandDraft={persistProjectedCommandDraft}
      />
    )
  }

  return (
    <CardInlineTextDisplaySurface
      activateExternalCommandTarget={activateExternalCommandTarget}
      ariaLabel={ariaLabel}
      canEdit={canEdit}
      densityOwnedDisplayClassName={densityOwnedDisplayClassName}
      displayLineClassName={displayLineClassName}
      displayRef={displayRef}
      displaySourceValue={displaySourceValue}
      displayText={displayText}
      displayTitle={displayTitle}
      editActivation={editActivation}
      emptyClassName={emptyClassName}
      enableMarkdownCommandMenus={enableMarkdownCommandMenus}
      id={id}
      onOpenEditorFromDisplayEvent={openEditorFromDisplayEvent}
      openDisplayCommandMenuForSigil={openDisplayCommandMenuForSigil}
      openOnPointerDown={openOnPointerDown}
      placeholder={placeholder}
      renderInlineMediaCandidateChip={renderInlineMediaCandidateChip}
      showMarkdownPreview={showMarkdownPreview}
      showPlaceholder={showPlaceholder}
      shouldIgnoreInlineEditTarget={shouldIgnoreInlineEditTarget}
      stopActivationPropagation={stopActivationPropagation}
    />
  )
})
