import {
  readVideoSequenceSourcePlayableUrl,
  resolveVideoSequenceTimelineLane,
  type VideoSequenceTimelineSource,
} from './videoSequenceTimeline'
import { resolveVideoSequenceSourceRuntimeUrl } from './videoSequenceSourceRegistry'
import { downloadBlob } from '@/lib/graph/save'
import type { MermaidGanttSourceRangeMinutes, MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { buildMermaidGanttTimelineModel, readMermaidGanttTaskSourceRangeMinutes } from '@/lib/mermaid/mermaidGanttBarInteraction'

export type VideoSequenceExportKind = 'video' | 'audio'

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

export type VideoSequenceSourceTimeResolution = {
  segment: VideoSequenceExportSegment
  sourceTimeSeconds: number
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

type VideoSequenceRenderSegment = VideoSequenceExportSegment & {
  gapSecondsBefore: number
  sourceEndSeconds: number
  sourceStartSeconds: number
  url: string
}

const VIDEO_EXPORT_WIDTH = 1280
const VIDEO_EXPORT_HEIGHT = 720
const VIDEO_EXPORT_FRAME_RATE = 30
const VIDEO_EXPORT_MIN_GAP_SECONDS = 0.05

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

export function buildVideoSequencePreviewSyncPlan(args: {
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

export function resolveVideoSequenceExportPositionSourceTime(args: {
  plan: VideoSequenceExportPlan | null
  positionMinutes: number
  source: VideoSequenceTimelineSource
  sourceDurationSeconds: number
}): VideoSequenceSourceTimeResolution | null {
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

export function resolveVideoSequenceExportSourceTimePosition(args: {
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

function selectMediaRecorderMimeType(candidates: readonly string[]): string {
  const recorder = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null
  if (!recorder || typeof recorder.isTypeSupported !== 'function') return candidates[candidates.length - 1] || ''
  return candidates.find(candidate => recorder.isTypeSupported(candidate)) || candidates[candidates.length - 1] || ''
}

function loadVideoMetadata(video: HTMLVideoElement, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
    }
    const onLoaded = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Unable to load source media.'))
    }
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('error', onError)
    video.src = url
    video.load()
  })
}

function seekVideo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise(resolve => {
    const target = Math.max(0, seconds)
    const done = () => {
      video.removeEventListener('seeked', done)
      resolve()
    }
    video.addEventListener('seeked', done, { once: true })
    video.currentTime = target
    window.setTimeout(done, 800)
  })
}

function waitForRecorderStop(recorder: MediaRecorder): Promise<BlobPart[]> {
  const chunks: BlobPart[] = []
  return new Promise((resolve, reject) => {
    recorder.addEventListener('dataavailable', event => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    })
    recorder.addEventListener('stop', () => resolve(chunks), { once: true })
    recorder.addEventListener('error', () => reject(new Error('Media export failed.')), { once: true })
  })
}

function drawVideoFrame(args: {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  segment: VideoSequenceExportSegment | null
  video: HTMLVideoElement | null
}): void {
  const { canvas, context, segment, video } = args
  context.save()
  context.fillStyle = '#05070a'
  context.fillRect(0, 0, canvas.width, canvas.height)
  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
    const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight)
    const width = video.videoWidth * scale
    const height = video.videoHeight * scale
    const x = (canvas.width - width) / 2
    const y = (canvas.height - height) / 2
    if (segment?.hasGrade) context.filter = 'contrast(1.08) saturate(1.16) brightness(1.03)'
    if (segment?.hasMask) {
      context.beginPath()
      context.ellipse(canvas.width / 2, canvas.height / 2, canvas.width * 0.43, canvas.height * 0.43, 0, 0, Math.PI * 2)
      context.clip()
    }
    context.drawImage(video, x, y, width, height)
    if (segment?.hasMask) {
      context.restore()
      context.save()
      context.fillStyle = 'rgba(0, 0, 0, 0.32)'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
  }
  context.restore()
}

async function recordGap(args: {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  seconds: number
}): Promise<void> {
  if (args.seconds <= VIDEO_EXPORT_MIN_GAP_SECONDS) return
  drawVideoFrame({ canvas: args.canvas, context: args.context, segment: null, video: null })
  await new Promise(resolve => window.setTimeout(resolve, args.seconds * 1000))
}

async function recordSegment(args: {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  segment: VideoSequenceRenderSegment
  video: HTMLVideoElement
}): Promise<void> {
  const { canvas, context, segment, video } = args
  await loadVideoMetadata(video, segment.url)
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
  const startSeconds = Math.max(0, Math.min(duration, segment.sourceStartSeconds))
  const endSeconds = Math.max(startSeconds, Math.min(duration, segment.sourceEndSeconds))
  await seekVideo(video, startSeconds)
  let raf = 0
  let stopped = false
  const drawLoop = () => {
    if (stopped) return
    drawVideoFrame({ canvas, context, segment, video })
    raf = window.requestAnimationFrame(drawLoop)
  }
  drawLoop()
  await video.play()
  await new Promise<void>(resolve => {
    const tick = () => {
      if (video.currentTime >= endSeconds || video.paused || video.ended) {
        resolve()
        return
      }
      window.setTimeout(tick, 30)
    }
    tick()
  })
  stopped = true
  if (raf) window.cancelAnimationFrame(raf)
  video.pause()
}

async function resolveRenderSegments(plan: VideoSequenceExportPlan): Promise<VideoSequenceRenderSegment[]> {
  let cursorMinutes = 0
  const secondsPerMinute = 1
  const out: VideoSequenceRenderSegment[] = []
  for (const segment of plan.segments) {
    const url = readVideoSequenceSourcePlayableUrl(segment.source) || resolveVideoSequenceSourceRuntimeUrl(segment.source)
    if (!url) throw new Error('Re-import the local source or import a playable URL before export.')
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.crossOrigin = 'anonymous'
    await loadVideoMetadata(probe, url)
    const duration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 0
    probe.removeAttribute('src')
    probe.load()
    const gapMinutes = Math.max(0, segment.timelineStartMinutes - cursorMinutes)
    out.push({
      ...segment,
      gapSecondsBefore: gapMinutes * secondsPerMinute,
      sourceEndSeconds: segment.sourceEndRatio * duration,
      sourceStartSeconds: segment.sourceStartRatio * duration,
      url,
    })
    cursorMinutes = Math.max(cursorMinutes, segment.timelineEndMinutes)
  }
  return out
}

export async function renderVideoSequenceExport(args: {
  kind: VideoSequenceExportKind
  plan: VideoSequenceExportPlan
}): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder export is not available in this browser.')
  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_EXPORT_WIDTH
  canvas.height = VIDEO_EXPORT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas export is not available in this browser.')
  const captureStream = canvas.captureStream?.bind(canvas)
  if (args.kind === 'video' && typeof captureStream !== 'function') throw new Error('Canvas video capture is not available in this browser.')
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.playsInline = true
  video.preload = 'auto'
  const audioContext = new AudioContext()
  const audioDestination = audioContext.createMediaStreamDestination()
  const audioSource = audioContext.createMediaElementSource(video)
  audioSource.connect(audioDestination)
  await audioContext.resume()
  const renderSegments = await resolveRenderSegments(args.plan)
  const mimeType = args.kind === 'audio'
    ? selectMediaRecorderMimeType(['audio/webm;codecs=opus', 'audio/webm'])
    : selectMediaRecorderMimeType(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'])
  const stream = args.kind === 'audio'
    ? audioDestination.stream
    : new MediaStream([
      ...canvas.captureStream(VIDEO_EXPORT_FRAME_RATE).getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ])
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunksPromise = waitForRecorderStop(recorder)
  recorder.start(250)
  try {
    for (const segment of renderSegments) {
      await recordGap({ canvas, context, seconds: segment.gapSecondsBefore })
      await recordSegment({ canvas, context, segment, video })
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop()
  }
  const chunks = await chunksPromise
  stream.getTracks().forEach(track => track.stop())
  audioSource.disconnect()
  await audioContext.close()
  video.removeAttribute('src')
  video.load()
  const outputType = mimeType || (args.kind === 'audio' ? 'audio/webm' : 'video/webm')
  return new Blob(chunks, { type: outputType })
}

export async function downloadVideoSequenceExport(args: {
  kind: VideoSequenceExportKind
  plan: VideoSequenceExportPlan
}): Promise<string> {
  const blob = await renderVideoSequenceExport(args)
  const filename = `${args.plan.filenameBase}.edited.${args.kind === 'audio' ? 'audio.webm' : 'video.webm'}`
  downloadBlob(blob, filename)
  return filename
}
