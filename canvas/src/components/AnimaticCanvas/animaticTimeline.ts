import { resolveBeatRefForNode } from '@/components/FlowEditor/beatByBeat'
import { FLOW_EDGE_SOURCE_PORT_KEY } from '@/lib/graph/flowPorts'
import { isPlainObject } from '@/lib/graph/value'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import yaml from 'js-yaml'

export type AnimaticTimelineLaneId = 'clip' | 'overlay' | 'audio' | 'scene' | 'node'

export type AnimaticTimelineItem = {
  id: string
  nodeId: string
  beatRef: string
  laneId: AnimaticTimelineLaneId
  title: string
  subtitle: string
  kind: string
}

export type AnimaticTimelineBeat = {
  beatRef: string
  label: string
  note: string
  summary: string
  tags: string[]
  orderIndex: number
  startMs: number | null
  endMs: number | null
  durationMs: number | null
  displayStart: number
  displayEnd: number
  items: AnimaticTimelineItem[]
}

export type AnimaticTimelineLane = {
  id: AnimaticTimelineLaneId
  label: string
}

export type AnimaticTimelineLaneControlState = {
  hiddenLaneIds: AnimaticTimelineLaneId[]
  mutedLaneIds: AnimaticTimelineLaneId[]
  soloLaneId: AnimaticTimelineLaneId | null
}

export type AnimaticTimelineModel = {
  beats: AnimaticTimelineBeat[]
  lanes: AnimaticTimelineLane[]
  totalSpan: number
  totalDurationMs: number | null
  scaleConfig: AnimaticTimelineScaleConfig
  usesAbsoluteTiming: boolean
}

export type AnimaticTimelineScaleConfig = {
  scale: number
  scaleSplitCount: number
  scaleWidth: number
  startLeft: number
}

export type AnimaticTimelineBeatTimingOverride = {
  startMs: number
  endMs: number
}

type AnimaticTimelineEditMode = 'move' | 'resize-start' | 'resize-end'
type AnimaticTimelineBeatRecord = Record<string, unknown>
type AnimaticTimelineNodeBeatRefMatchArgs = {
  nodeId: string
  title: string
  laneId: AnimaticTimelineLaneId | null
  sourceBeatRef: string
  nextBeatRef: string
}

type FrontmatterBeatMeta = {
  beatRef: string
  label: string
  note: string
  summary: string
  tags: string[]
  orderIndex: number
  startMs: number | null
  endMs: number | null
  durationMs: number | null
}

const LANE_ORDER: ReadonlyArray<AnimaticTimelineLaneId> = ['clip', 'overlay', 'audio', 'scene', 'node']
const DEFAULT_ANIMATIC_TIMELINE_SCALE_CONFIG: AnimaticTimelineScaleConfig = {
  scale: 5,
  scaleSplitCount: 10,
  scaleWidth: 160,
  startLeft: 20,
}

const LANE_LABELS: Record<AnimaticTimelineLaneId, string> = {
  clip: 'Clip',
  overlay: 'Overlay',
  audio: 'Audio',
  scene: 'Scene',
  node: 'Node',
}

function readLaneId(value: unknown): AnimaticTimelineLaneId | null {
  const normalized = readString(value).toLowerCase()
  if (normalized === 'clip' || normalized === 'overlay' || normalized === 'audio' || normalized === 'scene' || normalized === 'node') {
    return normalized
  }
  return null
}

function readLaneIdList(value: unknown): AnimaticTimelineLaneId[] {
  const rawValues = Array.isArray(value) ? value : []
  const uniqueLaneIds = new Set<AnimaticTimelineLaneId>()
  for (const rawValue of rawValues) {
    const laneId = readLaneId(rawValue)
    if (laneId) uniqueLaneIds.add(laneId)
  }
  return Array.from(uniqueLaneIds)
}

function sortAnimaticTimelineLanesByOrder(
  laneIds: readonly AnimaticTimelineLaneId[],
  preferredOrder: readonly AnimaticTimelineLaneId[],
): AnimaticTimelineLaneId[] {
  const preferredIndexByLaneId = new Map<AnimaticTimelineLaneId, number>()
  preferredOrder.forEach((laneId, index) => preferredIndexByLaneId.set(laneId, index))
  return [...laneIds].sort((left, right) => {
    const leftIndex = preferredIndexByLaneId.get(left)
    const rightIndex = preferredIndexByLaneId.get(right)
    if (leftIndex != null && rightIndex != null && leftIndex !== rightIndex) return leftIndex - rightIndex
    if (leftIndex != null) return -1
    if (rightIndex != null) return 1
    return LANE_ORDER.indexOf(left) - LANE_ORDER.indexOf(right)
  })
}

function readRecord(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {}
}

function cloneJsonLike(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(entry => cloneJsonLike(entry))
  if (isPlainObject(value)) {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(record)) out[key] = cloneJsonLike(record[key])
    return out
  }
  return value
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function readPositiveNumber(value: unknown): number | null {
  const parsed = readFiniteNumber(value)
  if (parsed == null || parsed <= 0) return null
  return parsed
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeAnimaticTimelineScaleConfig(
  value: Partial<AnimaticTimelineScaleConfig> | null | undefined,
): AnimaticTimelineScaleConfig {
  const scale = readPositiveNumber(value?.scale) ?? DEFAULT_ANIMATIC_TIMELINE_SCALE_CONFIG.scale
  const scaleSplitCount = Math.max(
    1,
    Math.round(readPositiveNumber(value?.scaleSplitCount) ?? DEFAULT_ANIMATIC_TIMELINE_SCALE_CONFIG.scaleSplitCount),
  )
  const scaleWidth = Math.max(40, Math.round(readPositiveNumber(value?.scaleWidth) ?? DEFAULT_ANIMATIC_TIMELINE_SCALE_CONFIG.scaleWidth))
  const startLeft = Math.max(0, Math.round(readFiniteNumber(value?.startLeft) ?? DEFAULT_ANIMATIC_TIMELINE_SCALE_CONFIG.startLeft))
  return {
    scale,
    scaleSplitCount,
    scaleWidth,
    startLeft,
  }
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const uniqueValues = new Set<string>()
    for (const entry of value) {
      const normalized = readString(entry)
      if (normalized) uniqueValues.add(normalized)
    }
    return Array.from(uniqueValues)
  }
  const normalized = readString(value)
  if (!normalized) return []
  const uniqueValues = new Set(
    normalized
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean),
  )
  return Array.from(uniqueValues)
}

function collectAnimaticTimelineFrontmatterState(markdownText: string): {
  lines: string[]
  frontmatterEndLine: number
  meta: Record<string, unknown>
  timeline: Record<string, unknown>
  beats: Record<string, AnimaticTimelineBeatRecord>
  bodyText: string
} {
  const lines = splitMarkdownLines(markdownText)
  let frontmatterEndLine = -1
  if ((lines[0] || '').trim() === '---') {
    for (let i = 1; i < lines.length; i += 1) {
      if ((lines[i] || '').trim() === '---') {
        frontmatterEndLine = i
        break
      }
    }
  }
  const parsed = parseMarkdownFrontmatter(lines)
  const meta = readRecord(cloneJsonLike(parsed.meta))
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beatsRaw = readRecord(cloneJsonLike(timeline.beats))
  const beats: Record<string, AnimaticTimelineBeatRecord> = {}
  for (const [beatRef, value] of Object.entries(beatsRaw)) {
    beats[beatRef] = readRecord(cloneJsonLike(value))
  }
  const bodyText =
    frontmatterEndLine >= 0
      ? lines.slice(frontmatterEndLine + 1).join('\n')
      : markdownText
  return {
    lines,
    frontmatterEndLine,
    meta,
    timeline,
    beats,
    bodyText,
  }
}

export function cloneAnimaticTimelineFrontmatterMeta(markdownText: string | null | undefined): Record<string, unknown> {
  const frontmatterState = collectAnimaticTimelineFrontmatterState(String(markdownText || ''))
  return readRecord(cloneJsonLike(frontmatterState.meta))
}

export function updateAnimaticTimelineBeatRecordField(args: {
  frontmatterMeta: Record<string, unknown>
  beatRef: string
  field: 'label' | 'note' | 'summary' | 'tags'
  nextValue: string
}): void {
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beats = readRecord(cloneJsonLike(timeline.beats))
  const nextBeat = readRecord(cloneJsonLike(beats[beatRef]))
  if (args.field === 'label') {
    nextBeat.label = readString(args.nextValue) || beatRef
  } else if (args.field === 'note') {
    const nextNote = readString(args.nextValue)
    if (nextNote) nextBeat.note = nextNote
    else delete nextBeat.note
    delete nextBeat.notes
  } else if (args.field === 'summary') {
    const nextSummary = readString(args.nextValue)
    if (nextSummary) nextBeat.summary = nextSummary
    else delete nextBeat.summary
  } else if (args.field === 'tags') {
    const nextTags = readStringList(args.nextValue)
    if (nextTags.length > 0) nextBeat.tags = nextTags
    else delete nextBeat.tags
  }
  beats[beatRef] = nextBeat
  timeline.beats = beats
  meta.timeline = timeline
}

export function updateAnimaticTimelineBeatTimingOverrideRecords(args: {
  frontmatterMeta: Record<string, unknown>
  overrides: Record<string, AnimaticTimelineBeatTimingOverride>
}): void {
  const overrideEntries = Object.entries(args.overrides || {}).filter(([beatRef]) => String(beatRef || '').trim())
  if (overrideEntries.length === 0) return
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beats = readRecord(cloneJsonLike(timeline.beats))
  for (const [beatRef, override] of overrideEntries) {
    const nextBeat = readRecord(cloneJsonLike(beats[beatRef]))
    const roundedStartMs = Math.max(0, Math.round(override.startMs))
    const roundedEndMs = Math.max(roundedStartMs, Math.round(override.endMs))
    nextBeat.start_ms = roundedStartMs
    nextBeat.end_ms = roundedEndMs
    nextBeat.duration_ms = roundedEndMs - roundedStartMs
    if (!readString(nextBeat.label)) nextBeat.label = beatRef
    beats[beatRef] = nextBeat
  }
  timeline.beats = beats
  meta.timeline = timeline
}

export function updateAnimaticTimelineLaneControlStateRecord(args: {
  frontmatterMeta: Record<string, unknown>
  hiddenLaneIds: readonly AnimaticTimelineLaneId[]
  mutedLaneIds: readonly AnimaticTimelineLaneId[]
  soloLaneId?: AnimaticTimelineLaneId | null
}): void {
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const nextHiddenLaneIds = readLaneIdList(args.hiddenLaneIds)
  const nextMutedLaneIds = readLaneIdList(args.mutedLaneIds)
  const nextSoloLaneId = readLaneId(args.soloLaneId)
  const shouldPersistControls = nextHiddenLaneIds.length > 0 || nextMutedLaneIds.length > 0 || nextSoloLaneId != null
  if (shouldPersistControls) {
    timeline.lane_controls = {
      hidden: nextHiddenLaneIds,
      muted: nextMutedLaneIds,
      ...(nextSoloLaneId ? { solo: nextSoloLaneId } : {}),
    }
  } else {
    delete timeline.lane_controls
  }
  meta.timeline = timeline
}

export function updateAnimaticTimelineLaneOrderRecord(args: {
  frontmatterMeta: Record<string, unknown>
  laneOrder: readonly AnimaticTimelineLaneId[]
}): void {
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const nextLaneOrder = readLaneIdList(args.laneOrder)
  if (nextLaneOrder.length > 0) timeline.lane_order = nextLaneOrder
  else delete timeline.lane_order
  meta.timeline = timeline
}

export function insertAnimaticTimelineBeatRecord(args: {
  frontmatterMeta: Record<string, unknown>
  model: AnimaticTimelineModel
  insertAfterBeatRef?: string | null
  insertBeforeBeatRef?: string | null
  snapStepMs?: number | null
}): { beatRef: string } {
  const snapStepMs = Math.max(0, Math.round(args.snapStepMs ?? 0)) || 1000
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beats = readRecord(cloneJsonLike(timeline.beats)) as Record<string, AnimaticTimelineBeatRecord>
  const existingBeatRefs = new Set<string>([
    ...Object.keys(beats),
    ...args.model.beats.map(beat => beat.beatRef),
  ])
  const beatRef = createNextAnimaticTimelineBeatRef(existingBeatRefs)
  const insertMode = args.insertBeforeBeatRef ? 'before' : 'after'
  const relativeBeatRef = args.insertBeforeBeatRef || args.insertAfterBeatRef || null
  const relativeIndex = (() => {
    if (!relativeBeatRef) return args.model.beats.length - 1
    const found = args.model.beats.findIndex(beat => beat.beatRef === relativeBeatRef)
    return found >= 0 ? found : args.model.beats.length - 1
  })()
  if (args.model.usesAbsoluteTiming) {
    const targetBeat = relativeIndex >= 0 ? args.model.beats[relativeIndex] : null
    const nextBeats = args.model.beats.filter((_, index) => (insertMode === 'before' ? index >= relativeIndex : index > relativeIndex))
    const insertStart =
      insertMode === 'before'
        ? targetBeat?.startMs ?? 0
        : targetBeat?.endMs != null
          ? targetBeat.endMs
          : 0
    const defaultDuration = snapStepMs
    const newBeatRecord: AnimaticTimelineBeatRecord = {
      label: `New Beat ${beatRef.replace(/^beat_/, '')}`,
      start_ms: insertStart,
      end_ms: insertStart + defaultDuration,
      duration_ms: defaultDuration,
    }
    for (const beat of nextBeats) {
      const current = readRecord(cloneJsonLike(beats[beat.beatRef]))
      if (beat.startMs != null) current.start_ms = beat.startMs + defaultDuration
      if (beat.endMs != null) current.end_ms = beat.endMs + defaultDuration
      if (typeof current.start_ms === 'number' && typeof current.end_ms === 'number') {
        current.duration_ms = Math.max(0, current.end_ms - current.start_ms)
      }
      beats[beat.beatRef] = current
    }
    const orderedBeatRefs = args.model.beats.map(beat => beat.beatRef)
    const insertAt = insertMode === 'before' ? Math.max(0, relativeIndex) : Math.max(0, relativeIndex + 1)
    orderedBeatRefs.splice(insertAt, 0, beatRef)
    const nextOrderedBeats: Record<string, AnimaticTimelineBeatRecord> = {}
    for (const orderedBeatRef of orderedBeatRefs) {
      if (orderedBeatRef === beatRef) {
        nextOrderedBeats[orderedBeatRef] = newBeatRecord
        continue
      }
      if (beats[orderedBeatRef]) nextOrderedBeats[orderedBeatRef] = beats[orderedBeatRef]
    }
    for (const [existingBeatRef, existingBeatRecord] of Object.entries(beats)) {
      if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
        nextOrderedBeats[existingBeatRef] = existingBeatRecord
      }
    }
    timeline.beats = nextOrderedBeats
  } else {
    beats[beatRef] = {
      label: `New Beat ${beatRef.replace(/^beat_/, '')}`,
    }
    timeline.beats = beats
  }
  meta.timeline = timeline
  return { beatRef }
}

export function deleteAnimaticTimelineBeatRecord(args: {
  frontmatterMeta: Record<string, unknown>
  model: AnimaticTimelineModel
  beatRef: string
}): boolean {
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return false
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beats = readRecord(cloneJsonLike(timeline.beats)) as Record<string, AnimaticTimelineBeatRecord>
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  if (beatIndex < 0) return false
  const beat = args.model.beats[beatIndex]
  if (!beat || beat.items.length > 0) return false
  const durationToRemove =
    beat.startMs != null && beat.endMs != null
      ? Math.max(0, beat.endMs - beat.startMs)
      : null
  delete beats[beatRef]
  if (args.model.usesAbsoluteTiming && durationToRemove && durationToRemove > 0) {
    for (let i = beatIndex + 1; i < args.model.beats.length; i += 1) {
      const nextBeat = args.model.beats[i]
      if (!nextBeat) continue
      const current = readRecord(cloneJsonLike(beats[nextBeat.beatRef]))
      if (nextBeat.startMs != null) current.start_ms = Math.max(0, nextBeat.startMs - durationToRemove)
      if (nextBeat.endMs != null) current.end_ms = Math.max(0, nextBeat.endMs - durationToRemove)
      if (typeof current.start_ms === 'number' && typeof current.end_ms === 'number') {
        current.duration_ms = Math.max(0, current.end_ms - current.start_ms)
      }
      beats[nextBeat.beatRef] = current
    }
  }
  timeline.beats = beats
  meta.timeline = timeline
  return true
}

export function duplicateAnimaticTimelineBeatRecord(args: {
  frontmatterMeta: Record<string, unknown>
  model: AnimaticTimelineModel
  beatRef: string
  snapStepMs?: number | null
}): { beatRef: string } {
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  const beat = beatIndex >= 0 ? args.model.beats[beatIndex] : null
  if (!beat) return { beatRef: '' }
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beats = readRecord(cloneJsonLike(timeline.beats)) as Record<string, AnimaticTimelineBeatRecord>
  const existingBeatRefs = new Set<string>([
    ...Object.keys(beats),
    ...args.model.beats.map(entry => entry.beatRef),
  ])
  const nextBeatRef = createNextAnimaticTimelineBeatRef(existingBeatRefs)
  const nextBeatRecord = readRecord(cloneJsonLike(beats[beatRef]))
  const durationMs =
    beat.startMs != null && beat.endMs != null
      ? Math.max(0, beat.endMs - beat.startMs)
      : Math.max(0, Math.round(args.snapStepMs ?? 1000)) || 1000
  if (args.model.usesAbsoluteTiming && beat.endMs != null) {
    for (let i = beatIndex + 1; i < args.model.beats.length; i += 1) {
      const followingBeat = args.model.beats[i]
      if (!followingBeat) continue
      const current = readRecord(cloneJsonLike(beats[followingBeat.beatRef]))
      if (followingBeat.startMs != null) current.start_ms = followingBeat.startMs + durationMs
      if (followingBeat.endMs != null) current.end_ms = followingBeat.endMs + durationMs
      if (typeof current.start_ms === 'number' && typeof current.end_ms === 'number') {
        current.duration_ms = Math.max(0, current.end_ms - current.start_ms)
      }
      beats[followingBeat.beatRef] = current
    }
    nextBeatRecord.start_ms = beat.endMs
    nextBeatRecord.end_ms = beat.endMs + durationMs
    nextBeatRecord.duration_ms = durationMs
  }
  nextBeatRecord.label = `${readString(nextBeatRecord.label) || beat.label} Copy`
  const orderedBeatRefs = args.model.beats.map(entry => entry.beatRef)
  orderedBeatRefs.splice(Math.max(0, beatIndex + 1), 0, nextBeatRef)
  const nextOrderedBeats: Record<string, AnimaticTimelineBeatRecord> = {}
  for (const orderedBeatRef of orderedBeatRefs) {
    if (orderedBeatRef === nextBeatRef) {
      nextOrderedBeats[orderedBeatRef] = nextBeatRecord
      continue
    }
    if (beats[orderedBeatRef]) nextOrderedBeats[orderedBeatRef] = beats[orderedBeatRef]
  }
  for (const [existingBeatRef, existingBeatRecord] of Object.entries(beats)) {
    if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
      nextOrderedBeats[existingBeatRef] = existingBeatRecord
    }
  }
  timeline.beats = nextOrderedBeats
  meta.timeline = timeline
  return { beatRef: nextBeatRef }
}

export function splitAnimaticTimelineBeatRecord(args: {
  frontmatterMeta: Record<string, unknown>
  model: AnimaticTimelineModel
  beatRef: string
  splitAtMs: number
  minDurationMs?: number
  snapStepMs?: number | null
}): { beatRef: string } {
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  const beat = beatIndex >= 0 ? args.model.beats[beatIndex] : null
  if (!beat || beat.startMs == null || beat.endMs == null) return { beatRef: '' }
  const minDurationMs = Math.max(100, Math.round(args.minDurationMs ?? 300))
  const snapStepMs = Math.max(0, Math.round(args.snapStepMs ?? 0))
  const rawSplitAtMs = snapStepMs > 0 ? snapAnimaticTimelineValue(args.splitAtMs, snapStepMs) : Math.round(args.splitAtMs)
  const splitAtMs = Math.max(beat.startMs + minDurationMs, Math.min(beat.endMs - minDurationMs, rawSplitAtMs))
  if (splitAtMs <= beat.startMs || splitAtMs >= beat.endMs) return { beatRef: '' }
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beats = readRecord(cloneJsonLike(timeline.beats)) as Record<string, AnimaticTimelineBeatRecord>
  const existingBeatRefs = new Set<string>([
    ...Object.keys(beats),
    ...args.model.beats.map(entry => entry.beatRef),
  ])
  const nextBeatRef = createNextAnimaticTimelineBeatRef(existingBeatRefs)
  const currentBeatRecord = readRecord(cloneJsonLike(beats[beatRef]))
  const nextBeatRecord = readRecord(cloneJsonLike(beats[beatRef]))
  currentBeatRecord.end_ms = splitAtMs
  currentBeatRecord.duration_ms = splitAtMs - beat.startMs
  nextBeatRecord.start_ms = splitAtMs
  nextBeatRecord.end_ms = beat.endMs
  nextBeatRecord.duration_ms = beat.endMs - splitAtMs
  nextBeatRecord.label = `${readString(nextBeatRecord.label) || beat.label} Part 2`
  beats[beatRef] = currentBeatRecord
  const orderedBeatRefs = args.model.beats.map(entry => entry.beatRef)
  orderedBeatRefs.splice(Math.max(0, beatIndex + 1), 0, nextBeatRef)
  const nextOrderedBeats: Record<string, AnimaticTimelineBeatRecord> = {}
  for (const orderedBeatRef of orderedBeatRefs) {
    if (orderedBeatRef === nextBeatRef) {
      nextOrderedBeats[orderedBeatRef] = nextBeatRecord
      continue
    }
    if (beats[orderedBeatRef]) nextOrderedBeats[orderedBeatRef] = beats[orderedBeatRef]
  }
  for (const [existingBeatRef, existingBeatRecord] of Object.entries(beats)) {
    if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
      nextOrderedBeats[existingBeatRef] = existingBeatRecord
    }
  }
  timeline.beats = nextOrderedBeats
  meta.timeline = timeline
  return { beatRef: nextBeatRef }
}

export function mergeAnimaticTimelineBeatWithNextRecord(args: {
  frontmatterMeta: Record<string, unknown>
  model: AnimaticTimelineModel
  beatRef: string
}): boolean {
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  if (beatIndex < 0) return false
  const beat = args.model.beats[beatIndex]
  const nextBeat = args.model.beats[beatIndex + 1]
  if (!beat || !nextBeat) return false
  if (!args.model.usesAbsoluteTiming) return false
  if (beat.startMs == null || beat.endMs == null || nextBeat.endMs == null) return false
  if (nextBeat.items.length > 0) return false
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beats = readRecord(cloneJsonLike(timeline.beats)) as Record<string, AnimaticTimelineBeatRecord>
  const currentBeatRecord = readRecord(cloneJsonLike(beats[beatRef]))
  currentBeatRecord.end_ms = nextBeat.endMs
  currentBeatRecord.duration_ms = Math.max(0, nextBeat.endMs - beat.startMs)
  beats[beatRef] = currentBeatRecord
  delete beats[nextBeat.beatRef]
  const orderedBeatRefs = args.model.beats.map(entry => entry.beatRef).filter(entry => entry !== nextBeat.beatRef)
  const nextOrderedBeats: Record<string, AnimaticTimelineBeatRecord> = {}
  for (const orderedBeatRef of orderedBeatRefs) {
    if (beats[orderedBeatRef]) nextOrderedBeats[orderedBeatRef] = beats[orderedBeatRef]
  }
  for (const [existingBeatRef, existingBeatRecord] of Object.entries(beats)) {
    if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
      nextOrderedBeats[existingBeatRef] = existingBeatRecord
    }
  }
  timeline.beats = nextOrderedBeats
  meta.timeline = timeline
  return true
}

export function removeAnimaticTimelineGapBeforeBeatRecord(args: {
  frontmatterMeta: Record<string, unknown>
  model: AnimaticTimelineModel
  beatRef: string
}): boolean {
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  if (beatIndex <= 0) return false
  const beat = args.model.beats[beatIndex]
  const previousBeat = args.model.beats[beatIndex - 1]
  if (!beat || !previousBeat) return false
  if (!args.model.usesAbsoluteTiming) return false
  if (beat.startMs == null || previousBeat.endMs == null) return false
  const gapMs = Math.max(0, beat.startMs - previousBeat.endMs)
  if (gapMs <= 0) return false
  const meta = readRecord(args.frontmatterMeta)
  const timeline = readRecord(cloneJsonLike(meta.timeline))
  const beats = readRecord(cloneJsonLike(timeline.beats)) as Record<string, AnimaticTimelineBeatRecord>
  for (let i = beatIndex; i < args.model.beats.length; i += 1) {
    const currentBeat = args.model.beats[i]
    if (!currentBeat) continue
    const currentBeatRecord = readRecord(cloneJsonLike(beats[currentBeat.beatRef]))
    if (currentBeat.startMs != null) currentBeatRecord.start_ms = Math.max(0, currentBeat.startMs - gapMs)
    if (currentBeat.endMs != null) currentBeatRecord.end_ms = Math.max(0, currentBeat.endMs - gapMs)
    if (typeof currentBeatRecord.start_ms === 'number' && typeof currentBeatRecord.end_ms === 'number') {
      currentBeatRecord.duration_ms = Math.max(0, currentBeatRecord.end_ms - currentBeatRecord.start_ms)
    }
    beats[currentBeat.beatRef] = currentBeatRecord
  }
  timeline.beats = beats
  meta.timeline = timeline
  return true
}

function buildAnimaticTimelineMarkdownFromFrontmatterState(args: {
  meta: Record<string, unknown>
  timeline: Record<string, unknown>
  beats: Record<string, AnimaticTimelineBeatRecord>
  bodyText: string
}): string {
  args.timeline.beats = args.beats
  args.meta.timeline = args.timeline
  const dumpedFrontmatter = String(
    yaml.dump(args.meta, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    }) || '',
  ).trimEnd()
  const normalizedBody = args.bodyText.startsWith('\n') ? args.bodyText.slice(1) : args.bodyText
  return ['---', dumpedFrontmatter, '---', normalizedBody].join('\n').replace(/\n+$/, '\n')
}

function createNextAnimaticTimelineBeatRef(usedBeatRefs: Iterable<string>): string {
  const used = new Set<string>()
  for (const ref of usedBeatRefs) {
    const normalized = String(ref || '').trim()
    if (normalized) used.add(normalized)
  }
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `beat_${String(i).padStart(2, '0')}`
    if (!used.has(candidate)) return candidate
  }
  return `beat_${Date.now()}`
}

export function snapAnimaticTimelineValue(value: number, stepMs: number | null | undefined): number {
  const normalizedStep = Math.max(0, Math.round(stepMs ?? 0))
  if (!normalizedStep) return Math.max(0, Math.round(value))
  return Math.max(0, Math.round(value / normalizedStep) * normalizedStep)
}

function readBeatOrderFromRef(beatRef: string, fallbackIndex: number): number {
  const match = /(\d+)$/.exec(String(beatRef || '').trim())
  if (!match) return fallbackIndex
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : fallbackIndex
}

function readBeatTiming(record: Record<string, unknown>): Pick<FrontmatterBeatMeta, 'startMs' | 'endMs' | 'durationMs'> {
  const timing = readRecord(record.timing)
  const startMs =
    readFiniteNumber(record.start_ms) ??
    readFiniteNumber(record.startMs) ??
    readFiniteNumber(timing.start_ms) ??
    readFiniteNumber(timing.startMs) ??
    null
  const endMs =
    readFiniteNumber(record.end_ms) ??
    readFiniteNumber(record.endMs) ??
    readFiniteNumber(timing.end_ms) ??
    readFiniteNumber(timing.endMs) ??
    null
  const durationMs =
    readFiniteNumber(record.duration_ms) ??
    readFiniteNumber(record.durationMs) ??
    readFiniteNumber(timing.duration_ms) ??
    readFiniteNumber(timing.durationMs) ??
    null
  const resolvedDurationMs =
    durationMs != null ? durationMs : startMs != null && endMs != null ? Math.max(0, endMs - startMs) : null
  const resolvedEndMs = endMs != null ? endMs : startMs != null && resolvedDurationMs != null ? startMs + resolvedDurationMs : null
  return {
    startMs,
    endMs: resolvedEndMs,
    durationMs: resolvedDurationMs,
  }
}

function readFrontmatterBeatMeta(markdownText: string | null | undefined): FrontmatterBeatMeta[] {
  const text = String(markdownText || '')
  if (!text.trim()) return []
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(text))
  const meta = readRecord(parsed.meta)
  const timeline = readRecord(meta.timeline)
  const beats = readRecord(timeline.beats)
  const entries = Object.entries(beats)
  if (entries.length === 0) return []
  return entries.map(([beatRef, value], index) => {
    const record = readRecord(value)
    const timing = readBeatTiming(record)
    const label =
      readString(record.label) ||
      readString(record.title) ||
      readString(record.name) ||
      String(beatRef || '').trim()
    const note = readString(record.note) || readString(record.notes)
    const summary = readString(record.summary)
    const tags = readStringList(record.tags)
    return {
      beatRef: String(beatRef || '').trim(),
      label,
      note,
      summary,
      tags,
      orderIndex: index,
      startMs: timing.startMs,
      endMs: timing.endMs,
      durationMs: timing.durationMs,
    }
  })
}

function classifyAnimationLane(node: GraphNode): AnimaticTimelineLaneId {
  const nodeId = String(node.id || '').trim().toLowerCase()
  const label = String(node.label || '').trim().toLowerCase()
  const type = String(node.type || '').trim().toLowerCase()
  const signature = `${nodeId} ${label} ${type}`
  if (signature.includes('overlay')) return 'overlay'
  if (signature.includes('clip') || signature.includes('video') || signature.includes('shot')) return 'clip'
  if (signature.includes('audio') || signature.includes('voice') || signature.includes('music') || signature.includes('sfx')) return 'audio'
  if (signature.includes('scene') || signature.includes('beat') || signature.includes('timeline')) return 'scene'
  return 'node'
}

function buildEdgeCountByNodeId(edges: readonly GraphEdge[]): Map<string, number> {
  const countByNodeId = new Map<string, number>()
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    if (!edge) continue
    const sourceId = String(edge.source || '').trim()
    const targetId = String(edge.target || '').trim()
    if (sourceId) countByNodeId.set(sourceId, (countByNodeId.get(sourceId) || 0) + 1)
    if (targetId) countByNodeId.set(targetId, (countByNodeId.get(targetId) || 0) + 1)
  }
  return countByNodeId
}

function buildBeatOrderHints(edges: readonly GraphEdge[]): Map<string, number> {
  const orderByBeatRef = new Map<string, number>()
  let nextIndex = 0
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    if (!edge) continue
    if (String(edge.source || '').trim() !== 'NODE_TIMELINE') continue
    const props = readRecord(edge.properties)
    const rawPort = readString(props[FLOW_EDGE_SOURCE_PORT_KEY])
    const beatRef = rawPort.endsWith('_out') ? rawPort.slice(0, -4) : rawPort
    if (!beatRef || orderByBeatRef.has(beatRef)) continue
    orderByBeatRef.set(beatRef, nextIndex)
    nextIndex += 1
  }
  return orderByBeatRef
}

function buildGraphBeatItems(args: {
  graphData: GraphData | null | undefined
}): { itemsByBeatRef: Map<string, AnimaticTimelineItem[]>; orderHints: Map<string, number> } {
  const graphData = args.graphData || null
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData?.edges) ? graphData.edges : []
  const edgeCountByNodeId = buildEdgeCountByNodeId(edges)
  const itemsByBeatRef = new Map<string, AnimaticTimelineItem[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!node) continue
    const beatRef = resolveBeatRefForNode(node)
    if (!beatRef) continue
    const laneId = classifyAnimationLane(node)
    const nodeId = String(node.id || '').trim()
    const title = String(node.label || '').trim() || nodeId || beatRef
    const typeLabel = String(node.type || '').trim()
    const connectionCount = edgeCountByNodeId.get(nodeId) || 0
    const subtitle = [typeLabel, connectionCount > 0 ? `${connectionCount} links` : 'standalone'].filter(Boolean).join(' · ')
    const item: AnimaticTimelineItem = {
      id: nodeId || `${beatRef}:${i}`,
      nodeId,
      beatRef,
      laneId,
      title,
      subtitle,
      kind: typeLabel || laneId,
    }
    const current = itemsByBeatRef.get(beatRef) || []
    current.push(item)
    itemsByBeatRef.set(beatRef, current)
  }
  for (const items of itemsByBeatRef.values()) {
    items.sort((left, right) => left.title.localeCompare(right.title))
  }
  return { itemsByBeatRef, orderHints: buildBeatOrderHints(edges) }
}

function compareAnimationBeatMeta(
  left: FrontmatterBeatMeta,
  right: FrontmatterBeatMeta,
  orderHints: Map<string, number>,
): number {
  const leftHint = orderHints.get(left.beatRef)
  const rightHint = orderHints.get(right.beatRef)
  if (left.startMs != null && right.startMs != null && left.startMs !== right.startMs) {
    return left.startMs - right.startMs
  }
  if (leftHint != null && rightHint != null && leftHint !== rightHint) return leftHint - rightHint
  if (left.orderIndex !== right.orderIndex) return left.orderIndex - right.orderIndex
  return readBeatOrderFromRef(left.beatRef, left.orderIndex) - readBeatOrderFromRef(right.beatRef, right.orderIndex)
}

export function buildAnimaticTimelineModel(args: {
  graphData: GraphData | null | undefined
  markdownText?: string | null
}): AnimaticTimelineModel {
  const { itemsByBeatRef, orderHints } = buildGraphBeatItems({ graphData: args.graphData })
  const frontmatterBeats = readFrontmatterBeatMeta(args.markdownText)
  const preferredLaneOrder = readAnimaticTimelineLaneOrder(args.markdownText)
  const scaleConfig = readAnimaticTimelineScaleConfig(args.markdownText)
  const frontmatterByBeatRef = new Map(frontmatterBeats.map(beat => [beat.beatRef, beat]))
  const beatRefSet = new Set<string>()
  for (const beat of frontmatterBeats) {
    if (beat.beatRef) beatRefSet.add(beat.beatRef)
  }
  for (const beatRef of itemsByBeatRef.keys()) {
    if (beatRef) beatRefSet.add(beatRef)
  }
  const rawBeats = Array.from(beatRefSet).map((beatRef, index) => {
    const frontmatterBeat = frontmatterByBeatRef.get(beatRef)
    return {
      beatRef,
      label: frontmatterBeat?.label || beatRef,
      note: frontmatterBeat?.note || '',
      summary: frontmatterBeat?.summary || '',
      tags: frontmatterBeat?.tags || [],
      orderIndex: frontmatterBeat?.orderIndex ?? orderHints.get(beatRef) ?? readBeatOrderFromRef(beatRef, index),
      startMs: frontmatterBeat?.startMs ?? null,
      endMs: frontmatterBeat?.endMs ?? null,
      durationMs: frontmatterBeat?.durationMs ?? null,
    } satisfies FrontmatterBeatMeta
  })
  rawBeats.sort((left, right) => compareAnimationBeatMeta(left, right, orderHints))
  const usesAbsoluteTiming =
    rawBeats.length > 0 && rawBeats.every(beat => beat.startMs != null && beat.endMs != null && beat.endMs >= beat.startMs)
  const beats = rawBeats.map((beat, index) => {
    const displayStart = usesAbsoluteTiming ? (beat.startMs as number) : index
    const displayEnd = usesAbsoluteTiming ? (beat.endMs as number) : index + 1
    return {
      beatRef: beat.beatRef,
      label: beat.label,
      note: beat.note,
      summary: beat.summary,
      tags: beat.tags,
      orderIndex: index,
      startMs: beat.startMs,
      endMs: beat.endMs,
      durationMs: beat.durationMs,
      displayStart,
      displayEnd,
      items: itemsByBeatRef.get(beat.beatRef) || [],
    } satisfies AnimaticTimelineBeat
  })
  const totalSpan =
    beats.length === 0
      ? 0
      : usesAbsoluteTiming
        ? Math.max(...beats.map(beat => beat.displayEnd), beats[0]?.displayEnd || 0)
        : beats.length
  const totalDurationMs = usesAbsoluteTiming ? totalSpan : null
  const laneUsage = new Set<AnimaticTimelineLaneId>()
  for (const beat of beats) {
    for (const item of beat.items) laneUsage.add(item.laneId)
  }
  const orderedLaneIds = sortAnimaticTimelineLanesByOrder(
    LANE_ORDER.filter(laneId => laneUsage.has(laneId)),
    preferredLaneOrder,
  )
  const lanes = orderedLaneIds.map(laneId => ({
    id: laneId,
    label: LANE_LABELS[laneId],
  }))
  return {
    beats,
    lanes: lanes.length > 0 ? lanes : [{ id: 'node', label: LANE_LABELS.node }],
    totalSpan,
    totalDurationMs,
    scaleConfig,
    usesAbsoluteTiming,
  }
}

export function applyAnimaticTimelineBeatTimingOverrides(
  model: AnimaticTimelineModel,
  overrides: Record<string, AnimaticTimelineBeatTimingOverride>,
): AnimaticTimelineModel {
  if (!model.usesAbsoluteTiming) return model
  if (!overrides || Object.keys(overrides).length === 0) return model
  const beats = model.beats.map(beat => {
    const override = overrides[beat.beatRef]
    if (!override) return beat
    const startMs = Math.max(0, Math.round(override.startMs))
    const endMs = Math.max(startMs, Math.round(override.endMs))
    return {
      ...beat,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      displayStart: startMs,
      displayEnd: endMs,
    }
  })
  const totalSpan = beats.length > 0 ? Math.max(...beats.map(beat => beat.displayEnd), 0) : 0
  return {
    ...model,
    beats,
    totalSpan,
    totalDurationMs: totalSpan,
  }
}

function shiftFollowingBeatTimingOverrides(
  beats: readonly AnimaticTimelineBeat[],
  beatIndex: number,
  deltaMs: number,
): Record<string, AnimaticTimelineBeatTimingOverride> {
  const roundedDeltaMs = Math.max(0, Math.round(deltaMs))
  if (roundedDeltaMs <= 0) return {}
  const overrides: Record<string, AnimaticTimelineBeatTimingOverride> = {}
  for (let i = beatIndex + 1; i < beats.length; i += 1) {
    const beat = beats[i]
    if (!beat || beat.startMs == null || beat.endMs == null) continue
    overrides[beat.beatRef] = {
      startMs: beat.startMs + roundedDeltaMs,
      endMs: beat.endMs + roundedDeltaMs,
    }
  }
  return overrides
}

export function resolveAnimaticTimelineBeatTimingEdit(args: {
  beats: readonly AnimaticTimelineBeat[]
  beatIndex: number
  mode: AnimaticTimelineEditMode
  deltaMs: number
  minDurationMs?: number
  snapStepMs?: number | null
}): Record<string, AnimaticTimelineBeatTimingOverride> | null {
  const beats = Array.isArray(args.beats) ? args.beats : []
  const beat = beats[args.beatIndex]
  if (!beat || beat.startMs == null || beat.endMs == null) return null
  const previousBeat = args.beatIndex > 0 ? beats[args.beatIndex - 1] : null
  const nextBeat = args.beatIndex < beats.length - 1 ? beats[args.beatIndex + 1] : null
  const previousBoundary = previousBeat?.endMs != null ? previousBeat.endMs : 0
  const nextBoundary = nextBeat?.startMs != null ? nextBeat.startMs : Number.POSITIVE_INFINITY
  const currentStart = beat.startMs
  const currentEnd = beat.endMs
  const currentDuration = Math.max(0, currentEnd - currentStart)
  const minDurationMs = Math.max(100, Math.round(args.minDurationMs ?? 200))
  const snapStepMs = Math.max(0, Math.round(args.snapStepMs ?? 0))
  if (args.mode === 'move') {
    const minStart = Math.max(0, previousBoundary)
    const nextStart = snapStepMs > 0 ? snapAnimaticTimelineValue(currentStart + args.deltaMs, snapStepMs) : currentStart + args.deltaMs
    const startMs = Math.max(minStart, nextStart)
    const endMs = startMs + currentDuration
    const overflowMs = Number.isFinite(nextBoundary) ? Math.max(0, endMs - nextBoundary) : 0
    return {
      [beat.beatRef]: {
        startMs,
        endMs,
      },
      ...shiftFollowingBeatTimingOverrides(beats, args.beatIndex, overflowMs),
    }
  }
  if (args.mode === 'resize-start') {
    const maxStart = Math.max(previousBoundary, currentEnd - minDurationMs)
    const nextStart = snapStepMs > 0 ? snapAnimaticTimelineValue(currentStart + args.deltaMs, snapStepMs) : currentStart + args.deltaMs
    return {
      [beat.beatRef]: {
        startMs: Math.min(maxStart, Math.max(previousBoundary, nextStart)),
        endMs: currentEnd,
      },
    }
  }
  const minEnd = currentStart + minDurationMs
  const nextEnd = snapStepMs > 0 ? snapAnimaticTimelineValue(currentEnd + args.deltaMs, snapStepMs) : currentEnd + args.deltaMs
  const endMs = Math.max(minEnd, nextEnd)
  const overflowMs = Number.isFinite(nextBoundary) ? Math.max(0, endMs - nextBoundary) : 0
  return {
    [beat.beatRef]: {
      startMs: currentStart,
      endMs,
    },
    ...shiftFollowingBeatTimingOverrides(beats, args.beatIndex, overflowMs),
  }
}

// Serializer-only helpers below are kept for low-level utility tests and
// tooling that need to rewrite authored Animatic frontmatter text directly.
// AnimaticCanvas runtime mutations must go through graph-owned record mutators
// and shared store writeback instead of these markdown string helpers.

export function serializeAnimaticTimelineMarkdownWithBeatTiming(args: {
  markdownText: string | null | undefined
  beatRef: string
  startMs: number
  endMs: number
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const roundedStartMs = Math.max(0, Math.round(args.startMs))
  const roundedEndMs = Math.max(roundedStartMs, Math.round(args.endMs))
  nextBeat.start_ms = roundedStartMs
  nextBeat.end_ms = roundedEndMs
  nextBeat.duration_ms = roundedEndMs - roundedStartMs
  if (!readString(nextBeat.label)) nextBeat.label = beatRef
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithScaleConfig(args: {
  markdownText: string | null | undefined
  scaleConfig: Partial<AnimaticTimelineScaleConfig> | null | undefined
}): string {
  const markdownText = String(args.markdownText || '')
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const nextScaleConfig = sanitizeAnimaticTimelineScaleConfig(args.scaleConfig)
  frontmatterState.timeline.scale = {
    scale: nextScaleConfig.scale,
    scale_split_count: nextScaleConfig.scaleSplitCount,
    scale_width: nextScaleConfig.scaleWidth,
    start_left: nextScaleConfig.startLeft,
  }
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithBeatTimingOverrides(args: {
  markdownText: string | null | undefined
  overrides: Record<string, AnimaticTimelineBeatTimingOverride>
}): string {
  const markdownText = String(args.markdownText || '')
  const overrideEntries = Object.entries(args.overrides || {}).filter(([beatRef]) => String(beatRef || '').trim())
  if (overrideEntries.length === 0) return markdownText
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  for (const [beatRef, override] of overrideEntries) {
    const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
    const roundedStartMs = Math.max(0, Math.round(override.startMs))
    const roundedEndMs = Math.max(roundedStartMs, Math.round(override.endMs))
    nextBeat.start_ms = roundedStartMs
    nextBeat.end_ms = roundedEndMs
    nextBeat.duration_ms = roundedEndMs - roundedStartMs
    if (!readString(nextBeat.label)) nextBeat.label = beatRef
    frontmatterState.beats[beatRef] = nextBeat
  }
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithBeatLabel(args: {
  markdownText: string | null | undefined
  beatRef: string
  label: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextLabel = readString(args.label) || beatRef
  nextBeat.label = nextLabel
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithBeatNote(args: {
  markdownText: string | null | undefined
  beatRef: string
  note: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextNote = readString(args.note)
  if (nextNote) nextBeat.note = nextNote
  else delete nextBeat.note
  delete nextBeat.notes
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithBeatSummary(args: {
  markdownText: string | null | undefined
  beatRef: string
  summary: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextSummary = readString(args.summary)
  if (nextSummary) nextBeat.summary = nextSummary
  else delete nextBeat.summary
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithBeatTags(args: {
  markdownText: string | null | undefined
  beatRef: string
  tags: readonly string[] | string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const nextBeat = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextTags = readStringList(args.tags)
  if (nextTags.length > 0) nextBeat.tags = nextTags
  else delete nextBeat.tags
  frontmatterState.beats[beatRef] = nextBeat
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function readAnimaticTimelineLaneControlState(markdownText: string | null | undefined): AnimaticTimelineLaneControlState {
  const text = String(markdownText || '')
  if (!text.trim()) {
    return {
      hiddenLaneIds: [],
      mutedLaneIds: [],
      soloLaneId: null,
    }
  }
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(text))
  const meta = readRecord(parsed.meta)
  const timeline = readRecord(meta.timeline)
  const laneControls = readRecord(timeline.lane_controls)
  return {
    hiddenLaneIds: readLaneIdList(laneControls.hidden),
    mutedLaneIds: readLaneIdList(laneControls.muted),
    soloLaneId: readLaneId(laneControls.solo),
  }
}

export function readAnimaticTimelineLaneOrder(markdownText: string | null | undefined): AnimaticTimelineLaneId[] {
  const text = String(markdownText || '')
  if (!text.trim()) return []
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(text))
  const meta = readRecord(parsed.meta)
  const timeline = readRecord(meta.timeline)
  return readLaneIdList(timeline.lane_order)
}

export function readAnimaticTimelineScaleConfig(markdownText: string | null | undefined): AnimaticTimelineScaleConfig {
  const text = String(markdownText || '')
  if (!text.trim()) return DEFAULT_ANIMATIC_TIMELINE_SCALE_CONFIG
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(text))
  const meta = readRecord(parsed.meta)
  const timeline = readRecord(meta.timeline)
  const scaleRecord = readRecord(timeline.scale)
  return sanitizeAnimaticTimelineScaleConfig({
    scale: scaleRecord.scale,
    scaleSplitCount: scaleRecord.scale_split_count ?? scaleRecord.scaleSplitCount,
    scaleWidth: scaleRecord.scale_width ?? scaleRecord.scaleWidth,
    startLeft: scaleRecord.start_left ?? scaleRecord.startLeft,
  })
}

function updateAnimaticTimelineNodeBeatRefInRows(
  rows: unknown,
  matchArgs: AnimaticTimelineNodeBeatRefMatchArgs,
): { rows: unknown; updated: boolean } {
  const rawRows = Array.isArray(rows) ? rows : []
  let updated = false
  const nextRows = rawRows.map(row => {
    const record = readRecord(cloneJsonLike(row))
    const rowId = readString(record.id)
    const rowLabel = readString(record.label) || readString(record.title) || readString(record.name)
    const rowType = readString(record.type).toLowerCase()
    const params = readRecord(cloneJsonLike(record.params))
    const properties = readRecord(cloneJsonLike(record.properties))
    const propertyParams = readRecord(cloneJsonLike(properties.params))
    const currentBeatRef = readString(params.beat_ref) || readString(propertyParams.beat_ref)
    const rowLaneSignature = `${rowId.toLowerCase()} ${rowLabel.toLowerCase()} ${rowType}`
    const rowLaneId: AnimaticTimelineLaneId =
      rowLaneSignature.includes('overlay')
        ? 'overlay'
        : rowLaneSignature.includes('clip') || rowLaneSignature.includes('video') || rowLaneSignature.includes('shot')
          ? 'clip'
          : rowLaneSignature.includes('audio') || rowLaneSignature.includes('voice') || rowLaneSignature.includes('music') || rowLaneSignature.includes('sfx')
            ? 'audio'
            : rowLaneSignature.includes('scene') || rowLaneSignature.includes('beat') || rowLaneSignature.includes('timeline')
              ? 'scene'
              : 'node'
    const matchesNodeId = matchArgs.nodeId ? rowId === matchArgs.nodeId : false
    const matchesFallback =
      !!matchArgs.title &&
      rowLabel === matchArgs.title &&
      currentBeatRef === matchArgs.sourceBeatRef &&
      (!matchArgs.laneId || rowLaneId === matchArgs.laneId)
    if (!matchesNodeId && !matchesFallback) return record
    if (Object.keys(params).length > 0 || !Object.keys(propertyParams).length) {
      params.beat_ref = matchArgs.nextBeatRef
      record.params = params
    }
    if (Object.keys(propertyParams).length > 0) {
      propertyParams.beat_ref = matchArgs.nextBeatRef
      properties.params = propertyParams
      record.properties = properties
    }
    updated = true
    return record
  })
  return { rows: nextRows, updated }
}

export function serializeAnimaticTimelineMarkdownWithItemBeatRef(args: {
  markdownText: string | null | undefined
  nodeId?: string | null
  title?: string | null
  laneId?: AnimaticTimelineLaneId | null
  sourceBeatRef?: string | null
  beatRef: string
}): { markdownText: string; updated: boolean } {
  const markdownText = String(args.markdownText || '')
  const nodeId = readString(args.nodeId)
  const title = readString(args.title)
  const laneId = readLaneId(args.laneId)
  const sourceBeatRef = readString(args.sourceBeatRef)
  const beatRef = readString(args.beatRef)
  if (!markdownText.trim() || !beatRef || (!nodeId && !(title && sourceBeatRef))) return { markdownText, updated: false }
  const matchArgs: AnimaticTimelineNodeBeatRefMatchArgs = {
    nodeId,
    title,
    laneId,
    sourceBeatRef,
    nextBeatRef: beatRef,
  }
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const rootRowsResult = updateAnimaticTimelineNodeBeatRefInRows(frontmatterState.meta.nodes, matchArgs)
  if (rootRowsResult.updated) {
    frontmatterState.meta.nodes = rootRowsResult.rows
    return {
      markdownText: buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState),
      updated: true,
    }
  }
  const flow = readRecord(cloneJsonLike(frontmatterState.meta.flow))
  const flowRowsResult = updateAnimaticTimelineNodeBeatRefInRows(flow.nodes, matchArgs)
  if (!flowRowsResult.updated) return { markdownText, updated: false }
  flow.nodes = flowRowsResult.rows
  frontmatterState.meta.flow = flow
  return {
    markdownText: buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState),
    updated: true,
  }
}

export function serializeAnimaticTimelineMarkdownWithLaneControlState(args: {
  markdownText: string | null | undefined
  hiddenLaneIds: readonly AnimaticTimelineLaneId[]
  mutedLaneIds: readonly AnimaticTimelineLaneId[]
  soloLaneId?: AnimaticTimelineLaneId | null
}): string {
  const markdownText = String(args.markdownText || '')
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const nextHiddenLaneIds = readLaneIdList(args.hiddenLaneIds)
  const nextMutedLaneIds = readLaneIdList(args.mutedLaneIds)
  const nextSoloLaneId = readLaneId(args.soloLaneId)
  const shouldPersistControls = nextHiddenLaneIds.length > 0 || nextMutedLaneIds.length > 0 || nextSoloLaneId != null
  if (shouldPersistControls) {
    frontmatterState.timeline.lane_controls = {
      hidden: nextHiddenLaneIds,
      muted: nextMutedLaneIds,
      ...(nextSoloLaneId ? { solo: nextSoloLaneId } : {}),
    }
  } else {
    delete frontmatterState.timeline.lane_controls
  }
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithLaneOrder(args: {
  markdownText: string | null | undefined
  laneOrder: readonly AnimaticTimelineLaneId[]
}): string {
  const markdownText = String(args.markdownText || '')
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const nextLaneOrder = readLaneIdList(args.laneOrder)
  if (nextLaneOrder.length > 0) frontmatterState.timeline.lane_order = nextLaneOrder
  else delete frontmatterState.timeline.lane_order
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithInsertedBeat(args: {
  markdownText: string | null | undefined
  model: AnimaticTimelineModel
  insertAfterBeatRef?: string | null
  insertBeforeBeatRef?: string | null
  snapStepMs?: number | null
}): { markdownText: string; beatRef: string } {
  const markdownText = String(args.markdownText || '')
  const snapStepMs = Math.max(0, Math.round(args.snapStepMs ?? 0)) || 1000
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const existingBeatRefs = new Set<string>([
    ...Object.keys(frontmatterState.beats),
    ...args.model.beats.map(beat => beat.beatRef),
  ])
  const beatRef = createNextAnimaticTimelineBeatRef(existingBeatRefs)
  const insertMode = args.insertBeforeBeatRef ? 'before' : 'after'
  const relativeBeatRef = args.insertBeforeBeatRef || args.insertAfterBeatRef || null
  const relativeIndex = (() => {
    if (!relativeBeatRef) return args.model.beats.length - 1
    const found = args.model.beats.findIndex(beat => beat.beatRef === relativeBeatRef)
    return found >= 0 ? found : args.model.beats.length - 1
  })()
  if (args.model.usesAbsoluteTiming) {
    const targetBeat = relativeIndex >= 0 ? args.model.beats[relativeIndex] : null
    const nextBeats = args.model.beats.filter((_, index) => (insertMode === 'before' ? index >= relativeIndex : index > relativeIndex))
    const insertStart =
      insertMode === 'before'
        ? targetBeat?.startMs ?? 0
        : targetBeat?.endMs != null
          ? targetBeat.endMs
          : 0
    const defaultDuration = snapStepMs
    const newBeatRecord: AnimaticTimelineBeatRecord = {
      label: `New Beat ${beatRef.replace(/^beat_/, '')}`,
      start_ms: insertStart,
      end_ms: insertStart + defaultDuration,
      duration_ms: defaultDuration,
    }
    for (const beat of nextBeats) {
      const current = readRecord(cloneJsonLike(frontmatterState.beats[beat.beatRef]))
      if (beat.startMs != null) current.start_ms = beat.startMs + defaultDuration
      if (beat.endMs != null) current.end_ms = beat.endMs + defaultDuration
      if (typeof current.start_ms === 'number' && typeof current.end_ms === 'number') {
        current.duration_ms = Math.max(0, current.end_ms - current.start_ms)
      }
      frontmatterState.beats[beat.beatRef] = current
    }
    const orderedBeatRefs = args.model.beats.map(beat => beat.beatRef)
    const insertAt = insertMode === 'before' ? Math.max(0, relativeIndex) : Math.max(0, relativeIndex + 1)
    orderedBeatRefs.splice(insertAt, 0, beatRef)
    const nextOrderedBeats: Record<string, AnimaticTimelineBeatRecord> = {}
    for (const orderedBeatRef of orderedBeatRefs) {
      if (orderedBeatRef === beatRef) {
        nextOrderedBeats[orderedBeatRef] = newBeatRecord
        continue
      }
      if (frontmatterState.beats[orderedBeatRef]) {
        nextOrderedBeats[orderedBeatRef] = frontmatterState.beats[orderedBeatRef]
      }
    }
    for (const [existingBeatRef, existingBeatRecord] of Object.entries(frontmatterState.beats)) {
      if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
        nextOrderedBeats[existingBeatRef] = existingBeatRecord
      }
    }
    frontmatterState.beats = nextOrderedBeats
  } else {
    frontmatterState.beats[beatRef] = {
      label: `New Beat ${beatRef.replace(/^beat_/, '')}`,
    }
  }
  return {
    markdownText: buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState),
    beatRef,
  }
}

export function serializeAnimaticTimelineMarkdownWithDeletedBeat(args: {
  markdownText: string | null | undefined
  model: AnimaticTimelineModel
  beatRef: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  if (!beatRef) return markdownText
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  if (beatIndex < 0) return markdownText
  const beat = args.model.beats[beatIndex]
  if (!beat || beat.items.length > 0) return markdownText
  const durationToRemove =
    beat.startMs != null && beat.endMs != null
      ? Math.max(0, beat.endMs - beat.startMs)
      : null
  delete frontmatterState.beats[beatRef]
  if (args.model.usesAbsoluteTiming && durationToRemove && durationToRemove > 0) {
    for (let i = beatIndex + 1; i < args.model.beats.length; i += 1) {
      const nextBeat = args.model.beats[i]
      if (!nextBeat) continue
      const current = readRecord(cloneJsonLike(frontmatterState.beats[nextBeat.beatRef]))
      if (nextBeat.startMs != null) current.start_ms = Math.max(0, nextBeat.startMs - durationToRemove)
      if (nextBeat.endMs != null) current.end_ms = Math.max(0, nextBeat.endMs - durationToRemove)
      if (typeof current.start_ms === 'number' && typeof current.end_ms === 'number') {
        current.duration_ms = Math.max(0, current.end_ms - current.start_ms)
      }
      frontmatterState.beats[nextBeat.beatRef] = current
    }
  }
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithDuplicatedBeat(args: {
  markdownText: string | null | undefined
  model: AnimaticTimelineModel
  beatRef: string
  snapStepMs?: number | null
}): { markdownText: string; beatRef: string } {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  const beat = beatIndex >= 0 ? args.model.beats[beatIndex] : null
  if (!beat) return { markdownText, beatRef: '' }
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const existingBeatRefs = new Set<string>([
    ...Object.keys(frontmatterState.beats),
    ...args.model.beats.map(entry => entry.beatRef),
  ])
  const nextBeatRef = createNextAnimaticTimelineBeatRef(existingBeatRefs)
  const nextBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const durationMs =
    beat.startMs != null && beat.endMs != null
      ? Math.max(0, beat.endMs - beat.startMs)
      : Math.max(0, Math.round(args.snapStepMs ?? 1000)) || 1000
  if (args.model.usesAbsoluteTiming && beat.endMs != null) {
    for (let i = beatIndex + 1; i < args.model.beats.length; i += 1) {
      const followingBeat = args.model.beats[i]
      if (!followingBeat) continue
      const current = readRecord(cloneJsonLike(frontmatterState.beats[followingBeat.beatRef]))
      if (followingBeat.startMs != null) current.start_ms = followingBeat.startMs + durationMs
      if (followingBeat.endMs != null) current.end_ms = followingBeat.endMs + durationMs
      if (typeof current.start_ms === 'number' && typeof current.end_ms === 'number') {
        current.duration_ms = Math.max(0, current.end_ms - current.start_ms)
      }
      frontmatterState.beats[followingBeat.beatRef] = current
    }
    nextBeatRecord.start_ms = beat.endMs
    nextBeatRecord.end_ms = beat.endMs + durationMs
    nextBeatRecord.duration_ms = durationMs
  }
  nextBeatRecord.label = `${readString(nextBeatRecord.label) || beat.label} Copy`
  const orderedBeatRefs = args.model.beats.map(entry => entry.beatRef)
  orderedBeatRefs.splice(Math.max(0, beatIndex + 1), 0, nextBeatRef)
  const nextOrderedBeats: Record<string, AnimaticTimelineBeatRecord> = {}
  for (const orderedBeatRef of orderedBeatRefs) {
    if (orderedBeatRef === nextBeatRef) {
      nextOrderedBeats[orderedBeatRef] = nextBeatRecord
      continue
    }
    if (frontmatterState.beats[orderedBeatRef]) {
      nextOrderedBeats[orderedBeatRef] = frontmatterState.beats[orderedBeatRef]
    }
  }
  for (const [existingBeatRef, existingBeatRecord] of Object.entries(frontmatterState.beats)) {
    if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
      nextOrderedBeats[existingBeatRef] = existingBeatRecord
    }
  }
  frontmatterState.beats = nextOrderedBeats
  return {
    markdownText: buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState),
    beatRef: nextBeatRef,
  }
}

export function serializeAnimaticTimelineMarkdownWithSplitBeat(args: {
  markdownText: string | null | undefined
  model: AnimaticTimelineModel
  beatRef: string
  splitAtMs: number
  minDurationMs?: number
  snapStepMs?: number | null
}): { markdownText: string; beatRef: string } {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  const beat = beatIndex >= 0 ? args.model.beats[beatIndex] : null
  if (!beat || beat.startMs == null || beat.endMs == null) return { markdownText, beatRef: '' }
  const minDurationMs = Math.max(100, Math.round(args.minDurationMs ?? 300))
  const snapStepMs = Math.max(0, Math.round(args.snapStepMs ?? 0))
  const rawSplitAtMs = snapStepMs > 0 ? snapAnimaticTimelineValue(args.splitAtMs, snapStepMs) : Math.round(args.splitAtMs)
  const splitAtMs = Math.max(beat.startMs + minDurationMs, Math.min(beat.endMs - minDurationMs, rawSplitAtMs))
  if (splitAtMs <= beat.startMs || splitAtMs >= beat.endMs) return { markdownText, beatRef: '' }
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const existingBeatRefs = new Set<string>([
    ...Object.keys(frontmatterState.beats),
    ...args.model.beats.map(entry => entry.beatRef),
  ])
  const nextBeatRef = createNextAnimaticTimelineBeatRef(existingBeatRefs)
  const currentBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  const nextBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  currentBeatRecord.end_ms = splitAtMs
  currentBeatRecord.duration_ms = splitAtMs - beat.startMs
  nextBeatRecord.start_ms = splitAtMs
  nextBeatRecord.end_ms = beat.endMs
  nextBeatRecord.duration_ms = beat.endMs - splitAtMs
  nextBeatRecord.label = `${readString(nextBeatRecord.label) || beat.label} Part 2`
  frontmatterState.beats[beatRef] = currentBeatRecord
  const orderedBeatRefs = args.model.beats.map(entry => entry.beatRef)
  orderedBeatRefs.splice(Math.max(0, beatIndex + 1), 0, nextBeatRef)
  const nextOrderedBeats: Record<string, AnimaticTimelineBeatRecord> = {}
  for (const orderedBeatRef of orderedBeatRefs) {
    if (orderedBeatRef === nextBeatRef) {
      nextOrderedBeats[orderedBeatRef] = nextBeatRecord
      continue
    }
    if (frontmatterState.beats[orderedBeatRef]) {
      nextOrderedBeats[orderedBeatRef] = frontmatterState.beats[orderedBeatRef]
    }
  }
  for (const [existingBeatRef, existingBeatRecord] of Object.entries(frontmatterState.beats)) {
    if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
      nextOrderedBeats[existingBeatRef] = existingBeatRecord
    }
  }
  frontmatterState.beats = nextOrderedBeats
  return {
    markdownText: buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState),
    beatRef: nextBeatRef,
  }
}

export function serializeAnimaticTimelineMarkdownWithMergedBeatWithNext(args: {
  markdownText: string | null | undefined
  model: AnimaticTimelineModel
  beatRef: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  if (beatIndex < 0) return markdownText
  const beat = args.model.beats[beatIndex]
  const nextBeat = args.model.beats[beatIndex + 1]
  if (!beat || !nextBeat) return markdownText
  if (!args.model.usesAbsoluteTiming) return markdownText
  if (beat.startMs == null || beat.endMs == null || nextBeat.endMs == null) return markdownText
  if (nextBeat.items.length > 0) return markdownText
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  const currentBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[beatRef]))
  currentBeatRecord.end_ms = nextBeat.endMs
  currentBeatRecord.duration_ms = Math.max(0, nextBeat.endMs - beat.startMs)
  frontmatterState.beats[beatRef] = currentBeatRecord
  delete frontmatterState.beats[nextBeat.beatRef]
  const orderedBeatRefs = args.model.beats.map(entry => entry.beatRef).filter(entry => entry !== nextBeat.beatRef)
  const nextOrderedBeats: Record<string, AnimaticTimelineBeatRecord> = {}
  for (const orderedBeatRef of orderedBeatRefs) {
    if (frontmatterState.beats[orderedBeatRef]) nextOrderedBeats[orderedBeatRef] = frontmatterState.beats[orderedBeatRef]
  }
  for (const [existingBeatRef, existingBeatRecord] of Object.entries(frontmatterState.beats)) {
    if (!Object.prototype.hasOwnProperty.call(nextOrderedBeats, existingBeatRef)) {
      nextOrderedBeats[existingBeatRef] = existingBeatRecord
    }
  }
  frontmatterState.beats = nextOrderedBeats
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function serializeAnimaticTimelineMarkdownWithRemovedGapBeforeBeat(args: {
  markdownText: string | null | undefined
  model: AnimaticTimelineModel
  beatRef: string
}): string {
  const markdownText = String(args.markdownText || '')
  const beatRef = String(args.beatRef || '').trim()
  const beatIndex = args.model.beats.findIndex(beat => beat.beatRef === beatRef)
  if (beatIndex <= 0) return markdownText
  const beat = args.model.beats[beatIndex]
  const previousBeat = args.model.beats[beatIndex - 1]
  if (!beat || !previousBeat) return markdownText
  if (!args.model.usesAbsoluteTiming) return markdownText
  if (beat.startMs == null || previousBeat.endMs == null) return markdownText
  const gapMs = Math.max(0, beat.startMs - previousBeat.endMs)
  if (gapMs <= 0) return markdownText
  const frontmatterState = collectAnimaticTimelineFrontmatterState(markdownText)
  for (let i = beatIndex; i < args.model.beats.length; i += 1) {
    const currentBeat = args.model.beats[i]
    if (!currentBeat) continue
    const currentBeatRecord = readRecord(cloneJsonLike(frontmatterState.beats[currentBeat.beatRef]))
    if (currentBeat.startMs != null) currentBeatRecord.start_ms = Math.max(0, currentBeat.startMs - gapMs)
    if (currentBeat.endMs != null) currentBeatRecord.end_ms = Math.max(0, currentBeat.endMs - gapMs)
    if (typeof currentBeatRecord.start_ms === 'number' && typeof currentBeatRecord.end_ms === 'number') {
      currentBeatRecord.duration_ms = Math.max(0, currentBeatRecord.end_ms - currentBeatRecord.start_ms)
    }
    frontmatterState.beats[currentBeat.beatRef] = currentBeatRecord
  }
  return buildAnimaticTimelineMarkdownFromFrontmatterState(frontmatterState)
}

export function findAnimaticTimelineBeatIndexAtPosition(model: AnimaticTimelineModel, position: number): number {
  if (model.beats.length === 0) return -1
  const normalizedPosition = Number.isFinite(position) ? position : 0
  for (let i = 0; i < model.beats.length; i += 1) {
    const beat = model.beats[i]
    if (normalizedPosition < beat.displayEnd || i === model.beats.length - 1) return i
  }
  return model.beats.length - 1
}

export function formatAnimaticTimelineTimestamp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--:--.--'
  const totalMs = Math.max(0, Math.floor(value))
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const centiseconds = Math.floor((totalMs % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}
