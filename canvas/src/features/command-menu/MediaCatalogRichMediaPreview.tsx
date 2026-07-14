import { ArrowLeft } from 'lucide-react'
import RichMediaPanel from '@/components/RichMediaPanel'
import { readUploadedMediaPanelItemRuntimeUrl, type UploadedMediaPanelItem } from '@/lib/storage/uploadedMediaPanelItems'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export function MediaCatalogRichMediaPreview(props: {
  item: UploadedMediaPanelItem
  onClose: () => void
}) {
  const { item, onClose } = props
  const runtimeUrl = readUploadedMediaPanelItemRuntimeUrl(item)
  return (
    <section
      className="flex h-full min-h-[16rem] flex-col gap-2 p-1"
      aria-label={`${item.name} media preview`}
      data-kg-media-catalog-preview="1"
      data-kg-media-catalog-preview-kind={item.kind}
    >
      <header className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className={cn('inline-flex h-7 shrink-0 items-center gap-1 rounded border px-2 text-xs font-semibold', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.button.hoverBg)}
          aria-label="Back to media catalog"
          data-kg-media-catalog-preview-close="1"
          onClick={onClose}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden />
          Media
        </button>
        <span className={cn('min-w-0 truncate text-xs font-semibold', UI_THEME_TOKENS.text.secondary)}>{item.name}</span>
      </header>
      <section className="min-h-0 flex-1 overflow-hidden rounded-md" data-kg-media-catalog-preview-panel="1">
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
  )
}
