export type HtmlMediaTag = 'iframe' | 'video' | 'img' | 'embed' | 'object'

export function looksLikeSingleTagBlock(html: string, tag: HtmlMediaTag): boolean {
  const raw = String(html || '').trim()
  if (!raw) return false
  if (tag === 'img' || tag === 'embed') return new RegExp(`^<${tag}\\b[^>]*\\/?>$`, 'i').test(raw)
  return new RegExp(`^<${tag}\\b[\\s\\S]*>(?:[\\s\\S]*<\\/${tag}>\\s*)?$`, 'i').test(raw)
}

export function extractHtmlAttr(html: string, attr: string): string {
  const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, 'i')
  const m = String(html || '').match(re)
  return String(m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim()
}

export function pickFirstSrcsetUrl(srcsetRaw: string): string {
  const raw = String(srcsetRaw || '').trim()
  if (!raw) return ''
  const firstChunk = raw.split(',')[0] || ''
  const urlPart = firstChunk.trim().split(/\s+/)[0] || ''
  return urlPart.trim()
}

export function normalizeHtmlHrefLikeValue(value: string): string {
  const raw = String(value || '')
  if (!raw) return ''
  const htmlDecoded = raw
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&#x26;/gi, '&')
    .trim()

  const unwrappedBackticks = (() => {
    const s = htmlDecoded.trim()
    if (s.startsWith('`') && s.endsWith('`') && s.length >= 2) return s.slice(1, -1).trim()
    return s
  })()

  const withoutBackticks = unwrappedBackticks.replace(/`+/g, '').trim()

  const collapsed = withoutBackticks.replace(/\s+/g, '')
  return collapsed
}

export function parseHtmlNumberAttr(raw: string): number | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function extractScriptEmbedAnchorHref(html: string): string {
  const raw = String(html || '').trim()
  if (!raw) return ''

  const isRedditEmbedBlockquote = /<\s*blockquote\b[^>]*\bclass\s*=\s*("[^"]*reddit-embed-bq[^"]*"|'[^']*reddit-embed-bq[^']*'|[^\s>]*reddit-embed-bq[^\s>]*)/i.test(
    raw,
  )

  const extractFirstAnchorHref = (opts?: { treatLeadingSlashAsReddit?: boolean }): string => {
    const m = raw.match(/<a\b[^>]*\bhref\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i)
    const href0 = String(m?.[2] ?? m?.[3] ?? m?.[4] ?? '').trim()
    const href = normalizeHtmlHrefLikeValue(href0)
    if (!href) return ''
    if (/^https?:\/\//i.test(href)) return href
    if (/^\/\//.test(href)) return `https:${href}`
    if (/^www\./i.test(href)) return `https://${href}`
    if (opts?.treatLeadingSlashAsReddit && href.startsWith('/')) return `https://www.reddit.com${href}`
    return ''
  }

  if (isRedditEmbedBlockquote) {
    const href = extractFirstAnchorHref({ treatLeadingSlashAsReddit: true })
    if (href) return href
  }

  if (!/<\s*script\b/i.test(raw)) return ''

  const extractFirstScriptSrc = (): string => {
    const m = raw.match(/<\s*script\b[^>]*\bsrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i)
    const src0 = String(m?.[2] ?? m?.[3] ?? m?.[4] ?? '').trim()
    return normalizeHtmlHrefLikeValue(src0)
  }

  const scriptSrc = extractFirstScriptSrc()
  if (!scriptSrc) return ''
  const isExternalScript = /^https?:\/\//i.test(scriptSrc) || /^\/\//.test(scriptSrc)
  if (!isExternalScript) return ''

  const href = extractFirstAnchorHref()
  if (href) return href

  const hasRedditWidgets = /(^|\/\/)(?:www\.)?embed\.reddit\.com\/widgets\.js(\?|#|$)/i.test(scriptSrc)
  if (hasRedditWidgets) {
    const m = raw.match(/https?:\/\/(?:www\.)?reddit\.com\/[^\s"'<>]+/i)
    const candidate = String(m?.[0] || '').trim()
    if (candidate) return candidate
  }

  return ''
}
