import React from 'react'
import { CHAT_COMMAND_OPTIONS } from '@/features/chat/chatCommandRegistry'
import { CHAT_INVOCATION_OPTIONS } from '@/features/chat/chatInvocationRegistry'
import { CHAT_SKILL_OPTIONS } from '@/features/chat/chatSkillRegistry'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_TEXT_TOKEN_CHIP_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'

type ChatComposerTextPart = { kind: 'text'; text: string }
type ChatComposerMediaPart = { kind: 'media'; raw: string; mediaKind: InlineMediaKind; label: string; thumbnailUrl?: string }
type ChatComposerCommandPart = { kind: 'command'; commandKind: 'slash' | 'keyword'; text: string }
type ChatComposerMediaProjectionPart = ChatComposerTextPart | ChatComposerMediaPart
type ChatComposerDisplayPart =
  | (ChatComposerTextPart & { displayText: string })
  | (ChatComposerMediaPart & { displayText: string })
type ChatComposerOverlayPart = ChatComposerDisplayPart | ChatComposerCommandPart

const MARKDOWN_IMAGE_RE = /!\[([^\]\r\n]{0,160})\]\s*\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^)]*["'])?\s*\)/gi
const HTML_MEDIA_RE = /<(audio|video)\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi
const CHAT_COMPOSER_COMMAND_TOKEN_RE = /(^|[\s([{,;])([/#][A-Za-z][A-Za-z0-9._-]*)(?=$|[\s)\]},;:!?])/g
const CHAT_COMPOSER_MEDIA_BOUNDARY = ' '
const CHAT_COMPOSER_SLASH_TOKENS = new Set([
  ...CHAT_SKILL_OPTIONS.map(option => option.slashCommand.toLowerCase()),
  ...CHAT_COMMAND_OPTIONS.map(option => option.slashCommand.toLowerCase()),
])
const CHAT_COMPOSER_KEYWORD_TOKENS = new Set(CHAT_INVOCATION_OPTIONS.map(option => option.token.toLowerCase()))

const cleanMediaUrl = (raw: string): string => String(raw || '').trim().replace(/^<|>$/g, '')
const readHtmlAttr = (raw: string, name: string): string => {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(raw)
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
}

function collectComposerMediaMatches(text: string): Array<{ index: number; raw: string; mediaKind: InlineMediaKind; label: string; thumbnailUrl?: string }> {
  const matches: Array<{ index: number; raw: string; mediaKind: InlineMediaKind; label: string; thumbnailUrl?: string }> = []
  MARKDOWN_IMAGE_RE.lastIndex = 0
  HTML_MEDIA_RE.lastIndex = 0
  for (const match of text.matchAll(MARKDOWN_IMAGE_RE)) {
    const url = cleanMediaUrl(match[2] || '')
    if (!url) continue
    matches.push({ index: match.index || 0, raw: match[0], mediaKind: 'image', label: String(match[1] || 'Image').trim() || 'Image', thumbnailUrl: url })
  }
  for (const match of text.matchAll(HTML_MEDIA_RE)) {
    const mediaKind = String(match[1] || '').toLowerCase() === 'audio' ? 'audio' : 'video'
    const source = match[0]
    const label = readHtmlAttr(source, 'title') || (mediaKind === 'audio' ? 'Audio' : 'Video')
    const thumbnailUrl = mediaKind === 'video' ? readHtmlAttr(source, 'poster') || undefined : undefined
    matches.push({ index: match.index || 0, raw: match[0], mediaKind, label, thumbnailUrl })
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
    parts.push({ kind: 'media', raw: match.raw, mediaKind: match.mediaKind, label: match.label, thumbnailUrl: match.thumbnailUrl })
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

function readComposerCommandKind(token: string): ChatComposerCommandPart['commandKind'] | null {
  const normalized = token.toLowerCase()
  if (CHAT_COMPOSER_SLASH_TOKENS.has(normalized)) return 'slash'
  if (CHAT_COMPOSER_KEYWORD_TOKENS.has(normalized)) return 'keyword'
  return null
}

function splitComposerCommandChipParts(text: string): ChatComposerOverlayPart[] {
  const source = String(text || '')
  const parts: ChatComposerOverlayPart[] = []
  let cursor = 0
  CHAT_COMPOSER_COMMAND_TOKEN_RE.lastIndex = 0
  for (const match of source.matchAll(CHAT_COMPOSER_COMMAND_TOKEN_RE)) {
    const prefix = match[1] || ''
    const token = match[2] || ''
    const commandKind = readComposerCommandKind(token)
    if (!commandKind) continue
    const tokenStart = (match.index || 0) + prefix.length
    const tokenEnd = tokenStart + token.length
    if (tokenStart > cursor) {
      const textPart = source.slice(cursor, tokenStart)
      parts.push({ kind: 'text', text: textPart, displayText: textPart })
    }
    parts.push({ kind: 'command', commandKind, text: source.slice(tokenStart, tokenEnd) })
    cursor = tokenEnd
  }
  if (cursor < source.length) {
    const textPart = source.slice(cursor)
    parts.push({ kind: 'text', text: textPart, displayText: textPart })
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
            <span className={`pointer-events-none absolute left-0 top-1/2 max-w-full -translate-y-1/2 overflow-hidden ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME} !mr-0 align-baseline`} data-kg-chat-input-media-chip="1" data-kg-chat-input-media-render="preserve">
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
            <span className={`pointer-events-none absolute left-0 top-1/2 w-full max-w-full -translate-y-1/2 overflow-hidden ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME} !mr-0 align-baseline`} data-kg-chat-input-media-chip="1">
              <InlineMediaCommandThumbnail kind={part.mediaKind} thumbnailUrl={part.thumbnailUrl} variant="inline" />
              <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{part.label}</span>
            </span>
          </span>
        )
      ) : part.kind === 'command' ? (
        <span
          key={`command-${index}`}
          className={`${CARD_MARKDOWN_PREVIEW_INLINE_TEXT_TOKEN_CHIP_CLASS_NAME} align-baseline`}
          data-kg-chat-input-command-chip={part.commandKind}
          data-kg-chat-input-command-metric="preserve"
          data-kg-chat-input-command-token={part.text}
        >
          {part.text}
        </span>
      ) : <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>)}
    </section>
  )
}
