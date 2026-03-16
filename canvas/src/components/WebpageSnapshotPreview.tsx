import React from 'react'
import type { WebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutExport'
import { getCachedWebpageLayoutSnapshot, setCachedWebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutCache'
import { pickWebpageSnapshotRects, shouldAutoLoadWebpageSnapshot } from 'grph-shared/rich-media/webpageSnapshot'
import { normalizeWebpageLikeUrl } from 'grph-shared/url'
import { getWebpageFallbackInfo } from 'grph-shared/rich-media/webpageFallback'
import { getOrFetchWebpageMeta } from 'grph-shared/rich-media/webpageMeta'
import { getDefaultFaviconUrlForWebpageUrl, getKnownHostIconUrlForWebpageUrl } from 'grph-shared/rich-media/webpagePreview'
import { applyImageLikeProxySrc } from '@/lib/url'

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
  const [blocked, setBlocked] = React.useState<boolean>(false)
  const [retrySeq, setRetrySeq] = React.useState<number>(0)
  const attemptRef = React.useRef<{ url: string; count: number }>({ url: '', count: 0 })

  const canStartProbe = React.useCallback((): boolean => {
    try {
      if (typeof document === 'undefined') return false
      if (!document.body) return false
      if (!document.body.isConnected) return false
      const rs = String(document.readyState || '')
      if (rs === 'loading') return false
      return true
    } catch {
      return false
    }
  }, [])

  React.useEffect(() => {
    if (!url) {
      attemptRef.current = { url: '', count: 0 }
      setSnap(null)
      setBlocked(false)
      return
    }
    if (attemptRef.current.url !== url) attemptRef.current = { url, count: 0 }
    setBlocked(false)
    const cached = getCachedWebpageLayoutSnapshot(url, layoutCacheKey)
    if (cached) {
      setSnap(cached)
      attemptRef.current = { url, count: 0 }
      return
    }
    if (!shouldAutoLoadWebpageSnapshot({ allowNodeJsUserAgent: true })) {
      return
    }
    if (!canStartProbe()) {
      const t = window.setTimeout(() => {
        setRetrySeq(s => s + 1)
      }, 120)
      return () => {
        window.clearTimeout(t)
      }
    }
    if (attemptRef.current.count >= 4) return
    attemptRef.current.count += 1
    let cancelled = false
    let retryTimer: number | undefined
    void (async () => {
      try {
        await new Promise<void>(resolve => {
          const raf = (typeof window !== 'undefined' ? window.requestAnimationFrame : null) as unknown as
            | ((cb: () => void) => number)
            | null
          if (raf) raf(() => resolve())
          else setTimeout(() => resolve(), 0)
        })
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
        })
        if (cancelled) return
        if (!probe.ok) {
          const stage = typeof (probe as unknown as { stage?: unknown }).stage === 'string' ? String((probe as unknown as { stage?: unknown }).stage) : ''
          if (stage === 'blocked') {
            setBlocked(true)
            attemptRef.current = { url, count: 99 }
            return
          }
          const delay = 650 + attemptRef.current.count * 800
          retryTimer = window.setTimeout(() => {
            setRetrySeq(s => s + 1)
          }, delay)
          return
        }
        const raw = probe.result?.text
        if (!raw) {
          const delay = 650 + attemptRef.current.count * 800
          retryTimer = window.setTimeout(() => {
            setRetrySeq(s => s + 1)
          }, delay)
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
          const delay = 650 + attemptRef.current.count * 800
          retryTimer = window.setTimeout(() => {
            setRetrySeq(s => s + 1)
          }, delay)
          return
        }
        const obj = parsed as { meta?: unknown; elements?: unknown }
        const meta = obj.meta as { kind?: unknown } | null
        const elements = obj.elements as unknown
        if (!meta || meta.kind !== 'layout' || !Array.isArray(elements)) {
          const delay = 650 + attemptRef.current.count * 800
          retryTimer = window.setTimeout(() => {
            setRetrySeq(s => s + 1)
          }, delay)
          return
        }
        const okSnap = parsed as WebpageLayoutSnapshot
        setCachedWebpageLayoutSnapshot(url, okSnap, layoutCacheKey)
        setSnap(okSnap)
        attemptRef.current = { url, count: 0 }
      } catch {
        if (cancelled) return
        const delay = 650 + attemptRef.current.count * 800
        retryTimer = window.setTimeout(() => {
          setRetrySeq(s => s + 1)
        }, delay)
        void 0
      }
    })()
    return () => {
      cancelled = true
      try {
        if (typeof retryTimer === 'number') window.clearTimeout(retryTimer)
      } catch {
        void 0
      }
    }
  }, [layoutCacheKey, retrySeq, url])

  const viewportW = typeof snap?.meta?.viewport?.w === 'number' ? snap.meta.viewport.w : 1100
  const viewportH = typeof snap?.meta?.viewport?.h === 'number' ? snap.meta.viewport.h : 720
  const rects = snap ? pickWebpageSnapshotRects(snap) : []

  const fallbackInfo = React.useMemo(() => getWebpageFallbackInfo(url, title), [title, url])
  const [metaImageUrl, setMetaImageUrl] = React.useState<string>('')

  const metaImageSrc = React.useMemo(() => {
    const raw = String(metaImageUrl || '').trim()
    if (!raw) return ''
    return applyImageLikeProxySrc(raw)
  }, [metaImageUrl])

  const faviconSrc = React.useMemo(() => {
    const candidate = getDefaultFaviconUrlForWebpageUrl(url)
    return candidate ? applyImageLikeProxySrc(candidate) : ''
  }, [url])

  const hostIconSrc = React.useMemo(() => {
    const candidate = getKnownHostIconUrlForWebpageUrl(url)
    return candidate ? applyImageLikeProxySrc(candidate) : ''
  }, [url])

  React.useEffect(() => {
    let cancelled = false
    setMetaImageUrl('')
    if (!url) return
    void getOrFetchWebpageMeta(url).then((m) => {
      if (cancelled) return
      const img = String(m?.imageUrl || '').trim()
      setMetaImageUrl(prev => (prev === img ? prev : img))
    })
    return () => {
      cancelled = true
    }
  }, [url])


  return (
    <div className={props.className} style={props.style} data-kg-webpage-snapshot="1" data-src={url}>
      <div className="w-full h-full relative">
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
    </div>
  )
}
