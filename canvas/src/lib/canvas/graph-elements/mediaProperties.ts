import { coerceMediaUrl } from '@/lib/url'

export const NODE_MEDIA_KINDS = ['image', 'svg', 'video', 'audio', 'iframe'] as const
export type NodeMediaKind = typeof NODE_MEDIA_KINDS[number]
export const DEFAULT_NODE_MEDIA_KIND: NodeMediaKind = NODE_MEDIA_KINDS[0]

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

export function buildAliasedMediaProperties(args: {
  kind: NodeMediaKind
  url: string
  interactive?: boolean
  extra?: Record<string, unknown>
}): Record<string, unknown> {
  const url = String(args.url || '').trim()
  if (!url) return { ...(args.extra || {}) }
  const next = patchNodeMediaProperties({
    kind: args.kind,
    url,
    interactive: args.interactive === true,
  })
  next.media = url
  if (args.kind === 'video') next.video = url
  else if (args.kind === 'audio') next.audio = url
  else if (args.kind === 'iframe') next.iframe_url = url
  else next.image = url
  return {
    ...next,
    ...(args.extra || {}),
  }
}
