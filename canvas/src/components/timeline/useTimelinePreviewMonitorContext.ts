import React from 'react'
import { type VideoSequenceTimelineScope } from './videoSequenceTimeline'
import { type TimelinePreviewSurfaceIntent } from './useTimelinePreviewSurfaceModel'
import { type TimelinePreviewCollection } from './useTimelinePreviewCollection'
import { type VideoSequenceExportPlan } from './videoSequenceExport'
import {
  type TimelinePreviewMediaContext,
  useTimelinePreviewMediaContext,
} from './useTimelinePreviewMediaContext'
import { useTimelinePreviewScopeProjection } from './useTimelinePreviewScopeProjection'

export type TimelinePreviewMonitorContext = TimelinePreviewMediaContext & {
  monitorScopes: VideoSequenceTimelineScope[]
}

export function useTimelinePreviewMonitorContext(args: {
  collection: TimelinePreviewCollection
  documentKey: string
  exportPlan?: VideoSequenceExportPlan | null
  intent: TimelinePreviewSurfaceIntent
  maxMinutes: number
  positionMinutes: number
  selectedRowKey?: string | null
  sourceCount?: number
  spanCount?: number
}): TimelinePreviewMonitorContext {
  const mediaContext = useTimelinePreviewMediaContext({
    collection: args.collection,
    documentKey: args.documentKey,
    exportPlan: args.exportPlan,
    intent: args.intent,
    maxMinutes: args.maxMinutes,
    positionMinutes: args.positionMinutes,
    selectedRowKey: args.selectedRowKey,
  })
  const scopeProjection = useTimelinePreviewScopeProjection({
    maxMinutes: args.maxMinutes,
    mediaContext,
    positionMinutes: args.positionMinutes,
    sourceCount: args.sourceCount,
    spanCount: args.spanCount,
  })
  return React.useMemo(() => ({
    ...mediaContext,
    monitorScopes: scopeProjection.monitorScopes,
  }), [mediaContext, scopeProjection.monitorScopes])
}
