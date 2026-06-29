import React from 'react'
import type { TimelineMediaReaderThumbnail } from './timelineMediaReader'
import { formatVideoSequenceTimelineSecondsOffset } from './videoSequenceTimeline'
import type { MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { MEDIA_IMAGE_FORMAT_PREFERENCE_ATTR, MEDIA_VIDEO_FORMAT_PREFERENCE_ATTR } from '@/lib/media/mediaFormatPreference'

type VideoSequenceClipThumbnailWindow = {
  sourceEndSeconds: number
  sourceStartSeconds: number
}

function resolveVideoSequenceThumbnailTimelinePosition(args: {
  span: MermaidGanttTimelineTaskSpan
  thumbnail: TimelineMediaReaderThumbnail
  window: VideoSequenceClipThumbnailWindow | null
}): number {
  if (!args.window) return args.span.startMinutes
  const sourceStart = Math.min(args.window.sourceStartSeconds, args.window.sourceEndSeconds)
  const sourceEnd = Math.max(args.window.sourceStartSeconds, args.window.sourceEndSeconds)
  const sourceSpan = Math.max(0.0001, sourceEnd - sourceStart)
  const sourceRatio = Math.min(1, Math.max(0, (args.thumbnail.timestampSeconds - sourceStart) / sourceSpan))
  return args.span.startMinutes + Math.max(0, args.span.durationMinutes) * sourceRatio
}

export function VideoSequenceClipThumbnailStrip({
  generated,
  onSelectRowPosition,
  span,
  thumbnailWindow,
  thumbnails,
}: {
  generated: boolean
  onSelectRowPosition: (rowKey: string, positionMinutes: number) => void
  span: MermaidGanttTimelineTaskSpan
  thumbnailWindow: VideoSequenceClipThumbnailWindow | null
  thumbnails: readonly TimelineMediaReaderThumbnail[]
}) {
  if (!thumbnails.length) return null
  const sourceStart = thumbnails[0]?.timestampSeconds
  const sourceEnd = thumbnails[thumbnails.length - 1]?.timestampSeconds
  return (
    <section
      className="timeline-video-sequence-clip-thumbnail-strip"
      aria-label={`${span.label} generated thumbnails`}
      data-kg-video-sequence-clip-thumbnail-strip="1"
      data-kg-video-sequence-clip-thumbnail-count={thumbnails.length}
      data-kg-video-sequence-clip-thumbnail-generated={generated ? 'frame-by-frame' : undefined}
      data-kg-video-sequence-clip-thumbnail-image-format-preference={MEDIA_IMAGE_FORMAT_PREFERENCE_ATTR}
      data-kg-video-sequence-clip-thumbnail-video-format-preference={MEDIA_VIDEO_FORMAT_PREFERENCE_ATTR}
      data-kg-video-sequence-clip-thumbnail-source-start={sourceStart}
      data-kg-video-sequence-clip-thumbnail-source-end={sourceEnd}
    >
      {thumbnails.map(thumbnail => (
        <button
          type="button"
          key={`thumbnail:${span.rowKey}:${thumbnail.timestampSeconds}:${thumbnail.width}x${thumbnail.height}`}
          className="timeline-video-sequence-clip-thumbnail"
          aria-label={`${span.label} thumbnail ${formatVideoSequenceTimelineSecondsOffset(thumbnail.timestampSeconds)} ${thumbnail.format}/${thumbnail.rasterFormat}`}
          data-kg-video-sequence-clip-thumbnail="1"
          data-kg-video-sequence-clip-thumbnail-format={thumbnail.format}
          data-kg-video-sequence-clip-thumbnail-microsecond-time={Math.max(0, Math.round(thumbnail.timestampSeconds * 1_000_000))}
          data-kg-video-sequence-clip-thumbnail-raster-format={thumbnail.rasterFormat}
          data-kg-video-sequence-clip-thumbnail-time={thumbnail.timestampSeconds}
          onClick={event => {
            event.stopPropagation()
            onSelectRowPosition(span.rowKey, resolveVideoSequenceThumbnailTimelinePosition({ span, thumbnail, window: thumbnailWindow }))
          }}
          onPointerDown={event => {
            event.stopPropagation()
          }}
        >
          <img alt="" decoding="async" draggable={false} height={thumbnail.height} loading="lazy" src={thumbnail.dataUrl} width={thumbnail.width} />
          <span className="timeline-video-sequence-clip-thumbnail-caption">
            <time dateTime={`PT${thumbnail.timestampSeconds.toFixed(3)}S`}>
              {formatVideoSequenceTimelineSecondsOffset(thumbnail.timestampSeconds)}
            </time>
            <span>{thumbnail.format}/{thumbnail.rasterFormat}</span>
          </span>
          <span className="timeline-video-sequence-clip-thumbnail-preview" aria-hidden="true" data-kg-video-sequence-clip-thumbnail-preview="1">
            <img alt="" decoding="async" draggable={false} height={thumbnail.height} loading="lazy" src={thumbnail.dataUrl} width={thumbnail.width} />
            <span className="timeline-video-sequence-clip-thumbnail-preview-caption">
              {formatVideoSequenceTimelineSecondsOffset(thumbnail.timestampSeconds)} {thumbnail.format}/{thumbnail.rasterFormat}
            </span>
          </span>
        </button>
      ))}
    </section>
  )
}
