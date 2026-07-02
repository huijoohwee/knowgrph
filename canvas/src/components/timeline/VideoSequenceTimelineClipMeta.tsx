import { formatVideoSequenceTimelineSecondsOffset } from './videoSequenceTimeline'
import type { VideoSequenceTimelineThumbnailWindow } from './VideoSequenceTimelineRuler'
import './VideoSequenceTimelineClipMeta.css'

export function resolveVideoSequenceSourceWindowLabel(sourceWindow: VideoSequenceTimelineThumbnailWindow | null): string {
  if (!sourceWindow) return ''
  return `${formatVideoSequenceTimelineSecondsOffset(sourceWindow.sourceStartSeconds)}-${formatVideoSequenceTimelineSecondsOffset(sourceWindow.sourceEndSeconds)}`
}

export function VideoSequenceTimelineClipMeta({
  compact,
  durationLabel,
  durationMinutes,
  sourceWindow,
}: {
  compact: boolean
  durationLabel: string
  durationMinutes: number
  sourceWindow: VideoSequenceTimelineThumbnailWindow | null
}) {
  if (compact) return null
  const sourceWindowLabel = resolveVideoSequenceSourceWindowLabel(sourceWindow)
  return (
    <span className="timeline-video-sequence-clip-meta" data-kg-video-sequence-clip-meta="trim">
      <time dateTime={`PT${Math.max(0, Math.round(durationMinutes))}S`}>{durationLabel}</time>
      {sourceWindowLabel ? <span data-kg-video-sequence-clip-source-window={sourceWindowLabel}>{sourceWindowLabel}</span> : null}
    </span>
  )
}
