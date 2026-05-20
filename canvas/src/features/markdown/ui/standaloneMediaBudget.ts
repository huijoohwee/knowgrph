import { normalizeWebpageLikeUrl } from 'grph-shared/url'
import {
  buildYouTubeTimestampPreviewDescriptor,
  getYouTubeId,
  stripYouTubeUrlTrailingPunctuation,
} from 'grph-shared/rich-media/providers'
import type { TokenWithLines } from './markdownPreviewLex'
import type { Token, TokensLink, TokensParagraph, TokensText } from './MarkdownTokens'

const DEFAULT_LARGE_DOCUMENT_YOUTUBE_VIDEO_LIMIT = 4
const TRAILING_URL_PUNCTUATION_RE = /^[),.;:!?]+$/

const readStandaloneUrlLine = (line: string): string => {
  const raw = String(line || '').trim()
  if (!raw) return ''
  const angle = raw.match(/^<([^<>\s]+)>$/)
  if (angle?.[1]) return stripYouTubeUrlTrailingPunctuation(angle[1])
  const link = raw.match(/^\[([^\]]*)\]\(([^)\s]+)\)$/)
  if (link?.[2]) {
    const href = stripYouTubeUrlTrailingPunctuation(link[2])
    const label = String(link[1] || '').trim()
    if (!label || label === href || label === link[2]) return href
  }
  if (/^https?:\/\/\S+$/i.test(raw)) return stripYouTubeUrlTrailingPunctuation(raw)
  return ''
}

const hasInlineMediaToken = (tokens: Token[] | undefined): boolean => {
  const list = Array.isArray(tokens) ? tokens : []
  for (const t of list) {
    const type = String((t as unknown as { type?: unknown }).type || '')
    if (type === 'image' || type === 'html') return true
    const nested = (t as unknown as { tokens?: unknown }).tokens
    if (Array.isArray(nested) && hasInlineMediaToken(nested as Token[])) return true
  }
  return false
}

const readInlineTokenPlainText = (tokens: Token[] | undefined): string => {
  const list = Array.isArray(tokens) ? tokens : []
  let out = ''
  for (const token of list) {
    const type = String((token as unknown as { type?: unknown }).type || '')
    if (type === 'text') {
      out += String((token as unknown as TokensText).text || '')
      continue
    }
    const nested = (token as unknown as { tokens?: unknown }).tokens
    if (Array.isArray(nested)) {
      out += readInlineTokenPlainText(nested as Token[])
      continue
    }
    const raw = String((token as unknown as { raw?: unknown }).raw || '')
    if (raw) out += raw
  }
  return out
}

const isSemanticTimestampPreviewLink = (link: TokensLink): boolean => {
  const href = stripYouTubeUrlTrailingPunctuation(String(link.href || ''))
  if (!href) return false
  const preview = buildYouTubeTimestampPreviewDescriptor(href)
  if (!preview?.timestampLabel) return false
  const label = readInlineTokenPlainText(link.tokens).trim()
  return !!label && label === preview.timestampLabel
}

export function readStandaloneParagraphUrlToken(
  token: Token | TokenWithLines,
  opts?: { rejectLinkedMedia?: boolean },
): string {
  if (token.type !== 'paragraph') return ''
  const inner = Array.isArray((token as unknown as TokensParagraph).tokens)
    ? ((token as unknown as TokensParagraph).tokens as Token[])
    : []
  let href = ''
  for (const t of inner) {
    const type = String((t as unknown as { type?: unknown }).type || '')
    if (type === 'space' || type === 'softbreak' || type === 'br') continue
    if (type === 'text') {
      const text = String((t as unknown as TokensText).text || '').trim()
      if (!text) continue
      if (href && TRAILING_URL_PUNCTUATION_RE.test(text)) continue
      if (!href) return readStandaloneUrlLine(text)
      return ''
    }
    if (type === 'link') {
      if (href) return ''
      const link = t as unknown as TokensLink
      if (opts?.rejectLinkedMedia && hasInlineMediaToken(link.tokens)) return ''
      if (isSemanticTimestampPreviewLink(link)) return ''
      href = stripYouTubeUrlTrailingPunctuation(String(link.href || ''))
      continue
    }
    return ''
  }
  return href
}

export function buildStandaloneMediaRenderLineSetFromTokens(args: {
  markdownLargeDocumentMode: boolean
  tokens: TokenWithLines[]
  maxYouTubeVideos?: number
}): ReadonlySet<number> | null {
  if (!args.markdownLargeDocumentMode) return null
  const maxYouTubeVideos = Math.max(0, Math.floor(Number.isFinite(args.maxYouTubeVideos) ? Number(args.maxYouTubeVideos) : DEFAULT_LARGE_DOCUMENT_YOUTUBE_VIDEO_LIMIT))
  if (maxYouTubeVideos <= 0) return new Set()
  const allowedLines = new Set<number>()
  const seenYouTubeIds = new Set<string>()
  for (const token of Array.isArray(args.tokens) ? args.tokens : []) {
    const videoId = getYouTubeId(normalizeWebpageLikeUrl(readStandaloneParagraphUrlToken(token)))
    if (!videoId || seenYouTubeIds.has(videoId)) continue
    seenYouTubeIds.add(videoId)
    allowedLines.add(Math.max(1, Math.floor(token.startLine || 1)))
    if (seenYouTubeIds.size >= maxYouTubeVideos) break
  }
  return allowedLines
}
