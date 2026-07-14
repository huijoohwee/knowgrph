import { Play } from 'lucide-react'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { MediaDownloadOverlay, MediaKindOverlay } from '@/lib/ui/MediaKindOverlay'
import type { StoryboardMediaAlbumItem } from '@/components/StoryboardCanvas/storyboardCardMediaAlbum'

const CARD_MEDIA_ALBUM_VISIBLE_LIMIT = 6

export function CardMediaAlbum({
  items,
  title,
}: {
  items: readonly StoryboardMediaAlbumItem[]
  title: string
}) {
  const visibleItems = items.slice(0, CARD_MEDIA_ALBUM_VISIBLE_LIMIT)
  const overflowCount = Math.max(0, items.length - visibleItems.length)
  return (
    <section
      className="kg-card-media-album-frame"
      role="group"
      aria-label={`${title || 'Card'} media album`}
      data-kg-card-media-album="1"
      data-kg-card-media-album-count={items.length}
    >
      <section className="kg-card-media-album" data-kg-card-media-album-visible-count={visibleItems.length}>
        {visibleItems.map((item, index) => {
          const itemTitle = `${title || 'Card'} media ${index + 1} of ${items.length}`
          const showOverflow = overflowCount > 0 && index === visibleItems.length - 1
          return (
            <section
              key={`${item.kind}:${item.url}`}
              className="kg-card-media-album-tile group"
              aria-label={itemTitle}
              data-kg-card-media-album-item="1"
              data-kg-card-media-album-kind={item.kind}
            >
              <CardMediaPreview
                title={itemTitle}
                kind={item.kind}
                url={item.url}
                href={item.sourceUrl || item.url}
                interactive={false}
                fit="cover"
                videoPoster={item.thumbnailUrl || undefined}
                videoMuted
                className="h-full w-full"
                mediaClassName="h-full w-full"
                mediaThumbnailDataAttr
                mediaSelectableSurfaceDataAttr
              />
              {item.kind === 'video' ? <MediaKindOverlay Icon={Play} label="Video" appearance="always" /> : null}
              <MediaDownloadOverlay href={item.url} kind={item.kind === 'svg' ? 'image' : item.kind} appearance="hover" label={`Download media ${index + 1}`} />
              {showOverflow ? <span className="kg-card-media-album-overflow">+{overflowCount}</span> : null}
            </section>
          )
        })}
      </section>
    </section>
  )
}
