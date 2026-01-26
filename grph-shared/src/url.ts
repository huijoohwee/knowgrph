export function coerceHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = unwrapUserProvidedText(value) || value.trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) return null
  try {
    const url = new URL(raw)
    if (!/^https?:$/i.test(url.protocol)) return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function coerceFetchUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = unwrapUserProvidedText(value) || value.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return coerceHttpUrl(raw)
  if (!raw.startsWith('/')) return null
  if (typeof window === 'undefined') return null
  const origin = window.location?.origin
  if (!origin) return null
  try {
    const url = new URL(raw, origin)
    if (!/^https?:$/i.test(url.protocol)) return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function unwrapUserProvidedText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let raw = value.trim()
  if (!raw) return null
  raw = raw.replace(/[.,;:]+$/g, '').trim()
  for (let i = 0; i < 5; i += 1) {
    const before = raw
    raw = raw.replace(/^["“‘'`]+/, '').replace(/["”’'`]+$/, '').trim()
    if (raw === before) break
  }
  for (let i = 0; i < 5; i += 1) {
    const before = raw
    if (raw.startsWith('(') && raw.endsWith(')')) raw = raw.slice(1, -1).trim()
    if (raw.startsWith('[') && raw.endsWith(']')) raw = raw.slice(1, -1).trim()
    if (raw.startsWith('{') && raw.endsWith('}')) raw = raw.slice(1, -1).trim()
    if (raw === before) break
  }
  raw = raw.replace(/^<|>$/g, '').trim()
  if (!raw) return null
  return raw
}

export function splitUserProvidedTextList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const raw = value.trim()
  if (!raw) return []
  const parts = raw
    .split(/\r?\n|[,;]+/g)
    .map(p => unwrapUserProvidedText(p) || '')
    .map(p => p.trim())
    .filter(Boolean)

  if (parts.length <= 1) return parts
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
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
      const rel = blobIndex >= 0 && parts.length > blobIndex + 2 ? parts.slice(blobIndex + 2).join('/') : ''
      if (owner && repo && branch && rel) {
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rel}`
      }
    }
  } catch {
    void 0
  }
  return null
}

export function coerceMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^data:image\//i.test(raw)) return raw
  if (/^blob:/i.test(raw)) return raw
  if (raw.startsWith('/')) return raw
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null
  return raw
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

export const REMOTE_FETCH_PROXY_ENDPOINT = '/__fetch_remote'
export const MEDIA_PROXY_ENDPOINT = REMOTE_FETCH_PROXY_ENDPOINT

export function shouldUseRemoteFetchProxy(): boolean {
  if (typeof window === 'undefined') return false
  const origin = window.location?.origin
  if (!origin) return false
  try {
    const host = new URL(origin).hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true
    return false
  } catch {
    return false
  }
}

export function applyMediaProxySrc(src: string): string {
  const raw = String(src || '').trim()
  if (!raw) return ''
  if (typeof window === 'undefined') return raw
  try {
    const base = window.location.origin
    const initial = new URL(raw, base)
    const normalized = normalizeGitHubBlobLikeUrl(initial.toString()) || initial.toString()
    const u = new URL(normalized, base)
    if (!/^https?:$/i.test(u.protocol)) return raw
    if (u.origin === window.location.origin) return raw
    if (!shouldUseRemoteFetchProxy()) return u.toString()
    return `${MEDIA_PROXY_ENDPOINT}?url=${encodeURIComponent(u.toString())}`
  } catch {
    return raw
  }
}
