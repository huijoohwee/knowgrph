import type { VideoSequenceTimelineSourceThumbnailSet } from './VideoSequenceTimelineRuler'
import type { VideoSequenceTimelineLaneId } from './videoSequenceTimeline'
import type { MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { readGanttTaskTokens } from '@/lib/mermaid/mermaidGanttTimelineModel'

const normalizeSourceThumbnailLabel = (value: unknown): string => String(value || '')
  .toLowerCase()
  .replace(/\.(?:avif|gif|jpe?g|png|svg|webp|mp4|mov|m4v|webm)(?=\s|$)/g, '')
  .replace(/\b(?:source|image|scene|video|media)\b/g, ' ')
  .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
  .trim()

const isGenericSourcePlaceholderSpan = (span: MermaidGanttTimelineTaskSpan): boolean => {
  const label = String(span.label || '').trim().toLowerCase()
  return /^source\s+(?:image|scene|video)$/.test(label)
}

export const normalizeSourceThumbnailId = (value: unknown): string => String(value || '')
  .trim()
  .replace(/_(?:image|scene|mask|grade|effect|adjustment|transition|keyframe|filter|audio|speed)(?=(?:_splice|_split_left|_split_right|_copy)*$|$)/gi, '')
  .replace(/(?:_(?:splice|split_left|split_right|copy))+$/gi, '')

export function readVideoSequenceSpanStableSourceId(span: MermaidGanttTimelineTaskSpan): string {
  return normalizeSourceThumbnailId(readGanttTaskTokens(span.raw).find(token =>
    !/^kgsrc_/i.test(token) &&
    !/^kgpos_/i.test(token) &&
    !/^\d+(?:\.\d+)?m$/i.test(token) &&
    !/^(?:active|done|crit|milestone|vert)$/i.test(token) &&
    !/^after\b/i.test(token) &&
    !/^until\b/i.test(token),
  ))
}

export function resolveVideoSequenceSourceThumbnailSet(args: {
  lane: VideoSequenceTimelineLaneId
  sets: readonly VideoSequenceTimelineSourceThumbnailSet[]
  span: MermaidGanttTimelineTaskSpan
}): VideoSequenceTimelineSourceThumbnailSet | null {
  const expectedKind = args.lane === 'image' || args.lane === 'scene' ? 'image' : args.lane === 'video' || args.lane === 'audio' ? 'video' : null
  if (!expectedKind) return null
  const candidates = args.sets.filter(set => set.kind === expectedKind && (args.lane === 'audio' ? set.sourceAudioWaveformSamples.length || set.sourceThumbnails.length : set.sourceThumbnails.length || ((expectedKind === 'image' || expectedKind === 'video') && !!set.sourceUrl)))
  if (!candidates.length) return null
  const spanSourceId = readVideoSequenceSpanStableSourceId(args.span)
  if (isGenericSourcePlaceholderSpan(args.span)) return null
  const idMatched = candidates.find(set => {
    const setSourceId = normalizeSourceThumbnailId(set.sourceId)
    return !!setSourceId && !!spanSourceId && setSourceId === spanSourceId
  })
  if (idMatched) return idMatched
  const spanLabel = normalizeSourceThumbnailLabel(args.span.label)
  const matched = candidates.find(set => {
    const setLabel = normalizeSourceThumbnailLabel(set.label || set.sourceUrl)
    return !!setLabel && !!spanLabel && (spanLabel.includes(setLabel) || setLabel.includes(spanLabel))
  })
  return matched || (candidates.length === 1 ? candidates[0] : null)
}
