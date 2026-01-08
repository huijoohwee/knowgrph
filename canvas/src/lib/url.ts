export function coerceHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) return null
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
