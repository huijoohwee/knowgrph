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

export function buildVideoSequenceClipEditDetailsLabel({
  maxMinutes,
  mediaDurationSeconds,
  selectedSpan,
}: {
  maxMinutes: number
  mediaDurationSeconds: number
  selectedSpan: VideoSequenceClipEditSpan | null
}): string {
  const hasSelection = Boolean(selectedSpan)
  const startLabel = selectedSpan ? formatClipEditTime(selectedSpan.startMinutes, mediaDurationSeconds, maxMinutes) : ''
  const endLabel = selectedSpan ? formatClipEditTime(selectedSpan.endMinutes, mediaDurationSeconds, maxMinutes) : ''
  const durationLabel = selectedSpan ? formatClipEditTime(selectedSpan.durationMinutes, mediaDurationSeconds, maxMinutes) : ''
  return hasSelection
    ? `Selected clip: ${selectedSpan?.label}. Start ${startLabel}. End ${endLabel}. Duration ${durationLabel}.`
    : 'No clip selected'
}
