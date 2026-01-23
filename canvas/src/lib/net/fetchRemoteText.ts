import { coerceFetchUrl, REMOTE_FETCH_PROXY_ENDPOINT } from '@/lib/url'

async function fetchTextWithLimit(
  url: string,
  opts: { timeoutMs: number; maxBytes: number; validate?: (text: string) => boolean },
): Promise<string | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeoutSet =
    typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { setTimeout?: unknown }).setTimeout === 'function'
      ? (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => unknown }).setTimeout
      : null
  const timeoutClear =
    typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { clearTimeout?: unknown }).clearTimeout === 'function'
      ? (globalThis as unknown as { clearTimeout: (id: unknown) => void }).clearTimeout
      : null
  const timeoutId =
    controller && timeoutSet
      ? timeoutSet(() => controller.abort(), Math.max(0, opts.timeoutMs))
      : null
  try {
    const res = await fetch(url, { signal: controller?.signal })
    if (!res.ok) return null
    const reader = res.body?.getReader()
    if (!reader) {
      const textFallback = await res.text()
      if (opts.validate && !opts.validate(textFallback)) return null
      return textFallback
    }
    const decoder = new TextDecoder('utf-8')
    let total = 0
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      total += value.byteLength
      if (total > opts.maxBytes) {
        try {
          await reader.cancel()
        } catch {
          void 0
        }
        return null
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    if (opts.validate && !opts.validate(text)) return null
    return text
  } catch {
    return null
  } finally {
    if (timeoutId != null && timeoutClear) {
      try {
        timeoutClear(timeoutId)
      } catch {
        void 0
      }
    }
  }
}

export async function fetchRemoteText(
  rawUrl: string,
  options?: {
    useProxy?: boolean
    proxyEndpoint?: string
    timeoutMs?: number
    maxBytes?: number
    validate?: (text: string) => boolean
  },
): Promise<string | null> {
  const url = coerceFetchUrl(rawUrl)
  if (!url) return null

  const useProxy = options?.useProxy ?? true
  const proxyEndpoint = options?.proxyEndpoint ?? REMOTE_FETCH_PROXY_ENDPOINT

  const shouldPreferProxy = (() => {
    if (!useProxy) return false
    try {
      const u = new URL(url)
      if (!/^https?:$/.test(u.protocol)) return false
      if (typeof window === 'undefined') return false
      return u.origin !== window.location.origin
    } catch {
      return true
    }
  })()

  const timeoutMs = (() => {
    const raw = options?.timeoutMs
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.min(60_000, Math.max(1_000, Math.floor(raw)))
    return 15_000
  })()
  const maxBytes = (() => {
    const raw = options?.maxBytes
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.min(20 * 1024 * 1024, Math.max(64 * 1024, Math.floor(raw)))
    return 8 * 1024 * 1024
  })()

  const attempt = async (targetUrl: string): Promise<string | null> => {
    return fetchTextWithLimit(targetUrl, {
      timeoutMs,
      maxBytes,
      validate: options?.validate,
    })
  }

  const proxyUrl = `${proxyEndpoint}?url=${encodeURIComponent(url)}`

  if (shouldPreferProxy) {
    const viaProxy = await attempt(proxyUrl)
    if (viaProxy !== null) return viaProxy
    return attempt(url)
  }

  const direct = await attempt(url)
  if (direct !== null) return direct
  return attempt(proxyUrl)
}
