import type { GraphNode } from '@/lib/graph/types'
import { IFRAME_ALLOWED_HOSTS } from '@/lib/config'
import { coerceMediaUrl, isLikelyImageUrl, isLikelySvgUrl, isLikelyVideoUrl } from '@/lib/url'

export type NodeMediaKind = 'image' | 'svg' | 'video' | 'iframe'

export type NodeMediaSpec = {
  kind: NodeMediaKind
  url: string
  interactive: boolean
}

function inferMediaKindFromUrl(url: string): NodeMediaKind {
  const raw = String(url || '').trim()
  if (isLikelyVideoUrl(raw)) return 'video'
  if (isLikelySvgUrl(raw)) return 'svg'
  if (isLikelyImageUrl(raw)) return 'image'
  return 'image'
}

function isSafeIframeUrl(value: string): boolean {
  const raw = String(value || '').trim()
  if (!raw) return false
  if (raw.startsWith('/__webpage_proxy?url=')) return true
  if (raw.startsWith('/__repo_file/')) return true
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()

    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be')) {
      return false
    }

    const allowed = String(IFRAME_ALLOWED_HOSTS || '')
      .split(/[,\s]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
    if (allowed.length === 0) return true
    return allowed.some(h => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

function normalizeIframeUrl(value: string): string {
  try {
    const u = new URL(value)
    const host = u.hostname.toLowerCase()

    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
      const m = u.pathname.match(/^\/(\d+)(\/|$)/)
      if (m && m[1]) {
        return `https://player.vimeo.com/video/${m[1]}`
      }
    }

    return value
  } catch {
    return value
  }
}

export function getNodeMediaSpec(node: GraphNode): NodeMediaSpec | null {
  const props = node.properties || {}
  const kindRaw = typeof props.media_kind === 'string' ? props.media_kind.trim().toLowerCase() : ''
  const kindForced: NodeMediaKind | null =
    kindRaw === 'iframe' || kindRaw === 'video' || kindRaw === 'image' || kindRaw === 'svg' ? (kindRaw as NodeMediaKind) : null

  const iframeUrl = coerceMediaUrl((props as Record<string, unknown>).iframe_url)
  const mediaUrl = coerceMediaUrl((props as Record<string, unknown>).media_url)
  const imageUrl = coerceMediaUrl((props as Record<string, unknown>).image)
  const videoUrl = coerceMediaUrl((props as Record<string, unknown>).video)
  const generic = coerceMediaUrl((props as Record<string, unknown>).media)

  const url = iframeUrl || mediaUrl || imageUrl || videoUrl || generic

  const domTag = (() => {
    const t = (props as Record<string, unknown>)['dom:tag']
    return typeof t === 'string' ? t.trim().toUpperCase() : ''
  })()
  const domSrc = (() => {
    const s = (props as Record<string, unknown>)['dom:attrs:src']
    const raw = typeof s === 'string' ? s.trim() : ''
    if (!raw) return ''
    if (raw.startsWith('//')) return `https:${raw}`
    return raw
  })()
  const domMediaUrl = (() => {
    if (!domTag) return ''
    if (domTag === 'IMG' || domTag === 'VIDEO' || domTag === 'IFRAME' || domTag === 'SVG') return domSrc
    return ''
  })()

  const domKindForced: NodeMediaKind | null =
    domTag === 'IFRAME'
      ? 'iframe'
      : domTag === 'VIDEO'
        ? 'video'
        : domTag === 'SVG'
          ? 'svg'
          : domTag === 'IMG'
            ? 'image'
            : null

  const resolvedUrl = url || (domMediaUrl ? coerceMediaUrl(domMediaUrl) : null)
  if (!resolvedUrl) return null

  const kind: NodeMediaKind = kindForced
    ? kindForced
    : iframeUrl
      ? 'iframe'
      : videoUrl
        ? 'video'
        : domKindForced
          ? domKindForced
          : inferMediaKindFromUrl(resolvedUrl)

  const rawInteractive = (props as Record<string, unknown>).media_interactive
  const explicitInteractive = rawInteractive === true ? true : rawInteractive === false ? false : null
  const interactive = explicitInteractive != null ? explicitInteractive : kind === 'video' || kind === 'iframe'

  if (kind === 'iframe') {
    const normalized = normalizeIframeUrl(resolvedUrl)
    if (!isSafeIframeUrl(normalized)) return null
    return { kind, url: normalized, interactive }
  }

  return { kind, url: resolvedUrl, interactive }
}

export function hasNodeMedia(node: GraphNode): boolean {
  return getNodeMediaSpec(node) != null
}

