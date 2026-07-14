import { X } from 'lucide-react'
import RichMediaPanel from '@/components/RichMediaPanel'
import PreviewOverlay from '@/features/panels/views/preview-panel/ui/PreviewOverlay'
import { readUploadedMediaPanelItemRuntimeUrl, type UploadedMediaPanelItem } from '@/lib/storage/uploadedMediaPanelItems'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  MEDIA_EXPANDED_PREVIEW_OVERLAY_CLASS_NAME,
  MEDIA_EXPANDED_PREVIEW_PANEL_CLASS_NAME,
  MEDIA_EXPANDED_PREVIEW_PLAYER_CLASS_NAME,
  MEDIA_EXPANDED_PREVIEW_PLAYER_FRAME_CLASS_NAME,
  MEDIA_EXPANDED_PREVIEW_MEDIA_CLASS_NAME,
  MEDIA_EXPANDED_PREVIEW_RICH_PANEL_CLASS_NAME,
} from '@/lib/ui/mediaExpandedPreviewLayout'
import { cn } from '@/lib/utils'

export function MediaCatalogRichMediaPreview(props: {
  item: UploadedMediaPanelItem
  onClose: () => void
}) {
  const { item, onClose } = props
  const runtimeUrl = readUploadedMediaPanelItemRuntimeUrl(item)
  return (
    <PreviewOverlay
      open
      onClose={onClose}
      overlayClassName={MEDIA_EXPANDED_PREVIEW_OVERLAY_CLASS_NAME}
      panelClassName={MEDIA_EXPANDED_PREVIEW_PANEL_CLASS_NAME}
    >
      <section
        className={MEDIA_EXPANDED_PREVIEW_PLAYER_CLASS_NAME}
        aria-label={`${item.name} media preview`}
        data-kg-media-catalog-preview="1"
        data-kg-media-catalog-preview-kind={item.kind}
        data-kg-media-catalog-preview-placement="legacy-lightbox"
      >
        <button
          type="button"
          className={cn('absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded border bg-black/50 text-white backdrop-blur-sm', UI_THEME_TOKENS.panel.border)}
          aria-label="Close media preview"
          data-kg-media-catalog-preview-close="1"
          onClick={event => {
            event.stopPropagation()
            onClose()
          }}
        >
          <X className="h-4 w-4" strokeWidth={1.7} aria-hidden />
        </button>
        <section className={MEDIA_EXPANDED_PREVIEW_PLAYER_FRAME_CLASS_NAME}>
          <section className={MEDIA_EXPANDED_PREVIEW_MEDIA_CLASS_NAME} data-kg-media-catalog-preview-panel="1">
            <section className={MEDIA_EXPANDED_PREVIEW_RICH_PANEL_CLASS_NAME}>
              <RichMediaPanel
                overlayId={`floating-media-preview:${item.id}`}
                title={item.name || 'Uploaded media'}
                url={runtimeUrl}
                openUrl={runtimeUrl}
                kind={item.kind}
                interactive={item.kind !== 'image'}
                videoControls={item.kind === 'video'}
                panelChrome="storyboardWidget"
                frameMode="surface"
                placementOwner="parent"
                style={{ height: '100%', width: '100%' }}
              />
            </section>
          </section>
        </section>
      </section>
    </PreviewOverlay>
  )
}
