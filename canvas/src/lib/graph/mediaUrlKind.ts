import { isLikelyImageUrl } from '@/lib/url'
import {
  buildBilibiliEmbedUrl,
  buildTwitterEmbedUrl,
  buildVimeoEmbedUrl,
  buildYouTubeEmbedUrl,
  buildYouTubeThumbnailUrl,
} from 'grph-shared/rich-media/providers'

export type UrlMediaKind = 'image' | 'svg' | 'video' | 'iframe'

export type RenderableMediaResource = {
  kind: UrlMediaKind
  url: string
  sourceUrl: string
  thumbnailUrl?: string | null
}

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i
const SVG_EXT_RE = /\.svg(\?|#|$)/i
const IFRAME_EXT_RE = /\.(html?|pdf)(\?|#|$)/i

function readCanonicalResourcePath(rawUrl: string): string {
  const url = String(rawUrl || '').trim()
  if (!url) return ''
  try {
    const parsed = new URL(url, 'https://example.invalid')
    if (parsed.pathname === '/__codebase_asset' || parsed.pathname === '/__codebase_file') {
      return String(parsed.searchParams.get('path') || '').trim()
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function inferMediaKindFromResourceUrl(rawUrl: string): UrlMediaKind | null {
  const url = readCanonicalResourcePath(rawUrl)
  if (!url) return null
  if (isLikelyImageUrl(url)) return SVG_EXT_RE.test(url) ? 'svg' : 'image'
  if (VIDEO_EXT_RE.test(url)) return 'video'
  if (IFRAME_EXT_RE.test(url)) return 'iframe'
  if (buildRenderableIframeUrl(url)) return 'iframe'
  return null
}

export function buildRenderableIframeUrl(rawUrl: string): string {
  const url = readCanonicalResourcePath(rawUrl)
  if (!url) return ''
  const resolved =
    buildYouTubeEmbedUrl(url, { includeOrigin: false })
    || buildVimeoEmbedUrl(url)
    || buildBilibiliEmbedUrl(url)
    || buildTwitterEmbedUrl(url)
    || ''
  return String(resolved || '').trim()
}

export function buildRenderableMediaThumbnailUrl(rawUrl: string): string {
  const url = readCanonicalResourcePath(rawUrl)
  if (!url) return ''
  return String(buildYouTubeThumbnailUrl(url) || '').trim()
}

export function resolveRenderableMediaResource(
  rawUrl: string,
  declaredKind?: UrlMediaKind | null,
): RenderableMediaResource | null {
  const sourceUrl = readCanonicalResourcePath(rawUrl)
  if (!sourceUrl) return null
  const thumbnailUrl = buildRenderableMediaThumbnailUrl(sourceUrl)
  const iframeUrl = buildRenderableIframeUrl(sourceUrl)
  if (iframeUrl) {
    return {
      kind: 'iframe',
      url: iframeUrl,
      sourceUrl,
      thumbnailUrl: thumbnailUrl || null,
    }
  }
  const inferredKind = inferMediaKindFromResourceUrl(sourceUrl) ?? declaredKind ?? null
  if (!inferredKind) return null
  return {
    kind: inferredKind,
    url: sourceUrl,
    sourceUrl,
    thumbnailUrl: thumbnailUrl || null,
  }
}

export function prefersIframeFromLinkContext(args: { label?: string; url?: string; preferMedia?: boolean }): boolean {
  if (args.preferMedia === true) return true
  const label = String(args.label || '').trim().toLowerCase()
  if (label.startsWith('iframe') || label.startsWith('embed') || label.startsWith('webpage')) return true
  const url = readCanonicalResourcePath(String(args.url || '').trim())
  if (!url) return false
  if (buildRenderableIframeUrl(url)) return true
  if (IFRAME_EXT_RE.test(url)) return true
  return false
}
