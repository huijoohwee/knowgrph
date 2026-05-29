const localProxyPaths = new Set([
  '/__binary_download_proxy',
  '/__chat_asset_proxy',
  '/__fetch_remote',
  '/__media_proxy',
  '/__webpage_asset_path',
  '/__webpage_asset_proxy',
  '/__webpage_proxy',
])

const decodeHtmlUrlEntities = (value: string): string =>
  String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&#x26;/gi, '&')

export const normalizeMarkdownLocalProxyUrl = (href: string): string => {
  const raw = String(href || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw, 'https://knowgrph.local')
    if (!localProxyPaths.has(parsed.pathname)) return raw
    const proxied = parsed.searchParams.get('url')
    if (proxied) parsed.searchParams.set('url', decodeHtmlUrlEntities(proxied))
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return raw
  }
}
