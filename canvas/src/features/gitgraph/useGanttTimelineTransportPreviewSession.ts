import React from 'react'
import {
  buildVideoSequenceExportPlan,
  resolveVideoSequenceExportPlanError,
  type VideoSequenceExportPlan,
} from '@/components/timeline/videoSequenceExport'
import { useTimelinePreviewMonitorBinding } from '@/components/timeline/useTimelinePreviewMonitorBinding'
import { readVideoSequenceTimelineModelFromMarkdown } from '@/components/timeline/videoSequenceTimeline'
import { type MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'

export type GanttTimelineTransportPreviewSession = {
  exportPlan: VideoSequenceExportPlan | null
  exportPlanError: string
  monitorScopes: ReturnType<typeof useTimelinePreviewMonitorBinding>['monitorScopes']
}

export function useGanttTimelineTransportPreviewSession(args: {
  code: string
  markdownDocumentName: string
  markdownText: string
  maxMinutes: number
  positionMinutes: number
  selectedRowKey?: string | null
  taskSpans: readonly MermaidGanttTimelineTaskSpan[]
}): GanttTimelineTransportPreviewSession {
  const videoSequenceModel = React.useMemo(
    () => readVideoSequenceTimelineModelFromMarkdown(args.markdownText),
    [args.markdownText],
  )
  const previewMonitorBinding = useTimelinePreviewMonitorBinding({
    markdownDocumentName: args.markdownDocumentName,
    markdownText: args.markdownText,
    maxMinutes: args.maxMinutes,
    positionMinutes: args.positionMinutes,
    selectedRowKey: args.selectedRowKey,
    sourceCount: videoSequenceModel?.sources.length || 0,
    spanCount: args.taskSpans.length,
  })
  const exportPlan = React.useMemo(
    () => buildVideoSequenceExportPlan({
      code: args.code,
      filenameHint: args.markdownDocumentName,
      sources: videoSequenceModel?.sources || [],
    }),
    [args.code, args.markdownDocumentName, videoSequenceModel?.sources],
  )
  const exportPlanError = React.useMemo(() => resolveVideoSequenceExportPlanError(exportPlan), [exportPlan])

  return React.useMemo(() => ({
    exportPlan,
    exportPlanError,
    monitorScopes: previewMonitorBinding.monitorScopes,
  }), [
    exportPlan,
    exportPlanError,
    previewMonitorBinding.monitorScopes,
  ])
}
