import type { TimelineMediaReaderThumbnail } from './timelineMediaReader'
import type { VideoSequenceTimelineThumbnailWindow } from './VideoSequenceTimelineRuler'

const VIDEO_SEQUENCE_NATIVE_REEL_FALLBACK_MIN_COUNT = 3
const VIDEO_SEQUENCE_NATIVE_REEL_FALLBACK_MAX_COUNT = 12
const VIDEO_SEQUENCE_STALE_WINDOW_REEL_RATIO = 0.75

function resolveNearestNativeVideoReel(args: {
  sourceEndSeconds: number
  sourceStartSeconds: number
  sourceThumbnails: readonly TimelineMediaReaderThumbnail[]
}): readonly TimelineMediaReaderThumbnail[] {
  if (!args.sourceThumbnails.length) return []
  const sourceCenterSeconds = (args.sourceStartSeconds + args.sourceEndSeconds) / 2
  const fallbackCount = Math.min(
    args.sourceThumbnails.length,
    Math.max(VIDEO_SEQUENCE_NATIVE_REEL_FALLBACK_MIN_COUNT, Math.min(VIDEO_SEQUENCE_NATIVE_REEL_FALLBACK_MAX_COUNT, args.sourceThumbnails.length)),
  )
  return args.sourceThumbnails
    .map((thumbnail, index) => ({ index, thumbnail }))
    .sort((left, right) => {
      const distanceDelta = Math.abs(left.thumbnail.timestampSeconds - sourceCenterSeconds) - Math.abs(right.thumbnail.timestampSeconds - sourceCenterSeconds)
      if (distanceDelta !== 0) return distanceDelta
      return left.index - right.index
    })
    .slice(0, fallbackCount)
    .sort((left, right) => {
      const timestampDelta = left.thumbnail.timestampSeconds - right.thumbnail.timestampSeconds
      if (timestampDelta !== 0) return timestampDelta
      return left.index - right.index
    })
    .map(item => item.thumbnail)
}

function mergeNativeVideoReelSamples(args: {
  nearestThumbnails: readonly TimelineMediaReaderThumbnail[]
  windowThumbnails: readonly TimelineMediaReaderThumbnail[]
}): readonly TimelineMediaReaderThumbnail[] {
  const merged = [...args.windowThumbnails]
  for (const thumbnail of args.nearestThumbnails) {
    if (merged.length >= args.nearestThumbnails.length) break
    if (merged.includes(thumbnail)) continue
    merged.push(thumbnail)
  }
  return merged.sort((left, right) => left.timestampSeconds - right.timestampSeconds)
}

function shouldUseWholeNativeReelForStaleWindow(args: {
  sourceEndSeconds: number
  sourceStartSeconds: number
  sourceThumbnails: readonly TimelineMediaReaderThumbnail[]
  sourceWindow: VideoSequenceTimelineThumbnailWindow
}): boolean {
  if (args.sourceThumbnails.length <= VIDEO_SEQUENCE_NATIVE_REEL_FALLBACK_MAX_COUNT) return false
  const timelineDurationSeconds = Math.abs(args.sourceWindow.timelineEndMinutes - args.sourceWindow.timelineStartMinutes) * 60
  const sourceDuration = Math.max(0, args.sourceEndSeconds - args.sourceStartSeconds)
  const firstTimestamp = args.sourceThumbnails[0]?.timestampSeconds ?? 0
  const lastTimestamp = args.sourceThumbnails[args.sourceThumbnails.length - 1]?.timestampSeconds ?? firstTimestamp
  const thumbnailCoverage = Math.max(0, lastTimestamp - firstTimestamp)
  if (timelineDurationSeconds <= 0 || sourceDuration <= 0 || thumbnailCoverage <= 0) return false
  return (
    sourceDuration < timelineDurationSeconds * (1 - VIDEO_SEQUENCE_STALE_WINDOW_REEL_RATIO) &&
    thumbnailCoverage >= timelineDurationSeconds * VIDEO_SEQUENCE_STALE_WINDOW_REEL_RATIO
  )
}

export function resolveVideoSequenceClipThumbnails(args: {
  sourceWindow: VideoSequenceTimelineThumbnailWindow | null
  sourceThumbnails: readonly TimelineMediaReaderThumbnail[]
}): readonly TimelineMediaReaderThumbnail[] {
  if (!args.sourceThumbnails.length) return []
  const window = args.sourceWindow
  if (!window) return []
  const sourceStart = Math.min(window.sourceStartSeconds, window.sourceEndSeconds)
  const sourceEnd = Math.max(window.sourceStartSeconds, window.sourceEndSeconds)
  const withinWindow = args.sourceThumbnails.filter(thumbnail =>
    thumbnail.timestampSeconds >= sourceStart - 0.05 &&
    thumbnail.timestampSeconds <= sourceEnd + 0.05,
  )
  if (shouldUseWholeNativeReelForStaleWindow({ sourceEndSeconds: sourceEnd, sourceStartSeconds: sourceStart, sourceThumbnails: args.sourceThumbnails, sourceWindow: window })) {
    return args.sourceThumbnails
  }
  const nearestThumbnails = resolveNearestNativeVideoReel({
    sourceEndSeconds: sourceEnd,
    sourceStartSeconds: sourceStart,
    sourceThumbnails: args.sourceThumbnails,
  })
  if (withinWindow.length >= VIDEO_SEQUENCE_NATIVE_REEL_FALLBACK_MIN_COUNT || !withinWindow.length) {
    return withinWindow.length ? withinWindow : nearestThumbnails
  }
  return mergeNativeVideoReelSamples({ nearestThumbnails, windowThumbnails: withinWindow })
}
