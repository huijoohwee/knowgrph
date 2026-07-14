import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { readCardInlineMediaTokens } from '@/lib/cards/cardInlineMediaTokens'
import { buildInlineMediaUrlIdentityKey } from '@/lib/command-menu/inlineMediaUrlIdentity'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'

type StoryboardInlineMediaConsumerText = Pick<
  StoryboardCardModel,
  'id' | 'summary' | 'output' | 'action' | 'dialogue' | 'prompt' | 'style' | 'slugline'
>

const CARD_INLINE_MEDIA_TEXT_KEYS = [
  'summary',
  'output',
  'action',
  'dialogue',
  'prompt',
  'style',
  'slugline',
] as const

const clean = (value: unknown): string => String(value || '').trim()

const readMediaSemanticKey = (media: Pick<MediaDragPayload, 'url' | 'sourceKey'>): string =>
  buildInlineMediaUrlIdentityKey(media.url) || clean(media.sourceKey)

export function readStoryboardInlineMediaConsumerIds(
  cards: readonly StoryboardInlineMediaConsumerText[],
  media: Pick<MediaDragPayload, 'url' | 'sourceKey'>,
): string[] {
  const mediaSemanticKey = readMediaSemanticKey(media)
  if (!mediaSemanticKey) return []
  const consumerIds: string[] = []
  const seen = new Set<string>()
  for (const card of cards) {
    const cardId = clean(card.id)
    if (!cardId || seen.has(cardId)) continue
    const matches = CARD_INLINE_MEDIA_TEXT_KEYS.some(key => (
      readCardInlineMediaTokens(card[key]).some(token => buildInlineMediaUrlIdentityKey(token.url) === mediaSemanticKey)
    ))
    if (!matches) continue
    seen.add(cardId)
    consumerIds.push(cardId)
  }
  return consumerIds
}
