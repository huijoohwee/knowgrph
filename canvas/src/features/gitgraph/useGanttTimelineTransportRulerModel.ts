import React from 'react'
import type { TimelineMediaReaderThumbnail } from '@/components/timeline/timelineMediaReader'
import type { VideoSequenceTimelineThumbnailWindow } from '@/components/timeline/VideoSequenceTimelineRuler'
import { clampTimelineTransportValue } from '@/components/timeline/timelineTransport'
import { type VideoSequenceTimelineLaneId, type VideoSequenceTimelineScope } from '@/components/timeline/videoSequenceTimeline'
import {
  type MermaidGanttBarDragMode,
  type MermaidGanttTimelineDragPreview,
  type MermaidGanttTimelineTaskSpan,
  type MermaidGanttTimelineTick,
} from '@/lib/mermaid/mermaidGanttBarInteraction'

export type GanttTimelineTransportRulerModel = {
  chrome: {
    rulerClassName: string
    rulerProps: React.HTMLAttributes<HTMLElement>
    subtitleLabel: string
    totalLabel: string
    value: number
  }
  ruler: {
    contentRef: React.RefObject<HTMLElement | null>
    displayTicks: readonly MermaidGanttTimelineTick[]
    dragPreview: MermaidGanttTimelineDragPreview | null
    draggingRowKey: string
    maxMinutes: number
    playheadPercent: number
    scopes: readonly VideoSequenceTimelineScope[]
    selectedRowKey: string
    sourceThumbnails: readonly TimelineMediaReaderThumbnail[]
    sourceThumbnailWindows: readonly VideoSequenceTimelineThumbnailWindow[]
    taskSpans: readonly MermaidGanttTimelineTaskSpan[]
    timelineZoom: number
    disabledLaneIds: readonly VideoSequenceTimelineLaneId[]
    onRulerPointerDown: (event: React.PointerEvent<HTMLElement>) => void
    onSelectRowKey: (rowKey: string) => void
    onSelectRowPosition: (rowKey: string, positionMinutes: number) => void
    onTrackPointerStart: (event: React.PointerEvent<HTMLElement>, span: MermaidGanttTimelineTaskSpan, mode: MermaidGanttBarDragMode) => void
  }
}

export function useGanttTimelineTransportRulerModel(args: {
  compact: boolean
  contentRef: React.RefObject<HTMLElement | null>
  displayTicks: readonly MermaidGanttTimelineTick[]
  dragPreview: MermaidGanttTimelineDragPreview | null
  draggingRowKey: string
  maxMinutes: number
  playheadPercent: number
  positionMinutes: number
  scopes: readonly VideoSequenceTimelineScope[]
  selectedRowKey: string
  sourceThumbnails: readonly TimelineMediaReaderThumbnail[]
  sourceThumbnailWindows: readonly VideoSequenceTimelineThumbnailWindow[]
  taskSpans: readonly MermaidGanttTimelineTaskSpan[]
  timelineZoom: number
  totalLabel: string
  visibleLaneCount: number
  disabledLaneIds: readonly VideoSequenceTimelineLaneId[]
  onRulerPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onSelectRowKey: (rowKey: string) => void
  onSelectRowPosition: (rowKey: string, positionMinutes: number) => void
  onTrackPointerStart: (event: React.PointerEvent<HTMLElement>, span: MermaidGanttTimelineTaskSpan, mode: MermaidGanttBarDragMode) => void
}): GanttTimelineTransportRulerModel {
  return React.useMemo(() => ({
    chrome: {
      rulerClassName: args.compact
        ? 'timeline-transport-ruler--compact timeline-transport-ruler--tracks timeline-transport-ruler--video-sequence'
        : 'timeline-transport-ruler--tracks timeline-transport-ruler--video-sequence',
      rulerProps: {
        'data-kg-gantt-timeline-ruler': 'bottomPanel',
        style: {
          '--kg-video-sequence-lane-count': args.visibleLaneCount,
        } as React.CSSProperties,
      } as React.HTMLAttributes<HTMLElement>,
      subtitleLabel: `${args.taskSpans.length} timeline rows`,
      totalLabel: args.totalLabel,
      value: clampTimelineTransportValue(args.positionMinutes, 0, Math.max(1, args.maxMinutes)),
    },
    ruler: {
      contentRef: args.contentRef,
      displayTicks: args.displayTicks,
      disabledLaneIds: args.disabledLaneIds,
      dragPreview: args.dragPreview,
      draggingRowKey: args.draggingRowKey,
      maxMinutes: args.maxMinutes,
      onRulerPointerDown: args.onRulerPointerDown,
      onSelectRowKey: args.onSelectRowKey,
      onSelectRowPosition: args.onSelectRowPosition,
      onTrackPointerStart: args.onTrackPointerStart,
      playheadPercent: args.playheadPercent,
      scopes: args.scopes,
      selectedRowKey: args.selectedRowKey,
      sourceThumbnails: args.sourceThumbnails,
      sourceThumbnailWindows: args.sourceThumbnailWindows,
      taskSpans: args.taskSpans,
      timelineZoom: args.timelineZoom,
    },
  }), [
    args.compact,
    args.contentRef,
    args.displayTicks,
    args.disabledLaneIds,
    args.dragPreview,
    args.draggingRowKey,
    args.maxMinutes,
    args.onRulerPointerDown,
    args.onSelectRowKey,
    args.onSelectRowPosition,
    args.onTrackPointerStart,
    args.playheadPercent,
    args.positionMinutes,
    args.scopes,
    args.selectedRowKey,
    args.sourceThumbnails,
    args.sourceThumbnailWindows,
    args.taskSpans,
    args.timelineZoom,
    args.totalLabel,
    args.visibleLaneCount,
  ])
}
