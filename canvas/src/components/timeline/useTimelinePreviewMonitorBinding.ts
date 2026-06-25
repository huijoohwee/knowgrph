import React from 'react'
import { type VideoSequenceTimelineScope } from './videoSequenceTimeline'
import { useTimelinePreviewMonitorContext } from './useTimelinePreviewMonitorContext'
import { useTimelinePreviewRouteEntry } from './useTimelinePreviewRouteEntry'

export type TimelinePreviewMonitorBinding = {
  monitorScopes: VideoSequenceTimelineScope[]
}

export function useTimelinePreviewMonitorBinding(args: {
  markdownDocumentName: string
  markdownText: string
  maxMinutes: number
  positionMinutes: number
  selectedRowKey?: string | null
  sourceCount?: number
  spanCount?: number
}): TimelinePreviewMonitorBinding {
  const previewRouteEntry = useTimelinePreviewRouteEntry({
    intent: 'monitor',
    markdownDocumentName: args.markdownDocumentName,
    markdownText: args.markdownText,
    maxMinutes: args.maxMinutes,
    positionMinutes: args.positionMinutes,
    selectedRowKey: args.selectedRowKey,
    sourceCount: args.sourceCount,
    spanCount: args.spanCount,
  })
  const previewMonitorContext = useTimelinePreviewMonitorContext({
    collection: previewRouteEntry.bootstrap.collection,
    documentKey: previewRouteEntry.bootstrap.documentKey,
    exportPlan: previewRouteEntry.bootstrap.exportPlan,
    intent: previewRouteEntry.intent,
    maxMinutes: previewRouteEntry.maxMinutes,
    positionMinutes: previewRouteEntry.positionMinutes,
    selectedRowKey: previewRouteEntry.selectedRowKey,
    sourceCount: previewRouteEntry.sourceCount,
    spanCount: previewRouteEntry.spanCount,
  })
  return React.useMemo(() => ({
    monitorScopes: previewMonitorContext.monitorScopes,
  }), [previewMonitorContext.monitorScopes])
}
