import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { resolveCameraFramingPose, type CameraFramingPose } from '@/lib/camera/cameraFramingPose'
import {
  readStrybldrCameraSettings,
  serializeStrybldrCameraSettings,
  type StrybldrCameraSettings,
} from '@/features/strybldr/strybldrCamera'
import {
  XR_MOTION_REFERENCE_STAGE_PRESETS,
  isXrSceneLibraryAssetId,
  resolveXrMotionReferenceStage,
  resolveXrSceneLibraryAsset,
  type XrMotionReferenceStageId,
  type XrMotionReferenceVector,
} from '@/features/three/xrSceneLibrary'

export {
  XR_MOTION_REFERENCE_STAGE_PRESETS,
  resolveXrMotionReferenceStage,
} from '@/features/three/xrSceneLibrary'
export type {
  XrGreyBoxStructure,
  XrMotionReferenceStageId,
  XrMotionReferenceStagePreset,
  XrMotionReferenceVector,
} from '@/features/three/xrSceneLibrary'

export const XR_MOTION_REFERENCE_GRAPH_METADATA_KEY = 'kgXrMotionReference'
export const XR_MOTION_REFERENCE_SCHEMA = 'knowgrph-xr-motion-reference/v1'
export const XR_MOTION_REFERENCE_PACKAGE_SCHEMA = 'knowgrph-xr-motion-reference-package/v1'

export type XrMotionReferenceTransition = 'linear' | 'hold'

export type XrMotionReferenceMark = Readonly<{
  id: string
  timeSeconds: number
  position: XrMotionReferenceVector
  transition: XrMotionReferenceTransition
}>

export type XrMotionReferenceCastTrack = Readonly<{
  actorId: string
  label: string
  color: string
  marks: readonly XrMotionReferenceMark[]
}>

export type XrMotionReferenceCameraMark = Readonly<{
  id: string
  timeSeconds: number
  anchorId: string
  settings: Readonly<StrybldrCameraSettings>
  pose: CameraFramingPose
}>

export type XrMotionReferenceSubject = Readonly<{
  id: string
  assetId: string
  category: 'people' | 'animals' | 'vehicles' | 'furniture' | 'props'
  label: string
  color: string
  position: XrMotionReferenceVector
  rotationYDegrees: number
  scale: number
}>

export type XrMotionReferencePlan = Readonly<{
  schema: typeof XR_MOTION_REFERENCE_SCHEMA
  stageId: XrMotionReferenceStageId
  durationSeconds: number
  fps: number
  subjects: readonly XrMotionReferenceSubject[]
  cast: readonly XrMotionReferenceCastTrack[]
  camera: readonly XrMotionReferenceCameraMark[]
}>

export type XrMotionReferencePackageFile = Readonly<{
  path: string
  mimeType: string
  text: string
}>

export type XrMotionReferencePackage = Readonly<{
  schema: typeof XR_MOTION_REFERENCE_PACKAGE_SCHEMA
  packageId: string
  title: string
  referenceBoundary: Readonly<{
    implementation: 'native-knowgrph'
    inspirationCitation: 'documentation-only'
    copyPolicy: 'no-external-code-assets-or-schemas'
    dependencyPolicy: 'no-external-runtime'
    runtimeDependency: false
  }>
  source: Readonly<{
    documentName: string
    graphFingerprint: string
    motionFingerprint: string
    graphType: string
    nodeCount: number
    edgeCount: number
  }>
  stage: Readonly<{
    id: XrMotionReferenceStageId
    label: string
    sizeMeters: readonly [number, number]
  }>
  timeline: Readonly<{
    durationSeconds: number
    fps: number
    frameCount: number
  }>
  files: readonly XrMotionReferencePackageFile[]
}>

export const XR_MOTION_REFERENCE_MAX_CAST_TRACKS = 12
export const XR_MOTION_REFERENCE_MAX_SUBJECTS = 48
export const XR_MOTION_REFERENCE_MAX_CAST_MARKS = 32
export const XR_MOTION_REFERENCE_MAX_CAMERA_MARKS = 32
const MIN_DURATION_SECONDS = 1
const MAX_DURATION_SECONDS = 30
const MIN_FPS = 6
const MAX_FPS = 30
const MAX_COORDINATE_METERS = 50
export const XR_MOTION_REFERENCE_CAMERA_BASELINE_METERS = 8

const CAST_COLORS = [
  '#38bdf8', '#f97316', '#a78bfa', '#22c55e', '#f43f5e', '#eab308',
  '#14b8a6', '#ec4899', '#60a5fa', '#84cc16', '#fb7185', '#c084fc',
] as const

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round(value: number, places = 4): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

function normalizeDuration(value: unknown): number {
  return round(clamp(finiteNumber(value, 6), MIN_DURATION_SECONDS, MAX_DURATION_SECONDS), 2)
}

function normalizeFps(value: unknown): number {
  return Math.round(clamp(finiteNumber(value, 12), MIN_FPS, MAX_FPS))
}

function normalizeTime(value: unknown, durationSeconds: number): number {
  return round(clamp(finiteNumber(value, 0), 0, durationSeconds), 3)
}

function normalizeVector(value: unknown, fallback: XrMotionReferenceVector = [0, 0, 0]): XrMotionReferenceVector {
  if (!Array.isArray(value) || value.length < 3) return Object.freeze([...fallback]) as unknown as XrMotionReferenceVector
  return Object.freeze([
    round(clamp(finiteNumber(value[0], fallback[0]), -MAX_COORDINATE_METERS, MAX_COORDINATE_METERS)),
    round(clamp(finiteNumber(value[1], fallback[1]), 0, MAX_COORDINATE_METERS)),
    round(clamp(finiteNumber(value[2], fallback[2]), -MAX_COORDINATE_METERS, MAX_COORDINATE_METERS)),
  ]) as unknown as XrMotionReferenceVector
}

function normalizeStageId(value: unknown): XrMotionReferenceStageId {
  const id = String(value || '').trim()
  return XR_MOTION_REFERENCE_STAGE_PRESETS.some(preset => preset.id === id)
    ? id as XrMotionReferenceStageId
    : 'neutral-volume'
}

function normalizeTransition(value: unknown): XrMotionReferenceTransition {
  return value === 'hold' ? 'hold' : 'linear'
}

function defaultActorPosition(index: number): XrMotionReferenceVector {
  const column = index % 4
  const row = Math.floor(index / 4)
  return [round((column - 1.5) * 2.4), 0, round((row - 0.5) * 2.8)]
}

function stableMarkId(prefix: string, timeSeconds: number): string {
  return `${prefix}:${Math.round(timeSeconds * 1000)}`
}

function boundedSourceWithLatest(value: unknown, max: number): unknown[] {
  const source = Array.isArray(value) ? value : []
  return source.length > max ? [...source.slice(0, max), source[source.length - 1]] : source
}

function normalizeMarks(value: unknown, actorId: string, durationSeconds: number, fallbackPosition: XrMotionReferenceVector): readonly XrMotionReferenceMark[] {
  const source = boundedSourceWithLatest(value, XR_MOTION_REFERENCE_MAX_CAST_MARKS)
  const marks = source.map((item, index) => {
    const record = asRecord(item)
    const timeSeconds = normalizeTime(record.timeSeconds, durationSeconds)
    return Object.freeze({
      id: stableMarkId(`cast:${actorId}`, timeSeconds),
      timeSeconds,
      position: normalizeVector(record.position, fallbackPosition),
      transition: normalizeTransition(record.transition),
      index,
    })
  })
  if (marks.length === 0) {
    marks.push(Object.freeze({
      id: stableMarkId(`cast:${actorId}`, 0),
      timeSeconds: 0,
      position: fallbackPosition,
      transition: 'linear' as const,
      index: 0,
    }))
  }
  const byTime = new Map<number, (typeof marks)[number]>()
  marks.forEach(mark => byTime.set(mark.timeSeconds, mark))
  return Object.freeze([...byTime.values()]
    .sort((left, right) => left.timeSeconds - right.timeSeconds || left.index - right.index)
    .slice(0, XR_MOTION_REFERENCE_MAX_CAST_MARKS)
    .map(({ index: _index, ...mark }) => Object.freeze(mark)))
}

function normalizeCameraMarks(
  value: unknown,
  durationSeconds: number,
  cast: readonly XrMotionReferenceCastTrack[],
): readonly XrMotionReferenceCameraMark[] {
  const source = boundedSourceWithLatest(value, XR_MOTION_REFERENCE_MAX_CAMERA_MARKS)
  const marks = source.map((item, index) => {
    const record = asRecord(item)
    const timeSeconds = normalizeTime(record.timeSeconds, durationSeconds)
    const anchorId = String(record.anchorId || '').trim()
    const anchorTrack = cast.find(track => track.actorId === anchorId)
    const target = anchorTrack
      ? sampleXrMotionReferenceMarks(anchorTrack.marks, timeSeconds)
      : [0, 0, 0] as const
    const settings = Object.freeze(readStrybldrCameraSettings(record.settings))
    return {
      id: stableMarkId('camera', timeSeconds),
      timeSeconds,
      anchorId,
      settings,
      pose: resolveCameraFramingPose({ settings, target, baseDistance: XR_MOTION_REFERENCE_CAMERA_BASELINE_METERS }),
      index,
    }
  })
  const byTime = new Map<number, (typeof marks)[number]>()
  marks.forEach(mark => byTime.set(mark.timeSeconds, mark))
  return Object.freeze([...byTime.values()]
    .sort((left, right) => left.timeSeconds - right.timeSeconds || left.index - right.index)
    .slice(0, XR_MOTION_REFERENCE_MAX_CAMERA_MARKS)
    .map(({ index: _index, ...mark }) => Object.freeze(mark)))
}

function resolveCast(
  nodes: readonly GraphNode[],
  value: unknown,
  durationSeconds: number,
  preservedActorIds: ReadonlySet<string>,
): readonly XrMotionReferenceCastTrack[] {
  const savedRecords = (Array.isArray(value) ? value : [])
    .map(item => asRecord(item))
    .filter(item => String(item.actorId || '').trim())
  const savedById = new Map(savedRecords.map(item => [String(item.actorId || '').trim(), item] as const))
  const graphActors = nodes.map(node => ({
    actorId: String(node.id || '').trim(),
    label: String(node.label || '').trim(),
  }))
  const graphActorIds = new Set(graphActors.map(actor => actor.actorId))
  const savedActors = savedRecords
    .map(saved => ({ actorId: String(saved.actorId || '').trim(), label: String(saved.label || '').trim() }))
    .filter(actor => actor.actorId && !graphActorIds.has(actor.actorId) && preservedActorIds.has(actor.actorId))
  return Object.freeze([...graphActors, ...savedActors].slice(0, XR_MOTION_REFERENCE_MAX_CAST_TRACKS).map((actor, index) => {
    const actorId = actor.actorId || `actor-${index + 1}`
    const saved = savedById.get(actorId) || {}
    const fallbackPosition = defaultActorPosition(index)
    return Object.freeze({
      actorId,
      label: String(actor.label || saved.label || actorId).trim().slice(0, 80) || actorId,
      color: CAST_COLORS[index % CAST_COLORS.length],
      marks: normalizeMarks(saved.marks, actorId, durationSeconds, fallbackPosition),
    })
  }))
}

function normalizeSubjects(value: unknown): readonly XrMotionReferenceSubject[] {
  const byId = new Map<string, XrMotionReferenceSubject>()
  const source = Array.isArray(value) ? value.slice(0, XR_MOTION_REFERENCE_MAX_SUBJECTS) : []
  source.forEach((item, index) => {
    const record = asRecord(item)
    if (!isXrSceneLibraryAssetId(record.assetId)) return
    const asset = resolveXrSceneLibraryAsset(String(record.assetId || ''))
    const id = String(record.id || '').trim().slice(0, 96) || `xr-subject:${asset.id}:${index + 1}`
    const rawColor = String(record.color || '').trim()
    byId.set(id, Object.freeze({
      id,
      assetId: asset.id,
      category: asset.category,
      label: String(record.label || asset.label).trim().slice(0, 80) || asset.label,
      color: /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor.toLowerCase() : asset.defaultColor,
      position: normalizeVector(record.position),
      rotationYDegrees: round(clamp(finiteNumber(record.rotationYDegrees, 0), -180, 180), 2),
      scale: round(clamp(finiteNumber(record.scale, 1), 0.25, 4), 3),
    }))
  })
  return Object.freeze([...byId.values()])
}

export function readXrMotionReferencePlan(value: unknown, nodes: readonly GraphNode[] = []): XrMotionReferencePlan {
  const record = asRecord(value)
  const durationSeconds = normalizeDuration(record.durationSeconds)
  const subjects = normalizeSubjects(record.subjects)
  const cast = resolveCast(nodes, record.cast, durationSeconds, new Set(subjects.map(subject => subject.id)))
  return Object.freeze({
    schema: XR_MOTION_REFERENCE_SCHEMA,
    stageId: normalizeStageId(record.stageId),
    durationSeconds,
    fps: normalizeFps(record.fps),
    subjects,
    cast,
    camera: normalizeCameraMarks(record.camera, durationSeconds, cast),
  })
}

export function xrMotionReferenceSceneKey(documentName: string, graphData: GraphData | null): string {
  return `${String(documentName || 'Untitled')}|${graphData?.type || 'Graph'}`
}

export function serializeXrMotionReferencePlan(plan: XrMotionReferencePlan): JSONValue {
  return {
    schema: XR_MOTION_REFERENCE_SCHEMA,
    stageId: plan.stageId,
    durationSeconds: plan.durationSeconds,
    fps: plan.fps,
    subjects: plan.subjects.map(subject => ({
      id: subject.id,
      assetId: subject.assetId,
      label: subject.label,
      color: subject.color,
      position: [...subject.position],
      rotationYDegrees: subject.rotationYDegrees,
      scale: subject.scale,
    })),
    cast: plan.cast.map(track => ({
      actorId: track.actorId,
      label: track.label,
      marks: track.marks.map(mark => ({
        timeSeconds: mark.timeSeconds,
        position: [...mark.position],
        transition: mark.transition,
      })),
    })),
    camera: plan.camera.map(mark => ({
      timeSeconds: mark.timeSeconds,
      anchorId: mark.anchorId,
      settings: serializeStrybldrCameraSettings(mark.settings),
    })),
  } as JSONValue
}

function interpolateVector(left: XrMotionReferenceVector, right: XrMotionReferenceVector, progress: number): XrMotionReferenceVector {
  return [
    round(left[0] + (right[0] - left[0]) * progress),
    round(left[1] + (right[1] - left[1]) * progress),
    round(left[2] + (right[2] - left[2]) * progress),
  ]
}

function normalizeDirection(vector: XrMotionReferenceVector): XrMotionReferenceVector {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (!(length > 0.000001)) return [0, 1, 0]
  return [round(vector[0] / length), round(vector[1] / length), round(vector[2] / length)]
}

export function sampleXrMotionReferenceMarks(marks: readonly XrMotionReferenceMark[], timeSeconds: number): XrMotionReferenceVector {
  if (marks.length === 0) return [0, 0, 0]
  if (timeSeconds <= marks[0]!.timeSeconds) return marks[0]!.position
  const last = marks[marks.length - 1]!
  if (timeSeconds >= last.timeSeconds) return last.position
  for (let index = 1; index < marks.length; index += 1) {
    const right = marks[index]!
    if (timeSeconds > right.timeSeconds) continue
    const left = marks[index - 1]!
    if (Math.abs(timeSeconds - right.timeSeconds) < 0.000001) return right.position
    if (left.transition === 'hold') return left.position
    const span = Math.max(0.001, right.timeSeconds - left.timeSeconds)
    return interpolateVector(left.position, right.position, clamp((timeSeconds - left.timeSeconds) / span, 0, 1))
  }
  return last.position
}

export function sampleXrMotionReferenceCameraPose(marks: readonly XrMotionReferenceCameraMark[], timeSeconds: number): CameraFramingPose | null {
  if (marks.length === 0) return null
  if (timeSeconds <= marks[0]!.timeSeconds) return marks[0]!.pose
  const last = marks[marks.length - 1]!
  if (timeSeconds >= last.timeSeconds) return last.pose
  for (let index = 1; index < marks.length; index += 1) {
    const right = marks[index]!
    if (timeSeconds > right.timeSeconds) continue
    const left = marks[index - 1]!
    const span = Math.max(0.001, right.timeSeconds - left.timeSeconds)
    const progress = clamp((timeSeconds - left.timeSeconds) / span, 0, 1)
    return Object.freeze({
      position: interpolateVector(left.pose.position, right.pose.position, progress),
      target: interpolateVector(left.pose.target, right.pose.target, progress),
      up: normalizeDirection(interpolateVector(left.pose.up, right.pose.up, progress)),
    })
  }
  return last.pose
}
