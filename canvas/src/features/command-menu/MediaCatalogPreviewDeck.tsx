import RichMediaPanel from '@/components/RichMediaPanel'
import { readUploadedMediaPanelItemRuntimeUrl, type UploadedMediaPanelItem } from '@/lib/storage/uploadedMediaPanelItems'
import { MEDIA_EXPANDED_PREVIEW_RICH_PANEL_CLASS_NAME } from '@/lib/ui/mediaExpandedPreviewLayout'

export function MediaCatalogPreviewDeck(props: {
  activeItemId: string
  items: readonly UploadedMediaPanelItem[]
}) {
  return (
    <section className="relative h-full w-full" data-kg-media-catalog-preview-preloads="1">
      {props.items.map(item => {
        const active = item.id === props.activeItemId
        const runtimeUrl = readUploadedMediaPanelItemRuntimeUrl(item)
        return (
          <section
            key={item.id}
            aria-hidden={active ? undefined : true}
            className={`absolute inset-0 ${active ? 'visible z-10 pointer-events-auto' : 'invisible z-0 pointer-events-none'}`}
            data-kg-media-catalog-preview-deck-item={item.id}
            data-kg-media-catalog-preview-item-active={active ? '1' : undefined}
            data-kg-media-catalog-preview-preload={active ? undefined : '1'}
            data-kg-media-catalog-preview-preload-kind={active ? undefined : item.kind}
          >
            <section className={MEDIA_EXPANDED_PREVIEW_RICH_PANEL_CLASS_NAME}>
              <RichMediaPanel
                overlayId={`floating-media-preview:${item.id}`}
                title={item.name || 'Uploaded media'}
                url={runtimeUrl}
                openUrl={runtimeUrl}
                kind={item.kind}
                interactive={active && item.kind !== 'image'}
                videoControls={item.kind === 'video'}
                panelChrome="storyboardWidget"
                frameMode="surface"
                placementOwner="parent"
                style={{ height: '100%', width: '100%' }}
              />
            </section>
          </section>
        )
      })}
    </section>
  )
}
