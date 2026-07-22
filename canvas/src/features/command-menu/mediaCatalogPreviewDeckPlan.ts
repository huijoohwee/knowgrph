import type { UploadedMediaPanelItem } from '@/lib/storage/uploadedMediaPanelItems'

export function resolveMediaCatalogPreviewDeckItems(
  activeItem: UploadedMediaPanelItem,
  adjacentItems: readonly UploadedMediaPanelItem[],
): UploadedMediaPanelItem[] {
  const seenIds = new Set<string>()
  return [activeItem, ...adjacentItems].filter(item => {
    if (seenIds.has(item.id)) return false
    seenIds.add(item.id)
    return item.kind === 'image' || item.kind === 'video'
  })
}
