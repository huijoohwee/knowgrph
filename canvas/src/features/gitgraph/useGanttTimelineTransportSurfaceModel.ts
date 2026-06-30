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
import { useGanttTimelineDisplayModel } from './useGanttTimelineDisplayModel'
import { VIDEO_SEQUENCE_BOTTOM_PANEL_DISABLED_LANE_IDS } from '@/components/timeline/videoSequenceTimeline'
import { useGraphStore } from '@/hooks/useGraphStore'

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
  const videoSequenceTimelineLaneVisibility = useGraphStore(state => state.videoSequenceTimelineLaneVisibility)
  const disabledLaneIds = React.useMemo(() => (
    VIDEO_SEQUENCE_BOTTOM_PANEL_DISABLED_LANE_IDS.filter(laneId => videoSequenceTimelineLaneVisibility?.[laneId] !== true)
  ), [videoSequenceTimelineLaneVisibility])
  const transportSession = useGanttTimelineTransportSession({
    code: args.code,
    disabledLaneIds,
  })
  const selectedPreviewEmpty = !!transportSession.selectedRowKey && !transportSession.previewPlan
  const mediaPreviewSourceUrl = React.useMemo(() => {
    if (selectedPreviewEmpty) return ''
    const source = transportSession.previewPlan?.segments.find(segment => resolveTimelinePlanSourceUrl(segment.source))?.source
      || transportSession.thumbnailPlan?.segments.find(segment => resolveTimelinePlanSourceUrl(segment.source))?.source
      || transportSession.exportPlan?.segments.find(segment => resolveTimelinePlanSourceUrl(segment.source))?.source
      || null
    return source ? resolveTimelinePlanSourceUrl(source) : ''
  }, [selectedPreviewEmpty, transportSession.exportPlan, transportSession.previewPlan, transportSession.thumbnailPlan])
  const timelinePlanSourceDurationSeconds = React.useMemo(() => {
    if (selectedPreviewEmpty) return 0
    const source = transportSession.previewPlan?.segments.find(segment => Number(segment.source.durationSeconds) > 0)?.source
      || transportSession.thumbnailPlan?.segments.find(segment => Number(segment.source.durationSeconds) > 0)?.source
      || transportSession.exportPlan?.segments.find(segment => Number(segment.source.durationSeconds) > 0)?.source
      || null
    const durationSeconds = Number(source?.durationSeconds)
    return Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0
  }, [selectedPreviewEmpty, transportSession.exportPlan, transportSession.previewPlan, transportSession.thumbnailPlan])
  const thumbnailSourceUrl = React.useMemo(() => {
    const source = transportSession.thumbnailPlan?.segments.find(segment => resolveTimelinePlanSourceUrl(segment.source))?.source
      || transportSession.previewPlan?.segments.find(segment => resolveTimelinePlanSourceUrl(segment.source))?.source
      || transportSession.exportPlan?.segments.find(segment => resolveTimelinePlanSourceUrl(segment.source))?.source
      || null
    return source ? resolveTimelinePlanSourceUrl(source) : ''
  }, [transportSession.exportPlan, transportSession.previewPlan, transportSession.thumbnailPlan])
  const mediaPreviewSummary = useTimelineMediaReaderSummary({
    active: !!mediaPreviewSourceUrl,
    url: mediaPreviewSourceUrl,
  })
  const displaySourceDurationSeconds = timelinePlanSourceDurationSeconds || mediaPreviewSummary.durationSeconds
  const thumbnailSummary = useTimelineMediaReaderSummary({
    active: !!thumbnailSourceUrl,
    url: thumbnailSourceUrl,
  })
  const sourceThumbnailWindows = React.useMemo<VideoSequenceTimelineThumbnailWindow[]>(() => {
    const durationSeconds = thumbnailSummary.durationSeconds
    const thumbnailPlan = transportSession.thumbnailPlan || transportSession.exportPlan
    if (!thumbnailPlan?.segments.length || !thumbnailSourceUrl || durationSeconds <= 0) return []
    return thumbnailPlan.segments
      .filter(segment => resolveTimelinePlanSourceUrl(segment.source) === thumbnailSourceUrl)
      .map(segment => ({
        sourceEndSeconds: segment.sourceEndRatio * durationSeconds,
        sourceStartSeconds: segment.sourceStartRatio * durationSeconds,
        timelineEndMinutes: segment.timelineEndMinutes,
        timelineStartMinutes: segment.timelineStartMinutes,
      }))
  }, [thumbnailSourceUrl, thumbnailSummary.durationSeconds, transportSession.exportPlan, transportSession.thumbnailPlan])
  const transportClockDisplayModel = useGanttTimelineDisplayModel({
    maxMinutes: transportSession.maxMinutes,
    mediaDurationSeconds: transportSession.mediaDurationSeconds,
    positionMinutes: transportSession.positionMinutes,
    previewPlan: selectedPreviewEmpty ? null : transportSession.previewPlan,
    sourceDurationSeconds: selectedPreviewEmpty ? 0 : displaySourceDurationSeconds,
    ticks: transportSession.ticks,
  })
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
    displayTicks: transportClockDisplayModel.displayTicks,
    disabledLaneIds,
    dragPreview: transportInteractionModel.dragPreview,
    draggingRowKey: transportInteractionModel.draggingRowKey,
    maxMinutes: transportSession.maxMinutes,
    onRulerPointerDown: transportInteractionModel.handleRulerPointerScrub,
    onSelectRowKey: transportSession.setSelectedRowKey,
    onSelectRowPosition: (rowKey, positionMinutes) => {
      transportSession.setTransportPlaybackPosition(positionMinutes)
      transportSession.setSelectedRowKey(rowKey)
    },
    onTrackPointerStart: transportInteractionModel.handleTrackPointerStart,
    playheadPercent: transportInteractionModel.playheadPercent,
    positionMinutes: transportSession.positionMinutes,
    scopes: transportSession.monitorScopes,
    selectedRowKey: transportSession.selectedRowKey,
    sourceThumbnails: thumbnailSummary.thumbnails,
    sourceThumbnailWindows,
    taskSpans: transportSession.timelineModel.taskSpans,
    timelineZoom: transportInteractionModel.timelineZoom,
    totalLabel: transportClockDisplayModel.totalLabel,
    visibleLaneCount: transportSession.visibleLaneCount,
  })
  const transportPlaybackModel = useGanttTimelineTransportPlaybackModel({
    disabled: transportSession.disabled,
    documentKey: transportSession.documentKey,
    maxMinutes: transportSession.maxMinutes,
    onPositionChange: transportInteractionModel.handlePositionChange,
    playbackRate: transportSession.playbackRate,
    playbackUnitsPerMs: transportClockDisplayModel.playbackUnitsPerMs,
    playing: transportSession.playing,
    positionMinutes: transportSession.positionMinutes,
    setTransportPlaying: transportSession.setTransportPlaying,
  })
  const shellModel = useGanttTimelineTransportShellModel({
    currentLabel: transportClockDisplayModel.currentLabel,
    disabled: transportSession.disabled,
    hasMediaDurationScale: transportClockDisplayModel.hasMediaDurationScale,
    maxMinutes: transportSession.maxMinutes,
    mediaDurationSeconds: transportSession.mediaDurationSeconds,
    mediaReaderSummary: mediaPreviewSummary,
    onPlaybackPointerDown: transportPlaybackModel.handlePlaybackPointerDown,
    onPlaybackRateChange: transportSession.setTransportPlaybackRate,
    onTogglePlayback: transportPlaybackModel.handleTogglePlayback,
    onValueChange: transportInteractionModel.handlePositionChange,
    playbackRate: transportSession.playbackRate,
    playing: transportSession.playing,
    timelineMode: selectedPreviewEmpty ? 'empty' : 'source-backed',
  })

  return {
    chromeModel,
    rulerModel,
    shellModel,
  }
}
