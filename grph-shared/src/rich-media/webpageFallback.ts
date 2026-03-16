export type WebpageFallbackInfo = {
  href: string
  hostLabel: string
  titleLabel: string
}

export function getWebpageFallbackInfo(url: string, title?: string): WebpageFallbackInfo {
  const href = String(url || '').trim()
  const t = String(title || '').trim()
  if (!href) return { href: '', hostLabel: '', titleLabel: t || '' }
  try {
    const u = new URL(href)
    const host = String(u.hostname || '').trim()
    const hostLabel = host || href
    const titleLabel = t || hostLabel
    return { href: u.toString(), hostLabel, titleLabel }
  } catch {
    const titleLabel = t || href
    return { href, hostLabel: href, titleLabel }
  }
}
