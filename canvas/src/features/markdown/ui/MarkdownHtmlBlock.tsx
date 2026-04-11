import React from 'react'
import type { TokensHTML } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import {
  applyMediaProxySrc,
  extractAttr,
  deriveSafeLayoutStyleFromClassAttr,
  isSafeHref,
  isSafeMediaSrc,
  looksLikeSingleTagBlock,
  parseSafeInlineStyle,
  pickFirstSrcsetUrl,
  parseHtmlNumberAttr,
  resolveHref,
  renderSafeHtmlBlock,
} from '@/features/markdown/ui/markdownPreviewLinks'
import { extractScriptEmbedAnchorHref, normalizeHtmlHrefLikeValue } from 'grph-shared/markdown/mediaHtml'
import { MediaWrapper, MediaIframe, MediaVideo, MediaVideoSnapshot, MediaImage, MediaWebpageSnapshot } from './MarkdownMediaUi'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
  MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
  MarkdownBlockDropMarkers,
  MarkdownBlockGutterControls,
  useMarkdownLineBlockDnD,
} from './MarkdownBlockGutter'

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
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const richMediaPanelMode = useGraphStore(s => s.richMediaPanelMode)

  const html = String((t as unknown as TokensHTML).text || '').trim()
  const endLine = t.endLine || t.startLine
  const blockControlsAllowed =
    !opts.markdownPresentationMode &&
    !!opts.viewerBlockEditingEnabled &&
    opts.markdownBlockControlsEnabled !== false
  const canInsertLine = blockControlsAllowed && !!opts.onInsertLineAfter && Number.isFinite(endLine)
  const canReorder = blockControlsAllowed && !!opts.onReorderLineBlock && Number.isFinite(t.startLine)
  const gutterEnabled = (canInsertLine || canReorder) && opts.markdownBlockGutterEnabled !== false

  const dnd = useMarkdownLineBlockDnD({
    enabled: canReorder,
    targetStartLine: t.startLine,
    targetEndLine: endLine,
    onReorder: (source, target, position) => opts.onReorderLineBlock?.(source, target, position),
  })

  const safeHtml = React.useMemo(() => {
    return renderSafeHtmlBlock(html, {
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
  }, [
    fragmentsEnabled,
    fragmentClassNames,
    fragmentStep,
    fragmentTags,
    html,
    opts.activeDocumentPath,
    opts.markdownPresentationMode,
    opts.uiPanelMonospaceTextClass,
    opts.uiPanelTextFontClass,
  ])

  if (/^<\s*!--[\s\S]*?--\s*>$/i.test(html)) {
    return <React.Fragment>{''}</React.Fragment>
  }
  if (/^<\s*\/\s*a\b[^>]*>$/i.test(html)) {
    return <React.Fragment>{''}</React.Fragment>
  }
  
  // iframe
  if (looksLikeSingleTagBlock(html, 'iframe')) {
    const srcRaw = extractAttr(html, 'src') || extractAttr(html, 'data-src')
    if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
      const src = resolveHref(srcRaw, opts.activeDocumentPath)
      const w = parseHtmlNumberAttr(extractAttr(html, 'width'))
      const h = parseHtmlNumberAttr(extractAttr(html, 'height'))
      const maxWidthPx = w != null ? Math.max(160, Math.min(960, Math.floor(w))) : null
      const heightPx = h != null ? Math.max(140, Math.min(1400, Math.floor(h))) : null
      const containerStyle =
        maxWidthPx != null || heightPx != null
          ? {
              width: '100%',
              maxWidth: maxWidthPx != null ? `${maxWidthPx}px` : undefined,
              height: heightPx != null ? `${heightPx}px` : undefined,
              maxHeight: heightPx != null ? '80vh' : undefined,
            }
          : undefined
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
          {!/^https?:/i.test(src) ? (
            <MediaIframe
              src={src}
              title="Embedded content"
              presentationMode={opts.markdownPresentationMode}
              containerClassName={containerStyle ? 'w-full' : undefined}
              containerStyle={containerStyle}
            />
          ) : (
            <MediaWebpageSnapshot
              url={src}
              title="Embedded content"
              presentationMode={opts.markdownPresentationMode}
              containerClassName={containerStyle ? 'w-full' : undefined}
              containerStyle={containerStyle}
            />
          )}
        </MediaWrapper>
      )
    }
  }

  // embed
  if (looksLikeSingleTagBlock(html, 'embed')) {
    const srcRaw = extractAttr(html, 'src') || extractAttr(html, 'data-src')
    if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
      const src = resolveHref(srcRaw, opts.activeDocumentPath)
      const w = parseHtmlNumberAttr(extractAttr(html, 'width'))
      const h = parseHtmlNumberAttr(extractAttr(html, 'height'))
      const maxWidthPx = w != null ? Math.max(160, Math.min(960, Math.floor(w))) : null
      const heightPx = h != null ? Math.max(140, Math.min(1400, Math.floor(h))) : null
      const containerStyle =
        maxWidthPx != null || heightPx != null
          ? {
              width: '100%',
              maxWidth: maxWidthPx != null ? `${maxWidthPx}px` : undefined,
              height: heightPx != null ? `${heightPx}px` : undefined,
              maxHeight: heightPx != null ? '80vh' : undefined,
            }
          : undefined
      return (
        <MediaWrapper
          type="embed"
          srcRaw={srcRaw}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          {!/^https?:/i.test(src) ? (
            <MediaIframe
              src={src}
              title="Embedded content"
              presentationMode={opts.markdownPresentationMode}
              containerClassName={containerStyle ? 'w-full' : undefined}
              containerStyle={containerStyle}
            />
          ) : (
            <MediaWebpageSnapshot
              url={src}
              title="Embedded content"
              presentationMode={opts.markdownPresentationMode}
              containerClassName={containerStyle ? 'w-full' : undefined}
              containerStyle={containerStyle}
            />
          )}
        </MediaWrapper>
      )
    }
  }

  // object
  if (looksLikeSingleTagBlock(html, 'object')) {
    const dataRaw = extractAttr(html, 'data') || extractAttr(html, 'src') || extractAttr(html, 'data-src')
    if (dataRaw && isSafeHref(dataRaw) && isSafeMediaSrc(dataRaw)) {
      const src = resolveHref(dataRaw, opts.activeDocumentPath)
      const w = parseHtmlNumberAttr(extractAttr(html, 'width'))
      const h = parseHtmlNumberAttr(extractAttr(html, 'height'))
      const maxWidthPx = w != null ? Math.max(160, Math.min(960, Math.floor(w))) : null
      const heightPx = h != null ? Math.max(140, Math.min(1400, Math.floor(h))) : null
      const containerStyle =
        maxWidthPx != null || heightPx != null
          ? {
              width: '100%',
              maxWidth: maxWidthPx != null ? `${maxWidthPx}px` : undefined,
              height: heightPx != null ? `${heightPx}px` : undefined,
              maxHeight: heightPx != null ? '80vh' : undefined,
            }
          : undefined
      return (
        <MediaWrapper
          type="object"
          srcRaw={dataRaw}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          {!/^https?:/i.test(src) ? (
            <MediaIframe
              src={src}
              title="Embedded content"
              presentationMode={opts.markdownPresentationMode}
              containerClassName={containerStyle ? 'w-full' : undefined}
              containerStyle={containerStyle}
            />
          ) : (
            <MediaWebpageSnapshot
              url={src}
              title="Embedded content"
              presentationMode={opts.markdownPresentationMode}
              containerClassName={containerStyle ? 'w-full' : undefined}
              containerStyle={containerStyle}
            />
          )}
        </MediaWrapper>
      )
    }
  }

  // video
  if (looksLikeSingleTagBlock(html, 'video')) {
    const parsed = (() => {
      try {
        if (typeof DOMParser === 'undefined') return null
        const parser = new DOMParser()
        const d = parser.parseFromString(html, 'text/html')
        const video = d.querySelector('video')
        if (!video) return null
        const srcRaw = video.getAttribute('src') || video.getAttribute('data-src') || ''
        const srcFromSource = video.querySelector('source')?.getAttribute('src') || video.querySelector('source')?.getAttribute('data-src') || ''
        const srcCandidate = String(srcRaw || srcFromSource || '').trim()
        if (!srcCandidate || !isSafeHref(srcCandidate) || !isSafeMediaSrc(srcCandidate)) return null
        const posterRaw = video.getAttribute('poster') || video.getAttribute('data-poster') || ''
        const posterCandidate = String(posterRaw || '').trim()
        const poster =
          posterCandidate && isSafeHref(posterCandidate) && isSafeMediaSrc(posterCandidate)
            ? applyMediaProxySrc(resolveHref(posterCandidate, opts.activeDocumentPath))
            : undefined
        const autoPlay = video.hasAttribute('autoplay')
        const loop = video.hasAttribute('loop')
        const muted = video.hasAttribute('muted')
        const playsInline = video.hasAttribute('playsinline')
        const controls = video.hasAttribute('controls')
        const classRaw = video.getAttribute('class') || ''
        const styleRaw = video.getAttribute('style') || ''
        return { srcCandidate, poster, autoPlay, loop, muted, playsInline, controls, classRaw, styleRaw }
      } catch {
        return null
      }
    })()

    const srcRaw = parsed?.srcCandidate || extractAttr(html, 'src') || extractAttr(html, 'data-src')
    if (srcRaw && isSafeHref(srcRaw) && isSafeMediaSrc(srcRaw)) {
      const resolved = resolveHref(srcRaw, opts.activeDocumentPath)
      const src = applyMediaProxySrc(resolved)
      const style = (() => {
        const classStyle = deriveSafeLayoutStyleFromClassAttr(parsed?.classRaw || extractAttr(html, 'class'))
        const inlineStyle = parseSafeInlineStyle(parsed?.styleRaw || extractAttr(html, 'style'))
        if (!classStyle && !inlineStyle) return undefined
        const merged: React.CSSProperties = { ...(classStyle || {}), ...(inlineStyle || {}) }
        if (merged.width && !merged.maxWidth) merged.maxWidth = '100%'
        return Object.keys(merged).length ? merged : undefined
      })()
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
          {richMediaPanelMode === 'embed' ? (
            <MediaVideo
              src={src}
              poster={parsed?.poster}
              autoPlay={parsed?.autoPlay}
              muted={parsed?.muted}
              loop={parsed?.loop}
              playsInline={parsed?.playsInline}
              controls={parsed?.controls}
              style={style}
            />
          ) : (
            <MediaVideoSnapshot
              url={resolved}
              title="Video"
              presentationMode={opts.markdownPresentationMode}
              style={style}
            />
          )}
        </MediaWrapper>
      )
    }
  }

  // img
  if (looksLikeSingleTagBlock(html, 'img')) {
    const srcRaw = extractAttr(html, 'src') || extractAttr(html, 'data-src')
    const srcsetRaw = extractAttr(html, 'srcset') || extractAttr(html, 'data-srcset')
    const srcCandidate = srcRaw || pickFirstSrcsetUrl(srcsetRaw)
    if (srcCandidate && isSafeHref(srcCandidate) && isSafeMediaSrc(srcCandidate)) {
      const resolved = resolveHref(srcCandidate, opts.activeDocumentPath)
      const src = applyMediaProxySrc(resolved)
      const alt = extractAttr(html, 'alt')
      const width = parseHtmlNumberAttr(extractAttr(html, 'width'))
      const height = parseHtmlNumberAttr(extractAttr(html, 'height'))
      const style = (() => {
        const classStyle = deriveSafeLayoutStyleFromClassAttr(extractAttr(html, 'class'))
        const inlineStyle = parseSafeInlineStyle(extractAttr(html, 'style'))
        if (!classStyle && !inlineStyle) return undefined
        const merged: React.CSSProperties = { ...(classStyle || {}), ...(inlineStyle || {}) }
        if (merged.width && !merged.maxWidth) merged.maxWidth = '100%'
        return Object.keys(merged).length ? merged : undefined
      })()

      return (
        <MediaWrapper
          type="image"
          srcRaw={srcCandidate}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          <MediaImage src={src} alt={alt} width={width} height={height} style={style} />
        </MediaWrapper>
      )
    }
  }

  const extractFirstAbsoluteAnchorHref = (rawHtml: string): string => {
    const raw = String(rawHtml || '').trim()
    if (!raw) return ''
    const m = raw.match(/<a\b[^>]*\bhref\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i)
    const href = normalizeHtmlHrefLikeValue(String(m?.[2] ?? m?.[3] ?? m?.[4] ?? '').trim())
    if (!href) return ''
    if (/^https?:\/\//i.test(href)) return href
    if (/^\/\//.test(href)) return `https:${href}`
    if (/^www\./i.test(href)) return `https://${href}`
    if (href.startsWith('/')) return `https://www.reddit.com${href}`
    return ''
  }

  const scriptEmbedHref = extractScriptEmbedAnchorHref(html)

  if (scriptEmbedHref) {
    return (
      <MediaWrapper
        type="webpage"
        srcRaw={scriptEmbedHref}
        startLine={t.startLine}
        endLine={t.endLine || t.startLine}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        opts={opts}
      >
        <MediaWebpageSnapshot
          url={resolveHref(scriptEmbedHref, opts.activeDocumentPath)}
          title="Embedded content"
          presentationMode={opts.markdownPresentationMode}
        />
      </MediaWrapper>
    )
  }

  const isRedditEmbedBlockquote = /<\s*blockquote\b[^>]*\bclass\s*=\s*("[^"]*reddit-embed-bq[^"]*"|'[^']*reddit-embed-bq[^']*'|[^\s>]*reddit-embed-bq[^\s>]*)/i.test(
    html,
  )
  if (isRedditEmbedBlockquote) {
    const href = extractFirstAbsoluteAnchorHref(html)
    if (href) {
      return (
        <MediaWrapper
          type="webpage"
          srcRaw={href}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          <MediaWebpageSnapshot
            url={resolveHref(href, opts.activeDocumentPath)}
            title="Embedded content"
            presentationMode={opts.markdownPresentationMode}
          />
        </MediaWrapper>
      )
    }
  }

  if (!/<\s*blockquote\b/i.test(html) && /<\s*script\b/i.test(html) && /embed\.reddit\.com\/widgets\.js/i.test(html)) {
    return <React.Fragment>{''}</React.Fragment>
  }

  // Safe HTML or Raw Code
  if (/^<a\b[^>]*>\s*<\/a>$/i.test(html) && !extractAttr(html, 'href')) {
    const idRaw = extractAttr(html, 'id')
    const id = String(idRaw || '').trim()
    const safe = id && /^[A-Za-z0-9^][A-Za-z0-9^:._-]{0,255}$/.test(id) ? id : ''
    if (safe) {
      return (
        <MarkdownBlockContainer
          as="a"
          className="block h-0 scroll-mt-16"
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          startLine={t.startLine}
          endLine={t.endLine}
          id={safe}
          aria-hidden
        >
          {''}
        </MarkdownBlockContainer>
      )
    }
  }

  if (safeHtml) {
    return (
      <MarkdownBlockContainer
        as="section"
        className={
          [
            'mt-3 mb-3 relative group',
            gutterEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS : '',
            gutterEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS : '',
            dnd.isDragging ? 'opacity-60' : '',
          ]
            .filter(Boolean)
            .join(' ')
        }
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        startLine={t.startLine}
        endLine={t.endLine}
        inlineEditable={blockControlsAllowed && !!opts.onReplaceLineRange}
        sourceLines={opts.markdownSourceLines}
        onReplaceLineRange={opts.onReplaceLineRange}
        onInlineEditStateChange={opts.onInlineEditStateChange}
        forbidCopy={!!opts.forbidCopy}
        editorClassName="w-full whitespace-pre-wrap break-words outline-none bg-transparent"
        editPresentation="html"
        editHtmlRender="block"
        editHtmlDisableDefaultBlockFlow
        onDragOver={dnd.handleDragOver}
        onDragLeave={dnd.handleDragLeave}
        onDrop={dnd.handleDrop}
      >
        {gutterEnabled && (
          <>
            <MarkdownBlockDropMarkers dragState={dnd.dragState} />
            <MarkdownBlockGutterControls
              canInsertLine={canInsertLine}
              onInsertLine={() => opts.onInsertLineAfter?.(endLine)}
              canReorder={canReorder}
              onDragStart={dnd.handleDragStart}
              onDragEnd={dnd.handleDragEnd}
              iconSizeClass={iconSizeClass}
              iconStrokeWidth={uiIconStrokeWidth}
              labelReorder={UI_COPY.markdownBlockReorderLineLabel}
              labelInsert={UI_COPY.markdownBlockInsertLineLabel}
            />
          </>
        )}
        {safeHtml}
      </MarkdownBlockContainer>
    )
  }

  return (
    <MarkdownBlockContainer
      as="section"
      className={
        [
          'mt-3 mb-3 relative group',
          gutterEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS : '',
          gutterEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS : '',
          dnd.isDragging ? 'opacity-60' : '',
        ]
          .filter(Boolean)
          .join(' ')
      }
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
      inlineEditable={blockControlsAllowed && !!opts.onReplaceLineRange}
      sourceLines={opts.markdownSourceLines}
      onReplaceLineRange={opts.onReplaceLineRange}
      onInlineEditStateChange={opts.onInlineEditStateChange}
      forbidCopy={!!opts.forbidCopy}
      editorClassName="w-full whitespace-pre-wrap break-words outline-none bg-transparent"
      editPresentation="html"
      editHtmlRender="block"
      editHtmlDisableDefaultBlockFlow
      onDragOver={dnd.handleDragOver}
      onDragLeave={dnd.handleDragLeave}
      onDrop={dnd.handleDrop}
    >
      {gutterEnabled && (
        <>
          <MarkdownBlockDropMarkers dragState={dnd.dragState} />
          <MarkdownBlockGutterControls
            canInsertLine={canInsertLine}
            onInsertLine={() => opts.onInsertLineAfter?.(endLine)}
            canReorder={canReorder}
            onDragStart={dnd.handleDragStart}
            onDragEnd={dnd.handleDragEnd}
            iconSizeClass={iconSizeClass}
            iconStrokeWidth={uiIconStrokeWidth}
          labelReorder={UI_COPY.markdownBlockReorderLineLabel}
          labelInsert={UI_COPY.markdownBlockInsertLineLabel}
          />
        </>
      )}
      <pre className="p-3 rounded border border-gray-200 bg-gray-50 overflow-auto">
        <code className={opts.uiPanelMonospaceTextClass}>{html}</code>
      </pre>
    </MarkdownBlockContainer>
  )
})
