import React from 'react'
import { useTimelineMediaReaderSummary } from '@/components/timeline/timelineMediaReader'
import { resolveTimelinePlanSourceUrl } from '@/components/timeline/timelinePlanSync'
import type { VideoSequenceTimelineThumbnailWindow } from '@/components/timeline/VideoSequenceTimelineRuler'
import { useGanttTimelineTransportChromeModel } from './useGanttTimelineTransportChromeModel'
import { useGanttTimelineTransportCommandModel } from './useGanttTimelineTransportCommandModel'
import { useGanttTimelineTransportInteractionModel } from './useGanttTimelineTransportInteractionModel'
import { useGanttTimelineTransportPlaybackModel } from './useGanttTimelineTransportPlaybackModel'
import {
  useGanttTimelineTransportRulerModel,
  type GanttTimelineTransportRulerModel,
} from './useGanttTimelineTransportRulerModel'
import { useGanttTimelineTransportSession } from './useGanttTimelineTransportSession'
import {
  useGanttTimelineTransportShellModel,
  type GanttTimelineTransportShellModel,
} from './useGanttTimelineTransportShellModel'
import type { GanttTimelineTransportChromeModel } from './useGanttTimelineTransportChromeModel'

export type GanttTimelineTransportSurfaceModel = {
  chromeModel: GanttTimelineTransportChromeModel
  rulerModel: GanttTimelineTransportRulerModel
  shellModel: GanttTimelineTransportShellModel
}

export function useGanttTimelineTransportSurfaceModel(args: {
  code: string
  compact: boolean
}): GanttTimelineTransportSurfaceModel {
  const rulerContentRef = React.useRef<HTMLElement | null>(null)
  const transportSession = useGanttTimelineTransportSession({
    code: args.code,
  })
  const mediaThumbnailSourceUrl = React.useMemo(() => {
    const source = transportSession.exportPlan?.segments.find(segment => resolveTimelinePlanSourceUrl(segment.source))?.source || null
    return source ? resolveTimelinePlanSourceUrl(source) : ''
  }, [transportSession.exportPlan])
  const mediaThumbnailSummary = useTimelineMediaReaderSummary({
    active: !!mediaThumbnailSourceUrl,
    url: mediaThumbnailSourceUrl,
  })
  const sourceThumbnailWindows = React.useMemo<VideoSequenceTimelineThumbnailWindow[]>(() => {
    const durationSeconds = mediaThumbnailSummary.durationSeconds
    if (!transportSession.exportPlan?.segments.length || !mediaThumbnailSourceUrl || durationSeconds <= 0) return []
    return transportSession.exportPlan.segments
      .filter(segment => resolveTimelinePlanSourceUrl(segment.source) === mediaThumbnailSourceUrl)
      .map(segment => ({
        sourceEndSeconds: segment.sourceEndRatio * durationSeconds,
        sourceStartSeconds: segment.sourceStartRatio * durationSeconds,
        timelineEndMinutes: segment.timelineEndMinutes,
        timelineStartMinutes: segment.timelineStartMinutes,
      }))
  }, [mediaThumbnailSourceUrl, mediaThumbnailSummary.durationSeconds, transportSession.exportPlan])
  const transportCommandModel = useGanttTimelineTransportCommandModel({
    code: args.code,
    exportPlan: transportSession.exportPlan,
    markdownDocumentName: transportSession.markdownDocumentName,
    markdownText: transportSession.markdownText,
    maxMinutes: transportSession.maxMinutes,
    positionMinutes: transportSession.positionMinutes,
    selectedSpan: transportSession.selectedSpan,
    setSelectedRowKey: transportSession.setSelectedRowKey,
    setTransportPlaying: transportSession.setTransportPlaying,
  })
  const transportInteractionModel = useGanttTimelineTransportInteractionModel({
    markdownDocumentName: transportSession.markdownDocumentName,
    markdownText: transportSession.markdownText,
    maxMinutes: transportSession.maxMinutes,
    playing: transportSession.playing,
    positionMinutes: transportSession.positionMinutes,
    rulerContentRef,
    selectedRowKey: transportSession.selectedRowKey,
    setSelectedRowKey: transportSession.setSelectedRowKey,
    setTransportPlaybackPosition: transportSession.setTransportPlaybackPosition,
    setTransportPlaying: transportSession.setTransportPlaying,
    timelineModel: transportSession.timelineModel,
    onCommitDrag: transportCommandModel.handleCommittedDragUpdate,
  })
  const chromeModel = useGanttTimelineTransportChromeModel({
    canFitTimeline: transportInteractionModel.canFitTimeline,
    canZoomIn: transportInteractionModel.canZoomIn,
    canZoomOut: transportInteractionModel.canZoomOut,
    centerTimelinePlayhead: transportInteractionModel.centerTimelinePlayhead,
    disabled: transportSession.disabled,
    exportPlanError: transportSession.exportPlanError,
    handleFitTimeline: transportInteractionModel.handleFitTimeline,
    handleZoomIn: transportInteractionModel.handleZoomIn,
    handleZoomOut: transportInteractionModel.handleZoomOut,
    maxMinutes: transportSession.maxMinutes,
    mediaDurationSeconds: transportSession.mediaDurationSeconds,
    playheadMinutes: transportSession.positionMinutes,
    selectedSpan: transportSession.selectedSpan,
    toolStatus: transportSession.toolStatus,
    ...transportCommandModel.chromeModelCommands,
  })
  const rulerModel = useGanttTimelineTransportRulerModel({
    compact: args.compact,
    contentRef: rulerContentRef,
    displayTicks: transportSession.displayTicks,
    dragPreview: transportInteractionModel.dragPreview,
    draggingRowKey: transportInteractionModel.draggingRowKey,
    maxMinutes: transportSession.maxMinutes,
    onRulerPointerDown: transportInteractionModel.handleRulerPointerScrub,
    onSelectRowKey: transportSession.setSelectedRowKey,
    onTrackPointerStart: transportInteractionModel.handleTrackPointerStart,
    playheadPercent: transportInteractionModel.playheadPercent,
    positionMinutes: transportSession.positionMinutes,
    scopes: transportSession.monitorScopes,
    selectedRowKey: transportSession.selectedRowKey,
    sourceThumbnails: mediaThumbnailSummary.thumbnails,
    sourceThumbnailWindows,
    taskSpans: transportSession.timelineModel.taskSpans,
    timelineZoom: transportInteractionModel.timelineZoom,
    totalLabel: transportSession.totalLabel,
    visibleLaneCount: transportSession.visibleLaneCount,
  })
  const transportPlaybackModel = useGanttTimelineTransportPlaybackModel({
    disabled: transportSession.disabled,
    documentKey: transportSession.documentKey,
    maxMinutes: transportSession.maxMinutes,
    onPositionChange: transportInteractionModel.handlePositionChange,
    playbackRate: transportSession.playbackRate,
    playbackUnitsPerMs: transportSession.playbackUnitsPerMs,
    playing: transportSession.playing,
    positionMinutes: transportSession.positionMinutes,
    setTransportPlaying: transportSession.setTransportPlaying,
  })
  const shellModel = useGanttTimelineTransportShellModel({
    currentLabel: transportSession.currentLabel,
    disabled: transportSession.disabled,
    hasMediaDurationScale: transportSession.hasMediaDurationScale,
    maxMinutes: transportSession.maxMinutes,
    mediaDurationSeconds: transportSession.mediaDurationSeconds,
    mediaReaderSummary: mediaThumbnailSummary,
    onPlaybackPointerDown: transportPlaybackModel.handlePlaybackPointerDown,
    onPlaybackRateChange: transportSession.setTransportPlaybackRate,
    onTogglePlayback: transportPlaybackModel.handleTogglePlayback,
    onValueChange: transportInteractionModel.handlePositionChange,
    playbackRate: transportSession.playbackRate,
    playing: transportSession.playing,
  })

  return {
    chromeModel,
    rulerModel,
    shellModel,
  }
}
