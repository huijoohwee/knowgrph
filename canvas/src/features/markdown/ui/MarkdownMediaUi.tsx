import React from 'react'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyMediaProxySrc, buildMarkdownPreviewMediaKey } from '@/features/markdown/ui/markdownPreviewLinks'
import { resolveIframeEmbed, shouldForceSnapshotIframeUrl } from 'grph-shared/rich-media/iframe'
import { inferMediaKindFromUrl } from 'grph-shared/rich-media/mediaKind'
import { pickWebpageSnapshotRects, shouldAutoLoadWebpageSnapshot } from 'grph-shared/rich-media/webpageSnapshot'
import { getWebpageFallbackInfo } from 'grph-shared/rich-media/webpageFallback'
import { getOrFetchWebpageMeta } from 'grph-shared/rich-media/webpageMeta'
import { getDefaultFaviconUrlForWebpageUrl, getKnownHostIconUrlForWebpageUrl } from 'grph-shared/rich-media/webpagePreview'
import { getOrCreateVideoThumbnail } from 'grph-shared/rich-media/videoThumbnail'
import { applyImageLikeProxySrc } from '@/lib/url'
import { UI_COPY } from '@/lib/config'
import type { RenderOpts } from './MarkdownRendererTypes'
import { getIconSizeClass } from '@/lib/ui'
import type { WebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutExport'
import { getCachedWebpageLayoutSnapshot, setCachedWebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutCache'
import {
  MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS,
  MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS,
  MarkdownBlockDropMarkers,
  MarkdownBlockGutterControls,
  useMarkdownLineBlockDnD,
} from './MarkdownBlockGutter'

type MediaWrapperProps = {
  type: string
  srcRaw: string
  startLine: number
  endLine?: number
  highlightClass: string
  highlightStyle?: React.CSSProperties
  opts: RenderOpts
  children: React.ReactNode
  className?: string
}

export const MediaWrapper = ({
  type,
  srcRaw,
  startLine,
  endLine,
  highlightClass,
  highlightStyle,
  opts,
  children,
  className,
}: MediaWrapperProps) => {
  const setMarkdownPreviewActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const safeEndLine = endLine || startLine

  const blockControlsAllowed =
    !opts.markdownPresentationMode &&
    !!opts.viewerBlockEditingEnabled &&
    opts.markdownBlockControlsEnabled !== false
  const canInsertLine = blockControlsAllowed && !!opts.onInsertLineAfter && Number.isFinite(safeEndLine)
  const canReorder = blockControlsAllowed && !!opts.onReorderLineBlock && Number.isFinite(startLine)
  const gutterEnabled = (canInsertLine || canReorder) && opts.markdownBlockGutterEnabled !== false

  const dnd = useMarkdownLineBlockDnD({
    enabled: canReorder,
    targetStartLine: startLine,
    targetEndLine: safeEndLine,
    onReorder: (source, target, position) => opts.onReorderLineBlock?.(source, target, position),
  })

  const openPreview = React.useCallback(() => {
    try {
      const key = buildMarkdownPreviewMediaKey(type, startLine, srcRaw)
      setMarkdownPreviewActiveMediaKey(key)
    } catch {
      void 0
    }
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'preview' as const } }))
      }
    } catch {
      void 0
    }
  }, [setMarkdownPreviewActiveMediaKey, srcRaw, startLine, type])

  const openInNewTab = React.useCallback(() => {
    const href = String(srcRaw || '').trim()
    if (!href) return
    try {
      if (typeof window === 'undefined') return
      window.open(href, '_blank', 'noopener,noreferrer')
    } catch {
      void 0
    }
  }, [srcRaw])

  const handleDoubleClick = () => {
    if (opts.previewOverlayScope === 'container') return
    openPreview()
  }

  const handleClickCapture = (event: React.MouseEvent) => {
    const t = event.target as unknown
    const target = (t && typeof t === 'object' ? (t as Element) : null)
    const thumbEl = target?.closest?.('[data-kg-media-thumbnail="1"]')
    if (!thumbEl) return
    try {
      event.preventDefault()
    } catch {
      void 0
    }
    try {
      event.stopPropagation()
    } catch {
      void 0
    }
    if (opts.previewOverlayScope === 'container') {
      openInNewTab()
      return
    }
    openPreview()
  }

  return (
    <figure
      className={
        [
          'mt-4 mb-4 mx-0 relative group',
          gutterEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_LEFT_CLASS : '',
          gutterEnabled ? MARKDOWN_BLOCK_GUTTER_PADDING_RIGHT_CLASS : '',
          dnd.isDragging ? 'opacity-60' : '',
          highlightClass,
          className,
        ]
          .filter(Boolean)
          .join(' ')
      }
      data-start-line={startLine}
      data-end-line={safeEndLine}
      onDoubleClick={handleDoubleClick}
      onClickCapture={handleClickCapture}
      style={highlightStyle}
      onDragOver={dnd.handleDragOver}
      onDragLeave={dnd.handleDragLeave}
      onDrop={dnd.handleDrop}
    >
      {gutterEnabled && (
        <>
          <MarkdownBlockDropMarkers dragState={dnd.dragState} />
          <MarkdownBlockGutterControls
            canInsertLine={canInsertLine}
            onInsertLine={() => opts.onInsertLineAfter?.(safeEndLine)}
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
      {children}
    </figure>
  )
}

export const MediaIframe = React.memo(function MediaIframe({
  src,
  title,
  presentationMode,
  deferLoad,
  embedMode,
  scriptPolicy,
  containerClassName,
  containerStyle,
  className,
  style,
}: {
  src: string
  title: string
  presentationMode: boolean
  deferLoad?: boolean
  embedMode?: 'auto' | 'direct'
  scriptPolicy?: 'strip' | 'allow'
  containerClassName?: string
  containerStyle?: React.CSSProperties
  className?: string
  style?: React.CSSProperties
}) {
  const [error, setError] = React.useState(false)
  const [forceProxy, setForceProxy] = React.useState(false)
  const [loaded, setLoaded] = React.useState<boolean>(() => {
    return deferLoad !== true
  })

  const richMediaPanelMode = useGraphStore(s => s.richMediaPanelMode)

  if (!src || error) {
    return <MediaErrorPlaceholder alt={title} />
  }
  const rawSrc = String(src || '').trim()

  const inferredKind = inferMediaKindFromUrl(rawSrc)

  if (inferredKind === 'image' || inferredKind === 'svg') {
    return <MediaImage src={rawSrc} alt={title} className={className} style={style} />
  }
  if (inferredKind === 'video') {
    return richMediaPanelMode === 'snapshot' ? (
      <MediaVideoSnapshot
        url={rawSrc}
        title={title}
        presentationMode={presentationMode}
        containerClassName={containerClassName}
        containerStyle={containerStyle}
        className={className}
        style={style}
      />
    ) : (
      <MediaVideo src={rawSrc} className={className} style={style} />
    )
  }
  if (inferredKind === 'audio') {
    return <MediaAudio src={rawSrc} className={className} style={style} />
  }
  const preferEmbed = richMediaPanelMode === 'embed'
  const embed = resolveIframeEmbed({
    url: rawSrc,
    embedMode: embedMode === 'direct' ? 'direct' : forceProxy ? 'proxy' : undefined,
    scriptPolicy: scriptPolicy || ((preferEmbed || forceProxy) ? 'allow' : undefined),
  })

  return (
    <div
      className={containerClassName || (presentationMode ? 'aspect-video w-full' : 'aspect-video w-full max-w-xl')}
      style={containerStyle}
    >
      {loaded ? (
        <iframe
          src={embed.iframeSrc}
          title={title}
          allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          sandbox={embed.sandbox}
          referrerPolicy={embed.direct ? 'strict-origin-when-cross-origin' : 'no-referrer'}
          loading="lazy"
          className={['w-full h-full rounded border border-gray-200', className].filter(Boolean).join(' ') || undefined}
          style={style}
          onError={() => {
            if (!forceProxy && /^https?:\/\//i.test(rawSrc)) {
              setForceProxy(true)
              return
            }
            setError(true)
          }}
        />
      ) : (
        <div className="w-full h-full rounded border border-gray-200 bg-black/5 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs px-3 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
              onClick={() => setLoaded(true)}
            >
              {UI_COPY.markdownMediaLoadEmbedLabel}
            </button>
            <a
              className="text-xs underline text-gray-700"
              href={rawSrc}
              target="_blank"
              rel="noreferrer"
            >
              {UI_COPY.markdownMediaOpenInNewTabLabel}
            </a>
          </div>
        </div>
      )}
    </div>
  )
})

export const MediaVideoSnapshot = React.memo(function MediaVideoSnapshot({
  url,
  title,
  presentationMode,
  containerClassName,
  containerStyle,
  className,
  style,
}: {
  url: string
  title: string
  presentationMode: boolean
  containerClassName?: string
  containerStyle?: React.CSSProperties
  className?: string
  style?: React.CSSProperties
}) {
  const normalizedUrl = String(url || '').trim()
  const fallbackInfo = React.useMemo(() => getWebpageFallbackInfo(normalizedUrl, title), [normalizedUrl, title])
  const [thumb, setThumb] = React.useState<string>('')

  React.useEffect(() => {
    let cancelled = false
    setThumb('')
    if (!normalizedUrl) return
    void getOrCreateVideoThumbnail(normalizedUrl).then((v) => {
      if (cancelled) return
      const next = String(v || '').trim()
      setThumb(prev => (prev === next ? prev : next))
    })
    return () => {
      cancelled = true
    }
  }, [normalizedUrl])

  if (!normalizedUrl) return <MediaErrorPlaceholder alt={title} />

  return (
    <div className={presentationMode ? 'w-full' : 'w-full max-w-xl'} data-kg-video-snapshot="1" data-src={normalizedUrl}>
      <a className="sr-only" href={normalizedUrl} target="_blank" rel="noreferrer">
        {normalizedUrl}
      </a>
      <div className={containerClassName || (presentationMode ? 'aspect-video w-full' : 'aspect-video w-full')} style={containerStyle}>
        <div
          className={
            [
              'w-full h-full rounded border border-gray-200 bg-white overflow-hidden relative',
              className,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          style={style}
          data-kg-media-thumbnail="1"
          role="button"
          tabIndex={0}
        >
          {thumb ? (
            <img
              src={thumb}
              alt={fallbackInfo.titleLabel}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'cover', filter: 'saturate(1.05) contrast(1.02)' }}
            />
          ) : (
            <div className="absolute inset-0 bg-black/5" />
          )}
          <div aria-hidden={true} className="absolute inset-0 pointer-events-none">
            <div className="absolute left-2 bottom-2 rounded border border-black/10 bg-white/90 px-2 py-1" style={{ maxWidth: 'min(520px, 92%)' }}>
              <div className="text-[11px] font-semibold text-black/70 truncate">{fallbackInfo.titleLabel}</div>
              <div className="text-[10px] text-black/50 truncate">{fallbackInfo.hostLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export const MediaWebpageSnapshot = React.memo(function MediaWebpageSnapshot({
  url,
  title,
  presentationMode,
  containerClassName,
  containerStyle,
  className,
  style,
}: {
  url: string
  title: string
  presentationMode: boolean
  containerClassName?: string
  containerStyle?: React.CSSProperties
  className?: string
  style?: React.CSSProperties
}) {
  const [snap, setSnap] = React.useState<WebpageLayoutSnapshot | null>(() => null)
  const [blocked, setBlocked] = React.useState<boolean>(() => false)

  const richMediaPanelMode = useGraphStore(s => s.richMediaPanelMode)
  const preferEmbed = richMediaPanelMode === 'embed'

  const forceSnapshot = React.useMemo(() => {
    return shouldForceSnapshotIframeUrl(url)
  }, [url])

  const preferEmbedEffective = preferEmbed && !forceSnapshot

  const normalizedUrl = String(url || '').trim()
  const layoutCacheKey = React.useMemo(() => 'md-webpage-layout:v1:vp=1200x800:maxEl=1200:scroll=1:faq=1:netIdleMs=700:domQuietMs=550:minAfter=750', [])

  const fallbackInfo = React.useMemo(() => getWebpageFallbackInfo(normalizedUrl, title), [normalizedUrl, title])
  const [metaImageUrl, setMetaImageUrl] = React.useState<string>('')

  React.useEffect(() => {
    let cancelled = false
    setMetaImageUrl('')
    if (!normalizedUrl) return
    void getOrFetchWebpageMeta(normalizedUrl).then((m) => {
      if (cancelled) return
      const img = String(m?.imageUrl || '').trim()
      setMetaImageUrl(prev => (prev === img ? prev : img))
    })
    return () => {
      cancelled = true
    }
  }, [normalizedUrl])

  const metaImageSrc = React.useMemo(() => {
    const raw = String(metaImageUrl || '').trim()
    if (!raw) return ''
    return applyImageLikeProxySrc(raw)
  }, [metaImageUrl])

  const faviconSrc = React.useMemo(() => {
    const candidate = getDefaultFaviconUrlForWebpageUrl(normalizedUrl)
    return candidate ? applyImageLikeProxySrc(candidate) : ''
  }, [normalizedUrl])

  const hostIconSrc = React.useMemo(() => {
    const candidate = getKnownHostIconUrlForWebpageUrl(normalizedUrl)
    return candidate ? applyImageLikeProxySrc(candidate) : ''
  }, [normalizedUrl])

  React.useEffect(() => {
    setBlocked(false)
    if (preferEmbedEffective) return
    if (!normalizedUrl) {
      setSnap(null)
      setBlocked(false)
      return
    }
    const cached = getCachedWebpageLayoutSnapshot(normalizedUrl, layoutCacheKey)
    if (cached) {
      setSnap(cached)
      return
    }
    if (!shouldAutoLoadWebpageSnapshot()) {
      return
    }

    const ac = new AbortController()
    let cancelled = false
    void (async () => {
      try {
        const mod = await import('@/lib/websites/webpageDomExport')
        const probe = await mod.probeWebpageDomViaHiddenIframe({
          url: normalizedUrl,
          mode: 'layout',
          maxElements: 1200,
          scrollCrawl: true,
          expandFaq: true,
          timeoutMs: 22_000,
          waitForNetworkIdle: true,
          networkIdleMs: 700,
          domQuietMs: 550,
          minWaitAfterLoadMs: 750,
          viewportW: 1200,
          viewportH: 800,
          signal: ac.signal,
        })
        if (cancelled) return
        if (!probe.ok) {
          const stage = typeof (probe as unknown as { stage?: unknown }).stage === 'string' ? String((probe as unknown as { stage?: unknown }).stage) : ''
          if (stage === 'blocked') {
            setBlocked(true)
          }
          return
        }
        const raw = probe.result?.text
        if (!raw) {
          return
        }
        const parsed = (() => {
          try {
            return JSON.parse(raw) as unknown
          } catch {
            return null
          }
        })()
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return
        }
        const obj = parsed as { meta?: unknown; elements?: unknown }
        const meta = obj.meta as { kind?: unknown } | null
        const elements = obj.elements as unknown
        if (!meta || meta.kind !== 'layout' || !Array.isArray(elements)) {
          return
        }
        const okSnap = parsed as WebpageLayoutSnapshot
        setCachedWebpageLayoutSnapshot(normalizedUrl, okSnap, layoutCacheKey)
        setSnap(okSnap)
      } catch {
        if (cancelled) return
      }
    })()

    return () => {
      cancelled = true
      try {
        ac.abort()
      } catch {
        void 0
      }
    }
  }, [layoutCacheKey, normalizedUrl, preferEmbedEffective])

  if (!normalizedUrl) return <MediaErrorPlaceholder alt={title} />

  const viewportW = typeof snap?.meta?.viewport?.w === 'number' ? snap.meta.viewport.w : 1200
  const viewportH = typeof snap?.meta?.viewport?.h === 'number' ? snap.meta.viewport.h : 800
  const rects = snap ? pickWebpageSnapshotRects(snap) : []

  const content = preferEmbedEffective ? (
    <MediaIframe
      src={normalizedUrl}
      title={title}
      presentationMode={presentationMode}
      scriptPolicy="allow"
      containerClassName={containerClassName}
      containerStyle={containerStyle}
      className={className}
      style={style}
    />
  ) : (
    <div className="w-full h-full relative" data-kg-media-thumbnail="1" role="button" tabIndex={0}>
      {metaImageSrc ? (
        <img
          src={metaImageSrc}
          alt={fallbackInfo.titleLabel}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', filter: 'saturate(1.05) contrast(1.02)' }}
        />
      ) : faviconSrc ? (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.06), rgba(148,163,184,0.10))' }}>
          <img
            src={faviconSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'contain', padding: '18%', opacity: 0.6, filter: 'saturate(1.05) contrast(1.02)' }}
          />
        </div>
      ) : hostIconSrc ? (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.06), rgba(148,163,184,0.10))' }}>
          <img
            src={hostIconSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'contain', padding: '18%', opacity: 0.65, filter: 'saturate(1.05) contrast(1.02)' }}
          />
        </div>
      ) : null}
      {snap ? (
        <svg
          viewBox={`0 0 ${Math.max(1, viewportW)} ${Math.max(1, viewportH)}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
          aria-label={title}
          role="img"
        >
          <rect x={0} y={0} width={viewportW} height={viewportH} fill="#ffffff" />
          {rects.map((r, idx) => (
            <g key={idx}>
              <rect
                x={r.rect.x}
                y={r.rect.y}
                width={r.rect.w}
                height={r.rect.h}
                fill="rgba(0,0,0,0.03)"
                stroke="rgba(0,0,0,0.12)"
                strokeWidth={1}
              />
              {r.text && r.rect.w >= 140 && r.rect.h >= 26 ? (
                <text
                  x={r.rect.x + 8}
                  y={r.rect.y + 18}
                  fontSize={14}
                  fill="rgba(0,0,0,0.55)"
                  fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
                >
                  {r.text.length > 46 ? `${r.text.slice(0, 45)}…` : r.text}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      ) : (
        <div className="absolute inset-0 bg-black/5" />
      )}
      <div aria-hidden={true} className="absolute inset-0 pointer-events-none">
        <div className="absolute left-2 bottom-2 rounded border border-black/10 bg-white/90 px-2 py-1" style={{ maxWidth: 'min(520px, 92%)' }}>
          <div className="text-[11px] font-semibold text-black/70 truncate">{fallbackInfo.titleLabel}</div>
          <div className="text-[10px] text-black/50 truncate">{fallbackInfo.hostLabel}</div>
        </div>
        {blocked ? (
          <div className="absolute right-2 top-2 rounded border border-black/10 bg-white/90 px-2 py-1">
            <div className="text-[10px] font-semibold text-black/60">Blocked</div>
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <div
      className={presentationMode ? 'w-full' : 'w-full max-w-xl'}
      data-kg-webpage-snapshot="1"
      data-src={normalizedUrl}
    >
      <div
        className={containerClassName || (presentationMode ? 'aspect-video w-full' : 'aspect-video w-full')}
        style={containerStyle}
      >
        <div
          className={
            [
              'w-full h-full rounded border border-gray-200 bg-white overflow-hidden relative',
              className,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          style={style}
        >
          {content}
        </div>
      </div>
    </div>
  )
})

export const MediaVideo = ({
  src,
  poster,
  autoPlay,
  muted,
  loop,
  playsInline,
  controls,
  className,
  style,
}: {
  src: string
  poster?: string
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  playsInline?: boolean
  controls?: boolean
  className?: string
  style?: React.CSSProperties
}) => {
  const [error, setError] = React.useState(false)
  const primarySrc = applyMediaProxySrc(src)
  const [useFallback, setUseFallback] = React.useState(false)
  const activeSrc = useFallback ? src : primarySrc
  if (!src || error) {
    return <MediaErrorPlaceholder alt="Video" />
  }
  const showControls = controls === true ? true : autoPlay || loop ? false : true
  return (
    <video
      controls={showControls}
      className={['w-full max-w-full rounded border border-gray-200', className].filter(Boolean).join(' ') || undefined}
      style={style}
      src={activeSrc}
      poster={poster || undefined}
      autoPlay={autoPlay || undefined}
      muted={muted || undefined}
      loop={loop || undefined}
      playsInline={playsInline || undefined}
      onError={() => {
        if (!useFallback && primarySrc !== src) {
          setUseFallback(true)
          return
        }
        setError(true)
      }}
    />
  )
}

export const MediaAudio = ({
  src,
  autoPlay,
  muted,
  loop,
  controls,
  className,
  style,
}: {
  src: string
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  controls?: boolean
  className?: string
  style?: React.CSSProperties
}) => {
  const [error, setError] = React.useState(false)
  const primarySrc = applyMediaProxySrc(src)
  const [useFallback, setUseFallback] = React.useState(false)
  const activeSrc = useFallback ? src : primarySrc
  if (!src || error) {
    return <MediaErrorPlaceholder alt="Audio" />
  }
  const showControls = controls === false ? false : true
  return (
    <audio
      controls={showControls}
      className={['w-full max-w-full rounded border border-gray-200', className].filter(Boolean).join(' ') || undefined}
      style={style}
      src={activeSrc}
      autoPlay={autoPlay || undefined}
      muted={muted || undefined}
      loop={loop || undefined}
      onError={() => {
        if (!useFallback && primarySrc !== src) {
          setUseFallback(true)
          return
        }
        setError(true)
      }}
    />
  )
}

const MediaErrorPlaceholder = ({ alt }: { alt?: string }) => {
  const prefix = UI_COPY.markdownMediaErrorPrefix
  const label = alt ? `${prefix}: ${alt}` : prefix
  return (
    <div className="flex items-center justify-center w-full max-w-xl h-32 rounded border border-dashed border-red-300 bg-red-50 text-[11px] text-red-700 px-3 text-center">
      <span>{label}</span>
    </div>
  )
}

export const MediaImage = ({
  src,
  alt,
  width,
  height,
  className,
  style: styleProp,
}: {
  src?: string
  alt: string
  width?: number | null
  height?: number | null
  className?: string
  style?: React.CSSProperties
}) => {
  const [error, setError] = React.useState(false)
  const style: React.CSSProperties = { ...(styleProp || {}) }
  if (width) {
    style.width = `${Math.round(width)}px`
    style.maxWidth = '100%'
  }
  if (height) style.height = `${Math.round(height)}px`
  const primarySrc = applyImageLikeProxySrc(src || '')
  const [useFallback, setUseFallback] = React.useState(false)
  const activeSrc = useFallback ? (src || '') : primarySrc
  if (!src || error) {
    return <MediaErrorPlaceholder alt={alt} />
  }
  return (
    <img
      src={activeSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={Object.keys(style).length ? style : undefined}
      className={['block mx-auto max-w-full h-auto rounded border border-gray-200', className].filter(Boolean).join(' ') || undefined}
      data-kg-media-thumbnail="1"
      onError={() => {
        if (!useFallback && primarySrc !== src) {
          setUseFallback(true)
          return
        }
        setError(true)
      }}
    />
  )
}
