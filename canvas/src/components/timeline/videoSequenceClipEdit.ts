import { formatVideoSequenceTimelineSecondsOffset } from './videoSequenceTimeline'

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
const VIDEO_SEQUENCE_CLIP_EDIT_SNAP_THRESHOLD_MINUTES = 3 / 60
const VIDEO_SEQUENCE_CLIP_EDIT_EDGE_EPSILON_MINUTES = 0.0005

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

export function resolveVideoSequenceClipEditSnappedMinutes(args: {
  enabled: boolean
  excludedSnapPositions?: readonly number[]
  positionMinutes: number
  selectedSpan: VideoSequenceClipEditSpan | null | undefined
  spans: readonly VideoSequenceClipEditSpan[]
}): number {
  const positionMinutes = Number(args.positionMinutes)
  if (!args.enabled || !Number.isFinite(positionMinutes)) return positionMinutes
  const selectedSpan = args.selectedSpan
  const excludedSnapPositions = (args.excludedSnapPositions || [])
    .map(position => Number(position))
    .filter(position => Number.isFinite(position))
  const snapCandidates = args.spans
    .flatMap(span => [span.startMinutes, span.endMinutes])
    .concat(selectedSpan ? [selectedSpan.startMinutes, selectedSpan.endMinutes] : [])
    .filter(candidate => Number.isFinite(candidate) && candidate >= 0)
    .filter(candidate => !excludedSnapPositions.some(excluded => Math.abs(candidate - excluded) <= 0.0005))
  const nearest = snapCandidates
    .map(candidate => ({
      distance: Math.abs(candidate - positionMinutes),
      minutes: candidate,
    }))
    .filter(candidate => candidate.distance <= VIDEO_SEQUENCE_CLIP_EDIT_SNAP_THRESHOLD_MINUTES)
    .sort((a, b) => a.distance - b.distance || a.minutes - b.minutes)[0]
  return nearest ? Number(nearest.minutes.toFixed(3)) : positionMinutes
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
