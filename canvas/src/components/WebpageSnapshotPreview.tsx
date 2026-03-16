import React from 'react'
import type { WebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutExport'
import { getCachedWebpageLayoutSnapshot, setCachedWebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutCache'
import { pickWebpageSnapshotRects, shouldAutoLoadWebpageSnapshot } from 'grph-shared/rich-media/webpageSnapshot'
import { normalizeWebpageLikeUrl } from 'grph-shared/url'
import { resolveIframeEmbed } from 'grph-shared/rich-media/iframe'

export default function WebpageSnapshotPreview(props: {
  url: string
  title?: string
  className?: string
  style?: React.CSSProperties
}) {
  const url = React.useMemo(() => normalizeWebpageLikeUrl(String(props.url || '').trim()), [props.url])
  const title = String(props.title || '').trim()
  const layoutCacheKey = React.useMemo(
    () => 'ui-webpage-layout:v1:vp=1100x720:maxEl=1100:scroll=1:faq=1:netIdleMs=700:domQuietMs=550:minAfter=750',
    [],
  )

  const [snap, setSnap] = React.useState<WebpageLayoutSnapshot | null>(() => {
    if (!url) return null
    return getCachedWebpageLayoutSnapshot(url, layoutCacheKey)
  })
  const [fallbackToIframe, setFallbackToIframe] = React.useState(false)
  const loadedUrlRef = React.useRef<string>('')

  React.useEffect(() => {
    if (!url) {
      loadedUrlRef.current = ''
      setSnap(null)
      setFallbackToIframe(false)
      return
    }
    const cached = getCachedWebpageLayoutSnapshot(url, layoutCacheKey)
    if (cached) {
      setSnap(cached)
      loadedUrlRef.current = url
      setFallbackToIframe(false)
      return
    }
    if (!shouldAutoLoadWebpageSnapshot({ allowNodeJsUserAgent: true })) return
    if (loadedUrlRef.current === url) return
    loadedUrlRef.current = url
    const ac = new AbortController()
    let cancelled = false
    void (async () => {
      try {
        const mod = await import('@/lib/websites/webpageDomExport')
        const probe = await mod.probeWebpageDomViaHiddenIframe({
          url,
          mode: 'layout',
          maxElements: 1100,
          scrollCrawl: true,
          expandFaq: true,
          timeoutMs: 22_000,
          waitForNetworkIdle: true,
          networkIdleMs: 700,
          domQuietMs: 550,
          minWaitAfterLoadMs: 750,
          viewportW: 1100,
          viewportH: 720,
          signal: ac.signal,
        })
        if (cancelled) return
        if (!probe.ok) {
          setFallbackToIframe(true)
          return
        }
        const raw = probe.result?.text
        if (!raw) return
        const parsed = (() => {
          try {
            return JSON.parse(raw) as unknown
          } catch {
            return null
          }
        })()
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
        const obj = parsed as { meta?: unknown; elements?: unknown }
        const meta = obj.meta as { kind?: unknown } | null
        const elements = obj.elements as unknown
        if (!meta || meta.kind !== 'layout' || !Array.isArray(elements)) return
        const okSnap = parsed as WebpageLayoutSnapshot
        setCachedWebpageLayoutSnapshot(url, okSnap, layoutCacheKey)
        setSnap(okSnap)
        setFallbackToIframe(false)
      } catch {
        setFallbackToIframe(true)
        void 0
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
  }, [layoutCacheKey, url])

  React.useEffect(() => {
    if (!url) return
    if (snap) return
    if (fallbackToIframe) return
    const t = window.setTimeout(() => {
      setFallbackToIframe(true)
    }, 2200)
    return () => {
      window.clearTimeout(t)
    }
  }, [fallbackToIframe, snap, url])

  const viewportW = typeof snap?.meta?.viewport?.w === 'number' ? snap.meta.viewport.w : 1100
  const viewportH = typeof snap?.meta?.viewport?.h === 'number' ? snap.meta.viewport.h : 720
  const rects = snap ? pickWebpageSnapshotRects(snap) : []

  const iframeFallback = React.useMemo(() => {
    if (!url) return null
    if (!fallbackToIframe) return null
    const embed = resolveIframeEmbed({ url, embedMode: 'proxy', scriptPolicy: 'allow' })
    return embed
  }, [fallbackToIframe, url])

  return (
    <div className={props.className} style={props.style} data-kg-webpage-snapshot="1" data-src={url}>
      {snap ? (
        <svg
          viewBox={`0 0 ${Math.max(1, viewportW)} ${Math.max(1, viewportH)}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          aria-label={title || url}
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
      ) : iframeFallback ? (
        <iframe
          src={iframeFallback.iframeSrc}
          title={title || url}
          sandbox={iframeFallback.sandbox}
          referrerPolicy={iframeFallback.direct ? 'strict-origin-when-cross-origin' : 'no-referrer'}
          loading="lazy"
          className="w-full h-full"
          style={{ border: 0, background: 'transparent' }}
        />
      ) : (
        <div className="w-full h-full bg-black/5" />
      )}
    </div>
  )
}
