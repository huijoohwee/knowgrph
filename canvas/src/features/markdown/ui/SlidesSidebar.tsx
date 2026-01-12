import React from 'react'
import { LayoutList, LayoutPanelTop } from 'lucide-react'
import PreviewGallery from '@/features/panels/views/preview-panel/ui/PreviewGallery'
import { UI_COPY } from '@/lib/config'

export type SlidesSidebarProps = {
  orderedSlideIndices: number[]
  activeSlideId: number
  slideOrder: number[]
  slideCount: number
  activeSlideHeading: string
  showSlideThumbnails: boolean
  onToggleShowSlideThumbnails: () => void
  onSidebarFocusSlideIdChange: (id: number | null) => void
  onActiveSlideIndexChange: (index: number) => void
  onSlideOrderChange: (nextOrder: number[]) => void
  renderSlidePreview: (slideIdx: number) => React.ReactNode
}

export function SlidesSidebar(props: SlidesSidebarProps) {
  const {
    orderedSlideIndices,
    activeSlideId,
    slideOrder,
    slideCount,
    activeSlideHeading,
    showSlideThumbnails,
    onToggleShowSlideThumbnails,
    onSidebarFocusSlideIdChange,
    onActiveSlideIndexChange,
    onSlideOrderChange,
    renderSlidePreview,
  } = props

  const [selectedSlideIds, setSelectedSlideIds] = React.useState<string[]>([])

  return (
    <div className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="h-9 border-b border-gray-200 bg-gray-50 px-2 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-700">
            {UI_COPY.markdownSlidesSidebarViewTitle}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 truncate">
            {slideCount} {UI_COPY.markdownSlidesSidebarSlidesSuffix}
            {activeSlideHeading ? ` · ${activeSlideHeading}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedSlideIds.length > 0 ? (
            <button
              type="button"
              className="text-[11px] text-gray-500 hover:text-gray-900"
              onClick={() => setSelectedSlideIds([])}
            >
              {UI_COPY.markdownSlidesSidebarClearSelectionLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={[
              'App-toolbar__btn flex items-center justify-center rounded border text-gray-700',
              showSlideThumbnails
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white border-gray-300 hover:bg-gray-50',
            ].join(' ')}
            onClick={onToggleShowSlideThumbnails}
          >
            {showSlideThumbnails ? (
              <LayoutPanelTop className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden={true} />
            ) : (
              <LayoutList className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden={true} />
            )}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="py-2">
          <PreviewGallery
            items={orderedSlideIndices.map((slideIdx, i) => ({
              id: String(slideIdx),
              label: UI_COPY.markdownSlideIndexLabel(i + 1),
              preview: renderSlidePreview(slideIdx),
            }))}
            activeId={String(activeSlideId)}
            selectedIds={selectedSlideIds}
            onSelectedIdsChange={setSelectedSlideIds}
            showPreview={showSlideThumbnails}
            onHighlightChange={(id) => {
              if (id === null) {
                onSidebarFocusSlideIdChange(null)
                return
              }
              const idx = Number.parseInt(id, 10)
              if (!Number.isFinite(idx)) return
              onSidebarFocusSlideIdChange(idx)
            }}
            onSelect={(id) => {
              const idx = Number.parseInt(id, 10)
              if (!Number.isFinite(idx)) return
              const pos = orderedSlideIndices.indexOf(idx)
              if (pos < 0) return
              onActiveSlideIndexChange(pos)
            }}
            onReorder={(nextIds) => {
              const next = nextIds.map(x => Number.parseInt(x, 10)).filter(n => Number.isFinite(n))
              const nextOrder = next.length ? next : slideOrder
              onSlideOrderChange(nextOrder)
              const nextPos = nextOrder.indexOf(activeSlideId)
              if (nextPos >= 0) onActiveSlideIndexChange(nextPos)
            }}
          />
        </div>
      </div>
    </div>
  )
}
