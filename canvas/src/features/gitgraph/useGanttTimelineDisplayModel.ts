import React from 'react'
import {
  resolveTimelinePlanSegmentAtPosition,
  resolveTimelinePlanSourceTimeAtPosition,
  type VideoSequenceExportPlan,
} from '@/components/timeline/timelinePlanSync'
import {
  formatVideoSequenceTimelineSecondsOffset,
  resolveVideoSequenceTimelineMediaSeconds,
  resolveVideoSequenceTimelineUnitsPerMs,
} from '@/components/timeline/videoSequenceTimeline'
import {
  formatMermaidGanttTimelineOffset,
  type MermaidGanttTimelineTick,
} from '@/lib/mermaid/mermaidGanttBarInteraction'

export type GanttTimelineDisplaySourceTime = {
  currentSeconds: number
  totalSeconds: number
}

export function resolveGanttTimelineDisplaySourceTime(args: {
  positionMinutes: number
  previewPlan: VideoSequenceExportPlan | null
  sourceDurationSeconds?: number
}): GanttTimelineDisplaySourceTime | null {
  const segmentResolution = resolveTimelinePlanSegmentAtPosition({
    plan: args.previewPlan,
    positionMinutes: args.positionMinutes,
  })
  if (!segmentResolution?.contains) return null
  const source = segmentResolution.segment.source
  const sourceDurationSeconds = Number(args.sourceDurationSeconds)
  const totalSeconds = Number.isFinite(sourceDurationSeconds) && sourceDurationSeconds > 0
    ? sourceDurationSeconds
    : Number(source.durationSeconds)
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null
  const sourceTime = resolveTimelinePlanSourceTimeAtPosition({
    plan: args.previewPlan,
    positionMinutes: args.positionMinutes,
    source,
    sourceDurationSeconds: totalSeconds,
  })
  if (!sourceTime) return null
  return {
    currentSeconds: sourceTime.sourceTimeSeconds,
    totalSeconds,
  }
}

export function useGanttTimelineDisplayModel(args: {
  maxMinutes: number
  mediaDurationSeconds: number
  positionMinutes: number
  previewPlan: VideoSequenceExportPlan | null
  sourceDurationSeconds?: number
  ticks: readonly MermaidGanttTimelineTick[]
}) {
  const hasMediaDurationScale = args.mediaDurationSeconds > 0 && args.maxMinutes > 0
  const sourceTime = React.useMemo(() => resolveGanttTimelineDisplaySourceTime({
    positionMinutes: args.positionMinutes,
    previewPlan: args.previewPlan,
    sourceDurationSeconds: args.sourceDurationSeconds,
  }), [args.positionMinutes, args.previewPlan, args.sourceDurationSeconds])
  const displayDurationSeconds = sourceTime?.totalSeconds || args.mediaDurationSeconds
  const currentLabel = sourceTime
    ? formatVideoSequenceTimelineSecondsOffset(sourceTime.currentSeconds)
    : hasMediaDurationScale
    ? formatVideoSequenceTimelineSecondsOffset(resolveVideoSequenceTimelineMediaSeconds({
      durationSeconds: args.mediaDurationSeconds,
      maxMinutes: args.maxMinutes,
      positionMinutes: args.positionMinutes,
    }))
    : formatMermaidGanttTimelineOffset(args.positionMinutes)
  const totalLabel = sourceTime
    ? formatVideoSequenceTimelineSecondsOffset(sourceTime.totalSeconds)
    : hasMediaDurationScale
    ? formatVideoSequenceTimelineSecondsOffset(args.mediaDurationSeconds)
    : formatMermaidGanttTimelineOffset(args.maxMinutes)
  const displayTicks = React.useMemo(() => {
    if (sourceTime) {
      return args.ticks.map(tick => {
        const tickSourceTime = resolveGanttTimelineDisplaySourceTime({
          positionMinutes: tick.minutes,
          previewPlan: args.previewPlan,
          sourceDurationSeconds: args.sourceDurationSeconds,
        })
        return {
          ...tick,
          label: formatVideoSequenceTimelineSecondsOffset(tickSourceTime?.currentSeconds ?? tick.minutes),
        }
      })
    }
    if (!hasMediaDurationScale) return args.ticks
    return args.ticks.map(tick => ({
      ...tick,
      label: formatVideoSequenceTimelineSecondsOffset(resolveVideoSequenceTimelineMediaSeconds({
        durationSeconds: args.mediaDurationSeconds,
        maxMinutes: args.maxMinutes,
        positionMinutes: tick.minutes,
      })),
    }))
  }, [args.maxMinutes, args.mediaDurationSeconds, args.previewPlan, args.sourceDurationSeconds, args.ticks, hasMediaDurationScale, sourceTime])
  const playbackUnitsPerMs = React.useMemo(() => resolveVideoSequenceTimelineUnitsPerMs({
    durationSeconds: displayDurationSeconds,
    fallbackUnitsPerMs: 1 / 1000,
    maxMinutes: args.maxMinutes,
  }), [args.maxMinutes, displayDurationSeconds])

  return {
    currentLabel,
    displayTicks,
    hasMediaDurationScale,
    playbackUnitsPerMs,
    totalLabel,
  }
}
