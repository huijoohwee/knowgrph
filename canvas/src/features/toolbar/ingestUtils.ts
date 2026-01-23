import { coerceHttpUrl, normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { looksLikeViteDevIndexHtml } from '@/lib/config'

export function promptForUrl(message: string): string | null {
  if (typeof window === 'undefined') return null
  if (typeof window.prompt !== 'function') return null
  try {
    const raw = window.prompt(message, '') || ''
    return raw.trim() || null
  } catch {
    return null
  }
}

export function deriveMarkdownNameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    const parts = url.pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    const base = last || 'document.md'
    if (/\.md$/i.test(base) || /\.markdown$/i.test(base)) return base
    return `${base}.md`
  } catch {
    return 'document.md'
  }
}

export function deriveMarkdownNameFromPdfFilename(name: string): string {
  const raw = String(name || '').trim()
  if (!raw) return 'document.md'
  const base = raw.replace(/\.pdf$/i, '') || 'document'
  return `${base}.md`
}

async function fetchTextWithLimit(
  url: string,
  opts: { timeoutMs: number; maxBytes: number; validate?: (text: string) => boolean },
): Promise<string | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeoutId =
    controller && typeof window !== 'undefined'
      ? window.setTimeout(() => controller.abort(), Math.max(0, opts.timeoutMs))
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
    if (timeoutId != null) {
      try {
        window.clearTimeout(timeoutId)
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
  const url = coerceHttpUrl(rawUrl)
  if (!url) return null

  const useProxy = options?.useProxy ?? true
  const proxyEndpoint = options?.proxyEndpoint ?? '/__fetch_remote'

  const shouldPreferProxy = (() => {
    if (!useProxy) return false
    try {
      const u = new URL(url)
      if (!/^https?:$/.test(u.protocol)) return false
      if (typeof window === 'undefined') return true
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

export async function fetchRemoteHtmlText(rawUrl: string): Promise<string | null> {
  return fetchRemoteText(rawUrl, {
    validate: (text) => !looksLikeViteDevIndexHtml(text),
  })
}

export async function fetchRemoteMarkdownText(
  rawUrl: string,
): Promise<{ name: string; text: string; displayName: string } | null> {
  const url = coerceHttpUrl(rawUrl)
  if (!url) return null
  const normalized = normalizeGitHubBlobLikeUrl(url) ?? url
  const text = await fetchRemoteText(normalized)
  if (!text) return null

  return { name: url, displayName: deriveMarkdownNameFromUrl(url), text }
}
