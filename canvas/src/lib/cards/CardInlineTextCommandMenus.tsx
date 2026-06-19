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
  INLINE_UPLOAD_MEDIA_VARIABLE_ACTION_ID,
  buildInlineKeywordToken,
  buildInlineMediaEmbed,
  collectInlineKeywordCommandCandidates,
  collectInlineMediaCommandCandidates,
  isInlineVariableKey,
  parseInlineVariableCommandQuery,
  type InlineMediaCommandCandidate,
  type InlineSlashCommandId,
  type InlineVariableCommandId,
} from '@/lib/command-menu/inlineCommandMenuCatalog'
import {
  applyCommandMenuMediaNameDraftsToInlineCandidates,
  useCommandMenuMediaNameDrafts,
} from '@/lib/command-menu/commandMenuMediaNameSync'
import { listUploadedMediaFromKnowgrphStorage } from '@/lib/storage/uploadedMediaStorage'
import {
  buildUploadedMediaPanelItemFromStorage,
  mergeUploadedMediaPanelItems,
  readStoredUploadedMediaPanelItems,
  UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT,
  writeStoredUploadedMediaPanelItems,
  type UploadedMediaPanelItem,
} from '@/lib/storage/uploadedMediaPanelItems'
import { uploadFilesToUploadedMediaPanel } from '@/lib/storage/uploadedMediaPanelUpload'
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

function findInlineCommandTokenRange(args: {
  text: string
  selection: { start: number; end: number }
  sigil: '@' | '/' | '#'
}): { start: number; end: number } {
  const text = String(args.text || '')
  const start = Math.max(0, Math.min(text.length, args.selection.start))
  const end = Math.max(start, Math.min(text.length, args.selection.end))
  const selected = text.slice(start, end)
  if (new RegExp(`^\\${args.sigil}[A-Za-z0-9_.-]{0,96}$`).test(selected)) return { start, end }
  const preceding = text.slice(0, end)
  const match = new RegExp(`\\${args.sigil}[A-Za-z0-9_.-]{0,96}$`).exec(preceding)
  if (match) return { start: end - match[0].length, end }
  return { start: end, end }
}

function insertMarkdownBlockRange(args: {
  text: string
  start: number
  end: number
  block: string
}): { text: string; cursor: number } {
  const text = String(args.text || '').replace(/\r/g, '')
  const block = String(args.block || '').trim()
  const start = Math.max(0, Math.min(text.length, args.start))
  const end = Math.max(start, Math.min(text.length, args.end))
  const before = text.slice(0, start).replace(/[ \t]+$/g, '')
  const after = text.slice(end).replace(/^[ \t]+/g, '')
  const prefix = before ? (before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n') : ''
  const suffix = after ? (after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n') : ''
  const next = `${before}${prefix}${block}${suffix}${after}`
  return { text: next, cursor: before.length + prefix.length + block.length }
}

function readMediaCommandDuplicateNeedle(url: string): string {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid')
    parsed.searchParams.delete('kg_media_token')
    const pathAndQuery = `${parsed.pathname}${parsed.search}`
    return parsed.origin === 'https://example.invalid' ? pathAndQuery : `${parsed.origin}${pathAndQuery}`
  } catch {
    return raw.split('?kg_media_token=')[0]?.trim() || raw
  }
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

function buildUploadedMediaInlineCommandCandidate(item: UploadedMediaPanelItem): InlineMediaCommandCandidate | null {
  if (item.status !== 'synced' || !item.storage) return null
  const url = String(item.linkUrl || item.storage.accessUrl || '').trim()
  if (!url) return null
  const sourceKey = String(item.storage.contentHash || item.storage.objectKey || item.id).trim()
  return {
    id: `uploaded-${item.id}`,
    kind: item.kind,
    url,
    thumbnailUrl: item.kind === 'image' ? url : undefined,
    label: item.name,
    sourceKey,
    description: 'Uploaded media from Cloudflare storage',
    keywords: [item.kind, item.name, sourceKey, url].filter(Boolean),
  }
}

function useUploadedMediaInlineCommandCandidates(): InlineMediaCommandCandidate[] {
  const [uploadedMediaItems, setUploadedMediaItems] = React.useState<UploadedMediaPanelItem[]>(readStoredUploadedMediaPanelItems)

  React.useEffect(() => {
    let cancelled = false
    setUploadedMediaItems(readStoredUploadedMediaPanelItems())
    listUploadedMediaFromKnowgrphStorage().then(storageItems => {
      if (cancelled) return
      const cloudflareItems = storageItems
        .map(buildUploadedMediaPanelItemFromStorage)
        .filter((item): item is UploadedMediaPanelItem => !!item)
      setUploadedMediaItems(prev => {
        const next = mergeUploadedMediaPanelItems([...cloudflareItems, ...readStoredUploadedMediaPanelItems(), ...prev])
        writeStoredUploadedMediaPanelItems(next)
        return next
      })
    }).catch(() => {
      void 0
    })
    return () => {
      cancelled = true
    }
  }, [])
  React.useEffect(() => {
    const onItemsChanged = () => setUploadedMediaItems(readStoredUploadedMediaPanelItems())
    window.addEventListener(UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, onItemsChanged)
    return () => {
      window.removeEventListener(UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, onItemsChanged)
    }
  }, [])

  return React.useMemo(
    () => uploadedMediaItems.flatMap(item => {
      const candidate = buildUploadedMediaInlineCommandCandidate(item)
      return candidate ? [candidate] : []
    }),
    [uploadedMediaItems],
  )
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
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const uploadObjectUrlsRef = React.useRef<Set<string>>(new Set())
  const [inlineUploadItems, setInlineUploadItems] = React.useState<UploadedMediaPanelItem[]>(readStoredUploadedMediaPanelItems)
  const mediaNameDrafts = useCommandMenuMediaNameDrafts()
  const uploadedMediaCommandCandidates = useUploadedMediaInlineCommandCandidates()

  React.useEffect(() => {
    const uploadObjectUrls = uploadObjectUrlsRef.current
    return () => {
      for (const url of uploadObjectUrls) {
        try {
          URL.revokeObjectURL(url)
        } catch {
          void 0
        }
      }
      uploadObjectUrls.clear()
    }
  }, [])

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

  const insertMediaCommand = React.useCallback((candidate: InlineMediaCommandCandidate, options?: { closeAfterApply?: boolean }) => {
    const text = String(draft || '')
    const duplicateNeedle = readMediaCommandDuplicateNeedle(candidate.url)
    if (candidate.url && (text.includes(candidate.url) || (!!duplicateNeedle && text.includes(duplicateNeedle)))) {
      setCommandMode(null)
      setCommandQuery('')
      focusCardInlineTextInputSelectionSoon(inputRef.current, commandSelectionRef.current.end)
      return
    }
    const selection = commandSelectionRef.current
    const selected = text.slice(
      Math.max(0, Math.min(text.length, selection.start)),
      Math.max(0, Math.min(text.length, selection.end)),
    )
    const replaceRange = selected && !/^@[A-Za-z0-9_.-]{0,96}$/.test(selected)
      ? { start: selection.end, end: selection.end }
      : findInlineCommandTokenRange({ text, selection, sigil: '@' })
    const replacement = buildInlineMediaEmbed({
      kind: candidate.kind,
      url: candidate.url,
      thumbnailUrl: candidate.thumbnailUrl,
      label: candidate.label,
      selectedText: selected,
      sourceKey: candidate.sourceKey,
    })
    const next = insertMarkdownBlockRange({
      text,
      start: replaceRange.start,
      end: replaceRange.end,
      block: replacement,
    })
    setDraft(next.text)
    onCommandDraftChange?.(next.text)
    focusCardInlineTextInputSelectionSoon(inputRef.current, next.cursor)
    setCommandMode(null)
    setCommandQuery('')
    if (options?.closeAfterApply === true) onCommandDraftApplied?.(next.text)
  }, [commandSelectionRef, draft, inputRef, onCommandDraftApplied, onCommandDraftChange, setCommandMode, setCommandQuery, setDraft])

  const uploadMediaCommand = React.useCallback(async (fileList: FileList | null) => {
    const results = await uploadFilesToUploadedMediaPanel({
      files: Array.from(fileList || []),
      setItems: setInlineUploadItems,
      registerObjectUrl: url => uploadObjectUrlsRef.current.add(url),
    })
    const first = results[0]
    if (!first) {
      setCommandMode(null)
      setCommandQuery('')
      focusCardInlineTextInputSelectionSoon(inputRef.current, commandSelectionRef.current.end)
      return
    }
    insertMediaCommand({
      id: `uploaded-${first.item.id}`,
      kind: first.item.kind,
      url: first.storage.accessUrl || first.item.linkUrl,
      thumbnailUrl: first.item.kind === 'image' ? first.storage.accessUrl || first.item.linkUrl : undefined,
      label: first.item.name,
      sourceKey: first.storage.contentHash,
      description: 'Uploaded media from Cloudflare storage',
      keywords: [first.item.kind, first.item.name, first.storage.contentHash, first.storage.objectKey].filter(Boolean),
    }, { closeAfterApply: true })
  }, [commandSelectionRef, inputRef, insertMediaCommand, setCommandMode, setCommandQuery])

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
            insertMediaCommand({
              id: `slash-${action.id}`,
              kind: action.id,
              url: '',
              label: selected,
              description: action.description,
              keywords: [...action.keywords],
            })
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
  }, [closeCommandMenu, commandSelectionRef, draft, inputRef, insertMediaCommand, onCommandDraftChange, replaceCommandSelection, setDraft])

  const variableCommandItems = React.useMemo<MarkdownInlineCommandMenuItem[]>(() => {
    const parsed = parseInlineVariableCommandQuery(commandQuery)
    const queryKey = parsed.key
    const mediaCandidates = applyCommandMenuMediaNameDraftsToInlineCandidates([
      ...uploadedMediaCommandCandidates,
      ...collectInlineMediaCommandCandidates({
        draftText: [commandContextText, draft].filter(Boolean).join('\n'),
      }),
    ], mediaNameDrafts).slice(0, 12)
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
        onSelect: () => insertMediaCommand(candidate, { closeAfterApply: true }),
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
    const mediaInsertActions = (['insert-image', 'insert-audio', 'insert-video'] as const).map((actionId: InlineVariableCommandId) => {
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
          insertMediaCommand(fallbackCandidate || {
            id: action.id,
            kind,
            url: '',
            label: '',
            description: action.description,
            keywords: [...action.keywords],
          }, { closeAfterApply: !!fallbackCandidate?.url })
        },
      }
    })
    const mediaActions = (['image-reference', 'audio-reference', 'video-reference'] as const).map((actionId: InlineVariableCommandId) => {
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
    const uploadMediaAction = actionById[INLINE_UPLOAD_MEDIA_VARIABLE_ACTION_ID]
    return [
      {
        id: uploadMediaAction.id,
        label: uploadMediaAction.label,
        group: uploadMediaAction.group,
        description: uploadMediaAction.description,
        keywords: [...uploadMediaAction.keywords],
        onSelect: () => uploadInputRef.current?.click(),
      },
      ...mediaCandidateItems,
      ...mediaInsertActions,
      ...suggestionItems,
      { id: insertReference.id, label: insertReference.label, group: insertReference.group, description: insertReference.description, keywords: [parsed.key, ...insertReference.keywords].filter(Boolean) as string[], disabled: !canRef, onSelect: () => { const token = buildMarkdownVariableToken({ mode: 'ref', key: parsed.key }); if (token) replaceCommandSelection(token) } },
      { id: inlineDeclaration.id, label: inlineDeclaration.label, group: inlineDeclaration.group, description: inlineDeclaration.description, keywords: [parsed.key, ...inlineDeclaration.keywords].filter(Boolean) as string[], disabled: !canCreate, onSelect: () => { const token = buildMarkdownVariableToken({ mode: 'create', key: parsed.key, value: parsed.value }); if (token) replaceCommandSelection(token) } },
      { id: fallbackReference.id, label: fallbackReference.label, group: fallbackReference.group, description: fallbackReference.description, keywords: [parsed.key, ...fallbackReference.keywords].filter(Boolean) as string[], disabled: !canFallback, onSelect: () => { const token = buildMarkdownVariableToken({ mode: 'fallback', key: parsed.key, fallback: parsed.fallback }); if (token) replaceCommandSelection(token) } },
      ...mediaActions,
    ]
  }, [commandContextText, commandQuery, draft, insertMediaCommand, mediaNameDrafts, replaceCommandSelection, uploadedMediaCommandCandidates])

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
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,audio/*,video/*"
        multiple
        className="sr-only"
        aria-label="New Media upload"
        data-kg-inline-media-upload-input="1"
        onChange={event => {
          void uploadMediaCommand(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
      />
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
