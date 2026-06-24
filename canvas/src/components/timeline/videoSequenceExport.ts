import {
  buildVideoSequenceExportPlan,
  loadTimelinePlanVideoMetadata,
  resolveTimelinePlanSourceUrl,
  type VideoSequenceExportPlan,
  type VideoSequenceExportSegment,
} from './timelinePlanSync'
import { downloadBlob } from '@/lib/graph/save'

export type {
  VideoSequenceExportPlan,
  VideoSequenceExportSegment,
} from './timelinePlanSync'

export type VideoSequenceExportKind = 'video' | 'audio'
export type VideoSequenceExportProgressPhase = 'preparing' | 'rendering' | 'finalizing'
export type VideoSequenceExportErrorCode =
  | 'aborted'
  | 'capability-audio-context'
  | 'capability-canvas-capture'
  | 'capability-canvas-export'
  | 'capability-media-recorder'
  | 'plan-empty'
  | 'plan-non-renderable'
  | 'runtime-failed'
  | 'source-load-failed'
  | 'source-unavailable'
export type VideoSequenceExportOutcomeStatus = 'cancelled' | 'downloaded' | 'failed'
export type VideoSequenceExportProgress = {
  completedSegments: number
  kind: VideoSequenceExportKind
  label: string
  percentage: number
  phase: VideoSequenceExportProgressPhase
  totalSegments: number
}
export type VideoSequenceExportDownloadResult = {
  byteSize: number
  filename: string
  kind: VideoSequenceExportKind
  mimeType: string
}
export type VideoSequenceExportOutcome = {
  errorCode: VideoSequenceExportErrorCode | ''
  filename: string
  kind: VideoSequenceExportKind
  message: string
  status: VideoSequenceExportOutcomeStatus
  toastKind: 'error' | 'neutral' | 'success'
}
export type VideoSequenceExportSessionStatus = 'running' | VideoSequenceExportOutcomeStatus
export type VideoSequenceExportSessionRecord = {
  completedSegments: number
  errorCode: VideoSequenceExportErrorCode | ''
  filename: string
  filenameBase: string
  kind: VideoSequenceExportKind
  message: string
  percentage: number
  phase: VideoSequenceExportProgressPhase | ''
  retryOfRunId: string
  runId: string
  startedAtMs: number
  status: VideoSequenceExportSessionStatus
  toastKind: 'error' | 'neutral' | 'success'
  totalSegments: number
  updatedAtMs: number
}
export type VideoSequenceExportRetryRequest = {
  kind: VideoSequenceExportKind
  plan: VideoSequenceExportPlan
  retryOfRunId: string
}
export type VideoSequenceExportRetryControl = {
  ariaLabel: string
  disabled: boolean
  kind: VideoSequenceExportKind | ''
  title: string
}
export type VideoSequenceExportSessionSurfaceItem = {
  detailLabel: string
  kind: VideoSequenceExportKind
  message: string
  retryButtonLabel: string
  retryButtonTitle: string
  retryable: boolean
  runId: string
  styleMode: 'active' | 'muted' | 'solid'
  styleTone: 'danger' | 'neutral' | 'success'
  status: VideoSequenceExportSessionStatus
  tone: 'error' | 'neutral' | 'success'
}
export type VideoSequenceExportSessionSurfaceModel = {
  emptyLabel: string
  items: VideoSequenceExportSessionSurfaceItem[]
}
export type VideoSequenceExportSessionSurfaceSelection = {
  sessions: VideoSequenceExportSessionRecord[]
}
export type VideoSequenceExportEvent =
  | {
    eventType: 'outcome'
    kind: VideoSequenceExportKind
    message: string
    outcome: VideoSequenceExportOutcome
    status: VideoSequenceExportOutcomeStatus
    toastKind: 'error' | 'neutral' | 'success'
  }
  | {
    eventType: 'progress'
    kind: VideoSequenceExportKind
    message: string
    percentage: number
    phase: VideoSequenceExportProgressPhase
    progress: VideoSequenceExportProgress
  }

type MediaRecorderConstructorLike = {
  isTypeSupported?: (mimeType: string) => boolean
} | null | undefined

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
const VIDEO_SEQUENCE_EXPORT_SESSION_HISTORY_LIMIT = 6
const VIDEO_SEQUENCE_EXPORT_ERROR_MESSAGES: Record<VideoSequenceExportErrorCode, string> = {
  aborted: 'Edited media export cancelled.',
  'capability-audio-context': 'Web Audio export is not available in this browser.',
  'capability-canvas-capture': 'Canvas video capture is not available in this browser.',
  'capability-canvas-export': 'Canvas export is not available in this browser.',
  'capability-media-recorder': 'MediaRecorder export is not available in this browser.',
  'plan-empty': 'Edited media export requires at least one video segment.',
  'plan-non-renderable': 'Edited media export requires at least one positive-duration source range.',
  'runtime-failed': 'Edited media export failed.',
  'source-load-failed': 'Unable to load source media.',
  'source-unavailable': 'Re-import the local source or import a playable URL before export.',
}

const clean = (value: unknown): string => String(value || '').trim()
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export {
  areVideoSequenceExportSourcesEqual,
  buildVideoSequenceExportPlan,
  buildTimelinePreviewSyncPlan,
  resolveTimelinePlanPositionFromSourceTime,
  resolveTimelinePlanSourceTimeAtPosition,
  type TimelinePlanSourceTimeResolution,
} from './timelinePlanSync'

type VideoSequenceExportError = Error & {
  code?: VideoSequenceExportErrorCode
}

function isVideoSequenceExportErrorCode(value: unknown): value is VideoSequenceExportErrorCode {
  return typeof value === 'string' && value in VIDEO_SEQUENCE_EXPORT_ERROR_MESSAGES
}

function createVideoSequenceExportError(code: VideoSequenceExportErrorCode, message?: string): Error {
  const error = new Error(message || VIDEO_SEQUENCE_EXPORT_ERROR_MESSAGES[code]) as VideoSequenceExportError
  error.name = 'VideoSequenceExportError'
  error.code = code
  return error
}

export function resolveVideoSequenceExportErrorMessage(code: VideoSequenceExportErrorCode): string {
  return VIDEO_SEQUENCE_EXPORT_ERROR_MESSAGES[code]
}

export function resolveVideoSequenceExportErrorCode(error: unknown): VideoSequenceExportErrorCode | '' {
  if (error instanceof Error) {
    const exportError = error as VideoSequenceExportError
    if (isVideoSequenceExportErrorCode(exportError.code)) return exportError.code
    const message = clean(error.message)
    const matchedEntry = Object.entries(VIDEO_SEQUENCE_EXPORT_ERROR_MESSAGES)
      .find(([, candidate]) => candidate === message)
    if (matchedEntry) return matchedEntry[0] as VideoSequenceExportErrorCode
  }
  return ''
}

export function resolveVideoSequenceExportErrorFeedback(error: unknown): {
  kind: 'error' | 'neutral'
  message: string
} {
  const code = resolveVideoSequenceExportErrorCode(error)
  if (code === 'aborted') {
    return {
      kind: 'neutral',
      message: resolveVideoSequenceExportErrorMessage(code),
    }
  }
  if (code) {
    return {
      kind: 'error',
      message: resolveVideoSequenceExportErrorMessage(code),
    }
  }
  return {
    kind: 'error',
    message: clean(error instanceof Error ? error.message : '') || resolveVideoSequenceExportErrorMessage('runtime-failed'),
  }
}

export function resolveVideoSequenceExportOutcome(args: {
  error?: unknown
  kind: VideoSequenceExportKind
  result?: VideoSequenceExportDownloadResult | null
}): VideoSequenceExportOutcome {
  if (args.result) {
    return {
      errorCode: '',
      filename: args.result.filename,
      kind: args.kind,
      message: `Downloaded ${args.result.filename}`,
      status: 'downloaded',
      toastKind: 'success',
    }
  }
  const code = resolveVideoSequenceExportErrorCode(args.error)
  const feedback = resolveVideoSequenceExportErrorFeedback(args.error)
  return {
    errorCode: code,
    filename: '',
    kind: args.kind,
    message: feedback.message,
    status: code === 'aborted' ? 'cancelled' : 'failed',
    toastKind: feedback.kind === 'neutral' ? 'neutral' : 'error',
  }
}

export function resolveVideoSequenceExportEvent(args: {
  outcome?: VideoSequenceExportOutcome | null
  progress?: VideoSequenceExportProgress | null
}): VideoSequenceExportEvent {
  if (args.progress) {
    return {
      eventType: 'progress',
      kind: args.progress.kind,
      message: args.progress.label,
      percentage: args.progress.percentage,
      phase: args.progress.phase,
      progress: args.progress,
    }
  }
  const outcome = args.outcome || resolveVideoSequenceExportOutcome({
    error: new Error(resolveVideoSequenceExportErrorMessage('runtime-failed')),
    kind: 'video',
  })
  return {
    eventType: 'outcome',
    kind: outcome.kind,
    message: outcome.message,
    outcome,
    status: outcome.status,
    toastKind: outcome.toastKind,
  }
}

export function createVideoSequenceExportSessionRecord(args: {
  filenameBase: string
  kind: VideoSequenceExportKind
  nowMs?: number
  retryOfRunId?: string
  runId?: string
  totalSegments: number
}): VideoSequenceExportSessionRecord {
  const startedAtMs = Math.max(0, Math.floor(args.nowMs ?? Date.now()))
  const progress = buildVideoSequenceExportProgress({
    completedSegments: 0,
    kind: args.kind,
    phase: 'preparing',
    totalSegments: args.totalSegments,
  })
  const filenameBase = clean(args.filenameBase) || 'edited-media'
  return {
    completedSegments: progress.completedSegments,
    errorCode: '',
    filename: '',
    filenameBase,
    kind: args.kind,
    message: progress.label,
    percentage: progress.percentage,
    phase: progress.phase,
    retryOfRunId: clean(args.retryOfRunId),
    runId: args.runId || `${args.kind}:${filenameBase}:${startedAtMs}`,
    startedAtMs,
    status: 'running',
    toastKind: 'neutral',
    totalSegments: progress.totalSegments,
    updatedAtMs: startedAtMs,
  }
}

export function reduceVideoSequenceExportSessionRecord(args: {
  event: VideoSequenceExportEvent
  nowMs?: number
  session: VideoSequenceExportSessionRecord
}): VideoSequenceExportSessionRecord {
  const updatedAtMs = Math.max(args.session.startedAtMs, Math.floor(args.nowMs ?? Date.now()))
  if (args.event.eventType === 'progress') {
    return {
      ...args.session,
      completedSegments: args.event.progress.completedSegments,
      kind: args.event.kind,
      message: args.event.message,
      percentage: args.event.percentage,
      phase: args.event.phase,
      status: 'running',
      toastKind: 'neutral',
      totalSegments: args.event.progress.totalSegments,
      updatedAtMs,
    }
  }
  return {
    ...args.session,
    errorCode: args.event.outcome.errorCode,
    filename: args.event.outcome.filename,
    kind: args.event.kind,
    message: args.event.message,
    percentage: args.session.status === 'running' ? 100 : args.session.percentage,
    phase: args.session.phase,
    status: args.event.status,
    toastKind: args.event.toastKind,
    updatedAtMs,
  }
}

export function upsertVideoSequenceExportSessionHistory(args: {
  history: readonly VideoSequenceExportSessionRecord[]
  limit?: number
  nextSession: VideoSequenceExportSessionRecord
}): VideoSequenceExportSessionRecord[] {
  const limit = Math.max(1, Math.floor(args.limit ?? VIDEO_SEQUENCE_EXPORT_SESSION_HISTORY_LIMIT))
  const withoutCurrent = args.history.filter(session => session.runId !== args.nextSession.runId)
  return [args.nextSession, ...withoutCurrent].slice(0, limit)
}

export function resolveVideoSequenceExportRetryError(args: {
  exportingKind?: VideoSequenceExportKind | ''
  plan: VideoSequenceExportPlan | null | undefined
  session: VideoSequenceExportSessionRecord | null | undefined
}): string {
  if (args.exportingKind) return 'Wait for the current edited media export to finish before retrying.'
  if (!args.session) return 'Edited media export retry requires a previous export session.'
  if (args.session.status === 'running') return 'Wait for the current edited media export to finish before retrying.'
  if (!args.plan) return 'Edited media export retry requires a current export plan.'
  const planError = resolveVideoSequenceExportPlanError(args.plan)
  if (planError) return planError
  if (clean(args.plan.filenameBase) !== clean(args.session.filenameBase)) {
    return 'Edited media export retry requires the same compiled export plan as the previous run.'
  }
  return ''
}

export function resolveVideoSequenceExportRetryRequest(args: {
  exportingKind?: VideoSequenceExportKind | ''
  plan: VideoSequenceExportPlan | null | undefined
  session: VideoSequenceExportSessionRecord | null | undefined
}): {
  error: string
  request: VideoSequenceExportRetryRequest | null
} {
  const error = resolveVideoSequenceExportRetryError(args)
  if (error || !args.plan || !args.session) {
    return {
      error,
      request: null,
    }
  }
  return {
    error: '',
    request: {
      kind: args.session.kind,
      plan: args.plan,
      retryOfRunId: args.session.runId,
    },
  }
}

export function resolveVideoSequenceExportRetryControl(
  session: VideoSequenceExportSessionRecord | null | undefined,
): VideoSequenceExportRetryControl {
  if (!session) {
    return {
      ariaLabel: 'Retry latest edited media export',
      disabled: true,
      kind: '',
      title: 'Retry latest edited media export',
    }
  }
  const target = session.kind === 'audio' ? 'audio' : 'video'
  return {
    ariaLabel: `Retry edited ${target} export`,
    disabled: false,
    kind: session.kind,
    title: `Retry edited ${target} export`,
  }
}

function resolveVideoSequenceExportSessionKindLabel(kind: VideoSequenceExportKind): string {
  return kind === 'audio' ? 'Edited audio' : 'Edited video'
}

function resolveVideoSequenceExportSessionStatusLabel(status: VideoSequenceExportSessionStatus): string {
  if (status === 'running') return 'Running'
  if (status === 'downloaded') return 'Downloaded'
  if (status === 'cancelled') return 'Cancelled'
  return 'Failed'
}

export function resolveVideoSequenceExportSessionToneStyle(args: {
  status: VideoSequenceExportSessionStatus
  tone: VideoSequenceExportSessionRecord['toastKind']
}): {
  styleMode: VideoSequenceExportSessionSurfaceItem['styleMode']
  styleTone: VideoSequenceExportSessionSurfaceItem['styleTone']
} {
  if (args.status === 'running') {
    return {
      styleMode: 'active',
      styleTone: 'neutral',
    }
  }
  if (args.status === 'cancelled') {
    return {
      styleMode: 'muted',
      styleTone: 'neutral',
    }
  }
  if (args.tone === 'success') {
    return {
      styleMode: 'solid',
      styleTone: 'success',
    }
  }
  return {
    styleMode: 'solid',
    styleTone: 'danger',
  }
}

export function selectVideoSequenceExportSessionSurfaceSessions(args: {
  includeStatuses?: readonly VideoSequenceExportSessionStatus[]
  latestRetryableRunId?: string
  maxItems?: number
  sessions: readonly VideoSequenceExportSessionRecord[]
}): VideoSequenceExportSessionSurfaceSelection {
  const maxItems = Math.max(1, Math.floor(args.maxItems ?? 3))
  const allowedStatuses = new Set((args.includeStatuses || []).filter(Boolean))
  const hasStatusFilter = allowedStatuses.size > 0
  const latestRetryableRunId = clean(args.latestRetryableRunId)
  const filtered = args.sessions.filter(session => !hasStatusFilter || allowedStatuses.has(session.status))
  const prioritized = [...filtered].sort((left, right) => {
    const leftRetryable = latestRetryableRunId !== '' && left.runId === latestRetryableRunId
    const rightRetryable = latestRetryableRunId !== '' && right.runId === latestRetryableRunId
    if (leftRetryable !== rightRetryable) return leftRetryable ? -1 : 1
    if (left.status === 'running' && right.status !== 'running') return -1
    if (right.status === 'running' && left.status !== 'running') return 1
    if (left.updatedAtMs !== right.updatedAtMs) return right.updatedAtMs - left.updatedAtMs
    return right.startedAtMs - left.startedAtMs
  })
  return {
    sessions: prioritized.slice(0, maxItems),
  }
}

export function buildVideoSequenceExportSessionSurfaceModel(args: {
  includeStatuses?: readonly VideoSequenceExportSessionStatus[]
  latestRetryableRunId?: string
  maxItems?: number
  sessions: readonly VideoSequenceExportSessionRecord[]
}): VideoSequenceExportSessionSurfaceModel {
  const selection = selectVideoSequenceExportSessionSurfaceSessions(args)
  return {
    emptyLabel: 'No recent edited media exports.',
    items: selection.sessions.map(session => {
      const kindLabel = resolveVideoSequenceExportSessionKindLabel(session.kind)
      const statusLabel = resolveVideoSequenceExportSessionStatusLabel(session.status)
      const retryable = clean(args.latestRetryableRunId) !== '' && session.runId === args.latestRetryableRunId
      const toneStyle = resolveVideoSequenceExportSessionToneStyle({
        status: session.status,
        tone: session.toastKind,
      })
      return {
        detailLabel: `${kindLabel} • ${statusLabel}`,
        kind: session.kind,
        message: session.message,
        retryButtonLabel: retryable ? `Retry ${kindLabel.toLowerCase()}` : 'Retry unavailable',
        retryButtonTitle: retryable ? `Retry ${kindLabel.toLowerCase()}` : 'Retry unavailable',
        retryable,
        runId: session.runId,
        styleMode: toneStyle.styleMode,
        styleTone: toneStyle.styleTone,
        status: session.status,
        tone: session.toastKind,
      }
    }),
  }
}

function selectMediaRecorderMimeType(candidates: readonly string[], recorder: MediaRecorderConstructorLike): string {
  if (!recorder || typeof recorder.isTypeSupported !== 'function') return candidates[candidates.length - 1] || ''
  return candidates.find(candidate => recorder.isTypeSupported(candidate)) || candidates[candidates.length - 1] || ''
}

export function resolveVideoSequenceExportRecorderMimeType(
  kind: VideoSequenceExportKind,
  recorder: MediaRecorderConstructorLike = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null,
): string {
  return kind === 'audio'
    ? selectMediaRecorderMimeType(['audio/webm;codecs=opus', 'audio/webm'], recorder)
    : selectMediaRecorderMimeType(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'], recorder)
}

export function resolveVideoSequenceExportCapabilityError(args: {
  kind: VideoSequenceExportKind
  hasAudioContext: boolean
  hasCanvasCaptureStream: boolean
  hasMediaRecorder: boolean
}): string {
  if (!args.hasMediaRecorder) return resolveVideoSequenceExportErrorMessage('capability-media-recorder')
  if (!args.hasAudioContext) return resolveVideoSequenceExportErrorMessage('capability-audio-context')
  if (args.kind === 'video' && !args.hasCanvasCaptureStream) return resolveVideoSequenceExportErrorMessage('capability-canvas-capture')
  return ''
}

export function resolveVideoSequenceExportPlanError(plan: VideoSequenceExportPlan | null | undefined): string {
  if (!plan?.segments.length) return resolveVideoSequenceExportErrorMessage('plan-empty')
  const hasRenderableSegment = plan.segments.some(segment =>
    segment.durationMinutes > 0 &&
    segment.timelineEndMinutes > segment.timelineStartMinutes &&
    segment.sourceEndRatio > segment.sourceStartRatio,
  )
  if (!hasRenderableSegment) return resolveVideoSequenceExportErrorMessage('plan-non-renderable')
  return ''
}

export function isVideoSequenceExportAbortError(error: unknown): boolean {
  return resolveVideoSequenceExportErrorCode(error) === 'aborted'
}

export function buildVideoSequenceExportProgress(args: {
  completedSegments: number
  kind: VideoSequenceExportKind
  phase: VideoSequenceExportProgressPhase
  totalSegments: number
}): VideoSequenceExportProgress {
  const target = args.kind === 'audio' ? 'audio' : 'video'
  const totalSegments = Math.max(0, Math.floor(args.totalSegments || 0))
  const normalizedTotalSegments = Math.max(1, totalSegments)
  const completedSegments = Math.max(0, Math.min(totalSegments || normalizedTotalSegments, Math.floor(args.completedSegments || 0)))
  if (args.phase === 'preparing') {
    return {
      completedSegments,
      kind: args.kind,
      phase: 'preparing',
      percentage: 8,
      label: `Preparing edited ${target}...`,
      totalSegments,
    }
  }
  if (args.phase === 'finalizing') {
    return {
      completedSegments,
      kind: args.kind,
      phase: 'finalizing',
      percentage: 98,
      label: `Finalizing edited ${target}...`,
      totalSegments,
    }
  }
  const percentage = Math.max(15, Math.min(95, Math.round(15 + (completedSegments / normalizedTotalSegments) * 80)))
  return {
    completedSegments,
    kind: args.kind,
    phase: 'rendering',
    percentage,
    label: `Rendering edited ${target} (${completedSegments}/${totalSegments || normalizedTotalSegments} segments, ${percentage}%)...`,
    totalSegments,
  }
}

function createVideoSequenceExportAbortError(): Error {
  return createVideoSequenceExportError('aborted')
}

function throwIfVideoSequenceExportAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createVideoSequenceExportAbortError()
}

function reportVideoSequenceExportProgress(
  onEvent: ((event: VideoSequenceExportEvent) => void) | undefined,
  onProgress: ((progress: VideoSequenceExportProgress) => void) | undefined,
  progress: VideoSequenceExportProgress,
): void {
  try {
    onProgress?.(progress)
  } catch {
    void 0
  }
  try {
    onEvent?.(resolveVideoSequenceExportEvent({ progress }))
  } catch {
    void 0
  }
}

function reportVideoSequenceExportOutcome(
  onEvent: ((event: VideoSequenceExportEvent) => void) | undefined,
  outcome: VideoSequenceExportOutcome,
): void {
  try {
    onEvent?.(resolveVideoSequenceExportEvent({ outcome }))
  } catch {
    void 0
  }
}

function waitForVideoSequenceExportDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createVideoSequenceExportAbortError())
      return
    }
    let settled = false
    const timeoutId = window.setTimeout(() => {
      settled = true
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, Math.max(0, ms))
    const handleAbort = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      signal?.removeEventListener('abort', handleAbort)
      reject(createVideoSequenceExportAbortError())
    }
    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function seekVideo(video: HTMLVideoElement, seconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createVideoSequenceExportAbortError())
      return
    }
    const target = Math.max(0, seconds)
    let settled = false
    let timeoutId = 0
    const done = () => {
      if (settled) return
      settled = true
      video.removeEventListener('seeked', done)
      signal?.removeEventListener('abort', handleAbort)
      window.clearTimeout(timeoutId)
      resolve()
    }
    const handleAbort = () => {
      if (settled) return
      settled = true
      video.removeEventListener('seeked', done)
      signal?.removeEventListener('abort', handleAbort)
      window.clearTimeout(timeoutId)
      reject(createVideoSequenceExportAbortError())
    }
    video.addEventListener('seeked', done, { once: true })
    signal?.addEventListener('abort', handleAbort, { once: true })
    video.currentTime = target
    timeoutId = window.setTimeout(done, 800)
  })
}

function waitForRecorderStop(recorder: MediaRecorder): Promise<BlobPart[]> {
  const chunks: BlobPart[] = []
  return new Promise((resolve, reject) => {
    recorder.addEventListener('dataavailable', event => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    })
    recorder.addEventListener('stop', () => resolve(chunks), { once: true })
    recorder.addEventListener('error', () => reject(createVideoSequenceExportError('runtime-failed')), { once: true })
  })
}

async function cleanupVideoSequenceExportRuntime(args: {
  audioContext: AudioContext
  audioSource: MediaElementAudioSourceNode
  stream: MediaStream | null
  video: HTMLVideoElement
}): Promise<void> {
  try {
    args.stream?.getTracks().forEach(track => track.stop())
  } catch {
    void 0
  }
  try {
    args.audioSource.disconnect()
  } catch {
    void 0
  }
  try {
    await args.audioContext.close()
  } catch {
    void 0
  }
  try {
    args.video.pause()
  } catch {
    void 0
  }
  args.video.removeAttribute('src')
  args.video.load()
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
  signal?: AbortSignal
}): Promise<void> {
  if (args.seconds <= VIDEO_EXPORT_MIN_GAP_SECONDS) return
  throwIfVideoSequenceExportAborted(args.signal)
  drawVideoFrame({ canvas: args.canvas, context: args.context, segment: null, video: null })
  await waitForVideoSequenceExportDelay(args.seconds * 1000, args.signal)
}

async function recordSegment(args: {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  segment: VideoSequenceRenderSegment
  signal?: AbortSignal
  video: HTMLVideoElement
}): Promise<void> {
  const { canvas, context, segment, video } = args
  throwIfVideoSequenceExportAborted(args.signal)
  const duration = await loadTimelinePlanVideoMetadata({
    url: segment.url,
    video,
    timeoutMs: 8000,
  })
  if (!duration) throw createVideoSequenceExportError('source-load-failed')
  const startSeconds = Math.max(0, Math.min(duration, segment.sourceStartSeconds))
  const endSeconds = Math.max(startSeconds, Math.min(duration, segment.sourceEndSeconds))
  await seekVideo(video, startSeconds, args.signal)
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
      if (args.signal?.aborted) {
        resolve()
        return
      }
      if (video.currentTime >= endSeconds || video.paused || video.ended) {
        resolve()
        return
      }
      window.setTimeout(tick, 30)
    }
    tick()
  })
  throwIfVideoSequenceExportAborted(args.signal)
  stopped = true
  if (raf) window.cancelAnimationFrame(raf)
  video.pause()
}

async function resolveRenderSegments(args: {
  onEvent?: (event: VideoSequenceExportEvent) => void
  onProgress?: (progress: VideoSequenceExportProgress) => void
  plan: VideoSequenceExportPlan
  renderKind: VideoSequenceExportKind
  signal?: AbortSignal
}): Promise<VideoSequenceRenderSegment[]> {
  let cursorMinutes = 0
  const secondsPerMinute = 1
  const out: VideoSequenceRenderSegment[] = []
  reportVideoSequenceExportProgress(args.onEvent, args.onProgress, buildVideoSequenceExportProgress({
    completedSegments: 0,
    kind: args.renderKind,
    phase: 'preparing',
    totalSegments: args.plan.segments.length,
  }))
  for (const segment of args.plan.segments) {
    throwIfVideoSequenceExportAborted(args.signal)
    const url = resolveTimelinePlanSourceUrl(segment.source)
    if (!url) throw createVideoSequenceExportError('source-unavailable')
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.crossOrigin = 'anonymous'
    const duration = await loadTimelinePlanVideoMetadata({
      url,
      video: probe,
      timeoutMs: 8000,
    })
    if (!duration) {
      probe.removeAttribute('src')
      probe.load()
      throw createVideoSequenceExportError('source-load-failed')
    }
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
  onEvent?: (event: VideoSequenceExportEvent) => void
  onProgress?: (progress: VideoSequenceExportProgress) => void
  plan: VideoSequenceExportPlan
  signal?: AbortSignal
}): Promise<Blob> {
  const planError = resolveVideoSequenceExportPlanError(args.plan)
  if (planError) throw new Error(planError)
  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_EXPORT_WIDTH
  canvas.height = VIDEO_EXPORT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw createVideoSequenceExportError('capability-canvas-export')
  const captureStream = canvas.captureStream?.bind(canvas)
  const capabilityError = resolveVideoSequenceExportCapabilityError({
    kind: args.kind,
    hasAudioContext: typeof AudioContext !== 'undefined',
    hasCanvasCaptureStream: typeof captureStream === 'function',
    hasMediaRecorder: typeof MediaRecorder !== 'undefined',
  })
  if (capabilityError) {
    throw createVideoSequenceExportError(
      resolveVideoSequenceExportErrorCode(new Error(capabilityError)) || 'runtime-failed',
      capabilityError,
    )
  }
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.playsInline = true
  video.preload = 'auto'
  const audioContext = new AudioContext()
  const audioDestination = audioContext.createMediaStreamDestination()
  const audioSource = audioContext.createMediaElementSource(video)
  audioSource.connect(audioDestination)
  let stream: MediaStream | null = null
  try {
    throwIfVideoSequenceExportAborted(args.signal)
    await audioContext.resume()
    const renderSegments = await resolveRenderSegments({
      onEvent: args.onEvent,
      onProgress: args.onProgress,
      plan: args.plan,
      renderKind: args.kind,
      signal: args.signal,
    })
    const mimeType = resolveVideoSequenceExportRecorderMimeType(args.kind)
    stream = args.kind === 'audio'
      ? audioDestination.stream
      : new MediaStream([
        ...canvas.captureStream(VIDEO_EXPORT_FRAME_RATE).getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ])
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunksPromise = waitForRecorderStop(recorder)
    recorder.start(250)
    try {
      for (let i = 0; i < renderSegments.length; i += 1) {
        const segment = renderSegments[i]
        await recordGap({ canvas, context, seconds: segment.gapSecondsBefore, signal: args.signal })
        await recordSegment({ canvas, context, segment, signal: args.signal, video })
        reportVideoSequenceExportProgress(args.onEvent, args.onProgress, buildVideoSequenceExportProgress({
          completedSegments: i + 1,
          kind: args.kind,
          phase: 'rendering',
          totalSegments: renderSegments.length,
        }))
      }
    } finally {
      if (recorder.state !== 'inactive') recorder.stop()
    }
    reportVideoSequenceExportProgress(args.onEvent, args.onProgress, buildVideoSequenceExportProgress({
      completedSegments: renderSegments.length,
      kind: args.kind,
      phase: 'finalizing',
      totalSegments: renderSegments.length,
    }))
    const chunks = await chunksPromise
    const outputType = mimeType || (args.kind === 'audio' ? 'audio/webm' : 'video/webm')
    return new Blob(chunks, { type: outputType })
  } finally {
    await cleanupVideoSequenceExportRuntime({
      audioContext,
      audioSource,
      stream,
      video,
    })
  }
}

export async function downloadVideoSequenceExport(args: {
  kind: VideoSequenceExportKind
  onEvent?: (event: VideoSequenceExportEvent) => void
  onProgress?: (progress: VideoSequenceExportProgress) => void
  plan: VideoSequenceExportPlan
  signal?: AbortSignal
}): Promise<VideoSequenceExportDownloadResult> {
  try {
    const blob = await renderVideoSequenceExport(args)
    const filename = `${args.plan.filenameBase}.edited.${args.kind === 'audio' ? 'audio.webm' : 'video.webm'}`
    downloadBlob(blob, filename)
    const result = {
      byteSize: blob.size,
      filename,
      kind: args.kind,
      mimeType: blob.type,
    }
    reportVideoSequenceExportOutcome(args.onEvent, resolveVideoSequenceExportOutcome({
      kind: args.kind,
      result,
    }))
    return result
  } catch (error) {
    reportVideoSequenceExportOutcome(args.onEvent, resolveVideoSequenceExportOutcome({
      error,
      kind: args.kind,
    }))
    throw error
  }
}
