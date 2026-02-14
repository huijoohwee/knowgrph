import { exportWebpageDomViaHiddenIframe } from './webpageDomExport'
import { plainTextToMarkdown } from '@/lib/markdown/plainTextToMarkdown'

export type WebpageClientConvertResult =
  | { ok: true; markdown: string; title: string }
  | { ok: false; error: string }

const normalizeText = (s: string): string => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

export async function convertWebpageUrlToMarkdownViaBrowser(args: {
  url: string
}): Promise<WebpageClientConvertResult> {
  const url = String(args.url || '').trim()
  if (!url) return { ok: false, error: 'Missing url' }
  try {
    const textRes = await exportWebpageDomViaHiddenIframe({ url, mode: 'text', scrollCrawl: true, expandFaq: true, timeoutMs: 25_000 })
    const htmlRes = await exportWebpageDomViaHiddenIframe({ url, mode: 'html', scrollCrawl: false, expandFaq: true, timeoutMs: 25_000 })

    const title = String(htmlRes?.title || textRes?.title || '').trim()
    const text = String(textRes?.text || '').trim()
    const html = htmlRes && !htmlRes.clipped ? String(htmlRes.text || '').trim() : ''

    if (!html && !text) return { ok: false, error: 'No DOM content extracted' }

    if (!html && text) return { ok: true, markdown: plainTextToMarkdown(text, title || undefined), title }

    const { parseHtmlToMarkdownAllText } = await import('@/features/parsers/html-parser')
    const bounded = html.length > 8_000_000 ? html.slice(0, 8_000_000) : html
    const md = parseHtmlToMarkdownAllText(bounded, url)

    if (text.length > 1200) {
      const mdNorm = normalizeText(md)
      const lines = text
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length >= 30 && s.length <= 200)
      const samples: string[] = []
      const maxSamples = 24
      if (lines.length <= maxSamples) samples.push(...lines)
      else {
        for (let i = 0; i < maxSamples; i += 1) {
          const idx = Math.floor((i * (lines.length - 1)) / (maxSamples - 1))
          samples.push(lines[idx] || '')
        }
      }
      let misses = 0
      for (const s of samples) {
        const ns = normalizeText(s)
        if (!ns) continue
        if (!mdNorm.includes(ns)) misses += 1
        if (misses >= 6) break
      }
      if (md.length < text.length * 0.85 || misses >= 6) {
        return { ok: true, markdown: plainTextToMarkdown(text, title || undefined), title }
      }
    }

    return { ok: true, markdown: md, title }
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
    return { ok: false, error: msg || 'Browser conversion failed' }
  }
}

