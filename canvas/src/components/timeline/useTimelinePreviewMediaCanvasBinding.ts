import React from 'react'
import { useCommandMenuRichMediaInventory } from '@/lib/command-menu/commandMenuRichMediaInventory'
import {
  clampTimelineTransportValue,
  useTimelineDocumentStoreBinding,
  useTimelineTransportStoreBinding,
} from './timelineTransport'
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
  const { transportDocumentKey, transportPosition } = useTimelineTransportStoreBinding()
  const { selectedRowKey } = useTimelineGanttSelectionStoreBinding()
  const previewRouteEntry = useTimelinePreviewRouteEntry({
    intent: 'media',
    inventoryItems: items,
    markdownDocumentName,
    markdownText,
    selectedRowKey,
  })
  const positionMinutes = React.useMemo(() => (
    transportDocumentKey === previewRouteEntry.bootstrap.documentKey
      ? clampTimelineTransportValue(transportPosition, 0, previewRouteEntry.maxMinutes)
      : previewRouteEntry.positionMinutes
  ), [
    previewRouteEntry.bootstrap.documentKey,
    previewRouteEntry.maxMinutes,
    previewRouteEntry.positionMinutes,
    transportDocumentKey,
    transportPosition,
  ])
  const previewMediaContext = useTimelinePreviewMediaContext({
    collection: previewRouteEntry.bootstrap.collection,
    documentKey: previewRouteEntry.bootstrap.documentKey,
    exportPlan: previewRouteEntry.bootstrap.exportPlan,
    intent: previewRouteEntry.intent,
    maxMinutes: previewRouteEntry.maxMinutes,
    positionMinutes,
    selectedRowKey: previewRouteEntry.selectedRowKey,
  })
  return React.useMemo(() => ({
    frameModel: previewMediaContext.mediaCanvasFrame,
  }), [previewMediaContext.mediaCanvasFrame])
}
