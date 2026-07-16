import type { GraphNode } from '@/lib/graph/types'
import type { StrybldrCameraSettings } from '@/features/strybldr/strybldrCamera'
import {
  readXrMotionReferencePlan,
  serializeXrMotionReferencePlan,
  XR_MOTION_REFERENCE_MAX_CAMERA_MARKS,
  XR_MOTION_REFERENCE_MAX_CAST_MARKS,
  type XrMotionReferencePlan,
  type XrMotionReferenceStageId,
  type XrMotionReferenceTransition,
  type XrMotionReferenceVector,
} from '@/features/three/xrMotionReferenceModel'

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
