export function coerceHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) return null
  return raw
}

export function unwrapUserProvidedText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let raw = value.trim()
  if (!raw) return null
  raw = raw.replace(/[.,;:]+$/g, '').trim()
  for (let i = 0; i < 5; i += 1) {
    const first = raw[0]
    const last = raw[raw.length - 1]
    const isQuotePair = first === last && (first === '"' || first === "'" || first === '`')
    const isAnglePair = first === '<' && last === '>'
    const isParenPair = first === '(' && last === ')'
    const isBracketPair = first === '[' && last === ']'
    if (!isQuotePair && !isAnglePair && !isParenPair && !isBracketPair) break
    raw = raw.slice(1, -1).trim()
    raw = raw.replace(/[.,;:]+$/g, '').trim()
    if (!raw) return null
  }
  return raw
}

export function coerceMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^data:image\//i.test(raw)) return raw
  if (/^blob:/i.test(raw)) return raw
  if (raw.startsWith('/')) return raw
  return null
}

export function normalizeGitHubBlobLikeUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    const host = u.hostname.toLowerCase()
    const path = u.pathname || ''
    if ((host === 'github.com' || host.endsWith('.github.com')) && path.includes('/blob/')) {
      const parts = path.split('/')
      const owner = parts[1] || ''
      const repo = parts[2] || ''
      const blobIndex = parts.indexOf('blob')
      const branch = blobIndex >= 0 && parts.length > blobIndex + 1 ? parts[blobIndex + 1] : ''
      const rel =
        blobIndex >= 0 && parts.length > blobIndex + 2 ? parts.slice(blobIndex + 2).join('/') : ''
      if (owner && repo && branch && rel) {
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rel}`
      }
    }
  } catch {
    void 0
  }
  return null
}

export function deriveFilenameFromUrl(rawUrl: string, fallback: string): string {
  const fb = String(fallback || '').trim() || 'remote.txt'
  const raw = String(rawUrl || '').trim()
  if (!raw) return fb
  try {
    const url = new URL(raw)
    const parts = String(url.pathname || '')
      .split('/')
      .map(p => p.trim())
      .filter(Boolean)
    const last = parts.length > 0 ? parts[parts.length - 1] : ''
    if (last) return last
    const host = String(url.hostname || '').trim()
    if (host) return host
    return fb
  } catch {
    return fb
  }
}

export const MEDIA_PROXY_ENDPOINT = '/__fetch_remote'

export function applyMediaProxySrc(src: string): string {
  const raw = String(src || '').trim()
  if (!raw) return ''
  if (typeof window === 'undefined') return raw
  try {
    const u = new URL(raw, window.location.origin)
    if (!/^https?:$/i.test(u.protocol)) return raw
    if (u.origin === window.location.origin) return raw
    return `${MEDIA_PROXY_ENDPOINT}?url=${encodeURIComponent(u.toString())}`
  } catch {
    return raw
  }
}
