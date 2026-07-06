import React from 'react'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME, CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME } from '@/lib/cards/cardMarkdownPreviewUtils'

type ChatComposerMediaPart =
  | { kind: 'text'; text: string }
  | { kind: 'media'; mediaKind: InlineMediaKind; label: string; thumbnailUrl?: string }

const MARKDOWN_IMAGE_RE = /!\[([^\]\r\n]{0,160})\]\s*\(\s*(<[^>]+>|[^)\s]+)(?:\s+["'][^)]*["'])?\s*\)/gi
const HTML_MEDIA_RE = /<(audio|video)\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi

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

export function buildFloatingPanelChatComposerMediaParts(text: string): { hasMedia: boolean; parts: ChatComposerMediaPart[] } {
  const source = String(text || '')
  const matches = collectComposerMediaMatches(source)
  const parts: ChatComposerMediaPart[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.index < cursor) continue
    if (match.index > cursor) parts.push({ kind: 'text', text: source.slice(cursor, match.index) })
    parts.push({ kind: 'media', mediaKind: match.mediaKind, label: match.label, thumbnailUrl: match.thumbnailUrl })
    cursor = match.index + match.raw.length
  }
  if (cursor < source.length) parts.push({ kind: 'text', text: source.slice(cursor) })
  return { hasMedia: parts.some(part => part.kind === 'media'), parts: parts.length ? parts : [{ kind: 'text', text: source }] }
}

export function FloatingPanelChatComposerMediaOverlay(props: { input: string; uiPanelTextFontClass: string }) {
  const projection = React.useMemo(() => buildFloatingPanelChatComposerMediaParts(props.input), [props.input])
  if (!projection.hasMedia) return null
  return (
    <section
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2 py-1 ${props.uiPanelTextFontClass}`}
      data-kg-chat-input-media-overlay="1"
    >
      {projection.parts.map((part, index) => part.kind === 'media' ? (
        <span key={`media-${index}`} className={`${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME} align-baseline`} data-kg-chat-input-media-chip="1">
          <InlineMediaCommandThumbnail kind={part.mediaKind} thumbnailUrl={part.thumbnailUrl} variant="inline" />
          <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{part.label}</span>
        </span>
      ) : <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>)}
    </section>
  )
}
