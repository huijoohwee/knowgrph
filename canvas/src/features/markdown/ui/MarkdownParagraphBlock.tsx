import React from 'react'
import type { Token, TokensParagraph, TokensGeneric, TokensLink } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import {
  applyMediaProxySrc,
  getVimeoId,
  getYouTubeId,
  isAbsoluteWebUrl,
  isSafeHref,
  isVideoUrl,
  resolveHref,
} from '@/features/markdown/ui/markdownPreviewLinks'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import { MediaWrapper, MediaIframe, MediaVideo } from './MarkdownMediaUi'
import type { RenderOpts } from './MarkdownRendererTypes'

type MarkdownParagraphBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  baseTextClass: string
  commonBlockClass: string
}

const isStandaloneLinkParagraph = (token: Token): string | null => {
  const p = token as unknown as TokensParagraph
  const inner = Array.isArray(p.tokens) ? p.tokens : []
  if (inner.length !== 1) return null
  const only = inner[0] as unknown as TokensGeneric
  if (only.type !== 'link') return null
  const link = only as unknown as TokensLink
  const href = String(link.href || '').trim()
  return href || null
}

export const MarkdownParagraphBlock = React.memo(function MarkdownParagraphBlock({
  token: t,
  highlightClass,
  opts,
  baseTextClass,
  commonBlockClass,
}: MarkdownParagraphBlockProps) {
  // Check for standalone media links
  const standaloneHref = isStandaloneLinkParagraph(t as unknown as Token)
  
  if (standaloneHref && isSafeHref(standaloneHref) && isAbsoluteWebUrl(standaloneHref)) {
    // YouTube
    const yt = getYouTubeId(standaloneHref)
    if (yt) {
      return (
        <MediaWrapper
          type="youtube"
          srcRaw={standaloneHref}
          startLine={t.startLine}
          highlightClass={highlightClass}
          opts={opts}
        >
          <MediaIframe
            src={`https://www.youtube-nocookie.com/embed/${yt}`}
            title="YouTube"
            presentationMode={opts.markdownPresentationMode}
          />
        </MediaWrapper>
      )
    }

    // Vimeo
    const vimeo = getVimeoId(standaloneHref)
    if (vimeo) {
      return (
        <MediaWrapper
          type="vimeo"
          srcRaw={standaloneHref}
          startLine={t.startLine}
          highlightClass={highlightClass}
          opts={opts}
        >
          <MediaIframe
            src={`https://player.vimeo.com/video/${vimeo}`}
            title="Vimeo"
            presentationMode={opts.markdownPresentationMode}
          />
        </MediaWrapper>
      )
    }

    // Direct Video
    if (isVideoUrl(standaloneHref)) {
      const resolved = resolveHref(standaloneHref, opts.activeDocumentPath)
      const src = applyMediaProxySrc(resolved)
      return (
        <MediaWrapper
          type="video"
          srcRaw={standaloneHref}
          startLine={t.startLine}
          highlightClass={highlightClass}
          opts={opts}
        >
          <MediaVideo src={src} />
        </MediaWrapper>
      )
    }
  }

  // Regular Paragraph
  const p = t as unknown as TokensParagraph
  return (
    <p
      className={[
        'mt-2 mb-2',
        baseTextClass,
        commonBlockClass,
        highlightClass,
      ].filter(Boolean).join(' ')}
    >
      {renderInlineTokens(p.tokens, { activeDocumentPath: opts.activeDocumentPath, uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass })}
    </p>
  )
})
