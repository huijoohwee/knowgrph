import type { GraphNode } from '@/lib/graph/types'
import { IFRAME_ALLOWED_HOSTS } from '@/lib/config'
import { coerceMediaUrl } from '@/lib/url'
import { inferMediaKindFromResourceUrl, prefersIframeFromLinkContext } from '@/lib/graph/mediaUrlKind'
import { inferMediaKindFromUrl } from 'grph-shared/rich-media/mediaKind'
import { isSafeIframeUrl, normalizeIframeUrl } from 'grph-shared/rich-media/iframe'

export type NodeMediaKind = 'image' | 'svg' | 'video' | 'iframe'

export type NodeMediaSpec = {
  kind: NodeMediaKind
  url: string
  interactive: boolean
}

const mediaSpecCache = new WeakMap<GraphNode, { cacheKey: string; spec: NodeMediaSpec | null }>()

function getCacheKey(node: GraphNode, props: Record<string, unknown>): string {
  return [
    node.id,
    node.type,
    node.label,
    props.media_kind,
    props.media_url,
    props.iframe_url,
    props.image,
    props.video,
    props.media,
    props.url,
    props.label,
    props['dom:tag'],
    props['dom:attrs:src'],
    props.media_interactive,
  ]
    .map(v => String(v ?? ''))
    .join('\n')
}

function computeNodeMediaSpec(node: GraphNode): NodeMediaSpec | null {
  const props = node.properties || {}
  const kindRaw = typeof props.media_kind === 'string' ? props.media_kind.trim().toLowerCase() : ''
  const kindForced: NodeMediaKind | null =
    kindRaw === 'iframe' || kindRaw === 'video' || kindRaw === 'image' || kindRaw === 'svg' ? (kindRaw as NodeMediaKind) : null

  const iframeUrl = coerceMediaUrl((props as Record<string, unknown>).iframe_url)
  const mediaUrl = coerceMediaUrl((props as Record<string, unknown>).media_url)
  const imageUrl = coerceMediaUrl((props as Record<string, unknown>).image)
  const videoUrl = coerceMediaUrl((props as Record<string, unknown>).video)
  const generic = coerceMediaUrl((props as Record<string, unknown>).media)
  const linkUrl = coerceMediaUrl((props as Record<string, unknown>).url)
  const linkLabel = String((props as Record<string, unknown>).label || node.label || '').trim()

  const inferredLinkKind = inferMediaKindFromResourceUrl(linkUrl || '')
  const inferLinkAsIframe = inferredLinkKind == null && prefersIframeFromLinkContext({ label: linkLabel, url: linkUrl || undefined })
  const url = iframeUrl || mediaUrl || imageUrl || videoUrl || generic || (inferredLinkKind || inferLinkAsIframe ? linkUrl : null)

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
          : inferredLinkKind
            ? inferredLinkKind
            : inferLinkAsIframe
              ? 'iframe'
              : ((inferMediaKindFromUrl(resolvedUrl) || 'image') as NodeMediaKind)

  const rawInteractive = (props as Record<string, unknown>).media_interactive
  const explicitInteractive = rawInteractive === true ? true : rawInteractive === false ? false : null
  const interactive = explicitInteractive != null ? explicitInteractive : kind === 'video' || kind === 'iframe'

  if (kind === 'iframe') {
    const normalized = normalizeIframeUrl(resolvedUrl)
    if (
      !isSafeIframeUrl(normalized, {
        allowedHostsCsv: IFRAME_ALLOWED_HOSTS,
        allowYouTube: false,
        allowInternalPaths: true,
      })
    )
      return null
    return { kind, url: normalized, interactive }
  }

  return { kind, url: resolvedUrl, interactive }
}

export function getNodeMediaSpec(node: GraphNode): NodeMediaSpec | null {
  const props = (node.properties || {}) as Record<string, unknown>
  const cacheKey = getCacheKey(node, props)
  const cached = mediaSpecCache.get(node)
  if (cached && cached.cacheKey === cacheKey) return cached.spec
  const spec = computeNodeMediaSpec(node)
  mediaSpecCache.set(node, { cacheKey, spec })
  return spec
}

export function hasNodeMedia(node: GraphNode): boolean {
  return getNodeMediaSpec(node) != null
}
