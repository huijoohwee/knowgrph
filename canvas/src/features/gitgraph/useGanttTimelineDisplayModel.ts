import React from 'react'
import {
  formatVideoSequenceTimelineSecondsOffset,
  resolveVideoSequenceTimelineMediaSeconds,
  resolveVideoSequenceTimelineUnitsPerMs,
} from '@/components/timeline/videoSequenceTimeline'
import {
  formatMermaidGanttTimelineOffset,
  type MermaidGanttTimelineTick,
} from '@/lib/mermaid/mermaidGanttBarInteraction'

export function useGanttTimelineDisplayModel(args: {
  maxMinutes: number
  mediaDurationSeconds: number
  positionMinutes: number
  ticks: readonly MermaidGanttTimelineTick[]
}) {
  const hasMediaDurationScale = args.mediaDurationSeconds > 0 && args.maxMinutes > 0
  const currentLabel = hasMediaDurationScale
    ? formatVideoSequenceTimelineSecondsOffset(resolveVideoSequenceTimelineMediaSeconds({
      durationSeconds: args.mediaDurationSeconds,
      maxMinutes: args.maxMinutes,
      positionMinutes: args.positionMinutes,
    }))
    : formatMermaidGanttTimelineOffset(args.positionMinutes)
  const totalLabel = hasMediaDurationScale
    ? formatVideoSequenceTimelineSecondsOffset(args.mediaDurationSeconds)
    : formatMermaidGanttTimelineOffset(args.maxMinutes)
  const displayTicks = React.useMemo(() => {
    if (!hasMediaDurationScale) return args.ticks
    return args.ticks.map(tick => ({
      ...tick,
      label: formatVideoSequenceTimelineSecondsOffset(resolveVideoSequenceTimelineMediaSeconds({
        durationSeconds: args.mediaDurationSeconds,
        maxMinutes: args.maxMinutes,
        positionMinutes: tick.minutes,
      })),
    }))
  }, [args.maxMinutes, args.mediaDurationSeconds, args.ticks, hasMediaDurationScale])
  const playbackUnitsPerMs = React.useMemo(() => resolveVideoSequenceTimelineUnitsPerMs({
    durationSeconds: args.mediaDurationSeconds,
    fallbackUnitsPerMs: 1 / 1000,
    maxMinutes: args.maxMinutes,
  }), [args.maxMinutes, args.mediaDurationSeconds])

  return {
    currentLabel,
    displayTicks,
    hasMediaDurationScale,
    playbackUnitsPerMs,
    totalLabel,
  }
}
