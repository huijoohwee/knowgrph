import React from 'react'
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
  items: readonly UploadedMediaPanelItem[]
  onClose: () => void
  onNavigate: (item: UploadedMediaPanelItem) => void
}) {
  const { item, items, onClose, onNavigate } = props
  const runtimeUrl = readUploadedMediaPanelItemRuntimeUrl(item)
  const navigableItems = React.useMemo(
    () => items.filter(candidate => candidate.kind === 'image' || candidate.kind === 'video'),
    [items],
  )
  const activeIndex = navigableItems.findIndex(candidate => candidate.id === item.id)
  const canNavigate = activeIndex >= 0 && navigableItems.length > 1

  React.useEffect(() => {
    if (!canNavigate) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : 0
      if (!direction) return
      const nextIndex = (activeIndex + direction + navigableItems.length) % navigableItems.length
      const nextItem = navigableItems[nextIndex]
      if (!nextItem) return
      event.preventDefault()
      event.stopPropagation()
      onNavigate(nextItem)
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [activeIndex, canNavigate, navigableItems, onNavigate])

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
        data-kg-media-catalog-preview-index={activeIndex >= 0 ? activeIndex + 1 : undefined}
        data-kg-media-catalog-preview-count={navigableItems.length}
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
        {canNavigate ? (
          <p className="sr-only" aria-live="polite" data-kg-media-catalog-preview-navigation="arrow-keys">
            {`${item.name}, item ${activeIndex + 1} of ${navigableItems.length}. Use Left or Up for previous; Right or Down for next.`}
          </p>
        ) : null}
        <section className={MEDIA_EXPANDED_PREVIEW_PLAYER_FRAME_CLASS_NAME}>
          <section className={MEDIA_EXPANDED_PREVIEW_MEDIA_CLASS_NAME} data-kg-media-catalog-preview-panel="1">
            <section className={MEDIA_EXPANDED_PREVIEW_RICH_PANEL_CLASS_NAME}>
              <RichMediaPanel
                key={item.id}
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
