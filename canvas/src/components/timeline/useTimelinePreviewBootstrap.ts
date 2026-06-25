import React from 'react'
import { type CommandMenuRichMediaItem } from '@/lib/command-menu/commandMenuRichMediaInventory'
import {
  type TimelinePreviewCollection,
  useTimelinePreviewCollection,
} from './useTimelinePreviewCollection'

export type TimelinePreviewBootstrap = {
  collection: TimelinePreviewCollection
  documentKey: string
  exportPlan: TimelinePreviewCollection['previewPlan'] | TimelinePreviewCollection['exportPlan']
}

export const cleanTimelinePreviewDocumentKey = (value: unknown): string => String(value || '').trim()

export function useTimelinePreviewBootstrap(args: {
  inventoryItems: readonly CommandMenuRichMediaItem[]
  markdownDocumentName: string
  markdownText: string
  selectedRowKey?: string | null
}): TimelinePreviewBootstrap {
  const collection = useTimelinePreviewCollection({
    inventoryItems: args.inventoryItems,
    markdownDocumentName: args.markdownDocumentName,
    markdownText: args.markdownText,
    selectedRowKey: args.selectedRowKey,
  })
  const documentKey = cleanTimelinePreviewDocumentKey(args.markdownDocumentName)
  const exportPlan = React.useMemo(
    () => collection.previewPlan || collection.exportPlan,
    [collection.exportPlan, collection.previewPlan],
  )
  return React.useMemo(() => ({
    collection,
    documentKey,
    exportPlan,
  }), [collection, documentKey, exportPlan])
}
