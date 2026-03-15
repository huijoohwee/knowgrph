import { isLikelyImageUrl } from '@/lib/url'

export type UrlMediaKind = 'image' | 'svg' | 'video' | 'iframe'

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i
const SVG_EXT_RE = /\.svg(\?|#|$)/i
const IFRAME_EXT_RE = /\.(html?|pdf)(\?|#|$)/i

export function inferMediaKindFromResourceUrl(rawUrl: string): UrlMediaKind | null {
  const url = String(rawUrl || '').trim()
  if (!url) return null
  if (isLikelyImageUrl(url)) return SVG_EXT_RE.test(url) ? 'svg' : 'image'
  if (VIDEO_EXT_RE.test(url)) return 'video'
  if (IFRAME_EXT_RE.test(url)) return 'iframe'
  return null
}

export function prefersIframeFromLinkContext(args: { label?: string; url?: string; preferMedia?: boolean }): boolean {
  if (args.preferMedia === true) return true
  const label = String(args.label || '').trim().toLowerCase()
  if (label.startsWith('iframe') || label.startsWith('embed') || label.startsWith('webpage')) return true
  const url = String(args.url || '').trim()
  if (!url) return false
  if (/^\/__repo_file\/.+\.(html?|pdf)(\?|#|$)/i.test(url)) return true
  return false
}
