import React from 'react'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { collectMarkdownVariableBrowseRows, buildMarkdownVariableToken } from '@/features/markdown/ui/markdownVariableReferences'
import { CHAT_SKILL_OPTIONS } from '@/features/chat/chatSkillRegistry'
import { getChatInvocationOptions, isChatInvocationToken } from '@/features/chat/chatInvocationRegistry'
import {
  buildAgenticOsDictionaryInvocationMarkdown,
  buildAgenticOsDocBindingInvocationMarkdown,
  buildAgenticOsDocInvocationMarkdown,
  buildAgenticOsDocSemanticInvocationMarkdown,
  getAgenticOsBindingInvocations,
  getAgenticOsCommandInvocations,
  getAgenticOsDocInvocations,
  getAgenticOsSemanticInvocations,
} from '@/features/agentic-os/agenticOsDocInvocations'
import { fetchAgenticOsRemoteGrammarCatalog, type AgenticOsRemoteGrammarCatalogEntry, useAgenticOsRemoteGrammarCatalog } from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import { buildInlineMediaEmbed, collectInlineKeywordCommandCandidates, collectInlineMediaCommandCandidates } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { mergeInlineMediaCommandCandidates } from '@/lib/command-menu/inlineMediaCommandCandidateMerge'
import {
  buildInlineCommandMenuItem,
  buildInlineKeywordCommandMenuItem,
  buildInlineMediaCommandMenuItem,
  buildInlineVariableBrowseMenuItem,
} from '@/lib/command-menu/inlineCommandMenuItems'
import { useUploadedMediaInlineCommandCandidates } from '@/lib/command-menu/inlineUploadedMediaCandidates'
import { MarkdownBlockContainerCommandMenu, type MarkdownInlineCommandMenuItem } from '@/lib/markdown-core/ui/markdownBlockContainerCore.commandMenu'
import { AnchorOverlay } from '@/lib/ui/overlay'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { FLOATING_MENU_BUTTON_CLASSNAME, FLOATING_MENU_BUTTON_DISABLED_CLASSNAME, FLOATING_MENU_BUTTON_DANGER_CLASSNAME, FLOATING_POPOVER_INPUT_CLASSNAME } from '@/features/markdown-workspace/main/viewer/floatingMenuStyles'
import { UI_RESPONSIVE_MULTILINE_TEXT_INPUT_EDITOR_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { replaceChatComposerTrigger, resolveChatComposerTrigger, type ChatComposerTrigger } from './chatComposerTrigger'
import {
  buildFloatingPanelChatComposerDisplayText,
  buildFloatingPanelChatComposerOverlayParts,
  deleteFloatingPanelChatComposerProjectedTokenDisplayRange,
  FLOATING_PANEL_CHAT_COMPOSER_PROJECTED_LAYOUT_CLASS_NAME,
  FloatingPanelChatComposerMediaOverlay,
  isFloatingPanelChatComposerProjectedCaretInsideChip,
  mapFloatingPanelChatComposerDisplayIndexToRawIndex,
  mapFloatingPanelChatComposerRawIndexToDisplayIndex,
  resolveFloatingPanelChatComposerRawText,
} from './FloatingPanelChatComposerMediaOverlay'

type FloatingPanelChatComposerProps = {
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  appendFocusRequestKey?: number
  markdownText?: string | null
  isLoading: boolean
  isSubmitDisabled: boolean
  uiPanelTextFontClass: string
  placeholder: string
}

const REMOTE_GRAMMAR_SIGIL_BY_TRIGGER_KIND = {
  slash: '/',
  variable: '@',
  keyword: '#',
} as const

const REMOTE_GRAMMAR_GROUP_BY_KIND = {
  binding: 'Agentic OS binding dictionary',
  command: 'Agentic OS command dictionary',
  semantic: 'Agentic OS semantic dictionary',
} as const

const FLOATING_PANEL_CHAT_GRAMMAR_QUICK_BAR_TOKENS = [
  { id: 'slash', label: '/', description: 'Open slash commands' },
  { id: 'keyword', label: '#', description: 'Open runtime invocations' },
  { id: 'binding', label: '@', description: 'Open bindings and variables' },
] as const

const mergeMenuItems = (
  primaryItems: MarkdownInlineCommandMenuItem[],
  fallbackItems: MarkdownInlineCommandMenuItem[],
): MarkdownInlineCommandMenuItem[] => {
  const seen = new Set<string>()
  const merged: MarkdownInlineCommandMenuItem[] = []
  for (const item of [...primaryItems, ...fallbackItems]) {
    const key = `${item.group}::${item.label}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

const focusFloatingPanelChatComposerInput = (input: HTMLTextAreaElement | null): void => {
  if (!input) return
  try {
    input.focus({ preventScroll: true })
    return
  } catch {
    void 0
  }
  input.focus()
}

const matchesRemoteGrammarTriggerKind = (
  entry: AgenticOsRemoteGrammarCatalogEntry,
  triggerKind: NonNullable<ChatComposerTrigger>['kind'],
): boolean => {
  const expectedSigil = REMOTE_GRAMMAR_SIGIL_BY_TRIGGER_KIND[triggerKind]
  return String(entry.token || '').startsWith(expectedSigil)
}

const resolveRemoteGrammarGroup = (entry: AgenticOsRemoteGrammarCatalogEntry): string => {
  const kind = String(entry.kind || '').toLowerCase()
  return REMOTE_GRAMMAR_GROUP_BY_KIND[kind as keyof typeof REMOTE_GRAMMAR_GROUP_BY_KIND] || 'Agentic OS remote grammar'
}

export function FloatingPanelChatComposer(props: FloatingPanelChatComposerProps) {
  const anchorRef = React.useRef<HTMLElement | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [trigger, setTrigger] = React.useState<ChatComposerTrigger | null>(null)
  const [query, setQuery] = React.useState('')
  const [selectionRange, setSelectionRange] = React.useState({ start: 0, end: 0 })
  const [remoteGrammarEntries, setRemoteGrammarEntries] = React.useState<AgenticOsRemoteGrammarCatalogEntry[]>([])
  useAgenticOsRemoteGrammarCatalog({
    sigils: trigger ? [REMOTE_GRAMMAR_SIGIL_BY_TRIGGER_KIND[trigger.kind]] : [],
  })
  const uploadedMediaItems = useUploadedMediaInlineCommandCandidates()

  const closeMenu = React.useCallback(() => {
    setTrigger(null)
    setQuery('')
  }, [])
  const applyReplacement = React.useCallback((replacement: string) => {
    if (!trigger) return
    const rawTrigger = {
      ...trigger,
      rangeStart: mapFloatingPanelChatComposerDisplayIndexToRawIndex(props.input, trigger.rangeStart),
      rangeEnd: mapFloatingPanelChatComposerDisplayIndexToRawIndex(props.input, trigger.rangeEnd),
    }
    const next = replaceChatComposerTrigger({ text: props.input, trigger: rawTrigger, replacement })
    props.setInput(next.text)
    closeMenu()
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      const cursor = mapFloatingPanelChatComposerRawIndexToDisplayIndex(next.text, next.cursor)
      focusFloatingPanelChatComposerInput(input)
      input.setSelectionRange(cursor, cursor)
      setSelectionRange({ start: cursor, end: cursor })
    })
  }, [closeMenu, props, trigger])
  const updateTrigger = React.useCallback((value: string) => {
    const cursor = inputRef.current?.selectionStart ?? value.length
    const next = resolveChatComposerTrigger(value, cursor)
    setTrigger(next)
    setQuery(next?.query || '')
  }, [])
  React.useEffect(() => {
    if (!trigger) {
      setRemoteGrammarEntries([])
      return
    }
    const token = `${REMOTE_GRAMMAR_SIGIL_BY_TRIGGER_KIND[trigger.kind]}${query}`
    const abortController = new AbortController()
    setRemoteGrammarEntries([])
    fetchAgenticOsRemoteGrammarCatalog({ query: token, signal: abortController.signal })
      .then(entries => {
        setRemoteGrammarEntries(entries.filter(entry => matchesRemoteGrammarTriggerKind(entry, trigger.kind)))
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setRemoteGrammarEntries([])
      })
    return () => abortController.abort()
  }, [query, trigger])

  React.useEffect(() => {
    if (!props.appendFocusRequestKey) return
    let cancelled = false
    requestAnimationFrame(() => {
      if (cancelled) return
      const input = inputRef.current
      if (!input) return
      const nextCursorDisplay = mapFloatingPanelChatComposerRawIndexToDisplayIndex(props.input, props.input.length)
      focusFloatingPanelChatComposerInput(input)
      input.setSelectionRange(nextCursorDisplay, nextCursorDisplay)
      setSelectionRange({ start: nextCursorDisplay, end: nextCursorDisplay })
      closeMenu()
    })
    return () => {
      cancelled = true
    }
  }, [closeMenu, props.appendFocusRequestKey, props.input])

  const remoteGrammarItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => {
    if (!trigger) return []
    return remoteGrammarEntries.map(entry => buildInlineCommandMenuItem({
      id: `remote-agentic-os-grammar-${encodeURIComponent(entry.token)}`,
      label: entry.token,
      group: resolveRemoteGrammarGroup(entry),
      description: entry.summary || entry.intent || entry.label || 'Live Agentic OS grammar',
      keywords: [
        entry.label || '',
        entry.sourcePath || '',
        entry.fileName || '',
        ...(Array.isArray(entry.keywords) ? entry.keywords : []),
      ].filter(Boolean),
      onSelect: () => applyReplacement(`${entry.token} `),
    }))
  }, [applyReplacement, remoteGrammarEntries, trigger])

  const slashFallbackItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => [
    ...CHAT_SKILL_OPTIONS.map(option => buildInlineCommandMenuItem({
      id: `skill-${option.id}`,
      label: option.slashCommand,
      group: 'Skills',
      description: option.summary,
      keywords: [option.label, ...option.keywords],
      onSelect: () => applyReplacement(`${option.slashCommand} `),
    })),
    ...getAgenticOsCommandInvocations().map(invocation => buildInlineCommandMenuItem({
      id: `agentic-os-command-${invocation.id}`,
      label: invocation.token,
      group: invocation.group,
      description: invocation.summary,
      keywords: [invocation.label, invocation.sourcePath, ...invocation.keywords],
      onSelect: () => applyReplacement(`${buildAgenticOsDictionaryInvocationMarkdown(invocation)} `),
    })),
    ...getAgenticOsDocInvocations().map(doc => buildInlineCommandMenuItem({
      id: `agentic-os-doc-slash-${doc.id}`,
      label: doc.slashCommand,
      group: 'Agentic OS docs',
      description: doc.summary,
      keywords: [doc.label, doc.hashToken, doc.atToken, doc.sourcePath, ...doc.keywords],
      onSelect: () => applyReplacement(`${buildAgenticOsDocInvocationMarkdown(doc)} `),
    })),
  ], [applyReplacement])
  const slashItems = React.useMemo(
    () => mergeMenuItems(remoteGrammarItems.filter(item => item.label.startsWith('/')), slashFallbackItems),
    [remoteGrammarItems, slashFallbackItems],
  )
  const variableFallbackItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => {
    const sourceLines = String(props.markdownText || '').split(/\r?\n/)
    const workspaceVariables = collectMarkdownVariableBrowseRows({ sourceLines, draftText: props.input }).slice(0, 40).map(row => buildInlineVariableBrowseMenuItem({
      row,
      group: 'Workspace variables',
      onSelect: () => applyReplacement(buildMarkdownVariableToken({ mode: 'ref', key: row.key })),
    }))
    const mediaItems = mergeInlineMediaCommandCandidates([
      ...uploadedMediaItems,
      ...collectInlineMediaCommandCandidates({ sourceLines, draftText: props.input, limit: 20 }),
    ], 20)
      .map(item => buildInlineMediaCommandMenuItem({
        candidate: item,
        idPrefix: 'media-',
        group: 'FloatingPanel Media',
        onSelect: () => applyReplacement(buildInlineMediaEmbed({
          kind: item.kind,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl,
          label: item.label,
          sourceKey: item.sourceKey,
          selectedText: '',
        })),
      }))
    const agenticOsDocItems = getAgenticOsDocInvocations().map(doc => buildInlineCommandMenuItem({
      id: `agentic-os-doc-at-${doc.id}`,
      label: doc.atToken,
      group: 'Agentic OS docs',
      description: doc.summary,
      keywords: [doc.label, doc.slashCommand, doc.hashToken, doc.sourcePath, ...doc.keywords],
      onSelect: () => applyReplacement(`${buildAgenticOsDocBindingInvocationMarkdown(doc)} `),
    }))
    const agenticOsBindingItems = getAgenticOsBindingInvocations().map(invocation => buildInlineCommandMenuItem({
      id: `agentic-os-binding-${invocation.id}`,
      label: invocation.token,
      group: invocation.group,
      description: invocation.summary,
      keywords: [invocation.label, invocation.sourcePath, ...invocation.keywords],
      onSelect: () => applyReplacement(`${buildAgenticOsDictionaryInvocationMarkdown(invocation)} `),
    }))
    return [...mediaItems, ...agenticOsBindingItems, ...agenticOsDocItems, ...workspaceVariables]
  }, [applyReplacement, props.input, props.markdownText, uploadedMediaItems])
  const variableItems = React.useMemo(
    () => mergeMenuItems(remoteGrammarItems.filter(item => item.label.startsWith('@')), variableFallbackItems),
    [remoteGrammarItems, variableFallbackItems],
  )
  const keywordFallbackItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => [
    ...getChatInvocationOptions().map(option => buildInlineCommandMenuItem({
      id: `invocation-${option.id}`,
      label: option.token,
      group: 'Runtime invocations',
      description: option.summary,
      keywords: [option.label, ...option.keywords, option.toolName || ''],
      onSelect: () => applyReplacement(`${option.token} `),
    })),
    ...collectInlineKeywordCommandCandidates({
      draftText: [props.markdownText, props.input].filter(Boolean).join('\n'),
      limit: 20,
    }).filter(candidate => !isChatInvocationToken(candidate.token)).map(candidate => buildInlineKeywordCommandMenuItem({
      candidate,
      label: candidate.token,
      replacement: `${candidate.token} `,
      onSelect: applyReplacement,
    })),
    ...getAgenticOsSemanticInvocations().map(invocation => buildInlineCommandMenuItem({
      id: `agentic-os-semantic-${invocation.id}`,
      label: invocation.token,
      group: invocation.group,
      description: invocation.summary,
      keywords: [invocation.label, invocation.sourcePath, ...invocation.keywords],
      onSelect: () => applyReplacement(`${buildAgenticOsDictionaryInvocationMarkdown(invocation)} `),
    })),
    ...getAgenticOsDocInvocations().map(doc => buildInlineCommandMenuItem({
      id: `agentic-os-doc-hash-${doc.id}`,
      label: doc.hashToken,
      group: 'Agentic OS docs',
      description: doc.summary,
      keywords: [doc.label, doc.slashCommand, doc.atToken, doc.sourcePath, ...doc.keywords],
      onSelect: () => applyReplacement(`${buildAgenticOsDocSemanticInvocationMarkdown(doc)} `),
    })),
  ], [applyReplacement, props.input, props.markdownText])
  const keywordItems = React.useMemo(
    () => mergeMenuItems(remoteGrammarItems.filter(item => item.label.startsWith('#')), keywordFallbackItems),
    [keywordFallbackItems, remoteGrammarItems],
  )
  const items = trigger?.kind === 'slash' ? slashItems : trigger?.kind === 'keyword' ? keywordItems : variableItems
  const ariaLabel = trigger?.kind === 'slash' ? 'Chat slash commands' : trigger?.kind === 'keyword' ? 'Chat runtime invocations' : 'Chat variable commands'
  const menuListId = `${ariaLabel.replace(/\s+/g, '-').toLowerCase()}-list`
  const composerOverlay = React.useMemo(() => buildFloatingPanelChatComposerOverlayParts(props.input), [props.input])
  const hasMediaOverlay = composerOverlay.hasMedia
  const hasComposerOverlay = composerOverlay.hasOverlay
  const displayInput = React.useMemo(() => buildFloatingPanelChatComposerDisplayText(props.input), [props.input])
  React.useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart ?? displayInput.length
    const end = input.selectionEnd ?? displayInput.length
    setSelectionRange(previous => previous.start === start && previous.end === end ? previous : { start, end })
  }, [displayInput])
  const projectedLayoutClassName = hasComposerOverlay ? FLOATING_PANEL_CHAT_COMPOSER_PROJECTED_LAYOUT_CLASS_NAME : ''
  const hideProjectedCaret = hasComposerOverlay && isFloatingPanelChatComposerProjectedCaretInsideChip(props.input, selectionRange.start, selectionRange.end)
  const deleteProjectedTokenRange = React.useCallback((target: HTMLInputElement | HTMLTextAreaElement, direction: 'backward' | 'forward'): boolean => {
    if (!hasComposerOverlay) return false
    const next = deleteFloatingPanelChatComposerProjectedTokenDisplayRange({
      text: props.input,
      selectionStart: target.selectionStart ?? target.value.length,
      selectionEnd: target.selectionEnd ?? target.value.length,
      direction,
    })
    if (!next) return false
    props.setInput(next.text)
    closeMenu()
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      focusFloatingPanelChatComposerInput(input)
      input.setSelectionRange(next.cursor, next.cursor)
      setSelectionRange({ start: next.cursor, end: next.cursor })
    })
    return true
  }, [closeMenu, hasComposerOverlay, props])
  const insertGrammarQuickBarToken = React.useCallback((token: '/' | '#' | '@') => {
    const input = inputRef.current
    const displaySelectionStart = input?.selectionStart ?? displayInput.length
    const displaySelectionEnd = input?.selectionEnd ?? displayInput.length
    const rawSelectionStart = mapFloatingPanelChatComposerDisplayIndexToRawIndex(props.input, displaySelectionStart)
    const rawSelectionEnd = mapFloatingPanelChatComposerDisplayIndexToRawIndex(props.input, displaySelectionEnd)
    const needsLeadingSpace = rawSelectionStart > 0 && /\S/.test(props.input.charAt(rawSelectionStart - 1) || '')
    const insertion = `${needsLeadingSpace ? ' ' : ''}${token}`
    const nextText = `${props.input.slice(0, rawSelectionStart)}${insertion}${props.input.slice(rawSelectionEnd)}`
    const nextCursorRaw = rawSelectionStart + insertion.length
    props.setInput(nextText)
    requestAnimationFrame(() => {
      const nextInput = inputRef.current
      if (!nextInput) return
      const nextDisplay = buildFloatingPanelChatComposerDisplayText(nextText)
      const nextCursorDisplay = mapFloatingPanelChatComposerRawIndexToDisplayIndex(nextText, nextCursorRaw)
      focusFloatingPanelChatComposerInput(nextInput)
      nextInput.setSelectionRange(nextCursorDisplay, nextCursorDisplay)
      setSelectionRange({ start: nextCursorDisplay, end: nextCursorDisplay })
      const nextTrigger = resolveChatComposerTrigger(nextDisplay, nextCursorDisplay)
      setTrigger(nextTrigger)
      setQuery(nextTrigger?.query || '')
    })
  }, [displayInput.length, props.input, props.setInput])

  return (
    <section ref={anchorRef} className={`relative border rounded overflow-hidden ${UI_RESPONSIVE_MULTILINE_TEXT_INPUT_EDITOR_CLASSNAME} ${projectedLayoutClassName} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg}`}>
      <section
        className={`flex items-center gap-1 border-b px-2 py-1 sm:hidden ${UI_THEME_TOKENS.panel.border}`}
        aria-label="Mobile grammar quick bar"
        data-kg-chat-grammar-quick-bar="true"
      >
        {FLOATING_PANEL_CHAT_GRAMMAR_QUICK_BAR_TOKENS.map(entry => (
          <button
            key={entry.id}
            type="button"
            data-kg-chat-grammar-quick-bar-token={entry.label}
            className={`App-toolbar__btn min-w-[2.5rem] justify-center text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} disabled:opacity-50`}
            aria-label={entry.description}
            title={entry.description}
            disabled={props.isLoading}
            onPointerDown={event => event.preventDefault()}
            onClick={() => insertGrammarQuickBarToken(entry.label)}
          >
            {entry.label}
          </button>
        ))}
      </section>
      <section className="relative">
        <FloatingPanelChatComposerMediaOverlay
          input={props.input}
          projectedSelectionRange={selectionRange}
          showProjectedCaret={hideProjectedCaret}
          uiPanelTextFontClass={props.uiPanelTextFontClass}
        />
        <PlainTextInputEditor
          ref={inputRef}
          value={displayInput}
          onChange={value => {
            props.setInput(resolveFloatingPanelChatComposerRawText(value, props.input))
            updateTrigger(value)
            const input = inputRef.current
            setSelectionRange({ start: input?.selectionStart ?? value.length, end: input?.selectionEnd ?? value.length })
          }}
          onSelect={event => {
            updateTrigger(event.currentTarget.value)
            setSelectionRange({ start: event.currentTarget.selectionStart ?? event.currentTarget.value.length, end: event.currentTarget.selectionEnd ?? event.currentTarget.value.length })
          }}
          onBeforeInput={event => {
            const inputType = (event.nativeEvent as InputEvent).inputType
            const direction = inputType === 'deleteContentBackward'
              ? 'backward'
              : inputType === 'deleteContentForward'
                ? 'forward'
                : null
            if (!direction) return
            if (!deleteProjectedTokenRange(event.currentTarget, direction)) return
            event.preventDefault()
          }}
          placeholder={props.placeholder}
          ariaLabel={props.placeholder}
          ariaExpanded={!!trigger}
          ariaControls={trigger ? menuListId : undefined}
          disabled={props.isLoading}
          multiline
          className="relative z-0 w-full h-full border-0 rounded-none bg-transparent"
          inputClassName={`${props.uiPanelTextFontClass} ${hasComposerOverlay ? `text-transparent ${hideProjectedCaret ? 'caret-transparent' : 'caret-[color:var(--kg-text-primary)]'} ${FLOATING_PANEL_CHAT_COMPOSER_PROJECTED_LAYOUT_CLASS_NAME}` : ''}`}
          dataAttributes={{
            'data-kg-chat-input': true,
            'data-kg-chat-input-overlay-active': hasComposerOverlay ? '1' : undefined,
            'data-kg-chat-input-media-overlay-active': hasMediaOverlay ? '1' : undefined,
          }}
          onKeyDown={event => {
            if (hasComposerOverlay && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
              event.preventDefault()
              event.currentTarget.setSelectionRange(0, event.currentTarget.value.length)
              setSelectionRange({ start: 0, end: event.currentTarget.value.length })
              closeMenu()
              return
            }
            if (hasComposerOverlay && (event.key === 'Backspace' || event.key === 'Delete')) {
              if (deleteProjectedTokenRange(event.currentTarget, event.key === 'Backspace' ? 'backward' : 'forward')) {
                event.preventDefault()
                return
              }
            }
            if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter' || props.isSubmitDisabled) return
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }}
        />
      </section>
      <AnchorOverlay anchorRef={anchorRef} open={!!trigger} onClose={closeMenu} align="top-left" className={`w-[min(22rem,calc(100vw-1rem))] rounded border p-2 shadow-sm ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}>
        <MarkdownBlockContainerCommandMenu
          ariaLabel={ariaLabel}
          items={items}
          query={query}
          onQueryChange={setQuery}
          onCancel={closeMenu}
          placeholder={trigger?.kind === 'slash' ? 'Find command' : trigger?.kind === 'keyword' ? 'Find runtime or keyword' : 'Find workspace variable'}
          inputClassName={FLOATING_POPOVER_INPUT_CLASSNAME}
          itemClassName={FLOATING_MENU_BUTTON_CLASSNAME}
          itemDisabledClassName={FLOATING_MENU_BUTTON_DISABLED_CLASSNAME}
          itemDangerClassName={FLOATING_MENU_BUTTON_DANGER_CLASSNAME}
          emptyLabel={trigger?.kind === 'slash' ? 'No commands' : trigger?.kind === 'keyword' ? 'No runtime invocations' : 'No workspace variables'}
          selectOnPointerDown={false}
        />
      </AnchorOverlay>
    </section>
  )
}
