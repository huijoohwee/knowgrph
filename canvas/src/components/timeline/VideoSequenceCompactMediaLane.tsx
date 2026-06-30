import React from 'react'
import type { TimelineMediaReaderThumbnail } from './timelineMediaReader'
import { formatVideoSequenceTimelineSecondsOffset } from './videoSequenceTimeline'
import type { MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'

type VideoSequenceCompactFbfThumbnailWindow = {
  sourceEndSeconds: number
  sourceStartSeconds: number
}

const readFrameSampleCount = (span: MermaidGanttTimelineTaskSpan): number => {
  const countMatch = /\((\d+)\)/.exec(span.label)
  const parsed = Number(countMatch?.[1] || 0)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

const resolveCompactFbfTimelinePosition = (args: {
  span: MermaidGanttTimelineTaskSpan
  thumbnail: TimelineMediaReaderThumbnail
  window: VideoSequenceCompactFbfThumbnailWindow | null
}): number => {
  if (!args.window) return args.span.startMinutes
  const sourceStart = Math.min(args.window.sourceStartSeconds, args.window.sourceEndSeconds)
  const sourceEnd = Math.max(args.window.sourceStartSeconds, args.window.sourceEndSeconds)
  const sourceSpan = Math.max(0.0001, sourceEnd - sourceStart)
  const sourceRatio = Math.min(1, Math.max(0, (args.thumbnail.timestampSeconds - sourceStart) / sourceSpan))
  return args.span.startMinutes + Math.max(0, args.span.durationMinutes) * sourceRatio
}

export function VideoSequenceCompactFbfRail({
  onSelectRowPosition,
  span,
  thumbnailWindow,
  thumbnails,
}: {
  onSelectRowPosition: (rowKey: string, positionMinutes: number) => void
  span: MermaidGanttTimelineTaskSpan
  thumbnailWindow: VideoSequenceCompactFbfThumbnailWindow | null
  thumbnails: readonly TimelineMediaReaderThumbnail[]
}) {
  const sampleCount = readFrameSampleCount(span)
  const visibleCount = Math.max(5, Math.min(14, sampleCount || 10))
  return (
    <section className="timeline-video-sequence-compact-fbf" aria-label={`${span.label} semantic samples`} data-kg-video-agent-compact-fbf-rail="1" data-kg-video-agent-compact-fbf-samples={sampleCount || undefined}>
      <section className="timeline-video-sequence-compact-fbf-rail" aria-hidden="true">
        {Array.from({ length: visibleCount }, (_, index) => (
          <span
            key={`compact-fbf:${span.rowKey}:${index}`}
            className="timeline-video-sequence-compact-fbf-sample"
            style={{ left: `${visibleCount === 1 ? 50 : (index / (visibleCount - 1)) * 100}%` }}
          />
        ))}
      </section>
      {thumbnails.length ? (
        <section className="timeline-video-sequence-compact-fbf-preview" aria-label={`${span.label} hover thumbnails`} data-kg-video-agent-compact-fbf-preview="1" data-kg-video-agent-compact-fbf-preview-count={thumbnails.length}>
          {thumbnails.map(thumbnail => (
            <button
              type="button"
              key={`compact-fbf-preview:${span.rowKey}:${thumbnail.timestampSeconds}:${thumbnail.width}x${thumbnail.height}`}
              className="timeline-video-sequence-compact-fbf-thumbnail"
              aria-label={`${span.label} thumbnail ${formatVideoSequenceTimelineSecondsOffset(thumbnail.timestampSeconds)}`}
              data-kg-video-agent-compact-fbf-thumbnail="1"
              data-kg-video-agent-compact-fbf-thumbnail-time={thumbnail.timestampSeconds}
              onClick={event => {
                event.stopPropagation()
                onSelectRowPosition(span.rowKey, resolveCompactFbfTimelinePosition({ span, thumbnail, window: thumbnailWindow }))
              }}
              onPointerDown={event => event.stopPropagation()}
            >
              <img alt="" decoding="async" draggable={false} height={thumbnail.height} loading="lazy" src={thumbnail.dataUrl} width={thumbnail.width} />
            </button>
          ))}
        </section>
      ) : null}
    </section>
  )
}
