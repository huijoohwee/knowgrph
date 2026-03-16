export function looksLikeNetworkSecurityBlockText(rawText: string): boolean {
  const raw = String(rawText || '')
  if (!raw) return false
  const normalized = raw
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return false
  if (normalized.includes('blocked by network security')) return true
  if (normalized.includes("you've been blocked") && normalized.includes('security')) return true
  if (normalized.includes('you have been blocked') && normalized.includes('security')) return true
  if (normalized.includes('access denied') && (normalized.includes('blocked') || normalized.includes('security'))) return true
  if (normalized.includes('your request has been blocked')) return true
  if (normalized.includes('your request has been blocked due to a network policy')) return true
  if (normalized.includes('whoa there') && normalized.includes('pardner')) return true
  if (normalized.includes('attention required') && normalized.includes('cloudflare')) return true
  if (normalized.includes('unusual traffic') && (normalized.includes('verify') || normalized.includes('blocked'))) return true
  return false
}

export function getKnownHostIconUrlForWebpageUrl(url: string): string {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const host = String(u.hostname || '').toLowerCase()
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) {
      return 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-96x96.png'
    }
    return ''
  } catch {
    return ''
  }
}

export function getDefaultFaviconUrlForWebpageUrl(url: string): string {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    return `${u.origin}/favicon.ico`
  } catch {
    return ''
  }
}

