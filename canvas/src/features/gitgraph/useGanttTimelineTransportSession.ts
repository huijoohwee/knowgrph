import React from 'react'
import { type VideoSequenceExportPlan } from '@/components/timeline/videoSequenceExport'
import {
  type TimelineTransportPlaybackRate,
  useTimelineDocumentTransportController,
  useTimelineDocumentStoreBinding,
  useTimelineTransportStoreBinding,
} from '@/components/timeline/timelineTransport'
import { useTimelineGanttSelectionStoreBinding } from '@/components/timeline/timelineSurfaceBindings'
import { cleanTimelinePreviewDocumentKey } from '@/components/timeline/useTimelinePreviewBootstrap'
import {
  buildVideoSequenceTimelineToolStatus,
  resolveVisibleVideoSequenceTimelineLaneCount,
  type VideoSequenceTimelineLaneId,
} from '@/components/timeline/videoSequenceTimeline'
import {
  buildMermaidGanttTimelineModel,
  buildMermaidGanttTimelineTicks,
  type MermaidGanttTimelineModel,
  type MermaidGanttTimelineTaskSpan,
  type MermaidGanttTimelineTick,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import { useGanttTimelineDisplayModel } from './useGanttTimelineDisplayModel'
import { useGanttTimelineMediaDuration } from './useGanttTimelineMediaDuration'
import { useGanttTimelineTransportPreviewSession } from './useGanttTimelineTransportPreviewSession'

export type GanttTimelineTransportSession = {
  currentLabel: string
  disabled: boolean
  displayTicks: readonly MermaidGanttTimelineTick[]
  documentKey: string
  exportPlan: VideoSequenceExportPlan | null
  exportPlanError: string
  hasMediaDurationScale: boolean
  markdownDocumentName: string
  markdownText: string
  maxMinutes: number
  mediaDurationSeconds: number
  monitorScopes: ReturnType<typeof useGanttTimelineTransportPreviewSession>['monitorScopes']
  playbackRate: TimelineTransportPlaybackRate
  playbackUnitsPerMs: number
  playing: boolean
  positionMinutes: number
  previewPlan: VideoSequenceExportPlan | null
  selectedRowKey: string
  selectedSpan: MermaidGanttTimelineTaskSpan | null
  setSelectedRowKey: (rowKey: string) => void
  setTransportPlaybackPosition: (position: number) => void
  setTransportPlaybackRate: (playbackRate: TimelineTransportPlaybackRate) => void
  setTransportPlaying: (playing: boolean) => void
  ticks: readonly MermaidGanttTimelineTick[]
  thumbnailPlan: VideoSequenceExportPlan | null
  timelineModel: MermaidGanttTimelineModel
  toolStatus: ReturnType<typeof buildVideoSequenceTimelineToolStatus>
  totalLabel: string
  visibleLaneCount: number
}

export function useGanttTimelineTransportSession(args: {
  code: string
  disabledLaneIds?: readonly VideoSequenceTimelineLaneId[]
}): GanttTimelineTransportSession {
  const { markdownDocumentName, markdownText } = useTimelineDocumentStoreBinding()
  const { selectedRowKey, setSelectedRowKey } = useTimelineGanttSelectionStoreBinding()
  const {
    transportDocumentKey,
    transportPosition,
    transportPlaying,
    transportPlaybackRate,
    setTimelineTransportState,
  } = useTimelineTransportStoreBinding()
  const timelineModel = React.useMemo(() => buildMermaidGanttTimelineModel(args.code), [args.code])
  const ticks = React.useMemo(() => buildMermaidGanttTimelineTicks(timelineModel), [timelineModel])
  const visibleLaneCount = React.useMemo(
    () => resolveVisibleVideoSequenceTimelineLaneCount(timelineModel.taskSpans, { disabledLaneIds: args.disabledLaneIds }),
    [args.disabledLaneIds, timelineModel.taskSpans],
  )
  const maxMinutes = Math.max(0, timelineModel.durationMinutes)
  const disabled = !args.code || maxMinutes <= 0
  const documentKey = cleanTimelinePreviewDocumentKey(markdownDocumentName)
  const {
    playbackPosition: positionMinutes,
    playing,
    playbackRate,
    setTransportPlaybackPosition,
    setTransportPlaying,
    setTransportPlaybackRate,
  } = useTimelineDocumentTransportController({
    documentKey,
    maxPosition: maxMinutes,
    setTimelineTransportState,
    transportDocumentKey,
    transportPlaybackRate,
    transportPlaying,
    transportPosition,
  })
  const selectedSpan = React.useMemo(
    () => timelineModel.taskSpans.find(span => span.rowKey === selectedRowKey) || null,
    [selectedRowKey, timelineModel.taskSpans],
  )
  const toolStatus = React.useMemo(
    () => buildVideoSequenceTimelineToolStatus({ positionMinutes, selectedSpan }),
    [positionMinutes, selectedSpan],
  )
  const previewSession = useGanttTimelineTransportPreviewSession({
    code: args.code,
    markdownDocumentName,
    markdownText,
    maxMinutes,
    positionMinutes,
    selectedRowKey,
    taskSpans: timelineModel.taskSpans,
  })
  const exportPlan = previewSession.exportPlan
  const exportPlanError = previewSession.exportPlanError
  const previewPlan = previewSession.previewPlan
  const thumbnailPlan = previewSession.thumbnailPlan
  const mediaDurationSeconds = useGanttTimelineMediaDuration(exportPlan)
  const {
    currentLabel,
    displayTicks,
    hasMediaDurationScale,
    playbackUnitsPerMs,
    totalLabel,
  } = useGanttTimelineDisplayModel({
    maxMinutes,
    mediaDurationSeconds,
    positionMinutes,
    previewPlan,
    ticks,
  })

  return {
    currentLabel,
    disabled,
    displayTicks,
    documentKey,
    exportPlan,
    exportPlanError,
    hasMediaDurationScale,
    markdownDocumentName,
    markdownText,
    maxMinutes,
    mediaDurationSeconds,
    monitorScopes: previewSession.monitorScopes,
    playbackRate,
    playbackUnitsPerMs,
    playing,
    positionMinutes,
    previewPlan,
    selectedRowKey,
    selectedSpan,
    setSelectedRowKey,
    setTransportPlaybackPosition,
    setTransportPlaybackRate,
    setTransportPlaying,
    ticks,
    thumbnailPlan,
    timelineModel,
    toolStatus,
    totalLabel,
    visibleLaneCount,
  }
}
