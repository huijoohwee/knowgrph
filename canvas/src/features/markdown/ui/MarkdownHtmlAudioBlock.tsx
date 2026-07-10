import React from 'react'

import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MediaWrapper } from './MarkdownMediaUi'
import {
  applyMediaProxySrc,
  deriveSafeLayoutStyleFromClassAttr,
  extractAttr,
  isSafeHref,
  isSafeMediaSrc,
  looksLikeSingleTagBlock,
  parseSafeInlineStyle,
  resolveHref,
} from './markdownPreviewLinks'
import {
  CARD_MARKDOWN_PREVIEW_MEDIA_AUDIO_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_MEDIA_CHROME_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type AudioElementMetadata = {
  autoPlay: boolean
  className: string
  controls: boolean
  loop: boolean
  muted: boolean
  source: string
  styleText: string
}

function parseAudioElement(html: string): AudioElementMetadata | null {
  try {
    if (typeof DOMParser === 'undefined') return null
    const audio = new DOMParser().parseFromString(html, 'text/html').querySelector('audio')
    if (!audio) return null
    const source = String(
      audio.getAttribute('src')
      || audio.getAttribute('data-src')
      || audio.querySelector('source')?.getAttribute('src')
      || audio.querySelector('source')?.getAttribute('data-src')
      || '',
    ).trim()
    if (!source || !isSafeHref(source) || !isSafeMediaSrc(source)) return null
    return {
      source,
      autoPlay: audio.hasAttribute('autoplay'),
      controls: audio.hasAttribute('controls'),
      loop: audio.hasAttribute('loop'),
      muted: audio.hasAttribute('muted'),
      className: audio.getAttribute('class') || '',
      styleText: audio.getAttribute('style') || '',
    }
  } catch {
    return null
  }
}

export function renderMarkdownHtmlAudioBlock(args: {
  highlightClass: string
  highlightStyle?: React.CSSProperties
  html: string
  opts: RenderOpts
  token: TokenWithLines
}): React.ReactNode | null {
  if (!looksLikeSingleTagBlock(args.html, 'audio')) return null
  const parsed = parseAudioElement(args.html)
  const source = parsed?.source || extractAttr(args.html, 'src') || extractAttr(args.html, 'data-src')
  if (!source || !isSafeHref(source) || !isSafeMediaSrc(source)) return null
  const classStyle = deriveSafeLayoutStyleFromClassAttr(parsed?.className || extractAttr(args.html, 'class'))
  const inlineStyle = parseSafeInlineStyle(parsed?.styleText || extractAttr(args.html, 'style'))
  const style: React.CSSProperties | undefined = classStyle || inlineStyle
    ? { ...(classStyle || {}), ...(inlineStyle || {}) }
    : undefined
  if (style?.width && !style.maxWidth) style.maxWidth = '100%'
  const className = args.opts.markdownCardPreviewMode === true
    ? `${CARD_MARKDOWN_PREVIEW_MEDIA_AUDIO_CLASS_NAME} ${CARD_MARKDOWN_PREVIEW_MEDIA_CHROME_CLASS_NAME}`
    : `${CARD_MARKDOWN_PREVIEW_MEDIA_AUDIO_CLASS_NAME} rounded border ${UI_THEME_TOKENS.panel.border}`
  const src = applyMediaProxySrc(resolveHref(source, args.opts.activeDocumentPath))
  return (
    <MediaWrapper type="audio" srcRaw={source} startLine={args.token.startLine} endLine={args.token.endLine || args.token.startLine} highlightClass={args.highlightClass} highlightStyle={args.highlightStyle} opts={args.opts}>
      <audio controls={parsed?.controls !== false} src={src || undefined} className={className} style={style} autoPlay={parsed?.autoPlay || undefined} muted={parsed?.muted || undefined} loop={parsed?.loop || undefined} />
    </MediaWrapper>
  )
}
