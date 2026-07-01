import React from 'react'
import type { TimelineMediaReaderThumbnail } from './timelineMediaReader'
import { formatVideoSequenceTimelineSecondsOffset } from './videoSequenceTimeline'
import type { MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'

export function VideoSequenceFrameSampleRail({
  samples,
  span,
}: {
  samples: readonly TimelineMediaReaderThumbnail[]
  span: MermaidGanttTimelineTaskSpan
}) {
  if (!samples.length) return null
  return (
    <ol
      className="timeline-video-sequence-frame-sample-rail"
      aria-label={`${span.label} semantic frame samples`}
      data-kg-video-sequence-frame-sample-rail="semantic"
      data-kg-video-sequence-frame-sample-count={samples.length}
      style={{ '--kg-video-sequence-frame-sample-count': samples.length } as React.CSSProperties}
    >
      {samples.map((sample, index) => (
        <li
          key={`frame-sample:${span.rowKey}:${sample.timestampSeconds}:${index}`}
          className="timeline-video-sequence-frame-sample"
          data-kg-video-sequence-frame-sample="1"
          data-kg-video-sequence-frame-sample-format={sample.format}
          data-kg-video-sequence-frame-sample-raster-format={sample.rasterFormat}
          data-kg-video-sequence-frame-sample-time={sample.timestampSeconds}
          data-kg-video-sequence-frame-sample-url={sample.dataUrl}
          style={{ '--kg-video-sequence-frame-sample-index': index } as React.CSSProperties}
        >
          <time dateTime={`PT${sample.timestampSeconds.toFixed(3)}S`}>
            {formatVideoSequenceTimelineSecondsOffset(sample.timestampSeconds)}
          </time>
        </li>
      ))}
    </ol>
  )
}
