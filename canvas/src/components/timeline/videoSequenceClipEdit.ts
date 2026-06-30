import { formatVideoSequenceTimelineSecondsOffset } from './videoSequenceTimeline'

export type VideoSequenceClipEditAction =
  | 'nudge-back'
  | 'nudge-forward'
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
  startMinutes: number
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
