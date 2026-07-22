import {
  MOTION_CAPTURE_MAX_TIME_MS,
  MOTION_CAPTURE_PLATFORM_SCHEMA,
  MOTION_CAPTURE_RECORDING_SCHEMA,
  createMotionCaptureCalibration,
  createMotionCaptureClockAlignment,
  evaluateMotionCaptureSessionEvidence,
  isMotionCaptureSha256,
  type MotionCaptureCalibrationInput,
  type MotionCaptureClockAlignmentInput,
  type MotionCaptureDerivedLandmark,
  type MotionCaptureExportArtifact,
  type MotionCaptureExportFormat,
  type MotionCaptureLimits,
  type MotionCaptureObservationInput,
  type MotionCaptureRecordedSample,
  type MotionCaptureRecording,
  type MotionCaptureSessionSnapshot,
  type MotionCaptureSharedReconstructionEvidence,
  type MotionCaptureSharedReconstructionInput,
  type MotionCaptureSourceRegistration,
  type MotionCaptureSourceState,
} from './motionCapturePlatformContract'
import { buildMotionCaptureExport } from './motionCaptureExport'
import {
  assertStrictRecord,
  boundedNumber,
  finiteNumber,
  integerNumber,
  STRICT_INPUT_KEYS,
} from './motionCaptureInputValidation'
import { mergeMotionCaptureLimits } from './motionCaptureRuntimeConfiguration'
import { motionCapturePlatformTeardownActive } from './motionCaptureLifecycleGate'
import {
  createMutableMotionCaptureSourceQuality,
  freezeMotionCaptureSourceQuality,
  resetMotionCaptureSourceResearchEvidence,
  type MutableMotionCaptureSourceQuality,
} from './motionCaptureSourceQualityRuntime'
import {
  buildMotionCaptureResearchEvidenceEpoch,
  freezeMotionCaptureSourceRejections,
  recordMotionCaptureSourceRejection,
  type MutableMotionCaptureSourceRejections,
} from './motionCaptureResearchEpochRuntime'

type RuntimeListener = (snapshot: MotionCaptureSessionSnapshot) => void
type IdKind = 'session' | 'source' | 'recording' | 'reconstruction'
export type MotionCaptureSessionRuntimeOptions = Readonly<{
  now?: () => number
  idFactory?: (kind: IdKind) => string
  limits?: Partial<MotionCaptureLimits>
}>

export type MotionCaptureSessionRuntime = Readonly<{
  getSnapshot: () => MotionCaptureSessionSnapshot
  subscribe: (listener: RuntimeListener) => () => void
  registerSource: (input: MotionCaptureSourceRegistration) => MotionCaptureSourceState
  removeSource: (sourceId: string) => MotionCaptureSessionSnapshot
  releaseAllSources: () => MotionCaptureSessionSnapshot
  setSourceClockAlignment: (sourceId: string, input: MotionCaptureClockAlignmentInput) => MotionCaptureSourceState
  setSourceCalibration: (sourceId: string, input: MotionCaptureCalibrationInput) => MotionCaptureSourceState
  setSharedReconstructionEvidence: (input: MotionCaptureSharedReconstructionInput) => MotionCaptureSessionSnapshot
  clearSharedReconstructionEvidence: () => MotionCaptureSessionSnapshot
  ingestObservation: (sourceId: string, input: MotionCaptureObservationInput) => MotionCaptureSessionSnapshot
  startRecording: () => MotionCaptureSessionSnapshot
  stopRecording: () => MotionCaptureSessionSnapshot
  clearRecording: () => MotionCaptureSessionSnapshot
  readRecording: () => MotionCaptureRecording | null
  exportRecording: (format: MotionCaptureExportFormat) => Promise<MotionCaptureExportArtifact>
}>

type InternalSource = {
  state: MotionCaptureSourceState
  quality: MutableMotionCaptureSourceQuality
  previousCaptureTimestampMs: number | null
  previousSequence: number | null
  researchEvidenceEpoch: number
}

let fallbackIdCounter = 0

function defaultIdFactory(kind: IdKind): string {
  const randomUuid = globalThis.crypto?.randomUUID?.()
  fallbackIdCounter += 1
  return randomUuid || `${kind}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`
}

function createOpaqueId(kind: IdKind, factory: (kind: IdKind) => string): string {
  const token = factory(kind).trim().replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 96)
  if (!token) throw new Error('motion-capture-empty-opaque-id')
  return `${kind}-${token}`
}

function freezeLandmarks(
  landmarks: readonly MotionCaptureDerivedLandmark[],
  limit: number,
): readonly MotionCaptureDerivedLandmark[] {
  if (!Array.isArray(landmarks)) throw new Error('motion-capture-invalid-landmarks-shape')
  if (landmarks.length > limit) throw new Error('motion-capture-landmark-budget-exceeded')
  return Object.freeze(Array.from(landmarks, (landmark) => {
    assertStrictRecord(landmark, STRICT_INPUT_KEYS.landmark, 'landmark')
    return Object.freeze({
      x: finiteNumber(landmark.x, 'landmark-x'),
      y: finiteNumber(landmark.y, 'landmark-y'),
      z: finiteNumber(landmark.z, 'landmark-z'),
      visibility: boundedNumber(landmark.visibility, 'landmark-visibility', 0, 1),
      presence: boundedNumber(landmark.presence, 'landmark-presence', 0, 1),
    })
  }))
}

export function createMotionCaptureSessionRuntime(
  options: MotionCaptureSessionRuntimeOptions = {},
): MotionCaptureSessionRuntime {
  assertStrictRecord(options, STRICT_INPUT_KEYS.runtimeOptions, 'runtime-options')
  if (options.limits !== undefined) assertStrictRecord(options.limits, STRICT_INPUT_KEYS.runtimeLimits, 'runtime-limits')
  if ((options.now !== undefined && typeof options.now !== 'function')
    || (options.idFactory !== undefined && typeof options.idFactory !== 'function')) {
    throw new Error('motion-capture-invalid-runtime-options-shape')
  }
  const now = options.now || Date.now
  const idFactory = options.idFactory || defaultIdFactory
  const limits = mergeMotionCaptureLimits(options.limits)
  const readNow = (): number => boundedNumber(now(), 'runtime-time', 0, MOTION_CAPTURE_MAX_TIME_MS)
  const sessionId = createOpaqueId('session', idFactory)
  const sources = new Map<string, InternalSource>()
  const listeners = new Set<RuntimeListener>()
  let freshnessTimer: ReturnType<typeof setTimeout> | null = null
  let lastEvidenceSignature = ''
  let revision = 0
  let sharedReconstruction: MotionCaptureSharedReconstructionEvidence | null = null
  let recordingRevision = 0
  let recordingStatus: 'idle' | 'recording' | 'stopped' = 'idle'
  let recordingId: string | null = null
  let recordingStartedAtMs: number | null = null
  let recordingFinishedAtMs: number | null = null
  let recordedLandmarkCount = 0
  let droppedByBudget = 0
  const sourceRejections: MutableMotionCaptureSourceRejections = new Map()
  let recordedSamples: MotionCaptureRecordedSample[] = []

  const sourceStates = (): readonly MotionCaptureSourceState[] => Object.freeze(
    [...sources.values()].map(source => source.state).sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
  )

  const getSnapshot = (): MotionCaptureSessionSnapshot => {
    const states = sourceStates()
    const evidence = evaluateMotionCaptureSessionEvidence(states, sharedReconstruction, readNow(), limits).evidence
    const warnings = droppedByBudget > 0 && !evidence.warnings.includes('capture-recording-budget-reached')
      ? Object.freeze([...evidence.warnings, 'capture-recording-budget-reached'])
      : evidence.warnings
    return Object.freeze({
      schema: MOTION_CAPTURE_PLATFORM_SCHEMA,
      sessionId,
      revision,
      sources: states,
      evidence: warnings === evidence.warnings ? evidence : Object.freeze({ ...evidence, warnings }),
      recording: Object.freeze({
        status: recordingStatus,
        recordingId,
        startedAtMs: recordingStartedAtMs,
        finishedAtMs: recordingFinishedAtMs,
        sampleCount: recordedSamples.length,
        landmarkCount: recordedLandmarkCount,
        droppedByBudget,
        maxSamples: limits.maxRecordingSamples,
      }),
    })
  }

  function scheduleFreshnessExpiry(): void {
    if (freshnessTimer !== null) clearTimeout(freshnessTimer)
    freshnessTimer = null
    if (listeners.size === 0) return
    const currentTime = readNow()
    const expiries = [...sources.values()].flatMap(source => source.state.latestObservation
      ? [source.state.latestObservation.receivedAtMs + limits.maxSampleStalenessMs + 1]
      : []).filter(expiry => expiry > currentTime)
    if (expiries.length === 0) return
    freshnessTimer = setTimeout(() => {
      freshnessTimer = null
      notify()
    }, Math.max(0, Math.min(...expiries) - currentTime))
  }

  function notify(): MotionCaptureSessionSnapshot {
    revision += 1
    const snapshot = getSnapshot()
    lastEvidenceSignature = JSON.stringify(snapshot.evidence)
    for (const listener of [...listeners]) {
      try {
        listener(snapshot)
      } catch (error) {
        console.error('[knowgrph] motion capture session listener failed', error)
      }
    }
    scheduleFreshnessExpiry()
    return snapshot
  }

  const getSource = (sourceId: string): InternalSource => {
    const source = sources.get(sourceId)
    if (!source) throw new Error('motion-capture-source-not-found')
    return source
  }

  const replaceSourceState = (source: InternalSource, patch: Partial<MotionCaptureSourceState>): MotionCaptureSourceState => {
    source.state = Object.freeze({ ...source.state, ...patch })
    notify()
    return source.state
  }

  const resetSourceResearchEvidenceCohort = (source: InternalSource): void => {
    const bound = sharedReconstruction?.sourceBindings.some(binding => binding.sourceId === source.state.sourceId)
    const sourceIds = bound ? sharedReconstruction!.sourceBindings.map(binding => binding.sourceId) : [source.state.sourceId]
    sourceIds.forEach(sourceId => resetMotionCaptureSourceResearchEvidence(getSource(sourceId)))
  }

  const registerSource = (input: MotionCaptureSourceRegistration): MotionCaptureSourceState => {
    if (motionCapturePlatformTeardownActive()) throw new Error('motion-capture-platform-teardown-active')
    assertStrictRecord(input, STRICT_INPUT_KEYS.sourceRegistration, 'source-registration')
    if (sources.size >= limits.maxSources) throw new Error('motion-capture-source-budget-exceeded')
    if (!['video', 'depth', 'landmark-stream', 'peer-derived'].includes(input.captureKind)
      || !['normalized-image', 'model-relative', 'metric-world'].includes(input.coordinateSpace)
      || !['session-monotonic', 'source-local'].includes(input.clockDomain)) {
      throw new Error('motion-capture-invalid-source-registration')
    }
    if (input.dimensions !== undefined) assertStrictRecord(input.dimensions, STRICT_INPUT_KEYS.sourceDimensions, 'source-dimensions')
    const dimensions = input.dimensions === undefined
      ? null
      : Object.freeze({
        width: integerNumber(input.dimensions.width, 'source-width', 1, 32_768),
        height: integerNumber(input.dimensions.height, 'source-height', 1, 32_768),
      })
    const nominalFps = input.nominalFps === undefined
      ? null
      : boundedNumber(input.nominalFps, 'source-fps', 0.1, 1_000)
    const sourceId = createOpaqueId('source', idFactory)
    if (sources.has(sourceId)) throw new Error('motion-capture-duplicate-opaque-id')
    const quality = createMutableMotionCaptureSourceQuality()
    const state: MotionCaptureSourceState = Object.freeze({
      sourceId,
      captureKind: input.captureKind,
      coordinateSpace: input.coordinateSpace,
      clockDomain: input.clockDomain,
      dimensions,
      nominalFps,
      clockAlignment: createMotionCaptureClockAlignment(input.clockDomain),
      calibration: createMotionCaptureCalibration(input.coordinateSpace),
      quality: freezeMotionCaptureSourceQuality(quality),
      latestObservation: null,
    })
    sources.set(sourceId, {
      state, quality, previousCaptureTimestampMs: null, previousSequence: null, researchEvidenceEpoch: 0,
    })
    notify()
    return state
  }

  const removeSource = (sourceId: string): MotionCaptureSessionSnapshot => {
    if (!sources.delete(sourceId)) throw new Error('motion-capture-source-not-found')
    if (sharedReconstruction?.sourceBindings.some(binding => binding.sourceId === sourceId)) sharedReconstruction = null
    return notify()
  }

  const releaseAllSources = (): MotionCaptureSessionSnapshot => {
    if (sources.size === 0) return getSnapshot()
    sources.clear()
    sharedReconstruction = null
    return notify()
  }

  const setSourceClockAlignment = (
    sourceId: string,
    input: MotionCaptureClockAlignmentInput,
  ): MotionCaptureSourceState => {
    assertStrictRecord(input, STRICT_INPUT_KEYS.clockAlignment, 'clock-alignment')
    const source = getSource(sourceId)
    if (source.state.clockDomain !== 'source-local') throw new Error('motion-capture-session-clock-is-canonical')
    if (!isMotionCaptureSha256(input.evidenceDigestSha256)) throw new Error('motion-capture-invalid-clock-evidence')
    const measuredAtMs = finiteNumber(input.measuredAtMs, 'clock-measured-at', 0)
    if (measuredAtMs > readNow()) throw new Error('motion-capture-invalid-clock-evidence')
    const clockAlignment = Object.freeze({
      status: 'aligned' as const,
      offsetMs: boundedNumber(input.offsetMs, 'clock-offset', -MOTION_CAPTURE_MAX_TIME_MS, MOTION_CAPTURE_MAX_TIME_MS),
      uncertaintyMs: finiteNumber(input.uncertaintyMs, 'clock-uncertainty', 0),
      measuredAtMs,
      evidenceDigestSha256: input.evidenceDigestSha256,
      provenance: 'measured-alignment' as const,
    })
    resetSourceResearchEvidenceCohort(source)
    return replaceSourceState(source, { clockAlignment })
  }

  const setSourceCalibration = (
    sourceId: string,
    input: MotionCaptureCalibrationInput,
  ): MotionCaptureSourceState => {
    assertStrictRecord(input, STRICT_INPUT_KEYS.calibration, 'calibration')
    if (input.provenance !== undefined) {
      assertStrictRecord(input.provenance, STRICT_INPUT_KEYS.calibrationProvenance, 'calibration-provenance')
    }
    const source = getSource(sourceId)
    if (input.coordinateSpace !== source.state.coordinateSpace) {
      throw new Error('motion-capture-calibration-coordinate-space-mismatch')
    }
    if (input.status === 'calibrated' && !input.provenance) {
      throw new Error('motion-capture-calibration-provenance-required')
    }
    if (!['uncalibrated', 'calibrating', 'calibrated', 'invalid'].includes(input.status)
      || (input.provenance && !['operator-verified', 'measured', 'imported'].includes(input.provenance.kind))) {
      throw new Error('motion-capture-invalid-calibration-state')
    }
    if (input.provenance && (!isMotionCaptureSha256(input.provenance.evidenceDigestSha256)
      || !Number.isFinite(input.provenance.measuredAtMs)
      || input.provenance.measuredAtMs < 0
      || input.provenance.measuredAtMs > MOTION_CAPTURE_MAX_TIME_MS
      || input.provenance.measuredAtMs > readNow())) {
      throw new Error('motion-capture-invalid-calibration-provenance')
    }
    const reprojectionErrorPx = input.reprojectionErrorPx === undefined || input.reprojectionErrorPx === null
      ? null
      : finiteNumber(input.reprojectionErrorPx, 'calibration-error', 0)
    const calibration = Object.freeze({
      status: input.status,
      coordinateSpace: input.coordinateSpace,
      provenance: input.provenance ? Object.freeze({
        kind: input.provenance.kind,
        measuredAtMs: input.provenance.measuredAtMs,
        evidenceDigestSha256: input.provenance.evidenceDigestSha256,
      }) : null,
      reprojectionErrorPx,
    })
    if (sharedReconstruction?.sourceBindings.some(binding => binding.sourceId === sourceId)) sharedReconstruction = null
    resetMotionCaptureSourceResearchEvidence(source)
    return replaceSourceState(source, { calibration })
  }

  const setSharedReconstructionEvidence = (
    input: MotionCaptureSharedReconstructionInput,
  ): MotionCaptureSessionSnapshot => {
    assertStrictRecord(input, STRICT_INPUT_KEYS.sharedReconstruction, 'shared-reconstruction')
    if (!Array.isArray(input.sourceIds)) throw new Error('motion-capture-invalid-shared-reconstruction-shape')
    const sourceIds = [...new Set(input.sourceIds)].sort()
    const measuredAtMs = finiteNumber(input.measuredAtMs, 'reconstruction-measured-at', 0)
    if (input.method !== 'measured'
      || sourceIds.length !== input.sourceIds.length
      || sourceIds.length < 2
      || sourceIds.length > limits.maxSources
      || measuredAtMs > readNow()
      || !isMotionCaptureSha256(input.evidenceDigestSha256)) {
      throw new Error('motion-capture-invalid-shared-reconstruction-evidence')
    }
    const sourceBindings = sourceIds.map((sourceId) => {
      const calibration = getSource(sourceId).state.calibration
      const provenance = calibration.provenance
      if (calibration.status !== 'calibrated'
        || calibration.coordinateSpace !== 'metric-world'
        || provenance?.kind !== 'measured'
        || provenance.measuredAtMs > measuredAtMs
        || !isMotionCaptureSha256(provenance.evidenceDigestSha256)
        || provenance.evidenceDigestSha256 === input.evidenceDigestSha256) {
        throw new Error('motion-capture-shared-reconstruction-source-unqualified')
      }
      return Object.freeze({
        sourceId,
        calibrationEvidenceDigestSha256: provenance.evidenceDigestSha256,
      })
    })
    const nextSharedReconstruction = Object.freeze({
      reconstructionId: createOpaqueId('reconstruction', idFactory),
      referenceFrame: 'shared-metric-session' as const,
      coordinateSpace: 'metric-world' as const,
      method: 'measured' as const,
      measuredAtMs,
      evidenceDigestSha256: input.evidenceDigestSha256,
      sourceBindings: Object.freeze(sourceBindings),
    })
    sourceIds.forEach(sourceId => resetMotionCaptureSourceResearchEvidence(getSource(sourceId)))
    sharedReconstruction = nextSharedReconstruction
    return notify()
  }

  const clearSharedReconstructionEvidence = (): MotionCaptureSessionSnapshot => {
    if (!sharedReconstruction) return getSnapshot()
    const sourceIds = sharedReconstruction.sourceBindings.map(binding => binding.sourceId)
    sharedReconstruction = null
    sourceIds.forEach(sourceId => resetMotionCaptureSourceResearchEvidence(getSource(sourceId)))
    return notify()
  }

  const ingestObservation = (
    sourceId: string,
    input: MotionCaptureObservationInput,
  ): MotionCaptureSessionSnapshot => {
    assertStrictRecord(input, STRICT_INPUT_KEYS.observation, 'observation')
    if (input.missing !== undefined && typeof input.missing !== 'boolean') {
      throw new Error('motion-capture-invalid-observation-shape')
    }
    const source = getSource(sourceId)
    if (input.coordinateSpace !== source.state.coordinateSpace) {
      throw new Error('motion-capture-observation-coordinate-space-mismatch')
    }
    const captureTimestampMs = boundedNumber(input.captureTimestampMs, 'capture-timestamp', 0, MOTION_CAPTURE_MAX_TIME_MS)
    const receivedAtMs = readNow()
    const sequence = input.sequence === undefined
      ? null
      : integerNumber(input.sequence, 'sequence', 0, Number.MAX_SAFE_INTEGER)
    const missing = input.missing === true
    const landmarks = freezeLandmarks(input.landmarks, limits.maxLandmarksPerObservation)
    if (missing !== (landmarks.length === 0)) throw new Error('motion-capture-missing-sample-shape-mismatch')
    const confidence = boundedNumber(input.confidence, 'confidence', 0, 1)
    const researchLandmarkCount = landmarks.filter(landmark => (
      landmark.visibility >= limits.minimumLandmarkVisibility
      && landmark.presence >= limits.minimumLandmarkPresence
    )).length
    const researchEvidenceQualified = !missing
      && confidence >= limits.minimumObservationConfidence
      && researchLandmarkCount / landmarks.length >= limits.minimumLandmarkEvidenceRatio
    const alignedTimestampMs = source.state.clockAlignment.status === 'aligned'
      ? boundedNumber(captureTimestampMs + (source.state.clockAlignment.offsetMs || 0), 'aligned-timestamp', 0, MOTION_CAPTURE_MAX_TIME_MS)
      : null
    source.quality.receivedSamples += 1
    if (sequence === null) source.quality.unsequencedSamples += 1
    const outOfOrder = (source.previousCaptureTimestampMs !== null && captureTimestampMs <= source.previousCaptureTimestampMs)
      || (sequence !== null && source.previousSequence !== null && sequence <= source.previousSequence)
    if (outOfOrder) {
      source.quality.outOfOrderSamples += 1
      if (recordingStatus === 'recording') {
        const evaluation = evaluateMotionCaptureSessionEvidence(sourceStates(), sharedReconstruction, readNow(), limits)
        const epoch = buildMotionCaptureResearchEvidenceEpoch(
          evaluation.researchSourceIds,
          researchSourceId => getSource(researchSourceId).researchEvidenceEpoch,
        )
        recordMotionCaptureSourceRejection(sourceRejections, sourceId, epoch)
      }
      source.state = Object.freeze({ ...source.state, quality: freezeMotionCaptureSourceQuality(source.quality) })
      return notify()
    }
    if (sequence !== null && source.previousSequence !== null && sequence > source.previousSequence + 1) {
      source.quality.droppedSequenceSamples += sequence - source.previousSequence - 1
    }
    if (source.previousCaptureTimestampMs !== null) {
      const interval = captureTimestampMs - source.previousCaptureTimestampMs
      source.quality.intervalCount += 1
      const delta = interval - source.quality.intervalMeanMs
      source.quality.intervalMeanMs += delta / source.quality.intervalCount
      source.quality.intervalM2 += delta * (interval - source.quality.intervalMeanMs)
    }
    source.previousCaptureTimestampMs = captureTimestampMs
    if (sequence !== null) source.previousSequence = sequence
    if (missing) source.quality.missingSamples += 1
    else {
      source.quality.usableSamples += 1
      if (researchEvidenceQualified) source.quality.researchUsableSamples += 1
      else source.quality.lowEvidenceSamples += 1
    }
    const quality = freezeMotionCaptureSourceQuality(source.quality)
    source.state = Object.freeze({
      ...source.state,
      quality,
      latestObservation: Object.freeze({
        captureTimestampMs,
        alignedTimestampMs,
        receivedAtMs,
        sequence,
        coordinateSpace: input.coordinateSpace,
        confidence,
        landmarkCount: landmarks.length,
        missing,
      }),
    })
    const evaluation = evaluateMotionCaptureSessionEvidence(sourceStates(), sharedReconstruction, readNow(), limits)
    const researchEvidenceEpoch = buildMotionCaptureResearchEvidenceEpoch(
      evaluation.researchSourceIds,
      researchSourceId => getSource(researchSourceId).researchEvidenceEpoch,
    )
    if (recordingStatus === 'recording') {
      if (recordedSamples.length >= limits.maxRecordingSamples) droppedByBudget += 1
      else {
        recordedSamples.push(Object.freeze({
          ordinal: recordedSamples.length,
          sourceId,
          captureTimestampMs,
          alignedTimestampMs,
          receivedAtMs,
          sequence,
          coordinateSpace: input.coordinateSpace,
          confidence,
          missing,
          landmarks,
          sourceQuality: quality,
          sessionEvidence: evaluation.evidence,
          sharedReconstructionId: evaluation.sharedReconstructionId,
          researchSourceIds: evaluation.researchSourceIds,
          researchEvidenceEpoch,
        }))
        recordedLandmarkCount += landmarks.length
      }
    }
    return notify()
  }

  const startRecording = (): MotionCaptureSessionSnapshot => {
    if (motionCapturePlatformTeardownActive()) throw new Error('motion-capture-platform-teardown-active')
    if (recordingStatus === 'recording') return getSnapshot()
    if (recordingStatus === 'stopped') throw new Error('motion-capture-recording-must-be-cleared')
    recordingStatus = 'recording'
    recordingRevision += 1
    recordingId = createOpaqueId('recording', idFactory)
    recordingStartedAtMs = readNow()
    recordingFinishedAtMs = null
    sourceRejections.clear()
    return notify()
  }

  const stopRecording = (): MotionCaptureSessionSnapshot => {
    if (recordingStatus !== 'recording') return getSnapshot()
    recordingStatus = 'stopped'
    recordingRevision += 1
    recordingFinishedAtMs = boundedNumber(readNow(), 'recording-finished-at', recordingStartedAtMs || 0, MOTION_CAPTURE_MAX_TIME_MS)
    return notify()
  }

  const clearRecording = (): MotionCaptureSessionSnapshot => {
    if (recordingStatus === 'idle' && recordedSamples.length === 0) return getSnapshot()
    recordingStatus = 'idle'
    recordingRevision += 1
    recordingId = null
    recordingStartedAtMs = null
    recordingFinishedAtMs = null
    recordedLandmarkCount = 0
    droppedByBudget = 0
    sourceRejections.clear()
    recordedSamples = []
    return notify()
  }

  const readRecording = (): MotionCaptureRecording | null => {
    if (recordingStatus === 'idle' || !recordingId || recordingStartedAtMs === null) return null
    return Object.freeze({
      schema: MOTION_CAPTURE_RECORDING_SCHEMA,
      recordingId,
      sessionId,
      status: recordingStatus,
      startedAtMs: recordingStartedAtMs,
      finishedAtMs: recordingFinishedAtMs,
      droppedByBudget,
      researchLimits: limits,
      sourceRejections: freezeMotionCaptureSourceRejections(sourceRejections),
      samples: Object.freeze([...recordedSamples]),
    })
  }

  const exportRecording = async (format: MotionCaptureExportFormat): Promise<MotionCaptureExportArtifact> => {
    const recording = readRecording()
    if (!recording || recording.status !== 'stopped') throw new Error('motion-capture-recording-not-finished')
    const exportFence = recordingRevision
    const artifact = await buildMotionCaptureExport(recording, format)
    if (recordingRevision !== exportFence || recordingId !== recording.recordingId || recordingStatus !== 'stopped') {
      throw new Error('motion-capture-export-invalidated')
    }
    return artifact
  }

  return Object.freeze({
    getSnapshot,
    subscribe: (listener: RuntimeListener) => {
      listeners.add(listener)
      if (lastEvidenceSignature !== JSON.stringify(getSnapshot().evidence)) notify()
      else scheduleFreshnessExpiry()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && freshnessTimer !== null) clearTimeout(freshnessTimer)
        if (listeners.size === 0) freshnessTimer = null
      }
    },
    registerSource,
    removeSource,
    releaseAllSources,
    setSourceClockAlignment,
    setSourceCalibration,
    setSharedReconstructionEvidence,
    clearSharedReconstructionEvidence,
    ingestObservation,
    startRecording,
    stopRecording,
    clearRecording,
    readRecording,
    exportRecording,
  })
}
export const motionCaptureSessionRuntime = createMotionCaptureSessionRuntime()
export const readMotionCaptureSessionSnapshot = (): MotionCaptureSessionSnapshot => motionCaptureSessionRuntime.getSnapshot()
export const subscribeMotionCaptureSession = (listener: RuntimeListener): (() => void) => motionCaptureSessionRuntime.subscribe(listener)
