import React from 'react'
import { createPortal } from 'react-dom'
import { AtSign, Hash, Slash } from 'lucide-react'
import { buildMarkdownVariableToken, collectMarkdownVariableBrowseRows } from '@/features/markdown/ui/markdownVariableReferences'
import { preventDefaultMouseDown } from '@/features/markdown/ui/markdownFloatingSelectionToolbar'
import { MarkdownBlockContainerCommandMenu, type MarkdownInlineCommandMenuItem } from '@/lib/markdown-core/ui/markdownBlockContainerCore.commandMenu'
import {
  INLINE_SLASH_COMMAND_ACTIONS,
  INLINE_VARIABLE_COMMAND_ACTIONS,
  INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID,
  INLINE_MEDIA_VARIABLE_KEY_BY_ACTION_ID,
  buildInlineKeywordToken,
  buildInlineMediaEmbed,
  collectInlineKeywordCommandCandidates,
  collectInlineMediaCommandCandidates,
  isInlineVariableKey,
  parseInlineVariableCommandQuery,
  type InlineSlashCommandId,
  type InlineVariableCommandId,
} from '@/lib/command-menu/inlineCommandMenuCatalog'
import {
  applyCommandMenuMediaNameDraftsToInlineCandidates,
  useCommandMenuMediaNameDrafts,
} from '@/lib/command-menu/commandMenuMediaNameSync'
import { UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE = 'data-kg-card-inline-command-menu'

export type CardInlineTextCommandMenuMode = 'slash' | 'variable' | 'keyword'

const cardInlineCommandButtonClassName = [
  'inline-flex h-6 w-6 items-center justify-center rounded border',
  UI_THEME_TOKENS.input.bg,
  UI_THEME_TOKENS.input.border,
  UI_THEME_TOKENS.text.secondary,
  'hover:bg-black/5 dark:hover:bg-white/10',
].join(' ')
const cardInlineCommandMenuItemClassName = [
  'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs',
  UI_THEME_TOKENS.text.primary,
  'hover:bg-black/5 dark:hover:bg-white/10',
].join(' ')
const cardInlineCommandMenuDangerClassName = [
  cardInlineCommandMenuItemClassName,
  'text-red-600 dark:text-red-300',
].join(' ')
const cardInlineCommandMenuDisabledClassName = [
  cardInlineCommandMenuItemClassName,
  'opacity-50 cursor-not-allowed',
].join(' ')

type CardInlineCommandMenuFrame = {
  left: number
  top: number
  width: number
}

function readCardInlineTextInputSelection(input: HTMLInputElement | HTMLTextAreaElement | null): { start: number; end: number } {
  if (!input) return { start: 0, end: 0 }
  const length = String(input.value || '').length
  const rawStart = typeof input.selectionStart === 'number' ? input.selectionStart : length
  const rawEnd = typeof input.selectionEnd === 'number' ? input.selectionEnd : rawStart
  const start = Math.max(0, Math.min(length, rawStart))
  const end = Math.max(0, Math.min(length, rawEnd))
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

function focusCardInlineTextInputSelectionSoon(input: HTMLInputElement | HTMLTextAreaElement | null, start: number, end: number = start) {
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

function replaceDraftRange(args: {
  input: HTMLInputElement | HTMLTextAreaElement | null
  draft: string
  setDraft: (next: string) => void
  onCommandDraftChange?: (next: string) => void
  start: number
  end: number
  replacement: string
}) {
  const text = String(args.draft || '')
  const start = Math.max(0, Math.min(text.length, args.start))
  const end = Math.max(start, Math.min(text.length, args.end))
  const next = `${text.slice(0, start)}${args.replacement}${text.slice(end)}`
  const cursor = start + args.replacement.length
  args.setDraft(next)
  args.onCommandDraftChange?.(next)
  focusCardInlineTextInputSelectionSoon(args.input, cursor)
}

function replaceCurrentLine(args: {
  input: HTMLInputElement | HTMLTextAreaElement | null
  draft: string
  setDraft: (next: string) => void
  onCommandDraftChange?: (next: string) => void
  prefix: string
}) {
  const text = String(args.draft || '')
  const selection = readCardInlineTextInputSelection(args.input)
  const lineStart = text.lastIndexOf('\n', Math.max(0, selection.start) - 1) + 1
  const lineEndRaw = text.indexOf('\n', selection.end)
  const lineEnd = lineEndRaw >= 0 ? lineEndRaw : text.length
  const rawLine = text.slice(lineStart, lineEnd)
  const content = rawLine
    .replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+|- \[[ xX]\]\s+)/, '')
    .trimStart()
  replaceDraftRange({ ...args, start: lineStart, end: lineEnd, replacement: `${args.prefix}${content}` })
}

export function CardInlineTextCommandMenus(props: {
  commandMode: CardInlineTextCommandMenuMode | null
  commandQuery: string
  commandSelectionRef: React.MutableRefObject<{ start: number; end: number }>
  commandContextText?: string
  draft: string
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  openCommandMenu: (mode: CardInlineTextCommandMenuMode) => void
  closeCommandMenu: () => void
  setCommandQuery: (next: string) => void
  setCommandMode: (next: CardInlineTextCommandMenuMode | null) => void
  setDraft: (next: string) => void
  onCommandDraftChange?: (next: string) => void
  onCommandDraftApplied?: (next: string) => void
}) {
  const {
    closeCommandMenu,
    commandMode,
    commandQuery,
    commandSelectionRef,
    commandContextText,
    draft,
    inputRef,
    onCommandDraftChange,
    onCommandDraftApplied,
    openCommandMenu,
    setCommandMode,
    setCommandQuery,
    setDraft,
  } = props
  const [menuFrame, setMenuFrame] = React.useState<CardInlineCommandMenuFrame | null>(null)
  const mediaNameDrafts = useCommandMenuMediaNameDrafts()

  React.useLayoutEffect(() => {
    if (!commandMode) {
      setMenuFrame(null)
      return
    }
    const updateFrame = () => {
      const input = inputRef.current
      if (!input) return
      const rect = input.getBoundingClientRect()
      const viewportWidth = window.innerWidth || 0
      const viewportHeight = window.innerHeight || 0
      const gap = 6
      const margin = 8
      const desiredWidth = Math.max(240, rect.width - 16)
      const width = Math.min(desiredWidth, Math.max(240, viewportWidth - margin * 2))
      const left = Math.max(margin, Math.min(rect.left + 8, viewportWidth - width - margin))
      const availableAbove = Math.max(0, rect.top - margin - gap)
      const availableBelow = Math.max(0, viewportHeight - rect.bottom - margin - gap)
      const estimatedHeight = Math.min(360, Math.max(220, Math.max(availableAbove, availableBelow)))
      const opensAbove = availableBelow < 220 && availableAbove > availableBelow
      const top = opensAbove
        ? Math.max(margin, rect.top - gap - estimatedHeight)
        : Math.min(viewportHeight - estimatedHeight - margin, rect.bottom + gap)
      setMenuFrame({ left, top: Math.max(margin, top), width })
    }
    updateFrame()
    window.addEventListener('resize', updateFrame)
    window.addEventListener('scroll', updateFrame, true)
    return () => {
      window.removeEventListener('resize', updateFrame)
      window.removeEventListener('scroll', updateFrame, true)
    }
  }, [commandMode, inputRef])

  const replaceCommandSelection = React.useCallback((replacement: string, options?: { closeAfterApply?: boolean }) => {
    const text = String(draft || '')
    const start = Math.max(0, Math.min(text.length, commandSelectionRef.current.start))
    const end = Math.max(start, Math.min(text.length, commandSelectionRef.current.end))
    const next = `${text.slice(0, start)}${replacement}${text.slice(end)}`
    replaceDraftRange({
      input: inputRef.current,
      draft,
      setDraft,
      onCommandDraftChange,
      start,
      end,
      replacement,
    })
    setCommandMode(null)
    setCommandQuery('')
    if (options?.closeAfterApply === true) onCommandDraftApplied?.(next)
  }, [commandSelectionRef, draft, inputRef, onCommandDraftApplied, onCommandDraftChange, setCommandMode, setCommandQuery, setDraft])

  const slashCommandItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => {
    const prefixById: Partial<Record<InlineSlashCommandId, string>> = {
      h1: '# ',
      h2: '## ',
      h3: '### ',
      'bullet-list': '- ',
      'numbered-list': '1. ',
      quote: '> ',
      checklist: '- [ ] ',
    }
    return INLINE_SLASH_COMMAND_ACTIONS
      .filter(action => action.id !== 'heading')
      .map(action => ({
        id: action.id,
        label: action.label,
        group: action.group,
        description: action.description,
        keywords: [...action.keywords],
        onSelect: () => {
          const prefix = prefixById[action.id]
          if (prefix) {
            replaceCurrentLine({ input: inputRef.current, draft, setDraft, onCommandDraftChange, prefix })
            closeCommandMenu()
            return
          }
          if (action.id === 'code-block') {
            const selection = commandSelectionRef.current
            const selected = String(draft || '').slice(selection.start, selection.end) || 'code'
            replaceCommandSelection(`\`\`\`\n${selected}\n\`\`\``)
            return
          }
          if (action.id === 'image' || action.id === 'video') {
            const selection = commandSelectionRef.current
            const selected = String(draft || '').slice(selection.start, selection.end)
            replaceCommandSelection(buildInlineMediaEmbed({ kind: action.id, selectedText: selected }))
            return
          }
          if (action.id === 'divider') {
            const selection = commandSelectionRef.current
            const before = draft.slice(0, selection.start)
            const after = draft.slice(selection.end)
            replaceCommandSelection(`${before && !before.endsWith('\n') ? '\n' : ''}---${after && !after.startsWith('\n') ? '\n' : ''}`)
          }
        },
      }))
  }, [closeCommandMenu, commandSelectionRef, draft, inputRef, onCommandDraftChange, replaceCommandSelection, setDraft])

  const variableCommandItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => {
    const parsed = parseInlineVariableCommandQuery(commandQuery)
    const queryKey = parsed.key
    const mediaCandidates = applyCommandMenuMediaNameDraftsToInlineCandidates(collectInlineMediaCommandCandidates({
      draftText: [commandContextText, draft].filter(Boolean).join('\n'),
    }), mediaNameDrafts).slice(0, 6)
    const mediaCandidateItems = mediaCandidates
      .filter(candidate => !queryKey || candidate.label.toLowerCase().includes(queryKey.toLowerCase()) || candidate.url.toLowerCase().includes(queryKey.toLowerCase()))
      .map(candidate => ({
        id: candidate.id,
        label: candidate.label,
        group: 'Insert media',
        description: candidate.description,
        keywords: candidate.keywords,
        thumbnailKind: candidate.kind,
        thumbnailUrl: candidate.thumbnailUrl,
        onSelect: () => {
          const selection = commandSelectionRef.current
          const selected = String(draft || '').slice(selection.start, selection.end)
          replaceCommandSelection(buildInlineMediaEmbed({
            kind: candidate.kind,
            url: candidate.url,
            thumbnailUrl: candidate.thumbnailUrl,
            label: candidate.label,
            selectedText: selected,
            sourceKey: candidate.sourceKey,
          }), { closeAfterApply: true })
        },
      }))
    const suggestionItems = collectMarkdownVariableBrowseRows({ draftText: draft })
      .filter(row => !queryKey || row.key.toLowerCase().includes(queryKey.toLowerCase()))
      .slice(0, 8)
      .map(row => ({
        id: `var-${row.key}`,
        label: row.key,
        group: 'Variables',
        description: `${row.value || 'Reference variable'}${row.source === 'frontmatter' ? ' from frontmatter' : row.source === 'inline' ? ' from inline content' : ''}`,
        keywords: [row.value, row.source].filter(Boolean) as string[],
        onSelect: () => replaceCommandSelection(buildMarkdownVariableToken({ mode: 'ref', key: row.key })),
      }))
    const canRef = isInlineVariableKey(parsed.key)
    const canCreate = parsed.mode === 'create' && canRef && !!parsed.value
    const canFallback = parsed.mode === 'fallback' && canRef && !!parsed.fallback
    const actionById = Object.fromEntries(INLINE_VARIABLE_COMMAND_ACTIONS.map(action => [action.id, action]))
    const insertReference = actionById['insert-reference']
    const inlineDeclaration = actionById['inline-declaration']
    const fallbackReference = actionById['fallback-reference']
    const mediaInsertActions = (['insert-image', 'insert-video'] as const).map((actionId: InlineVariableCommandId) => {
      const action = actionById[actionId]
      const kind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[actionId]
      const fallbackCandidate = mediaCandidates.find(candidate => candidate.kind === kind)
      return {
        id: action.id,
        label: action.label,
        group: action.group,
        description: fallbackCandidate?.description || action.description,
        keywords: [kind, ...action.keywords].filter(Boolean) as string[],
        thumbnailKind: fallbackCandidate?.kind,
        thumbnailUrl: fallbackCandidate?.thumbnailUrl,
        onSelect: () => {
          const selection = commandSelectionRef.current
          const selected = String(draft || '').slice(selection.start, selection.end)
          replaceCommandSelection(buildInlineMediaEmbed({
            kind,
            url: fallbackCandidate?.url,
            thumbnailUrl: fallbackCandidate?.thumbnailUrl,
            label: fallbackCandidate?.label,
            selectedText: selected,
            sourceKey: fallbackCandidate?.sourceKey,
          }), { closeAfterApply: !!fallbackCandidate?.url })
        },
      }
    })
    const mediaActions = (['image-reference', 'video-reference'] as const).map((actionId: InlineVariableCommandId) => {
      const action = actionById[actionId]
      const key = INLINE_MEDIA_VARIABLE_KEY_BY_ACTION_ID[actionId]
      return {
        id: action.id,
        label: action.label,
        group: action.group,
        description: action.description,
        keywords: [key, ...action.keywords].filter(Boolean) as string[],
        onSelect: () => replaceCommandSelection(buildMarkdownVariableToken({ mode: 'ref', key }) || ''),
      }
    })
    return [
      ...mediaCandidateItems,
      ...mediaInsertActions,
      ...suggestionItems,
      { id: insertReference.id, label: insertReference.label, group: insertReference.group, description: insertReference.description, keywords: [parsed.key, ...insertReference.keywords].filter(Boolean) as string[], disabled: !canRef, onSelect: () => { const token = buildMarkdownVariableToken({ mode: 'ref', key: parsed.key }); if (token) replaceCommandSelection(token) } },
      { id: inlineDeclaration.id, label: inlineDeclaration.label, group: inlineDeclaration.group, description: inlineDeclaration.description, keywords: [parsed.key, ...inlineDeclaration.keywords].filter(Boolean) as string[], disabled: !canCreate, onSelect: () => { const token = buildMarkdownVariableToken({ mode: 'create', key: parsed.key, value: parsed.value }); if (token) replaceCommandSelection(token) } },
      { id: fallbackReference.id, label: fallbackReference.label, group: fallbackReference.group, description: fallbackReference.description, keywords: [parsed.key, ...fallbackReference.keywords].filter(Boolean) as string[], disabled: !canFallback, onSelect: () => { const token = buildMarkdownVariableToken({ mode: 'fallback', key: parsed.key, fallback: parsed.fallback }); if (token) replaceCommandSelection(token) } },
      ...mediaActions,
    ]
  }, [commandContextText, commandQuery, commandSelectionRef, draft, mediaNameDrafts, replaceCommandSelection])

  const keywordCommandItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => {
    return collectInlineKeywordCommandCandidates({
      draftText: [commandContextText, draft].filter(Boolean).join('\n'),
    }).map(candidate => ({
      id: candidate.id,
      label: candidate.label,
      group: candidate.group,
      description: candidate.description,
      keywords: candidate.keywords,
      onSelect: () => replaceCommandSelection(candidate.token || buildInlineKeywordToken(candidate.label)),
    }))
  }, [commandContextText, draft, replaceCommandSelection])

  const commandMenuConfig = commandMode === 'slash'
    ? {
        ariaLabel: 'Card slash commands',
        items: slashCommandItems,
        placeholder: 'Type a command',
        emptyLabel: 'No commands',
      }
    : commandMode === 'variable'
    ? {
        ariaLabel: 'Card variable commands',
        items: variableCommandItems,
        placeholder: 'Find variable or action',
        emptyLabel: 'No variable commands',
      }
    : commandMode === 'keyword'
    ? {
        ariaLabel: 'Card keyword commands',
        items: keywordCommandItems,
        placeholder: 'Find keyword',
        emptyLabel: 'No keyword commands',
      }
    : null

  const commandMenu = commandMode ? (
    <section
      aria-label={commandMenuConfig?.ariaLabel || 'Card commands'}
      className={`fixed z-[1000] rounded border p-2 shadow-lg ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}
      style={menuFrame ? { left: menuFrame.left, top: menuFrame.top, width: menuFrame.width } : undefined}
      {...{ [CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE]: commandMode }}
      onMouseDown={preventDefaultMouseDown}
    >
      <MarkdownBlockContainerCommandMenu
        ariaLabel={commandMenuConfig?.ariaLabel || 'Card commands'}
        items={commandMenuConfig?.items || []}
        query={commandQuery}
        onQueryChange={setCommandQuery}
        onCancel={closeCommandMenu}
        placeholder={commandMenuConfig?.placeholder || 'Find command'}
        inputClassName="w-full bg-transparent text-xs outline-none"
        itemClassName={cardInlineCommandMenuItemClassName}
        itemDangerClassName={cardInlineCommandMenuDangerClassName}
        itemDisabledClassName={cardInlineCommandMenuDisabledClassName}
        emptyLabel={commandMenuConfig?.emptyLabel || 'No commands'}
      />
    </section>
  ) : null
  const commandMenuHost = inputRef.current?.ownerDocument?.body || (typeof document !== 'undefined' ? document.body : null)

  return (
    <>
      <menu className="absolute right-2 top-2 z-10 m-0 flex list-none gap-1 p-0" aria-label="Card inline command launchers" {...{ [CARD_INLINE_TEXT_COMMAND_MENU_ATTRIBUTE]: '1' }}>
        <li className="list-none">
          <button type="button" className={cardInlineCommandButtonClassName} title="Slash commands" onMouseDown={preventDefaultMouseDown} onClick={() => openCommandMenu('slash')}>
            <Slash className={UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME} strokeWidth={1.8} />
          </button>
        </li>
        <li className="list-none">
          <button type="button" className={cardInlineCommandButtonClassName} title="Variable commands" onMouseDown={preventDefaultMouseDown} onClick={() => openCommandMenu('variable')}>
            <AtSign className={UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME} strokeWidth={1.8} />
          </button>
        </li>
        <li className="list-none">
          <button type="button" className={cardInlineCommandButtonClassName} title="Keyword commands" onMouseDown={preventDefaultMouseDown} onClick={() => openCommandMenu('keyword')}>
            <Hash className={UI_RESPONSIVE_COMPACT_GLYPH_CLASSNAME} strokeWidth={1.8} />
          </button>
        </li>
      </menu>
      {commandMenu && commandMenuHost ? createPortal(commandMenu, commandMenuHost) : commandMenu}
    </>
  )
}
