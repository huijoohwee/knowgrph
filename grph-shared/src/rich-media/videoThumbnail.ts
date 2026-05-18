import { buildRichMediaPreviewSemanticKey, buildYouTubeThumbnailPreviewDescriptor } from './providers.js'

type CacheEntry = {
  value: string | null
  inflight?: Promise<string | null>
}

const getCache = (): Map<string, CacheEntry> => {
  const g = globalThis as unknown as { __kgVideoThumbCache?: Map<string, CacheEntry> }
  if (!g.__kgVideoThumbCache) g.__kgVideoThumbCache = new Map()
  return g.__kgVideoThumbCache
}

const lruTouch = (cache: Map<string, CacheEntry>, key: string, max = 80) => {
  const v = cache.get(key)
  if (!v) return
  cache.delete(key)
  cache.set(key, v)
  while (cache.size > max) {
    const first = cache.keys().next().value as string | undefined
    if (!first) break
    cache.delete(first)
  }
}

const isDirectVideoUrl = (href: string): boolean => /\.(mp4|webm|mov|ogg)(\?|#|$)/i.test(href)

const toProxy = (absUrl: string): string => `/__fetch_remote?url=${encodeURIComponent(absUrl)}`

async function captureVideoFrameThumbnail(absUrl: string): Promise<string | null> {
  if (typeof document === 'undefined') return null
  try {
    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : ''
    if (/jsdom/i.test(ua)) return null
  } catch {
    void 0
  }
  const url = String(absUrl || '').trim()
  if (!url) return null
  const src = toProxy(url)
  return await new Promise<string | null>((resolve) => {
    let done = false
    let timeoutId: number | undefined
    const finish = (v: string | null) => {
      if (done) return
      done = true
      try {
        if (typeof timeoutId === 'number') window.clearTimeout(timeoutId)
        cleanup()
      } catch {
        void 0
      }
      resolve(v)
    }

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    try {
      ;(video as unknown as { crossOrigin?: string }).crossOrigin = 'anonymous'
    } catch {
      void 0
    }
    video.style.position = 'fixed'
    video.style.left = '-10000px'
    video.style.top = '0'
    video.style.width = '320px'
    video.style.height = '180px'

    const cleanup = () => {
      try {
        video.pause()
      } catch {
        void 0
      }
      try {
        video.removeAttribute('src')
        video.load()
      } catch {
        void 0
      }
      try {
        video.remove()
      } catch {
        void 0
      }
    }

    const onError = () => finish(null)
    const onLoaded = async () => {
      try {
        const dur = Number.isFinite(video.duration) ? video.duration : 0
        const target = dur > 4 ? 1 : 0
        const seekTo = Math.max(0, Math.min(dur || 0, target))
        const seek = () => {
          try {
            video.currentTime = seekTo
          } catch {
            finish(null)
          }
        }
        const onSeeked = () => {
          try {
            const w = Math.max(2, video.videoWidth || 0)
            const h = Math.max(2, video.videoHeight || 0)
            const canvas = document.createElement('canvas')
            const scale = Math.min(1, 520 / w)
            canvas.width = Math.max(2, Math.floor(w * scale))
            canvas.height = Math.max(2, Math.floor(h * scale))
            const ctx = canvas.getContext('2d')
            if (!ctx) return finish(null)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.72)
            finish(dataUrl && dataUrl.startsWith('data:image/') ? dataUrl : null)
          } catch {
            finish(null)
          }
        }
        video.addEventListener('seeked', onSeeked, { once: true })
        seek()
      } catch {
        finish(null)
      }
    }

    timeoutId = window.setTimeout(() => finish(null), 8000)
    video.addEventListener('error', onError, { once: true })
    video.addEventListener('loadeddata', onLoaded, { once: true })
    document.body.appendChild(video)
    video.src = src
  })
}

export async function getOrCreateVideoThumbnail(url: string): Promise<string | null> {
  const raw = String(url || '').trim()
  if (!raw) return null
  const youtubeThumbnail = buildYouTubeThumbnailPreviewDescriptor(raw)
  const cacheKey = youtubeThumbnail?.semanticKey || buildRichMediaPreviewSemanticKey(['video', 'thumbnail', raw])
  const cache = getCache()
  const existing = cache.get(cacheKey)
  if (existing) {
    if (existing.value) {
      lruTouch(cache, cacheKey)
      return existing.value
    }
    if (existing.inflight) return await existing.inflight
  }

  const inflight = (async (): Promise<string | null> => {
    if (youtubeThumbnail?.thumbnailUrl) return toProxy(youtubeThumbnail.thumbnailUrl)
    if (isDirectVideoUrl(raw)) {
      return await captureVideoFrameThumbnail(raw)
    }
    return null
  })()

  cache.set(cacheKey, { value: null, inflight })
  const value = await inflight
  cache.set(cacheKey, { value: value || null })
  lruTouch(cache, cacheKey)
  return value
}
