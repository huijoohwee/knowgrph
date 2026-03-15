import { isLikelyAudioUrl, isLikelyImageUrl, isLikelySvgUrl, isLikelyVideoUrl } from '../url.js'

export type MediaKind = 'image' | 'svg' | 'video' | 'audio' | 'iframe'

export function inferMediaKindFromUrl(rawUrl: string): Exclude<MediaKind, 'iframe'> | '' {
  const u = String(rawUrl || '').trim()
  if (!u) return ''
  if (/^data:image\/svg\+xml/i.test(u)) return 'svg'
  if (/^data:image\//i.test(u)) return 'image'
  if (isLikelyVideoUrl(u)) return 'video'
  if (isLikelyAudioUrl(u)) return 'audio'
  if (isLikelySvgUrl(u)) return 'svg'
  if (isLikelyImageUrl(u)) return 'image'
  return ''
}
