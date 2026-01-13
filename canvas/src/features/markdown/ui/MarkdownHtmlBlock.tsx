import React from 'react'
import type { TokensHTML } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import {
  applyMediaProxySrc,
  extractAttr,
  isSafeHref,
  isSafeMediaSrc,
  looksLikeSingleTagBlock,
  parseHtmlNumberAttr,
  resolveHref,
  renderSafeHtmlBlock,
} from '@/features/markdown/ui/markdownPreviewLinks'
import { MediaWrapper, MediaIframe, MediaVideo, MediaImage } from './MarkdownMediaUi'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'

type MarkdownHtmlBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
  highlightStyle?: React.CSSProperties
  fragmentsEnabled?: boolean
  fragmentStep?: number
  fragmentClassNames?: string[]
  fragmentTags?: string[]
}

export const MarkdownHtmlBlock = React.memo(function MarkdownHtmlBlock({
  token: t,
  highlightClass,
  opts,
  highlightStyle,
  fragmentsEnabled = false,
  fragmentStep = 0,
  fragmentClassNames,
  fragmentTags,
}: MarkdownHtmlBlockProps) {
  const html = String((t as unknown as TokensHTML).text || '').trim()
  
  // iframe
  if (looksLikeSingleTagBlock(html, 'iframe')) {
    const srcRaw = extractAttr(html, 'src')
    if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
      const src = resolveHref(srcRaw, opts.activeDocumentPath)
      return (
        <MediaWrapper
          type="iframe"
          srcRaw={srcRaw}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          <MediaIframe src={src} title="Embedded content" presentationMode={opts.markdownPresentationMode} />
        </MediaWrapper>
      )
    }
  }

  // video
  if (looksLikeSingleTagBlock(html, 'video')) {
    const srcRaw = extractAttr(html, 'src')
    if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
      const resolved = resolveHref(srcRaw, opts.activeDocumentPath)
      const src = applyMediaProxySrc(resolved)
      return (
        <MediaWrapper
          type="video"
          srcRaw={srcRaw}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          <MediaVideo src={src} />
        </MediaWrapper>
      )
    }
  }

  // img
  {
    const srcRaw = extractAttr(html, 'src')
    if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
      const resolved = resolveHref(srcRaw, opts.activeDocumentPath)
      const src = applyMediaProxySrc(resolved)
      const alt = extractAttr(html, 'alt')
      const width = parseHtmlNumberAttr(extractAttr(html, 'width'))
      const height = parseHtmlNumberAttr(extractAttr(html, 'height'))

      return (
        <MediaWrapper
          type="image"
          srcRaw={srcRaw}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          <MediaImage src={src} alt={alt} width={width} height={height} />
        </MediaWrapper>
      )
    }
  }

  // Safe HTML or Raw Code
  const safeHtml = renderSafeHtmlBlock(html, {
    activeDocumentPath: opts.activeDocumentPath,
    uiPanelTextFontClass: opts.uiPanelTextFontClass,
    uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
    markdownPresentationMode: opts.markdownPresentationMode,
    renderNodeText: (text, key) => <React.Fragment key={key}>{text}</React.Fragment>,
    fragmentOptions:
      opts.markdownPresentationMode && fragmentsEnabled
        ? {
            enabled: true,
            currentStep: fragmentStep,
            classNames: fragmentClassNames || [],
            tags: fragmentTags || [],
          }
        : null,
  })

  if (safeHtml) {
    return (
      <MarkdownBlockContainer
        as="section"
        className={['mt-3 mb-3'].filter(Boolean).join(' ')}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        startLine={t.startLine}
        endLine={t.endLine}
      >
        {safeHtml}
      </MarkdownBlockContainer>
    )
  }

  return (
    <MarkdownBlockContainer
      as="pre"
      className={[
        'mt-3 mb-3 p-3 rounded border border-gray-200 bg-gray-50 overflow-auto',
      ]
        .filter(Boolean)
        .join(' ')}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
    >
      <code className={opts.uiPanelMonospaceTextClass}>{html}</code>
    </MarkdownBlockContainer>
  )
})
