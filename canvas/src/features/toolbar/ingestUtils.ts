import { coerceHttpUrl, deriveFilenameFromUrl, normalizeGitHubBlobLikeUrl } from '@/lib/url'
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

export function promptForText(message: string, initialValue: string = ''): string | null {
  if (typeof window === 'undefined') return null
  if (typeof window.prompt !== 'function') return null
  try {
    const raw = window.prompt(message, initialValue) || ''
    const trimmed = raw.trim()
    return trimmed || null
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

export function normalizeImportName(
  rawUrl: string,
  fallback: string,
  kind: 'markdown' | 'json' | 'html' | 'pdf',
  jsonFormat?: 'jsonld' | 'json',
): string {
  const trimmed = String(rawUrl || '').trim()
  if (!trimmed) return fallback
  const url = coerceHttpUrl(trimmed)
  if (!url) return fallback

  if (kind === 'markdown') return deriveMarkdownNameFromUrl(url)

  const filename = deriveFilenameFromUrl(url, fallback)
  const base = String(filename || '').trim()
  if (!base) return fallback

  if (kind === 'pdf') return deriveMarkdownNameFromPdfFilename(base)
  if (kind === 'html') return /\.html$/i.test(base) ? base : `${base}.html`
  if (kind === 'json') {
    const fmt = jsonFormat || 'json'
    const root = base.replace(/\.json(ld)?$/i, '').trim()
    return root ? `${root}.${fmt}` : fallback
  }
  return base
}

export function deriveJsonNameFromUrlByFormat(
  rawUrl: string,
  format: 'jsonld' | 'json',
): string {
  const fb = format === 'jsonld' ? 'remote.jsonld' : 'remote.json'
  return normalizeImportName(rawUrl, fb, 'json', format)
}

export async function fetchRemoteHtmlText(rawUrl: string): Promise<string | null> {
  const url = coerceHttpUrl(rawUrl)
  if (!url) return null
  const normalized = normalizeGitHubBlobLikeUrl(url) ?? url
  return fetchRemoteText(normalized, {
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
