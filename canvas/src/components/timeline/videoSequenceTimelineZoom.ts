import type { MermaidGanttTimelineTick } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { formatVideoSequenceTimelineSecondsOffset } from './videoSequenceTimeline'

const VIDEO_SEQUENCE_TIMELINE_ZOOM_TICK_TARGET_PER_ZOOM = 8
const VIDEO_SEQUENCE_TIMELINE_ZOOM_TICK_STEPS_SECONDS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600] as const
const VIDEO_SEQUENCE_TIMELINE_SCALE_STEPS_SECONDS = [10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] as const
const VIDEO_SEQUENCE_TIMELINE_APPEND_SPACE_MIN_ZOOM = 2
const VIDEO_SEQUENCE_TIMELINE_APPEND_SPACE_PER_ZOOM_PERCENT = 40
const VIDEO_SEQUENCE_TIMELINE_APPEND_SPACE_MAX_PERCENT = 160

export function resolveVideoSequenceTimelineScaleDurationSeconds(durationSeconds: number): number {
  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0
  if (duration <= 0) return 0
  const scaleStep = VIDEO_SEQUENCE_TIMELINE_SCALE_STEPS_SECONDS.find(step => duration <= step)
  if (scaleStep) return scaleStep
  const terminalStep = VIDEO_SEQUENCE_TIMELINE_SCALE_STEPS_SECONDS[VIDEO_SEQUENCE_TIMELINE_SCALE_STEPS_SECONDS.length - 1]
  return Math.ceil(duration / terminalStep) * terminalStep
}

export function resolveVideoSequenceTimelineScaleMaxMinutes(args: {
  maxMinutes: number
  mediaDurationSeconds: number
}): number {
  const maxMinutes = Number.isFinite(args.maxMinutes) && args.maxMinutes > 0 ? args.maxMinutes : 0
  const mediaDurationSeconds = Number.isFinite(args.mediaDurationSeconds) && args.mediaDurationSeconds > 0 ? args.mediaDurationSeconds : 0
  if (maxMinutes <= 0 || mediaDurationSeconds <= 0) return maxMinutes
  const scaleDurationSeconds = resolveVideoSequenceTimelineScaleDurationSeconds(mediaDurationSeconds)
  return Math.max(maxMinutes, (scaleDurationSeconds / mediaDurationSeconds) * maxMinutes)
}

export function resolveVideoSequenceTimelineZoomTickStepSeconds(args: {
  durationSeconds: number
  timelineZoom: number
}): number {
  const durationSeconds = Number.isFinite(args.durationSeconds) && args.durationSeconds > 0 ? args.durationSeconds : 0
  const timelineZoom = Number.isFinite(args.timelineZoom) && args.timelineZoom > 0 ? args.timelineZoom : 1
  if (durationSeconds <= 0) return 1
  const targetTickCount = Math.max(6, Math.round(timelineZoom * VIDEO_SEQUENCE_TIMELINE_ZOOM_TICK_TARGET_PER_ZOOM))
  const rawStep = Math.max(1, durationSeconds / targetTickCount)
  return VIDEO_SEQUENCE_TIMELINE_ZOOM_TICK_STEPS_SECONDS.find(step => step >= rawStep)
    || VIDEO_SEQUENCE_TIMELINE_ZOOM_TICK_STEPS_SECONDS[VIDEO_SEQUENCE_TIMELINE_ZOOM_TICK_STEPS_SECONDS.length - 1]
}

export function buildVideoSequenceTimelineZoomTicks(args: {
  displayTicks: readonly MermaidGanttTimelineTick[]
  maxMinutes: number
  mediaDurationSeconds: number
  timelineZoom: number
}): readonly MermaidGanttTimelineTick[] {
  const mediaDurationSeconds = Number.isFinite(args.mediaDurationSeconds) && args.mediaDurationSeconds > 0 ? args.mediaDurationSeconds : 0
  const maxMinutes = Number.isFinite(args.maxMinutes) && args.maxMinutes > 0 ? args.maxMinutes : 0
  if (mediaDurationSeconds <= 0 || maxMinutes <= 0) return args.displayTicks
  const scaleDurationSeconds = resolveVideoSequenceTimelineScaleDurationSeconds(mediaDurationSeconds)
  const stepSeconds = resolveVideoSequenceTimelineZoomTickStepSeconds({
    durationSeconds: scaleDurationSeconds,
    timelineZoom: args.timelineZoom,
  })
  const ticks: MermaidGanttTimelineTick[] = []
  for (let seconds = 0; seconds < scaleDurationSeconds; seconds += stepSeconds) {
    const minutes = (seconds / scaleDurationSeconds) * maxMinutes
    ticks.push({
      label: formatVideoSequenceTimelineSecondsOffset(seconds),
      minutes,
      percent: (minutes / maxMinutes) * 100,
    })
  }
  ticks.push({
    label: formatVideoSequenceTimelineSecondsOffset(scaleDurationSeconds),
    minutes: maxMinutes,
    percent: 100,
  })
  return ticks
}

export function resolveVideoSequenceTimelineAppendSpacePercent(timelineZoom: number): number {
  const zoom = Number.isFinite(timelineZoom) && timelineZoom > 0 ? timelineZoom : 1
  if (zoom < VIDEO_SEQUENCE_TIMELINE_APPEND_SPACE_MIN_ZOOM) return 0
  return Math.min(
    VIDEO_SEQUENCE_TIMELINE_APPEND_SPACE_MAX_PERCENT,
    Math.round((zoom - 1) * VIDEO_SEQUENCE_TIMELINE_APPEND_SPACE_PER_ZOOM_PERCENT),
  )
}
