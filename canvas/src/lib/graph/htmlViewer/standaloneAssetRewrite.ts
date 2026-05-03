import { decodeCodebasePathFromUrl } from '@/lib/url'

const isHttpUrl = (v: string): boolean => /^https?:\/\//i.test(String(v || '').trim())

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
  try {
    if (typeof fetch !== 'function') return null
    const res = await fetch(url)
    if (!res || !res.ok) return null
    const ab = await res.arrayBuffer()
    return new Uint8Array(ab)
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
