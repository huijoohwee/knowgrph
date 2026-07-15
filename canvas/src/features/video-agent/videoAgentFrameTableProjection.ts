import { formatMediaTimestampSeconds } from 'grph-shared/rich-media/providers'
import { serializeMarkdownPipeTable } from '@/features/markdown/ui/markdownDataViewSerialize'
import type { VideoAgentFrameBoundingBox } from './videoAgentPipeline'

const readArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const readFrameTranscriptTextByIndex = (value: unknown): Map<number, string> => {
  const out = new Map<number, string>()
  for (const item of readArray(value)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const frameIndex = Number(record.frameIndex)
    const text = String(record.text || '').replace(/\s+/g, ' ').trim()
    if (Number.isInteger(frameIndex) && text) out.set(frameIndex, text)
  }
  return out
}

const readObjectLabels = (frame: VideoAgentFrameBoundingBox): string => {
  const labels = Array.from(new Set([
    frame.label,
    ...(Array.isArray(frame.detections) ? frame.detections.map(detection => detection.label) : []),
  ].map(label => String(label || '').trim()).filter(Boolean)))
  return labels.join(', ') || 'No objects'
}

export type VideoAgentFrameTableRow = {
  frameIndex: number
  imageUrl: string
  objectLabels: string
  timeLabel: string
  timestampMs: number
  transcriptText: string
}

export function buildVideoAgentFrameTableRows(args: {
  frameBoundingBoxes: readonly VideoAgentFrameBoundingBox[]
  frameByFrameTranscript?: unknown
}): VideoAgentFrameTableRow[] {
  const transcriptByFrame = readFrameTranscriptTextByIndex(args.frameByFrameTranscript)
  return args.frameBoundingBoxes.map(frame => ({
    frameIndex: frame.frameIndex,
    imageUrl: String(frame.frameImageUrl || '').trim(),
    objectLabels: readObjectLabels(frame),
    timeLabel: formatMediaTimestampSeconds((frame.timestampMs || 0) / 1000),
    timestampMs: frame.timestampMs || 0,
    transcriptText: transcriptByFrame.get(frame.frameIndex) || '',
  }))
}

const escapeMarkdownImageUrl = (value: unknown): string => String(value ?? '').replace(/\)/g, '%29').trim()

export function buildVideoAgentFrameTableMarkdown(args: {
  frameBoundingBoxes: readonly VideoAgentFrameBoundingBox[]
  frameByFrameTranscript?: unknown
}): string {
  const rows = buildVideoAgentFrameTableRows(args)
  if (!rows.length) return ''
  const tableLines = serializeMarkdownPipeTable({
    columns: ['Time', 'Frame (Thumbnail)', '(Transcript) Text', 'Objects (identified in bounding box)'],
    rows: rows.map(row => {
      const thumbnail = row.imageUrl
        ? `![Frame ${row.frameIndex} thumbnail](${escapeMarkdownImageUrl(row.imageUrl)})`
        : 'No thumbnail'
      return [row.timeLabel, thumbnail, row.transcriptText, row.objectLabels]
    }),
  })
  return [
    '## Multi-dimensional Frame Table',
    '',
    ...tableLines,
  ].join('\n')
}
