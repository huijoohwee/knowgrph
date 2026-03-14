import { applyMediaProxySrc, unwrapUserProvidedText } from 'grph-shared/url'

export * from 'grph-shared/url'

export function isHttpUrl(value: unknown): boolean {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return false
  return /^https?:\/\//i.test(raw)
}

export function encodeRepoPathForUrl(relPath: string): string {
  return String(relPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map(seg => encodeURIComponent(seg))
    .join('/')
}

export function buildRepoFilePath(relPath: string): string {
  const normalized = String(relPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized) return '/__repo_file'
  return `/__repo_file/${encodeRepoPathForUrl(normalized)}`
}

export function isYouTubeUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const raw = unwrapUserProvidedText(value) || value.trim()
  if (!raw) return false
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase()
    if (host === 'youtu.be' || host === 'www.youtu.be') return true
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) return true
    return false
  } catch {
    return false
  }
}

export function resolveUrlAgainstBase(baseUrl: string | null | undefined, rawUrl: string): string {
  const raw = String(rawUrl || '').trim()
  if (!raw) return ''
  if (/^(data:|blob:|mailto:|tel:|javascript:)/i.test(raw)) return raw
  const base = String(baseUrl || '').trim()
  if (!base) return raw
  try {
    return new URL(raw, base).toString()
  } catch {
    return raw
  }
}

export function isWeChatHotlinkProtectedAssetUrl(absUrl: string): boolean {
  const raw = String(absUrl || '').trim()
  if (!/^https?:\/\//i.test(raw)) return false
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host === 'mmbiz.qpic.cn' || host.endsWith('.qpic.cn')) return true
    if (host === 'mmbiz.qlogo.cn' || host.endsWith('.qlogo.cn')) return true
    if (host === 'wx.qlogo.cn' || host.endsWith('.wx.qlogo.cn')) return true
    return false
  } catch {
    return false
  }
}

export function buildWebpageAssetPathProxyUrl(absUrl: string): string {
  const raw = String(absUrl || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/__webpage_asset_path/')) return raw
  if (raw.startsWith('/__webpage_asset_proxy?url=')) return raw
  if (!/^https?:\/\//i.test(raw)) return raw
  try {
    const u = new URL(raw)
    const originEnc = encodeURIComponent(u.origin)
    const p = u.pathname || '/'
    const q = u.search || ''
    return `/__webpage_asset_path/${originEnc}${p}${q}`
  } catch {
    return raw
  }
}

export function applyImageLikeProxySrc(src: string): string {
  const raw = String(src || '').trim()
  if (!raw) return ''
  const normalized = raw.startsWith('//') ? `https:${raw}` : raw
  if (isWeChatHotlinkProtectedAssetUrl(normalized)) return buildWebpageAssetPathProxyUrl(normalized)
  return applyMediaProxySrc(normalized)
}
