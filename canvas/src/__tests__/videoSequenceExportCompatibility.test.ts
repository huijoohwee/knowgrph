import {
  buildVideoSequenceExportSessionCollection,
  buildVideoSequenceExportSessionSurfaceModel,
  buildVideoSequenceExportProgress,
  createVideoSequenceExportSessionRecord,
  groupVideoSequenceExportSessions,
  reduceVideoSequenceExportSessionRecord,
  resolveVideoSequenceExportEvent,
  resolveVideoSequenceExportOutcome,
  resolveVideoSequenceExportErrorCode,
  resolveVideoSequenceExportErrorFeedback,
  resolveVideoSequenceExportErrorMessage,
  resolveVideoSequenceExportRetryError,
  resolveVideoSequenceExportRetryControl,
  resolveVideoSequenceExportRetryRequest,
  selectVideoSequenceExportSessionSurfaceSessions,
  resolveVideoSequenceExportSessionToneStyle,
  isVideoSequenceExportAbortError,
  resolveVideoSequenceExportCapabilityError,
  resolveVideoSequenceExportPlanError,
  resolveVideoSequenceExportRecorderMimeType,
  upsertVideoSequenceExportSessionHistory,
} from '@/components/timeline/videoSequenceExport'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testVideoSequenceExportCapabilityAndMimeFallbacks() {
  const noSupportRecorder = {
    isTypeSupported: () => false,
  }
  const vp8OnlyRecorder = {
    isTypeSupported: (mimeType: string) => mimeType === 'video/webm;codecs=vp8,opus',
  }
  const opusOnlyRecorder = {
    isTypeSupported: (mimeType: string) => mimeType === 'audio/webm;codecs=opus',
  }

  if (resolveVideoSequenceExportRecorderMimeType('audio', opusOnlyRecorder) !== 'audio/webm;codecs=opus') {
    throw new Error('expected audio export to prefer opus when the recorder supports it')
  }
  if (resolveVideoSequenceExportRecorderMimeType('audio', noSupportRecorder) !== 'audio/webm') {
    throw new Error('expected audio export to fall back to plain webm when no preferred mime type is supported')
  }
  if (resolveVideoSequenceExportRecorderMimeType('video', vp8OnlyRecorder) !== 'video/webm;codecs=vp8,opus') {
    throw new Error('expected video export to fall back from vp9 to vp8 before the generic webm fallback')
  }
  if (resolveVideoSequenceExportRecorderMimeType('video', noSupportRecorder) !== 'video/webm') {
    throw new Error('expected video export to fall back to generic webm when no preferred mime type is supported')
  }
  if (resolveVideoSequenceExportRecorderMimeType('video', null) !== 'video/webm') {
    throw new Error('expected video export to use the generic webm fallback when MediaRecorder capability probing is unavailable')
  }

  if (
    resolveVideoSequenceExportCapabilityError({
      kind: 'audio',
      hasAudioContext: true,
      hasCanvasCaptureStream: false,
      hasMediaRecorder: false,
    }) !== 'MediaRecorder export is not available in this browser.'
  ) {
    throw new Error('expected MediaRecorder capability errors to take precedence for export compatibility gating')
  }
  if (
    resolveVideoSequenceExportCapabilityError({
      kind: 'audio',
      hasAudioContext: false,
      hasCanvasCaptureStream: false,
      hasMediaRecorder: true,
    }) !== 'Web Audio export is not available in this browser.'
  ) {
    throw new Error('expected export compatibility gating to fail clearly when Web Audio is unavailable')
  }
  if (
    resolveVideoSequenceExportCapabilityError({
      kind: 'video',
      hasAudioContext: true,
      hasCanvasCaptureStream: false,
      hasMediaRecorder: true,
    }) !== 'Canvas video capture is not available in this browser.'
  ) {
    throw new Error('expected video export compatibility gating to require canvas capture support')
  }
  if (
    resolveVideoSequenceExportCapabilityError({
      kind: 'audio',
      hasAudioContext: true,
      hasCanvasCaptureStream: false,
      hasMediaRecorder: true,
    }) !== ''
  ) {
    throw new Error('expected audio export to remain allowed without canvas capture support')
  }
}

export function testVideoSequenceExportAlwaysFinalizesRuntimeCleanup() {
  const source = readFileSync(resolve(process.cwd(), 'src/components/timeline/videoSequenceExport.ts'), 'utf8')
  const normalized = source.replace(/\s+/g, ' ').trim()

  if (!normalized.includes('async function cleanupVideoSequenceExportRuntime')) {
    throw new Error('expected video sequence export to centralize runtime cleanup in a shared finalizer')
  }
  if (!normalized.includes('} finally { await cleanupVideoSequenceExportRuntime({ audioContext, audioSource, stream, video, }) }')) {
    throw new Error('expected video sequence export to finalize tracks, Web Audio, and video teardown through one shared finalizer')
  }
}

export function testVideoSequenceExportProgressAndAbortContracts() {
  const preparing = buildVideoSequenceExportProgress({
    completedSegments: 0,
    kind: 'video',
    phase: 'preparing',
    totalSegments: 3,
  })
  const rendering = buildVideoSequenceExportProgress({
    completedSegments: 2,
    kind: 'video',
    phase: 'rendering',
    totalSegments: 4,
  })
  const finalizing = buildVideoSequenceExportProgress({
    completedSegments: 4,
    kind: 'audio',
    phase: 'finalizing',
    totalSegments: 4,
  })

  if (preparing.label !== 'Preparing edited video...' || preparing.percentage !== 8) {
    throw new Error('expected export progress to expose a deterministic preparing stage for edited video export')
  }
  if (
    rendering.phase !== 'rendering' ||
    rendering.kind !== 'video' ||
    rendering.completedSegments !== 2 ||
    rendering.totalSegments !== 4 ||
    !rendering.label.includes('Rendering edited video (2/4 segments,') ||
    rendering.percentage <= preparing.percentage
  ) {
    throw new Error('expected export progress to expose structured segment counts and an explicit edited-video rendering label')
  }
  if (
    finalizing.kind !== 'audio' ||
    finalizing.completedSegments !== 4 ||
    finalizing.totalSegments !== 4 ||
    finalizing.label !== 'Finalizing edited audio...' ||
    finalizing.percentage !== 98
  ) {
    throw new Error('expected export progress to preserve segment totals through the deterministic finalizing stage for edited audio export')
  }
  if (!isVideoSequenceExportAbortError(new Error('Edited media export cancelled.'))) {
    throw new Error('expected export abort detection to recognize the shared cancellation error message')
  }
}

export function testVideoSequenceExportErrorFeedbackContracts() {
  const progressEvent = resolveVideoSequenceExportEvent({
    progress: buildVideoSequenceExportProgress({
      completedSegments: 1,
      kind: 'video',
      phase: 'rendering',
      totalSegments: 2,
    }),
  })
  const successOutcome = resolveVideoSequenceExportOutcome({
    kind: 'video',
    result: {
      byteSize: 128,
      filename: 'sequence.edited.video.webm',
      kind: 'video',
      mimeType: 'video/webm',
    },
  })
  const abortOutcome = resolveVideoSequenceExportOutcome({
    error: new Error(resolveVideoSequenceExportErrorMessage('aborted')),
    kind: 'audio',
  })
  const successEvent = resolveVideoSequenceExportEvent({ outcome: successOutcome })
  const initialSession = createVideoSequenceExportSessionRecord({
    filenameBase: 'sequence',
    kind: 'video',
    nowMs: 10,
    totalSegments: 2,
  })
  const progressSession = reduceVideoSequenceExportSessionRecord({
    event: progressEvent,
    nowMs: 20,
    session: initialSession,
  })
  const completedSession = reduceVideoSequenceExportSessionRecord({
    event: successEvent,
    nowMs: 30,
    session: progressSession,
  })
  const retryRequest = resolveVideoSequenceExportRetryRequest({
    plan: {
      durationMinutes: 2,
      filenameBase: 'sequence',
      segments: [{
        durationMinutes: 1,
        hasGrade: false,
        hasMask: false,
        label: 'clip',
        source: {
          byteSize: 1,
          id: 'clip',
          importMode: 'url',
          mimeHint: 'video/mp4',
          originalName: 'clip.mp4',
          relativePath: 'clip.mp4',
          sourceUrl: 'https://media.example.test/clip.mp4',
          workspacePath: '',
        },
        sourceEndRatio: 0.5,
        sourceStartRatio: 0,
        timelineEndMinutes: 1,
        timelineStartMinutes: 0,
      }],
    },
    session: completedSession,
  })
  const retryControl = resolveVideoSequenceExportRetryControl(completedSession)
  const disabledRetryControl = resolveVideoSequenceExportRetryControl(null)
  const sessionSurface = buildVideoSequenceExportSessionSurfaceModel({
    latestRetryableRunId: completedSession.runId,
    sessions: [completedSession],
  })
  const failedSessionSurface = buildVideoSequenceExportSessionSurfaceModel({
    sessions: [{
      ...completedSession,
      message: 'Edited media export failed.',
      status: 'failed',
      toastKind: 'error',
    }],
  })
  const cancelledSessionSurface = buildVideoSequenceExportSessionSurfaceModel({
    sessions: [{
      ...completedSession,
      message: 'Cancelled edited video export.',
      status: 'cancelled',
      toastKind: 'neutral',
    }],
  })
  const emptySessionSurface = buildVideoSequenceExportSessionSurfaceModel({ sessions: [] })
  const selectedSessions = selectVideoSequenceExportSessionSurfaceSessions({
    includeStatuses: ['running', 'downloaded'],
    latestRetryableRunId: completedSession.runId,
    maxItems: 2,
    sessions: [
      {
        ...completedSession,
        runId: 'failed-old',
        status: 'failed',
        toastKind: 'error',
        updatedAtMs: 5,
      },
      {
        ...completedSession,
        runId: 'running-new',
        message: 'Rendering edited video...',
        status: 'running',
        toastKind: 'neutral',
        updatedAtMs: 25,
      },
      completedSession,
    ],
  })
  const retriedSession = {
    ...completedSession,
    message: 'Downloaded sequence-retry.edited.video.webm',
    retryOfRunId: completedSession.runId,
    runId: 'downloaded-retry',
    startedAtMs: 40,
    updatedAtMs: 40,
  }
  const groupedSessions = groupVideoSequenceExportSessions([
    retriedSession,
    completedSession,
    {
      ...completedSession,
      kind: 'audio',
      message: 'Rendering edited audio...',
      retryOfRunId: '',
      runId: 'running-audio',
      startedAtMs: 35,
      status: 'running',
      toastKind: 'neutral',
      updatedAtMs: 35,
    },
  ])
  const groupedCollection = buildVideoSequenceExportSessionCollection({
    plan: retryRequest.request.plan,
    sessions: [
      retriedSession,
      completedSession,
      {
        ...completedSession,
        kind: 'audio',
        message: 'Rendering edited audio...',
        retryOfRunId: '',
        runId: 'running-audio',
        startedAtMs: 35,
        status: 'running',
        toastKind: 'neutral',
        updatedAtMs: 35,
      },
    ],
  })
  const sessionHistory = upsertVideoSequenceExportSessionHistory({
    history: [initialSession],
    limit: 2,
    nextSession: completedSession,
  })
  const abortFeedback = resolveVideoSequenceExportErrorFeedback(new Error(resolveVideoSequenceExportErrorMessage('aborted')))
  const planFeedback = resolveVideoSequenceExportErrorFeedback(new Error(resolveVideoSequenceExportErrorMessage('plan-empty')))
  const fallbackFeedback = resolveVideoSequenceExportErrorFeedback(new Error('custom export backend failed'))

  if (resolveVideoSequenceExportErrorCode(new Error(resolveVideoSequenceExportErrorMessage('source-unavailable'))) !== 'source-unavailable') {
    throw new Error('expected export error-code resolution to classify shared source-availability failures by message')
  }
  if (
    initialSession.status !== 'running' ||
    initialSession.phase !== 'preparing' ||
    initialSession.totalSegments !== 2 ||
    initialSession.message !== 'Preparing edited video...'
  ) {
    throw new Error('expected export session creation to seed a deterministic running snapshot from the shared preparing contract')
  }
  if (
    progressSession.status !== 'running' ||
    progressSession.phase !== 'rendering' ||
    progressSession.completedSegments !== 1 ||
    progressSession.updatedAtMs !== 20
  ) {
    throw new Error('expected export session reduction to fold progress events into one shared running snapshot')
  }
  if (
    completedSession.status !== 'downloaded' ||
    completedSession.filename !== 'sequence.edited.video.webm' ||
    completedSession.toastKind !== 'success' ||
    completedSession.updatedAtMs !== 30
  ) {
    throw new Error('expected export session reduction to preserve the shared downloaded terminal snapshot')
  }
  if (
    sessionHistory.length !== 1 ||
    sessionHistory[0]?.runId !== completedSession.runId ||
    sessionHistory[0]?.status !== 'downloaded'
  ) {
    throw new Error('expected export session history to upsert the latest run snapshot by run id instead of duplicating transient entries')
  }
  if (
    retryRequest.error !== '' ||
    !retryRequest.request ||
    retryRequest.request.kind !== 'video' ||
    retryRequest.request.retryOfRunId !== completedSession.runId
  ) {
    throw new Error('expected export retry requests to reuse the previous run kind and run id through one shared retry contract')
  }
  if (
    retryControl.disabled ||
    retryControl.kind !== 'video' ||
    retryControl.ariaLabel !== 'Retry edited video export' ||
    retryControl.title !== 'Retry edited video export'
  ) {
    throw new Error('expected export retry control surfacing to derive a shared enabled retry button contract from the latest retryable session')
  }
  if (
    !disabledRetryControl.disabled ||
    disabledRetryControl.kind !== '' ||
    disabledRetryControl.title !== 'Retry latest edited media export'
  ) {
    throw new Error('expected export retry control surfacing to stay disabled and generic when no retryable session is available')
  }
  if (
    sessionSurface.items.length !== 1 ||
    sessionSurface.items[0]?.detailLabel !== 'Edited video • Downloaded' ||
    sessionSurface.items[0]?.retryButtonLabel !== 'Retry edited video' ||
    !sessionSurface.items[0]?.retryable ||
    sessionSurface.items[0]?.styleTone !== 'success' ||
    sessionSurface.items[0]?.styleMode !== 'solid'
  ) {
    throw new Error('expected export session surface modeling to expose one shared detail/retry/tone shape for the latest retryable run')
  }
  if (
    failedSessionSurface.items[0]?.styleTone !== 'danger' ||
    failedSessionSurface.items[0]?.styleMode !== 'solid' ||
    cancelledSessionSurface.items[0]?.styleTone !== 'neutral' ||
    cancelledSessionSurface.items[0]?.styleMode !== 'muted'
  ) {
    throw new Error('expected export session tone styling to distinguish failed and cancelled rows through one shared surface contract')
  }
  if (
    emptySessionSurface.items.length !== 0 ||
    emptySessionSurface.emptyLabel !== 'No recent edited media exports.'
  ) {
    throw new Error('expected export session surface modeling to preserve a shared empty-state label when no recent runs exist')
  }
  if (
    selectedSessions.sessions.length !== 2 ||
    selectedSessions.sessions[0]?.runId !== completedSession.runId ||
    selectedSessions.sessions[1]?.runId !== 'running-new'
  ) {
    throw new Error('expected export session surface selection to prioritize the latest retryable run, then running/recent sessions, while filtering out disallowed statuses')
  }
  if (
    groupedSessions.length !== 2 ||
    groupedSessions[0]?.groupRunId !== 'running-audio' ||
    groupedSessions[1]?.groupRunId !== completedSession.runId ||
    groupedSessions[1]?.sessions.length !== 2 ||
    groupedSessions[1]?.representativeSession.runId !== 'downloaded-retry'
  ) {
    throw new Error(`expected export session grouping to collapse retry lineage by root run id, got ${JSON.stringify(groupedSessions)}`)
  }
  if (
    groupedCollection.latestRetryableSession?.runId !== 'downloaded-retry' ||
    groupedCollection.retryControl.kind !== 'video' ||
    groupedCollection.surface.items.length !== 2 ||
    groupedCollection.surface.items[0]?.attemptCount !== 2 ||
    groupedCollection.surface.items[0]?.groupRunId !== completedSession.runId ||
    groupedCollection.surfaceSessions[0]?.runId !== 'downloaded-retry'
  ) {
    throw new Error(`expected export session collection to expose grouped retry lineage and compact surface sessions through one shared contract, got ${JSON.stringify(groupedCollection)}`)
  }
  if (
    resolveVideoSequenceExportSessionToneStyle({ status: 'running', tone: 'neutral' }).styleMode !== 'active' ||
    resolveVideoSequenceExportSessionToneStyle({ status: 'downloaded', tone: 'success' }).styleTone !== 'success' ||
    resolveVideoSequenceExportSessionToneStyle({ status: 'failed', tone: 'error' }).styleTone !== 'danger'
  ) {
    throw new Error('expected export session tone-style resolution to stay shared and status-aware across running, success, and failure rows')
  }
  if (
    resolveVideoSequenceExportRetryError({
      exportingKind: 'audio',
      plan: retryRequest.request.plan,
      session: completedSession,
    }) !== 'Wait for the current edited media export to finish before retrying.'
  ) {
    throw new Error('expected export retry eligibility to reject replay while another edited-media export is running')
  }
  if (
    resolveVideoSequenceExportRetryError({
      plan: {
        ...retryRequest.request.plan,
        filenameBase: 'other-sequence',
      },
      session: completedSession,
    }) !== 'Edited media export retry requires the same compiled export plan as the previous run.'
  ) {
    throw new Error('expected export retry eligibility to reject stale compiled plans instead of replaying against mismatched plan state')
  }
  if (
    progressEvent.eventType !== 'progress' ||
    progressEvent.phase !== 'rendering' ||
    progressEvent.kind !== 'video' ||
    progressEvent.message !== progressEvent.progress.label
  ) {
    throw new Error('expected export progress events to expose one structured telemetry envelope over shared progress payloads')
  }
  if (
    successOutcome.status !== 'downloaded' ||
    successOutcome.toastKind !== 'success' ||
    successOutcome.filename !== 'sequence.edited.video.webm' ||
    successOutcome.message !== 'Downloaded sequence.edited.video.webm'
  ) {
    throw new Error('expected export success outcome to expose shared downloaded feedback instead of hook-local toast copy')
  }
  if (
    successEvent.eventType !== 'outcome' ||
    successEvent.status !== 'downloaded' ||
    successEvent.toastKind !== 'success' ||
    successEvent.message !== 'Downloaded sequence.edited.video.webm'
  ) {
    throw new Error('expected export outcome events to preserve the shared downloaded terminal payload')
  }
  if (
    abortOutcome.status !== 'cancelled' ||
    abortOutcome.toastKind !== 'neutral' ||
    abortOutcome.errorCode !== 'aborted' ||
    abortOutcome.message !== 'Edited media export cancelled.'
  ) {
    throw new Error('expected export abort outcome to stay neutral and preserve the shared cancelled status')
  }
  if (
    abortFeedback.kind !== 'neutral' ||
    abortFeedback.message !== 'Edited media export cancelled.'
  ) {
    throw new Error('expected export abort feedback to stay neutral and reuse the shared cancellation message')
  }
  if (
    planFeedback.kind !== 'error' ||
    planFeedback.message !== 'Edited media export requires at least one video segment.'
  ) {
    throw new Error('expected export plan feedback to reuse the shared plan-validation error message')
  }
  if (
    fallbackFeedback.kind !== 'error' ||
    fallbackFeedback.message !== 'custom export backend failed'
  ) {
    throw new Error('expected unclassified export failures to preserve their explicit runtime message')
  }
}

export function testVideoSequenceExportRejectsDegeneratePlans() {
  const emptyPlanError = resolveVideoSequenceExportPlanError({
    durationMinutes: 0,
    filenameBase: 'sequence',
    segments: [],
  })
  const zeroDurationPlanError = resolveVideoSequenceExportPlanError({
    durationMinutes: 4,
    filenameBase: 'sequence',
    segments: [{
      durationMinutes: 0,
      hasGrade: false,
      hasMask: false,
      label: 'clip',
      source: {
        byteSize: 1,
        id: 'clip',
        importMode: 'url',
        mimeHint: 'video/mp4',
        originalName: 'clip.mp4',
        relativePath: 'clip.mp4',
        sourceUrl: 'https://media.example.test/clip.mp4',
        workspacePath: '',
      },
      sourceEndRatio: 0,
      sourceStartRatio: 0,
      timelineEndMinutes: 1,
      timelineStartMinutes: 1,
    }],
  })
  const validPlanError = resolveVideoSequenceExportPlanError({
    durationMinutes: 4,
    filenameBase: 'sequence',
    segments: [{
      durationMinutes: 1,
      hasGrade: false,
      hasMask: false,
      label: 'clip',
      source: {
        byteSize: 1,
        id: 'clip',
        importMode: 'url',
        mimeHint: 'video/mp4',
        originalName: 'clip.mp4',
        relativePath: 'clip.mp4',
        sourceUrl: 'https://media.example.test/clip.mp4',
        workspacePath: '',
      },
      sourceEndRatio: 0.5,
      sourceStartRatio: 0,
      timelineEndMinutes: 1,
      timelineStartMinutes: 0,
    }],
  })

  if (emptyPlanError !== 'Edited media export requires at least one video segment.') {
    throw new Error('expected export plan validation to reject empty edited-media exports before runtime work starts')
  }
  if (zeroDurationPlanError !== 'Edited media export requires at least one positive-duration source range.') {
    throw new Error('expected export plan validation to reject non-renderable zero-duration edited-media plans')
  }
  if (validPlanError !== '') {
    throw new Error('expected export plan validation to accept a positive-duration source-backed segment')
  }
}
