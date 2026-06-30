import type { VideoAgentFrameBoundingBox } from './videoAgentFrameBoxes'

export type VideoAgentTimelineFrameSample = {
  bbox: VideoAgentFrameBoundingBox['bbox']
  confidence: number
  frameImageUrl: string
  frameIndex: number
  timestampMs: number
  timestampSeconds: number
}

const VIDEO_AGENT_TIMELINE_FRAME_SAMPLE_MAX_COUNT = 80

const selectTimelineFrameSamples = (
  frameBoundingBoxes: readonly VideoAgentFrameBoundingBox[],
): readonly VideoAgentFrameBoundingBox[] => {
  if (frameBoundingBoxes.length <= VIDEO_AGENT_TIMELINE_FRAME_SAMPLE_MAX_COUNT) return frameBoundingBoxes
  const maxIndex = frameBoundingBoxes.length - 1
  const out: VideoAgentFrameBoundingBox[] = []
  const seenFrameIndexes = new Set<number>()
  for (let index = 0; index < VIDEO_AGENT_TIMELINE_FRAME_SAMPLE_MAX_COUNT; index += 1) {
    const sourceIndex = Math.round((index / Math.max(1, VIDEO_AGENT_TIMELINE_FRAME_SAMPLE_MAX_COUNT - 1)) * maxIndex)
    const sample = frameBoundingBoxes[sourceIndex]
    if (!sample || seenFrameIndexes.has(sample.frameIndex)) continue
    seenFrameIndexes.add(sample.frameIndex)
    out.push(sample)
  }
  return out
}

export const buildVideoAgentTimelineFrameSamples = (
  frameBoundingBoxes: readonly VideoAgentFrameBoundingBox[],
): readonly VideoAgentTimelineFrameSample[] => (
  selectTimelineFrameSamples(frameBoundingBoxes).map(box => ({
    bbox: box.bbox,
    confidence: box.confidence,
    frameImageUrl: box.frameImageUrl,
    frameIndex: box.frameIndex,
    timestampMs: box.timestampMs,
    timestampSeconds: Number((box.timestampMs / 1000).toFixed(3)),
  }))
)
