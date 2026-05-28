import { looksLikeWebpageShellText } from '@/lib/websites/webpageShellHeuristics'

export type WebpageViewMode = 'markdown' | 'json' | 'html'
export type FetchMode = 'import' | 'refresh'

export function isWeChatArticleUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host === 'mp.weixin.qq.com' || host.endsWith('.mp.weixin.qq.com')) return true
  } catch {
    void 0
  }
  return false
}
export function shouldTreatAsSubstackUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const p = String(u.pathname || '')
    return /^\/p\/[^/]+\/?$/i.test(p)
  } catch {
    return false
  }
}
export const looksLikeJsShellText = looksLikeWebpageShellText

export function shouldSkipUnifiedMarkdownConversion(html: string): boolean {
  const h = String(html || '')
  if (!h) return false
  if (h.length > 1_500_000) return true
  const scriptCount = (h.match(/<script\b/gi) || []).length
  if (scriptCount > 18) return true
  return false
}

export function deriveFallbackExtFromNormalizedLower(normalizedLower: string): '.md' | '.json' | '.csv' | '.svg' | '.yaml' | '.html' | '.txt' {
  if (normalizedLower.endsWith('.md') || normalizedLower.endsWith('.markdown') || normalizedLower.endsWith('.mdx')) return '.md'
  if (normalizedLower.endsWith('.json') || normalizedLower.endsWith('.jsonld') || normalizedLower.endsWith('.geojson')) return '.json'
  if (normalizedLower.endsWith('.csv')) return '.csv'
  if (normalizedLower.endsWith('.svg')) return '.svg'
  if (normalizedLower.endsWith('.yaml') || normalizedLower.endsWith('.yml')) return '.yaml'
  if (normalizedLower.endsWith('.html') || normalizedLower.endsWith('.htm')) return '.html'
  return '.txt'
}

export function autoTuneFromHtml(args: {
  html: string
  includeImages: boolean
  fidelityLevel: 1 | 2 | 3 | 4
  defaultView: WebpageViewMode
  mode: FetchMode
  forceConvertToMarkdown: boolean
  isWeChat: boolean
}): {
  isSubstackLike: boolean
  includeImages: boolean
  fidelityLevel: 1 | 2 | 3 | 4
  defaultView: WebpageViewMode
  shouldConvertToMarkdown: boolean
  shouldFallbackToPlainText: boolean
} {
  const h = String(args.html || '')
  const isSubstackLike =
    /substackcdn\.com/i.test(h) ||
    /\bdata-page\s*=\s*["'][^"']+/i.test(h) ||
    /failed\s+to\s+load\s+posts/i.test(h) ||
    /enable-javascript\.com/i.test(h) ||
    /requires\s+java\s*script/i.test(h)

  const looksHuge = h.length > 5_000_000
  const includeImages = isSubstackLike ? true : looksHuge ? false : args.includeImages
  const fidelityLevel = (isSubstackLike ? 4 : looksHuge ? 2 : args.fidelityLevel) as 1 | 2 | 3 | 4
  const defaultView = (isSubstackLike ? 'markdown' : args.defaultView) as WebpageViewMode

  const shouldConvertToMarkdown =
    args.forceConvertToMarkdown ||
    args.mode !== 'refresh' ||
    isSubstackLike ||
    args.isWeChat ||
    (defaultView === 'markdown' && args.mode === 'refresh')

  const shouldFallbackToPlainText = shouldConvertToMarkdown && defaultView === 'markdown'
  return { isSubstackLike, includeImages, fidelityLevel, defaultView, shouldConvertToMarkdown, shouldFallbackToPlainText }
}
