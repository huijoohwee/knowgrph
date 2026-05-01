import { isLikelyAudioUrl, isLikelyImageUrl, isLikelySvgUrl, isLikelyVideoUrl } from '../url.js'

export type MediaKind = 'image' | 'svg' | 'video' | 'audio' | 'iframe'

function unwrapProxyMediaUrl(rawUrl: string): string {
  const raw = String(rawUrl || '').trim()
  if (!raw || /^(data:|blob:)/i.test(raw)) return raw
  const readUrlParam = (value: string): string => {
    const match = value.match(/[?&]url=([^&#]+)/i)
    if (!match) return ''
    try {
      return decodeURIComponent(match[1] || '')
    } catch {
      return match[1] || ''
    }
  }
  const decoded = readUrlParam(raw)
  return decoded.trim() || raw
}

export function inferMediaKindFromUrl(rawUrl: string): Exclude<MediaKind, 'iframe'> | '' {
  const u = unwrapProxyMediaUrl(rawUrl)
  if (!u) return ''
  if (/^data:image\/svg\+xml/i.test(u)) return 'svg'
  if (/^data:image\//i.test(u)) return 'image'
  if (isLikelyVideoUrl(u)) return 'video'
  if (isLikelyAudioUrl(u)) return 'audio'
  if (isLikelySvgUrl(u)) return 'svg'
  if (isLikelyImageUrl(u)) return 'image'
  return ''
}
