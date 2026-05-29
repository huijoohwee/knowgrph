import { resolveBinaryDownloadProxyUrl } from '@/lib/chatEndpoint'
import { normalizeMarkdownLocalProxyUrl } from './mediaProxyUrl'

export type MarkdownMediaDownloadKind = 'image' | 'video' | 'audio' | 'media'

const decodeSafe = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const extractSourceUrlFromProxy = (value: string): string => {
  const raw = normalizeMarkdownLocalProxyUrl(String(value || '').trim())
  if (!raw) return ''
  try {
    const u = new URL(raw, 'https://example.invalid')
    const proxied = u.searchParams.get('url') || ''
    if (proxied) return decodeSafe(proxied)
    if (u.pathname.startsWith('/__webpage_asset_path/')) {
      const rest = u.pathname.slice('/__webpage_asset_path/'.length)
      const slash = rest.indexOf('/')
      if (slash > 0) return `${decodeSafe(rest.slice(0, slash))}${rest.slice(slash)}${u.search || ''}`
    }
  } catch {
    void 0
  }
  return raw
}

export function buildMarkdownMediaDownloadHref(src: string): string {
  const raw = normalizeMarkdownLocalProxyUrl(String(src || '').trim())
  if (!raw) return ''
  if (/^(data:|blob:)/i.test(raw)) return raw
  if (raw.startsWith('/__chat_asset_proxy?')) return raw
  if (raw.startsWith('/__fetch_remote?')) return raw
  if (raw.startsWith('/__webpage_asset_proxy?')) return raw
  if (raw.startsWith('/__webpage_asset_path/')) return raw
  if (raw.startsWith('/__codebase_asset?')) return raw
  if (raw.startsWith('/@fs/')) return raw
  const normalized = raw.startsWith('//') ? `https:${raw}` : raw
  if (/^https?:\/\//i.test(normalized)) return resolveBinaryDownloadProxyUrl(normalized)
  if (normalized.startsWith('/')) return normalized
  return ''
}

export function deriveMarkdownMediaDownloadFilename(src: string, kind: MarkdownMediaDownloadKind): string {
  const source = extractSourceUrlFromProxy(src)
  const fallbackExt = kind === 'video' ? '.mp4' : kind === 'audio' ? '.mp3' : kind === 'image' ? '.png' : ''
  const fallback = `${kind || 'media'}${fallbackExt}`
  try {
    const u = new URL(source, 'https://example.invalid')
    const pathname = decodeSafe(u.pathname || '')
    const parts = pathname.split('/').filter(Boolean)
    const name = (parts[parts.length - 1] || '').split(/[?#]/)[0] || ''
    const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
    if (cleaned && /\.[A-Za-z0-9]{2,8}$/.test(cleaned)) return cleaned
    if (cleaned && fallbackExt) return `${cleaned}${fallbackExt}`
    return cleaned || fallback
  } catch {
    return fallback
  }
}
