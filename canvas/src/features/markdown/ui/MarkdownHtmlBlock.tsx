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

type MarkdownHtmlBlockProps = {
  token: TokenWithLines
  highlightClass: string
  opts: RenderOpts
}

export const MarkdownHtmlBlock = React.memo(function MarkdownHtmlBlock({
  token: t,
  highlightClass,
  opts,
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
          highlightClass={highlightClass}
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
          highlightClass={highlightClass}
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
          highlightClass={highlightClass}
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
    uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
    markdownPresentationMode: opts.markdownPresentationMode,
    renderNodeText: (text, key) => <React.Fragment key={key}>{text}</React.Fragment>,
  })

  if (safeHtml) {
    return (
      <div className={['mt-3 mb-3', highlightClass].filter(Boolean).join(' ')}>
        {safeHtml}
      </div>
    )
  }

  return (
    <pre
      className={[
        'mt-3 mb-3 p-3 rounded border border-gray-200 bg-gray-50 overflow-auto',
        highlightClass,
      ].filter(Boolean).join(' ')}
    >
      <code className={opts.uiPanelMonospaceTextClass}>{html}</code>
    </pre>
  )
})
