import { inferIframeScriptPolicyFromHtml, isDirectIframeEmbedUrl, isHttpUrl } from '@/lib/url'
import { buildWebpageHtmlSrcdocAsync, fetchWebpageHtmlViaProxy } from '@/lib/websites/webpageIframeSrcdoc'

const IFRAME_SRCDOC_CACHE_MAX = 32
const IFRAME_SRCDOC_CACHE_TTL_MS = 10 * 60 * 1000

const IFRAME_SRCDOC_CACHE_VERSION = 2

type IframeSrcDocResult = { srcDoc: string; scriptPolicy: 'strip' | 'allow' }

const iframeSrcDocCache = new Map<string, { value: IframeSrcDocResult; updatedAtMs: number }>()
const iframeSrcDocInFlight = new Map<string, Promise<IframeSrcDocResult>>()

function readCachedIframeSrcDoc(url: string): IframeSrcDocResult | null {
  const entry = iframeSrcDocCache.get(url)
  if (!entry) return null
  const ageMs = Date.now() - entry.updatedAtMs
  if (!(ageMs >= 0 && ageMs <= IFRAME_SRCDOC_CACHE_TTL_MS)) {
    iframeSrcDocCache.delete(url)
    return null
  }
  iframeSrcDocCache.delete(url)
  iframeSrcDocCache.set(url, entry)
  return entry.value
}

function writeCachedIframeSrcDoc(url: string, value: IframeSrcDocResult): void {
  iframeSrcDocCache.delete(url)
  iframeSrcDocCache.set(url, { value, updatedAtMs: Date.now() })
  while (iframeSrcDocCache.size > IFRAME_SRCDOC_CACHE_MAX) {
    const oldest = iframeSrcDocCache.keys().next().value
    if (typeof oldest !== 'string') break
    iframeSrcDocCache.delete(oldest)
  }
}

export function buildWebpageProxyUrl(rawUrl: string): string {
  const u = String(rawUrl || '').trim()
  if (!u) return ''
  if (!isHttpUrl(u)) return u
  return `/__webpage_proxy?url=${encodeURIComponent(u)}`
}

export async function buildIframeSrcDocForUrl(args: {
  url: string
  signal: AbortSignal
}): Promise<{ srcDoc: string; scriptPolicy: 'strip' | 'allow' }> {
  const raw = String(args.url || '').trim()
  if (!raw) return { srcDoc: '', scriptPolicy: 'strip' }
  if (!isHttpUrl(raw)) return { srcDoc: '', scriptPolicy: 'strip' }
  if (args.signal.aborted) return { srcDoc: '', scriptPolicy: 'strip' }

  const cacheKey = `v${IFRAME_SRCDOC_CACHE_VERSION}:${raw}`
  const cached = readCachedIframeSrcDoc(cacheKey)
  if (cached) return cached

  const inFlight = iframeSrcDocInFlight.get(cacheKey)
  if (inFlight) {
    const result = await inFlight
    if (args.signal.aborted) return { srcDoc: '', scriptPolicy: 'strip' }
    return result
  }

  const promise: Promise<IframeSrcDocResult> = (async () => {
    const ctrl = new AbortController()
    const html = await fetchWebpageHtmlViaProxy({ url: raw, signal: ctrl.signal })
    const scriptPolicy = inferIframeScriptPolicyFromHtml(html)
    const built = await buildWebpageHtmlSrcdocAsync({ html, baseHref: raw, scriptPolicy })
    return { srcDoc: built.tooLargeForSrcdoc ? '' : built.html, scriptPolicy }
  })()

  iframeSrcDocInFlight.set(cacheKey, promise)
  try {
    const result = await promise
    if (result.srcDoc) writeCachedIframeSrcDoc(cacheKey, result)
    if (args.signal.aborted) return { srcDoc: '', scriptPolicy: 'strip' }
    return result
  } finally {
    if (iframeSrcDocInFlight.get(cacheKey) === promise) iframeSrcDocInFlight.delete(cacheKey)
  }
}

export function isIframeDirectEmbedUrl(url: string): boolean {
  return isDirectIframeEmbedUrl(url)
}
