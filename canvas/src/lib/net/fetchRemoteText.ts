import { coerceFetchUrl, REMOTE_FETCH_PROXY_ENDPOINT } from '@/lib/url'

type FetchFailureKind = 'http' | 'timeout' | 'too_large' | 'network'

export type FetchRemoteTextFailure = {
  ok: false
  kind: FetchFailureKind
  url: string
  usedProxy: boolean
  status?: number
  contentLength?: number
}

export type FetchRemoteTextSuccess = {
  ok: true
  text: string
  url: string
  usedProxy: boolean
  status: number
  contentLength?: number
}

export type FetchRemoteTextResult = FetchRemoteTextSuccess | FetchRemoteTextFailure

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

async function fetchTextWithLimitDetailed(
  url: string,
  opts: { timeoutMs: number; maxBytes: number; validate?: (text: string) => boolean },
): Promise<{ ok: true; text: string; status: number; contentLength?: number } | { ok: false; kind: FetchFailureKind; status?: number; contentLength?: number }> {
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
    const status = res.status
    const contentLengthRaw = res.headers.get('content-length')
    const contentLength = contentLengthRaw ? Number(contentLengthRaw) : NaN
    const contentLengthNum = Number.isFinite(contentLength) ? Math.floor(contentLength) : undefined
    if (!res.ok) return { ok: false, kind: 'http', status, contentLength: contentLengthNum }
    if (contentLengthNum != null && contentLengthNum > opts.maxBytes) {
      return { ok: false, kind: 'too_large', status, contentLength: contentLengthNum }
    }

    const reader = res.body?.getReader()
    if (!reader) {
      const textFallback = await res.text()
      if (opts.validate && !opts.validate(textFallback)) return { ok: false, kind: 'network', status, contentLength: contentLengthNum }
      return { ok: true, text: textFallback, status, contentLength: contentLengthNum }
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
        return { ok: false, kind: 'too_large', status, contentLength: contentLengthNum }
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    if (opts.validate && !opts.validate(text)) return { ok: false, kind: 'network', status, contentLength: contentLengthNum }
    return { ok: true, text, status, contentLength: contentLengthNum }
  } catch (e) {
    const name = e && typeof e === 'object' && 'name' in e ? String((e as { name?: unknown }).name || '') : ''
    if (/abort/i.test(name)) return { ok: false, kind: 'timeout' }
    return { ok: false, kind: 'network' }
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

async function headContentLength(url: string, timeoutMs: number): Promise<{ ok: true; status: number; contentLength?: number } | { ok: false }> {
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
      ? timeoutSet(() => controller.abort(), Math.max(0, timeoutMs))
      : null
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller?.signal })
    const contentLengthRaw = res.headers.get('content-length')
    const contentLength = contentLengthRaw ? Number(contentLengthRaw) : NaN
    const contentLengthNum = Number.isFinite(contentLength) ? Math.floor(contentLength) : undefined
    return { ok: true, status: res.status, contentLength: contentLengthNum }
  } catch {
    return { ok: false }
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

export async function fetchRemoteTextDetailed(
  rawUrl: string,
  options?: {
    useProxy?: boolean
    proxyEndpoint?: string
    timeoutMs?: number
    maxBytes?: number
    validate?: (text: string) => boolean
    preflightHead?: boolean
  },
): Promise<FetchRemoteTextResult> {
  const url = coerceFetchUrl(rawUrl)
  if (!url) return { ok: false, kind: 'network', url: String(rawUrl || ''), usedProxy: false }

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
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.min(50 * 1024 * 1024, Math.max(64 * 1024, Math.floor(raw)))
    return 8 * 1024 * 1024
  })()

  const proxyUrl = `${proxyEndpoint}?url=${encodeURIComponent(url)}`
  const preflightHead = options?.preflightHead === true

  const attempt = async (targetUrl: string, usedProxy: boolean): Promise<FetchRemoteTextResult> => {
    const r = await fetchTextWithLimitDetailed(targetUrl, {
      timeoutMs,
      maxBytes,
      validate: options?.validate,
    })
    if (r.ok) return { ok: true, text: r.text, url: targetUrl, usedProxy, status: r.status, contentLength: r.contentLength }
    return { ok: false, kind: r.ok === false ? r.kind : 'network', url: targetUrl, usedProxy, status: r.status, contentLength: r.contentLength }
  }

  if (shouldPreferProxy) {
    if (preflightHead) {
      const head = await headContentLength(proxyUrl, Math.min(10_000, timeoutMs))
      if (head.ok && head.contentLength != null && head.contentLength > maxBytes) {
        return { ok: false, kind: 'too_large', url, usedProxy: true, status: head.status, contentLength: head.contentLength }
      }
    }
    const viaProxy = await attempt(proxyUrl, true)
    if (viaProxy.ok) return viaProxy
    if (viaProxy.ok === false && viaProxy.kind === 'too_large') return viaProxy
    const direct = await attempt(url, false)
    return direct.ok ? direct : viaProxy
  }

  if (preflightHead) {
    const head = await headContentLength(url, Math.min(10_000, timeoutMs))
    if (head.ok && head.contentLength != null && head.contentLength > maxBytes) {
      return { ok: false, kind: 'too_large', url, usedProxy: false, status: head.status, contentLength: head.contentLength }
    }
  }

  const direct = await attempt(url, false)
  if (direct.ok) return direct
  if (direct.ok === false && direct.kind === 'too_large') return direct
  const viaProxy = await attempt(proxyUrl, true)
  return viaProxy.ok ? viaProxy : direct
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
  const result = await fetchRemoteTextDetailed(rawUrl, options)
  return result.ok ? result.text : null
}
