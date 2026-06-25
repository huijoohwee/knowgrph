import React from 'react'
import { useCommandMenuRichMediaInventory } from '@/lib/command-menu/commandMenuRichMediaInventory'
import { useTimelineDocumentStoreBinding } from './timelineTransport'
import { useTimelineGanttSelectionStoreBinding } from './timelineSurfaceBindings'
import { type TimelinePreviewMediaCanvasFrameModel } from './useTimelinePreviewMediaCanvasFrameModel'
import { useTimelinePreviewMediaContext } from './useTimelinePreviewMediaContext'
import { useTimelinePreviewRouteEntry } from './useTimelinePreviewRouteEntry'

export type TimelinePreviewMediaCanvasBinding = {
  frameModel: TimelinePreviewMediaCanvasFrameModel
}

export function useTimelinePreviewMediaCanvasBinding(): TimelinePreviewMediaCanvasBinding {
  const { items } = useCommandMenuRichMediaInventory()
  const { markdownDocumentName, markdownText } = useTimelineDocumentStoreBinding()
  const { selectedRowKey } = useTimelineGanttSelectionStoreBinding()
  const previewRouteEntry = useTimelinePreviewRouteEntry({
    intent: 'media',
    inventoryItems: items,
    markdownDocumentName,
    markdownText,
    selectedRowKey,
  })
  const previewMediaContext = useTimelinePreviewMediaContext({
    collection: previewRouteEntry.bootstrap.collection,
    documentKey: previewRouteEntry.bootstrap.documentKey,
    exportPlan: previewRouteEntry.bootstrap.exportPlan,
    intent: previewRouteEntry.intent,
    maxMinutes: previewRouteEntry.maxMinutes,
    positionMinutes: previewRouteEntry.positionMinutes,
    selectedRowKey: previewRouteEntry.selectedRowKey,
  })
  return React.useMemo(() => ({
    frameModel: previewMediaContext.mediaCanvasFrame,
  }), [previewMediaContext.mediaCanvasFrame])
}
