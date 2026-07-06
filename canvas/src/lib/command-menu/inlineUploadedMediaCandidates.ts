import React from 'react'
import { listUploadedMediaFromKnowgrphStorage } from '@/lib/storage/uploadedMediaStorage'
import {
  buildUploadedMediaPanelItemFromStorage,
  mergeUploadedMediaPanelItems,
  readStoredUploadedMediaPanelItems,
  readUploadedMediaPanelItemRuntimeUrl,
  UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT,
  writeStoredUploadedMediaPanelItems,
  type UploadedMediaPanelItem,
} from '@/lib/storage/uploadedMediaPanelItems'
import type { InlineMediaCommandCandidate } from './inlineCommandMenuCatalog'

let storageItemsRequest: Promise<UploadedMediaPanelItem[]> | null = null

export function buildUploadedMediaInlineCommandCandidate(item: UploadedMediaPanelItem): InlineMediaCommandCandidate | null {
  if (item.status !== 'synced' || !item.storage) return null
  const url = readUploadedMediaPanelItemRuntimeUrl(item)
  if (!url) return null
  const sourceKey = String(item.storage.contentHash || item.storage.objectKey || item.id).trim()
  return {
    id: `uploaded-${item.id}`,
    kind: item.kind,
    url,
    thumbnailUrl: item.kind === 'image' ? url : undefined,
    label: item.name,
    sourceKey,
    description: 'Uploaded media from FloatingPanel Media',
    keywords: [item.kind, item.name, sourceKey, url].filter(Boolean),
  }
}

function loadUploadedMediaPanelItems(): Promise<UploadedMediaPanelItem[]> {
  if (storageItemsRequest) return storageItemsRequest
  storageItemsRequest = listUploadedMediaFromKnowgrphStorage()
    .then(storageItems => {
      const cloudItems = storageItems
        .map(buildUploadedMediaPanelItemFromStorage)
        .filter((item): item is UploadedMediaPanelItem => !!item)
      const next = mergeUploadedMediaPanelItems([...cloudItems, ...readStoredUploadedMediaPanelItems()])
      writeStoredUploadedMediaPanelItems(next)
      return next
    })
    .catch(() => readStoredUploadedMediaPanelItems())
  return storageItemsRequest
}

export function useUploadedMediaInlineCommandCandidates(): InlineMediaCommandCandidate[] {
  const [items, setItems] = React.useState<UploadedMediaPanelItem[]>(readStoredUploadedMediaPanelItems)

  React.useEffect(() => {
    let active = true
    const refreshLocal = () => setItems(readStoredUploadedMediaPanelItems())
    window.addEventListener(UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, refreshLocal)
    loadUploadedMediaPanelItems().then(next => {
      if (active) setItems(next)
    })
    return () => {
      active = false
      window.removeEventListener(UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, refreshLocal)
    }
  }, [])

  return React.useMemo(
    () => items.flatMap(item => {
      const candidate = buildUploadedMediaInlineCommandCandidate(item)
      return candidate ? [candidate] : []
    }),
    [items],
  )
}
