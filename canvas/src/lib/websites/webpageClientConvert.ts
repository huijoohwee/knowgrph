import { exportWebpageDomViaHiddenIframe } from './webpageDomExport'
import { plainTextToMarkdown } from '@/lib/markdown/plainTextToMarkdown'
import { convertWebpageHtmlToMarkdownArtifactAsync } from '@/lib/websites/webpageHtmlToMarkdownArtifact'

export type WebpageClientConvertResult =
  | { ok: true; markdown: string; title: string }
  | { ok: false; error: string }

const isJsdomLike = (): boolean => {
  try {
    const p = (globalThis as unknown as { process?: unknown }).process as { versions?: { node?: unknown } } | undefined
    if (p && p.versions && p.versions.node) return true
  } catch {
    void 0
  }
  try {
    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : ''
    if (ua && /jsdom/i.test(ua)) return true
  } catch {
    void 0
  }
  return false
}

const extractTitleFromHtml = (html: string): string => {
  const raw = String(html || '')
  const m = raw.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)
  const t = m ? String(m[1] || '') : ''
  return t.replace(/\s+/g, ' ').trim()
}

export const convertWebpageUrlToMarkdownViaProxyFetch = async (url: string): Promise<WebpageClientConvertResult> => {
  try {
    const res = await fetch(`/__webpage_proxy?url=${encodeURIComponent(url)}`, { headers: { Accept: 'text/html,*/*;q=0.9' } })
    const html = await res.text()
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const title = extractTitleFromHtml(html)
    const bounded = html.length > 8_000_000 ? html.slice(0, 8_000_000) : html
    const md = await convertWebpageHtmlToMarkdownArtifactAsync({ html: bounded, url, includeImages: true, fidelityLevel: 4 })
    return { ok: true, markdown: md, title }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
    return { ok: false, error: msg || 'Fetch failed' }
  }
}

export async function convertWebpageUrlToMarkdownViaBrowser(args: {
  url: string
}): Promise<WebpageClientConvertResult> {
  const url = String(args.url || '').trim()
  if (!url) return { ok: false, error: 'Missing url' }
  if (isJsdomLike()) {
    return await convertWebpageUrlToMarkdownViaProxyFetch(url)
  }
  try {
    const fast = await convertWebpageUrlToMarkdownViaProxyFetch(url)
    if (fast.ok === true && String(fast.markdown || '').trim().length >= 1400) return fast

    const [textRes, htmlRes] = await Promise.all([
      exportWebpageDomViaHiddenIframe({ url, mode: 'text', scrollCrawl: true, expandFaq: true, timeoutMs: 25_000 }),
      exportWebpageDomViaHiddenIframe({ url, mode: 'html', scrollCrawl: false, expandFaq: true, timeoutMs: 25_000 }),
    ])

    const title = String(htmlRes?.title || textRes?.title || '').trim()
    const text = String(textRes?.text || '').trim()
    const html = htmlRes && !htmlRes.clipped ? String(htmlRes.text || '').trim() : ''

    if (!html && !text) {
      const fallback = await convertWebpageUrlToMarkdownViaProxyFetch(url)
      if (fallback.ok === true) return fallback
      return { ok: false, error: 'No DOM content extracted' }
    }

    if (!html && text) return { ok: true, markdown: plainTextToMarkdown(text, title || undefined), title }
    const bounded = html.length > 8_000_000 ? html.slice(0, 8_000_000) : html
    let md = await convertWebpageHtmlToMarkdownArtifactAsync({ html: bounded, url, includeImages: true, fidelityLevel: 4 })

    if (!String(md || '').trim()) {
      const fallback = await convertWebpageUrlToMarkdownViaProxyFetch(url)
      if (fallback.ok === true) return fallback
    }

    return { ok: true, markdown: md, title }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
    if (msg) {
      const fallback = await convertWebpageUrlToMarkdownViaProxyFetch(url)
      if (fallback.ok === true) return fallback
    }
    return { ok: false, error: msg || 'Browser conversion failed' }
  }
}
