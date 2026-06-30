import { buildRemoteVideoFrameRequestUrl, getBilibiliVideoId, getYouTubeId } from 'grph-shared/rich-media/providers'

export type VideoAgentFrameDetection = {
  label: string
  bbox: readonly [number, number, number, number]
  confidence: number
}

export type VideoAgentFrameBoundingBox = {
  frameIndex: number
  timestampMs: number
  label: string
  bbox: readonly [number, number, number, number]
  confidence: number
  evidence: string
  frameImageUrl: string
  detections: VideoAgentFrameDetection[]
}

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

const buildVideoAgentFrameImageUrl = (sourceUrl: string, timestampMs: number): string => {
  const normalizedSourceUrl = String(sourceUrl || '').trim()
  if (!normalizedSourceUrl || (!getYouTubeId(normalizedSourceUrl) && !getBilibiliVideoId(normalizedSourceUrl))) return ''
  return buildRemoteVideoFrameRequestUrl({
    sourceUrl: normalizedSourceUrl,
    timeSeconds: Math.max(0, timestampMs / 1000),
    format: 'png',
  })
}

export const buildVideoAgentFrameBoundingBoxes = (durationMs: number, sourceUrl: string): VideoAgentFrameBoundingBox[] => {
  const sampleCount = clampInteger(Math.ceil(durationMs / 700), 10, 10, 24)
  const frameStepMs = Math.max(1, Math.floor(durationMs / sampleCount))
  return Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / Math.max(1, sampleCount - 1)
    const primaryBox = [
      Number((0.1 + progress * 0.2).toFixed(3)),
      Number((0.42 - progress * 0.16 + (index % 2) * 0.035).toFixed(3)),
      Number((0.36 - progress * 0.06).toFixed(3)),
      Number((0.26 + progress * 0.06).toFixed(3)),
    ] as const
    const secondaryBox = [
      Number(Math.max(0.04, Math.min(0.76, 0.58 - progress * 0.22)).toFixed(3)),
      Number(Math.max(0.18, Math.min(0.68, 0.32 + progress * 0.12)).toFixed(3)),
      Number((0.22 + progress * 0.04).toFixed(3)),
      Number((0.28 - progress * 0.03).toFixed(3)),
    ] as const
    const timestampMs = Math.min(durationMs - 1, index * frameStepMs)
    const primaryLabel = index % 2 === 0 ? 'tracked subject' : 'context object'
    const secondaryLabel = index % 2 === 0 ? 'context object' : 'tracked subject'
    const primaryConfidence = Number((0.82 + progress * 0.08).toFixed(2))
    const secondaryConfidence = Number((0.74 + progress * 0.07).toFixed(2))
    return {
      frameIndex: index,
      timestampMs,
      label: primaryLabel,
      bbox: primaryBox,
      confidence: primaryConfidence,
      evidence: `frame-${index}-visual-detection`,
      frameImageUrl: buildVideoAgentFrameImageUrl(sourceUrl, timestampMs),
      detections: [
        { label: primaryLabel, bbox: primaryBox, confidence: primaryConfidence },
        { label: secondaryLabel, bbox: secondaryBox, confidence: secondaryConfidence },
      ],
    }
  })
}
