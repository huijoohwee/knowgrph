import React from 'react'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { collectFloatingPanelChatMediaTokens } from './floatingPanelChatMediaTokens'
import { splitInvocationTokenSegments, type InvocationTokenKind } from '@/lib/markdown/invocationTokens'
import { buildAgenticOsInvocationChipAttrs, buildAgenticOsInvocationChipTitle } from '@/features/agentic-os/agenticOsInvocationChips'
import { DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME, resolveDataViewChipClass } from '@/features/markdown/ui/dataViewChipStyles'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import { UI_TEXT_TRUNCATE_CHIP } from '@/lib/ui/textLayout'
import { CHAT_INVOCATION_OPTIONS } from '../chatInvocationRegistry'
import { CHAT_SKILL_OPTIONS } from '../chatSkillRegistry'

type ChatComposerTextPart = { kind: 'text'; text: string }
type ChatComposerMediaPart = { kind: 'media'; raw: string; mediaKind: InlineMediaKind; label: string; sourceUrl?: string; thumbnailUrl?: string }
type ChatComposerMediaProjectionPart = ChatComposerTextPart | ChatComposerMediaPart
type ChatComposerInvocationMetricKind = InvocationTokenKind
type ChatComposerInvocationMetricPart = { kind: 'invocation'; tokenKind: ChatComposerInvocationMetricKind; text: string; displayText: string }
type ChatComposerDisplayPart =
  | (ChatComposerTextPart & { displayText: string })
  | (ChatComposerMediaPart & { displayText: string })
type ChatComposerOverlayPart = ChatComposerDisplayPart | ChatComposerInvocationMetricPart

const CHAT_COMPOSER_MEDIA_BOUNDARY = ' '
const CHAT_COMPOSER_MEDIA_INVOCATION_PREFIX = '@'
export const FLOATING_PANEL_CHAT_COMPOSER_PROJECTED_LAYOUT_CLASS_NAME =
  'kg-floating-chat-composer-projected leading-6 [--kg-multiline-text-input-editor-height:6.75rem] [--kg-multiline-text-input-editor-min-height:6.75rem]'
const FLOATING_PANEL_CHAT_COMPOSER_VISIBLE_INVOCATION_CHIP_CLASS_NAME =
  'absolute left-0 top-1/2 w-full max-w-full -translate-y-1/2 !border-0 !px-0 shadow-[inset_0_0_0_1px_var(--kg-border)]'

const formatComposerInvocationSource = (args: { token: string; label?: string; summary?: string; source: string; toolName?: string }): string => [
  args.label ? `${args.token} - ${args.label}` : args.token,
  args.summary || '',
  args.toolName ? `Tool: ${args.toolName}` : '',
  `Source: ${args.source}`,
].filter(Boolean).join('\n')

const CHAT_COMPOSER_SLASH_INVOCATION_SOURCES = new Map(CHAT_SKILL_OPTIONS.map(option => [
  option.slashCommand.toLowerCase(),
  formatComposerInvocationSource({ token: option.slashCommand, label: option.label, summary: option.summary, source: 'chat skill registry' }),
] as const))

const CHAT_COMPOSER_KEYWORD_INVOCATION_SOURCES = new Map(CHAT_INVOCATION_OPTIONS.map(option => [
  option.token.toLowerCase(),
  formatComposerInvocationSource({
    token: option.token,
    label: option.label,
    summary: option.summary,
    source: option.sourcePath || 'chat invocation registry',
    toolName: option.toolName,
  }),
] as const))

export function buildFloatingPanelChatComposerMediaParts(text: string): { hasMedia: boolean; parts: ChatComposerMediaProjectionPart[] } {
  const source = String(text || '')
  const matches = collectFloatingPanelChatMediaTokens(source)
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
  const label = readMediaDisplayLabel(part)
  return shouldAddMediaDisplayBoundary(parts, index) ? `${label}${CHAT_COMPOSER_MEDIA_BOUNDARY}` : label
}

function readMediaDisplayLabel(part: ChatComposerMediaPart): string {
  const label = String(part.label || '').trim() || 'media'
  return label.startsWith(CHAT_COMPOSER_MEDIA_INVOCATION_PREFIX) ? label : `${CHAT_COMPOSER_MEDIA_INVOCATION_PREFIX}${label}`
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

export function buildFloatingPanelChatComposerOverlayParts(text: string): { hasMedia: boolean; hasOverlay: boolean; parts: ChatComposerOverlayPart[] } {
  const projection = buildFloatingPanelChatComposerDisplayParts(text)
  const parts = projection.parts.flatMap(part => part.kind === 'text' ? splitComposerInvocationMetricParts(part.text) : [part])
  const hasInvocationChips = parts.some(part => part.kind === 'invocation')
  return {
    hasMedia: projection.hasMedia,
    hasOverlay: projection.hasMedia || hasInvocationChips,
    parts,
  }
}

function shouldProjectComposerInvocationMetric(tokenKind: InvocationTokenKind): tokenKind is ChatComposerInvocationMetricKind {
  return tokenKind === 'slash' || tokenKind === 'keyword' || tokenKind === 'binding'
}

function splitComposerInvocationMetricParts(text: string): ChatComposerOverlayPart[] {
  const segments = splitInvocationTokenSegments(text)
  return segments.map(segment => {
    if (segment.kind === 'text') return { kind: 'text', text: segment.value, displayText: segment.value }
    if (!shouldProjectComposerInvocationMetric(segment.tokenKind)) return { kind: 'text', text: segment.value, displayText: segment.value }
    return {
      kind: 'invocation',
      tokenKind: segment.tokenKind,
      text: segment.value,
      displayText: segment.value,
    }
  })
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
    const displayLabel = readMediaDisplayLabel(part)
    const labelIndex = fullTokenIndex >= 0 ? -1 : displayText.indexOf(displayLabel, cursor)
    if (fullTokenIndex < 0 && labelIndex < 0) return displayText
    const index = fullTokenIndex >= 0 ? fullTokenIndex : labelIndex
    const labelEnd = fullTokenIndex >= 0 ? fullTokenIndex + part.displayText.length : labelIndex + displayLabel.length
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
  return part.kind === 'text' ? part.text : part.displayText
}

function readComposerMediaSource(part: ChatComposerMediaPart): string {
  return [
    `${part.label} - ${part.mediaKind}`,
    `Source: ${part.sourceUrl || part.raw}`,
  ].join('\n')
}

function readComposerInvocationChipClassName(part: ChatComposerInvocationMetricPart): string {
  return [
    'pointer-events-auto cursor-help no-underline',
    DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME,
    resolveDataViewChipClass(part.text),
  ].join(' ')
}

function readComposerInvocationSourceTitle(part: ChatComposerInvocationMetricPart): string {
  const agenticTitle = buildAgenticOsInvocationChipTitle(part.text)
  if (agenticTitle) return agenticTitle
  const normalized = part.text.toLowerCase()
  if (part.tokenKind === 'slash') {
    const source = CHAT_COMPOSER_SLASH_INVOCATION_SOURCES.get(normalized)
    if (source) return source
  }
  if (part.tokenKind === 'keyword') {
    const source = CHAT_COMPOSER_KEYWORD_INVOCATION_SOURCES.get(normalized)
    if (source) return source
  }
  return formatComposerInvocationSource({
    token: part.text,
    label: part.tokenKind === 'binding' ? 'Binding reference' : 'Invocation token',
    summary: 'Composer token preserved as visible invocation grammar.',
    source: 'FloatingPanel Chat composer',
  })
}

function renderComposerInvocationChip(part: ChatComposerInvocationMetricPart, key: string): React.ReactNode {
  const className = readComposerInvocationChipClassName(part)
  const sourceTitle = readComposerInvocationSourceTitle(part)
  const agenticAttrs = buildAgenticOsInvocationChipAttrs(part.text) || {}
  const metricAttrs = {
    'data-kg-chat-input-invocation-kind': part.tokenKind,
    'data-kg-chat-input-invocation-metric': 'preserve',
    'data-kg-chat-input-invocation-token': part.text,
  }
  const chipAttrs = {
    ...agenticAttrs,
    'data-kg-chat-input-invocation-chip': part.tokenKind,
    'data-kg-chat-input-invocation-kind': part.tokenKind,
    'data-kg-chat-input-invocation-source': sourceTitle,
    'data-kg-chat-input-invocation-token': part.text,
  }
  const children = <span className={UI_TEXT_TRUNCATE_CHIP}>{part.displayText}</span>
  return (
    <span
      key={key}
      className="relative inline-block max-w-full align-baseline"
      {...metricAttrs}
    >
      <span className="whitespace-pre text-transparent">{part.displayText}</span>
      <span
        aria-label={sourceTitle}
        className={`${className} ${FLOATING_PANEL_CHAT_COMPOSER_VISIBLE_INVOCATION_CHIP_CLASS_NAME}`}
        title={sourceTitle}
        data-kg-card-inline-keyword-pill="1"
        {...chipAttrs}
      >
        {children}
      </span>
    </span>
  )
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

export function isFloatingPanelChatComposerProjectedCaretInsideChip(text: string, selectionStart: number, selectionEnd: number): boolean {
  if (selectionStart !== selectionEnd) return false
  const projection = buildFloatingPanelChatComposerOverlayParts(text)
  if (!projection.hasOverlay) return false
  const displayText = projection.parts.map(readComposerOverlayPartDisplayText).join('')
  const cursor = Math.max(0, Math.min(displayText.length, Number.isFinite(selectionStart) ? Math.floor(selectionStart) : displayText.length))
  let displayCursor = 0
  for (const part of projection.parts) {
    const displayPartText = readComposerOverlayPartDisplayText(part)
    const displayEnd = displayCursor + displayPartText.length
    const isProjectedChip = part.kind === 'media' || part.kind === 'invocation'
    if (isProjectedChip && cursor >= displayCursor && cursor <= displayEnd) return true
    if (isProjectedChip && cursor > displayEnd && cursor <= displayEnd + 1 && /^\s*$/.test(displayText.slice(displayEnd, cursor))) return true
    displayCursor = displayEnd
  }
  return false
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
    if (part.kind !== 'media') continue
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
      className={`pointer-events-none absolute inset-0 z-10 overflow-hidden whitespace-pre-wrap break-words px-2 py-1 ${props.uiPanelTextFontClass} ${FLOATING_PANEL_CHAT_COMPOSER_PROJECTED_LAYOUT_CLASS_NAME}`}
      data-kg-chat-input-overlay="1"
      data-kg-chat-input-media-overlay={projection.hasMedia ? '1' : undefined}
    >
      {projection.parts.map((part, index) => part.kind === 'media' ? (
          <span
            key={`media-${index}`}
            className="relative inline-block max-w-full align-baseline text-transparent"
            data-kg-chat-input-media-metric="preserve"
            data-kg-chat-input-media-token={readMediaDisplayLabel(part)}
          >
            <span className="whitespace-pre">{part.displayText}</span>
            <span
              className={`pointer-events-auto absolute left-0 top-1/2 w-full max-w-full -translate-y-1/2 cursor-help overflow-hidden bg-[color:var(--kg-panel-bg)] shadow-sm ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME} !mr-0 align-baseline`}
              data-kg-chat-input-media-chip="1"
              data-kg-chat-input-media-source={part.sourceUrl || part.raw}
              title={readComposerMediaSource(part)}
            >
              <InlineMediaCommandThumbnail kind={part.mediaKind} thumbnailUrl={part.thumbnailUrl} variant="inline" />
              <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{readMediaDisplayLabel(part)}</span>
            </span>
          </span>
      ) : part.kind === 'invocation' ? renderComposerInvocationChip(part, `invocation-${index}`) : <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>)}
    </section>
  )
}
