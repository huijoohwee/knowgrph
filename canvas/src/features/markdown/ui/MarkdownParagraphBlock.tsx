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
import { MarkdownBlockContainer } from './MarkdownBlockContainer'

type MarkdownParagraphBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  baseTextClass: string
  commonBlockClass: string
  highlightStyle?: React.CSSProperties
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
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
  highlightStyle,
  fragmentsEnabled = false,
  fragmentStep = 0,
  fragmentClassNames,
  fragmentTags,
}: MarkdownParagraphBlockProps) {
  const standaloneHref = isStandaloneLinkParagraph(t as unknown as Token)
  if (standaloneHref && isSafeHref(standaloneHref) && isAbsoluteWebUrl(standaloneHref)) {
    const renderStandaloneMedia = (type: string, children: React.ReactNode) => (
      <MediaWrapper
        type={type}
        srcRaw={standaloneHref}
        startLine={t.startLine}
        endLine={t.endLine || t.startLine}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        opts={opts}
      >
        {children}
      </MediaWrapper>
    )

    const yt = getYouTubeId(standaloneHref)
    if (yt) {
      return renderStandaloneMedia(
        'youtube',
        <MediaIframe
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title="YouTube"
          presentationMode={opts.markdownPresentationMode}
        />,
      )
    }

    const vimeo = getVimeoId(standaloneHref)
    if (vimeo) {
      return renderStandaloneMedia(
        'vimeo',
        <MediaIframe
          src={`https://player.vimeo.com/video/${vimeo}`}
          title="Vimeo"
          presentationMode={opts.markdownPresentationMode}
        />,
      )
    }

    if (isVideoUrl(standaloneHref)) {
      const resolved = resolveHref(standaloneHref, opts.activeDocumentPath)
      const src = applyMediaProxySrc(resolved)
      return renderStandaloneMedia('video', <MediaVideo src={src} />)
    }
  }

  const p = t as unknown as TokensParagraph
  const baseClassName = ['mt-2 mb-2', baseTextClass, commonBlockClass].filter(Boolean).join(' ')
  return (
    <MarkdownBlockContainer
      as="p"
      className={baseClassName}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
    >
      {renderInlineTokens(p.tokens, {
        activeDocumentPath: opts.activeDocumentPath,
        uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
        fragmentOptions:
          opts.markdownPresentationMode && fragmentsEnabled
            ? {
                enabled: true,
                currentStep: fragmentStep,
                classNames: fragmentClassNames || [],
                tags: fragmentTags || [],
              }
            : null,
      })}
    </MarkdownBlockContainer>
  )
})
