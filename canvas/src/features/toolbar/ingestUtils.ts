import { coerceHttpUrl, normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { looksLikeViteDevIndexHtml } from '@/lib/config'

export function promptForUrl(message: string): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.prompt(message, '') || ''
  return raw.trim() || null
}

export function isMarkdownUrlPath(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const path = url.pathname.toLowerCase()
    return path.endsWith('.md') || path.endsWith('.markdown')
  } catch {
    return false
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

export async function fetchRemoteText(
  rawUrl: string,
  options?: {
    useProxy?: boolean
    proxyEndpoint?: string
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

  const attempt = async (targetUrl: string): Promise<string | null> => {
    try {
      const res = await fetch(targetUrl)
      if (!res.ok) return null
      const text = await res.text()
      if (options?.validate && !options.validate(text)) return null
      return text
    } catch {
      return null
    }
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
