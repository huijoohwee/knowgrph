import React from 'react'
import { CHAT_COMMAND_OPTIONS } from '@/features/chat/chatCommandRegistry'
import { CHAT_INVOCATION_OPTIONS } from '@/features/chat/chatInvocationRegistry'
import { CHAT_SKILL_OPTIONS } from '@/features/chat/chatSkillRegistry'
import {
  AGENTIC_OS_INVOCATION_CHIP_ATTR,
  AGENTIC_OS_INVOCATION_SOURCE_ATTR,
  AGENTIC_OS_INVOCATION_TOKEN_ATTR,
  buildAgenticOsInvocationChipAttrs,
  buildAgenticOsInvocationChipTitle,
  readAgenticOsInvocationTokenKind,
  resolveAgenticOsInvocationToken,
} from '@/features/agentic-os/agenticOsInvocationChips'
import { DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME, resolveDataViewChipClass } from '@/features/markdown/ui/dataViewChipStyles'
import { splitInvocationTokenSegments, type InvocationTokenKind } from '@/lib/markdown/invocationTokens'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_TEXT_TOKEN_CHIP_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'

type ChatComposerTextPart = { kind: 'text'; text: string }
type ChatComposerMediaPart = { kind: 'media'; raw: string; mediaKind: InlineMediaKind; label: string; sourceUrl?: string; thumbnailUrl?: string }
type ChatComposerCommandKind = 'slash' | 'keyword' | 'binding'
type ChatComposerCommandPart = { kind: 'command'; commandKind: ChatComposerCommandKind; text: string; source: string; agenticOsInvocation?: boolean }
type ChatComposerMediaProjectionPart = ChatComposerTextPart | ChatComposerMediaPart
type ChatComposerDisplayPart =
  | (ChatComposerTextPart & { displayText: string })
  | (ChatComposerMediaPart & { displayText: string })
type ChatComposerOverlayPart = ChatComposerDisplayPart | ChatComposerCommandPart

const MARKDOWN_IMAGE_RE = /!\[([^\]\r\n]{0,160})\]\s*\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^)]*["'])?\s*\)/gi
const HTML_MEDIA_RE = /<(audio|video)\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi
const CHAT_COMPOSER_MEDIA_BOUNDARY = ' '
const formatComposerSource = (args: { token: string; label?: string; summary?: string; source: string; toolName?: string }): string => [
  args.label ? `${args.token} - ${args.label}` : args.token,
  args.summary || '',
  args.toolName ? `Tool: ${args.toolName}` : '',
  `Source: ${args.source}`,
].filter(Boolean).join('\n')

const CHAT_COMPOSER_SLASH_TOKEN_SOURCES = new Map<string, string>([
  ...CHAT_SKILL_OPTIONS.map(option => [
    option.slashCommand.toLowerCase(),
    formatComposerSource({ token: option.slashCommand, label: option.label, summary: option.summary, source: 'chat skill registry' }),
  ] as const),
  ...CHAT_COMMAND_OPTIONS.map(option => [
    option.slashCommand.toLowerCase(),
    formatComposerSource({ token: option.slashCommand, label: option.label, summary: option.summary, source: 'chat command registry' }),
  ] as const),
])
const CHAT_COMPOSER_KEYWORD_TOKEN_SOURCES = new Map<string, string>(CHAT_INVOCATION_OPTIONS.map(option => [
  option.token.toLowerCase(),
  formatComposerSource({
    token: option.token,
    label: option.label,
    summary: option.summary,
    source: option.sourcePath || 'chat invocation registry',
    toolName: option.toolName,
  }),
]))

const cleanMediaUrl = (raw: string): string => String(raw || '').trim().replace(/^<|>$/g, '')
const readHtmlAttr = (raw: string, name: string): string => {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(raw)
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
}

function collectComposerMediaMatches(text: string): Array<{ index: number; raw: string; mediaKind: InlineMediaKind; label: string; sourceUrl?: string; thumbnailUrl?: string }> {
  const matches: Array<{ index: number; raw: string; mediaKind: InlineMediaKind; label: string; sourceUrl?: string; thumbnailUrl?: string }> = []
  MARKDOWN_IMAGE_RE.lastIndex = 0
  HTML_MEDIA_RE.lastIndex = 0
  for (const match of text.matchAll(MARKDOWN_IMAGE_RE)) {
    const url = cleanMediaUrl(match[2] || '')
    if (!url) continue
    matches.push({ index: match.index || 0, raw: match[0], mediaKind: 'image', label: String(match[1] || 'Image').trim() || 'Image', sourceUrl: url, thumbnailUrl: url })
  }
  for (const match of text.matchAll(HTML_MEDIA_RE)) {
    const mediaKind = String(match[1] || '').toLowerCase() === 'audio' ? 'audio' : 'video'
    const source = match[0]
    const sourceUrl = cleanMediaUrl(match[2] || match[3] || match[4] || '')
    const label = readHtmlAttr(source, 'title') || (mediaKind === 'audio' ? 'Audio' : 'Video')
    const thumbnailUrl = mediaKind === 'video' ? readHtmlAttr(source, 'poster') || undefined : undefined
    matches.push({ index: match.index || 0, raw: match[0], mediaKind, label, sourceUrl, thumbnailUrl })
  }
  return matches.sort((a, b) => a.index - b.index)
}

export function buildFloatingPanelChatComposerMediaParts(text: string): { hasMedia: boolean; parts: ChatComposerMediaProjectionPart[] } {
  const source = String(text || '')
  const matches = collectComposerMediaMatches(source)
  const parts: ChatComposerMediaProjectionPart[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.index < cursor) continue
    if (match.index > cursor) parts.push({ kind: 'text', text: source.slice(cursor, match.index) })
    parts.push({ kind: 'media', raw: match.raw, mediaKind: match.mediaKind, label: match.label, sourceUrl: match.sourceUrl, thumbnailUrl: match.thumbnailUrl })
    cursor = match.index + match.raw.length
  }
  if (cursor < source.length) parts.push({ kind: 'text', text: source.slice(cursor) })
  return { hasMedia: parts.some(part => part.kind === 'media'), parts: parts.length ? parts : [{ kind: 'text', text: source }] }
}

function shouldAddMediaDisplayBoundary(parts: ChatComposerMediaProjectionPart[], index: number): boolean {
  const next = parts[index + 1]
  return !next || (next.kind === 'text' && next.text.length > 0 && !/^\s/.test(next.text))
}

function readMediaDisplayText(parts: ChatComposerMediaProjectionPart[], index: number): string {
  const part = parts[index]
  if (!part || part.kind !== 'media') return ''
  return shouldAddMediaDisplayBoundary(parts, index) ? `${part.label}${CHAT_COMPOSER_MEDIA_BOUNDARY}` : part.label
}

function buildFloatingPanelChatComposerDisplayParts(text: string): { hasMedia: boolean; parts: ChatComposerDisplayPart[] } {
  const projection = buildFloatingPanelChatComposerMediaParts(text)
  return {
    hasMedia: projection.hasMedia,
    parts: projection.parts.map((part, index) => part.kind === 'media'
      ? { ...part, displayText: readMediaDisplayText(projection.parts, index) }
      : { ...part, displayText: part.text }),
  }
}

function readComposerCommandKind(tokenKind: InvocationTokenKind): ChatComposerCommandKind {
  return tokenKind === 'slash' ? 'slash' : tokenKind === 'binding' ? 'binding' : 'keyword'
}

function readComposerCommandSource(token: string, tokenKind: InvocationTokenKind = readAgenticOsInvocationTokenKind(token) || 'keyword'): { commandKind: ChatComposerCommandKind; source: string; agenticOsInvocation?: boolean } | null {
  const normalized = token.toLowerCase()
  const agenticOsInvocation = resolveAgenticOsInvocationToken(token)
  if (agenticOsInvocation) {
    return {
      commandKind: readComposerCommandKind(tokenKind),
      source: buildAgenticOsInvocationChipTitle(token),
      agenticOsInvocation: true,
    }
  }
  const slashSource = CHAT_COMPOSER_SLASH_TOKEN_SOURCES.get(normalized)
  if (slashSource) return { commandKind: 'slash', source: slashSource }
  const keywordSource = CHAT_COMPOSER_KEYWORD_TOKEN_SOURCES.get(normalized)
  if (keywordSource) return { commandKind: 'keyword', source: keywordSource }
  return null
}

function splitComposerCommandChipParts(text: string): ChatComposerOverlayPart[] {
  const source = String(text || '')
  const parts: ChatComposerOverlayPart[] = []
  for (const segment of splitInvocationTokenSegments(source)) {
    if (segment.kind === 'text') {
      if (segment.value) parts.push({ kind: 'text', text: segment.value, displayText: segment.value })
      continue
    }
    const commandSource = readComposerCommandSource(segment.value, segment.tokenKind)
    if (!commandSource) {
      parts.push({ kind: 'text', text: segment.value, displayText: segment.value })
      continue
    }
    parts.push({
      kind: 'command',
      commandKind: commandSource.commandKind,
      text: segment.value,
      source: commandSource.source,
      agenticOsInvocation: commandSource.agenticOsInvocation,
    })
  }
  return parts.length ? parts : [{ kind: 'text', text: source, displayText: source }]
}

export function buildFloatingPanelChatComposerOverlayParts(text: string): { hasMedia: boolean; hasCommandChips: boolean; hasOverlay: boolean; parts: ChatComposerOverlayPart[] } {
  const projection = buildFloatingPanelChatComposerDisplayParts(text)
  const parts = projection.parts.flatMap(part => part.kind === 'media' ? [part] : splitComposerCommandChipParts(part.text))
  const hasCommandChips = parts.some(part => part.kind === 'command')
  return {
    hasMedia: projection.hasMedia,
    hasCommandChips,
    hasOverlay: projection.hasMedia || hasCommandChips,
    parts,
  }
}

export function buildFloatingPanelChatComposerDisplayText(text: string): string {
  return buildFloatingPanelChatComposerDisplayParts(text).parts.map(part => part.displayText).join('')
}

export function resolveFloatingPanelChatComposerRawText(displayText: string, previousRawText: string): string {
  const projection = buildFloatingPanelChatComposerDisplayParts(previousRawText)
  if (!projection.hasMedia) return displayText
  let cursor = 0
  let rawText = ''
  for (const part of projection.parts) {
    if (part.kind !== 'media') continue
    const fullTokenIndex = displayText.indexOf(part.displayText, cursor)
    const labelIndex = fullTokenIndex >= 0 ? -1 : displayText.indexOf(part.label, cursor)
    if (fullTokenIndex < 0 && labelIndex < 0) return displayText
    const index = fullTokenIndex >= 0 ? fullTokenIndex : labelIndex
    const labelEnd = fullTokenIndex >= 0 ? fullTokenIndex + part.displayText.length : labelIndex + part.label.length
    const consumeBoundary = part.displayText.endsWith(CHAT_COMPOSER_MEDIA_BOUNDARY) && displayText[labelEnd] === CHAT_COMPOSER_MEDIA_BOUNDARY
    rawText += displayText.slice(cursor, index)
    rawText += part.raw
    cursor = labelEnd
    if (consumeBoundary) {
      rawText += CHAT_COMPOSER_MEDIA_BOUNDARY
      cursor += CHAT_COMPOSER_MEDIA_BOUNDARY.length
    } else if (fullTokenIndex >= 0 && part.displayText.endsWith(CHAT_COMPOSER_MEDIA_BOUNDARY)) {
      rawText += CHAT_COMPOSER_MEDIA_BOUNDARY
    }
  }
  rawText += displayText.slice(cursor)
  return rawText
}

export function mapFloatingPanelChatComposerRawIndexToDisplayIndex(text: string, rawIndex: number): number {
  const projection = buildFloatingPanelChatComposerDisplayParts(text)
  let rawCursor = 0
  let displayCursor = 0
  for (const part of projection.parts) {
    const rawLength = part.kind === 'media' ? part.raw.length : part.text.length
    const displayLength = part.displayText.length
    if (rawIndex <= rawCursor + rawLength) {
      if (part.kind === 'media') return displayCursor + displayLength
      return displayCursor + Math.max(0, rawIndex - rawCursor)
    }
    rawCursor += rawLength
    displayCursor += displayLength
  }
  return displayCursor
}

export function mapFloatingPanelChatComposerDisplayIndexToRawIndex(text: string, displayIndex: number): number {
  const projection = buildFloatingPanelChatComposerDisplayParts(text)
  let rawCursor = 0
  let displayCursor = 0
  for (const part of projection.parts) {
    const rawLength = part.kind === 'media' ? part.raw.length : part.text.length
    const displayLength = part.displayText.length
    if (displayIndex <= displayCursor + displayLength) {
      if (part.kind === 'media') return rawCursor + rawLength
      return rawCursor + Math.max(0, displayIndex - displayCursor)
    }
    rawCursor += rawLength
    displayCursor += displayLength
  }
  return rawCursor
}

function readComposerOverlayPartDisplayText(part: ChatComposerOverlayPart): string {
  return part.kind === 'media' ? part.displayText : part.text
}

function readComposerMediaSource(part: ChatComposerMediaPart): string {
  return [
    `${part.label} - ${part.mediaKind}`,
    `Source: ${part.sourceUrl || part.raw}`,
  ].join('\n')
}

function readComposerCommandChipClassName(part: ChatComposerCommandPart): string {
  if (!part.agenticOsInvocation) return `pointer-events-auto cursor-help ${CARD_MARKDOWN_PREVIEW_INLINE_TEXT_TOKEN_CHIP_CLASS_NAME} align-baseline`
  return [
    'pointer-events-auto cursor-help align-baseline',
    DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME,
    resolveDataViewChipClass(part.text),
  ].join(' ')
}

function readComposerCommandChipAttrs(part: ChatComposerCommandPart): Record<string, string | undefined> {
  if (!part.agenticOsInvocation) return {}
  const attrs = buildAgenticOsInvocationChipAttrs(part.text) || {}
  return {
    [AGENTIC_OS_INVOCATION_CHIP_ATTR]: attrs[AGENTIC_OS_INVOCATION_CHIP_ATTR],
    [AGENTIC_OS_INVOCATION_TOKEN_ATTR]: attrs[AGENTIC_OS_INVOCATION_TOKEN_ATTR],
    [AGENTIC_OS_INVOCATION_SOURCE_ATTR]: attrs[AGENTIC_OS_INVOCATION_SOURCE_ATTR],
  }
}

function mapFloatingPanelChatComposerOverlayDisplayIndexToRawIndex(text: string, displayIndex: number): number {
  const projection = buildFloatingPanelChatComposerOverlayParts(text)
  let rawCursor = 0
  let displayCursor = 0
  for (const part of projection.parts) {
    const rawLength = part.kind === 'media' ? part.raw.length : readComposerOverlayPartDisplayText(part).length
    const displayLength = readComposerOverlayPartDisplayText(part).length
    if (displayIndex <= displayCursor + displayLength) {
      if (part.kind === 'media') return rawCursor + rawLength
      return rawCursor + Math.max(0, displayIndex - displayCursor)
    }
    rawCursor += rawLength
    displayCursor += displayLength
  }
  return rawCursor
}

export function deleteFloatingPanelChatComposerProjectedTokenDisplayRange(args: {
  text: string
  selectionStart: number
  selectionEnd: number
  direction: 'backward' | 'forward'
}): { text: string; cursor: number } | null {
  const text = String(args.text || '')
  const projection = buildFloatingPanelChatComposerOverlayParts(text)
  if (!projection.hasOverlay) return null
  const displayText = projection.parts.map(readComposerOverlayPartDisplayText).join('')
  const rawSelectionStart = Number.isFinite(args.selectionStart) ? Math.floor(args.selectionStart) : displayText.length
  const rawSelectionEnd = Number.isFinite(args.selectionEnd) ? Math.floor(args.selectionEnd) : rawSelectionStart
  const selectionStart = Math.max(0, Math.min(displayText.length, rawSelectionStart))
  const selectionEnd = Math.max(selectionStart, Math.min(displayText.length, rawSelectionEnd))
  const rangeStart = selectionStart === selectionEnd
    ? args.direction === 'backward'
      ? Math.max(0, selectionStart - 1)
      : selectionStart
    : selectionStart
  const rangeEnd = selectionStart === selectionEnd
    ? args.direction === 'backward'
      ? selectionStart
      : Math.min(displayText.length, selectionEnd + 1)
    : selectionEnd
  if (rangeStart === rangeEnd) return null
  const mappedRangeStart = mapFloatingPanelChatComposerOverlayDisplayIndexToRawIndex(text, rangeStart)
  const mappedRangeEnd = mapFloatingPanelChatComposerOverlayDisplayIndexToRawIndex(text, rangeEnd)
  let rawCursor = 0
  let displayCursor = 0
  for (const part of projection.parts) {
    const displayPartText = readComposerOverlayPartDisplayText(part)
    const rawLength = part.kind === 'media' ? part.raw.length : displayPartText.length
    const displayLength = displayPartText.length
    const rawStart = rawCursor
    const rawEnd = rawCursor + rawLength
    const displayStart = displayCursor
    const displayEnd = displayCursor + displayLength
    rawCursor = rawEnd
    displayCursor = displayEnd
    if (part.kind === 'text') continue
    const intersectsToken = rangeStart < displayEnd && rangeEnd > displayStart
    const deletesWhitespaceAfterToken = selectionStart === selectionEnd && args.direction === 'backward' && rangeStart === displayEnd && /\s/.test(displayText.slice(rangeStart, rangeEnd))
    const deletesWhitespaceBeforeToken = selectionStart === selectionEnd && args.direction === 'forward' && rangeEnd === displayStart && /\s/.test(displayText.slice(rangeStart, rangeEnd))
    if (!intersectsToken && !deletesWhitespaceAfterToken && !deletesWhitespaceBeforeToken) continue
    const deleteRawStart = Math.min(rawStart, mappedRangeStart)
    const deleteRawEnd = Math.max(rawEnd, mappedRangeEnd)
    return {
      text: `${text.slice(0, deleteRawStart)}${text.slice(deleteRawEnd)}`,
      cursor: displayStart,
    }
  }
  return null
}

export function FloatingPanelChatComposerMediaOverlay(props: { input: string; uiPanelTextFontClass: string }) {
  const projection = React.useMemo(() => buildFloatingPanelChatComposerOverlayParts(props.input), [props.input])
  if (!projection.hasOverlay) return null
  return (
    <section
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2 py-1 ${props.uiPanelTextFontClass}`}
      data-kg-chat-input-overlay="1"
      data-kg-chat-input-media-overlay={projection.hasMedia ? '1' : undefined}
    >
      {projection.parts.map((part, index) => part.kind === 'media' ? (
        projection.hasCommandChips ? (
          <span
            key={`media-${index}`}
            className="relative align-baseline text-transparent"
            data-kg-chat-input-media-metric="inline-text"
            data-kg-chat-input-media-token={part.label}
          >
            <span className="whitespace-pre-wrap">{part.displayText}</span>
            <span
              className={`pointer-events-auto absolute left-0 top-1/2 max-w-full -translate-y-1/2 cursor-help overflow-hidden ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME} !mr-0 align-baseline`}
              data-kg-chat-input-media-chip="1"
              data-kg-chat-input-media-render="preserve"
              data-kg-chat-input-media-source={part.sourceUrl || part.raw}
              title={readComposerMediaSource(part)}
            >
              <InlineMediaCommandThumbnail kind={part.mediaKind} thumbnailUrl={part.thumbnailUrl} variant="inline" />
              <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{part.label}</span>
            </span>
          </span>
        ) : (
          <span
            key={`media-${index}`}
            className="relative inline-block max-w-full align-baseline text-transparent"
            data-kg-chat-input-media-metric="preserve"
          >
            <span className="whitespace-pre">{part.displayText}</span>
            <span
              className={`pointer-events-auto absolute left-0 top-1/2 w-full max-w-full -translate-y-1/2 cursor-help overflow-hidden ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME} !mr-0 align-baseline`}
              data-kg-chat-input-media-chip="1"
              data-kg-chat-input-media-source={part.sourceUrl || part.raw}
              title={readComposerMediaSource(part)}
            >
              <InlineMediaCommandThumbnail kind={part.mediaKind} thumbnailUrl={part.thumbnailUrl} variant="inline" />
              <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{part.label}</span>
            </span>
          </span>
        )
      ) : part.kind === 'command' ? (
        <span
          key={`command-${index}`}
          className={readComposerCommandChipClassName(part)}
          data-kg-chat-input-command-chip={part.commandKind}
          data-kg-chat-input-command-metric="preserve"
          data-kg-chat-input-command-source={part.source}
          data-kg-chat-input-command-token={part.text}
          title={part.source}
          {...readComposerCommandChipAttrs(part)}
        >
          {part.text}
        </span>
      ) : <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>)}
    </section>
  )
}
