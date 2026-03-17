import React from 'react'
import type { Token, TokensParagraph, TokensGeneric, TokensLink, TokensImage, TokensText } from './MarkdownTokens'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLex'
import {
  applyMediaProxySrc,
  buildYouTubeEmbedUrl,
  isAbsoluteWebUrl,
  isSafeHref,
  isVideoUrl,
  resolveHref,
} from '@/features/markdown/ui/markdownPreviewLinks'
import { normalizeWebpageLikeUrl } from 'grph-shared/url'
import { resolveIframeEmbed } from 'grph-shared/rich-media/iframe'
import { buildBilibiliEmbedUrl, buildTwitterEmbedUrl, buildVimeoEmbedUrl } from 'grph-shared/rich-media/providers'
import { isLikelyImageUrl } from '@/lib/url'
import { renderInlineTokens } from './MarkdownInlineRenderer'
import { MediaWrapper, MediaIframe, MediaVideo, MediaImage, MediaWebpageSnapshot } from './MarkdownMediaUi'
import type { RenderOpts } from './MarkdownRendererTypes'
import { MarkdownBlockContainer } from './MarkdownBlockContainer'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_COPY } from '@/lib/config'
import {
  MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
  MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
  MarkdownBlockDropMarkers,
  MarkdownBlockGutterControls,
  useMarkdownLineBlockDnD,
} from './MarkdownBlockGutter'

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
  const meaningful = inner.filter(t => {
    const tt = t as unknown as { type?: unknown; text?: unknown }
    const type = String(tt.type || '')
    if (type === 'space' || type === 'br' || type === 'softbreak') return false
    if (type === 'text') return String((t as unknown as TokensText).text || '').trim().length > 0
    return true
  })
  if (meaningful.length !== 1) return null
  const only = meaningful[0] as unknown as TokensGeneric
  if (only.type !== 'link') return null
  const link = only as unknown as TokensLink
  const href = String(link.href || '').trim()
  return href || null
}

const isStandaloneTextUrlParagraph = (token: Token): string | null => {
  const p = token as unknown as TokensParagraph
  const inner = Array.isArray(p.tokens) ? p.tokens : []
  const nonTrivial = inner.filter(t => {
    const tt = t as unknown as { type?: unknown; text?: unknown }
    const type = String(tt.type || '')
    if (type === 'softbreak' || type === 'br') return false
    if (type === 'text') return String((t as unknown as TokensText).text || '').trim().length > 0
    return true
  })
  if (nonTrivial.length !== 1) return null
  const only = nonTrivial[0] as unknown as TokensGeneric
  if (only.type !== 'text') return null
  const raw = String((only as unknown as TokensText).text || '').trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) return null
  return raw
}

const isBlockHtmlToken = (t: Token): boolean => {
  const tt = t as unknown as { type?: unknown; text?: unknown; raw?: unknown }
  if (tt.type !== 'html') return false
  const raw = String(tt.text ?? tt.raw ?? '').trim()
  const lower = raw.toLowerCase()
  if (!lower.startsWith('<') || lower.startsWith('</')) return false
  const m = /^<\s*([a-z0-9-]+)/i.exec(lower)
  const tag = m && m[1] ? m[1] : ''
  if (!tag) return false
  const blockTags = new Set([
    'div',
    'section',
    'main',
    'article',
    'aside',
    'nav',
    'header',
    'footer',
    'ul',
    'ol',
    'table',
    'pre',
    'img',
    'picture',
    'iframe',
    'video',
    'audio',
    'svg',
    'details',
    'figure',
  ])
  if (!blockTags.has(tag)) return false
  if (!lower.includes(`</${tag}`) && !/\/\s*>$/.test(lower)) return false
  return true
}

const containsBlockHtml = (tokens: Token[] | undefined): boolean => {
  const list = Array.isArray(tokens) ? tokens : []
  for (const t of list) {
    if (isBlockHtmlToken(t)) return true
    const nested = (t as unknown as { tokens?: unknown }).tokens
    if (nested && containsBlockHtml(nested as Token[])) return true
  }
  return false
}

const tryExtractProxiedInnerUrl = (href: string): string => {
  const raw = String(href || '').trim()
  if (!raw) return ''
  if (!raw.startsWith('/__webpage_asset_proxy') && !raw.startsWith('/__fetch_remote')) return ''
  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://example.invalid'
    const u = new URL(raw, base)
    const inner = u.searchParams.get('url') || ''
    if (!inner) return ''
    const normalizedInner = inner
      .replace(/&amp;/g, '&')
      .replace(/&#38;/g, '&')
      .replace(/&#x26;/gi, '&')
    try {
      return decodeURIComponent(normalizedInner)
    } catch {
      return normalizedInner
    }
  } catch {
    return ''
  }
}

const looksLikeImageHref = (href: string): boolean => {
  const raw = String(href || '').trim()
  if (!raw) return false
  if (/^data:image\//i.test(raw)) return true
  if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(raw)) return true
  if (isLikelyImageUrl(raw)) return true
  const inner = tryExtractProxiedInnerUrl(raw)
  if (!inner) return false
  if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(inner)) return true
  return isLikelyImageUrl(inner)
}

const getStandaloneMediaImageHref = (
  tokens: Token[] | undefined,
): { kind: 'image' | 'video' | 'audio' | 'iframe'; href: string } | null => {
  const list = Array.isArray(tokens) ? tokens : []
  let image: TokensImage | null = null
  for (const t of list) {
    const tt = t as unknown as { type?: unknown }
    const type = String(tt.type || '')
    if (type === 'image') {
      if (image) return null
      image = t as unknown as TokensImage
      continue
    }
    if (type === 'text') {
      const text = String((t as unknown as TokensText).text || '')
      if (!text.trim()) continue
      return null
    }
    if (type === 'softbreak' || type === 'br') continue
    return null
  }
  if (!image) return null
  const href = String(image.href || '').trim()
  if (!href) return null
  const altNorm = String(image.text || '').trim().toLowerCase()
  const looksImage = looksLikeImageHref(href)
  const looksVideo =
    isVideoUrl(href) || /\.(mov)(\?|#|$)/i.test(href)
  const looksAudio =
    /\.(mp3|wav|m4a|aac|flac|ogg)(\?|#|$)/i.test(href)
  const resolvedKind: { kind: 'image' | 'video' | 'audio' | 'iframe'; href: string } | null = (() => {
    if (altNorm.startsWith('iframe')) return { kind: 'iframe', href }
    if (altNorm.startsWith('image') || looksImage) return { kind: 'image', href }
    if (altNorm.startsWith('audio') || looksAudio) return { kind: 'audio', href }
    if (altNorm.startsWith('video') || looksVideo) return { kind: 'video', href }
    return null
  })()
  return resolvedKind
}

const getStandaloneWebpageHrefFromImageToken = (tokens: Token[] | undefined): string | null => {
  const list = Array.isArray(tokens) ? tokens : []
  let image: TokensImage | null = null
  for (const t of list) {
    const tt = t as unknown as { type?: unknown }
    const type = String(tt.type || '')
    if (type === 'image') {
      if (image) return null
      image = t as unknown as TokensImage
      continue
    }
    if (type === 'text') {
      const text = String((t as unknown as TokensText).text || '')
      if (!text.trim()) continue
      return null
    }
    if (type === 'softbreak' || type === 'br') continue
    return null
  }
  if (!image) return null
  const href = String(image.href || '').trim()
  if (!href) return null
  if (!/^https?:\/\//i.test(href)) return null
  const altNorm = String(image.text || '').trim().toLowerCase()
  if (altNorm.startsWith('iframe') || altNorm.startsWith('video') || altNorm.startsWith('audio')) return null
  if (/^data:image\//i.test(href)) return null
  if (looksLikeImageHref(href)) return null
  if (/\.(mp4|webm|ogg|mov|mp3|wav|m4a|aac|flac)(\?|#|$)/i.test(href)) return null
  return href
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
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const p = t as unknown as TokensParagraph
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

  const standaloneHref = isStandaloneLinkParagraph(t as unknown as Token) || isStandaloneTextUrlParagraph(t as unknown as Token)
  if (standaloneHref && isSafeHref(standaloneHref) && isAbsoluteWebUrl(standaloneHref)) {
    const renderStandaloneMedia = (type: string, children: React.ReactNode) => (
      <MediaWrapper
        type={type}
        srcRaw={standaloneHref}
        startLine={t.startLine}
        endLine={endLine}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        opts={opts}
      >
        {children}
      </MediaWrapper>
    )

    const youtube = buildYouTubeEmbedUrl(standaloneHref)
    if (youtube) {
      return renderStandaloneMedia(
        'youtube',
        <MediaIframe
          src={youtube}
          title="YouTube"
          presentationMode={opts.markdownPresentationMode}
        />,
      )
    }

    const tweet = buildTwitterEmbedUrl(standaloneHref)
    if (tweet) {
      const theme = String(opts.rootThemeMode || '').toLowerCase() === 'dark' ? 'dark' : 'light'
      const src = `${tweet}&theme=${theme}`
      return renderStandaloneMedia(
        'tweet',
        <MediaIframe
          src={src}
          title="X"
          presentationMode={opts.markdownPresentationMode}
        />,
      )
    }

    if (looksLikeImageHref(standaloneHref)) {
      const resolved = resolveHref(standaloneHref, opts.activeDocumentPath)
      return renderStandaloneMedia('image', <MediaImage src={resolved} alt={standaloneHref} />)
    }

    const vimeo = buildVimeoEmbedUrl(standaloneHref)
    if (vimeo) {
      return renderStandaloneMedia(
        'vimeo',
        <MediaIframe
          src={vimeo}
          title="Vimeo"
          presentationMode={opts.markdownPresentationMode}
        />,
      )
    }

    const bilibili = buildBilibiliEmbedUrl(standaloneHref)
    if (bilibili) {
      return renderStandaloneMedia(
        'bilibili',
        <MediaIframe
          src={bilibili}
          title="Bilibili"
          presentationMode={opts.markdownPresentationMode}
        />,
      )
    }

    if (isVideoUrl(standaloneHref)) {
      const resolved = resolveHref(standaloneHref, opts.activeDocumentPath)
      const src = applyMediaProxySrc(resolved)
      return renderStandaloneMedia('video', <MediaVideo src={src} />)
    }

    const normalizedHref = normalizeWebpageLikeUrl(standaloneHref)
    return renderStandaloneMedia(
      'webpage',
      <MediaWebpageSnapshot url={normalizedHref} title="Webpage" presentationMode={opts.markdownPresentationMode} />,
    )
  }

  const standaloneWebpageHref = getStandaloneWebpageHrefFromImageToken(p.tokens)
  if (standaloneWebpageHref && isSafeHref(standaloneWebpageHref) && isAbsoluteWebUrl(standaloneWebpageHref)) {
    const normalizedHref = normalizeWebpageLikeUrl(standaloneWebpageHref)
    const youtube = buildYouTubeEmbedUrl(normalizedHref)
    if (youtube) {
      return (
        <MediaWrapper
          type="youtube"
          srcRaw={normalizedHref}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          <MediaIframe
            src={youtube}
            title="YouTube"
            presentationMode={opts.markdownPresentationMode}
          />
        </MediaWrapper>
      )
    }
    const tweet = buildTwitterEmbedUrl(normalizedHref)
    if (tweet) {
      const theme = String(opts.rootThemeMode || '').toLowerCase() === 'dark' ? 'dark' : 'light'
      const src = `${tweet}&theme=${theme}`
      return (
        <MediaWrapper
          type="tweet"
          srcRaw={normalizedHref}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          <MediaIframe
            src={src}
            title="X"
            presentationMode={opts.markdownPresentationMode}
          />
        </MediaWrapper>
      )
    }

    const bilibili = buildBilibiliEmbedUrl(normalizedHref)
    if (bilibili) {
      return (
        <MediaWrapper
          type="bilibili"
          srcRaw={normalizedHref}
          startLine={t.startLine}
          endLine={t.endLine || t.startLine}
          highlightClass={highlightClass}
          highlightStyle={highlightStyle}
          opts={opts}
        >
          <MediaIframe
            src={bilibili}
            title="Bilibili"
            presentationMode={opts.markdownPresentationMode}
          />
        </MediaWrapper>
      )
    }
    return (
      <MediaWrapper
        type="webpage"
        srcRaw={normalizedHref}
        startLine={t.startLine}
        endLine={t.endLine || t.startLine}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        opts={opts}
      >
        <MediaWebpageSnapshot url={normalizedHref} title="Webpage" presentationMode={opts.markdownPresentationMode} />
      </MediaWrapper>
    )
  }
  const standaloneMedia = getStandaloneMediaImageHref(p.tokens)
  if (standaloneMedia && isSafeHref(standaloneMedia.href)) {
    const resolved = resolveHref(standaloneMedia.href, opts.activeDocumentPath)
    const renderStandaloneMedia = (type: string, children: React.ReactNode) => (
      <MediaWrapper
        type={type}
        srcRaw={standaloneMedia.href}
        startLine={t.startLine}
        endLine={t.endLine || t.startLine}
        highlightClass={highlightClass}
        highlightStyle={highlightStyle}
        opts={opts}
      >
        {children}
      </MediaWrapper>
    )
    if (standaloneMedia.kind === 'iframe' && isAbsoluteWebUrl(resolved)) {
      const embed = resolveIframeEmbed({ url: resolved })
      return renderStandaloneMedia(
        'iframe',
        embed.direct ? (
          <MediaIframe src={resolved} title="Embedded content" presentationMode={opts.markdownPresentationMode} />
        ) : (
          <MediaWebpageSnapshot url={resolved} title="Embedded content" presentationMode={opts.markdownPresentationMode} />
        ),
      )
    }
    if (standaloneMedia.kind === 'image') {
      return renderStandaloneMedia('image', <MediaImage src={resolved} alt={standaloneMedia.href} />)
    }
    if (standaloneMedia.kind === 'video') {
      const src = applyMediaProxySrc(resolved)
      return renderStandaloneMedia('video', <MediaVideo src={src} />)
    }
    if (standaloneMedia.kind === 'audio') {
      const src = applyMediaProxySrc(resolved)
      return renderStandaloneMedia(
        'audio',
        <audio
          controls
          src={src || undefined}
          className="w-full max-w-xl rounded border border-gray-200"
        />,
      )
    }
  }
  const wrapperAs = containsBlockHtml(p.tokens) || !!standaloneMedia ? 'section' : 'p'
  const baseClassName = ['mt-2 mb-2', baseTextClass, commonBlockClass]
    .filter(Boolean)
    .join(' ')
  return (
    <MarkdownBlockContainer
      as={wrapperAs}
      className={`${baseClassName} relative group ${gutterEnabled ? `${MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS} ${MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS}` : ''} ${dnd.isDragging ? 'opacity-60' : ''}`}
      highlightClass={highlightClass}
      highlightStyle={highlightStyle}
      startLine={t.startLine}
      endLine={t.endLine}
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
      {renderInlineTokens(p.tokens, {
        activeDocumentPath: opts.activeDocumentPath,
        uiPanelTextFontClass: opts.uiPanelTextFontClass,
        uiPanelMonospaceTextClass: opts.uiPanelMonospaceTextClass,
        markdownPresentationMode: opts.markdownPresentationMode,
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
