import { coerceHttpUrl, normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { looksLikeViteDevIndexHtml } from '@/lib/config'
import { fetchRemoteText } from '@/lib/net/fetchRemoteText'

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
