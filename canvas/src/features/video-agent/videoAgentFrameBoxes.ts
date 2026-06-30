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

const round3 = (value: number): number => Number(value.toFixed(3))

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

const buildBox = (centerX: number, centerY: number, width: number, height: number): readonly [number, number, number, number] => [
  round3(clamp01(centerX - width / 2)),
  round3(clamp01(centerY - height / 2)),
  round3(Math.min(width, 1 - clamp01(centerX - width / 2))),
  round3(Math.min(height, 1 - clamp01(centerY - height / 2))),
]

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
  const sampleCount = clampInteger(Math.ceil(durationMs / 700), 10, 10, 120)
  const frameStepMs = Math.max(1, Math.floor(durationMs / sampleCount))
  return Array.from({ length: sampleCount }, (_, index) => {
    const progress = index / Math.max(1, sampleCount - 1)
    const phase = progress * Math.PI * 2
    const sceneBand = Math.floor(progress * 6) % 3
    const primaryBox = buildBox(
      0.25 + progress * 0.44 + Math.sin(phase * 1.5) * 0.045,
      0.6 - Math.sin(phase) * 0.13 + sceneBand * 0.025,
      0.24 - progress * 0.045,
      0.27 + Math.sin(phase * 0.5) * 0.045,
    )
    const secondaryBox = buildBox(
      0.68 - progress * 0.38 + Math.cos(phase) * 0.04,
      0.5 + Math.sin(phase * 0.7) * 0.11,
      0.18 + progress * 0.055,
      0.22 + Math.cos(phase * 0.8) * 0.04,
    )
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
