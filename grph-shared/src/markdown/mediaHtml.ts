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
  if (!/<\s*script\b/i.test(raw)) return ''
  if (!/(?:\bsrc\s*=\s*["'])(?:https?:)?\/\//i.test(raw)) return ''
  const anchorMatch = raw.match(/<a\b[^>]*\bhref\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i)
  const href = String(anchorMatch?.[2] ?? anchorMatch?.[3] ?? anchorMatch?.[4] ?? '').trim()
  if (!href) return ''
  if (/^https?:\/\//i.test(href)) return href
  if (/^\/\//.test(href)) return `https:${href}`
  return ''
}
