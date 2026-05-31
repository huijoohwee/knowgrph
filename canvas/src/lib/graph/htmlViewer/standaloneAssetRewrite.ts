import { decodeCodebasePathFromUrl } from '@/lib/url'

const isHttpUrl = (v: string): boolean => /^https?:\/\//i.test(String(v || '').trim())
const isDataUrl = (v: string): boolean => /^data:/i.test(String(v || '').trim())

const normalizeMime = (raw: string): string => {
  const value = String(raw || '').trim().split(';')[0]?.trim().toLowerCase() || ''
  if (!value || !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(value)) return ''
  return value
}

const inferMimeFromUrl = (rawUrl: string): string => {
  const raw = String(rawUrl || '').trim()
  if (!raw) return 'application/octet-stream'
  try {
    const url = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, 'http://x.local')
    return inferMimeFromPath(url.pathname || raw)
  } catch {
    return inferMimeFromPath(raw)
  }
}

const readWindowHttpOrigin = (): string => {
  try {
    if (typeof window === 'undefined' || !window.location) return ''
    const origin = String(window.location.origin || '').replace(/\/+$/, '')
    return /^https?:\/\//i.test(origin) ? origin : ''
  } catch {
    return ''
  }
}

export const unwrapStandaloneProxyUrl = (rawUrl: string): string => {
  const raw = String(rawUrl || '').trim()
  if (!raw) return ''
  if (/^(data:|blob:|mailto:|tel:|javascript:)/i.test(raw)) return raw

  const decodeQ = (v: string): string => {
    try {
      return decodeURIComponent(v)
    } catch {
      return v
    }
  }

  const tryParse = (u: string): URL | null => {
    try {
      if (/^https?:\/\//i.test(u)) return new URL(u)
      if (typeof window === 'undefined') return null
      const base = window.location?.origin
      if (!base || !/^https?:\/\//i.test(String(base))) return null
      return new URL(u, base)
    } catch {
      return null
    }
  }

  const url = tryParse(raw)
  if (!url) return raw

  const p = url.pathname || ''
  if (p === '/__fetch_remote' || p === '/__webpage_proxy' || p === '/__webpage_asset_proxy') {
    const q = url.searchParams.get('url')
    if (!q) return raw
    const decoded = decodeQ(q)
    return isHttpUrl(decoded) ? decoded : decoded || raw
  }

  if (p.startsWith('/__')) {
    const q = url.searchParams.get('url')
    if (q) {
      const decoded = decodeQ(q)
      if (isHttpUrl(decoded)) return decoded
    }
  }

  if (p.startsWith('/__webpage_asset_path/')) {
    const suffix = p.slice('/__webpage_asset_path/'.length)
    const parts = suffix.split('/').filter(Boolean)
    if (parts.length >= 1) {
      const originEnc = parts[0] || ''
      const origin = decodeQ(originEnc)
      if (isHttpUrl(origin)) {
        const restPath = '/' + parts.slice(1).join('/')
        const q = url.search || ''
        return origin.replace(/\/+$/, '') + restPath + q
      }
    }
  }

  return raw
}

export const decodeRepoFileUrlToRelPath = (url: string): string | null => {
  return decodeCodebasePathFromUrl(url)
}

export const inferMimeFromPath = (relPath: string): string => {
  const p = String(relPath || '').trim()
  const i = p.lastIndexOf('.')
  const ext = i >= 0 ? p.slice(i + 1).toLowerCase() : ''
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'mp4') return 'video/mp4'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'json') return 'application/json'
  if (ext === 'html' || ext === 'htm') return 'text/html'
  return 'application/octet-stream'
}

export const toBase64 = (bytes: Uint8Array): string => {
  const buf = (globalThis as unknown as { Buffer?: { from: (b: Uint8Array) => { toString: (enc: string) => string } } }).Buffer
  if (buf) return buf.from(bytes).toString('base64')
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(bytes.length, i + chunk))
    binary += String.fromCharCode(...sub)
  }
  const btoaFn = (globalThis as unknown as { btoa?: (s: string) => string }).btoa
  if (!btoaFn) return ''
  return btoaFn(binary)
}

export const fetchBytes = async (url: string): Promise<Uint8Array | null> => {
  const fetched = await fetchBytesWithMime(url)
  return fetched?.bytes || null
}

export const fetchBytesWithMime = async (
  url: string,
  args?: { maxBytes?: number },
): Promise<{ bytes: Uint8Array; mime: string } | null> => {
  try {
    if (typeof fetch !== 'function') return null
    const res = await fetch(url)
    if (!res || !res.ok) return null
    const maxBytes = typeof args?.maxBytes === 'number' && Number.isFinite(args.maxBytes) ? Math.max(0, Math.floor(args.maxBytes)) : 0
    if (maxBytes > 0) {
      const contentLength = Number(res.headers?.get?.('content-length') || 0)
      if (Number.isFinite(contentLength) && contentLength > maxBytes) return null
    }
    const ab = await res.arrayBuffer()
    if (maxBytes > 0 && ab.byteLength > maxBytes) return null
    return {
      bytes: new Uint8Array(ab),
      mime: normalizeMime(String(res.headers?.get?.('content-type') || '')),
    }
  } catch {
    return null
  }
}

export const inlineRepoFileUrlToDataUrl = async (rawUrl: string, args?: { maxBytes?: number; origin?: string }): Promise<string | null> => {
  const url = String(rawUrl || '').trim()
  const relPath = decodeRepoFileUrlToRelPath(url)
  if (!relPath) return null
  const maxBytes = typeof args?.maxBytes === 'number' && Number.isFinite(args.maxBytes) ? Math.max(0, Math.floor(args.maxBytes)) : 900_000

  const absUrl = (() => {
    const origin = String(args?.origin || '').trim()
    if (origin && /^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, '') + url
    try {
      if (typeof window !== 'undefined' && window.location && /^https?:$/.test(String(window.location.protocol || ''))) {
        return String(window.location.origin || '').replace(/\/+$/, '') + url
      }
    } catch {
      void 0
    }
    return url
  })()

  const bytes = await fetchBytes(absUrl)
  if (!bytes || bytes.length === 0 || bytes.length > maxBytes) return null
  const mime = inferMimeFromPath(relPath)
  const b64 = toBase64(bytes)
  if (!b64) return null
  return `data:${mime};base64,${b64}`
}

const buildRemoteFetchCandidates = (rawUrl: string, unwrappedUrl: string): string[] => {
  const raw = String(rawUrl || '').trim()
  const unwrapped = String(unwrappedUrl || '').trim()
  const out: string[] = []
  const push = (v: string) => {
    const s = String(v || '').trim()
    if (!s || out.includes(s)) return
    out.push(s)
  }

  if (raw.startsWith('/__fetch_remote?url=')) push(raw)
  if (raw.startsWith('/__')) {
    const origin = readWindowHttpOrigin()
    if (origin) push(`${origin}${raw.startsWith('/') ? '' : '/'}${raw}`)
    push(raw)
  }
  if (/^https?:\/\/[^/]+\/__fetch_remote\?url=/i.test(raw)) push(raw)
  if (/^https?:\/\/[^/]+\/__/i.test(raw)) push(raw)

  if (isHttpUrl(unwrapped)) {
    const origin = readWindowHttpOrigin()
    if (origin) push(`${origin}/__fetch_remote?url=${encodeURIComponent(unwrapped)}`)
    push(unwrapped)
  }

  return out
}

export const inlineStandaloneAssetUrlToDataUrl = async (
  rawUrl: string,
  args?: { maxBytes?: number; allowRemote?: boolean; origin?: string },
): Promise<string | null> => {
  const raw = String(rawUrl || '').trim()
  if (!raw) return null
  if (isDataUrl(raw)) return raw

  const maxBytes = typeof args?.maxBytes === 'number' && Number.isFinite(args.maxBytes) ? Math.max(0, Math.floor(args.maxBytes)) : 900_000
  const unwrapped = unwrapStandaloneProxyUrl(raw)
  const repoInlined = await inlineRepoFileUrlToDataUrl(unwrapped, { maxBytes, origin: args?.origin })
  if (repoInlined) return repoInlined

  if (args?.allowRemote !== true || !isHttpUrl(unwrapped)) return null

  const candidates = buildRemoteFetchCandidates(raw, unwrapped)
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]!
    const fetched = await fetchBytesWithMime(candidate, { maxBytes })
    if (!fetched || fetched.bytes.length === 0) continue
    const mime = normalizeMime(fetched.mime) || inferMimeFromUrl(unwrapped)
    const b64 = toBase64(fetched.bytes)
    if (!b64) continue
    return `data:${mime};base64,${b64}`
  }

  return null
}
