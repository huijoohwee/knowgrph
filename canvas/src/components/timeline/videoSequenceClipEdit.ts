import { formatVideoSequenceTimelineSecondsOffset } from './videoSequenceTimeline'
import { SNAP_GRID_SIZE_DEFAULT, snapScalarToGrid, type SnapGridSizeLike } from '@/lib/canvas/gridSnap'

export type VideoSequenceClipEditAction =
  | 'add-bookmark'
  | 'delete-element'
  | 'duplicate-element'
  | 'extract-audio'
  | 'nudge-back'
  | 'nudge-forward'
  | 'toggle-auto-snapping'
  | 'toggle-ripple-editing'
  | 'split-left-at-playhead'
  | 'split-right-at-playhead'
  | 'trim-start-back'
  | 'trim-start-forward'
  | 'trim-end-back'
  | 'trim-end-forward'
  | 'snap-to-playhead'
  | 'split-at-playhead'

export type VideoSequenceClipEditSpan = {
  durationMinutes: number
  endMinutes: number
  label: string
  raw?: string
  startMinutes: number
}

const VIDEO_SEQUENCE_CLIP_EDIT_SECOND_STEP_MINUTES = 1 / 60
const VIDEO_SEQUENCE_CLIP_EDIT_SNAP_THRESHOLD_MINUTES = 6 / 60
const VIDEO_SEQUENCE_CLIP_EDIT_EDGE_EPSILON_MINUTES = 0.0005

export type VideoSequenceClipEditSnapCandidate = {
  minutes: number
  source: 'clip-edge' | 'playhead' | 'timeline-boundary'
}

export type VideoSequenceClipEditTimelineGrid = {
  minutesPerPixel: number
  snapGridSize?: SnapGridSizeLike
}

const hasFractionalTimelineTiming = (span: VideoSequenceClipEditSpan): boolean => (
  span.durationMinutes < 1 ||
  /\b(?:kgpos_|kgsrc_|\d+\.\d+m\b)/i.test(`${span.label} ${span.raw || ''}`)
)

export function resolveVideoSequenceClipEditStepMinutes(span: VideoSequenceClipEditSpan | null | undefined): number {
  return span && hasFractionalTimelineTiming(span) ? VIDEO_SEQUENCE_CLIP_EDIT_SECOND_STEP_MINUTES : 1
}

export function normalizeVideoSequenceClipEditDeltaMinutes(deltaMinutes: number, stepMinutes: number): number {
  const delta = Number(deltaMinutes)
  const step = Number(stepMinutes)
  if (!Number.isFinite(delta) || !Number.isFinite(step) || step <= 0) return 0
  if (step >= 1) return Math.round(delta)
  return Number((Math.round(delta / step) * step).toFixed(3))
}

export function resolveVideoSequenceClipEditSnapCandidates(args: {
  playheadMinutes?: number
  selectedSpan: VideoSequenceClipEditSpan | null | undefined
  spans: readonly VideoSequenceClipEditSpan[]
}): VideoSequenceClipEditSnapCandidate[] {
  const candidates = new Map<string, VideoSequenceClipEditSnapCandidate>()
  const addCandidate = (minutes: number, source: VideoSequenceClipEditSnapCandidate['source']) => {
    const value = Number(minutes)
    if (!Number.isFinite(value) || value < 0) return
    const normalized = Number(value.toFixed(3))
    candidates.set(`${normalized}`, { minutes: normalized, source })
  }
  addCandidate(0, 'timeline-boundary')
  for (const span of args.spans) {
    addCandidate(span.startMinutes, 'clip-edge')
    addCandidate(span.endMinutes, 'clip-edge')
  }
  if (args.selectedSpan) {
    addCandidate(args.selectedSpan.startMinutes, 'clip-edge')
    addCandidate(args.selectedSpan.endMinutes, 'clip-edge')
  }
  const maxEndMinutes = args.spans.reduce((max, span) => Math.max(max, span.endMinutes), 0)
  addCandidate(maxEndMinutes, 'timeline-boundary')
  if (Number.isFinite(args.playheadMinutes)) addCandidate(Number(args.playheadMinutes), 'playhead')
  return Array.from(candidates.values()).sort((left, right) => left.minutes - right.minutes)
}

export function resolveVideoSequenceClipEditGridSnappedMinutes(args: {
  enabled: boolean
  positionMinutes: number
  timelineGrid?: VideoSequenceClipEditTimelineGrid
}): number {
  const positionMinutes = Number(args.positionMinutes)
  const minutesPerPixel = Number(args.timelineGrid?.minutesPerPixel)
  if (!args.enabled || !Number.isFinite(positionMinutes) || !Number.isFinite(minutesPerPixel) || minutesPerPixel <= 0) return positionMinutes
  const snappedPixels = snapScalarToGrid(positionMinutes / minutesPerPixel, args.timelineGrid?.snapGridSize || SNAP_GRID_SIZE_DEFAULT, 'x')
  return Number((snappedPixels * minutesPerPixel).toFixed(3))
}

export function resolveVideoSequenceClipEditSnappedMinutes(args: {
  enabled: boolean
  excludedSnapPositions?: readonly number[]
  positionMinutes: number
  playheadMinutes?: number
  selectedSpan: VideoSequenceClipEditSpan | null | undefined
  spans: readonly VideoSequenceClipEditSpan[]
  targetDurationMinutes?: number
  timelineGrid?: VideoSequenceClipEditTimelineGrid
}): number {
  const positionMinutes = Number(args.positionMinutes)
  if (!args.enabled || !Number.isFinite(positionMinutes)) return positionMinutes
  const selectedSpan = args.selectedSpan
  const excludedSnapPositions = (args.excludedSnapPositions || [])
    .map(position => Number(position))
    .filter(position => Number.isFinite(position))
  const snapCandidates = resolveVideoSequenceClipEditSnapCandidates({
    playheadMinutes: args.playheadMinutes,
    selectedSpan,
    spans: args.spans,
  }).filter(candidate => !excludedSnapPositions.some(excluded => Math.abs(candidate.minutes - excluded) <= VIDEO_SEQUENCE_CLIP_EDIT_EDGE_EPSILON_MINUTES))
  const nearest = snapCandidates
    .flatMap(candidate => {
      const startAligned = { distance: Math.abs(candidate.minutes - positionMinutes), minutes: candidate.minutes }
      const duration = Number(args.targetDurationMinutes)
      if (!Number.isFinite(duration) || duration <= 0) return [startAligned]
      const endAlignedMinutes = candidate.minutes - duration
      return endAlignedMinutes >= 0
        ? [startAligned, { distance: Math.abs(endAlignedMinutes - positionMinutes), minutes: endAlignedMinutes }]
        : [startAligned]
    })
    .filter(candidate => candidate.distance <= VIDEO_SEQUENCE_CLIP_EDIT_SNAP_THRESHOLD_MINUTES)
    .sort((a, b) => a.distance - b.distance || a.minutes - b.minutes)[0]
  return nearest ? Number(nearest.minutes.toFixed(3)) : resolveVideoSequenceClipEditGridSnappedMinutes({
    enabled: args.enabled,
    positionMinutes,
    timelineGrid: args.timelineGrid,
  })
}

export function resolveVideoSequenceClipEditSplitPointMinutes(args: {
  autoSnappingEnabled: boolean
  positionMinutes: number
  selectedSpan: VideoSequenceClipEditSpan | null | undefined
  spans: readonly VideoSequenceClipEditSpan[]
}): number | null {
  const selectedSpan = args.selectedSpan
  const positionMinutes = Number(args.positionMinutes)
  if (!selectedSpan || !Number.isFinite(positionMinutes)) return null
  const splitPointMinutes = resolveVideoSequenceClipEditSnappedMinutes({
    enabled: args.autoSnappingEnabled,
    excludedSnapPositions: [selectedSpan.startMinutes, selectedSpan.endMinutes],
    positionMinutes,
    selectedSpan,
    spans: args.spans,
  })
  if (splitPointMinutes <= selectedSpan.startMinutes + VIDEO_SEQUENCE_CLIP_EDIT_EDGE_EPSILON_MINUTES) return null
  if (splitPointMinutes >= selectedSpan.endMinutes - VIDEO_SEQUENCE_CLIP_EDIT_EDGE_EPSILON_MINUTES) return null
  return splitPointMinutes
}

function formatClipEditTime(minutes: number, mediaDurationSeconds: number, maxMinutes: number): string {
  if (mediaDurationSeconds > 0 && maxMinutes > 0) {
    return formatVideoSequenceTimelineSecondsOffset((minutes / maxMinutes) * mediaDurationSeconds)
  }
  return `${Math.max(0, Math.round(minutes))}m`
}

function formatTimelineSeconds(minutes: number): string {
  return formatVideoSequenceTimelineSecondsOffset(minutes)
}

export function buildVideoSequenceClipEditDetailsLabel({
  maxMinutes,
  mediaDurationSeconds,
  selectedSpan,
  useTimelineSeconds,
}: {
  maxMinutes: number
  mediaDurationSeconds: number
  selectedSpan: VideoSequenceClipEditSpan | null
  useTimelineSeconds?: boolean
}): string {
  const hasSelection = Boolean(selectedSpan)
  const formatTime = useTimelineSeconds ? formatTimelineSeconds : (minutes: number) => formatClipEditTime(minutes, mediaDurationSeconds, maxMinutes)
  const startLabel = selectedSpan ? formatTime(selectedSpan.startMinutes) : ''
  const endLabel = selectedSpan ? formatTime(selectedSpan.endMinutes) : ''
  const durationLabel = selectedSpan ? formatTime(selectedSpan.durationMinutes) : ''
  return hasSelection
    ? `Selected clip: ${selectedSpan?.label}. Start ${startLabel}. End ${endLabel}. Duration ${durationLabel}.`
    : 'No clip selected'
}
