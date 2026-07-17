import type { GraphNode } from '@/lib/graph/types'
import type { StrybldrCameraSettings } from '@/features/strybldr/strybldrCamera'
import {
  readXrMotionReferencePlan,
  resolveXrMotionReferenceStage,
  sampleXrMotionReferenceMarks,
  XR_MOTION_REFERENCE_MAX_CAMERA_MARKS,
  XR_MOTION_REFERENCE_MAX_CAST_TRACKS,
  XR_MOTION_REFERENCE_MAX_CAST_MARKS,
  XR_MOTION_REFERENCE_MAX_SUBJECTS,
  type XrMotionReferencePlan,
  type XrMotionReferenceCameraRig,
  type XrMotionReferenceStageId,
  type XrMotionReferenceTransition,
  type XrMotionReferenceVector,
} from '@/features/three/xrMotionReferenceModel'
import {
  defaultXrCameraEasing,
  defaultXrChoreographyGait,
  type XrChoreographyEasing,
  type XrChoreographyGait,
} from './xrChoreographyEasing'
import {
  xrMotionReferenceCastTrackRecord as castTrackRecord,
  xrMotionReferencePlanRecord as planRecord,
  xrMotionReferenceSourceSignature as sourceSignature,
} from './xrMotionReferenceRuntimeRecords'
import {
  buildCameraMarkChoreographyEdit,
  buildCastMarkChoreographyEdit,
} from './xrMotionReferenceChoreographyEdits'
import { resolveXrSceneLibraryAsset } from '@/features/three/xrSceneLibrary'
import {
  buildXrAnimationActionPath,
  isXrAnimationPresetId,
  resolveXrAnimationPreset,
  xrAnimationPresetCompatible,
  type XrAnimationAssignment,
  type XrAnimationPresetId,
} from '@/features/three/xrAnimationCatalog'
export type XrMotionReferenceMarkSelection =
  | Readonly<{ kind: 'cast'; actorId: string; markId: string }>
  | Readonly<{ kind: 'camera'; markId: string }>
  | null
export type XrMotionReferenceRuntimeSnapshot = Readonly<{
  sceneKey: string
  sourceSignature: string
  plan: XrMotionReferencePlan
  selectedActorId: string
  selectedCameraRig: XrMotionReferenceCameraRig
  selectedMark: XrMotionReferenceMarkSelection
  castMarkArmed: boolean
  playheadSeconds: number
  dirty: boolean
  revision: number
}>
type RuntimeListener = () => void
const listeners = new Set<RuntimeListener>()
let activeNodes: readonly GraphNode[] = []
const dirtyCastArchive = new Map<string, Record<string, unknown>>()
function freezeSnapshot(value: Omit<XrMotionReferenceRuntimeSnapshot, 'revision'> & { revision: number }): XrMotionReferenceRuntimeSnapshot {
  return Object.freeze({ ...value })
}
let snapshot = freezeSnapshot({
  sceneKey: '',
  sourceSignature: '',
  plan: readXrMotionReferencePlan(null, []),
  selectedActorId: '',
  selectedCameraRig: 'dolly',
  selectedMark: null,
  castMarkArmed: false,
  playheadSeconds: 0,
  dirty: false,
  revision: 0,
})
function publish(next: Omit<XrMotionReferenceRuntimeSnapshot, 'revision'>): XrMotionReferenceRuntimeSnapshot {
  snapshot = freezeSnapshot({ ...next, revision: snapshot.revision + 1 })
  for (const listener of [...listeners]) listener()
  return snapshot
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
function resolveSelectedMark(
  plan: XrMotionReferencePlan,
  selection: XrMotionReferenceMarkSelection,
): XrMotionReferenceMarkSelection {
  if (!selection) return null
  if (selection.kind === 'cast') {
    return plan.cast.some(track => (
      track.actorId === selection.actorId && track.marks.some(mark => mark.id === selection.markId)
    )) ? selection : null
  }
  return plan.camera.some(mark => mark.id === selection.markId) ? selection : null
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
    selectedMark: resolveSelectedMark(plan, snapshot.selectedMark),
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

export function restoreXrMotionReferenceRuntimeSnapshot(
  previous: XrMotionReferenceRuntimeSnapshot,
): XrMotionReferenceRuntimeSnapshot {
  dirtyCastArchive.clear()
  archiveCast(previous.plan)
  const { revision: _revision, ...restored } = previous
  return publish(restored)
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
    return publish({
      ...snapshot,
      sourceSignature: nextSourceSignature,
      plan,
      selectedActorId,
      selectedMark: resolveSelectedMark(plan, snapshot.selectedMark),
      dirty: true,
    })
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
    selectedCameraRig: snapshot.selectedCameraRig,
    selectedMark: null,
    castMarkArmed: false,
    playheadSeconds: 0,
    dirty: false,
  })
}

function rebuildAssignedActionPaths(args: {
  stageId: XrMotionReferenceStageId
  durationSeconds: number
}): readonly Record<string, unknown>[] {
  const stage = resolveXrMotionReferenceStage(args.stageId)
  return snapshot.plan.cast.map(track => {
    const record = castTrackRecord(track)
    const animation = track.animation
    if (animation?.kind !== 'action-path') return record
    return {
      ...record,
      marks: buildXrAnimationActionPath({
        presetId: animation.presetId,
        durationSeconds: args.durationSeconds,
        origin: track.marks[0]?.position || [0, 0, 0],
        stageSizeMeters: stage.sizeMeters,
      }),
    }
  })
}

export function setXrMotionReferenceStage(stageId: XrMotionReferenceStageId): XrMotionReferenceRuntimeSnapshot {
  return updatePlan({
    ...planRecord(snapshot.plan),
    stageId,
    cast: rebuildAssignedActionPaths({ stageId, durationSeconds: snapshot.plan.durationSeconds }),
  })
}

export function setXrMotionReferenceDuration(durationSeconds: number): XrMotionReferenceRuntimeSnapshot {
  const normalizedDuration = readXrMotionReferencePlan({ durationSeconds }).durationSeconds
  return updatePlan({
    ...planRecord(snapshot.plan),
    durationSeconds: normalizedDuration,
    cast: rebuildAssignedActionPaths({ stageId: snapshot.plan.stageId, durationSeconds: normalizedDuration }),
  })
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
    cast.push({ actorId: id, label, animation: null, marks: [{ timeSeconds: 0, position: [...position], transition: 'linear', gait: defaultXrChoreographyGait(asset.category, asset.id) }] })
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
  const cast = snapshot.plan.cast.map(track => ({
    ...castTrackRecord(track),
    label: track.actorId === subjectId ? nextLabel : track.label,
  }))
  return updatePlan({ ...plan, subjects, cast })
}

export function removeXrMotionReferenceSubject(subjectIdValue: string): XrMotionReferenceRuntimeSnapshot {
  const subjectId = String(subjectIdValue || '').trim()
  if (!snapshot.plan.subjects.some(subject => subject.id === subjectId)) return snapshot
  const plan = planRecord(snapshot.plan)
  const subjects = snapshot.plan.subjects.filter(subject => subject.id !== subjectId)
  const cast = snapshot.plan.cast
    .filter(track => track.actorId !== subjectId)
    .map(castTrackRecord)
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
  const selectedMark = snapshot.selectedMark?.kind === 'cast' && snapshot.selectedMark.actorId !== normalized
    ? null
    : snapshot.selectedMark
  return publish({ ...snapshot, selectedActorId: normalized, selectedMark })
}

export function selectXrMotionReferenceCastMark(
  actorIdValue: string,
  markIdValue: string,
): XrMotionReferenceRuntimeSnapshot {
  const actorId = String(actorIdValue || '').trim()
  const markId = String(markIdValue || '').trim()
  const track = snapshot.plan.cast.find(candidate => candidate.actorId === actorId)
  if (!track?.marks.some(mark => mark.id === markId)) return snapshot
  if (snapshot.selectedMark?.kind === 'cast'
    && snapshot.selectedMark.actorId === actorId
    && snapshot.selectedMark.markId === markId
    && snapshot.selectedActorId === actorId) return snapshot
  return publish({
    ...snapshot,
    selectedActorId: actorId,
    selectedMark: Object.freeze({ kind: 'cast', actorId, markId }),
  })
}

export function selectXrMotionReferenceCameraMark(markIdValue: string): XrMotionReferenceRuntimeSnapshot {
  const markId = String(markIdValue || '').trim()
  if (!snapshot.plan.camera.some(mark => mark.id === markId)) return snapshot
  if (snapshot.selectedMark?.kind === 'camera' && snapshot.selectedMark.markId === markId) return snapshot
  return publish({ ...snapshot, selectedMark: Object.freeze({ kind: 'camera', markId }) })
}

export function setXrMotionReferenceCameraRig(rig: XrMotionReferenceCameraRig): XrMotionReferenceRuntimeSnapshot {
  if (rig === snapshot.selectedCameraRig) return snapshot
  return publish({ ...snapshot, selectedCameraRig: rig })
}

export function setXrMotionReferenceCastMarkArmed(armed: boolean): XrMotionReferenceRuntimeSnapshot {
  const nextArmed = armed === true && Boolean(snapshot.selectedActorId)
  if (nextArmed === snapshot.castMarkArmed) return snapshot
  return publish({ ...snapshot, castMarkArmed: nextArmed })
}

export function toggleXrMotionReferenceCastMarkArmed(): XrMotionReferenceRuntimeSnapshot {
  return setXrMotionReferenceCastMarkArmed(!snapshot.castMarkArmed)
}

export function setXrMotionReferenceCastMark(args: {
  actorId: string
  timeSeconds: number
  position: XrMotionReferenceVector
  transition?: XrMotionReferenceTransition
  gait?: XrChoreographyGait
}): XrMotionReferenceRuntimeSnapshot {
  const actorId = String(args.actorId || '').trim()
  const sourceTrack = snapshot.plan.cast.find(candidate => candidate.actorId === actorId)
  if (!sourceTrack) return snapshot
  const subject = snapshot.plan.subjects.find(candidate => candidate.id === actorId)
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
    gait: args.gait || sourceTrack.marks[0]?.gait || defaultXrChoreographyGait(subject?.category, subject?.assetId),
  })
  track.marks = marks
  if ((track.animation as { kind?: unknown } | null)?.kind === 'action-path') track.animation = null
  return updatePlan({ ...plan, cast })
}

export function dropXrMotionReferenceCastMark(position: XrMotionReferenceVector): XrMotionReferenceRuntimeSnapshot {
  if (!snapshot.castMarkArmed || !snapshot.selectedActorId) return snapshot
  return setXrMotionReferenceCastMark({
    actorId: snapshot.selectedActorId,
    timeSeconds: snapshot.playheadSeconds,
    position,
    transition: 'linear',
    gait: snapshot.plan.cast.find(track => track.actorId === snapshot.selectedActorId)?.marks[0]?.gait || 'walk',
  })
}

export function setXrMotionReferenceCastTransition(
  actorIdValue: string,
  transition: XrMotionReferenceTransition,
): XrMotionReferenceRuntimeSnapshot {
  const actorId = String(actorIdValue || '').trim()
  const sourceTrack = snapshot.plan.cast.find(track => track.actorId === actorId)
  if (!sourceTrack) return snapshot
  const plan = planRecord(snapshot.plan)
  const cast = snapshot.plan.cast.map(track => {
    if (track.actorId !== actorId) {
      return castTrackRecord(track)
    }
    const marks = track.marks.map(mark => ({
      timeSeconds: mark.timeSeconds,
      position: [...mark.position],
      transition,
      gait: mark.gait,
    }))
    if (transition === 'linear' && marks.length === 1) {
      const start = marks[0]!
      const stage = resolveXrMotionReferenceStage(snapshot.plan.stageId)
      const travelMeters = Math.min(2, Math.max(0.5, stage.sizeMeters[0] * 0.08))
      marks.push({
        timeSeconds: snapshot.plan.durationSeconds,
        position: [start.position[0] + travelMeters, start.position[1], start.position[2]],
        transition: 'linear',
        gait: start.gait,
      })
    }
    return {
      ...castTrackRecord(track),
      animation: track.animation?.kind === 'action-path' ? null : track.animation,
      marks,
    }
  })
  return updatePlan({ ...plan, cast })
}

export function setXrMotionReferenceCastAnimation(
  actorIdValue: string,
  presetIdValue: XrAnimationPresetId,
): XrMotionReferenceRuntimeSnapshot {
  const actorId = String(actorIdValue || '').trim()
  if (!isXrAnimationPresetId(presetIdValue)) return snapshot
  const sourceTrack = snapshot.plan.cast.find(track => track.actorId === actorId)
  if (!sourceTrack) return snapshot
  const preset = resolveXrAnimationPreset(presetIdValue)
  const subject = snapshot.plan.subjects.find(candidate => candidate.id === actorId)
  if (!xrAnimationPresetCompatible({
    preset,
    assetId: subject?.assetId,
    category: subject?.category,
    graphActor: !subject,
  })) return snapshot
  const stage = resolveXrMotionReferenceStage(snapshot.plan.stageId)
  const plan = planRecord(snapshot.plan)
  const cast = snapshot.plan.cast.map(track => {
    if (track.actorId !== actorId) return castTrackRecord(track)
    if (preset.kind !== 'action-path') {
      const animation: XrAnimationAssignment = {
        kind: preset.kind,
        presetId: preset.id,
        startTimeSeconds: 0,
        loop: preset.loop,
      }
      return { ...castTrackRecord(track), animation }
    }
    const animation: XrAnimationAssignment = {
      kind: preset.kind,
      presetId: preset.id,
      startTimeSeconds: 0,
      loop: preset.loop,
    }
    const origin = sampleXrMotionReferenceMarks(track.marks, snapshot.playheadSeconds)
    return {
      ...castTrackRecord(track),
      animation,
      marks: buildXrAnimationActionPath({
        presetId: preset.id,
        durationSeconds: snapshot.plan.durationSeconds,
        origin,
        stageSizeMeters: stage.sizeMeters,
      }),
    }
  })
  return updatePlan({ ...plan, cast })
}

export function clearXrMotionReferenceCastAnimation(actorIdValue: string): XrMotionReferenceRuntimeSnapshot {
  const actorId = String(actorIdValue || '').trim()
  if (!snapshot.plan.cast.some(track => track.actorId === actorId && track.animation)) return snapshot
  const plan = planRecord(snapshot.plan)
  const cast = snapshot.plan.cast.map(track => {
    if (track.actorId !== actorId) return castTrackRecord(track)
    if (track.animation?.kind !== 'action-path') return { ...castTrackRecord(track), animation: null }
    const position = sampleXrMotionReferenceMarks(track.marks, snapshot.playheadSeconds)
    return {
      ...castTrackRecord(track),
      animation: null,
      marks: [{ timeSeconds: 0, position: [...position], transition: 'hold', gait: 'hold' }],
    }
  })
  return updatePlan({ ...plan, cast })
}

export function removeXrMotionReferenceCastMark(actorIdValue: string, markId: string): XrMotionReferenceRuntimeSnapshot {
  const actorId = String(actorIdValue || '').trim()
  const plan = planRecord(snapshot.plan)
  const sourceTrack = snapshot.plan.cast.find(track => track.actorId === actorId)
  if (!sourceTrack || sourceTrack.marks.length <= 1 || !sourceTrack.marks.some(mark => mark.id === markId)) return snapshot
  const cast = snapshot.plan.cast.map(track => ({
    ...castTrackRecord(track),
    animation: track.actorId === actorId && track.animation?.kind === 'action-path' ? null : track.animation,
    marks: track.marks
      .filter(mark => track.actorId !== actorId || mark.id !== markId)
      .map(mark => ({ timeSeconds: mark.timeSeconds, position: [...mark.position], transition: mark.transition, gait: mark.gait })),
  }))
  return updatePlan({ ...plan, cast })
}

export function retimeXrMotionReferenceCastMark(
  actorIdValue: string,
  markId: string,
  timeSeconds: number,
): XrMotionReferenceRuntimeSnapshot {
  const actorId = String(actorIdValue || '').trim()
  const sourceTrack = snapshot.plan.cast.find(track => track.actorId === actorId)
  if (!sourceTrack || !sourceTrack.marks.some(mark => mark.id === markId)) return snapshot
  const plan = planRecord(snapshot.plan)
  const cast = snapshot.plan.cast.map(track => ({
    ...castTrackRecord(track),
    animation: track.actorId === actorId && track.animation?.kind === 'action-path' ? null : track.animation,
    marks: track.marks.map(mark => ({
      timeSeconds: track.actorId === actorId && mark.id === markId ? timeSeconds : mark.timeSeconds,
      position: [...mark.position],
      transition: mark.transition,
      gait: mark.gait,
    })),
  }))
  return updatePlan({ ...plan, cast })
}

export function setXrMotionReferenceCameraMark(args: {
  timeSeconds: number
  anchorId: string
  settings: StrybldrCameraSettings
  rig?: XrMotionReferenceCameraRig
  easing?: XrChoreographyEasing
}): XrMotionReferenceRuntimeSnapshot {
  const plan = planRecord(snapshot.plan)
  const camera = Array.isArray(plan.camera) ? plan.camera.slice() : []
  const replacing = camera.some(mark => Math.abs(Number((mark as Record<string, unknown>).timeSeconds) - args.timeSeconds) < 0.0005)
  if (camera.length >= XR_MOTION_REFERENCE_MAX_CAMERA_MARKS && !replacing) return snapshot
  const rig = args.rig || snapshot.selectedCameraRig
  camera.push({
    timeSeconds: args.timeSeconds,
    anchorId: String(args.anchorId || '').trim(),
    rig,
    easing: args.easing || defaultXrCameraEasing(rig),
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
      rig: mark.rig,
      easing: mark.easing,
      settings: { ...mark.settings },
    }))
  return updatePlan({ ...plan, camera })
}

export function retimeXrMotionReferenceCameraMark(markId: string, timeSeconds: number): XrMotionReferenceRuntimeSnapshot {
  if (!snapshot.plan.camera.some(mark => mark.id === markId)) return snapshot
  const plan = planRecord(snapshot.plan)
  const camera = snapshot.plan.camera.map(mark => ({
    timeSeconds: mark.id === markId ? timeSeconds : mark.timeSeconds,
    anchorId: mark.anchorId,
    rig: mark.rig,
    easing: mark.easing,
    settings: { ...mark.settings },
  }))
  return updatePlan({ ...plan, camera })
}

export function setXrMotionReferenceCastMarkChoreography(args: {
  actorId: string
  markId: string
  easing?: XrChoreographyEasing
  gait?: XrChoreographyGait
  position?: XrMotionReferenceVector
}): XrMotionReferenceRuntimeSnapshot {
  const edit = buildCastMarkChoreographyEdit(snapshot.plan, args)
  return edit ? updatePlan(edit) : snapshot
}

export function setXrMotionReferenceCameraMarkEasing(markId: string, easing: XrChoreographyEasing): XrMotionReferenceRuntimeSnapshot {
  const edit = buildCameraMarkChoreographyEdit(snapshot.plan, markId, easing)
  return edit ? updatePlan(edit) : snapshot
}

export function markXrMotionReferenceSaved(persistedValue: unknown): XrMotionReferenceRuntimeSnapshot {
  const nextSourceSignature = sourceSignature(snapshot.sceneKey, activeNodes, persistedValue)
  dirtyCastArchive.clear()
  return publish({ ...snapshot, sourceSignature: nextSourceSignature, dirty: false })
}
