import {
  readVideoSequenceSourcePlayableUrl,
  resolveVideoSequenceTimelineLane,
  type VideoSequenceTimelineSource,
} from './videoSequenceTimeline'
import { resolveVideoSequenceSourceRuntimeUrl } from './videoSequenceSourceRegistry'
import type { MermaidGanttSourceRangeMinutes, MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { buildMermaidGanttTimelineModel, readMermaidGanttTaskSourceRangeMinutes } from '@/lib/mermaid/mermaidGanttBarInteraction'

export type VideoSequenceExportSegment = {
  durationMinutes: number
  hasGrade: boolean
  hasMask: boolean
  label: string
  source: VideoSequenceTimelineSource
  sourceEndRatio: number
  sourceStartRatio: number
  timelineEndMinutes: number
  timelineStartMinutes: number
}

export type VideoSequenceExportPlan = {
  durationMinutes: number
  filenameBase: string
  segments: VideoSequenceExportSegment[]
}

export type TimelinePlanSourceTimeResolution = {
  segment: VideoSequenceExportSegment
  sourceTimeSeconds: number
}

export type TimelinePlanVideoMetadata = {
  durationSeconds: number
  url: string
}

type SourceSegmentDraft = {
  segmentKey: string
  sourceKey: string
  sourceRangeMinutes: MermaidGanttSourceRangeMinutes | null
  span: MermaidGanttTimelineTaskSpan
}

type SourceSegmentRange = SourceSegmentDraft & {
  sourceEndRatio: number
  sourceStartRatio: number
}

const clean = (value: unknown): string => String(value || '').trim()
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const stripExtension = (value: string): string => clean(value).replace(/\.[a-z0-9]+$/i, '')

const sanitizeFilenamePart = (value: unknown): string => {
  return (clean(value) || 'video-sequence')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'video-sequence'
}

const readGanttTaskTokens = (line: string): string[] => {
  const colonIndex = line.indexOf(':')
  if (colonIndex < 0) return []
  return line.slice(colonIndex + 1).split(',').map(token => token.trim()).filter(Boolean)
}

const readStableTaskId = (line: string): string => {
  return readGanttTaskTokens(line).find(token => {
    if (/^(?:active|done|crit|milestone|vert)$/i.test(token)) return false
    if (/^(?:\d{1,2}:\d{2}|\d+(?:\.\d+)?m)$/i.test(token)) return false
    if (/^(?:after|until)\b/i.test(token)) return false
    return true
  }) || ''
}

const normalizeSegmentKey = (value: string): string => {
  return clean(value).replace(/_(?:image|scene|mask|grade|effect|adjustment|transition|keyframe|filter|audio|speed)(?=_splice|$)/gi, '')
}

const normalizeSourceKey = (value: string): string => {
  return normalizeSegmentKey(value).replace(/(?:_splice)+$/i, '')
}

const sourceLookupKeys = (source: VideoSequenceTimelineSource): string[] => {
  return [
    source.id,
    source.originalName,
    stripExtension(source.originalName),
    source.relativePath.split('/').filter(Boolean).pop() || '',
    stripExtension(source.relativePath.split('/').filter(Boolean).pop() || ''),
  ].map(value => clean(value).toLowerCase()).filter(Boolean)
}

const sourceIdentityKeys = (source: VideoSequenceTimelineSource): string[] => {
  return [
    source.id,
    source.sourceUrl,
    source.workspacePath,
    source.relativePath,
    source.originalName,
  ].map(value => clean(value).toLowerCase()).filter(Boolean)
}

export function areVideoSequenceExportSourcesEqual(
  left: VideoSequenceTimelineSource,
  right: VideoSequenceTimelineSource,
): boolean {
  const leftKeys = new Set(sourceIdentityKeys(left))
  if (!leftKeys.size) return false
  return sourceIdentityKeys(right).some(key => leftKeys.has(key))
}

const findSourceForKey = (
  sources: readonly VideoSequenceTimelineSource[],
  sourceKey: string,
): VideoSequenceTimelineSource | null => {
  const key = clean(sourceKey).toLowerCase()
  if (!key) return sources[0] || null
  return sources.find(source => sourceLookupKeys(source).includes(key)) || sources[0] || null
}

const buildOperationSet = (spans: readonly MermaidGanttTimelineTaskSpan[], lane: 'mask' | 'grade'): Set<string> => {
  const out = new Set<string>()
  for (const span of spans) {
    if (resolveVideoSequenceTimelineLane(span) !== lane) continue
    const id = readStableTaskId(span.raw)
    const key = normalizeSegmentKey(id)
    if (key) out.add(key)
  }
  return out
}

const buildSourceSegmentsForLane = (
  spans: readonly MermaidGanttTimelineTaskSpan[],
  lane: ReturnType<typeof resolveVideoSequenceTimelineLane>,
): SourceSegmentDraft[] => {
  const out: SourceSegmentDraft[] = []
  for (const span of spans) {
    if (resolveVideoSequenceTimelineLane(span) !== lane) continue
    const segmentKey = normalizeSegmentKey(readStableTaskId(span.raw))
    const sourceKey = normalizeSourceKey(segmentKey)
    if (!segmentKey || !sourceKey) continue
    out.push({
      segmentKey,
      sourceKey,
      sourceRangeMinutes: readMermaidGanttTaskSourceRangeMinutes(span.raw),
      span,
    })
  }
  return out
}

function buildVideoSequencePlanFromSegments(args: {
  durationMinutes: number
  filenameHint?: string | null
  maskSegments: Set<string>
  gradeSegments: Set<string>
  sourceRangeMode?: 'sequence' | 'timeline'
  segments: readonly SourceSegmentDraft[]
  sources: readonly VideoSequenceTimelineSource[]
}): VideoSequenceExportPlan | null {
  if (!args.segments.length || !args.sources.length) return null
  const rangeMode = args.sourceRangeMode || 'sequence'
  const sourceDurationTotals = new Map<string, number>()
  for (const segment of args.segments) {
    sourceDurationTotals.set(segment.sourceKey, (sourceDurationTotals.get(segment.sourceKey) || 0) + Math.max(0, segment.span.durationMinutes))
  }
  const sourceCursor = new Map<string, number>()
  const sourceRanges = args.segments
    .slice()
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey) || a.span.lineIndex - b.span.lineIndex)
    .map((segment): SourceSegmentRange => {
      const duration = Math.max(0, segment.span.durationMinutes)
      if (segment.sourceRangeMinutes) {
        const durationMinutes = Math.max(0.0001, args.durationMinutes, segment.sourceRangeMinutes.endMinutes)
        return {
          ...segment,
          sourceEndRatio: clamp(segment.sourceRangeMinutes.endMinutes / durationMinutes, 0, 1),
          sourceStartRatio: clamp(segment.sourceRangeMinutes.startMinutes / durationMinutes, 0, 1),
        }
      }
      if (rangeMode === 'timeline') {
        const durationMinutes = Math.max(0.0001, args.durationMinutes)
        return {
          ...segment,
          sourceEndRatio: clamp(segment.span.endMinutes / durationMinutes, 0, 1),
          sourceStartRatio: clamp(segment.span.startMinutes / durationMinutes, 0, 1),
        }
      }
      const total = Math.max(duration, sourceDurationTotals.get(segment.sourceKey) || duration)
      const cursor = sourceCursor.get(segment.sourceKey) || 0
      sourceCursor.set(segment.sourceKey, cursor + duration)
      return {
        ...segment,
        sourceEndRatio: Math.min(1, (cursor + duration) / total),
        sourceStartRatio: Math.max(0, cursor / total),
      }
    })
  const segments = sourceRanges
    .sort((a, b) => a.span.startMinutes - b.span.startMinutes || a.span.lineIndex - b.span.lineIndex)
    .flatMap(segment => {
      const source = findSourceForKey(args.sources, segment.sourceKey)
      if (!source) return []
      const duration = Math.max(0, segment.span.durationMinutes)
      return [{
        durationMinutes: duration,
        hasGrade: args.gradeSegments.has(segment.segmentKey),
        hasMask: args.maskSegments.has(segment.segmentKey),
        label: segment.span.label,
        source,
        sourceEndRatio: segment.sourceEndRatio,
        sourceStartRatio: segment.sourceStartRatio,
        timelineEndMinutes: segment.span.endMinutes,
        timelineStartMinutes: segment.span.startMinutes,
      }]
    })
  if (!segments.length) return null
  const firstSource = segments[0]?.source
  return {
    durationMinutes: Math.max(0, args.durationMinutes),
    filenameBase: sanitizeFilenamePart(args.filenameHint || firstSource?.originalName || firstSource?.relativePath || 'video-sequence'),
    segments,
  }
}

export function resolveTimelinePlanSourceUrl(source: VideoSequenceTimelineSource): string {
  return readVideoSequenceSourcePlayableUrl(source) || resolveVideoSequenceSourceRuntimeUrl(source) || ''
}

export function buildVideoSequenceExportPlan(args: {
  code: string
  sources: readonly VideoSequenceTimelineSource[]
  filenameHint?: string | null
}): VideoSequenceExportPlan | null {
  const model = buildMermaidGanttTimelineModel(args.code)
  if (!model.taskSpans.length || !args.sources.length) return null
  return buildVideoSequencePlanFromSegments({
    durationMinutes: model.durationMinutes,
    filenameHint: args.filenameHint,
    gradeSegments: buildOperationSet(model.taskSpans, 'grade'),
    maskSegments: buildOperationSet(model.taskSpans, 'mask'),
    segments: buildSourceSegmentsForLane(model.taskSpans, 'video'),
    sources: args.sources,
  })
}

export function buildTimelinePreviewSyncPlan(args: {
  code: string
  selectedRowKey?: string | null
  sources: readonly VideoSequenceTimelineSource[]
  filenameHint?: string | null
}): VideoSequenceExportPlan | null {
  const model = buildMermaidGanttTimelineModel(args.code)
  if (!model.taskSpans.length || !args.sources.length) return null
  const selectedSpan = args.selectedRowKey
    ? model.taskSpans.find(span => span.rowKey === args.selectedRowKey)
    : null
  const selectedLane = selectedSpan ? resolveVideoSequenceTimelineLane(selectedSpan) : 'video'
  const selectedLaneSegments = buildSourceSegmentsForLane(model.taskSpans, selectedLane)
  const segments = selectedLaneSegments.length ? selectedLaneSegments : buildSourceSegmentsForLane(model.taskSpans, 'video')
  return buildVideoSequencePlanFromSegments({
    durationMinutes: model.durationMinutes,
    filenameHint: args.filenameHint,
    gradeSegments: buildOperationSet(model.taskSpans, 'grade'),
    maskSegments: buildOperationSet(model.taskSpans, 'mask'),
    sourceRangeMode: 'timeline',
    segments,
    sources: args.sources,
  })
}

export function resolveTimelinePlanSourceTimeAtPosition(args: {
  plan: VideoSequenceExportPlan | null
  positionMinutes: number
  source: VideoSequenceTimelineSource
  sourceDurationSeconds: number
}): TimelinePlanSourceTimeResolution | null {
  if (!args.plan?.segments.length || args.sourceDurationSeconds <= 0) return null
  const positionMinutes = Math.max(0, args.positionMinutes)
  const candidates = args.plan.segments
    .filter(segment => areVideoSequenceExportSourcesEqual(segment.source, args.source))
    .filter(segment => segment.durationMinutes > 0)
    .map(segment => {
      const boundedPosition = clamp(positionMinutes, segment.timelineStartMinutes, segment.timelineEndMinutes)
      const distance = Math.abs(positionMinutes - boundedPosition)
      const contains = distance < 0.0001
      return { boundedPosition, contains, distance, segment }
    })
    .sort((a, b) => {
      const aExactStart = Math.abs(positionMinutes - a.segment.timelineStartMinutes) < 0.0001 ? 0 : 1
      const bExactStart = Math.abs(positionMinutes - b.segment.timelineStartMinutes) < 0.0001 ? 0 : 1
      return Number(b.contains) - Number(a.contains)
        || a.distance - b.distance
        || aExactStart - bExactStart
        || a.segment.timelineStartMinutes - b.segment.timelineStartMinutes
    })
  const candidate = candidates[0]
  if (!candidate) return null
  const { boundedPosition, segment } = candidate
  const timelineRatio = clamp(
    (boundedPosition - segment.timelineStartMinutes) / Math.max(segment.durationMinutes, 0.0001),
    0,
    1,
  )
  const sourceRatio = segment.sourceStartRatio + (segment.sourceEndRatio - segment.sourceStartRatio) * timelineRatio
  return {
    segment,
    sourceTimeSeconds: clamp(sourceRatio, 0, 1) * args.sourceDurationSeconds,
  }
}

export function resolveTimelinePlanPositionFromSourceTime(args: {
  currentTimeSeconds: number
  plan: VideoSequenceExportPlan | null
  preferredPositionMinutes?: number
  source: VideoSequenceTimelineSource
  sourceDurationSeconds: number
}): number | null {
  if (!args.plan?.segments.length || args.sourceDurationSeconds <= 0) return null
  const sourceRatio = clamp(args.currentTimeSeconds / args.sourceDurationSeconds, 0, 1)
  const candidates = args.plan.segments
    .filter(segment => areVideoSequenceExportSourcesEqual(segment.source, args.source))
    .filter(segment => segment.durationMinutes > 0 && segment.sourceEndRatio >= segment.sourceStartRatio)
    .map(segment => {
      const minRatio = Math.min(segment.sourceStartRatio, segment.sourceEndRatio)
      const maxRatio = Math.max(segment.sourceStartRatio, segment.sourceEndRatio)
      const boundedSourceRatio = clamp(sourceRatio, minRatio, maxRatio)
      const ratioSpan = Math.max(0.0001, segment.sourceEndRatio - segment.sourceStartRatio)
      const segmentRatio = clamp((boundedSourceRatio - segment.sourceStartRatio) / ratioSpan, 0, 1)
      const positionMinutes = segment.timelineStartMinutes + segment.durationMinutes * segmentRatio
      const distance = Math.abs(sourceRatio - boundedSourceRatio)
      const contains = distance < 0.0001
      const preferredDistance = typeof args.preferredPositionMinutes === 'number'
        ? Math.abs(positionMinutes - args.preferredPositionMinutes)
        : 0
      return { contains, distance, positionMinutes, preferredDistance }
    })
    .sort((a, b) =>
      Number(b.contains) - Number(a.contains)
      || a.distance - b.distance
      || a.preferredDistance - b.preferredDistance
      || a.positionMinutes - b.positionMinutes,
    )
  return candidates[0]?.positionMinutes ?? null
}

export function loadTimelinePlanVideoMetadata(args: {
  url: string
  video: HTMLVideoElement
  timeoutMs?: number
}): Promise<number> {
  if (!args.video || typeof document === 'undefined') return Promise.resolve(0)
  const timeoutMs = typeof args.timeoutMs === 'number' && args.timeoutMs > 0 ? args.timeoutMs : 0
  return new Promise(resolve => {
    const { video } = args
    let finished = false
    let timeoutId = 0
    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
    }
    const finish = (durationSeconds: number) => {
      if (finished) return
      finished = true
      cleanup()
      resolve(durationSeconds)
    }
    const onLoaded = () => {
      finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0)
    }
    const onError = () => {
      finish(0)
    }
    video.preload = 'metadata'
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('error', onError)
    if (timeoutMs > 0) {
      timeoutId = window.setTimeout(() => {
        finish(0)
      }, timeoutMs)
    }
    video.src = args.url
    video.load()
  })
}

async function readTimelinePlanSourceMetadata(source: VideoSequenceTimelineSource): Promise<TimelinePlanVideoMetadata | null> {
  const url = resolveTimelinePlanSourceUrl(source)
  if (!url || typeof document === 'undefined') return null
  const probe = document.createElement('video')
  probe.preload = 'metadata'
  const durationSeconds = await loadTimelinePlanVideoMetadata({
    url,
    video: probe,
    timeoutMs: 3000,
  })
  if (!durationSeconds) {
    probe.removeAttribute('src')
    probe.load()
    return null
  }
  return { durationSeconds, url }
}

export async function resolveTimelinePlanDurationSeconds(plan: VideoSequenceExportPlan | null): Promise<number> {
  if (!plan?.segments.length || typeof document === 'undefined') return 0
  const sourceMetadataByUrl = new Map<string, TimelinePlanVideoMetadata | null>()
  let totalSeconds = 0
  for (const segment of plan.segments) {
    const url = resolveTimelinePlanSourceUrl(segment.source)
    if (!url) return 0
    let sourceMetadata = sourceMetadataByUrl.get(url)
    if (typeof sourceMetadata === 'undefined') {
      sourceMetadata = await readTimelinePlanSourceMetadata(segment.source)
      sourceMetadataByUrl.set(url, sourceMetadata)
    }
    if (!sourceMetadata?.durationSeconds) return 0
    totalSeconds += Math.max(0, segment.sourceEndRatio - segment.sourceStartRatio) * sourceMetadata.durationSeconds
  }
  return totalSeconds
}
