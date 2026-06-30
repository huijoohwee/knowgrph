import type { TimelineMediaReaderThumbnail } from '@/components/timeline/timelineMediaReader'
import type { VideoAgentTimelineTrack } from '@/features/video-agent'
import { readMermaidGanttFrameSamples } from '@/lib/mermaid/mermaidGanttFrameThumbnailToken'

const hasDistinctNumbers = (values: readonly number[], minimum: number): boolean => (
  new Set(values).size >= minimum
)

export const assertProviderBackedTimelineFrameSamples = (
  frameTimelineTracks: readonly VideoAgentTimelineTrack[],
): void => {
  const timelineFrameSamples = frameTimelineTracks[0]?.frameSamples || []
  if (
    timelineFrameSamples.length < 3
    || !hasDistinctNumbers(timelineFrameSamples.map(sample => sample.timestampMs), 3)
    || timelineFrameSamples.some(sample => !String(sample.frameImageUrl || '').startsWith('/__video_frame?'))
    || frameTimelineTracks.some(track => String(track.thumbnailUrl || ''))
  ) {
    throw new Error(`expected provider-backed compact FBF transport to expose distinct source-frame samples without a single thumbnail shortcut, got ${JSON.stringify(frameTimelineTracks)}`)
  }
}

export const assertProviderFrameSampleToken = (
  rawGanttLine: string,
): void => {
  const tokenFrameSamples = readMermaidGanttFrameSamples(rawGanttLine)
  if (
    tokenFrameSamples.length < 3
    || !hasDistinctNumbers(tokenFrameSamples.map(sample => sample.timestampSeconds), 3)
    || tokenFrameSamples.some(sample => !sample.url.startsWith('/__video_frame?'))
  ) {
    throw new Error(`expected FBF Gantt token to preserve distinct source-frame sample URLs, got ${JSON.stringify(tokenFrameSamples)}`)
  }
}

export const assertProviderFrameThumbnails = (
  thumbnails: readonly TimelineMediaReaderThumbnail[],
): void => {
  if (
    thumbnails.length < 3
    || thumbnails.some(thumbnail => thumbnail.format !== 'png' || !String(thumbnail.dataUrl || '').startsWith('/__video_frame?'))
    || !hasDistinctNumbers(thumbnails.map(thumbnail => thumbnail.timestampSeconds), 3)
  ) {
    throw new Error(`expected compact FBF transport thumbnails to use distinct provider frame URLs, got ${JSON.stringify(thumbnails)}`)
  }
}
