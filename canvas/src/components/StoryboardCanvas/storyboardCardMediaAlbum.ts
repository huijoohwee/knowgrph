import { buildInlineMediaUrlIdentityKey } from '@/lib/command-menu/inlineMediaUrlIdentity'

export const STORYBOARD_CARD_MEDIA_ALBUM_PROPERTY = 'storyboardMediaItems' as const

export type StoryboardMediaAlbumKind = 'image' | 'svg' | 'video'

export type StoryboardMediaAlbumItem = {
  kind: StoryboardMediaAlbumKind
  url: string
  sourceUrl: string
  thumbnailUrl?: string | null
}

const clean = (value: unknown): string => String(value || '').trim()

const normalizeAlbumKind = (value: unknown): StoryboardMediaAlbumKind | null => {
  const kind = clean(value).toLowerCase()
  if (kind === 'image' || kind === 'svg' || kind === 'video') return kind
  return null
}

export const toStoryboardMediaAlbumItem = (value: unknown): StoryboardMediaAlbumItem | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const kind = normalizeAlbumKind(record.kind)
  const url = clean(record.url)
  if (!kind || !url) return null
  const sourceUrl = clean(record.sourceUrl) || url
  const thumbnailUrl = clean(record.thumbnailUrl)
  return {
    kind,
    url,
    sourceUrl,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
  }
}

const readAlbumIdentity = (item: StoryboardMediaAlbumItem): string =>
  buildInlineMediaUrlIdentityKey(item.url) || clean(item.sourceUrl).toLowerCase() || clean(item.url).toLowerCase()

export function readStoryboardMediaAlbumItems(value: unknown): StoryboardMediaAlbumItem[] {
  if (!Array.isArray(value)) return []
  return mergeStoryboardMediaAlbumItems(value.map(toStoryboardMediaAlbumItem).filter((item): item is StoryboardMediaAlbumItem => !!item))
}

export function projectStoryboardMediaAlbumItems(stored: unknown, primary: unknown): StoryboardMediaAlbumItem[] {
  return mergeStoryboardMediaAlbumItems(readStoryboardMediaAlbumItems(stored), [toStoryboardMediaAlbumItem(primary)])
}

export function mergeStoryboardMediaAlbumItems(
  ...groups: ReadonlyArray<ReadonlyArray<StoryboardMediaAlbumItem | null | undefined>>
): StoryboardMediaAlbumItem[] {
  const seen = new Set<string>()
  const items: StoryboardMediaAlbumItem[] = []
  for (const group of groups) {
    for (const candidate of group) {
      const item = toStoryboardMediaAlbumItem(candidate)
      if (!item) continue
      const identity = readAlbumIdentity(item)
      if (!identity || seen.has(identity)) continue
      seen.add(identity)
      items.push(item)
    }
  }
  return items
}

export function appendStoryboardMediaAlbumItem(args: {
  existing: unknown
  current?: StoryboardMediaAlbumItem | null
  dropped: StoryboardMediaAlbumItem
}): StoryboardMediaAlbumItem[] {
  const existing = readStoryboardMediaAlbumItems(args.existing)
  return mergeStoryboardMediaAlbumItems(
    existing.length > 0 ? existing : [args.current],
    [args.dropped],
  )
}
