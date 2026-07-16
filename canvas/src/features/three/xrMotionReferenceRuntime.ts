import type { GraphNode } from '@/lib/graph/types'
import type { StrybldrCameraSettings } from '@/features/strybldr/strybldrCamera'
import {
  readXrMotionReferencePlan,
  resolveXrMotionReferenceStage,
  serializeXrMotionReferencePlan,
  XR_MOTION_REFERENCE_MAX_CAMERA_MARKS,
  XR_MOTION_REFERENCE_MAX_CAST_TRACKS,
  XR_MOTION_REFERENCE_MAX_CAST_MARKS,
  XR_MOTION_REFERENCE_MAX_SUBJECTS,
  type XrMotionReferencePlan,
  type XrMotionReferenceStageId,
  type XrMotionReferenceTransition,
  type XrMotionReferenceVector,
} from '@/features/three/xrMotionReferenceModel'
import { resolveXrSceneLibraryAsset } from '@/features/three/xrSceneLibrary'

export type XrMotionReferenceRuntimeSnapshot = Readonly<{
  sceneKey: string
  sourceSignature: string
  plan: XrMotionReferencePlan
  selectedActorId: string
  playheadSeconds: number
  dirty: boolean
  revision: number
}>

type RuntimeListener = () => void

const listeners = new Set<RuntimeListener>()
let activeNodes: readonly GraphNode[] = []
const dirtyCastArchive = new Map<string, Record<string, unknown>>()

function sourceSignature(sceneKey: string, nodes: readonly GraphNode[], persistedValue: unknown): string {
  return JSON.stringify({
    sceneKey: String(sceneKey || ''),
    nodes: nodes.map(node => [node.id, node.label]),
    persistedValue: persistedValue ?? null,
  })
}

function freezeSnapshot(value: Omit<XrMotionReferenceRuntimeSnapshot, 'revision'> & { revision: number }): XrMotionReferenceRuntimeSnapshot {
  return Object.freeze({ ...value })
}

let snapshot = freezeSnapshot({
  sceneKey: '',
  sourceSignature: '',
  plan: readXrMotionReferencePlan(null, []),
  selectedActorId: '',
  playheadSeconds: 0,
  dirty: false,
  revision: 0,
})

function publish(next: Omit<XrMotionReferenceRuntimeSnapshot, 'revision'>): XrMotionReferenceRuntimeSnapshot {
  snapshot = freezeSnapshot({ ...next, revision: snapshot.revision + 1 })
  for (const listener of [...listeners]) listener()
  return snapshot
}

function planRecord(plan: XrMotionReferencePlan): Record<string, unknown> {
  return serializeXrMotionReferencePlan(plan) as Record<string, unknown>
}

function normalizePlan(value: Record<string, unknown>): XrMotionReferencePlan {
  return readXrMotionReferencePlan(value, activeNodes)
}

function archiveCast(plan: XrMotionReferencePlan): void {
  const cast = planRecord(plan).cast
  if (!Array.isArray(cast)) return
  for (const item of cast) {
    const record = item as Record<string, unknown>
    const actorId = String(record.actorId || '').trim()
    if (actorId) dirtyCastArchive.set(actorId, record)
  }
}

function updatePlan(value: Record<string, unknown>): XrMotionReferenceRuntimeSnapshot {
  const plan = normalizePlan(value)
  archiveCast(plan)
  const selectedActorId = plan.cast.some(track => track.actorId === snapshot.selectedActorId)
    ? snapshot.selectedActorId
    : plan.cast[0]?.actorId || ''
  return publish({
    ...snapshot,
    plan,
    selectedActorId,
    playheadSeconds: Math.min(snapshot.playheadSeconds, plan.durationSeconds),
    dirty: true,
  })
}

export function readXrMotionReferenceRuntime(): XrMotionReferenceRuntimeSnapshot {
  return snapshot
}

export function subscribeXrMotionReferenceRuntime(listener: RuntimeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function hydrateXrMotionReferenceRuntime(args: {
  sceneKey: string
  nodes: readonly GraphNode[]
  persistedValue: unknown
}): XrMotionReferenceRuntimeSnapshot {
  const nextSourceSignature = sourceSignature(args.sceneKey, args.nodes, args.persistedValue)
  if (snapshot.sourceSignature === nextSourceSignature) return snapshot
  activeNodes = args.nodes.slice()
  if (snapshot.sceneKey === String(args.sceneKey || '') && snapshot.dirty) {
    archiveCast(snapshot.plan)
    const plan = readXrMotionReferencePlan({ ...planRecord(snapshot.plan), cast: [...dirtyCastArchive.values()] }, activeNodes)
    archiveCast(plan)
    const selectedActorId = plan.cast.some(track => track.actorId === snapshot.selectedActorId)
      ? snapshot.selectedActorId
      : plan.cast[0]?.actorId || ''
    return publish({ ...snapshot, sourceSignature: nextSourceSignature, plan, selectedActorId, dirty: true })
  }
  dirtyCastArchive.clear()
  const plan = readXrMotionReferencePlan(args.persistedValue, activeNodes)
  const selectedActorId = plan.cast.some(track => track.actorId === snapshot.selectedActorId)
    ? snapshot.selectedActorId
    : plan.cast[0]?.actorId || ''
  return publish({
    sceneKey: String(args.sceneKey || ''),
    sourceSignature: nextSourceSignature,
    plan,
    selectedActorId,
    playheadSeconds: 0,
    dirty: false,
  })
}

export function setXrMotionReferenceStage(stageId: XrMotionReferenceStageId): XrMotionReferenceRuntimeSnapshot {
  return updatePlan({ ...planRecord(snapshot.plan), stageId })
}

export function setXrMotionReferenceDuration(durationSeconds: number): XrMotionReferenceRuntimeSnapshot {
  return updatePlan({ ...planRecord(snapshot.plan), durationSeconds })
}

export function setXrMotionReferenceFps(fps: number): XrMotionReferenceRuntimeSnapshot {
  return updatePlan({ ...planRecord(snapshot.plan), fps })
}

function nextSubjectPlacement(index: number): XrMotionReferenceVector {
  const stage = resolveXrMotionReferenceStage(snapshot.plan.stageId)
  const columns = Math.max(2, Math.min(6, Math.floor(stage.sizeMeters[0] / 4)))
  const column = index % columns
  const row = Math.floor(index / columns)
  const xStep = Math.min(3.2, stage.sizeMeters[0] / Math.max(columns + 1, 1))
  const zStep = Math.min(3.2, stage.sizeMeters[1] / 5)
  return [
    Number(((column - (columns - 1) / 2) * xStep).toFixed(3)),
    0,
    Number((Math.min(stage.sizeMeters[1] * 0.32, row * zStep) - stage.sizeMeters[1] * 0.16).toFixed(3)),
  ]
}

function nextSubjectId(assetId: string): string {
  const prefix = `xr-subject:${assetId}:`
  const used = new Set(snapshot.plan.subjects.map(subject => subject.id))
  let ordinal = 1
  while (used.has(`${prefix}${ordinal}`) && ordinal <= XR_MOTION_REFERENCE_MAX_SUBJECTS) ordinal += 1
  return `${prefix}${ordinal}`
}

export function addXrMotionReferenceSubject(args: {
  assetId: string
  label?: string
}): XrMotionReferenceRuntimeSnapshot {
  if (snapshot.plan.subjects.length >= XR_MOTION_REFERENCE_MAX_SUBJECTS) return snapshot
  const asset = resolveXrSceneLibraryAsset(args.assetId)
  const plan = planRecord(snapshot.plan)
  const id = nextSubjectId(asset.id)
  const label = String(args.label || asset.label).trim().slice(0, 80) || asset.label
  const position = nextSubjectPlacement(snapshot.plan.subjects.length)
  const subjects = Array.isArray(plan.subjects) ? plan.subjects.slice() : []
  subjects.push({ id, assetId: asset.id, label, color: asset.defaultColor, position: [...position], rotationYDegrees: 0, scale: 1 })
  const cast = Array.isArray(plan.cast) ? plan.cast.slice() : []
  if (asset.mobile && cast.length < XR_MOTION_REFERENCE_MAX_CAST_TRACKS) {
    cast.push({ actorId: id, label, marks: [{ timeSeconds: 0, position: [...position], transition: 'linear' }] })
  }
  return updatePlan({ ...plan, subjects, cast })
}

export function setXrMotionReferenceSubjectLabel(subjectIdValue: string, nextLabelValue: string): XrMotionReferenceRuntimeSnapshot {
  const subjectId = String(subjectIdValue || '').trim()
  const nextLabel = String(nextLabelValue || '').trim().slice(0, 80)
  if (!subjectId || !nextLabel) return snapshot
  const plan = planRecord(snapshot.plan)
  const subjects = snapshot.plan.subjects.map(subject => (
    subject.id === subjectId ? { ...subject, label: nextLabel } : subject
  ))
  if (!subjects.some(subject => subject.id === subjectId)) return snapshot
  const cast = snapshot.plan.cast.map(track => (
    track.actorId === subjectId
      ? { actorId: track.actorId, label: nextLabel, marks: track.marks.map(mark => ({ timeSeconds: mark.timeSeconds, position: [...mark.position], transition: mark.transition })) }
      : { actorId: track.actorId, label: track.label, marks: track.marks.map(mark => ({ timeSeconds: mark.timeSeconds, position: [...mark.position], transition: mark.transition })) }
  ))
  return updatePlan({ ...plan, subjects, cast })
}

export function removeXrMotionReferenceSubject(subjectIdValue: string): XrMotionReferenceRuntimeSnapshot {
  const subjectId = String(subjectIdValue || '').trim()
  if (!snapshot.plan.subjects.some(subject => subject.id === subjectId)) return snapshot
  const plan = planRecord(snapshot.plan)
  const subjects = snapshot.plan.subjects.filter(subject => subject.id !== subjectId)
  const cast = snapshot.plan.cast
    .filter(track => track.actorId !== subjectId)
    .map(track => ({ actorId: track.actorId, label: track.label, marks: track.marks.map(mark => ({ timeSeconds: mark.timeSeconds, position: [...mark.position], transition: mark.transition })) }))
  return updatePlan({ ...plan, subjects, cast })
}

export function setXrMotionReferencePlayhead(timeSeconds: number): XrMotionReferenceRuntimeSnapshot {
  const playheadSeconds = Math.min(snapshot.plan.durationSeconds, Math.max(0, Number(timeSeconds) || 0))
  if (playheadSeconds === snapshot.playheadSeconds) return snapshot
  return publish({ ...snapshot, playheadSeconds })
}

export function selectXrMotionReferenceActor(actorId: string): XrMotionReferenceRuntimeSnapshot {
  const normalized = String(actorId || '').trim()
  if (!snapshot.plan.cast.some(track => track.actorId === normalized) || normalized === snapshot.selectedActorId) return snapshot
  return publish({ ...snapshot, selectedActorId: normalized })
}

export function setXrMotionReferenceCastMark(args: {
  actorId: string
  timeSeconds: number
  position: XrMotionReferenceVector
  transition?: XrMotionReferenceTransition
}): XrMotionReferenceRuntimeSnapshot {
  const actorId = String(args.actorId || '').trim()
  const plan = planRecord(snapshot.plan)
  const cast = Array.isArray(plan.cast) ? plan.cast.map(item => ({ ...(item as Record<string, unknown>) })) : []
  const track = cast.find(item => item.actorId === actorId)
  if (!track) return snapshot
  const marks = Array.isArray(track.marks) ? track.marks.slice() : []
  const replacing = marks.some(mark => Math.abs(Number((mark as Record<string, unknown>).timeSeconds) - args.timeSeconds) < 0.0005)
  if (marks.length >= XR_MOTION_REFERENCE_MAX_CAST_MARKS && !replacing) return snapshot
  marks.push({
    timeSeconds: args.timeSeconds,
    position: [...args.position],
    transition: args.transition || 'linear',
  })
  track.marks = marks
  return updatePlan({ ...plan, cast })
}

export function removeXrMotionReferenceCastMark(actorIdValue: string, markId: string): XrMotionReferenceRuntimeSnapshot {
  const actorId = String(actorIdValue || '').trim()
  const plan = planRecord(snapshot.plan)
  const sourceTrack = snapshot.plan.cast.find(track => track.actorId === actorId)
  if (!sourceTrack || sourceTrack.marks.length <= 1) return snapshot
  const cast = snapshot.plan.cast.map(track => ({
    actorId: track.actorId,
    label: track.label,
    marks: track.marks
      .filter(mark => track.actorId !== actorId || mark.id !== markId)
      .map(mark => ({ timeSeconds: mark.timeSeconds, position: [...mark.position], transition: mark.transition })),
  }))
  return updatePlan({ ...plan, cast })
}

export function setXrMotionReferenceCameraMark(args: {
  timeSeconds: number
  anchorId: string
  settings: StrybldrCameraSettings
}): XrMotionReferenceRuntimeSnapshot {
  const plan = planRecord(snapshot.plan)
  const camera = Array.isArray(plan.camera) ? plan.camera.slice() : []
  const replacing = camera.some(mark => Math.abs(Number((mark as Record<string, unknown>).timeSeconds) - args.timeSeconds) < 0.0005)
  if (camera.length >= XR_MOTION_REFERENCE_MAX_CAMERA_MARKS && !replacing) return snapshot
  camera.push({
    timeSeconds: args.timeSeconds,
    anchorId: String(args.anchorId || '').trim(),
    settings: { ...args.settings },
  })
  return updatePlan({ ...plan, camera })
}

export function removeXrMotionReferenceCameraMark(markId: string): XrMotionReferenceRuntimeSnapshot {
  const plan = planRecord(snapshot.plan)
  const camera = snapshot.plan.camera
    .filter(mark => mark.id !== markId)
    .map(mark => ({
      timeSeconds: mark.timeSeconds,
      anchorId: mark.anchorId,
      settings: { ...mark.settings },
    }))
  return updatePlan({ ...plan, camera })
}

export function markXrMotionReferenceSaved(persistedValue: unknown): XrMotionReferenceRuntimeSnapshot {
  const nextSourceSignature = sourceSignature(snapshot.sceneKey, activeNodes, persistedValue)
  dirtyCastArchive.clear()
  return publish({ ...snapshot, sourceSignature: nextSourceSignature, dirty: false })
}
