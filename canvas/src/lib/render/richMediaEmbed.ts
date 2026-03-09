import { inferIframeScriptPolicyFromHtml, isDirectIframeEmbedUrl, isHttpUrl } from '@/lib/url'
import { buildWebpageHtmlSrcdocAsync, fetchWebpageHtmlViaProxy } from '@/lib/websites/webpageIframeSrcdoc'

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
  const html = await fetchWebpageHtmlViaProxy({ url: raw, signal: args.signal })
  if (args.signal.aborted) return { srcDoc: '', scriptPolicy: 'strip' }
  const scriptPolicy = inferIframeScriptPolicyFromHtml(html)
  const srcDoc = await buildWebpageHtmlSrcdocAsync({ html, baseHref: raw, scriptPolicy })
  return { srcDoc, scriptPolicy }
}

export function isIframeDirectEmbedUrl(url: string): boolean {
  return isDirectIframeEmbedUrl(url)
}
