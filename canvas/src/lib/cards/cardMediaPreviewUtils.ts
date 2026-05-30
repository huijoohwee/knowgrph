import { resolveIframeEmbed } from 'grph-shared/rich-media/iframe'

export type CardMediaKind = 'image' | 'svg' | 'video' | 'iframe'
export type CardMediaPlaceholderVariant = 'text' | 'image' | 'video' | 'undefined'
export type CardMediaSkeletonVariant = CardMediaPlaceholderVariant | 'iframe'

export const CARD_MEDIA_IFRAME_ALLOW =
  'fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'

export const normalizeCardMediaUrl = (value: unknown): string => String(value || '').trim()

export function isDirectPlayableCardMedia(args: { kind: unknown; url: unknown }): boolean {
  const kind = String(args.kind || '').trim()
  if (kind === 'video') return !!normalizeCardMediaUrl(args.url)
  if (kind !== 'iframe') return false
  const url = normalizeCardMediaUrl(args.url)
  if (!url) return false
  return resolveIframeEmbed({ url }).direct === true
}
