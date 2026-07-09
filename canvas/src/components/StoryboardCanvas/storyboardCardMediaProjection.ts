import type { StoryboardCardMedia } from '@/components/StoryboardCanvas/storyboardModel'
import type { StoryboardDisplayMedia } from '@/components/StoryboardCanvas/storyboardMediaSelectionPanel'
import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'
import type { TextareaInvocationMediaAttachment } from '@/lib/ui/textareaInvocationProjection'

type StoryboardProjectedMedia = {
  kind: StoryboardCardMedia['kind'] | StoryboardDisplayMedia['kind']
  url: string
  sourceUrl?: string
  thumbnailUrl?: string | null
} | null | undefined
type StoryboardProjectedMediaKind = NonNullable<StoryboardProjectedMedia>['kind']

export const toStoryboardInlineMediaKind = (kind: StoryboardProjectedMediaKind | null | undefined): InlineMediaKind | null => {
  if (kind === 'image' || kind === 'svg') return 'image'
  if (kind === 'audio' || kind === 'video') return kind
  return null
}

export const readStoryboardMediaFileLabel = (url: string, fallback: string): string => {
  const raw = String(url || '').split(/[?#]/)[0]?.split('/').filter(Boolean).pop() || ''
  try {
    return decodeURIComponent(raw).trim() || fallback
  } catch {
    return raw || fallback
  }
}

export function buildStoryboardCardMediaTextareaAttachment(
  media: StoryboardProjectedMedia,
  fallbackLabel: string,
): TextareaInvocationMediaAttachment | null {
  const inlineMediaKind = toStoryboardInlineMediaKind(media?.kind)
  const mediaUrl = String(media?.url || media?.thumbnailUrl || '').trim()
  if (!inlineMediaKind || !mediaUrl) return null
  const sourceUrl = String(media?.sourceUrl || mediaUrl).trim()
  const label = readStoryboardMediaFileLabel(sourceUrl || mediaUrl, fallbackLabel || 'Media')
  return {
    mediaKind: inlineMediaKind,
    label,
    sourceUrl: sourceUrl || mediaUrl,
    thumbnailUrl: inlineMediaKind === 'image'
      ? mediaUrl
      : String(media?.thumbnailUrl || '').trim() || undefined,
  }
}
