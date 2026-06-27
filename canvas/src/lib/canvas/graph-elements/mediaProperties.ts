import { coerceMediaUrl } from '@/lib/url'

export const NODE_MEDIA_KINDS = ['image', 'svg', 'video', 'audio', 'iframe'] as const
export type NodeMediaKind = typeof NODE_MEDIA_KINDS[number]
export const DEFAULT_NODE_MEDIA_KIND: NodeMediaKind = NODE_MEDIA_KINDS[0]
const NODE_MEDIA_COMPATIBILITY_URL_KEYS = [
  'media',
  'mediaKind',
  'mediaUrl',
  'image',
  'imageUrl',
  'video',
  'videoUrl',
  'audio',
  'audioUrl',
  'audio_url',
  'iframe_url',
] as const

export function patchNodeMediaProperties(args: {
  properties?: Record<string, unknown> | null | undefined
  kind?: unknown
  url?: unknown
  interactive?: unknown
}): Record<string, unknown> {
  const next = { ...(args.properties || {}) }
  const normalizedUrl = coerceMediaUrl(args.url)
  if (!normalizedUrl) {
    delete next.media_url
    delete next.media_kind
    delete next.media_interactive
    return next
  }
  const kindRaw = String(args.kind || '').trim().toLowerCase()
  const normalizedKind = NODE_MEDIA_KINDS.includes(kindRaw as NodeMediaKind)
    ? (kindRaw as NodeMediaKind)
    : DEFAULT_NODE_MEDIA_KIND
  next.media_url = normalizedUrl
  next.media_kind = normalizedKind
  if (args.interactive === true) next.media_interactive = true
  else delete next.media_interactive
  return next
}

export function buildNodeMediaProperties(args: {
  kind: NodeMediaKind
  url: string
  interactive?: boolean
  extra?: Record<string, unknown>
  includeCamelGeneric?: boolean
}): Record<string, unknown> {
  const url = coerceMediaUrl(args.url)
  const base = { ...(args.extra || {}) }
  NODE_MEDIA_COMPATIBILITY_URL_KEYS.forEach(key => {
    delete base[key]
  })
  if (!url) {
    return patchNodeMediaProperties({
      properties: base,
      kind: args.kind,
      url,
      interactive: args.interactive === true,
    })
  }
  const next = patchNodeMediaProperties({
    properties: base,
    kind: args.kind,
    url,
    interactive: args.interactive === true,
  })
  const normalizedKind = String(next.media_kind || DEFAULT_NODE_MEDIA_KIND) as NodeMediaKind
  if (args.includeCamelGeneric === true) {
    next.mediaKind = normalizedKind
    next.mediaUrl = url
  }
  next.media = url
  if (normalizedKind === 'video') next.video = url
  else if (normalizedKind === 'audio') next.audio = url
  else if (normalizedKind === 'iframe') next.iframe_url = url
  else next.image = url
  return next
}
